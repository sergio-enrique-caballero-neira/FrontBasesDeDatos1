import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormArray, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { CampoError } from './campo-error';
import { ACCESIBILIDAD_FORMULARIOS } from './accesibilidad-formularios';

/**
 * Campos de un atributo multivaluado (teléfonos, correos): en la base de datos
 * son una tabla aparte; en el formulario, una lista que crece y se recorta.
 */
@Component({
  selector: 'app-lista-campos',
  imports: [ReactiveFormsModule, ACCESIBILIDAD_FORMULARIOS, FaIconComponent, CampoError],
  // Lee el estado del FormArray (no son signals), así que se revisa en cada ciclo.
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <fieldset>
      <legend class="form-label fs-6 mb-1">{{ etiqueta() }}</legend>
      @if (ayuda()) {
        <p class="form-text mt-0 mb-2">{{ ayuda() }}</p>
      }
      <div class="d-grid gap-2">
        @for (control of arreglo().controls; track control; let i = $index) {
          <div>
            <div class="d-flex gap-2">
              <input
                [id]="idBase() + '-' + i"
                [type]="tipo()"
                class="form-control"
                [formControl]="control"
                [attr.aria-label]="etiqueta() + ' ' + (i + 1)"
                [attr.aria-describedby]="idBase() + '-' + i + '-error'"
                [placeholder]="placeholder()"
                [class.is-invalid]="control.invalid && (control.touched || enviado())"
              />
              @if (arreglo().length > minimo()) {
                <button
                  type="button"
                  class="btn btn-soft btn-icon flex-none"
                  [attr.aria-label]="'Quitar ' + etiqueta().toLowerCase() + ' ' + (i + 1)"
                  (click)="arreglo().removeAt(i)"
                >
                  <fa-icon [icon]="iconoQuitar" />
                </button>
              }
            </div>
            <app-campo-error [control]="control" [enviado]="enviado()" [id]="idBase() + '-' + i + '-error'" />
          </div>
        }
      </div>
      <button type="button" class="btn btn-link btn-sm px-0 mt-1" (click)="agregar()">
        <fa-icon [icon]="iconoAgregar" />
        {{ textoAgregar() }}
      </button>
    </fieldset>
  `,
})
export class ListaCampos {
  readonly arreglo = input.required<FormArray<FormControl<string>>>();
  readonly etiqueta = input.required<string>();
  readonly idBase = input.required<string>();
  readonly tipo = input<'tel' | 'email'>('tel');
  readonly placeholder = input('');
  readonly textoAgregar = input('Agregar otro');
  readonly ayuda = input<string>();
  readonly minimo = input(0);
  readonly enviado = input(false);

  protected readonly iconoAgregar = faPlus;
  protected readonly iconoQuitar = faXmark;

  protected agregar(): void {
    this.arreglo().push(nuevoControlLista(this.tipo()));
  }
}

export function nuevoControlLista(tipo: 'tel' | 'email', valor = ''): FormControl<string> {
  return new FormControl(valor, {
    nonNullable: true,
    validators:
      tipo === 'email' ? [Validators.required, Validators.email] : [Validators.required, Validators.pattern(/^[0-9 +()-]{7,20}$/)],
  });
}

export function controlesLista(tipo: 'tel' | 'email', valores: string[], minimo: number): FormArray<FormControl<string>> {
  const iniciales = valores.length >= minimo ? valores : [...valores, ...Array(minimo - valores.length).fill('')];
  return new FormArray(iniciales.map((valor) => nuevoControlLista(tipo, valor)));
}

/** Valores limpios de la lista, sin repetidos. */
export function valoresLista(arreglo: FormArray<FormControl<string>>): string[] {
  return [...new Set(arreglo.getRawValue().map((v) => v.trim()).filter(Boolean))];
}
