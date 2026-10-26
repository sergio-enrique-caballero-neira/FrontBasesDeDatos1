import { Injectable, signal } from '@angular/core';
import {
  Categoria,
  Cliente,
  DetalleVenta,
  Empleado,
  Evaluacion,
  Inventario,
  Marca,
  MetodoPago,
  Producto,
  Proveedor,
  Sucursal,
  Suministro,
  Venta,
} from '../core/models';
import { crearDatosSemilla } from './seed';

export interface Tablas {
  sucursales: Sucursal[];
  marcas: Marca[];
  categorias: Categoria[];
  productos: Producto[];
  inventario: Inventario[];
  proveedores: Proveedor[];
  suministros: Suministro[];
  evaluaciones: Evaluacion[];
  clientes: Cliente[];
  empleados: Empleado[];
  metodosPago: MetodoPago[];
  ventas: Venta[];
  detallesVenta: DetalleVenta[];
}

/** Sube cuando cambia la semilla (v2: cliente consumidor final) para que nadie quede con datos viejos. */
const CLAVE_ALMACENAMIENTO = 'ferreteria.demo.v2';
const CLAVES_ANTERIORES = ['ferreteria.demo.v1'];
const LATENCIA_MIN_MS = 200;
const LATENCIA_MAX_MS = 450;

/**
 * Base de datos simulada que vive en localStorage mientras no exista el back.
 * Los repositorios son su única puerta de entrada: cuando llegue la API, se
 * cambia el cuerpo de cada repositorio por llamadas HTTP y esta clase desaparece.
 */
@Injectable({ providedIn: 'root' })
export class MockDb {
  private tablas: Tablas = this.cargar();
  /** Sube con cada cambio guardado, para que las vistas compartidas (la barra superior) se refresquen. */
  readonly version = signal(0);

  async leer<K extends keyof Tablas>(tabla: K): Promise<Tablas[K]> {
    await latencia();
    return structuredClone(this.tablas[tabla]);
  }

  /**
   * Ejecuta cambios de forma atómica: trabaja sobre una copia y solo la guarda
   * si `cambios` termina sin lanzar error, igual que una transacción.
   */
  async transaccion<T>(cambios: (tablas: Tablas) => T): Promise<T> {
    await latencia();
    const copia = structuredClone(this.tablas);
    const resultado = cambios(copia);
    this.tablas = copia;
    this.guardar();
    this.version.update((v) => v + 1);
    return structuredClone(resultado);
  }

  restaurar(): void {
    this.tablas = crearDatosSemilla(new Date());
    this.guardar();
  }

  private cargar(): Tablas {
    try {
      CLAVES_ANTERIORES.forEach((clave) => localStorage.removeItem(clave));
      const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
      if (guardado) {
        return JSON.parse(guardado) as Tablas;
      }
    } catch {
      // Almacenamiento bloqueado o dañado: se arranca con los datos semilla.
    }
    const semilla = crearDatosSemilla(new Date());
    this.tablas = semilla;
    this.guardar();
    return semilla;
  }

  private guardar(): void {
    try {
      localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(this.tablas));
    } catch {
      // Sin almacenamiento disponible los datos duran hasta recargar la página.
    }
  }
}

export function siguienteId<T>(filas: T[], id: (fila: T) => number): number {
  return filas.reduce((max, fila) => Math.max(max, id(fila)), 0) + 1;
}

function latencia(): Promise<void> {
  const ms = LATENCIA_MIN_MS + Math.random() * (LATENCIA_MAX_MS - LATENCIA_MIN_MS);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
