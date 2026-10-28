import { Injectable, signal } from '@angular/core';

const CLAVE_TOKEN = 'ferreteria.token';

@Injectable({ providedIn: 'root' })
export class Credenciales {
  readonly token = signal<string | null>(leer());

  guardar(token: string): void {
    this.token.set(token);
    try {
      localStorage.setItem(CLAVE_TOKEN, token);
    } catch {
      return;
    }
  }

  limpiar(): void {
    this.token.set(null);
    try {
      localStorage.removeItem(CLAVE_TOKEN);
    } catch {
      return;
    }
  }
}

function leer(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}
