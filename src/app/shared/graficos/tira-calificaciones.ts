import { Component, computed, input } from '@angular/core';
import { numero } from '../formato';

/** Ancho fijo de la tira y de su escala, para alinear filas y encabezado de una tabla. */
export const TIRA_ANCHO = 160;
const TIRA_ALTO = 44;
/** Aire a los lados para que el punto de 1 y el de 5 no se corten (radio 4 + anillo). */
const MARGEN_X = 8;
const EJE_Y = 40.5;
/** Centro del primer punto de cada pila y del más alto que cabe bajo la etiqueta. */
const PRIMER_PUNTO = 34;
const PUNTO_MAS_ALTO = 19;
const PASO_PILA = 7;

/** Posición horizontal de una calificación de 1 a 5 dentro de la tira. */
function xCalificacion(valor: number): number {
  return MARGEN_X + ((valor - 1) / 4) * (TIRA_ANCHO - 2 * MARGEN_X);
}

/**
 * Tira de calificaciones de 1 a 5: un punto por evaluación (apilados si se
 * repiten) y una marca vertical en el promedio, con su valor como única
 * etiqueta. La escala es fija y del mismo ancho en todas las filas, así una
 * columna de tiras se compara de un vistazo y `app-escala-calificaciones` puede
 * ir en el encabezado alineada con los puntos.
 */
@Component({
  selector: 'app-tira-calificaciones',
  styles: `
    :host {
      display: inline-block;
      width: 160px; /* TIRA_ANCHO */
      vertical-align: middle;
      line-height: 0;
    }
    svg {
      display: block;
      overflow: visible;
    }
    .eje {
      stroke: var(--chart-grid);
      stroke-width: 1;
    }
    /* Punto en tinta con anillo del color de la superficie: se separa del vecino y de la marca. */
    .punto {
      fill: var(--chart-mark);
      stroke: var(--grafico-superficie, var(--paper));
      stroke-width: 2;
    }
    .promedio {
      stroke: var(--chart-mark);
      stroke-width: 2;
    }
    .valor-promedio {
      fill: var(--ink);
      font-size: 0.6875rem;
      font-weight: 600;
    }
    .sin-datos {
      line-height: 1.5;
    }
  `,
  template: `
    @if (geometria(); as g) {
      <svg [attr.width]="ancho" [attr.height]="alto" [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" role="img" [attr.aria-label]="g.etiqueta">
        <line class="eje" [attr.x1]="g.xs[0]" [attr.x2]="g.xs[4]" [attr.y1]="ejeY" [attr.y2]="ejeY" />
        @for (x of g.xs; track $index) {
          <line class="eje" [attr.x1]="x" [attr.x2]="x" [attr.y1]="ejeY" [attr.y2]="ejeY + 3" />
        }
        <line class="promedio" [attr.x1]="g.promedio.x" [attr.x2]="g.promedio.x" y1="13" [attr.y2]="ejeY" />
        @for (p of g.puntos; track $index) {
          <circle class="punto" [attr.cx]="p.x" [attr.cy]="p.y" r="4" />
        }
        <text class="valor-promedio" [attr.x]="g.promedio.xTexto" y="10" [attr.text-anchor]="g.promedio.ancla">
          {{ g.promedio.texto }}
        </text>
      </svg>
    } @else {
      <span class="sin-datos small text-body-secondary">Sin calificaciones</span>
    }
  `,
})
export class TiraCalificaciones {
  /** Calificaciones de 1 a 5, una por evaluación. */
  readonly valores = input.required<number[]>();

  protected readonly ancho = TIRA_ANCHO;
  protected readonly alto = TIRA_ALTO;
  protected readonly ejeY = EJE_Y;

  protected readonly geometria = computed(() => {
    const valores = this.valores()
      .filter((v) => Number.isFinite(v))
      .map((v) => Math.min(5, Math.max(1, v)));
    if (valores.length === 0) return null;

    // Pilas por calificación; si una pila no cabe, sus puntos se acercan (el anillo los sigue separando).
    const pilas = new Map<number, number>();
    for (const v of valores) pilas.set(v, (pilas.get(v) ?? 0) + 1);
    const masAlta = Math.max(...pilas.values());
    const paso = masAlta > 1 ? Math.min(PASO_PILA, (PRIMER_PUNTO - PUNTO_MAS_ALTO) / (masAlta - 1)) : 0;
    const puntos = [...pilas].flatMap(([v, cuantos]) =>
      Array.from({ length: cuantos }, (_, k) => ({ x: xCalificacion(v), y: PRIMER_PUNTO - k * paso })),
    );

    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    const x = xCalificacion(promedio);
    const texto = numero(promedio);
    const mitad = texto.length * 3.4;
    const ancla = x - mitad < 0 ? 'start' : x + mitad > TIRA_ANCHO ? 'end' : 'middle';
    const xTexto = ancla === 'start' ? 0 : ancla === 'end' ? TIRA_ANCHO : x;

    const etiqueta =
      valores.length === 1
        ? `Una calificación: ${numero(valores[0])} de 5`
        : `Calificaciones ${valores.map(numero).join(', ')}; promedio ${texto} de 5`;

    return {
      xs: [1, 2, 3, 4, 5].map(xCalificacion),
      puntos,
      promedio: { x, texto, ancla, xTexto },
      etiqueta,
    };
  });
}

/**
 * Escala 1 a 5 con el mismo ancho y las mismas posiciones que la tira, para el
 * `th` de la columna. Es decorativa: el encabezado lleva su propio texto.
 */
@Component({
  selector: 'app-escala-calificaciones',
  styles: `
    :host {
      display: inline-block;
      width: 160px; /* TIRA_ANCHO */
      vertical-align: bottom;
      line-height: 0;
    }
    text {
      fill: var(--muted);
      font-size: 0.6875rem;
      font-variant-numeric: tabular-nums;
    }
  `,
  template: `
    <svg [attr.width]="ancho" height="14" [attr.viewBox]="'0 0 ' + ancho + ' 14'" aria-hidden="true">
      @for (v of escala; track v) {
        <text [attr.x]="xCalificacion(v)" y="11" text-anchor="middle">{{ v }}</text>
      }
    </svg>
  `,
})
export class EscalaCalificaciones {
  protected readonly ancho = TIRA_ANCHO;
  protected readonly escala = [1, 2, 3, 4, 5];
  protected readonly xCalificacion = xCalificacion;
}
