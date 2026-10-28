import { Component, computed, inject } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { TemaService } from '../core/tema';

@Component({
  selector: 'app-boton-tema',
  imports: [FaIconComponent],
  template: `
    <button
      type="button"
      class="btn btn-soft btn-icon"
      [attr.aria-label]="etiqueta()"
      [title]="etiqueta()"
      (click)="tema.alternar()"
    >
      <fa-icon [icon]="oscuro() ? iconoSol : iconoLuna" />
    </button>
  `,
})
export class BotonTema {
  protected readonly tema = inject(TemaService);
  protected readonly iconoSol = faSun;
  protected readonly iconoLuna = faMoon;
  protected readonly oscuro = computed(() => this.tema.tema() === 'oscuro');
  protected readonly etiqueta = computed(() => (this.oscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'));
}
