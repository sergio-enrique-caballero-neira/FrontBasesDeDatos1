import {
  ApplicationConfig,
  inject,
  Injectable,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
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
import { autenticacion } from './core/autenticacion.interceptor';
import { Avisos } from './core/avisos';
import { VentaEnCurso } from './core/venta-en-curso';

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
    provideHttpClient(withFetch(), withInterceptors([autenticacion])),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withNavigationErrorHandler(() =>
        inject(Avisos).error('No se pudo abrir la pantalla. Recarga la página e inténtalo de nuevo.'),
      ),
    ),
    { provide: TitleStrategy, useClass: TituloPorPantalla },
    provideAppInitializer(() => {
      inject(VentaEnCurso);
    }),
  ],
};
