import { inject, Injectable } from '@angular/core';
import { Api } from '../core/api';
import { Empleado } from '../core/models';
import { aEmpleado, EmpleadoApi } from './empleados.repository';

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
