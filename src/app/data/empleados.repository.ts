import { inject, Injectable } from '@angular/core';
import { Api } from '../core/api';
import { Empleado, nombreEmpleado, Rol } from '../core/models';
import { porNombre } from './reglas';

export interface EmpleadoApi {
  idEmpleado: number;
  documento: string;
  nombre: string;
  apellido: string;
  cargo: string;
  correo: string;
  telefonos: string[];
  rol: Rol | null;
  nivelAcceso: number | null;
  comisionVenta: number | null;
  idSucursal: number | null;
  nombreSucursal: string | null;
}

export interface DatosAcceso {
  contrasena?: string;
  claveSeguridad?: string;
}

export function aEmpleado(e: EmpleadoApi): Empleado {
  return {
    idEmpleado: e.idEmpleado,
    documento: e.documento,
    nombre: e.nombre,
    apellido: e.apellido,
    cargo: e.cargo,
    correo: e.correo,
    telefonos: e.telefonos ?? [],
    rol: e.rol ?? 'VENDEDOR',
    nivelAcceso: e.nivelAcceso ?? undefined,
    comisionVenta: e.comisionVenta ?? undefined,
    idSucursal: e.idSucursal ?? undefined,
    nombreSucursal: e.nombreSucursal ?? undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class EmpleadosRepository {
  private readonly api = inject(Api);

  async listar(): Promise<Empleado[]> {
    return (await this.api.get<EmpleadoApi[]>('/empleados')).map(aEmpleado).sort(porNombre(nombreEmpleado));
  }

  async guardar(empleado: Empleado, acceso: DatosAcceso = {}): Promise<Empleado> {
    const admin = empleado.rol === 'ADMINISTRADOR';
    const cuerpo = {
      documento: empleado.documento,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      cargo: empleado.cargo,
      correo: empleado.correo,
      telefonos: empleado.telefonos,
      rol: empleado.rol,
      contrasena: acceso.contrasena || null,
      nivelAcceso: admin ? (empleado.nivelAcceso ?? null) : null,
      claveSeguridad: admin ? acceso.claveSeguridad || null : null,
      comisionVenta: admin ? null : (empleado.comisionVenta ?? null),
      idSucursal: admin ? null : (empleado.idSucursal ?? null),
    };
    const guardado = empleado.idEmpleado
      ? await this.api.put<EmpleadoApi>(`/empleados/${empleado.idEmpleado}`, cuerpo)
      : await this.api.post<EmpleadoApi>('/empleados', cuerpo);
    return aEmpleado(guardado);
  }

  eliminar(idEmpleado: number): Promise<void> {
    return this.api.delete(`/empleados/${idEmpleado}`);
  }
}
