import { Component, computed, DestroyRef, inject, linkedSignal, resource, signal, TemplateRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBars,
  faCartShopping,
  faCheck,
  faDatabase,
  faMoon,
  faRightFromBracket,
  faStore,
} from '@fortawesome/free-solid-svg-icons';
import {
  NgbDropdown,
  NgbDropdownItem,
  NgbDropdownMenu,
  NgbDropdownToggle,
  NgbOffcanvas,
  NgbTooltip,
} from '@ng-bootstrap/ng-bootstrap';
import { filter, map } from 'rxjs';
import { Api } from '../core/api';
import { nombreEmpleado, Sucursal } from '../core/models';
import { SeleccionSucursal, Session } from '../core/session';
import { TemaService } from '../core/tema';
import { VentaEnCurso } from '../core/venta-en-curso';
import { MockDb } from '../data/mock-db';
import { SucursalesRepository } from '../data/catalogos.repository';
import { BotonTema } from '../shared/boton-tema';
import { Confirmar } from '../shared/confirmar';
import { pesos, PesosPipe } from '../shared/formato';
import { NavMenu } from './nav-menu';

/** Desde lg la barra tiene sitio para el tema y los datos de demostración; debajo pasan al menú del usuario. */
const CONSULTA_ANCHA = '(min-width: 992px)';

const RUTA_NUEVA_VENTA = '/ventas/nueva';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    NavMenu,
    BotonTema,
    FaIconComponent,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownItem,
    NgbTooltip,
    PesosPipe,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly offcanvas = inject(NgbOffcanvas);
  private readonly confirmar = inject(Confirmar);
  private readonly db = inject(MockDb);
  private readonly api = inject(Api);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly venta = inject(VentaEnCurso);
  protected readonly tema = inject(TemaService);

  protected readonly iconos = { faBars, faCartShopping, faCheck, faDatabase, faMoon, faRightFromBracket, faStore };
  protected readonly usuario = this.session.usuario;
  protected readonly esAdmin = this.session.esAdmin;
  protected readonly esVendedor = this.session.esVendedor;
  protected readonly oscuro = computed(() => this.tema.tema() === 'oscuro');

  protected readonly sucursales = resource({
    params: () => this.api.cambios(),
    loader: () => this.sucursalesRepo.listar(),
  });
  /**
   * Conserva la lista anterior mientras se recarga, para que la barra no parpadee. Se lee con
   * hasValue(): value() lanza si la carga falló y tumbaría la barra entera.
   */
  protected readonly listaSucursales = linkedSignal<Sucursal[] | undefined, Sucursal[]>({
    source: () => (this.sucursales.hasValue() ? this.sucursales.value() : undefined),
    computation: (nueva, previa) => nueva ?? previa?.value ?? [],
  });

  /**
   * El menú del usuario muestra el tema y los datos de demostración solo cuando la barra
   * no los tiene. Se renderizan con @if y no con clases d-*: el teclado de ngbDropdown
   * recorre todos los ngbDropdownItem y se atascaría en uno oculto con display: none.
   */
  protected readonly pantallaAncha = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly enNuevaVenta = computed(() => this.url().split(/[?#]/)[0] === RUTA_NUEVA_VENTA);

  /** Venta sin registrar, con las cifras que la página de venta dejó en el servicio. */
  protected readonly ventaEnCurso = computed(() => {
    if (!this.venta.hayVenta()) {
      return null;
    }
    const { productos, total } = this.venta.resumen();
    const cantidad = productos > 0 ? productos : this.venta.lineas().length;
    return { productos: cantidad, unidad: cantidad === 1 ? 'producto' : 'productos', total: total > 0 ? total : null };
  });

  /** En la página de venta el indicador sobra: el carrito ya está a la vista. */
  protected readonly mostrarVentaEnCurso = computed(() => this.ventaEnCurso() !== null && !this.enNuevaVenta());

  protected readonly nombreUsuario = computed(() => {
    const usuario = this.usuario();
    return usuario ? nombreEmpleado(usuario) : '';
  });

  protected readonly rol = computed(() => (this.esAdmin() ? 'Administrador' : 'Vendedor'));

  protected readonly iniciales = computed(() => {
    const usuario = this.usuario();
    return usuario ? `${usuario.nombre[0]}${usuario.apellido[0]}`.toUpperCase() : '';
  });

  protected readonly sucursalActual = computed<{ nombre: string; ciudad: string | null }>(() => {
    const seleccion = this.session.sucursal();
    if (seleccion === 'TODAS') {
      return { nombre: 'Todas las sucursales', ciudad: null };
    }
    const sucursal = this.listaSucursales().find((s) => s.idSucursal === seleccion);
    return sucursal ? { nombre: sucursal.nombre, ciudad: sucursal.ciudad } : { nombre: 'Sucursal', ciudad: null };
  });

  constructor() {
    const consulta = typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_ANCHA) : null;
    if (consulta) {
      this.pantallaAncha.set(consulta.matches);
      const alCambiar = (evento: MediaQueryListEvent) => this.pantallaAncha.set(evento.matches);
      consulta.addEventListener('change', alCambiar);
      inject(DestroyRef).onDestroy(() => consulta.removeEventListener('change', alCambiar));
    }
  }

  protected esSeleccionada(seleccion: SeleccionSucursal): boolean {
    return this.session.sucursal() === seleccion;
  }

  /**
   * La venta en curso se guarda por sucursal: al cambiar, la de la sede actual queda en
   * esta pestaña y vuelve al regresar. Se pregunta para que el vendedor no crea que se perdió
   * ni registre en la sede equivocada.
   */
  protected async cambiarSucursal(seleccion: SeleccionSucursal): Promise<void> {
    if (this.esSeleccionada(seleccion)) {
      return;
    }
    const venta = this.ventaEnCurso();
    if (venta) {
      const actual = this.sucursalActual().nombre;
      const nueva =
        seleccion === 'TODAS'
          ? 'Todas las sucursales'
          : (this.listaSucursales().find((s) => s.idSucursal === seleccion)?.nombre ?? 'la otra sucursal');
      const cuanto = venta.total !== null ? ` por ${pesos(venta.total)}` : '';
      const confirmado = await this.confirmar.preguntar({
        titulo: '¿Cambiar de sucursal con una venta en curso?',
        mensaje: `Tienes ${venta.productos} ${venta.unidad}${cuanto} sin registrar en ${actual}. La venta queda guardada en esta pestaña y la recuperas al volver a ${actual}; lo que vendas desde ahora se registra en ${nueva}.`,
        confirmar: `Cambiar a ${nueva}`,
      });
      if (!confirmado) {
        return;
      }
    }
    this.session.elegirSucursal(seleccion);
  }

  protected abrirMenu(contenido: TemplateRef<unknown>): void {
    this.offcanvas.open(contenido, { ariaLabelledBy: 'menu-movil-titulo', panelClass: 'menu-movil' });
  }

  protected cerrarMenu(): void {
    this.offcanvas.dismiss();
  }

  protected async restaurarDatos(): Promise<void> {
    const confirmado = await this.confirmar.preguntar({
      titulo: 'Restaurar datos de demostración',
      mensaje:
        'Se borran las ventas, clientes y cambios que hayas hecho en este navegador y se cargan de nuevo los datos iniciales. La sesión se mantiene.',
      confirmar: 'Restaurar datos',
      peligro: true,
    });
    if (confirmado) {
      this.db.restaurar();
      location.reload();
    }
  }

  /** Cerrar sesión descarta la venta sin registrar (VentaEnCurso la borra), así que se pregunta antes. */
  protected async cerrarSesion(): Promise<void> {
    const venta = this.ventaEnCurso();
    if (venta) {
      const cuanto = venta.total !== null ? ` por ${pesos(venta.total)}` : '';
      const confirmado = await this.confirmar.preguntar({
        titulo: '¿Cerrar sesión y descartar la venta?',
        mensaje: `El carrito tiene ${venta.productos} ${venta.unidad}${cuanto} y la venta aún no está registrada. Si cierras sesión, se pierde.`,
        confirmar: 'Cerrar sesión y descartar',
        peligro: true,
      });
      if (!confirmado) {
        return;
      }
    }
    this.session.cerrarSesion();
    void this.router.navigateByUrl('/login');
  }
}
