import { inject, Injectable } from '@angular/core';
import { DomainError, NoEncontrado } from '../core/domain-error';
import { fechaISO, horaHHmm } from '../core/fechas';
import { DetalleVenta, Venta } from '../core/models';
import { MockDb, siguienteId } from './mock-db';
import { recalcularStock } from './reglas';
import { numeroFactura } from './seed';

export interface FiltroVentas {
  /** null = todas las sucursales. */
  idSucursal: number | null;
  /** Solo las ventas de este vendedor. */
  idEmpleado?: number;
  /** Solo las ventas de este cliente. */
  idCliente?: number;
  /** Solo las ventas pagadas con este método. */
  idMetodoPago?: number;
  /** AAAA-MM-DD, inclusive. */
  desde?: string;
  /** AAAA-MM-DD, inclusive. */
  hasta?: string;
}

/**
 * Una fila por DETALLE_VENTA con los datos de su VENTA: el JOIN que hará el back
 * para reportes por producto, cliente o vendedor.
 */
export interface LineaVendida extends DetalleVenta {
  fecha: string;
  hora: string;
  idSucursal: number;
  idEmpleado: number;
  idCliente: number;
  numeroFactura: string;
}

export interface NuevaVenta {
  idCliente: number;
  idMetodoPago: number;
  idSucursal: number;
  idEmpleado: number;
  lineas: { idProducto: number; cantidad: number }[];
}

export interface VentaConDetalle {
  venta: Venta;
  detalles: DetalleVenta[];
}

@Injectable({ providedIn: 'root' })
export class VentasRepository {
  private readonly db = inject(MockDb);

  /** Ventas más recientes primero. */
  async listar(filtro: FiltroVentas): Promise<Venta[]> {
    const ventas = await this.db.leer('ventas');
    return ventas.filter((v) => cumpleFiltro(v, filtro)).sort(masRecientePrimero);
  }

  /** Líneas de las ventas que cumplen el filtro, de la venta más reciente a la más antigua. */
  async listarLineas(filtro: FiltroVentas): Promise<LineaVendida[]> {
    const [ventas, detalles] = await Promise.all([this.listar(filtro), this.db.leer('detallesVenta')]);
    const lineasPorVenta = agruparPorVenta(detalles);
    return ventas.flatMap((v) =>
      (lineasPorVenta.get(v.idVenta) ?? []).map((d) => ({
        ...d,
        fecha: v.fecha,
        hora: v.hora,
        idSucursal: v.idSucursal,
        idEmpleado: v.idEmpleado,
        idCliente: v.idCliente,
        numeroFactura: v.numeroFactura,
      })),
    );
  }

  /** Compras de un cliente en todas las sucursales, la más reciente primero. */
  async historialCliente(idCliente: number): Promise<{ ventas: Venta[]; detalles: DetalleVenta[] }> {
    const [ventas, detalles] = await Promise.all([
      this.listar({ idSucursal: null, idCliente }),
      this.db.leer('detallesVenta'),
    ]);
    const ids = new Set(ventas.map((v) => v.idVenta));
    return { ventas, detalles: detalles.filter((d) => ids.has(d.idVenta)) };
  }

  async obtener(idVenta: number): Promise<VentaConDetalle> {
    const [ventas, detalles] = await Promise.all([this.db.leer('ventas'), this.db.leer('detallesVenta')]);
    const venta = ventas.find((v) => v.idVenta === idVenta);
    if (!venta) {
      throw new NoEncontrado('Esta venta no existe. Revisa el enlace o búscala en el historial de ventas.');
    }
    return { venta, detalles: detalles.filter((d) => d.idVenta === idVenta) };
  }

  /**
   * Registra la venta como una sola transacción: valida stock en la sucursal,
   * toma el precio vigente de cada producto, calcula el total desde las líneas
   * y descuenta el inventario. Cuando exista el back, esta lógica vive allá.
   */
  registrar(nueva: NuevaVenta): Promise<VentaConDetalle> {
    return this.db.transaccion((t) => {
      if (nueva.lineas.length === 0) {
        throw new DomainError('Agrega al menos un producto a la venta.');
      }
      if (!t.clientes.some((c) => c.idCliente === nueva.idCliente)) {
        throw new DomainError('El cliente seleccionado ya no existe.');
      }
      if (!t.metodosPago.some((m) => m.idMetodoPago === nueva.idMetodoPago)) {
        throw new DomainError('El método de pago seleccionado ya no existe.');
      }
      const vendedor = t.empleados.find((e) => e.idEmpleado === nueva.idEmpleado);
      if (vendedor?.rol !== 'VENDEDOR') {
        throw new DomainError('Solo un vendedor puede registrar ventas.');
      }

      const idVenta = siguienteId(t.ventas, (v) => v.idVenta);
      const detalles: DetalleVenta[] = [];
      for (const linea of nueva.lineas) {
        const producto = t.productos.find((p) => p.idProducto === linea.idProducto);
        if (!producto) {
          throw new DomainError('Uno de los productos ya no existe.');
        }
        if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
          throw new DomainError(`La cantidad de ${producto.nombre} debe ser un número entero mayor que cero.`);
        }
        if (detalles.some((d) => d.idProducto === producto.idProducto)) {
          throw new DomainError(`${producto.nombre} está repetido en la venta.`);
        }
        const inventario = t.inventario.find(
          (i) => i.idProducto === producto.idProducto && i.idSucursal === nueva.idSucursal,
        );
        const disponible = inventario?.cantidadDisponible ?? 0;
        if (!inventario || disponible < linea.cantidad) {
          throw new DomainError(
            `Stock insuficiente de ${producto.nombre}: pediste ${linea.cantidad} y hay ${disponible} en esta sucursal.`,
          );
        }
        inventario.cantidadDisponible -= linea.cantidad;
        recalcularStock(t, producto.idProducto);
        detalles.push({ idVenta, idProducto: producto.idProducto, cantidad: linea.cantidad, precioUnitario: producto.precioBaseVenta });
      }

      const ahora = new Date();
      const venta: Venta = {
        idVenta,
        numeroFactura: numeroFactura(idVenta),
        fecha: fechaISO(ahora),
        hora: horaHHmm(ahora),
        montoTotal: detalles.reduce((suma, d) => suma + d.cantidad * d.precioUnitario, 0),
        idMetodoPago: nueva.idMetodoPago,
        idCliente: nueva.idCliente,
        idEmpleado: nueva.idEmpleado,
        idSucursal: nueva.idSucursal,
      };
      t.ventas.push(venta);
      t.detallesVenta.push(...detalles);
      return { venta, detalles };
    });
  }
}

function cumpleFiltro(v: Venta, filtro: FiltroVentas): boolean {
  return (
    (filtro.idSucursal === null || v.idSucursal === filtro.idSucursal) &&
    (filtro.idEmpleado === undefined || v.idEmpleado === filtro.idEmpleado) &&
    (filtro.idCliente === undefined || v.idCliente === filtro.idCliente) &&
    (filtro.idMetodoPago === undefined || v.idMetodoPago === filtro.idMetodoPago) &&
    (!filtro.desde || v.fecha >= filtro.desde) &&
    (!filtro.hasta || v.fecha <= filtro.hasta)
  );
}

function masRecientePrimero(a: Venta, b: Venta): number {
  return `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`) || b.idVenta - a.idVenta;
}

function agruparPorVenta(detalles: DetalleVenta[]): Map<number, DetalleVenta[]> {
  const porVenta = new Map<number, DetalleVenta[]>();
  for (const d of detalles) {
    const lineas = porVenta.get(d.idVenta);
    if (lineas) {
      lineas.push(d);
    } else {
      porVenta.set(d.idVenta, [d]);
    }
  }
  return porVenta;
}
