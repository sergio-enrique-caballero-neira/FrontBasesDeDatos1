import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { FormGroupDirective, NgControl } from '@angular/forms';

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
    setTimeout(() => {
      const campo = this.elemento.nativeElement.querySelector<HTMLElement>(
        'input.ng-invalid, select.ng-invalid, textarea.ng-invalid',
      );
      campo?.focus();
    });
  }
}

export const ACCESIBILIDAD_FORMULARIOS = [AriaInvalido, EnfocarPrimerError] as const;
