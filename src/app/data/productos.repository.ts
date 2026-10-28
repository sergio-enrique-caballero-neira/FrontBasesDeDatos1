import { inject, Injectable } from '@angular/core';
import { Api } from '../core/api';
import { Inventario, Producto } from '../core/models';
import { porNombre } from './reglas';

interface ProductoApi {
  idProducto: number;
  codigo: string;
  nombreProducto: string;
  descripcion: string | null;
  costoCompra: number;
  precioBaseVenta: number;
  idCategoria: number;
  idMarca: number;
  stock: number;
}

interface InventarioApi {
  idSucursal: number;
  idProducto: number;
  cantidadDisponible: number;
  ubicacionBodega: string;
}

function aProducto(p: ProductoApi): Producto {
  return {
    idProducto: p.idProducto,
    codigo: p.codigo,
    nombre: p.nombreProducto,
    descripcion: p.descripcion ?? '',
    costoCompra: p.costoCompra,
    precioBaseVenta: p.precioBaseVenta,
    stock: p.stock,
    idCategoria: p.idCategoria,
    idMarca: p.idMarca,
  };
}

function aInventario(i: InventarioApi): Inventario {
  return {
    idProducto: i.idProducto,
    idSucursal: i.idSucursal,
    cantidadDisponible: i.cantidadDisponible,
    ubicacionBodega: i.ubicacionBodega,
  };
}

@Injectable({ providedIn: 'root' })
export class ProductosRepository {
  private readonly api = inject(Api);

  async listar(): Promise<Producto[]> {
    return (await this.api.get<ProductoApi[]>('/productos')).map(aProducto).sort(porNombre((p) => p.nombre));
  }

  async obtener(idProducto: number): Promise<Producto> {
    return aProducto(await this.api.get<ProductoApi>(`/productos/${idProducto}`));
  }

  async guardar(producto: Producto): Promise<Producto> {
    const cuerpo = {
      codigo: producto.codigo,
      nombreProducto: producto.nombre,
      descripcion: producto.descripcion,
      costoCompra: producto.costoCompra,
      precioBaseVenta: producto.precioBaseVenta,
      idCategoria: producto.idCategoria,
      idMarca: producto.idMarca,
    };
    const guardado = producto.idProducto
      ? await this.api.put<ProductoApi>(`/productos/${producto.idProducto}`, cuerpo)
      : await this.api.post<ProductoApi>('/productos', cuerpo);
    return aProducto(guardado);
  }

  eliminar(idProducto: number): Promise<void> {
    return this.api.delete(`/productos/${idProducto}`);
  }
}

@Injectable({ providedIn: 'root' })
export class InventarioRepository {
  private readonly api = inject(Api);

  async listar(idSucursal: number | null): Promise<Inventario[]> {
    const ruta = idSucursal === null ? '/inventario' : `/sucursales/${idSucursal}/inventario`;
    return (await this.api.get<InventarioApi[]>(ruta)).map(aInventario);
  }

  async guardar(registro: Inventario): Promise<Inventario> {
    const cuerpo = { cantidadDisponible: registro.cantidadDisponible, ubicacionBodega: registro.ubicacionBodega };
    return aInventario(await this.api.put<InventarioApi>(`/inventario/${registro.idSucursal}/${registro.idProducto}`, cuerpo));
  }

  async registrarEntrada(idProducto: number, idSucursal: number, unidades: number, ubicacionBodega?: string): Promise<Inventario> {
    const cuerpo = { unidades, ubicacionBodega: ubicacionBodega?.trim() || null };
    return aInventario(await this.api.post<InventarioApi>(`/inventario/${idSucursal}/${idProducto}/entradas`, cuerpo));
  }

  eliminar(idProducto: number, idSucursal: number): Promise<void> {
    return this.api.delete(`/inventario/${idSucursal}/${idProducto}`);
  }
}
