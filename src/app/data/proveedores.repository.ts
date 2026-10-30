import { inject, Injectable } from '@angular/core';
import { Api } from '../core/api';
import { Evaluacion, Proveedor, Suministro } from '../core/models';
import { porNombre } from './reglas';

export function claveSuministro(s: Pick<Suministro, 'nit' | 'idProducto' | 'idSucursal'>): string {
  return `${s.nit}|${s.idProducto}|${s.idSucursal}`;
}

interface ProveedorApi {
  nit: string;
  nombreProveedor: string;
  direccionProveedor: string;
  telefonos: string[];
  correos: string[];
}

interface SuministroApi {
  nit: string;
  idProducto: number;
  idSucursal: number;
  precioSuministro: number;
  tiempoEntregaDias: number;
}

interface EvaluacionApi {
  idEvaluacion: number;
  nit: string;
  idProducto: number;
  idSucursal: number;
  idEmpleado: number;
  fechaEvaluacion: string;
  calificacion: number;
  cumplimientoTiempo: boolean;
  observaciones: string | null;
}

function aProveedor(p: ProveedorApi): Proveedor {
  return { nit: p.nit, nombre: p.nombreProveedor, direccion: p.direccionProveedor, telefonos: p.telefonos, correos: p.correos };
}

function aSuministro(s: SuministroApi): Suministro {
  return {
    nit: s.nit,
    idProducto: s.idProducto,
    idSucursal: s.idSucursal,
    tiempoEntregaDias: s.tiempoEntregaDias,
    precioSuministro: s.precioSuministro,
  };
}

function aEvaluacion(e: EvaluacionApi): Evaluacion {
  return {
    idEvaluacion: e.idEvaluacion,
    nit: e.nit,
    idProducto: e.idProducto,
    idSucursal: e.idSucursal,
    idEmpleado: e.idEmpleado,
    fechaEvaluacion: e.fechaEvaluacion,
    calificacion: e.calificacion,
    cumplimientoTiempo: e.cumplimientoTiempo,
    observaciones: e.observaciones ?? '',
  };
}

function rutaSuministro(s: Pick<Suministro, 'nit' | 'idProducto' | 'idSucursal'>): string {
  return `/suministros/${encodeURIComponent(s.nit)}/${s.idProducto}/${s.idSucursal}`;
}

@Injectable({ providedIn: 'root' })
export class ProveedoresRepository {
  private readonly api = inject(Api);

  async listar(): Promise<Proveedor[]> {
    return (await this.api.get<ProveedorApi[]>('/proveedores')).map(aProveedor).sort(porNombre((p) => p.nombre));
  }

  async obtener(nit: string): Promise<Proveedor> {
    return aProveedor(await this.api.get<ProveedorApi>(`/proveedores/${encodeURIComponent(nit.trim())}`));
  }

  async guardar(proveedor: Proveedor, esNuevo: boolean): Promise<Proveedor> {
    const cuerpo = {
      nit: proveedor.nit,
      nombreProveedor: proveedor.nombre,
      direccionProveedor: proveedor.direccion,
      telefonos: proveedor.telefonos,
      correos: proveedor.correos,
    };
    const guardado = esNuevo
      ? await this.api.post<ProveedorApi>('/proveedores', cuerpo)
      : await this.api.put<ProveedorApi>(`/proveedores/${encodeURIComponent(proveedor.nit)}`, cuerpo);
    return aProveedor(guardado);
  }

  eliminar(nit: string, claveSeguridad: string): Promise<void> {
    return this.api.delete(`/proveedores/${encodeURIComponent(nit)}`, claveSeguridad);
  }
}

@Injectable({ providedIn: 'root' })
export class SuministrosRepository {
  private readonly api = inject(Api);

  async listar(): Promise<Suministro[]> {
    return (await this.api.get<SuministroApi[]>('/suministros')).map(aSuministro);
  }

  async guardar(suministro: Suministro, esNuevo: boolean): Promise<Suministro> {
    const condiciones = { precioSuministro: suministro.precioSuministro, tiempoEntregaDias: suministro.tiempoEntregaDias };
    const guardado = esNuevo
      ? await this.api.post<SuministroApi>('/suministros', {
          nit: suministro.nit,
          idProducto: suministro.idProducto,
          idSucursal: suministro.idSucursal,
          ...condiciones,
        })
      : await this.api.put<SuministroApi>(rutaSuministro(suministro), condiciones);
    return aSuministro(guardado);
  }

  eliminar(suministro: Suministro, claveSeguridad: string): Promise<void> {
    return this.api.delete(rutaSuministro(suministro), claveSeguridad);
  }
}

@Injectable({ providedIn: 'root' })
export class EvaluacionesRepository {
  private readonly api = inject(Api);

  async listar(): Promise<Evaluacion[]> {
    return (await this.api.get<EvaluacionApi[]>('/evaluaciones'))
      .map(aEvaluacion)
      .sort((a, b) => b.fechaEvaluacion.localeCompare(a.fechaEvaluacion) || b.idEvaluacion - a.idEvaluacion);
  }

  async registrar(evaluacion: Omit<Evaluacion, 'idEvaluacion' | 'idEmpleado'>): Promise<Evaluacion> {
    const cuerpo = {
      nit: evaluacion.nit,
      idProducto: evaluacion.idProducto,
      idSucursal: evaluacion.idSucursal,
      fechaEvaluacion: evaluacion.fechaEvaluacion,
      calificacion: evaluacion.calificacion,
      cumplimientoTiempo: evaluacion.cumplimientoTiempo,
      observaciones: evaluacion.observaciones || null,
    };
    return aEvaluacion(await this.api.post<EvaluacionApi>('/evaluaciones', cuerpo));
  }

  eliminar(idEvaluacion: number, claveSeguridad: string): Promise<void> {
    return this.api.delete(`/evaluaciones/${idEvaluacion}`, claveSeguridad);
  }
}
