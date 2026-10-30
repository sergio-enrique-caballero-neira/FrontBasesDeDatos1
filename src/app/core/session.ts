import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AutenticacionRepository } from '../data/autenticacion.repository';
import { Avisos } from './avisos';
import { Credenciales } from './credenciales';
import { Empleado } from './models';

export type SeleccionSucursal = number | 'TODAS';

const CLAVE_SUCURSAL = 'ferreteria.sucursal';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly autenticacion = inject(AutenticacionRepository);
  private readonly credenciales = inject(Credenciales);
  private readonly router = inject(Router);
  private readonly avisos = inject(Avisos);

  readonly usuario = signal<Empleado | null>(null);
  readonly sucursal = signal<SeleccionSucursal | undefined>(undefined);
  readonly vencida = signal(false);
  readonly esAdmin = computed(() => this.usuario()?.rol === 'ADMINISTRADOR');
  readonly esVendedor = computed(() => this.usuario()?.rol === 'VENDEDOR');
  readonly nivel = computed(() => (this.esAdmin() ? (this.usuario()?.nivelAcceso ?? 0) : 0));
  readonly idSucursalFiltro = computed(() => {
    const seleccion = this.sucursal();
    return seleccion === undefined || seleccion === 'TODAS' ? null : seleccion;
  });

  private restaurando: Promise<void> | null = null;

  tieneNivel(nivel: number): boolean {
    return this.nivel() >= nivel;
  }

  listo(): Promise<void> {
    this.restaurando ??= this.restaurar();
    return this.restaurando;
  }

  async iniciarSesion(correo: string, contrasena: string): Promise<Empleado> {
    const { token, empleado } = await this.autenticacion.iniciarSesion(correo.trim(), contrasena);
    this.credenciales.guardar(token);
    this.vencida.set(false);
    this.usuario.set(empleado);
    this.sucursal.set(empleado.rol === 'VENDEDOR' ? empleado.idSucursal : undefined);
    this.guardarSucursal();
    return empleado;
  }

  elegirSucursal(seleccion: SeleccionSucursal): void {
    if (!this.esAdmin()) {
      return;
    }
    this.sucursal.set(seleccion);
    this.guardarSucursal();
  }

  cerrarSesion(): void {
    this.vencida.set(false);
    this.terminar();
  }

  expirar(): void {
    if (!this.usuario()) {
      return;
    }
    const volver = this.router.url;
    this.vencida.set(true);
    this.terminar();
    this.avisos.error('Tu sesión venció. Inicia sesión de nuevo.');
    void this.router.navigate(['/login'], { queryParams: { volver } });
  }

  private terminar(): void {
    this.credenciales.limpiar();
    this.usuario.set(null);
    this.sucursal.set(undefined);
    try {
      localStorage.removeItem(CLAVE_SUCURSAL);
    } catch {
      return;
    }
  }

  private async restaurar(): Promise<void> {
    if (!this.credenciales.token()) {
      return;
    }
    try {
      const empleado = await this.autenticacion.perfil();
      this.usuario.set(empleado);
      this.sucursal.set(empleado.rol === 'VENDEDOR' ? empleado.idSucursal : leerSucursal());
    } catch {
      this.terminar();
    }
  }

  private guardarSucursal(): void {
    const seleccion = this.sucursal();
    try {
      if (seleccion === undefined) {
        localStorage.removeItem(CLAVE_SUCURSAL);
      } else {
        localStorage.setItem(CLAVE_SUCURSAL, JSON.stringify(seleccion));
      }
    } catch {
      return;
    }
  }
}

function leerSucursal(): SeleccionSucursal | undefined {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE_SUCURSAL) ?? 'null') as unknown;
    return guardada === 'TODAS' || typeof guardada === 'number' ? guardada : undefined;
  } catch {
    return undefined;
  }
}
