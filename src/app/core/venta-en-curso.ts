import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Session } from './session';

export interface LineaEnCurso {
  idProducto: number;
  cantidad: number;
}

export interface ResumenVentaEnCurso {
  productos: number;
  total: number;
}

interface VentaGuardada {
  lineas: LineaEnCurso[];
  idCliente: number | null;
  idMetodoPago: number | null;
  recibido: number | null;
  resumen: ResumenVentaEnCurso;
}

const PREFIJO_CLAVE = 'ferreteria.venta-en-curso';
const RESUMEN_VACIO: ResumenVentaEnCurso = { productos: 0, total: 0 };

@Injectable({ providedIn: 'root' })
export class VentaEnCurso {
  private readonly session = inject(Session);

  readonly lineas = signal<LineaEnCurso[]>([]);
  readonly idCliente = signal<number | null>(null);
  readonly idMetodoPago = signal<number | null>(null);
  readonly recibido = signal<number | null>(null);
  readonly resumen = signal<ResumenVentaEnCurso>(RESUMEN_VACIO);

  readonly hayVenta = computed(() => this.lineas().length > 0);

  private readonly clave = computed(() => {
    const usuario = this.session.usuario();
    const idSucursal = this.session.idSucursalFiltro();
    return usuario && idSucursal !== null ? `${PREFIJO_CLAVE}.${usuario.idEmpleado}.${idSucursal}` : null;
  });

  private readonly claveCargada = signal<string | null>(null);

  constructor() {
    let habiaUsuario = false;
    effect(() => {
      const clave = this.clave();
      const hayUsuario = this.session.usuario() !== null;
      untracked(() => {
        if (!hayUsuario && habiaUsuario && !this.session.vencida()) {
          borrarTodas();
        }
        habiaUsuario = hayUsuario;
        this.aplicar(clave ? leer(clave) : null);
        this.claveCargada.set(clave);
      });
    });

    effect(() => {
      const datos: VentaGuardada = {
        lineas: this.lineas(),
        idCliente: this.idCliente(),
        idMetodoPago: this.idMetodoPago(),
        recibido: this.recibido(),
        resumen: this.resumen(),
      };
      const clave = this.claveCargada();
      if (!clave || clave !== untracked(this.clave)) {
        return;
      }
      const vacia = datos.lineas.length === 0 && datos.idCliente === null && datos.idMetodoPago === null;
      if (vacia) {
        borrar(clave);
      } else {
        escribir(clave, datos);
      }
    });
  }

  limpiar(): void {
    this.aplicar(null);
  }

  private aplicar(datos: VentaGuardada | null): void {
    this.lineas.set(datos?.lineas ?? []);
    this.idCliente.set(datos?.idCliente ?? null);
    this.idMetodoPago.set(datos?.idMetodoPago ?? null);
    this.recibido.set(datos?.recibido ?? null);
    this.resumen.set(datos?.resumen ?? RESUMEN_VACIO);
  }
}

function leer(clave: string): VentaGuardada | null {
  try {
    const datos = JSON.parse(sessionStorage.getItem(clave) ?? 'null') as Partial<VentaGuardada> | null;
    if (!datos || !Array.isArray(datos.lineas)) {
      return null;
    }
    return {
      lineas: datos.lineas.filter(
        (l): l is LineaEnCurso => Number.isInteger(l?.idProducto) && Number.isInteger(l?.cantidad) && l.cantidad > 0,
      ),
      idCliente: typeof datos.idCliente === 'number' ? datos.idCliente : null,
      idMetodoPago: typeof datos.idMetodoPago === 'number' ? datos.idMetodoPago : null,
      recibido: typeof datos.recibido === 'number' ? datos.recibido : null,
      resumen:
        datos.resumen && typeof datos.resumen.productos === 'number' && typeof datos.resumen.total === 'number'
          ? datos.resumen
          : RESUMEN_VACIO,
    };
  } catch {
    return null;
  }
}

function escribir(clave: string, datos: VentaGuardada): void {
  try {
    sessionStorage.setItem(clave, JSON.stringify(datos));
  } catch {
  }
}

function borrarTodas(): void {
  try {
    const claves = Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i));
    for (const clave of claves) {
      if (clave?.startsWith(PREFIJO_CLAVE)) {
        sessionStorage.removeItem(clave);
      }
    }
  } catch {
  }
}

function borrar(clave: string): void {
  try {
    sessionStorage.removeItem(clave);
  } catch {
  }
}
