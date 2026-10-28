import { Component, computed, input } from '@angular/core';

type TipoColumna = 'texto' | 'numero';

const ANCHOS_TEXTO = [72, 48, 84, 60, 66, 54, 78];
const ANCHOS_NUMERO = [44, 58, 36, 52, 40];

@Component({
  selector: 'app-esqueleto-tabla',
  styles: `
    :host {
      display: block;
    }
    .barra {
      display: block;
      height: 0.75rem;
      border-radius: 50rem;
      background: var(--soft-bg);
    }
    thead .barra {
      height: 0.5rem;
    }
    .derecha .barra {
      margin-left: auto;
    }
    td:first-child,
    th:first-child {
      padding-left: var(--bs-card-spacer-x, 0.5rem);
    }
    td:last-child,
    th:last-child {
      padding-right: var(--bs-card-spacer-x, 0.5rem);
    }
    td,
    th {
      padding-top: 0.875rem;
      padding-bottom: 0.875rem;
    }
  `,
  template: `
    <div class="table-responsive" role="status">
      <span class="visually-hidden">{{ texto() }}…</span>
      <table class="table" aria-hidden="true">
        <thead>
          <tr>
            @for (tipo of tipos(); track $index) {
              <th [class.derecha]="tipo === 'numero'">
                <span class="barra" [style.width.%]="tipo === 'numero' ? 50 : 40"></span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (fila of listaFilas(); track fila) {
            <tr>
              @for (tipo of tipos(); track $index) {
                <td [class.derecha]="tipo === 'numero'">
                  <span class="barra" [style.width.%]="ancho(tipo, fila, $index)"></span>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class EsqueletoTabla {
  readonly columnas = input.required<number | TipoColumna[]>();
  readonly filas = input(8);
  readonly texto = input.required<string>();

  protected readonly tipos = computed<TipoColumna[]>(() => {
    const columnas = this.columnas();
    return typeof columnas === 'number' ? Array.from({ length: Math.max(1, columnas) }, () => 'texto') : columnas;
  });

  protected readonly listaFilas = computed(() => Array.from({ length: Math.max(1, this.filas()) }, (_, i) => i));

  protected ancho(tipo: TipoColumna, fila: number, columna: number): number {
    const anchos = tipo === 'numero' ? ANCHOS_NUMERO : ANCHOS_TEXTO;
    return anchos[(fila * 3 + columna * 5) % anchos.length];
  }
}

@Component({
  selector: 'app-esqueleto-bloque',
  styles: `
    :host {
      display: block;
    }
    .linea {
      display: block;
      height: 0.75rem;
      border-radius: 50rem;
      background: var(--soft-bg);
    }
    .linea + .linea {
      margin-top: 0.75rem;
    }
    .linea:first-child {
      height: 1rem;
    }
    .area {
      display: block;
      border-radius: 14px;
      background: var(--soft-bg);
    }
    .linea + .area {
      margin-top: 1rem;
    }
  `,
  template: `
    <div role="status">
      <span class="visually-hidden">{{ texto() }}…</span>
      <div aria-hidden="true">
        @for (linea of listaLineas(); track linea) {
          <span class="linea" [style.width.%]="anchoLinea(linea)"></span>
        }
        @if (alto(); as alto) {
          <span class="area" [style.height]="alto"></span>
        }
      </div>
    </div>
  `,
})
export class EsqueletoBloque {
  readonly lineas = input(3);
  readonly alto = input<string>();
  readonly texto = input.required<string>();

  protected readonly listaLineas = computed(() => Array.from({ length: Math.max(0, this.lineas()) }, (_, i) => i));

  protected anchoLinea(indice: number): number {
    return indice === 0 ? 40 : ANCHOS_TEXTO[indice % ANCHOS_TEXTO.length];
  }
}
