import { Component, computed, effect, ElementRef, input, model, signal, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { hoyISO } from '../../core/fechas';
import { diaLargo, diaMes } from '../formato';
import { anchoTexto, topeRedondo } from './escala';
import { PuntoTiempo } from './grafico-tiempo';

/** Un tramo del periodo, nombrado bajo el eje a partir de su primer día. */
export interface TramoColumnas {
  /** AAAA-MM-DD del primer día del tramo. */
  desde: string;
  /** Nombre del tramo, por ejemplo "Últimos 7 días". */
  texto: string;
}

const MARGEN = { arriba: 12, derecha: 4, abajo: 26 };
/** Columnas delgadas: nunca más de 24 px; el resto de la banda queda como aire. */
const ANCHO_MAXIMO = 24;
/** Superficie entre columnas vecinas cuando la banda es angosta. */
const SEPARACION = 2;
/** Punta redondeada; la base queda recta sobre la línea de cero. */
const RADIO = 4;
/** Espacio que necesita una fecha del eje ("24 oct") con su aire. */
const ANCHO_FECHA = 56;
/** Saltos entre fechas del eje: días seguidos, semanas o meses aproximados. */
const SALTOS_EJE = [1, 2, 3, 7, 14, 28, 56, 91];

interface TramoContiguo {
  texto: string | null;
  inicio: number;
  fin: number;
}

/**
 * Columnas verticales por día, de una sola serie. Las ventas son pocas y
 * discretas por día, así que cada día es una marca propia y no un punto de una
 * línea continua. Una sola tinta; el énfasis deja en tinta un tramo reciente (o el
 * día elegido) y el resto en gris. Toda la banda de cada día responde al puntero
 * y al teclado con un tooltip, y la vista de tabla muestra lo mismo sin depender
 * de él. Con `maximo` varios paneles pequeños comparten la escala.
 */
@Component({
  selector: 'app-grafico-columnas',
  imports: [FaIconComponent],
  styleUrls: ['./grafico-comun.css', './grafico-columnas.css'],
  template: `
    <figure class="grafico mb-0" [attr.aria-labelledby]="id + '-titulo'">
      <figcaption class="grafico-encabezado" [class.compacto]="!mostrarEncabezado()">
        <!-- En paneles pequeños el padre pone el título visible; aquí queda solo para lectores. -->
        <div [class.visually-hidden]="!mostrarEncabezado()">
          @if (mostrarEncabezado()) {
            <h2 class="card-title" [id]="id + '-titulo'">{{ titulo() }}</h2>
          } @else {
            <span [id]="id + '-titulo'">{{ titulo() }}</span>
          }
          @if (descripcion()) {
            <p class="text-body-secondary mb-0">{{ descripcion() }}</p>
          }
        </div>
        <div class="segmento" role="group" aria-label="Forma de ver los datos">
          <button type="button" [attr.aria-pressed]="!comoTabla()" (click)="comoTabla.set(false)">Gráfico</button>
          <button type="button" [attr.aria-pressed]="comoTabla()" (click)="comoTabla.set(true)">Tabla</button>
        </div>
      </figcaption>

      @if (vacio()) {
        <p class="text-body-secondary mb-0 py-3">{{ textoVacio() }}</p>
      } @else if (comoTabla()) {
        <div class="table-responsive tabla-desplazable" tabindex="0" role="region" [attr.aria-label]="'Tabla: ' + titulo()">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th scope="col">Día</th>
                @if (hayDetalle()) {
                  <th scope="col" class="col-sec">Detalle</th>
                }
                <th scope="col" class="text-end">{{ nombreValor() }}</th>
              </tr>
            </thead>
            @for (grupo of grupos(); track grupo.inicio) {
              <tbody>
                @if (grupo.texto) {
                  <tr class="fila-tramo">
                    <th scope="rowgroup" [attr.colspan]="hayDetalle() ? 3 : 2">{{ grupo.texto }}</th>
                  </tr>
                }
                @for (p of grupo.puntos; track p.fecha) {
                  <tr [class.fila-elegida]="p.fecha === fechaElegida()">
                    <td>
                      @if (seleccionable()) {
                        <button type="button" class="boton-dia" [attr.aria-pressed]="p.fecha === fechaElegida()"
                          (click)="alternarFecha(p.fecha)">
                          @if (p.fecha === fechaElegida()) {
                            <fa-icon [icon]="iconoElegido" class="me-1" />
                          }
                          {{ diaTexto(p.fecha) }}
                        </button>
                      } @else {
                        {{ diaTexto(p.fecha) }}
                      }
                      @if (p.detalle) {
                        <div class="solo-movil small text-body-secondary">{{ p.detalle }}</div>
                      }
                    </td>
                    @if (hayDetalle()) {
                      <td class="col-sec text-body-secondary">{{ p.detalle }}</td>
                    }
                    <td class="text-end num">{{ formato()(p.valor) }}</td>
                  </tr>
                }
              </tbody>
            }
          </table>
        </div>
      } @else {
        <div
          #lienzo
          class="lienzo"
          [class.seleccionable]="seleccionable()"
          tabindex="0"
          role="group"
          [style.min-height.px]="alto() + margenVertical"
          [attr.aria-label]="resumen()"
          (pointermove)="alMover($event)"
          (pointerdown)="alMover($event)"
          (pointerleave)="activo.set(null)"
          (click)="alPulsar($event)"
          (focus)="alEnfocar()"
          (blur)="activo.set(null)"
          (keydown)="alTeclear($event)"
        >
          @if (geometria(); as g) {
            <svg [attr.width]="g.ancho" [attr.height]="g.alto" aria-hidden="true" class="d-block">
              @if (activa(); as a) {
                <rect class="banda-activa" [attr.x]="a.columna.centro - g.resalte / 2" [attr.y]="g.arriba - 4"
                  [attr.width]="g.resalte" [attr.height]="g.base - g.arriba + 4" rx="6" />
              }
              @for (t of g.ticksY; track $index) {
                <line class="rejilla" [attr.x1]="g.izquierda" [attr.x2]="g.derecha" [attr.y1]="t.y" [attr.y2]="t.y" />
                <text class="eje" [attr.x]="g.izquierda - 8" [attr.y]="t.y" text-anchor="end" dominant-baseline="middle">
                  {{ t.texto }}
                </text>
              }
              @for (c of g.columnas; track c.fecha; let i = $index) {
                @if (c.trazo) {
                  <path class="columna" [class.atenuada]="atenuadas()[i]" [attr.d]="c.trazo" />
                }
              }
              @for (t of g.ticksX; track t.indice) {
                <text class="eje" [attr.x]="t.x" [attr.y]="g.alto - 8" [attr.text-anchor]="t.ancla">{{ t.texto }}</text>
              }
            </svg>
            @if (activa(); as a) {
              <div class="tooltip-grafico" aria-hidden="true" [style.left.px]="a.columna.centro"
                [class.a-la-izquierda]="a.columna.centro > g.ancho * 0.66">
                <strong class="num">{{ formato()(a.punto.valor) }}</strong>
                <span>{{ diaTexto(a.punto.fecha) }}</span>
                @if (a.punto.detalle) {
                  <span class="text-body-secondary">{{ a.punto.detalle }}</span>
                }
                @if (a.elegida) {
                  <span class="text-body-secondary"><fa-icon [icon]="iconoElegido" class="me-1" />Día elegido</span>
                }
              </div>
            }
          }
        </div>
        @if (geometria(); as g) {
          @if (g.tramos.length > 0) {
            <div class="tramos" aria-hidden="true" [style.padding-left.px]="g.tramos[0].x">
              @for (t of g.tramos; track t.x) {
                <span class="tramo" [style.width.px]="t.ancho"><span>{{ t.texto }}</span></span>
              }
            </div>
          }
        }
        <p class="visually-hidden" aria-live="polite">{{ anuncio() }}</p>
      }
    </figure>
  `,
})
export class GraficoColumnas {
  private static siguiente = 0;
  protected readonly id = `grafico-columnas-${++GraficoColumnas.siguiente}`;
  private readonly lienzo = viewChild<ElementRef<HTMLElement>>('lienzo');

  /** La pregunta que responde el gráfico, por ejemplo "¿Qué días se vendió más?". */
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  /** Un punto por día, en orden cronológico (también los días en cero). */
  readonly puntos = input.required<PuntoTiempo[]>();
  readonly formato = input<(valor: number) => string>((v) => String(v));
  /** Formato corto para el eje Y. */
  readonly formatoEje = input<(valor: number) => string>((v) => String(v));
  readonly nombreValor = input('Valor');
  readonly textoVacio = input('No hay datos para este periodo.');
  /** Escala compartida entre paneles pequeños; se redondea a un tope limpio. Sin él, el tope sale de los datos. */
  readonly maximo = input<number>();
  /** AAAA-MM-DD: desde ese día las columnas van en tinta y las anteriores en gris. Sin él, todas en tinta. */
  readonly enfasisDesde = input<string>();
  /** Nombres de tramos bajo el eje, cada uno desde su primer día. */
  readonly tramos = input<TramoColumnas[]>([]);
  /** Alto del área de dibujo en píxeles, sin contar el eje de fechas. */
  readonly alto = input(180);
  /** En paneles pequeños el padre pone el encabezado; el cambio Gráfico | Tabla queda en la esquina. */
  readonly mostrarEncabezado = input(true);
  /** Si es true, clic, Enter o Espacio eligen un día y Escape quita la elección. */
  readonly seleccionable = input(false);
  /** Día elegido (AAAA-MM-DD). */
  readonly seleccion = model<string | null>(null);

  protected readonly comoTabla = signal(false);
  protected readonly activo = signal<number | null>(null);
  private readonly ancho = signal(0);
  protected readonly margenVertical = MARGEN.arriba + MARGEN.abajo;
  protected readonly iconoElegido = faCheck;
  private readonly hoy = hoyISO();

  /** Sin puntos o con todo en cero no hay nada que comparar: se muestra el texto de vacío. */
  protected readonly vacio = computed(() => this.puntos().every((p) => p.valor <= 0));
  protected readonly hayDetalle = computed(() => this.puntos().some((p) => p.detalle));

  /** La selección solo cuenta si el día está entre los puntos y el gráfico es seleccionable. */
  protected readonly fechaElegida = computed(() => {
    const fecha = this.seleccion();
    return this.seleccionable() && fecha !== null && this.puntos().some((p) => p.fecha === fecha) ? fecha : null;
  });

  /** Gris para lo que no es el foco: todo menos el día elegido, o lo anterior a `enfasisDesde`. */
  protected readonly atenuadas = computed(() => {
    const elegida = this.fechaElegida();
    const desde = this.enfasisDesde();
    return this.puntos().map((p) => (elegida !== null ? p.fecha !== elegida : desde ? p.fecha < desde : false));
  });

  /** Tramos como rangos de índices seguidos; los días anteriores al primer tramo quedan sin nombre. */
  private readonly tramosContiguos = computed<TramoContiguo[]>(() => {
    const tramos = [...this.tramos()].sort((a, b) => a.desde.localeCompare(b.desde));
    const contiguos: TramoContiguo[] = [];
    this.puntos().forEach((p, i) => {
      const texto = tramos.filter((t) => p.fecha >= t.desde).at(-1)?.texto ?? null;
      const ultimo = contiguos.at(-1);
      if (ultimo && ultimo.texto === texto) ultimo.fin = i + 1;
      else contiguos.push({ texto, inicio: i, fin: i + 1 });
    });
    return contiguos;
  });

  protected readonly grupos = computed(() =>
    this.tramosContiguos().map((t) => ({ ...t, puntos: this.puntos().slice(t.inicio, t.fin) })),
  );

  protected readonly geometria = computed(() => {
    const puntos = this.puntos();
    const ancho = this.ancho();
    if (ancho < 120 || puntos.length === 0) return null;
    const altoDibujo = Math.max(40, this.alto());
    const enteros = puntos.every((p) => Number.isInteger(p.valor));
    const tope = topeRedondo(Math.max(this.maximo() ?? 0, ...puntos.map((p) => p.valor)), enteros);
    const marcas = [0, tope / 2, tope].map((valor) => ({ valor, texto: this.formatoEje()(valor) }));
    // El margen izquierdo se ajusta a la etiqueta más larga del eje: ni se corta ni sobra.
    const izquierda = Math.ceil(Math.max(...marcas.map((m) => anchoTexto(m.texto)))) + 10;
    const derecha = ancho - MARGEN.derecha;
    const arriba = MARGEN.arriba;
    const base = arriba + altoDibujo;
    const banda = (derecha - izquierda) / puntos.length;
    const anchoColumna = Math.max(1, Math.min(ANCHO_MAXIMO, banda - SEPARACION));

    const columnas = puntos.map((p, i) => {
      const centro = izquierda + (i + 0.5) * banda;
      // Un día con algo, por poco que sea, se ve: al menos 1 px.
      const altoColumna = p.valor > 0 ? Math.max(1, (p.valor / tope) * altoDibujo) : 0;
      return {
        fecha: p.fecha,
        centro,
        trazo: altoColumna > 0 ? trazoColumna(centro - anchoColumna / 2, base, anchoColumna, altoColumna) : null,
      };
    });

    const ticksY = marcas.map((m) => ({ ...m, y: base - (m.valor / tope) * altoDibujo }));

    // Unas cinco fechas contadas hacia atrás desde el último día, así el salto cae en
    // el mismo día de la semana. El último día siempre lleva fecha (o "Hoy").
    const caben = Math.max(1, Math.min(5, Math.floor((derecha - izquierda) / ANCHO_FECHA)));
    const cada = SALTOS_EJE.find((s) => Math.ceil(puntos.length / s) <= caben) ?? Math.ceil(puntos.length / caben);
    const ticksX: { indice: number; x: number; ancla: string; texto: string }[] = [];
    for (let i = puntos.length - 1; i >= 0; i -= cada) {
      const texto = i === puntos.length - 1 && puntos[i].fecha === this.hoy ? 'Hoy' : diaMes(puntos[i].fecha);
      const centro = columnas[i].centro;
      const mitad = anchoTexto(texto) / 2;
      // Centrada bajo su columna, salvo en los bordes, donde se ancla para no salirse.
      let x = centro;
      let ancla = 'middle';
      if (centro + mitad > ancho) {
        x = ancho;
        ancla = 'end';
      } else if (centro - mitad < 0) {
        x = 0;
        ancla = 'start';
      }
      ticksX.push({ indice: i, x, ancla, texto });
    }

    const tramos = this.tramosContiguos()
      .filter((t) => t.texto !== null)
      .map((t) => ({ texto: t.texto as string, x: izquierda + t.inicio * banda, ancho: (t.fin - t.inicio) * banda }));

    return {
      ancho,
      alto: base + MARGEN.abajo,
      izquierda,
      derecha,
      arriba,
      base,
      banda,
      // El resalte del día activo abraza la columna; el área que responde es toda la banda.
      resalte: Math.min(banda, anchoColumna + 12),
      columnas,
      ticksY,
      ticksX,
      tramos,
    };
  });

  /** Día bajo el puntero o el foco, con su columna para ubicar el tooltip. */
  protected readonly activa = computed(() => {
    const g = this.geometria();
    const i = this.activo();
    if (!g || i === null) return null;
    const punto = this.puntos()[i];
    const columna = g.columnas[i];
    if (!punto || !columna) return null;
    return { punto, columna, elegida: punto.fecha === this.fechaElegida() };
  });

  protected readonly resumen = computed(() => {
    const puntos = this.puntos();
    if (puntos.length === 0) return this.titulo();
    const primero = puntos[0];
    const ultimo = puntos[puntos.length - 1];
    const mayor = puntos.reduce((a, b) => (b.valor > a.valor ? b : a));
    const elegida = this.fechaElegida();
    return [
      puntos.length === 1
        ? `Un día, ${this.diaTexto(primero.fecha)}.`
        : `${puntos.length} días, del ${this.diaTexto(primero.fecha)} al ${this.diaTexto(ultimo.fecha)}.`,
      `El más alto fue el ${this.diaTexto(mayor.fecha)} con ${this.formato()(mayor.valor)}.`,
      elegida ? `Día elegido: ${this.diaTexto(elegida)}.` : '',
      this.seleccionable()
        ? 'Recorre los días con las flechas, elige uno con Enter o Espacio y quita la elección con Escape.'
        : 'Recorre los días con las flechas izquierda y derecha.',
    ]
      .filter(Boolean)
      .join(' ');
  });

  /** Lo que dice el lector de pantalla al moverse por los días. */
  protected readonly anuncio = computed(() => {
    const a = this.activa();
    if (!a) return '';
    const partes = [`${this.diaTexto(a.punto.fecha)}: ${this.formato()(a.punto.valor)}`];
    if (a.punto.detalle) partes.push(a.punto.detalle);
    const tramo = this.tramosContiguos().find((t) => this.activo()! >= t.inicio && this.activo()! < t.fin)?.texto;
    if (tramo) partes.push(tramo);
    if (a.elegida) partes.push('día elegido');
    return partes.join(', ');
  });

  constructor() {
    // El lienzo aparece y desaparece al cambiar entre gráfico y tabla: se observa cada vez que existe.
    effect((alLimpiar) => {
      const elemento = this.lienzo()?.nativeElement;
      if (!elemento) return;
      const observador = new ResizeObserver(() => this.ancho.set(elemento.clientWidth));
      observador.observe(elemento);
      this.ancho.set(elemento.clientWidth);
      alLimpiar(() => observador.disconnect());
    });
  }

  protected diaTexto(fecha: string): string {
    return fecha === this.hoy ? `${diaLargo(fecha)} (hoy)` : diaLargo(fecha);
  }

  protected alternarFecha(fecha: string): void {
    this.seleccion.set(this.seleccion() === fecha ? null : fecha);
  }

  protected alMover(evento: PointerEvent): void {
    this.activo.set(this.indiceEn(evento));
  }

  protected alPulsar(evento: MouseEvent): void {
    if (!this.seleccionable()) return;
    const i = this.indiceEn(evento);
    if (i !== null) this.alternarFecha(this.puntos()[i].fecha);
  }

  protected alEnfocar(): void {
    if (this.activo() === null) this.activo.set(this.indiceInicial());
  }

  protected alTeclear(evento: KeyboardEvent): void {
    const ultimo = this.puntos().length - 1;
    if (ultimo < 0) return;
    const actual = this.activo() ?? this.indiceInicial();
    let destino: number;
    switch (evento.key) {
      case 'ArrowLeft':
        destino = actual - 1;
        break;
      case 'ArrowRight':
        destino = actual + 1;
        break;
      case 'PageUp':
        destino = actual - 7;
        break;
      case 'PageDown':
        destino = actual + 7;
        break;
      case 'Home':
        destino = 0;
        break;
      case 'End':
        destino = ultimo;
        break;
      case 'Enter':
      case ' ':
        if (!this.seleccionable()) return;
        evento.preventDefault();
        this.activo.set(actual);
        this.alternarFecha(this.puntos()[actual].fecha);
        return;
      case 'Escape':
        if (this.seleccionable() && this.seleccion() !== null) {
          // Quitar la elección no debe cerrar además el diálogo que contenga el gráfico.
          evento.preventDefault();
          evento.stopPropagation();
          this.seleccion.set(null);
        } else {
          this.activo.set(null);
        }
        return;
      default:
        return;
    }
    evento.preventDefault();
    this.activo.set(Math.min(ultimo, Math.max(0, destino)));
  }

  /** Al llegar con el teclado se empieza por el día elegido o, si no hay, por el último. */
  private indiceInicial(): number {
    const elegida = this.fechaElegida();
    const i = elegida === null ? -1 : this.puntos().findIndex((p) => p.fecha === elegida);
    return i >= 0 ? i : this.puntos().length - 1;
  }

  /** Día cuya banda completa está bajo el puntero; null fuera del área de dibujo. */
  private indiceEn(evento: MouseEvent): number | null {
    const g = this.geometria();
    if (!g) return null;
    const x = evento.clientX - (evento.currentTarget as HTMLElement).getBoundingClientRect().left;
    if (x < g.izquierda || x > g.derecha) return null;
    return Math.min(g.columnas.length - 1, Math.floor((x - g.izquierda) / g.banda));
  }
}

/** Columna con la punta redondeada y la base recta sobre la línea de cero. */
function trazoColumna(x: number, base: number, ancho: number, alto: number): string {
  const r = Math.min(RADIO, ancho / 2, alto);
  const arriba = base - alto;
  const f = (n: number) => n.toFixed(2);
  return (
    `M${f(x)},${f(base)} V${f(arriba + r)} A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(arriba)} ` +
    `H${f(x + ancho - r)} A${f(r)},${f(r)} 0 0 1 ${f(x + ancho)},${f(arriba + r)} V${f(base)} Z`
  );
}
