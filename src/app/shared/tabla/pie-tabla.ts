import { Component, computed, input, model } from '@angular/core';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-pie-tabla',
  imports: [NgbPagination],
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem 1.5rem;
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--hairline);
    }
    @media (min-width: 768px) {
      :host {
        padding: 0.75rem 1.5rem;
      }
    }
    .tamano {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .tamano select {
      width: auto;
      min-height: 2rem;
      padding-top: 0.25rem;
      padding-bottom: 0.25rem;
    }
    @media (pointer: coarse) {
      .tamano select {
        min-height: 2.75rem;
      }
    }
  `,
  template: `
    <p class="mb-0 text-body-secondary" aria-live="polite">
      @if (total() === 0) {
        Sin resultados
      } @else {
        Mostrando <span class="num text-body fw-medium">{{ desde() }}–{{ hasta() }}</span> de
        <span class="num text-body fw-medium">{{ total() }}</span> {{ nombre() }}
      }
    </p>
    @if (total() > opciones()[0]) {
      <div class="d-flex flex-wrap align-items-center gap-3">
        <label class="tamano small text-body-secondary">
          Por página
          <select class="form-select form-select-sm" [value]="porPagina()" (change)="cambiarTamano($event)">
            @for (opcion of opciones(); track opcion) {
              <option [value]="opcion" [selected]="opcion === porPagina()">{{ opcion }}</option>
            }
          </select>
        </label>
        @if (total() > porPagina()) {
          <ngb-pagination
            [collectionSize]="total()"
            [pageSize]="porPagina()"
            [page]="pagina()"
            (pageChange)="pagina.set($event)"
            [maxSize]="5"
            [rotate]="true"
            [ellipses]="false"
            size="sm"
            [attr.aria-label]="'Páginas de ' + nombre()"
          />
        }
      </div>
    }
  `,
})
export class PieTabla {
  readonly total = input.required<number>();
  readonly nombre = input('resultados');
  readonly pagina = model(1);
  readonly porPagina = model(15);
  readonly opciones = input([15, 30, 60]);

  protected readonly desde = computed(() => (this.total() === 0 ? 0 : (this.pagina() - 1) * this.porPagina() + 1));
  protected readonly hasta = computed(() => Math.min(this.total(), this.pagina() * this.porPagina()));

  protected cambiarTamano(evento: Event): void {
    this.porPagina.set(Number((evento.target as HTMLSelectElement).value));
    this.pagina.set(1);
  }
}

export function paginar<T>(filas: T[], pagina: number, porPagina: number): T[] {
  const inicio = (pagina - 1) * porPagina;
  return filas.slice(inicio, inicio + porPagina);
}
