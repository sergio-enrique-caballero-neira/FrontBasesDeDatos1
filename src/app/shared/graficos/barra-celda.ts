import { Component, computed, input } from '@angular/core';

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
  readonly texto = input.required<string>();
  readonly proporcion = input.required<number>();

  protected readonly porcentaje = computed(() => {
    const p = this.proporcion();
    return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) * 100 : 0;
  });
}
