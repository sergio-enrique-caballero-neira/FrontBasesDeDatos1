import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { FormGroupDirective, NgControl } from '@angular/forms';

/**
 * Expone el error de un campo a los lectores de pantalla con aria-invalid, con la
 * misma regla que el borde rojo: el campo es inválido y ya se tocó o se intentó
 * enviar el formulario.
 */
@Directive({
  selector: '[formControlName], [formControl]',
  host: { '[attr.aria-invalid]': 'invalido()' },
})
export class AriaInvalido {
  private readonly control = inject(NgControl, { self: true });
  private readonly formulario = inject(FormGroupDirective, { optional: true });

  protected invalido(): 'true' | null {
    const control = this.control.control;
    if (!control || control.disabled || control.valid) {
      return null;
    }
    return control.touched || this.formulario?.submitted ? 'true' : null;
  }
}

/** Al enviar un formulario con errores, lleva el foco al primer campo inválido. */
@Directive({
  selector: 'form[formGroup]',
})
export class EnfocarPrimerError {
  private readonly formulario = inject(FormGroupDirective, { self: true });
  private readonly elemento = inject<ElementRef<HTMLFormElement>>(ElementRef);

  @HostListener('submit')
  protected alEnviar(): void {
    if (this.formulario.form.valid) {
      return;
    }
    // Se espera un ciclo para que los campos ya tengan sus clases de error.
    setTimeout(() => {
      const campo = this.elemento.nativeElement.querySelector<HTMLElement>(
        'input.ng-invalid, select.ng-invalid, textarea.ng-invalid',
      );
      campo?.focus();
    });
  }
}

/** Importar en cada componente con formularios reactivos. */
export const ACCESIBILIDAD_FORMULARIOS = [AriaInvalido, EnfocarPrimerError] as const;
