import { afterNextRender, Component, effect, inject, Injector, input, resource } from '@angular/core';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faLayerGroup, faStore } from '@fortawesome/free-solid-svg-icons';
import { NOMBRE_APP } from '../../core/app-info';
import { fechaISO, sumarDias } from '../../core/fechas';
import { DIAS_RITMO_VENTAS } from '../../core/models';
import { SeleccionSucursal, Session } from '../../core/session';
import { SucursalesRepository } from '../../data/catalogos.repository';
import { VentasRepository } from '../../data/ventas.repository';
import { BotonTema } from '../../shared/boton-tema';
import { ErrorCarga, Vacio } from '../../shared/ui';

/** Sede donde el vendedor hizo más ventas en la ventana reciente, con las cifras que lo muestran. */
interface Sugerencia {
  idSucursal: number;
  aqui: number;
  total: number;
}

/** Opciones de muestra mientras llega la lista de sedes. */
const FILAS_ESQUELETO = [0, 1, 2];

@Component({
  selector: 'app-elegir-sucursal',
  imports: [FaIconComponent, ErrorCarga, Vacio, BotonTema],
  templateUrl: './elegir-sucursal.html',
  styleUrl: './auth.css',
})
export class ElegirSucursal {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly ventasRepo = inject(VentasRepository);

  readonly volver = input<string>();

  protected readonly nombreApp = NOMBRE_APP;
  protected readonly iconos = { faStore, faLayerGroup };
  protected readonly usuario = this.session.usuario;
  protected readonly esAdmin = this.session.esAdmin;
  protected readonly filasEsqueleto = FILAS_ESQUELETO;
  protected readonly dias = DIAS_RITMO_VENTAS;
  protected readonly sucursales = resource({ loader: () => this.sucursalesRepo.listar() });

  /**
   * EMPLEADO no tiene sucursal propia, pero sus ventas sí: la sede donde más vendió en los
   * últimos días es la pista de dónde trabaja. Si falla o no hay ventas, no se marca nada
   * y la elección sigue igual; por eso no tiene estado de error visible.
   */
  protected readonly sugerencia = resource({
    params: () => {
      const usuario = this.usuario();
      return usuario?.rol === 'VENDEDOR' ? { idEmpleado: usuario.idEmpleado } : undefined;
    },
    loader: async ({ params }): Promise<Sugerencia | null> => {
      const ventas = await this.ventasRepo.listar({
        idSucursal: null,
        idEmpleado: params.idEmpleado,
        desde: fechaISO(sumarDias(new Date(), -(DIAS_RITMO_VENTAS - 1))),
      });
      // Las ventas llegan de la más reciente a la más antigua: ante un empate gana la sede
      // de la venta más reciente, que es la primera en aparecer.
      const conteo = new Map<number, number>();
      for (const venta of ventas) {
        conteo.set(venta.idSucursal, (conteo.get(venta.idSucursal) ?? 0) + 1);
      }
      let mejor: Sugerencia | null = null;
      for (const [idSucursal, aqui] of conteo) {
        if (!mejor || aqui > mejor.aqui) {
          mejor = { idSucursal, aqui, total: ventas.length };
        }
      }
      return mejor;
    },
  });

  constructor() {
    // La sede sugerida recibe el foco para que Enter entre directo, salvo que la persona
    // ya haya movido el foco a otro lado mientras llegaba la sugerencia.
    effect(() => {
      const sugerida = this.sugerencia.hasValue() ? this.sugerencia.value() : null;
      if (!sugerida || !this.sucursales.hasValue()) {
        return;
      }
      afterNextRender(
        () => {
          const activo = document.activeElement;
          if (activo && activo !== document.body && activo.tagName !== 'MAIN') {
            return;
          }
          document.getElementById(this.idOpcion(sugerida.idSucursal))?.focus();
        },
        { injector: this.injector },
      );
    });
  }

  protected idOpcion(idSucursal: number): string {
    return `sucursal-${idSucursal}`;
  }

  protected textoSugerencia(sugerida: Sugerencia): string {
    const ventana = `de los últimos ${this.dias} días`;
    if (sugerida.total === 1) {
      return `Aquí hiciste tu única venta ${ventana}`;
    }
    if (sugerida.aqui === sugerida.total) {
      return `Aquí hiciste tus ${sugerida.total} ventas ${ventana}`;
    }
    return `Vendiste aquí ${sugerida.aqui} de tus ${sugerida.total} ventas ${ventana}`;
  }

  protected esActual(seleccion: SeleccionSucursal): boolean {
    return this.session.sucursal() === seleccion;
  }

  protected elegir(seleccion: SeleccionSucursal): void {
    this.session.elegirSucursal(seleccion);
    const destino = this.volver();
    void this.router.navigateByUrl(destino && destino.startsWith('/') && !destino.startsWith('/sucursal') ? destino : '/inicio');
  }

  protected salir(): void {
    this.session.cerrarSesion();
    void this.router.navigateByUrl('/login');
  }
}
