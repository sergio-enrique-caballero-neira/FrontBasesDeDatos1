import { inject, Injectable } from '@angular/core';
import { Api, Parametros } from '../core/api';
import { DetalleVenta, Venta } from '../core/models';

export interface FiltroVentas {
  idSucursal: number | null;
  idEmpleado?: number;
  idCliente?: number;
  idMetodoPago?: number;
  desde?: string;
  hasta?: string;
}

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
  lineas: { idProducto: number; cantidad: number }[];
}

export interface VentaConDetalle {
  venta: Venta;
  detalles: DetalleVenta[];
}

interface LineaVentaApi {
  idProducto: number;
  cantidad: number;
  precioUnitario: number;
}

interface VentaApi {
  idVenta: number;
  numeroFactura: string;
  fecha: string;
  hora: string;
  idCliente: number;
  idEmpleado: number;
  idSucursal: number;
  idMetodoPago: number;
  montoTotal: number;
  lineas: LineaVentaApi[] | null;
}

interface LineaVendidaApi extends LineaVentaApi {
  idVenta: number;
  numeroFactura: string;
  fecha: string;
  hora: string;
  idSucursal: number;
  idEmpleado: number;
  idCliente: number;
}

interface PaginaApi<T> {
  contenido: T[];
  totalPaginas: number;
}

const TAMANO_PAGINA = 100;

function aVenta(v: VentaApi): Venta {
  return {
    idVenta: v.idVenta,
    numeroFactura: v.numeroFactura,
    fecha: v.fecha,
    hora: v.hora.slice(0, 5),
    montoTotal: v.montoTotal,
    idMetodoPago: v.idMetodoPago,
    idCliente: v.idCliente,
    idEmpleado: v.idEmpleado,
    idSucursal: v.idSucursal,
  };
}

function aConDetalle(v: VentaApi): VentaConDetalle {
  return {
    venta: aVenta(v),
    detalles: (v.lineas ?? []).map((l) => ({
      idVenta: v.idVenta,
      idProducto: l.idProducto,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
    })),
  };
}

function aLineaVendida(l: LineaVendidaApi): LineaVendida {
  return {
    idVenta: l.idVenta,
    idProducto: l.idProducto,
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    fecha: l.fecha,
    hora: l.hora.slice(0, 5),
    idSucursal: l.idSucursal,
    idEmpleado: l.idEmpleado,
    idCliente: l.idCliente,
    numeroFactura: l.numeroFactura,
  };
}

function parametros(filtro: FiltroVentas): Parametros {
  return {
    idSucursal: filtro.idSucursal,
    idEmpleado: filtro.idEmpleado,
    idCliente: filtro.idCliente,
    idMetodoPago: filtro.idMetodoPago,
    desde: filtro.desde,
    hasta: filtro.hasta,
  };
}

@Injectable({ providedIn: 'root' })
export class VentasRepository {
  private readonly api = inject(Api);

  async listar(filtro: FiltroVentas): Promise<Venta[]> {
    const pagina = (numero: number) =>
      this.api.get<PaginaApi<VentaApi>>('/ventas', { ...parametros(filtro), pagina: numero, tamano: TAMANO_PAGINA });
    const primera = await pagina(0);
    const resto = await Promise.all(Array.from({ length: Math.max(primera.totalPaginas - 1, 0) }, (_, i) => pagina(i + 1)));
    return [primera, ...resto].flatMap((p) => p.contenido).map(aVenta);
  }

  async listarLineas(filtro: FiltroVentas): Promise<LineaVendida[]> {
    return (await this.api.get<LineaVendidaApi[]>('/ventas/lineas', parametros(filtro))).map(aLineaVendida);
  }

  async historialCliente(idCliente: number): Promise<{ ventas: Venta[]; detalles: DetalleVenta[] }> {
    const [ventas, lineas] = await Promise.all([
      this.listar({ idSucursal: null, idCliente }),
      this.listarLineas({ idSucursal: null, idCliente }),
    ]);
    return {
      ventas,
      detalles: lineas.map((l) => ({ idVenta: l.idVenta, idProducto: l.idProducto, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
    };
  }

  async obtener(idVenta: number): Promise<VentaConDetalle> {
    return aConDetalle(await this.api.get<VentaApi>(`/ventas/${idVenta}`));
  }

  async registrar(nueva: NuevaVenta): Promise<VentaConDetalle> {
    return aConDetalle(await this.api.post<VentaApi>('/ventas', nueva));
  }
}
