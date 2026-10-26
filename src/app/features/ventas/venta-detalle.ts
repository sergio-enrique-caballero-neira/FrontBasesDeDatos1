import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { Location } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faArrowLeft, faCartShopping, faCircleCheck, faPrint, faReceipt } from '@fortawesome/free-solid-svg-icons';
import { NOMBRE_APP } from '../../core/app-info';
import { NoEncontrado } from '../../core/domain-error';
import { VENTA_REGISTRADA } from '../../core/guards';
import { esConsumidorFinal, nombreCliente, nombreEmpleado } from '../../core/models';
import { Session } from '../../core/session';
import { MetodosPagoRepository, SucursalesRepository } from '../../data/catalogos.repository';
import { ClientesRepository, EmpleadosRepository } from '../../data/personas.repository';
import { ProductosRepository } from '../../data/productos.repository';
import { VentasRepository } from '../../data/ventas.repository';
import { Migas } from '../../shared/migas';
import { FechaPipe, PesosPipe } from '../../shared/formato';
import { ErrorCarga, Vacio } from '../../shared/ui';

/** Lo que la página de venta deja en el estado de navegación al registrar. */
interface VentaRecienRegistrada {
  /** Lo que el vendedor entrega de vuelta cuando el pago fue en efectivo. */
  cambio: number | null;
}

const formatoImpresion = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

@Component({
  selector: 'app-venta-detalle',
  imports: [RouterLink, FaIconComponent, ErrorCarga, Vacio, Migas, PesosPipe, FechaPipe],
  templateUrl: './venta-detalle.html',
  styleUrl: './venta-detalle.css',
})
export class VentaDetalle {
  private readonly ventasRepo = inject(VentasRepository);
  private readonly productosRepo = inject(ProductosRepository);
  private readonly clientesRepo = inject(ClientesRepository);
  private readonly empleadosRepo = inject(EmpleadosRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly metodosRepo = inject(MetodosPagoRepository);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly title = inject(Title);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly session = inject(Session);

  /** Viene de la ruta /ventas/:id. */
  readonly id = input.required<string>();

  protected readonly nombreApp = NOMBRE_APP;
  protected readonly iconos = { faArrowLeft, faCartShopping, faCircleCheck, faPrint, faReceipt };
  protected readonly nombreCliente = nombreCliente;
  protected readonly nombreEmpleado = nombreEmpleado;
  protected readonly esConsumidorFinal = esConsumidorFinal;

  /**
   * Si la página anterior fue el listado de ventas (con sus filtros en la URL),
   * "Volver a ventas" regresa en el historial y conserva filtros y scroll; si se
   * llegó de otra parte o se abrió el enlace directo, va al listado.
   */
  protected readonly vieneDelListado: boolean;

  /** Presente solo al llegar justo después de registrar la venta. */
  protected readonly recienRegistrada = signal<VentaRecienRegistrada | null>(null);

  /** Fecha y hora reales de impresión para el pie de la hoja. */
  protected readonly impresaEl = signal(formatoImpresion.format(new Date()));

  private readonly botonNuevaVenta = viewChild<ElementRef<HTMLElement>>('botonNuevaVenta');
  private focoInicialHecho = false;

  protected readonly factura = resource({
    params: () => Number(this.id()),
    loader: async ({ params: idVenta }) => {
      const [{ venta, detalles }, productos, clientes, empleados, sucursales, metodos] = await Promise.all([
        this.ventasRepo.obtener(idVenta),
        this.productosRepo.listar(),
        this.clientesRepo.listar(),
        this.empleadosRepo.listar(),
        this.sucursalesRepo.listar(),
        this.metodosRepo.listar(),
      ]);
      return {
        venta,
        lineas: detalles.map((d) => ({
          ...d,
          producto: productos.find((p) => p.idProducto === d.idProducto),
          subtotal: d.cantidad * d.precioUnitario,
        })),
        cliente: clientes.find((c) => c.idCliente === venta.idCliente),
        vendedor: empleados.find((e) => e.idEmpleado === venta.idEmpleado),
        sucursal: sucursales.find((s) => s.idSucursal === venta.idSucursal),
        metodo: metodos.find((m) => m.idMetodoPago === venta.idMetodoPago)?.tipo ?? '',
      };
    },
  });

  /** La venta no existe: no tiene sentido reintentar, se ofrece ir al listado. */
  protected readonly noExiste = computed(() => this.factura.error() instanceof NoEncontrado);

  protected readonly migas = computed(() => [
    { texto: 'Ventas', enlace: '/ventas' },
    {
      texto: this.factura.hasValue()
        ? `Factura ${this.factura.value().venta.numeroFactura}`
        : this.noExiste()
          ? 'Factura no encontrada'
          : 'Factura',
    },
  ]);

  constructor() {
    // La página se crea durante la navegación que la abre: ahí están su estado y la anterior.
    const navegacion = this.router.currentNavigation();
    this.vieneDelListado = esListadoDeVentas(navegacion?.previousNavigation?.finalUrl ?? null);
    const estado = (navegacion?.extras.state ?? leerEstadoHistorial()) as Record<string, unknown> | null;
    if (estado && (estado['registrada'] === true || estado[VENTA_REGISTRADA] === true)) {
      const cambio = estado['cambio'];
      this.recienRegistrada.set({ cambio: typeof cambio === 'number' && Number.isFinite(cambio) ? cambio : null });
    }

    // El aviso es de este momento: se quita del historial para que no vuelva al recargar ni al regresar.
    afterNextRender(() => limpiarEstadoHistorial());

    // Al llegar de registrar, el foco queda en "Nueva venta": Enter arranca la siguiente.
    afterRenderEffect(() => {
      const boton = this.botonNuevaVenta();
      if (boton && !this.focoInicialHecho) {
        this.focoInicialHecho = true;
        boton.nativeElement.focus();
      }
    });

    effect(() => {
      if (this.factura.hasValue()) {
        this.title.setTitle(`Factura ${this.factura.value().venta.numeroFactura} · ${NOMBRE_APP}`);
      } else if (this.noExiste()) {
        this.title.setTitle(`Factura no encontrada · ${NOMBRE_APP}`);
      }
    });

    // Ctrl+P o el menú del navegador también imprimen: el pie toma la hora de ese momento.
    // La vista se actualiza en el acto porque el navegador maqueta la hoja justo después del evento.
    const alImprimir = () => {
      this.impresaEl.set(formatoImpresion.format(new Date()));
      this.cdr.detectChanges();
    };
    window.addEventListener('beforeprint', alImprimir);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeprint', alImprimir));
  }

  protected volver(): void {
    this.location.back();
  }

  /** El tema pasa a claro solo al imprimir (core/tema.ts escucha beforeprint y afterprint). */
  protected imprimir(): void {
    window.print();
  }
}

function esListadoDeVentas(url: UrlTree | null): boolean {
  const segmentos = url?.root.children['primary']?.segments ?? [];
  return segmentos.length === 1 && segmentos[0].path === 'ventas';
}

function leerEstadoHistorial(): unknown {
  try {
    return history.state;
  } catch {
    return null;
  }
}

/** Quita las marcas de venta registrada y conserva las claves que el router guarda ahí. */
function limpiarEstadoHistorial(): void {
  const estado = leerEstadoHistorial();
  if (!estado || typeof estado !== 'object') {
    return;
  }
  const { registrada, cambio, [VENTA_REGISTRADA]: marca, ...resto } = estado as Record<string, unknown>;
  if (registrada === undefined && cambio === undefined && marca === undefined) {
    return;
  }
  try {
    history.replaceState(resto, '');
  } catch {
    // Sin acceso al historial el aviso solo reaparecería al recargar.
  }
}
