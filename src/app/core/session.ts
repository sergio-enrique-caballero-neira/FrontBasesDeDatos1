import { computed, inject, Injectable, signal } from '@angular/core';
import { EmpleadosRepository } from '../data/personas.repository';
import { DomainError } from './domain-error';
import { Empleado } from './models';

/** Sucursal de trabajo: un id, o TODAS (solo administradores). */
export type SeleccionSucursal = number | 'TODAS';

interface SesionGuardada {
  idEmpleado: number;
  sucursal?: SeleccionSucursal;
}

const CLAVE_SESION = 'ferreteria.sesion';

/**
 * Sesión simulada. Cuando exista el back, `iniciarSesion` llamará a la API de
 * autenticación y guardará el token; el resto de la app no cambia.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly empleados = inject(EmpleadosRepository);

  readonly usuario = signal<Empleado | null>(null);
  readonly sucursal = signal<SeleccionSucursal | undefined>(undefined);
  readonly esAdmin = computed(() => this.usuario()?.rol === 'ADMINISTRADOR');
  readonly esVendedor = computed(() => this.usuario()?.rol === 'VENDEDOR');
  /** Id para filtrar consultas: null significa todas las sucursales. */
  readonly idSucursalFiltro = computed(() => {
    const seleccion = this.sucursal();
    return seleccion === undefined || seleccion === 'TODAS' ? null : seleccion;
  });

  private restaurando: Promise<void> | null = null;

  /** Recupera la sesión guardada una sola vez; los guards esperan esta promesa. */
  listo(): Promise<void> {
    this.restaurando ??= this.restaurar();
    return this.restaurando;
  }

  async iniciarSesion(correo: string, clave: string): Promise<Empleado> {
    const empleado = await this.empleados.buscarPorCorreo(correo);
    if (!empleado) {
      throw new DomainError('No encontramos un empleado con ese correo empresarial.');
    }
    if (empleado.rol === 'ADMINISTRADOR' && clave !== empleado.claveSeguridad) {
      throw new DomainError(
        clave ? 'La clave de seguridad no es correcta.' : 'Los administradores deben ingresar su clave de seguridad.',
      );
    }
    this.usuario.set(empleado);
    this.sucursal.set(undefined);
    this.guardar();
    return empleado;
  }

  elegirSucursal(seleccion: SeleccionSucursal): void {
    if (seleccion === 'TODAS' && !this.esAdmin()) {
      return;
    }
    this.sucursal.set(seleccion);
    this.guardar();
  }

  cerrarSesion(): void {
    this.usuario.set(null);
    this.sucursal.set(undefined);
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch {
      // Sin almacenamiento no hay nada que borrar.
    }
  }

  private async restaurar(): Promise<void> {
    let guardada: SesionGuardada | null = null;
    try {
      guardada = JSON.parse(localStorage.getItem(CLAVE_SESION) ?? 'null') as SesionGuardada | null;
    } catch {
      guardada = null;
    }
    if (!guardada) {
      return;
    }
    const { idEmpleado, sucursal: sucursalGuardada } = guardada;
    const empleados = await this.empleados.listar();
    const empleado = empleados.find((e) => e.idEmpleado === idEmpleado);
    if (!empleado) {
      this.cerrarSesion();
      return;
    }
    this.usuario.set(empleado);
    const sucursal = sucursalGuardada === 'TODAS' && empleado.rol !== 'ADMINISTRADOR' ? undefined : sucursalGuardada;
    this.sucursal.set(sucursal);
  }

  private guardar(): void {
    const usuario = this.usuario();
    if (!usuario) {
      return;
    }
    const datos: SesionGuardada = { idEmpleado: usuario.idEmpleado, sucursal: this.sucursal() };
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(datos));
    } catch {
      // La sesión dura hasta recargar la página.
    }
  }
}
