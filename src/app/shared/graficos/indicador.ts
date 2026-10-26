import { Component, computed, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faArrowDown, faArrowRight, faArrowUp } from '@fortawesome/free-solid-svg-icons';

export interface Variacion {
  /** Cambio relativo: 0.12 = +12 %. null cuando el periodo anterior fue cero. */
  relativa: number | null;
  /** El periodo contra el que se compara, con nombre: "vs. los 7 días anteriores". */
  periodo: string;
}

/**
 * Cifra con su etiqueta, una variación opcional contra un periodo con nombre y
 * una línea mínima de tendencia. La variación lleva flecha y texto, nunca solo
 * color; la tendencia es decorativa porque la cifra y la variación ya la dicen.
 */
@Component({
  // Va como <div app-indicador> dentro de un <dl>, que solo admite dt, dd o div.
  selector: 'div[app-indicador]',
  imports: [FaIconComponent],
  styles: `
    :host {
      display: block;
    }
    .valor {
      font-size: 1.875rem;
      font-weight: 600;
      letter-spacing: -0.025em;
      line-height: 1.2;
      margin: 0.25rem 0 0;
    }
    .variacion {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.8125rem;
      color: var(--muted);
    }
    .variacion strong {
      color: var(--ink);
      font-weight: 600;
    }
    svg {
      display: block;
      width: 100%;
      height: 2rem;
      margin-top: 0.5rem;
      overflow: visible;
    }
    .tendencia {
      fill: none;
      stroke: var(--chart-muted);
      stroke-width: 1.5;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .ultimo {
      fill: var(--chart-mark);
      stroke: var(--paper);
      stroke-width: 2;
    }
  `,
  template: `
    <dt class="eyebrow">{{ etiqueta() }}</dt>
    <dd class="mb-0">
      <p class="valor">{{ valor() }}</p>
      @if (variacion(); as v) {
        <span class="variacion">
          @if (v.relativa === null) {
            <span>Sin base de comparación {{ v.periodo }}</span>
          } @else {
            <fa-icon [icon]="icono()" />
            <strong class="num">{{ textoVariacion() }}</strong>
            <span>{{ v.periodo }}</span>
          }
        </span>
      }
      @if (ayuda()) {
        <span class="d-block small text-body-secondary mt-1">{{ ayuda() }}</span>
      }
      @if (trazo(); as t) {
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
          <path class="tendencia" [attr.d]="t.linea" vector-effect="non-scaling-stroke" />
        </svg>
      }
    </dd>
  `,
})
export class Indicador {
  readonly etiqueta = input.required<string>();
  /** Ya formateado: "$ 2.556.800", "14". */
  readonly valor = input.required<string>();
  readonly variacion = input<Variacion | null>(null);
  readonly ayuda = input<string>();
  /** Valores en orden cronológico para la línea de tendencia. */
  readonly tendencia = input<number[]>([]);

  protected readonly icono = computed(() => {
    const relativa = this.variacion()?.relativa ?? 0;
    return relativa > 0.005 ? faArrowUp : relativa < -0.005 ? faArrowDown : faArrowRight;
  });

  protected readonly textoVariacion = computed(() => {
    const relativa = this.variacion()?.relativa ?? 0;
    const porcentaje = Math.round(relativa * 100);
    return `${porcentaje > 0 ? '+' : ''}${porcentaje} %`;
  });

  protected readonly trazo = computed(() => {
    const valores = this.tendencia();
    if (valores.length < 2) return null;
    const maximo = Math.max(...valores);
    const minimo = Math.min(...valores);
    const rango = maximo - minimo || 1;
    const linea = valores
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (valores.length - 1)) * 100).toFixed(2)},${(30 - ((v - minimo) / rango) * 28).toFixed(2)}`)
      .join(' ');
    return { linea };
  });
}

/** Cambio relativo entre dos periodos; null si el anterior fue cero (no hay base). */
export function variacionRelativa(actual: number, anterior: number): number | null {
  return anterior === 0 ? null : (actual - anterior) / anterior;
}
