import { Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBoxesStacked,
  faCartShopping,
  faClipboardCheck,
  faCreditCard,
  faHouse,
  faIdBadge,
  faReceipt,
  faScrewdriverWrench,
  faSitemap,
  faStore,
  faTags,
  faTruck,
  faTruckRampBox,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { filter, map } from 'rxjs';
import { NOMBRE_APP } from '../core/app-info';
import { Session } from '../core/session';
import { VentaEnCurso } from '../core/venta-en-curso';
import { PesosPipe } from '../shared/formato';

const RUTA_NUEVA_VENTA = '/ventas/nueva';

interface Enlace {
  ruta: string;
  texto: string;
  icono: IconDefinition;
  excepto?: string;
  nivel?: number;
}

interface Grupo {
  titulo: string;
  enlaces: Enlace[];
}

let instancias = 0;

function soloRuta(url: string): string {
  return url.split(/[?#]/)[0];
}

function dentroDe(ruta: string, base: string): boolean {
  return ruta === base || ruta.startsWith(base + '/');
}

@Component({
  selector: 'app-nav-menu',
  imports: [RouterLink, FaIconComponent, PesosPipe],
  templateUrl: './nav-menu.html',
  styleUrl: './nav-menu.css',
})
export class NavMenu {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly venta = inject(VentaEnCurso);
  readonly navego = output();

  protected readonly nombreApp = NOMBRE_APP;
  protected readonly iconoNuevaVenta = faCartShopping;
  protected readonly rutaNuevaVenta = RUTA_NUEVA_VENTA;
  protected readonly esVendedor = this.session.esVendedor;

  protected readonly ventaEnCurso = computed(() => {
    if (!this.venta.hayVenta()) {
      return null;
    }
    const { productos, total } = this.venta.resumen();
    const cantidad = productos > 0 ? productos : this.venta.lineas().length;
    return { productos: cantidad, unidad: cantidad === 1 ? 'producto' : 'productos', total: total > 0 ? total : null };
  });

  protected readonly prefijo = `nav-${++instancias}`;

  private readonly rutaActual = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => soloRuta(evento.urlAfterRedirects)),
    ),
    { initialValue: soloRuta(this.router.url) },
  );

  protected readonly enNuevaVenta = computed(() => this.rutaActual() === RUTA_NUEVA_VENTA);

  protected readonly grupos = computed<Grupo[]>(() => {
    const mostrador: Grupo = {
      titulo: 'Mostrador',
      enlaces: [
        { ruta: '/inicio', texto: 'Inicio', icono: faHouse },
        { ruta: '/ventas', texto: 'Ventas', icono: faReceipt, excepto: RUTA_NUEVA_VENTA },
        { ruta: '/clientes', texto: 'Clientes', icono: faUsers },
        { ruta: '/inventario', texto: 'Inventario', icono: faBoxesStacked },
      ],
    };
    if (!this.session.esAdmin()) {
      return [mostrador];
    }
    const grupos: Grupo[] = [
      mostrador,
      {
        titulo: 'Administración',
        enlaces: [
          { ruta: '/productos', texto: 'Productos', icono: faScrewdriverWrench },
          { ruta: '/proveedores', texto: 'Proveedores', icono: faTruck, nivel: 2 },
          { ruta: '/suministros', texto: 'Suministros', icono: faTruckRampBox, nivel: 2 },
          { ruta: '/evaluaciones', texto: 'Evaluaciones de calidad', icono: faClipboardCheck, nivel: 2 },
          { ruta: '/sucursales', texto: 'Sucursales', icono: faStore, nivel: 3 },
          { ruta: '/empleados', texto: 'Empleados', icono: faIdBadge, nivel: 3 },
        ],
      },
      {
        titulo: 'Catálogos',
        enlaces: [
          { ruta: '/catalogos/marcas', texto: 'Marcas', icono: faTags, nivel: 3 },
          { ruta: '/catalogos/categorias', texto: 'Categorías', icono: faSitemap, nivel: 3 },
          { ruta: '/catalogos/metodos-pago', texto: 'Métodos de pago', icono: faCreditCard, nivel: 3 },
        ],
      },
    ];
    return grupos
      .map((grupo) => ({ ...grupo, enlaces: grupo.enlaces.filter((enlace) => this.session.tieneNivel(enlace.nivel ?? 1)) }))
      .filter((grupo) => grupo.enlaces.length > 0);
  });

  protected activo(enlace: Enlace): boolean {
    const ruta = this.rutaActual();
    return dentroDe(ruta, enlace.ruta) && !(enlace.excepto && dentroDe(ruta, enlace.excepto));
  }
}
