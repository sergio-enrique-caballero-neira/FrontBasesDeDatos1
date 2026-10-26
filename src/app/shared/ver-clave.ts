import { Component, input, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

/**
 * Botón para mostrar u ocultar una clave mientras se escribe. Va junto al input
 * dentro de un contenedor .campo-clave:
 * <div class="campo-clave"><input #clave type="password" ...><app-ver-clave [campo]="clave" /></div>
 */
@Component({
  selector: 'app-ver-clave',
  imports: [FaIconComponent],
  template: `
    <button
      type="button"
      class="btn btn-ver-clave"
      aria-label="Mostrar clave"
      [attr.aria-pressed]="visible()"
      [attr.aria-controls]="campo().id"
      [title]="visible() ? 'Ocultar clave' : 'Mostrar clave'"
      (click)="alternar()"
    >
      <fa-icon [icon]="visible() ? iconoOcultar : iconoMostrar" />
    </button>
  `,
})
export class VerClave {
  readonly campo = input.required<HTMLInputElement>();
  protected readonly visible = signal(false);
  protected readonly iconoMostrar = faEye;
  protected readonly iconoOcultar = faEyeSlash;

  protected alternar(): void {
    this.visible.update((v) => !v);
    this.campo().type = this.visible() ? 'text' : 'password';
  }
}
