import { Component, computed, input, model, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

export interface BarraDato {
  etiqueta: string;
  valor: number;
  /** Texto secundario bajo la etiqueta (por ejemplo, "12 ventas"). */
  detalle?: string;
  /** Destino al hacer clic en la etiqueta. Se ignora si el gráfico es seleccionable. */
  enlace?: string | unknown[];
  /** Forma de énfasis: la barra destacada va en tinta y el resto en gris. */
  destacado?: boolean;
}

/**
 * Barras horizontales de una sola serie, para comparar magnitudes entre
 * categorías (sucursales, productos, proveedores). Sigue la guía de dataviz:
 * barras delgadas con el extremo redondeado y la base recta, el valor en la
 * punta, una sola tinta (o énfasis: una en tinta y el resto en gris) y una vista
 * de tabla equivalente. Cada barra lleva su valor escrito, así que no hace falta
 * tooltip: nada queda escondido detrás del puntero.
 *
 * Si es seleccionable, cada fila es un botón que elige su etiqueta (y la suelta
 * al pulsarlo de nuevo); la elegida queda en tinta, con marca y en negrita, y el
 * resto en gris. El orden de las filas lo da el padre.
 */
@Component({
  selector: 'app-grafico-barras',
  imports: [RouterLink, FaIconComponent],
  styleUrl: './grafico-barras.css',
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

      @if (datos().length === 0) {
        <p class="text-body-secondary mb-0 py-3">{{ textoVacio() }}</p>
      } @else if (comoTabla()) {
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th scope="col">{{ nombreEtiqueta() }}</th>
                <th scope="col" class="text-end">{{ nombreValor() }}</th>
              </tr>
            </thead>
            <tbody>
              @for (fila of filas(); track fila.etiqueta) {
                <tr [class.fila-elegida]="fila.elegida">
                  <td>
                    @if (seleccionable()) {
                      <button type="button" class="boton-celda" [attr.aria-pressed]="fila.elegida" (click)="alternar(fila.etiqueta)">
                        @if (fila.elegida) {
                          <fa-icon [icon]="iconoElegida" class="me-1" />
                        }
                        {{ fila.etiqueta }}
                      </button>
                    } @else {
                      {{ fila.etiqueta }}
                    }
                    @if (fila.detalle) {
                      <span class="d-block small text-body-secondary">{{ fila.detalle }}</span>
                    }
                  </td>
                  <td class="text-end num">{{ formato()(fila.valor) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <ul class="barras list-unstyled mb-0" [class.con-enfasis]="hayEnfasis()" [class.seleccionable]="seleccionable()">
          @for (fila of filas(); track fila.etiqueta) {
            <li [class.destacada]="fila.enTinta">
              @if (seleccionable()) {
                <button type="button" class="barra-fila barra-boton" [attr.aria-pressed]="fila.elegida" (click)="alternar(fila.etiqueta)">
                  <span class="barra-etiqueta">
                    <span>
                      @if (fila.elegida) {
                        <fa-icon [icon]="iconoElegida" class="me-1" />
                      }
                      {{ fila.etiqueta }}
                    </span>
                    @if (fila.detalle) {
                      <span class="small text-body-secondary">{{ fila.detalle }}</span>
                    }
                  </span>
                  <span class="barra-pista" aria-hidden="true">
                    <span class="barra-marca" [style.width.%]="fila.proporcion * 100"></span>
                  </span>
                  <span class="barra-valor num">{{ formato()(fila.valor) }}</span>
                </button>
              } @else {
                <div class="barra-fila">
                  <div class="barra-etiqueta">
                    @if (fila.enlace) {
                      <a [routerLink]="fila.enlace" class="barra-enlace">{{ fila.etiqueta }}</a>
                    } @else {
                      <span>{{ fila.etiqueta }}</span>
                    }
                    @if (fila.detalle) {
                      <span class="small text-body-secondary">{{ fila.detalle }}</span>
                    }
                  </div>
                  <div class="barra-pista" aria-hidden="true">
                    <span class="barra-marca" [style.width.%]="fila.proporcion * 100"></span>
                  </div>
                  <span class="barra-valor num">{{ formato()(fila.valor) }}</span>
                </div>
              }
            </li>
          }
        </ul>
      }
    </figure>
  `,
})
export class GraficoBarras {
  private static siguiente = 0;
  protected readonly id = `grafico-barras-${++GraficoBarras.siguiente}`;

  /** La pregunta que responde el gráfico, por ejemplo "¿Qué sucursal vende más?". */
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  readonly datos = input.required<BarraDato[]>();
  readonly formato = input<(valor: number) => string>((v) => String(v));
  readonly nombreEtiqueta = input('Categoría');
  readonly nombreValor = input('Valor');
  readonly textoVacio = input('No hay datos para este periodo.');
  /** Si es true, cada fila es un botón que elige su etiqueta. */
  readonly seleccionable = input(false);
  /** Etiqueta elegida. */
  readonly seleccion = model<string | null>(null);

  protected readonly comoTabla = signal(false);
  protected readonly iconoElegida = faCheck;

  /** La selección solo cuenta si el gráfico es seleccionable y la etiqueta está entre los datos. */
  private readonly elegida = computed(() => {
    const etiqueta = this.seleccion();
    return this.seleccionable() && etiqueta !== null && this.datos().some((d) => d.etiqueta === etiqueta) ? etiqueta : null;
  });

  protected readonly hayEnfasis = computed(() => this.elegida() !== null || this.datos().some((d) => d.destacado));

  protected readonly filas = computed(() => {
    const maximo = Math.max(0, ...this.datos().map((d) => d.valor));
    const elegida = this.elegida();
    return this.datos().map((d) => ({
      ...d,
      proporcion: maximo > 0 ? Math.max(0, d.valor) / maximo : 0,
      elegida: d.etiqueta === elegida,
      // Con una elección, ella manda sobre el énfasis que traigan los datos.
      enTinta: elegida !== null ? d.etiqueta === elegida : !!d.destacado,
    }));
  });

  protected alternar(etiqueta: string): void {
    this.seleccion.set(this.seleccion() === etiqueta ? null : etiqueta);
  }
}
