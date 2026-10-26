import { Pipe, PipeTransform } from '@angular/core';

const formatoPesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const formatoPesosCompacto = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatoNumero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const formatoDiaMes = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const formatoDiaLargo = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

export function pesos(valor: number): string {
  return formatoPesos.format(valor);
}

/** "$ 2,6 M" para ejes y cifras grandes donde el detalle está en la tabla. */
export function pesosCompactos(valor: number): string {
  return formatoPesosCompacto.format(valor);
}

export function numero(valor: number): string {
  return formatoNumero.format(valor);
}

function desdeISO(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

/** Convierte AAAA-MM-DD en "24 oct 2026" sin que la zona horaria corra el día. */
export function fechaCorta(iso: string): string {
  return formatoFecha.format(desdeISO(iso));
}

/** "24 oct", para ejes de tiempo. */
export function diaMes(iso: string): string {
  return formatoDiaMes.format(desdeISO(iso));
}

/** "viernes, 24 de octubre", para tooltips y encabezados. */
export function diaLargo(iso: string): string {
  return formatoDiaLargo.format(desdeISO(iso));
}

@Pipe({ name: 'pesos' })
export class PesosPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return valor === null || valor === undefined ? '' : pesos(valor);
  }
}

@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    return iso ? fechaCorta(iso) : '';
  }
}
