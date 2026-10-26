import { inject, Injectable } from '@angular/core';
import { DomainError } from '../core/domain-error';
import { Categoria, Marca, MetodoPago, Sucursal } from '../core/models';
import { MockDb, siguienteId } from './mock-db';
import { asegurarSinReferencias, normalizar, porNombre } from './reglas';

@Injectable({ providedIn: 'root' })
export class SucursalesRepository {
  private readonly db = inject(MockDb);

  async listar(): Promise<Sucursal[]> {
    return (await this.db.leer('sucursales')).sort(porNombre((s) => s.nombre));
  }

  guardar(sucursal: Sucursal): Promise<Sucursal> {
    return this.db.transaccion((t) => {
      if (t.sucursales.some((s) => s.idSucursal !== sucursal.idSucursal && normalizar(s.nombre) === normalizar(sucursal.nombre))) {
        throw new DomainError(`Ya existe una sucursal llamada "${sucursal.nombre}".`);
      }
      if (!sucursal.idSucursal) {
        const nueva = { ...sucursal, idSucursal: siguienteId(t.sucursales, (s) => s.idSucursal) };
        t.sucursales.push(nueva);
        return nueva;
      }
      t.sucursales = t.sucursales.map((s) => (s.idSucursal === sucursal.idSucursal ? sucursal : s));
      return sucursal;
    });
  }

  eliminar(idSucursal: number): Promise<void> {
    return this.db.transaccion((t) => {
      asegurarSinReferencias('la sucursal', [
        ['ventas', t.ventas.filter((v) => v.idSucursal === idSucursal).length],
        ['productos en inventario', t.inventario.filter((i) => i.idSucursal === idSucursal).length],
        ['suministros', t.suministros.filter((s) => s.idSucursal === idSucursal).length],
      ]);
      t.sucursales = t.sucursales.filter((s) => s.idSucursal !== idSucursal);
    });
  }
}

@Injectable({ providedIn: 'root' })
export class MarcasRepository {
  private readonly db = inject(MockDb);

  async listar(): Promise<Marca[]> {
    return (await this.db.leer('marcas')).sort(porNombre((m) => m.nombre));
  }

  guardar(marca: Marca): Promise<Marca> {
    return this.db.transaccion((t) => {
      if (t.marcas.some((m) => m.idMarca !== marca.idMarca && normalizar(m.nombre) === normalizar(marca.nombre))) {
        throw new DomainError(`La marca "${marca.nombre}" ya está registrada.`);
      }
      if (!marca.idMarca) {
        const nueva = { ...marca, idMarca: siguienteId(t.marcas, (m) => m.idMarca) };
        t.marcas.push(nueva);
        return nueva;
      }
      t.marcas = t.marcas.map((m) => (m.idMarca === marca.idMarca ? marca : m));
      return marca;
    });
  }

  eliminar(idMarca: number): Promise<void> {
    return this.db.transaccion((t) => {
      asegurarSinReferencias('la marca', [['productos', t.productos.filter((p) => p.idMarca === idMarca).length]]);
      t.marcas = t.marcas.filter((m) => m.idMarca !== idMarca);
    });
  }
}

@Injectable({ providedIn: 'root' })
export class CategoriasRepository {
  private readonly db = inject(MockDb);

  async listar(): Promise<Categoria[]> {
    return (await this.db.leer('categorias')).sort(porNombre((c) => c.nombre));
  }

  guardar(categoria: Categoria): Promise<Categoria> {
    return this.db.transaccion((t) => {
      if (
        t.categorias.some(
          (c) =>
            c.idCategoria !== categoria.idCategoria &&
            c.idCategoriaPrincipal === categoria.idCategoriaPrincipal &&
            normalizar(c.nombre) === normalizar(categoria.nombre),
        )
      ) {
        throw new DomainError(`Ya existe la categoría "${categoria.nombre}" en ese nivel.`);
      }
      if (categoria.idCategoriaPrincipal !== null) {
        const padre = t.categorias.find((c) => c.idCategoria === categoria.idCategoriaPrincipal);
        if (!padre || padre.idCategoriaPrincipal !== null) {
          throw new DomainError('Una subcategoría debe colgar de una categoría principal.');
        }
        if (categoria.idCategoria && t.categorias.some((c) => c.idCategoriaPrincipal === categoria.idCategoria)) {
          throw new DomainError('Esta categoría tiene subcategorías, así que no puede volverse subcategoría.');
        }
      }
      if (!categoria.idCategoria) {
        const nueva = { ...categoria, idCategoria: siguienteId(t.categorias, (c) => c.idCategoria) };
        t.categorias.push(nueva);
        return nueva;
      }
      t.categorias = t.categorias.map((c) => (c.idCategoria === categoria.idCategoria ? categoria : c));
      return categoria;
    });
  }

  eliminar(idCategoria: number): Promise<void> {
    return this.db.transaccion((t) => {
      asegurarSinReferencias('la categoría', [
        ['subcategorías', t.categorias.filter((c) => c.idCategoriaPrincipal === idCategoria).length],
        ['productos', t.productos.filter((p) => p.idCategoria === idCategoria).length],
      ]);
      t.categorias = t.categorias.filter((c) => c.idCategoria !== idCategoria);
    });
  }
}

@Injectable({ providedIn: 'root' })
export class MetodosPagoRepository {
  private readonly db = inject(MockDb);

  async listar(): Promise<MetodoPago[]> {
    return (await this.db.leer('metodosPago')).sort((a, b) => a.idMetodoPago - b.idMetodoPago);
  }

  guardar(metodo: MetodoPago): Promise<MetodoPago> {
    return this.db.transaccion((t) => {
      if (t.metodosPago.some((m) => m.idMetodoPago !== metodo.idMetodoPago && normalizar(m.tipo) === normalizar(metodo.tipo))) {
        throw new DomainError(`El método de pago "${metodo.tipo}" ya existe.`);
      }
      if (!metodo.idMetodoPago) {
        const nuevo = { ...metodo, idMetodoPago: siguienteId(t.metodosPago, (m) => m.idMetodoPago) };
        t.metodosPago.push(nuevo);
        return nuevo;
      }
      t.metodosPago = t.metodosPago.map((m) => (m.idMetodoPago === metodo.idMetodoPago ? metodo : m));
      return metodo;
    });
  }

  eliminar(idMetodoPago: number): Promise<void> {
    return this.db.transaccion((t) => {
      asegurarSinReferencias('el método de pago', [['ventas', t.ventas.filter((v) => v.idMetodoPago === idMetodoPago).length]]);
      t.metodosPago = t.metodosPago.filter((m) => m.idMetodoPago !== idMetodoPago);
    });
  }
}
