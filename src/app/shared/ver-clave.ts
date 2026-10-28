import { Component, input, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

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
