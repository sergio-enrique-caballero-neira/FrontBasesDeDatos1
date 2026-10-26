import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Miga {
  texto: string;
  /** Ruta de la miga; la última (la página actual) no lleva enlace. */
  enlace?: string | unknown[];
}

/** Migas de pan de las fichas: de dónde viene la pantalla y cómo volver un nivel. */
@Component({
  selector: 'app-migas',
  imports: [RouterLink],
  template: `
    <nav aria-label="Migas de pan">
      <ol class="breadcrumb mb-2">
        @for (miga of items(); track $index; let ultima = $last) {
          @if (ultima) {
            <li class="breadcrumb-item active" aria-current="page">{{ miga.texto }}</li>
          } @else {
            <li class="breadcrumb-item">
              @if (miga.enlace) {
                <a [routerLink]="miga.enlace">{{ miga.texto }}</a>
              } @else {
                {{ miga.texto }}
              }
            </li>
          }
        }
      </ol>
    </nav>
  `,
})
export class Migas {
  readonly items = input.required<Miga[]>();
}
