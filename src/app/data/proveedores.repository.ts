import { inject, Injectable } from '@angular/core';
import { DomainError, NoEncontrado } from '../core/domain-error';
import { Evaluacion, Proveedor, Suministro } from '../core/models';
import { MockDb, siguienteId } from './mock-db';
import { asegurarSinReferencias, normalizar, porNombre } from './reglas';

export function claveSuministro(s: Pick<Suministro, 'nit' | 'idProducto' | 'idSucursal'>): string {
  return `${s.nit}|${s.idProducto}|${s.idSucursal}`;
}

@Injectable({ providedIn: 'root' })
export class ProveedoresRepository {
  private readonly db = inject(MockDb);

  async listar(): Promise<Proveedor[]> {
    return (await this.db.leer('proveedores')).sort(porNombre((p) => p.nombre));
  }

  /** Ignora mayúsculas y espacios de más, igual que la regla de NIT único. */
  async obtener(nit: string): Promise<Proveedor> {
    const buscado = normalizar(nit);
    const proveedor = (await this.db.leer('proveedores')).find((p) => normalizar(p.nit) === buscado);
    if (!proveedor) {
      throw new NoEncontrado('Este proveedor no existe o fue eliminado.');
    }
    return proveedor;
  }

  /** `esNuevo` distingue crear de editar porque la llave (NIT) la escribe el usuario. */
  guardar(proveedor: Proveedor, esNuevo: boolean): Promise<Proveedor> {
    return this.db.transaccion((t) => {
      const nit = normalizar(proveedor.nit);
      if (esNuevo && t.proveedores.some((p) => normalizar(p.nit) === nit)) {
        throw new DomainError(`Ya hay un proveedor con el NIT ${proveedor.nit}.`);
      }
      t.proveedores = esNuevo
        ? [...t.proveedores, proveedor]
        : t.proveedores.map((p) => (normalizar(p.nit) === nit ? proveedor : p));
      return proveedor;
    });
  }

  eliminar(nit: string): Promise<void> {
    return this.db.transaccion((t) => {
      asegurarSinReferencias('el proveedor', [['suministros', t.suministros.filter((s) => s.nit === nit).length]]);
      t.proveedores = t.proveedores.filter((p) => p.nit !== nit);
    });
  }
}

@Injectable({ providedIn: 'root' })
export class SuministrosRepository {
  private readonly db = inject(MockDb);

  listar(): Promise<Suministro[]> {
    return this.db.leer('suministros');
  }

  guardar(suministro: Suministro, esNuevo: boolean): Promise<Suministro> {
    return this.db.transaccion((t) => {
      if (suministro.tiempoEntregaDias < 0 || suministro.precioSuministro <= 0) {
        throw new DomainError('El precio debe ser mayor que cero y los días de entrega no pueden ser negativos.');
      }
      const clave = claveSuministro(suministro);
      const existe = t.suministros.some((s) => claveSuministro(s) === clave);
      if (esNuevo && existe) {
        throw new DomainError('Este proveedor ya suministra ese producto a esa sucursal. Edita el registro existente.');
      }
      t.suministros = esNuevo
        ? [...t.suministros, suministro]
        : t.suministros.map((s) => (claveSuministro(s) === clave ? suministro : s));
      return suministro;
    });
  }

  eliminar(suministro: Suministro): Promise<void> {
    return this.db.transaccion((t) => {
      const clave = claveSuministro(suministro);
      asegurarSinReferencias('el suministro', [
        ['evaluaciones de calidad', t.evaluaciones.filter((e) => claveSuministro(e) === clave).length],
      ]);
      t.suministros = t.suministros.filter((s) => claveSuministro(s) !== clave);
    });
  }
}

@Injectable({ providedIn: 'root' })
export class EvaluacionesRepository {
  private readonly db = inject(MockDb);

  async listar(): Promise<Evaluacion[]> {
    return (await this.db.leer('evaluaciones')).sort(
      (a, b) => b.fechaEvaluacion.localeCompare(a.fechaEvaluacion) || b.idEvaluacion - a.idEvaluacion,
    );
  }

  registrar(evaluacion: Omit<Evaluacion, 'idEvaluacion'>): Promise<Evaluacion> {
    return this.db.transaccion((t) => {
      if (!t.suministros.some((s) => claveSuministro(s) === claveSuministro(evaluacion))) {
        throw new DomainError('Solo se pueden evaluar suministros registrados.');
      }
      const evaluador = t.empleados.find((e) => e.idEmpleado === evaluacion.idEmpleado);
      if (evaluador?.rol !== 'ADMINISTRADOR') {
        throw new DomainError('Solo un administrador puede registrar evaluaciones de calidad.');
      }
      if (evaluacion.calificacion < 1 || evaluacion.calificacion > 5) {
        throw new DomainError('La calificación debe estar entre 1 y 5.');
      }
      const nueva = { ...evaluacion, idEvaluacion: siguienteId(t.evaluaciones, (e) => e.idEvaluacion) };
      t.evaluaciones.push(nueva);
      return nueva;
    });
  }

  eliminar(idEvaluacion: number): Promise<void> {
    return this.db.transaccion((t) => {
      t.evaluaciones = t.evaluaciones.filter((e) => e.idEvaluacion !== idEvaluacion);
    });
  }
}
