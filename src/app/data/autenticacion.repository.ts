import { inject, Injectable } from '@angular/core';
import { Api } from '../core/api';
import { Empleado, Rol } from '../core/models';

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

interface SesionApi {
  token: string;
  tipo: string;
  expiraEnMs: number;
  empleado: EmpleadoApi;
}

export interface SesionIniciada {
  token: string;
  empleado: Empleado;
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
export class AutenticacionRepository {
  private readonly api = inject(Api);

  async iniciarSesion(correo: string, contrasena: string): Promise<SesionIniciada> {
    const sesion = await this.api.post<SesionApi>('/auth/login', { correo, contrasena });
    return { token: sesion.token, empleado: aEmpleado(sesion.empleado) };
  }

  async perfil(): Promise<Empleado> {
    return aEmpleado(await this.api.get<EmpleadoApi>('/auth/yo'));
  }
}
