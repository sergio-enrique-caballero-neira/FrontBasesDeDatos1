import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { URL_API } from './configuracion';
import { Credenciales } from './credenciales';
import { Session } from './session';

const RUTA_LOGIN = '/auth/login';

export const autenticacion: HttpInterceptorFn = (peticion, siguiente) => {
  if (!peticion.url.startsWith(URL_API)) {
    return siguiente(peticion);
  }
  const injector = inject(Injector);
  const token = inject(Credenciales).token();
  const conToken = token ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : peticion;
  return siguiente(conToken).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token && !peticion.url.endsWith(RUTA_LOGIN)) {
        injector.get(Session).expirar();
      }
      return throwError(() => error);
    }),
  );
};
