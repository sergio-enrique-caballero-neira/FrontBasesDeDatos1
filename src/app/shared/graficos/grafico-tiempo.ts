import { Component, computed, effect, ElementRef, input, signal, viewChild } from '@angular/core';
import { diaLargo, diaMes } from '../formato';
import { topeRedondo } from './escala';

export interface PuntoTiempo {
  fecha: string;
  valor: number;
  detalle?: string;
}

const ALTO_GRAFICO = 180;
const MARGEN = { arriba: 12, derecha: 12, abajo: 28, izquierda: 64 };

@Component({
  selector: 'app-grafico-tiempo',
  styleUrls: ['./grafico-comun.css', './grafico-tiempo.css'],
  template: `
    <figure class="grafico mb-0" [attr.aria-labelledby]="id + '-titulo'">
      <figcaption class="grafico-encabezado">
        <div>
          <h2 class="card-title" [id]="id + '-titulo'">{{ titulo() }}</h2>
          @if (descripcion()) {
            <p class="text-body-secondary mb-0">{{ descripcion() }}</p>
          }
        </div>
        <div class="segmento" role="group" aria-label="Forma de ver los datos">
          <button type="button" [attr.aria-pressed]="!comoTabla()" (click)="comoTabla.set(false)">Gráfico</button>
          <button type="button" [attr.aria-pressed]="comoTabla()" (click)="comoTabla.set(true)">Tabla</button>
        </div>
      </figcaption>

      @if (puntos().length === 0) {
        <p class="text-body-secondary mb-0 py-3">{{ textoVacio() }}</p>
      } @else if (comoTabla()) {
        <div class="table-responsive tabla-desplazable" tabindex="0" role="region" [attr.aria-label]="'Tabla: ' + titulo()">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th scope="col">Día</th>
                @if (hayDetalle()) {
                  <th scope="col">Detalle</th>
                }
                <th scope="col" class="text-end">{{ nombreValor() }}</th>
              </tr>
            </thead>
            <tbody>
              @for (p of puntos(); track p.fecha) {
                <tr>
                  <td>{{ diaLargo(p.fecha) }}</td>
                  @if (hayDetalle()) {
                    <td class="text-body-secondary">{{ p.detalle }}</td>
                  }
                  <td class="text-end num">{{ formato()(p.valor) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div
          #lienzo
          class="lienzo"
          tabindex="0"
          role="group"
          [attr.aria-label]="resumen() + '. Usa las flechas izquierda y derecha para recorrer los días.'"
          (pointermove)="alMover($event)"
          (pointerleave)="activo.set(null)"
          (focus)="alEnfocar()"
          (blur)="activo.set(null)"
          (keydown)="alTeclear($event)"
        >
          @if (geometria(); as g) {
            <svg [attr.width]="g.ancho" [attr.height]="g.alto" aria-hidden="true" class="d-block">
              @for (t of g.ticksY; track t.valor) {
                <line class="rejilla" [attr.x1]="g.izquierda" [attr.x2]="g.derecha" [attr.y1]="t.y" [attr.y2]="t.y" />
                <text class="eje" [attr.x]="g.izquierda - 8" [attr.y]="t.y" text-anchor="end" dominant-baseline="middle">
                  {{ formatoEje()(t.valor) }}
                </text>
              }
              @for (t of g.ticksX; track t.indice) {
                <text class="eje" [attr.x]="t.x" [attr.y]="g.alto - 8" [attr.text-anchor]="t.ancla">{{ t.texto }}</text>
              }
              <path class="area" [attr.d]="g.area" />
              <path class="linea" [attr.d]="g.linea" />
              @if (activo() !== null) {
                <line class="guia" [attr.x1]="g.xs[activo()!]" [attr.x2]="g.xs[activo()!]" [attr.y1]="g.arriba" [attr.y2]="g.base" />
                <circle class="punto" [attr.cx]="g.xs[activo()!]" [attr.cy]="g.ys[activo()!]" r="4" />
              } @else {
                <circle class="punto" [attr.cx]="g.xs[g.xs.length - 1]" [attr.cy]="g.ys[g.ys.length - 1]" r="4" />
              }
            </svg>
            @if (puntoActivo(); as p) {
              <div class="tooltip-grafico" role="presentation" [style.left.px]="g.xs[activo()!]"
                [class.a-la-izquierda]="g.xs[activo()!] > g.ancho * 0.66">
                <strong class="num">{{ formato()(p.valor) }}</strong>
                <span>{{ diaLargo(p.fecha) }}</span>
                @if (p.detalle) {
                  <span class="text-body-secondary">{{ p.detalle }}</span>
                }
              </div>
            }
          }
        </div>
        <p class="visually-hidden" aria-live="polite">
          @if (puntoActivo(); as p) {
            {{ diaLargo(p.fecha) }}: {{ formato()(p.valor) }}{{ p.detalle ? ', ' + p.detalle : '' }}
          }
        </p>
      }
    </figure>
  `,
})
export class GraficoTiempo {
  private static siguiente = 0;
  protected readonly id = `grafico-tiempo-${++GraficoTiempo.siguiente}`;
  private readonly lienzo = viewChild<ElementRef<HTMLElement>>('lienzo');

  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  readonly puntos = input.required<PuntoTiempo[]>();
  readonly formato = input<(valor: number) => string>((v) => String(v));
  readonly formatoEje = input<(valor: number) => string>((v) => String(v));
  readonly nombreValor = input('Valor');
  readonly textoVacio = input('No hay datos para este periodo.');

  protected readonly comoTabla = signal(false);
  protected readonly activo = signal<number | null>(null);
  private readonly ancho = signal(0);
  protected readonly diaLargo = diaLargo;

  protected readonly hayDetalle = computed(() => this.puntos().some((p) => p.detalle));
  protected readonly puntoActivo = computed(() => {
    const i = this.activo();
    return i === null ? null : (this.puntos()[i] ?? null);
  });

  protected readonly resumen = computed(() => {
    const puntos = this.puntos();
    if (puntos.length === 0) return this.titulo();
    const mayor = puntos.reduce((a, b) => (b.valor > a.valor ? b : a));
    return `${this.titulo()} ${puntos.length} días. El más alto fue el ${diaLargo(mayor.fecha)} con ${this.formato()(mayor.valor)}`;
  });

  protected readonly geometria = computed(() => {
    const puntos = this.puntos();
    const ancho = this.ancho();
    if (ancho < 120 || puntos.length === 0) return null;
    const alto = ALTO_GRAFICO + MARGEN.arriba + MARGEN.abajo;
    const izquierda = MARGEN.izquierda;
    const derecha = ancho - MARGEN.derecha;
    const arriba = MARGEN.arriba;
    const base = arriba + ALTO_GRAFICO;
    const maximo = topeRedondo(Math.max(0, ...puntos.map((p) => p.valor)), puntos.every((p) => Number.isInteger(p.valor)));
    const paso = puntos.length > 1 ? (derecha - izquierda) / (puntos.length - 1) : 0;
    const xs = puntos.map((_, i) => (puntos.length > 1 ? izquierda + i * paso : (izquierda + derecha) / 2));
    const ys = puntos.map((p) => base - (maximo > 0 ? (p.valor / maximo) * ALTO_GRAFICO : 0));
    const linea = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
    const area = `${linea} L${xs[xs.length - 1].toFixed(1)},${base} L${xs[0].toFixed(1)},${base} Z`;
    const ticksY = [0, maximo / 2, maximo].map((valor) => ({ valor, y: base - (maximo > 0 ? (valor / maximo) * ALTO_GRAFICO : 0) }));
    const cada = Math.max(1, Math.ceil(puntos.length / 5));
    const ticksX = puntos
      .map((p, i) => ({ indice: i, x: xs[i], texto: diaMes(p.fecha) }))
      .filter((t) => t.indice === 0 || t.indice === puntos.length - 1 || (t.indice % cada === 0 && puntos.length - 1 - t.indice >= cada / 2))
      .map((t) => ({ ...t, ancla: t.indice === 0 ? 'start' : t.indice === puntos.length - 1 ? 'end' : 'middle' }));
    return { ancho, alto, izquierda, derecha, arriba, base, xs, ys, linea, area, ticksY, ticksX };
  });

  constructor() {
    effect((alLimpiar) => {
      const elemento = this.lienzo()?.nativeElement;
      if (!elemento) return;
      const observador = new ResizeObserver(() => this.ancho.set(elemento.clientWidth));
      observador.observe(elemento);
      this.ancho.set(elemento.clientWidth);
      alLimpiar(() => observador.disconnect());
    });
  }

  protected alMover(evento: PointerEvent): void {
    const g = this.geometria();
    if (!g) return;
    const x = evento.clientX - (evento.currentTarget as HTMLElement).getBoundingClientRect().left;
    let cercano = 0;
    for (let i = 1; i < g.xs.length; i++) {
      if (Math.abs(g.xs[i] - x) < Math.abs(g.xs[cercano] - x)) cercano = i;
    }
    this.activo.set(cercano);
  }

  protected alEnfocar(): void {
    if (this.activo() === null) this.activo.set(this.puntos().length - 1);
  }

  protected alTeclear(evento: KeyboardEvent): void {
    const ultimo = this.puntos().length - 1;
    const actual = this.activo() ?? ultimo;
    const destino =
      evento.key === 'ArrowLeft' ? actual - 1
      : evento.key === 'ArrowRight' ? actual + 1
      : evento.key === 'Home' ? 0
      : evento.key === 'End' ? ultimo
      : null;
    if (destino === null) return;
    evento.preventDefault();
    this.activo.set(Math.min(ultimo, Math.max(0, destino)));
  }
}
