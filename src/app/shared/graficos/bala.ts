import { Component, computed, input } from '@angular/core';

const ANCHO = 120;
const ALTO = 12;
const BARRA_Y = 3;
const BARRA_ALTO = 6;

@Component({
  selector: 'app-bala',
  styles: `
    :host {
      display: inline-block;
      width: 120px;
      vertical-align: middle;
      line-height: 0;
    }
    svg {
      display: block;
    }
    .pista {
      fill: var(--soft-bg);
    }
    .barra {
      fill: var(--chart-mark);
    }
    .marca-fondo {
      stroke: var(--grafico-superficie, var(--paper));
      stroke-width: 4;
    }
    .marca {
      stroke: var(--chart-mark);
      stroke-width: 2;
    }
  `,
  template: `
    <svg [attr.width]="ancho" [attr.height]="alto" [attr.viewBox]="'0 0 ' + ancho + ' ' + alto" aria-hidden="true" focusable="false">
      <rect class="pista" x="0" [attr.y]="barraY" [attr.width]="ancho" [attr.height]="barraAlto" />
      @if (trazoBarra(); as d) {
        <path class="barra" [attr.d]="d" />
      }
      @if (xMarca(); as x) {
        <line class="marca-fondo" [attr.x1]="x" [attr.x2]="x" y1="0" [attr.y2]="alto" />
        <line class="marca" [attr.x1]="x" [attr.x2]="x" y1="0" [attr.y2]="alto" />
      }
    </svg>
  `,
})
export class Bala {
  readonly valor = input.required<number | null>();
  readonly marca = input.required<number | null>();
  readonly tope = input(30);

  protected readonly ancho = ANCHO;
  protected readonly alto = ALTO;
  protected readonly barraY = BARRA_Y;
  protected readonly barraAlto = BARRA_ALTO;

  private readonly escala = computed(() => {
    const tope = this.tope();
    return (dias: number) => (tope > 0 ? (Math.min(Math.max(dias, 0), tope) / tope) * ANCHO : 0);
  });

  protected readonly trazoBarra = computed(() => {
    const valor = this.valor();
    if (valor === null || !Number.isFinite(valor) || valor <= 0) return null;
    const w = Math.max(2, this.escala()(valor));
    const r = Math.min(3, w / 2);
    const y0 = BARRA_Y;
    const y1 = BARRA_Y + BARRA_ALTO;
    return `M0,${y0} H${w - r} A${r},${r} 0 0 1 ${w},${y0 + r} V${y1 - r} A${r},${r} 0 0 1 ${w - r},${y1} H0 Z`;
  });

  protected readonly xMarca = computed(() => {
    const marca = this.marca();
    if (marca === null || !Number.isFinite(marca)) return null;
    return Math.min(ANCHO - 1, Math.max(1, this.escala()(marca)));
  });
}
