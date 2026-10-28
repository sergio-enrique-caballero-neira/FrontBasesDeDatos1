import { Component, input, output } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCircleExclamation, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { mensajeDeError } from '../core/domain-error';

@Component({
  selector: 'app-page-header',
  template: `
    <header class="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4">
      <div class="me-auto" style="min-width: 0">
        <h1 class="mb-1">{{ titulo() }}</h1>
        @if (descripcion()) {
          <p class="text-body-secondary mb-0">{{ descripcion() }}</p>
        }
      </div>
      <div class="d-flex flex-wrap gap-2">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
}

@Component({
  selector: 'app-cargando',
  template: `
    <div class="d-flex align-items-center gap-2 text-body-secondary py-5 justify-content-center" role="status">
      <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
      <span>{{ texto() }}…</span>
    </div>
  `,
})
export class Cargando {
  readonly texto = input.required<string>();
}

@Component({
  selector: 'app-error-carga',
  imports: [FaIconComponent],
  template: `
    <div class="text-center py-5 px-3" role="alert">
      <fa-icon [icon]="iconoError" class="fs-4 text-danger" />
      <p class="fw-medium mt-2 mb-1">{{ que() }} no se pudo cargar.</p>
      <p class="text-body-secondary mb-3">{{ mensaje() }}</p>
      <button type="button" class="btn btn-soft" (click)="reintentar.emit()">
        <fa-icon [icon]="iconoReintentar" />
        Reintentar
      </button>
    </div>
  `,
})
export class ErrorCarga {
  readonly que = input.required<string>();
  readonly error = input<unknown>();
  readonly reintentar = output();
  protected readonly iconoError = faCircleExclamation;
  protected readonly iconoReintentar = faRotateRight;

  protected mensaje(): string {
    return mensajeDeError(this.error());
  }
}

@Component({
  selector: 'app-vacio',
  imports: [FaIconComponent],
  template: `
    <div class="text-center py-5 px-3">
      @if (icono(); as icono) {
        <fa-icon [icon]="icono" class="fs-4 text-body-secondary" />
      }
      <p class="fw-medium mt-2 mb-1">{{ titulo() }}</p>
      @if (detalle()) {
        <p class="text-body-secondary mb-3 mx-auto" style="max-width: 32rem">{{ detalle() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class Vacio {
  readonly titulo = input.required<string>();
  readonly detalle = input<string>();
  readonly icono = input<IconDefinition>();
}
