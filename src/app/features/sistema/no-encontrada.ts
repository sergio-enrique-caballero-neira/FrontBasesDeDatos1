import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faHouse } from '@fortawesome/free-solid-svg-icons';

/** Ruta desconocida: dice qué dirección no existe y ofrece volver, en vez de redirigir en silencio. */
@Component({
  selector: 'app-no-encontrada',
  imports: [RouterLink, FaIconComponent],
  template: `
    <div class="page">
      <div class="card mx-auto" style="max-width: 36rem">
        <div class="card-body p-4 p-md-5">
          <p class="eyebrow mb-2">Error 404</p>
          <h1 class="mb-2">Esta página no existe</h1>
          <p class="text-body-secondary">
            No encontramos <span class="code-tag">{{ ruta }}</span>. Puede que el enlace esté mal escrito o que la
            pantalla haya cambiado de lugar.
          </p>
          <div class="d-flex flex-wrap gap-2 mt-4">
            <a routerLink="/inicio" class="btn btn-primary">
              <fa-icon [icon]="iconos.faHouse" />
              Ir al inicio
            </a>
            <button type="button" class="btn btn-soft" (click)="volver()">
              <fa-icon [icon]="iconos.faArrowLeft" />
              Volver a la página anterior
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class NoEncontrada {
  protected readonly iconos = { faArrowLeft, faHouse };
  protected readonly ruta = inject(Router).url;

  protected volver(): void {
    history.back();
  }
}
