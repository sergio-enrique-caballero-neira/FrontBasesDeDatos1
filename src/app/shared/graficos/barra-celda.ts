import { Component, computed, input } from '@angular/core';

/**
 * Cifra de una celda de tabla con una barra de 4 px debajo que la compara con el
 * resto de la columna. Pensada para columnas alineadas a la derecha: la base de la
 * barra queda en el borde derecho, bajo las unidades de la cifra, así todas las
 * barras de la columna comparten la misma línea de inicio y crecen hacia la
 * izquierda. La barra es decorativa: la cifra ya dice el valor.
 */
@Component({
  selector: 'app-barra-celda',
  styles: `
    :host {
      display: block;
      min-width: 4.5rem;
      text-align: right;
    }
    .pista {
      display: flex;
      justify-content: flex-end;
      height: 4px;
      margin-top: 0.25rem;
    }
    /* Extremo de dato redondeado (a la izquierda) y base recta (a la derecha). */
    .marca {
      display: block;
      height: 100%;
      border-radius: 2px 0 0 2px;
      background: var(--chart-mark);
    }
  `,
  template: `
    <span class="num">{{ texto() }}</span>
    <span class="pista" aria-hidden="true">
      @if (porcentaje() > 0) {
        <span class="marca" [style.width.%]="porcentaje()" [style.min-width.px]="2"></span>
      }
    </span>
  `,
})
export class BarraCelda {
  /** La cifra ya formateada: "$ 1.250.000", "14". */
  readonly texto = input.required<string>();
  /** Proporción frente al mayor de la columna, de 0 a 1. */
  readonly proporcion = input.required<number>();

  protected readonly porcentaje = computed(() => {
    const p = this.proporcion();
    return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) * 100 : 0;
  });
}
