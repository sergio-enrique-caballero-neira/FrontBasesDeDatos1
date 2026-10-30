import { inject, Injectable } from '@angular/core';
import { Api, Parametros } from '../core/api';
import { fechaISO, sumarDias } from '../core/fechas';

export interface FiltroPeriodo {
  idSucursal: number | null;
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

export interface UnidadesInventario {
  idProducto: number;
  idSucursal: number;
  unidades: number;
}

export interface RendimientoProducto extends ProductoVendido {
  utilidadEstimada: number;
}

export interface SucursalDetallada {
  idSucursal: number;
  nombre: string;
  ciudad: string;
  cantidad: number;
  total: number;
  ticketPromedio: number;
  utilidadEstimada: number;
  productosStockBajo: number;
  capitalInventario: number;
}

export interface ComisionVendedor {
  idEmpleado: number;
  nombre: string;
  sucursales: string[];
  cantidad: number;
  total: number;
  ticketPromedio: number;
  tasa: number;
  comision: number;
}

interface ComparativoApi {
  actual: ResumenPeriodo;
  anterior: ResumenPeriodo;
}

interface ProductoVendidoApi {
  idProducto: number;
  codigo: string;
  nombreProducto: string;
  unidades: number;
  total: number;
  utilidadEstimada: number;
}

interface SucursalDetalleApi extends Omit<SucursalDetallada, 'nombre'> {
  nombreSucursal: string;
}

function aRendimiento(p: ProductoVendidoApi): RendimientoProducto {
  return {
    idProducto: p.idProducto,
    nombre: p.nombreProducto,
    codigo: p.codigo,
    unidades: p.unidades,
    total: p.total,
    utilidadEstimada: p.utilidadEstimada,
  };
}

function parametros(filtro: FiltroPeriodo): Parametros {
  return { idSucursal: filtro.idSucursal, idEmpleado: filtro.idEmpleado, desde: filtro.desde, hasta: filtro.hasta };
}

@Injectable({ providedIn: 'root' })
export class EstadisticasRepository {
  private readonly api = inject(Api);

  ventasPorDia(filtro: FiltroPeriodo): Promise<VentasDelDia[]> {
    return this.api.get<VentasDelDia[]>('/estadisticas/ventas-por-dia', parametros(filtro));
  }

  resumen(filtro: FiltroPeriodo): Promise<ComparativoApi> {
    return this.api.get<ComparativoApi>('/estadisticas/resumen', parametros(filtro));
  }

  periodoAnterior(filtro: FiltroPeriodo): FiltroPeriodo {
    const desde = desdeISO(filtro.desde);
    const dias = Math.round((desdeISO(filtro.hasta).getTime() - desde.getTime()) / 86_400_000) + 1;
    return { ...filtro, desde: fechaISO(sumarDias(desde, -dias)), hasta: fechaISO(sumarDias(desde, -1)) };
  }

  porMetodoPago(filtro: FiltroPeriodo): Promise<Agrupado[]> {
    return this.api.get<Agrupado[]>('/estadisticas/por-metodo-pago', parametros(filtro));
  }

  ventasDeProducto(idProducto: number, filtro: FiltroPeriodo): Promise<{ unidades: number; total: number; porDia: VentasDelDia[] }> {
    return this.api.get(`/estadisticas/productos/${idProducto}`, parametros(filtro));
  }

  unidadesPorInventario(filtro: FiltroPeriodo): Promise<UnidadesInventario[]> {
    return this.api.get<UnidadesInventario[]>('/estadisticas/unidades-por-inventario', parametros(filtro));
  }

  async rendimientoPorProducto(filtro: FiltroPeriodo): Promise<RendimientoProducto[]> {
    return (await this.api.get<ProductoVendidoApi[]>('/estadisticas/rendimiento-productos', parametros(filtro))).map(aRendimiento);
  }

  async porSucursalDetallado(filtro: FiltroPeriodo): Promise<SucursalDetallada[]> {
    const filas = await this.api.get<SucursalDetalleApi[]>('/estadisticas/sucursales', parametros(filtro));
    return filas.map(({ nombreSucursal, ...resto }) => ({ ...resto, nombre: nombreSucursal }));
  }

  comisiones(filtro: FiltroPeriodo): Promise<ComisionVendedor[]> {
    return this.api.get<ComisionVendedor[]>('/estadisticas/comisiones', parametros(filtro));
  }
}

function desdeISO(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}
