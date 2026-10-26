import { inject, Injectable } from '@angular/core';
import { DomainError, NoEncontrado } from '../core/domain-error';
import { Inventario, Producto } from '../core/models';
import { MockDb, siguienteId } from './mock-db';
import { asegurarSinReferencias, normalizar, porNombre, recalcularStock } from './reglas';

@Injectable({ providedIn: 'root' })
export class ProductosRepository {
  private readonly db = inject(MockDb);

  async listar(): Promise<Producto[]> {
    return (await this.db.leer('productos')).sort(porNombre((p) => p.nombre));
  }

  async obtener(idProducto: number): Promise<Producto> {
    const producto = (await this.db.leer('productos')).find((p) => p.idProducto === idProducto);
    if (!producto) {
      throw new NoEncontrado('Este producto no existe o fue eliminado del catálogo.');
    }
    return producto;
  }

  /** El stock no se edita aquí: se deriva del inventario de las sucursales. */
  guardar(producto: Producto): Promise<Producto> {
    return this.db.transaccion((t) => {
      if (t.productos.some((p) => p.idProducto !== producto.idProducto && normalizar(p.codigo) === normalizar(producto.codigo))) {
        throw new DomainError(`El código ${producto.codigo} ya pertenece a otro producto.`);
      }
      if (producto.precioBaseVenta < producto.costoCompra) {
        throw new DomainError('El precio base de venta no puede ser menor que el costo de compra.');
      }
      if (!producto.idProducto) {
        const nuevo = { ...producto, stock: 0, idProducto: siguienteId(t.productos, (p) => p.idProducto) };
        t.productos.push(nuevo);
        return nuevo;
      }
      const actual = t.productos.find((p) => p.idProducto === producto.idProducto);
      const editado = { ...producto, stock: actual?.stock ?? 0 };
      t.productos = t.productos.map((p) => (p.idProducto === producto.idProducto ? editado : p));
      return editado;
    });
  }

  eliminar(idProducto: number): Promise<void> {
    return this.db.transaccion((t) => {
      asegurarSinReferencias('el producto', [
        ['líneas de venta', t.detallesVenta.filter((d) => d.idProducto === idProducto).length],
        ['registros de inventario', t.inventario.filter((i) => i.idProducto === idProducto).length],
        ['suministros', t.suministros.filter((s) => s.idProducto === idProducto).length],
      ]);
      t.productos = t.productos.filter((p) => p.idProducto !== idProducto);
    });
  }
}

@Injectable({ providedIn: 'root' })
export class InventarioRepository {
  private readonly db = inject(MockDb);

  /** Inventario de una sucursal, o de todas cuando `idSucursal` es null. */
  async listar(idSucursal: number | null): Promise<Inventario[]> {
    const filas = await this.db.leer('inventario');
    return idSucursal === null ? filas : filas.filter((fila) => fila.idSucursal === idSucursal);
  }

  /** Crea o actualiza el registro producto-sucursal y recalcula el stock del producto. */
  guardar(registro: Inventario): Promise<Inventario> {
    return this.db.transaccion((t) => {
      if (registro.cantidadDisponible < 0 || !Number.isInteger(registro.cantidadDisponible)) {
        throw new DomainError('La cantidad disponible debe ser un número entero mayor o igual a cero.');
      }
      const existe = t.inventario.some((i) => i.idProducto === registro.idProducto && i.idSucursal === registro.idSucursal);
      t.inventario = existe
        ? t.inventario.map((i) =>
            i.idProducto === registro.idProducto && i.idSucursal === registro.idSucursal ? registro : i,
          )
        : [...t.inventario, registro];
      recalcularStock(t, registro.idProducto);
      return registro;
    });
  }

  /**
   * Suma mercancía recibida a la cantidad vigente, como
   * `UPDATE inventario SET cantidad = cantidad + :unidades`: lee y escribe dentro
   * de la misma transacción, así dos entradas simultáneas no se pisan. Si el
   * producto aún no está en la sucursal crea el registro, y para eso necesita la
   * ubicación en bodega. Si llega una ubicación, también actualiza la del registro.
   */
  registrarEntrada(idProducto: number, idSucursal: number, unidades: number, ubicacionBodega?: string): Promise<Inventario> {
    return this.db.transaccion((t) => {
      if (!Number.isInteger(unidades) || unidades <= 0) {
        throw new DomainError('Las unidades recibidas deben ser un número entero mayor que cero.');
      }
      if (!t.productos.some((p) => p.idProducto === idProducto)) {
        throw new NoEncontrado('Este producto no existe o fue eliminado del catálogo.');
      }
      if (!t.sucursales.some((s) => s.idSucursal === idSucursal)) {
        throw new NoEncontrado('Esta sucursal no existe o fue eliminada.');
      }
      const ubicacion = ubicacionBodega?.trim() ?? '';
      let registro = t.inventario.find((i) => i.idProducto === idProducto && i.idSucursal === idSucursal);
      if (registro) {
        registro.cantidadDisponible += unidades;
        if (ubicacion) {
          registro.ubicacionBodega = ubicacion;
        }
      } else {
        if (!ubicacion) {
          throw new DomainError('Es la primera entrada de este producto en la sucursal: indica en qué parte de la bodega queda.');
        }
        registro = { idProducto, idSucursal, cantidadDisponible: unidades, ubicacionBodega: ubicacion };
        t.inventario.push(registro);
      }
      recalcularStock(t, idProducto);
      return registro;
    });
  }

  eliminar(idProducto: number, idSucursal: number): Promise<void> {
    return this.db.transaccion((t) => {
      const registro = t.inventario.find((i) => i.idProducto === idProducto && i.idSucursal === idSucursal);
      if (registro && registro.cantidadDisponible > 0) {
        throw new DomainError(
          `Aún quedan ${registro.cantidadDisponible} unidades en esta sucursal. Lleva la cantidad a 0 antes de retirar el producto.`,
        );
      }
      t.inventario = t.inventario.filter((i) => !(i.idProducto === idProducto && i.idSucursal === idSucursal));
      recalcularStock(t, idProducto);
    });
  }
}
