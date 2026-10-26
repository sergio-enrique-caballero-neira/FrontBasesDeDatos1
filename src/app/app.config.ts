import {
  ApplicationConfig,
  inject,
  Injectable,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  provideRouter,
  RouterStateSnapshot,
  TitleStrategy,
  withComponentInputBinding,
  withNavigationErrorHandler,
} from '@angular/router';
import { routes } from './app.routes';
import { NOMBRE_APP } from './core/app-info';
import { Avisos } from './core/avisos';
import { VentaEnCurso } from './core/venta-en-curso';

/** Pone "Pantalla · Nombre de la app" en la pestaña del navegador. */
@Injectable()
class TituloPorPantalla extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(estado: RouterStateSnapshot): void {
    const pantalla = this.buildTitle(estado);
    this.title.setTitle(pantalla ? `${pantalla} · ${NOMBRE_APP}` : NOMBRE_APP);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Falla al cargar el código de una pantalla (por ejemplo, tras publicar una versión nueva).
      withNavigationErrorHandler(() =>
        inject(Avisos).error('No se pudo abrir la pantalla. Recarga la página e inténtalo de nuevo.'),
      ),
    ),
    { provide: TitleStrategy, useClass: TituloPorPantalla },
    // Se crea al arrancar para que vea el cierre de sesión aunque no se haya abierto la página de venta.
    provideAppInitializer(() => {
      inject(VentaEnCurso);
    }),
  ],
};
