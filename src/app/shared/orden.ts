import { Component, computed, input, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons';

export type Direccion = 'asc' | 'desc';

/**
 * Estado de ordenamiento de una tabla. Sin columna elegida, las filas conservan
 * el orden en que llegan. Un clic ordena ascendente; el siguiente, descendente.
 */
export class Orden<C extends string> {
  readonly estado = signal<{ columna: C; direccion: Direccion } | null>(null);

  alternar(columna: C): void {
    const actual = this.estado();
    this.estado.set({
      columna,
      direccion: actual?.columna === columna && actual.direccion === 'asc' ? 'desc' : 'asc',
    });
  }

  /** Valor para aria-sort en el <th>, que es lo que anuncian los lectores de pantalla. */
  ariaSort(columna: C): 'ascending' | 'descending' | 'none' {
    const actual = this.estado();
    if (actual?.columna !== columna) {
      return 'none';
    }
    return actual.direccion === 'asc' ? 'ascending' : 'descending';
  }

  /** Devuelve una copia ordenada; los valores vacíos (null) van siempre al final. */
  aplicar<T>(filas: T[], valores: Record<C, (fila: T) => string | number | null>): T[] {
    const actual = this.estado();
    if (!actual) {
      return filas;
    }
    const valor = valores[actual.columna];
    const signo = actual.direccion === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      if (va === null || vb === null) {
        return va === vb ? 0 : va === null ? 1 : -1;
      }
      const comparacion =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' });
      return comparacion * signo;
    });
  }
}

/**
 * Botón que va dentro de un <th>: muestra el nombre de la columna y la flecha
 * del orden actual. El <th> lleva [attr.aria-sort]="orden.ariaSort(columna)".
 */
@Component({
  selector: 'app-encabezado-orden',
  imports: [FaIconComponent],
  styles: `
    button {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 1.5rem;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      white-space: nowrap;
      text-align: inherit;
    }
    /* En celular el texto se parte para que la tabla no empuje las acciones fuera de vista. */
    @media (max-width: 767.98px) {
      button {
        white-space: normal;
      }
    }
    button:hover,
    button.activo {
      color: var(--ink);
    }
    fa-icon {
      opacity: 0.55;
    }
    button.activo fa-icon {
      opacity: 1;
    }
  `,
  template: `
    <button type="button" [class.activo]="direccion() !== null" (click)="orden().alternar(columna())">
      {{ texto() }}
      <fa-icon [icon]="icono()" />
    </button>
  `,
})
export class EncabezadoOrden<C extends string> {
  readonly orden = input.required<Orden<C>>();
  readonly columna = input.required<C>();
  readonly texto = input.required<string>();

  protected readonly direccion = computed(() => {
    const estado = this.orden().estado();
    return estado?.columna === this.columna() ? estado.direccion : null;
  });

  protected readonly icono = computed(() => {
    const direccion = this.direccion();
    return direccion === 'asc' ? faSortUp : direccion === 'desc' ? faSortDown : faSort;
  });
}
