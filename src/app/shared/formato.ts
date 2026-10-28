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

export function fechaCorta(iso: string): string {
  return formatoFecha.format(desdeISO(iso));
}

export function diaMes(iso: string): string {
  return formatoDiaMes.format(desdeISO(iso));
}

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
