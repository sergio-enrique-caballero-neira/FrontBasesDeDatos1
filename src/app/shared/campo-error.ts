import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-campo-error',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (mensaje(); as mensaje) {
      <div class="invalid-feedback d-block" [id]="id()">{{ mensaje }}</div>
    }
  `,
})
export class CampoError {
  readonly control = input.required<AbstractControl | null>();
  readonly id = input<string>();
  readonly enviado = input(false);
  readonly mensajes = input<Record<string, string>>({});

  protected mensaje(): string | null {
    const control = this.control();
    if (!control || control.valid || !(control.touched || this.enviado())) {
      return null;
    }
    const errores = control.errors ?? {};
    const propio = Object.keys(errores).find((clave) => this.mensajes()[clave]);
    if (propio) return this.mensajes()[propio];
    if (errores['required']) return 'Este campo es obligatorio.';
    if (errores['email']) return 'Escribe un correo válido, por ejemplo nombre@empresa.com.';
    if (errores['min']) return `El valor mínimo es ${errores['min'].min}.`;
    if (errores['max']) return `El valor máximo es ${errores['max'].max}.`;
    if (errores['minlength']) return `Escribe al menos ${errores['minlength'].requiredLength} caracteres.`;
    if (errores['maxlength']) return `Máximo ${errores['maxlength'].requiredLength} caracteres.`;
    if (errores['pattern']) return 'El formato no es válido.';
    if (errores['entero']) return 'Debe ser un número entero.';
    return 'Revisa este campo.';
  }
}
