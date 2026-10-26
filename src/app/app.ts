import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TemaService } from './core/tema';
import { AvisosHost } from './shared/avisos-host';

@Component({
  imports: [RouterOutlet, AvisosHost],
  selector: 'app-root',
  template: `
    <router-outlet />
    <app-avisos-host />
  `,
})
export class App {
  // Se inyecta aquí para que el tema se aplique y se sincronice desde el arranque.
  protected readonly tema = inject(TemaService);
}
