import { inject, Injectable } from '@angular/core';
import { Api } from '../core/api';
import { Categoria, Marca, MetodoPago, Sucursal } from '../core/models';
import { porNombre } from './reglas';

interface SucursalApi {
  idSucursal: number;
  nombreSucursal: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  idAdministrador: number;
  nombreAdministrador: string;
}

interface MarcaApi {
  idMarca: number;
  nombreMarca: string;
  paisOrigen: string;
}

interface CategoriaApi {
  idCategoria: number;
  nombre: string;
  descripcion: string | null;
  idCategoriaPrincipal: number | null;
}

function aSucursal(s: SucursalApi): Sucursal {
  return {
    idSucursal: s.idSucursal,
    nombre: s.nombreSucursal,
    ciudad: s.ciudad,
    direccion: s.direccion,
    telefono: s.telefono,
    idAdministrador: s.idAdministrador,
    nombreAdministrador: s.nombreAdministrador,
  };
}

function aMarca(m: MarcaApi): Marca {
  return { idMarca: m.idMarca, nombre: m.nombreMarca, paisOrigen: m.paisOrigen };
}

function aCategoria(c: CategoriaApi): Categoria {
  return { idCategoria: c.idCategoria, nombre: c.nombre, descripcion: c.descripcion ?? '', idCategoriaPrincipal: c.idCategoriaPrincipal };
}

@Injectable({ providedIn: 'root' })
export class SucursalesRepository {
  private readonly api = inject(Api);

  async listar(): Promise<Sucursal[]> {
    return (await this.api.get<SucursalApi[]>('/sucursales')).map(aSucursal).sort(porNombre((s) => s.nombre));
  }

  async guardar(sucursal: Omit<Sucursal, 'nombreAdministrador'>): Promise<Sucursal> {
    const cuerpo = {
      nombreSucursal: sucursal.nombre,
      ciudad: sucursal.ciudad,
      direccion: sucursal.direccion,
      telefono: sucursal.telefono,
      idAdministrador: sucursal.idAdministrador,
    };
    const guardada = sucursal.idSucursal
      ? await this.api.put<SucursalApi>(`/sucursales/${sucursal.idSucursal}`, cuerpo)
      : await this.api.post<SucursalApi>('/sucursales', cuerpo);
    return aSucursal(guardada);
  }

  eliminar(idSucursal: number): Promise<void> {
    return this.api.delete(`/sucursales/${idSucursal}`);
  }
}

@Injectable({ providedIn: 'root' })
export class MarcasRepository {
  private readonly api = inject(Api);

  async listar(): Promise<Marca[]> {
    return (await this.api.get<MarcaApi[]>('/marcas')).map(aMarca);
  }

  async guardar(marca: Marca): Promise<Marca> {
    const cuerpo = { nombreMarca: marca.nombre, paisOrigen: marca.paisOrigen };
    const guardada = marca.idMarca
      ? await this.api.put<MarcaApi>(`/marcas/${marca.idMarca}`, cuerpo)
      : await this.api.post<MarcaApi>('/marcas', cuerpo);
    return aMarca(guardada);
  }

  eliminar(idMarca: number): Promise<void> {
    return this.api.delete(`/marcas/${idMarca}`);
  }
}

@Injectable({ providedIn: 'root' })
export class CategoriasRepository {
  private readonly api = inject(Api);

  async listar(): Promise<Categoria[]> {
    return (await this.api.get<CategoriaApi[]>('/categorias')).map(aCategoria).sort(porNombre((c) => c.nombre));
  }

  async guardar(categoria: Categoria): Promise<Categoria> {
    const cuerpo = {
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      idCategoriaPrincipal: categoria.idCategoriaPrincipal,
    };
    const guardada = categoria.idCategoria
      ? await this.api.put<CategoriaApi>(`/categorias/${categoria.idCategoria}`, cuerpo)
      : await this.api.post<CategoriaApi>('/categorias', cuerpo);
    return aCategoria(guardada);
  }

  eliminar(idCategoria: number): Promise<void> {
    return this.api.delete(`/categorias/${idCategoria}`);
  }
}

@Injectable({ providedIn: 'root' })
export class MetodosPagoRepository {
  private readonly api = inject(Api);

  listar(): Promise<MetodoPago[]> {
    return this.api.get<MetodoPago[]>('/metodos-pago');
  }

  guardar(metodo: MetodoPago): Promise<MetodoPago> {
    const cuerpo = { tipo: metodo.tipo };
    return metodo.idMetodoPago
      ? this.api.put<MetodoPago>(`/metodos-pago/${metodo.idMetodoPago}`, cuerpo)
      : this.api.post<MetodoPago>('/metodos-pago', cuerpo);
  }

  eliminar(idMetodoPago: number): Promise<void> {
    return this.api.delete(`/metodos-pago/${idMetodoPago}`);
  }
}
