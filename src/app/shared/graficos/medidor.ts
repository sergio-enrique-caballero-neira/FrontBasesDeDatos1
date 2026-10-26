import { Component, computed, input } from '@angular/core';

/**
 * Medidor de avance de una cantidad contra su máximo ("4 de 6"). Es un
 * `role="meter"`: el lector de pantalla recibe la etiqueta y el texto, y en
 * pantalla la cifra va escrita al lado de la pista, así el relleno nunca es la
 * única forma de leer el valor.
 */
@Component({
  selector: 'app-medidor',
  host: {
    role: 'meter',
    'aria-valuemin': '0',
    '[attr.aria-valuemax]': 'tope()',
    '[attr.aria-valuenow]': 'actual()',
    '[attr.aria-valuetext]': 'texto()',
    '[attr.aria-label]': 'etiqueta()',
  },
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 7rem;
    }
    /* Pista y relleno con la base recta a la izquierda y el extremo redondeado. */
    .pista {
      flex: 1 1 auto;
      min-width: 3rem;
      height: 6px;
      border-radius: 0 4px 4px 0;
      background: var(--soft-bg);
    }
    .relleno {
      display: block;
      height: 100%;
      border-radius: 0 4px 4px 0;
      background: var(--chart-mark);
    }
    .texto {
      flex: none;
      font-size: 0.8125rem;
    }
  `,
  template: `
    <span class="pista">
      @if (porcentaje() > 0) {
        <span class="relleno" [style.width.%]="porcentaje()" [style.min-width.px]="2"></span>
      }
    </span>
    <span class="texto num">{{ texto() }}</span>
  `,
})
export class Medidor {
  readonly valor = input.required<number>();
  readonly maximo = input.required<number>();
  /** Lo que se lee en pantalla y en el lector, por ejemplo "4 de 6". */
  readonly texto = input.required<string>();
  /** Qué se mide, para el lector de pantalla: "Evaluaciones completadas". */
  readonly etiqueta = input.required<string>();

  protected readonly tope = computed(() => Math.max(0, this.maximo()));
  protected readonly actual = computed(() => Math.min(this.tope(), Math.max(0, this.valor())));
  protected readonly porcentaje = computed(() => (this.tope() > 0 ? (this.actual() / this.tope()) * 100 : 0));
}
