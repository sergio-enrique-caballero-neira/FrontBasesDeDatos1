import { DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

const CLAVE_TEMA = 'ferreteria.tema';

/**
 * Tema de color de la aplicación. Es una preferencia del navegador, no del
 * usuario: no se borra al cerrar sesión, así que es el mismo para administradores
 * y vendedores. Si hay otra pestaña abierta, se sincroniza al instante.
 *
 * Al imprimir (con el botón de la app o con Ctrl+P) la página pasa a claro, tinta
 * oscura sobre papel blanco, y al terminar vuelve al tema elegido.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly documento = inject(DOCUMENT);
  readonly tema = signal<Tema>(leerTemaGuardado() ?? temaDelSistema());

  constructor() {
    effect(() => {
      const tema = this.tema();
      this.aplicar(tema);
      try {
        localStorage.setItem(CLAVE_TEMA, tema);
      } catch {
        // Sin almacenamiento el tema dura hasta recargar la página.
      }
    });
    window.addEventListener('storage', (evento) => {
      if (evento.key === CLAVE_TEMA && (evento.newValue === 'claro' || evento.newValue === 'oscuro')) {
        this.tema.set(evento.newValue);
      }
    });
    window.addEventListener('beforeprint', () => this.aplicar('claro'));
    window.addEventListener('afterprint', () => this.aplicar(this.tema()));
  }

  alternar(): void {
    this.tema.update((tema) => (tema === 'oscuro' ? 'claro' : 'oscuro'));
  }

  private aplicar(tema: Tema): void {
    this.documento.documentElement.setAttribute('data-bs-theme', tema === 'oscuro' ? 'dark' : 'light');
  }
}

function leerTemaGuardado(): Tema | null {
  try {
    const guardado = localStorage.getItem(CLAVE_TEMA);
    return guardado === 'claro' || guardado === 'oscuro' ? guardado : null;
  } catch {
    return null;
  }
}

function temaDelSistema(): Tema {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}
