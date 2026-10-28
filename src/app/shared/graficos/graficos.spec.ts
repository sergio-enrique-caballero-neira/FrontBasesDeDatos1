import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fechaISO, hoyISO, sumarDias } from '../../core/fechas';
import { Bala } from './bala';
import { BarraCelda } from './barra-celda';
import { topeRedondo } from './escala';
import { BarraDato, GraficoBarras } from './grafico-barras';
import { GraficoColumnas, TramoColumnas } from './grafico-columnas';
import { PuntoTiempo } from './grafico-tiempo';
import { Medidor } from './medidor';
import { TiraCalificaciones } from './tira-calificaciones';

function semana(): PuntoTiempo[] {
  const valores = [3, 0, 5, 2, 7, 1, 4];
  return valores.map((valor, i) => ({
    fecha: fechaISO(sumarDias(new Date(), i - (valores.length - 1))),
    valor,
    detalle: `${valor} ventas`,
  }));
}

@Component({
  imports: [GraficoColumnas],
  template: `
    <app-grafico-columnas
      titulo="¿Qué días se vendió más?"
      [puntos]="puntos()"
      [enfasisDesde]="enfasisDesde()"
      [tramos]="tramos()"
      [seleccionable]="true"
      [(seleccion)]="seleccion"
      nombreValor="Ventas"
    />
  `,
})
class AnfitrionColumnas {
  readonly puntos = signal(semana());
  readonly enfasisDesde = signal<string | undefined>(undefined);
  readonly tramos = signal<TramoColumnas[]>([]);
  readonly seleccion = signal<string | null>(null);
}

@Component({
  imports: [GraficoBarras],
  template: `
    <app-grafico-barras titulo="¿Qué sucursal vende más?" [datos]="datos" [seleccionable]="true" [(seleccion)]="seleccion" />
  `,
})
class AnfitrionBarras {
  readonly datos: BarraDato[] = [
    { etiqueta: 'Centro', valor: 300, detalle: '12 ventas' },
    { etiqueta: 'Norte', valor: 120 },
    { etiqueta: 'Sur', valor: 60 },
  ];
  readonly seleccion = signal<string | null>(null);
}

@Component({
  imports: [Medidor, TiraCalificaciones, Bala, BarraCelda],
  template: `
    <app-medidor [valor]="4" [maximo]="6" texto="4 de 6" etiqueta="Evaluaciones completadas" />
    <app-tira-calificaciones [valores]="[5, 5, 4, 2]" />
    <app-tira-calificaciones class="vacia" [valores]="[]" />
    <app-bala class="con-barra" [valor]="12" [marca]="8" />
    <app-bala class="sin-barra" [valor]="null" [marca]="40" />
    <app-barra-celda texto="$ 1.250.000" [proporcion]="1.4" />
  `,
})
class AnfitrionPiezas {}

describe('gráficos compartidos', () => {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const observadorOriginal = globalThis.ResizeObserver;

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 600 });
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  });

  afterAll(() => {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, 'clientWidth', descriptor);
    globalThis.ResizeObserver = observadorOriginal;
  });

  describe('topeRedondo', () => {
    it('elige un tope limpio cuya mitad también es redonda', () => {
      expect(topeRedondo(2_600_000)).toBe(3_000_000);
      expect(topeRedondo(1_100_000)).toBe(2_000_000);
      expect(topeRedondo(7)).toBe(8);
      expect(topeRedondo(0)).toBe(1);
    });

    it('con datos enteros evita un tope pequeño impar', () => {
      expect(topeRedondo(3, true)).toBe(4);
      expect(topeRedondo(1, true)).toBe(2);
      expect(topeRedondo(25, true)).toBe(30);
    });
  });

  describe('GraficoColumnas', () => {
    async function crear() {
      const fixture = TestBed.createComponent(AnfitrionColumnas);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      return { fixture, el, lienzo: el.querySelector('.lienzo') as HTMLElement };
    }

    it('dibuja una columna por día con valor y dice "Hoy" en el eje', async () => {
      const { el } = await crear();
      expect(el.querySelectorAll('path.columna').length).toBe(6);
      const fechas = [...el.querySelectorAll('svg text.eje')].map((t) => t.textContent?.trim());
      expect(fechas).toContain('Hoy');
    });

    it('deja en gris lo anterior a enfasisDesde', async () => {
      const { fixture, el } = await crear();
      fixture.componentInstance.enfasisDesde.set(semana()[4].fecha);
      await fixture.whenStable();
      expect(el.querySelectorAll('path.columna.atenuada').length).toBe(3);
    });

    it('recorre los días con flechas, elige con Enter y quita con Escape', async () => {
      const { fixture, el, lienzo } = await crear();
      lienzo.dispatchEvent(new FocusEvent('focus'));
      lienzo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      lienzo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await fixture.whenStable();
      expect(fixture.componentInstance.seleccion()).toBe(semana()[5].fecha);
      expect(el.querySelectorAll('path.columna:not(.atenuada)').length).toBe(1);
      expect(el.querySelector('[aria-live]')?.textContent).toContain('día elegido');

      lienzo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();
      expect(fixture.componentInstance.seleccion()).toBeNull();
    });

    it('nombra los tramos bajo el eje y los agrupa en la tabla', async () => {
      const { fixture, el } = await crear();
      const dias = semana();
      fixture.componentInstance.tramos.set([
        { desde: dias[0].fecha, texto: 'Semana anterior' },
        { desde: dias[4].fecha, texto: 'Últimos 3 días' },
      ]);
      await fixture.whenStable();
      expect([...el.querySelectorAll('.tramo')].map((t) => t.textContent?.trim())).toEqual(['Semana anterior', 'Últimos 3 días']);

      (el.querySelectorAll('.segmento button')[1] as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(el.querySelectorAll('th[scope="rowgroup"]').length).toBe(2);
      expect(el.querySelectorAll('tbody tr:not(.fila-tramo)').length).toBe(7);
      (el.querySelectorAll('.boton-dia')[6] as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(fixture.componentInstance.seleccion()).toBe(hoyISO());
    });

    it('con todo en cero muestra el texto de vacío', async () => {
      const { fixture, el } = await crear();
      fixture.componentInstance.puntos.set(semana().map((p) => ({ ...p, valor: 0 })));
      await fixture.whenStable();
      expect(el.querySelector('.lienzo')).toBeNull();
      expect(el.textContent).toContain('No hay datos para este periodo.');
    });
  });

  describe('GraficoBarras seleccionable', () => {
    it('cada fila es un botón con aria-pressed y pulsar de nuevo quita la elección', async () => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const fixture = TestBed.createComponent(AnfitrionBarras);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const botones = el.querySelectorAll<HTMLButtonElement>('button.barra-boton');
      expect(botones.length).toBe(3);
      expect(el.querySelector('a')).toBeNull();

      botones[1].click();
      await fixture.whenStable();
      expect(fixture.componentInstance.seleccion()).toBe('Norte');
      expect(botones[1].getAttribute('aria-pressed')).toBe('true');
      expect(el.querySelectorAll('li.destacada').length).toBe(1);
      expect([...el.querySelectorAll('.barra-etiqueta > span:first-child')].map((s) => s.textContent?.trim())).toEqual([
        'Centro',
        'Norte',
        'Sur',
      ]);

      botones[1].click();
      await fixture.whenStable();
      expect(fixture.componentInstance.seleccion()).toBeNull();
    });
  });

  describe('piezas en línea', () => {
    it('medidor, tira, bala y barra de celda exponen lo que deben', async () => {
      const fixture = TestBed.createComponent(AnfitrionPiezas);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;

      const medidor = el.querySelector('app-medidor')!;
      expect(medidor.getAttribute('role')).toBe('meter');
      expect(medidor.getAttribute('aria-valuenow')).toBe('4');
      expect(medidor.getAttribute('aria-valuemax')).toBe('6');
      expect(medidor.getAttribute('aria-valuetext')).toBe('4 de 6');
      expect(medidor.getAttribute('aria-label')).toBe('Evaluaciones completadas');

      const tira = el.querySelector('app-tira-calificaciones svg')!;
      expect(tira.getAttribute('role')).toBe('img');
      expect(tira.getAttribute('aria-label')).toBe('Calificaciones 5, 5, 4, 2; promedio 4 de 5');
      expect(tira.querySelectorAll('circle').length).toBe(4);
      expect(el.querySelector('app-tira-calificaciones.vacia')?.textContent).toContain('Sin calificaciones');

      expect(el.querySelector('app-bala.con-barra path.barra')).not.toBeNull();
      expect(el.querySelector('app-bala.sin-barra path.barra')).toBeNull();
      expect(el.querySelector('app-bala.sin-barra line.marca')?.getAttribute('x1')).toBe('119');

      const marca = el.querySelector('app-barra-celda .marca') as HTMLElement;
      expect(marca.style.width).toBe('100%');
    });
  });
});
