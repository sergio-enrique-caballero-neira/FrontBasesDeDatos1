import { Injectable, signal } from '@angular/core';

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'exito' | 'error';
}

@Injectable({ providedIn: 'root' })
export class Avisos {
  private siguiente = 1;
  readonly lista = signal<Aviso[]>([]);

  exito(texto: string): void {
    this.agregar(texto, 'exito');
  }

  error(texto: string): void {
    this.agregar(texto, 'error');
  }

  cerrar(id: number): void {
    this.lista.update((avisos) => avisos.filter((a) => a.id !== id));
  }

  private agregar(texto: string, tipo: Aviso['tipo']): void {
    const aviso = { id: this.siguiente++, texto, tipo };
    this.lista.update((avisos) => [...avisos.slice(-2), aviso]);
  }
}
