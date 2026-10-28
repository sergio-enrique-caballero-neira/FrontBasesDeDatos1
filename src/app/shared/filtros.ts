import { Component, ElementRef, afterRenderEffect, input, model, output, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-campo-busqueda',
  imports: [FaIconComponent, NgbTooltip],
  host: {
    class: 'campo-busqueda d-block',
    '(document:keydown)': 'alPulsarTecla($event)',
  },
  template: `
    @if (etiquetaVisible()) {
      <label class="form-label d-flex align-items-center gap-2" [for]="id">
        {{ etiqueta() }}
        @if (atajo()) {
          <span class="small text-body-secondary fw-normal d-none d-md-inline" aria-hidden="true">
            Atajo <kbd>/</kbd>
          </span>
        }
      </label>
    }
    <fa-icon [icon]="iconos.faMagnifyingGlass" class="campo-busqueda-icono" aria-hidden="true" />
    <input
      #campo
      type="search"
      class="form-control"
      autocomplete="off"
      enterkeyhint="search"
      [id]="id"
      [value]="valor()"
      [placeholder]="placeholder()"
      [attr.aria-label]="etiquetaVisible() ? null : etiqueta()"
      [attr.aria-keyshortcuts]="atajo() ? '/' : null"
      [attr.aria-describedby]="describedby()"
      (input)="valor.set(campo.value)"
      (keydown.escape)="alPulsarEscape($event)"
      (keydown.enter)="enter.emit(valor())"
    />
    @if (valor()) {
      <button
        type="button"
        class="campo-busqueda-borrar"
        aria-label="Borrar búsqueda"
        ngbTooltip="Borrar búsqueda"
        container="body"
        (click)="borrar()"
      >
        <fa-icon [icon]="iconos.faXmark" />
      </button>
    }
  `,
})
export class CampoBusqueda {
  private static siguiente = 0;

  readonly valor = model('');
  readonly etiqueta = input.required<string>();
  readonly etiquetaVisible = input(true);
  readonly placeholder = input('');
  readonly atajo = input(false);
  readonly describedby = input<string | null>(null);
  readonly enter = output<string>();

  protected readonly id = `busqueda-${++CampoBusqueda.siguiente}`;
  protected readonly iconos = { faMagnifyingGlass, faXmark };
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  constructor() {
    afterRenderEffect(() => {
      const valor = this.valor();
      const campo = this.campo().nativeElement;
      if (campo.value !== valor) {
        campo.value = valor;
      }
    });
  }

  protected borrar(): void {
    this.valor.set('');
    this.campo().nativeElement.focus();
  }

  protected alPulsarEscape(evento: Event): void {
    if (!this.valor()) {
      return;
    }
    evento.stopPropagation();
    evento.preventDefault();
    this.valor.set('');
  }

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (!this.atajo() || evento.key !== '/' || evento.ctrlKey || evento.metaKey || evento.altKey) {
      return;
    }
    if (esEditable(evento.target) || document.body.classList.contains('modal-open')) {
      return;
    }
    const campo = this.campo().nativeElement;
    if (campo.offsetParent === null) {
      return;
    }
    evento.preventDefault();
    campo.focus();
    campo.select();
  }
}

function esEditable(objetivo: EventTarget | null): boolean {
  if (!(objetivo instanceof HTMLElement)) {
    return false;
  }
  return objetivo.isContentEditable || objetivo.matches('input, textarea, select');
}
