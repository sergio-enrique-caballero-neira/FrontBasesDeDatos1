import { inject, Injectable } from '@angular/core';
import { fechaISO, sumarDias } from '../core/fechas';
import { COMISION_VENDEDOR, DetalleVenta, nombreEmpleado, Producto, UMBRAL_STOCK_BAJO, Venta } from '../core/models';
import { MockDb } from './mock-db';

export interface FiltroPeriodo {
  /** null = todas las sucursales. */
  idSucursal: number | null;
  /** Solo las ventas de este vendedor. */
  idEmpleado?: number;
  desde: string;
  hasta: string;
}

export interface VentasDelDia {
  fecha: string;
  total: number;
  cantidad: number;
}

export interface ResumenPeriodo {
  total: number;
  cantidad: number;
  unidades: number;
  /** Total / cantidad de ventas; 0 si no hubo ventas. */
  ticketPromedio: number;
}

export interface Agrupado {
  id: number;
  nombre: string;
  total: number;
  cantidad: number;
}

export interface ProductoVendido {
  idProducto: number;
  nombre: string;
  codigo: string;
  unidades: number;
  total: number;
}

/** Unidades vendidas de un producto en una sucursal (base del ritmo de ventas). */
export interface UnidadesInventario {
  idProducto: number;
  idSucursal: number;
  unidades: number;
}

export interface RendimientoProducto extends ProductoVendido {
  /** Suma de cantidad × (precio de venta − costo de compra actual). Es una estimación. */
  utilidadEstimada: number;
}

export interface SucursalDetallada {
  idSucursal: number;
  nombre: string;
  ciudad: string;
  cantidad: number;
  total: number;
  ticketPromedio: number;
  /** Con el costo de compra actual de cada producto. */
  utilidadEstimada: number;
  /** Registros de inventario con cantidad menor o igual a UMBRAL_STOCK_BAJO. */
  productosStockBajo: number;
  /** Suma de cantidad disponible × costo de compra actual. */
  capitalInventario: number;
}

export interface ComisionVendedor {
  idEmpleado: number;
  nombre: string;
  /** Sucursales donde vendió en el periodo, en orden alfabético. */
  sucursales: string[];
  cantidad: number;
  total: number;
  ticketPromedio: number;
  /** Fracción (0.1 = 10 %). */
  tasa: number;
  comision: number;
}

/**
 * Consultas agregadas para gráficos e indicadores. Cada método corresponde a un
 * endpoint de reportes del back (GROUP BY sobre VENTA y DETALLE_VENTA); mientras
 * tanto se calculan sobre la base simulada.
 */
@Injectable({ providedIn: 'root' })
export class EstadisticasRepository {
  private readonly db = inject(MockDb);

  /** Total y número de ventas por día, incluidos los días sin ventas (en cero). */
  async ventasPorDia(filtro: FiltroPeriodo): Promise<VentasDelDia[]> {
    const ventas = await this.ventasDelPeriodo(filtro);
    const dias: VentasDelDia[] = [];
    for (let dia = desdeISO(filtro.desde); fechaISO(dia) <= filtro.hasta; dia = sumarDias(dia, 1)) {
      const fecha = fechaISO(dia);
      const delDia = ventas.filter((v) => v.fecha === fecha);
      dias.push({ fecha, total: suma(delDia), cantidad: delDia.length });
    }
    return dias;
  }

  async resumen(filtro: FiltroPeriodo): Promise<ResumenPeriodo> {
    const [ventas, detalles] = await Promise.all([this.ventasDelPeriodo(filtro), this.db.leer('detallesVenta')]);
    const ids = new Set(ventas.map((v) => v.idVenta));
    const total = suma(ventas);
    return {
      total,
      cantidad: ventas.length,
      unidades: detalles.filter((d) => ids.has(d.idVenta)).reduce((s, d) => s + d.cantidad, 0),
      ticketPromedio: ventas.length ? total / ventas.length : 0,
    };
  }

  /** El mismo número de días justo antes del periodo, para comparar. */
  periodoAnterior(filtro: FiltroPeriodo): FiltroPeriodo {
    const desde = desdeISO(filtro.desde);
    const dias = Math.round((desdeISO(filtro.hasta).getTime() - desde.getTime()) / 86_400_000) + 1;
    return { ...filtro, desde: fechaISO(sumarDias(desde, -dias)), hasta: fechaISO(sumarDias(desde, -1)) };
  }

  async porSucursal(filtro: FiltroPeriodo): Promise<Agrupado[]> {
    const [ventas, sucursales] = await Promise.all([this.ventasDelPeriodo(filtro), this.db.leer('sucursales')]);
    return sucursales
      .filter((s) => filtro.idSucursal === null || s.idSucursal === filtro.idSucursal)
      .map((s) => agrupar(s.idSucursal, s.nombre, ventas.filter((v) => v.idSucursal === s.idSucursal)))
      .sort((a, b) => b.total - a.total);
  }

  async porVendedor(filtro: FiltroPeriodo): Promise<Agrupado[]> {
    const [ventas, empleados] = await Promise.all([this.ventasDelPeriodo(filtro), this.db.leer('empleados')]);
    return empleados
      .filter((e) => e.rol === 'VENDEDOR')
      .map((e) => agrupar(e.idEmpleado, nombreEmpleado(e), ventas.filter((v) => v.idEmpleado === e.idEmpleado)))
      .filter((a) => filtro.idSucursal === null || a.cantidad > 0)
      .sort((a, b) => b.total - a.total);
  }

  async porMetodoPago(filtro: FiltroPeriodo): Promise<Agrupado[]> {
    const [ventas, metodos] = await Promise.all([this.ventasDelPeriodo(filtro), this.db.leer('metodosPago')]);
    return metodos
      .map((m) => agrupar(m.idMetodoPago, m.tipo, ventas.filter((v) => v.idMetodoPago === m.idMetodoPago)))
      .sort((a, b) => b.total - a.total);
  }

  /** Productos ordenados por dinero vendido en el periodo. */
  async productosMasVendidos(filtro: FiltroPeriodo, limite = 10): Promise<ProductoVendido[]> {
    const [ventas, detalles, productos] = await Promise.all([
      this.ventasDelPeriodo(filtro),
      this.db.leer('detallesVenta'),
      this.db.leer('productos'),
    ]);
    const ids = new Set(ventas.map((v) => v.idVenta));
    const porProducto = new Map<number, { unidades: number; total: number }>();
    for (const d of detalles.filter((x) => ids.has(x.idVenta))) {
      const actual = porProducto.get(d.idProducto) ?? { unidades: 0, total: 0 };
      porProducto.set(d.idProducto, { unidades: actual.unidades + d.cantidad, total: actual.total + subtotal(d) });
    }
    return [...porProducto]
      .map(([idProducto, v]) => {
        const producto = productos.find((p) => p.idProducto === idProducto);
        return { idProducto, nombre: producto?.nombre ?? 'Producto eliminado', codigo: producto?.codigo ?? '', ...v };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, limite);
  }

  /** Historial de un producto: unidades vendidas por sucursal en el periodo. */
  async ventasDeProducto(idProducto: number, filtro: FiltroPeriodo): Promise<{ unidades: number; total: number; porDia: VentasDelDia[] }> {
    const [ventas, detalles] = await Promise.all([this.ventasDelPeriodo(filtro), this.db.leer('detallesVenta')]);
    const fechaDe = new Map(ventas.map((v) => [v.idVenta, v.fecha]));
    const lineas = detalles.filter((d) => d.idProducto === idProducto && fechaDe.has(d.idVenta));
    const porDia: VentasDelDia[] = [];
    for (let dia = desdeISO(filtro.desde); fechaISO(dia) <= filtro.hasta; dia = sumarDias(dia, 1)) {
      const fecha = fechaISO(dia);
      const delDia = lineas.filter((d) => fechaDe.get(d.idVenta) === fecha);
      porDia.push({ fecha, total: delDia.reduce((s, d) => s + subtotal(d), 0), cantidad: delDia.reduce((s, d) => s + d.cantidad, 0) });
    }
    return {
      unidades: lineas.reduce((s, d) => s + d.cantidad, 0),
      total: lineas.reduce((s, d) => s + subtotal(d), 0),
      porDia,
    };
  }

  /**
   * Unidades vendidas por par producto-sucursal. Trae todos los registros de
   * inventario de la sucursal filtrada (en 0 si no vendieron) y además los pares
   * con ventas cuyo registro de inventario ya se retiró.
   */
  async unidadesPorInventario(filtro: FiltroPeriodo): Promise<UnidadesInventario[]> {
    const [ventas, detalles, inventario] = await Promise.all([
      this.ventasDelPeriodo(filtro),
      this.db.leer('detallesVenta'),
      this.db.leer('inventario'),
    ]);
    const clave = (idProducto: number, idSucursal: number) => `${idProducto}|${idSucursal}`;
    const porPar = new Map<string, UnidadesInventario>();
    for (const fila of inventario) {
      if (filtro.idSucursal === null || fila.idSucursal === filtro.idSucursal) {
        porPar.set(clave(fila.idProducto, fila.idSucursal), { idProducto: fila.idProducto, idSucursal: fila.idSucursal, unidades: 0 });
      }
    }
    const sucursalDe = new Map(ventas.map((v) => [v.idVenta, v.idSucursal]));
    for (const d of detalles) {
      const idSucursal = sucursalDe.get(d.idVenta);
      if (idSucursal === undefined) {
        continue;
      }
      const k = clave(d.idProducto, idSucursal);
      const actual = porPar.get(k) ?? { idProducto: d.idProducto, idSucursal, unidades: 0 };
      actual.unidades += d.cantidad;
      porPar.set(k, actual);
    }
    return [...porPar.values()].sort((a, b) => a.idProducto - b.idProducto || a.idSucursal - b.idSucursal);
  }

  /** Todos los productos del catálogo, también los que no vendieron, por dinero vendido. */
  async rendimientoPorProducto(filtro: FiltroPeriodo): Promise<RendimientoProducto[]> {
    const [ventas, detalles, productos] = await Promise.all([
      this.ventasDelPeriodo(filtro),
      this.db.leer('detallesVenta'),
      this.db.leer('productos'),
    ]);
    const ids = new Set(ventas.map((v) => v.idVenta));
    const costoDe = costosActuales(productos);
    const porProducto = new Map<number, { unidades: number; total: number; utilidadEstimada: number }>();
    for (const d of detalles.filter((x) => ids.has(x.idVenta))) {
      const actual = porProducto.get(d.idProducto) ?? { unidades: 0, total: 0, utilidadEstimada: 0 };
      actual.unidades += d.cantidad;
      actual.total += subtotal(d);
      actual.utilidadEstimada += utilidad(d, costoDe);
      porProducto.set(d.idProducto, actual);
    }
    return productos
      .map((p) => ({
        idProducto: p.idProducto,
        nombre: p.nombre,
        codigo: p.codigo,
        ...(porProducto.get(p.idProducto) ?? { unidades: 0, total: 0, utilidadEstimada: 0 }),
      }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
  }

  /** Ventas, utilidad e inventario de cada sucursal (también las que no vendieron), por total vendido. */
  async porSucursalDetallado(filtro: FiltroPeriodo): Promise<SucursalDetallada[]> {
    const [ventas, detalles, productos, inventario, sucursales] = await Promise.all([
      this.ventasDelPeriodo(filtro),
      this.db.leer('detallesVenta'),
      this.db.leer('productos'),
      this.db.leer('inventario'),
      this.db.leer('sucursales'),
    ]);
    const costoDe = costosActuales(productos);
    const utilidadPorVenta = new Map<number, number>();
    for (const d of detalles) {
      utilidadPorVenta.set(d.idVenta, (utilidadPorVenta.get(d.idVenta) ?? 0) + utilidad(d, costoDe));
    }
    return sucursales
      .filter((s) => filtro.idSucursal === null || s.idSucursal === filtro.idSucursal)
      .map((s) => {
        const suyas = ventas.filter((v) => v.idSucursal === s.idSucursal);
        const filas = inventario.filter((i) => i.idSucursal === s.idSucursal);
        const total = suma(suyas);
        return {
          idSucursal: s.idSucursal,
          nombre: s.nombre,
          ciudad: s.ciudad,
          cantidad: suyas.length,
          total,
          ticketPromedio: suyas.length ? total / suyas.length : 0,
          utilidadEstimada: suyas.reduce((acc, v) => acc + (utilidadPorVenta.get(v.idVenta) ?? 0), 0),
          productosStockBajo: filas.filter((f) => f.cantidadDisponible <= UMBRAL_STOCK_BAJO).length,
          capitalInventario: filas.reduce((acc, f) => acc + f.cantidadDisponible * (costoDe.get(f.idProducto) ?? 0), 0),
        };
      })
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
  }

  /**
   * Comisión de cada vendedor en el periodo: total vendido × su tasa
   * (`comisionVenta`, o COMISION_VENDEDOR si no tiene una propia). Con una
   * sucursal filtrada solo salen quienes vendieron allí.
   */
  async comisiones(filtro: FiltroPeriodo): Promise<ComisionVendedor[]> {
    const [ventas, empleados, sucursales] = await Promise.all([
      this.ventasDelPeriodo(filtro),
      this.db.leer('empleados'),
      this.db.leer('sucursales'),
    ]);
    const nombreSucursal = new Map(sucursales.map((s) => [s.idSucursal, s.nombre]));
    return empleados
      .filter((e) => e.rol === 'VENDEDOR' && (filtro.idEmpleado === undefined || e.idEmpleado === filtro.idEmpleado))
      .map((e) => {
        const suyas = ventas.filter((v) => v.idEmpleado === e.idEmpleado);
        const total = suma(suyas);
        const tasa = e.comisionVenta ?? COMISION_VENDEDOR;
        return {
          idEmpleado: e.idEmpleado,
          nombre: nombreEmpleado(e),
          sucursales: [...new Set(suyas.map((v) => v.idSucursal))]
            .map((id) => nombreSucursal.get(id) ?? 'Sucursal eliminada')
            .sort((a, b) => a.localeCompare(b, 'es')),
          cantidad: suyas.length,
          total,
          ticketPromedio: suyas.length ? total / suyas.length : 0,
          tasa,
          comision: total * tasa,
        };
      })
      .filter((c) => filtro.idSucursal === null || c.cantidad > 0)
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));
  }

  private async ventasDelPeriodo(filtro: FiltroPeriodo): Promise<Venta[]> {
    const ventas = await this.db.leer('ventas');
    return ventas.filter(
      (v) =>
        v.fecha >= filtro.desde &&
        v.fecha <= filtro.hasta &&
        (filtro.idSucursal === null || v.idSucursal === filtro.idSucursal) &&
        (filtro.idEmpleado === undefined || v.idEmpleado === filtro.idEmpleado),
    );
  }
}

function desdeISO(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function suma(ventas: Venta[]): number {
  return ventas.reduce((s, v) => s + v.montoTotal, 0);
}

function subtotal(d: DetalleVenta): number {
  return d.cantidad * d.precioUnitario;
}

function costosActuales(productos: Producto[]): Map<number, number> {
  return new Map(productos.map((p) => [p.idProducto, p.costoCompra]));
}

/** Margen de una línea con el costo de compra de hoy: el histórico no se guarda, por eso es estimado. */
function utilidad(d: DetalleVenta, costoDe: Map<number, number>): number {
  return d.cantidad * (d.precioUnitario - (costoDe.get(d.idProducto) ?? 0));
}

function agrupar(id: number, nombre: string, ventas: Venta[]): Agrupado {
  return { id, nombre, total: suma(ventas), cantidad: ventas.length };
}
