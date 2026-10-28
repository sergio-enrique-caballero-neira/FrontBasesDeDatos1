import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { URL_API } from './configuracion';
import { DomainError, NoEncontrado } from './domain-error';

export type Parametros = Record<string, string | number | boolean | null | undefined>;

interface ErrorApi {
  mensaje?: unknown;
  campos?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  readonly cambios = signal(0);

  get<T>(ruta: string, parametros?: Parametros): Promise<T> {
    return this.pedir(this.http.get<T>(URL_API + ruta, { params: aParams(parametros) }));
  }

  post<T>(ruta: string, cuerpo?: unknown): Promise<T> {
    return this.modificar(this.http.post<T>(URL_API + ruta, cuerpo ?? null));
  }

  put<T>(ruta: string, cuerpo: unknown): Promise<T> {
    return this.modificar(this.http.put<T>(URL_API + ruta, cuerpo));
  }

  delete(ruta: string): Promise<void> {
    return this.modificar(this.http.delete<void>(URL_API + ruta));
  }

  private async modificar<T>(peticion: Observable<T>): Promise<T> {
    const respuesta = await this.pedir(peticion);
    this.cambios.update((v) => v + 1);
    return respuesta;
  }

  private async pedir<T>(peticion: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(peticion);
    } catch (error) {
      throw errorDeApi(error);
    }
  }
}

export function errorDeApi(error: unknown): Error {
  if (!(error instanceof HttpErrorResponse)) {
    return error instanceof Error ? error : new Error(String(error));
  }
  if (error.status === 0) {
    return new DomainError('No hay conexión con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.');
  }
  const cuerpo = (error.error ?? {}) as ErrorApi;
  const detalleCampo = Object.values(cuerpo.campos ?? {}).find((v): v is string => typeof v === 'string');
  const mensaje = detalleCampo ?? (typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje : null);
  if (error.status === 404) {
    return new NoEncontrado(mensaje ?? 'El registro pedido no existe.');
  }
  if (error.status >= 500) {
    return new DomainError('El servidor tuvo un problema al procesar la solicitud. Inténtalo de nuevo.');
  }
  return new DomainError(mensaje ?? 'No se pudo completar la operación.');
}

function aParams(parametros?: Parametros): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(parametros ?? {})) {
    if (valor !== null && valor !== undefined && valor !== '') {
      params = params.set(clave, String(valor));
    }
  }
  return params;
}
