import { DomainError } from '../core/domain-error';
import { Tablas } from './mock-db';

/**
 * Simula la restricción de llave foránea (ON DELETE RESTRICT): si algún registro
 * depende del que se quiere borrar, explica cuáles y no borra nada.
 */
export function asegurarSinReferencias(entidad: string, referencias: [descripcion: string, cantidad: number][]): void {
  const enUso = referencias.filter(([, cantidad]) => cantidad > 0);
  if (enUso.length === 0) {
    return;
  }
  const detalle = enUso.map(([descripcion, cantidad]) => `${cantidad} ${descripcion}`).join(', ');
  throw new DomainError(`No se puede eliminar ${entidad}: la usan ${detalle}.`);
}

export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function porNombre<T>(nombre: (fila: T) => string): (a: T, b: T) => number {
  return (a, b) => nombre(a).localeCompare(nombre(b), 'es');
}

/** Mantiene PRODUCTO.stock igual a la suma del inventario de todas las sucursales. */
export function recalcularStock(t: Tablas, idProducto: number): void {
  const producto = t.productos.find((p) => p.idProducto === idProducto);
  if (producto) {
    producto.stock = t.inventario
      .filter((fila) => fila.idProducto === idProducto)
      .reduce((suma, fila) => suma + fila.cantidadDisponible, 0);
  }
}
