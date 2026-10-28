import { Component, computed, input, model, signal } from '@angular/core';
import { fechaISO, hoyISO, sumarDias } from '../../core/fechas';

export interface Periodo {
  desde: string;
  hasta: string;
}

type Atajo = 'hoy' | '7' | '30' | 'mes' | 'personalizado';

export function ultimosDias(dias: number): Periodo {
  const hoy = new Date();
  return { desde: fechaISO(sumarDias(hoy, -(dias - 1))), hasta: fechaISO(hoy) };
}

function esteMes(): Periodo {
  const hoy = new Date();
  return { desde: fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fechaISO(hoy) };
}

@Component({
  selector: 'app-selector-periodo',
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
    }
    .fechas {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .fechas input {
      width: 10.5rem;
    }
  `,
  template: `
    <div>
      <span class="form-label d-block" [id]="id + '-etiqueta'">{{ etiqueta() }}</span>
      <div class="segmento" role="group" [attr.aria-labelledby]="id + '-etiqueta'">
        @for (opcion of opciones; track opcion.clave) {
          <button type="button" [attr.aria-pressed]="atajo() === opcion.clave" (click)="elegir(opcion.clave)">
            {{ opcion.texto }}
          </button>
        }
      </div>
    </div>
    @if (atajo() === 'personalizado') {
      <div class="fechas">
        <div>
          <label class="form-label small mb-1" [for]="id + '-desde'">Desde</label>
          <input [id]="id + '-desde'" type="date" class="form-control" [max]="periodo().hasta" [value]="periodo().desde"
            (change)="cambiarFecha('desde', $event)" />
        </div>
        <div>
          <label class="form-label small mb-1" [for]="id + '-hasta'">Hasta</label>
          <input [id]="id + '-hasta'" type="date" class="form-control" [min]="periodo().desde" [max]="hoy" [value]="periodo().hasta"
            (change)="cambiarFecha('hasta', $event)" />
        </div>
      </div>
    }
  `,
})
export class SelectorPeriodo {
  private static siguiente = 0;
  protected readonly id = `periodo-${++SelectorPeriodo.siguiente}`;
  protected readonly hoy = hoyISO();

  readonly etiqueta = input('Periodo');
  readonly periodo = model<Periodo>(ultimosDias(30));

  protected readonly opciones: { clave: Atajo; texto: string }[] = [
    { clave: 'hoy', texto: 'Hoy' },
    { clave: '7', texto: '7 días' },
    { clave: '30', texto: '30 días' },
    { clave: 'mes', texto: 'Este mes' },
    { clave: 'personalizado', texto: 'Otro rango' },
  ];

  private readonly elegido = signal<Atajo | null>(null);

  protected readonly atajo = computed<Atajo>(() => {
    const elegido = this.elegido();
    if (elegido === 'personalizado') return 'personalizado';
    const { desde, hasta } = this.periodo();
    const iguales = (p: Periodo) => p.desde === desde && p.hasta === hasta;
    if (iguales(ultimosDias(1))) return 'hoy';
    if (iguales(ultimosDias(7))) return '7';
    if (iguales(ultimosDias(30))) return '30';
    if (iguales(esteMes())) return 'mes';
    return 'personalizado';
  });

  protected elegir(atajo: Atajo): void {
    this.elegido.set(atajo);
    if (atajo === 'hoy') this.periodo.set(ultimosDias(1));
    if (atajo === '7') this.periodo.set(ultimosDias(7));
    if (atajo === '30') this.periodo.set(ultimosDias(30));
    if (atajo === 'mes') this.periodo.set(esteMes());
  }

  protected cambiarFecha(campo: 'desde' | 'hasta', evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    if (valor) this.periodo.update((p) => ({ ...p, [campo]: valor }));
  }
}
