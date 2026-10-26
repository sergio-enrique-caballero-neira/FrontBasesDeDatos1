import { Component, computed, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faCircleCheck,
  faCircleInfo,
  faPen,
  faPlus,
  faStore,
  faTrashCan,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { mensajeDeError } from '../../core/domain-error';
import { Sucursal, UMBRAL_STOCK_BAJO } from '../../core/models';
import { Session } from '../../core/session';
import { SucursalesRepository } from '../../data/catalogos.repository';
import { EstadisticasRepository, SucursalDetallada } from '../../data/estadisticas.repository';
import { InventarioRepository } from '../../data/productos.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoTabla } from '../../shared/esqueleto';
import { abrirFormulario } from '../../shared/formulario-dialogo';
import { diaMes, fechaCorta, numero, pesos, PesosPipe } from '../../shared/formato';
import { BarraCelda } from '../../shared/graficos/barra-celda';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { Periodo, SelectorPeriodo, ultimosDias } from '../../shared/tabla/selector-periodo';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';

const DIAS_POR_DEFECTO = 30;

type Columna = 'nombre' | 'ventas' | 'total' | 'ticket' | 'utilidad' | 'stock' | 'capital';

interface FilaSucursal extends SucursalDetallada {
  sucursal: Sucursal;
  /** Registros de inventario de la sede (productos que maneja). */
  productos: number;
}

/**
 * Comparativo de sedes en un mismo periodo: cuánto vende cada una, con qué ticket
 * y qué utilidad estimada deja, y cuánto capital tiene hoy en bodega. Sirve para
 * ver qué sede vende menos o deja menos margen y dónde hay inventario parado.
 * Desde aquí también se crean, editan y eliminan las sedes.
 */
@Component({
  selector: 'app-sucursales',
  imports: [FaIconComponent, NgbTooltip, PageHeader, ErrorCarga, Vacio, EsqueletoTabla, SelectorPeriodo, EncabezadoOrden, BarraCelda, PesosPipe],
  templateUrl: './sucursales.html',
  styles: `
    .envoltura-franja {
      padding: 0 var(--bs-card-spacer-x) 0.5rem;
    }
    .detalle-sede {
      max-width: 22rem;
    }
    .acciones {
      display: inline-flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      gap: 0.25rem;
    }
    tfoot :is(th, td) {
      border-bottom: 0;
      font-weight: 600;
    }
  `,
})
export class Sucursales {
  private readonly repo = inject(SucursalesRepository);
  private readonly estadisticas = inject(EstadisticasRepository);
  private readonly inventarioRepo = inject(InventarioRepository);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);

  protected readonly iconos = { faCircleCheck, faCircleInfo, faPen, faPlus, faStore, faTrashCan, faTriangleExclamation };
  protected readonly umbral = UMBRAL_STOCK_BAJO;

  protected readonly periodo = signal<Periodo>(ultimosDias(DIAS_POR_DEFECTO));
  protected readonly orden = new Orden<Columna>();

  protected readonly datos = resource({
    params: () => this.periodo(),
    loader: async ({ params: periodo }) => {
      const [sucursales, detalle, inventario] = await Promise.all([
        this.repo.listar(),
        this.estadisticas.porSucursalDetallado({ idSucursal: null, desde: periodo.desde, hasta: periodo.hasta }),
        this.inventarioRepo.listar(null),
      ]);
      const porId = new Map(sucursales.map((s) => [s.idSucursal, s]));
      return detalle.flatMap<FilaSucursal>((d) => {
        const sucursal = porId.get(d.idSucursal);
        if (!sucursal) return [];
        return [{ ...d, sucursal, productos: inventario.filter((i) => i.idSucursal === d.idSucursal).length }];
      });
    },
  });

  protected readonly filas = computed(() =>
    this.orden.aplicar(this.datos.value() ?? [], {
      nombre: (f) => f.nombre,
      ventas: (f) => f.cantidad,
      total: (f) => f.total,
      ticket: (f) => (f.cantidad ? f.ticketPromedio : null),
      utilidad: (f) => (f.cantidad ? f.utilidadEstimada : null),
      stock: (f) => (f.productos ? f.productosStockBajo : null),
      capital: (f) => f.capitalInventario,
    }),
  );

  /** Sumas de toda la cadena; el ticket es el de todas las ventas juntas, no la suma de tickets. */
  protected readonly cadena = computed(() => {
    const filas = this.datos.value() ?? [];
    const cantidad = filas.reduce((s, f) => s + f.cantidad, 0);
    const total = filas.reduce((s, f) => s + f.total, 0);
    return {
      cantidad,
      total,
      ticketPromedio: cantidad ? total / cantidad : 0,
      utilidadEstimada: filas.reduce((s, f) => s + f.utilidadEstimada, 0),
      productosStockBajo: filas.reduce((s, f) => s + f.productosStockBajo, 0),
      productos: filas.reduce((s, f) => s + f.productos, 0),
      capitalInventario: filas.reduce((s, f) => s + f.capitalInventario, 0),
      maximoTotal: Math.max(0, ...filas.map((f) => f.total)),
    };
  });

  /** "25 sept al 24 oct 2026", con las fechas exactas del periodo elegido. */
  protected readonly rango = computed(() => {
    const { desde, hasta } = this.periodo();
    if (desde === hasta) return fechaCorta(hasta);
    return desde.slice(0, 4) === hasta.slice(0, 4) ? `${diaMes(desde)} al ${fechaCorta(hasta)}` : `${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
  });

  protected readonly dias = computed(() => {
    const { desde, hasta } = this.periodo();
    const fecha = (iso: string) => {
      const [a, m, d] = iso.split('-').map(Number);
      return Date.UTC(a, m - 1, d);
    };
    return Math.round((fecha(hasta) - fecha(desde)) / 86_400_000) + 1;
  });

  protected readonly filtrosActivos = computed(() => {
    const porDefecto = ultimosDias(DIAS_POR_DEFECTO);
    const { desde, hasta } = this.periodo();
    return desde === porDefecto.desde && hasta === porDefecto.hasta ? 0 : 1;
  });

  /** Lo que oye un lector de pantalla cuando cambia el periodo y llegan los datos. */
  protected readonly anuncio = computed(() => {
    if (!this.datos.hasValue() || this.datos.isLoading()) return '';
    const sedes = this.datos.value().length;
    const { cantidad, total } = this.cadena();
    const ventas = cantidad === 1 ? '1 venta' : `${numero(cantidad)} ventas`;
    return `${sedes} ${sedes === 1 ? 'sucursal' : 'sucursales'}, ${ventas} por ${pesos(total)} del ${this.rango()}.`;
  });

  constructor() {
    // Orden inicial explícito para que la flecha de "Total vendido" lo muestre.
    this.orden.estado.set({ columna: 'total', direccion: 'desc' });
  }

  protected quitarFiltros(): void {
    this.periodo.set(ultimosDias(DIAS_POR_DEFECTO));
  }

  protected esSedeActual(idSucursal: number): boolean {
    return this.session.sucursal() === idSucursal;
  }

  protected proporcion(total: number): number {
    const maximo = this.cadena().maximoTotal;
    return maximo > 0 ? total / maximo : 0;
  }

  protected formatoPesos(valor: number): string {
    return pesos(valor);
  }

  protected trabajarEn(sucursal: Sucursal): void {
    this.session.elegirSucursal(sucursal.idSucursal);
    this.avisos.exito(`Ahora trabajas en ${sucursal.nombre}. Inventario y ventas muestran solo esta sede.`);
    void this.router.navigateByUrl('/inventario');
  }

  protected async editar(sucursal: Sucursal | null): Promise<void> {
    const guardada = await abrirFormulario(this.modal, {
      titulo: sucursal ? 'Editar sucursal' : 'Nueva sucursal',
      textoGuardar: sucursal ? 'Guardar cambios' : 'Crear sucursal',
      campos: [
        { clave: 'nombre', etiqueta: 'Nombre', requerido: true, placeholder: 'Por ejemplo: Sede Sur', mitad: true },
        { clave: 'ciudad', etiqueta: 'Ciudad', requerido: true, mitad: true },
        { clave: 'direccion', etiqueta: 'Dirección', requerido: true },
        { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', requerido: true, patron: /^[0-9 +()-]{7,20}$/, mitad: true },
      ],
      valores: sucursal ? ({ ...sucursal } as unknown as Record<string, string>) : undefined,
      guardar: (v) =>
        this.repo.guardar({
          idSucursal: sucursal?.idSucursal ?? 0,
          nombre: v['nombre'],
          ciudad: v['ciudad'],
          direccion: v['direccion'],
          telefono: v['telefono'],
        }),
    });
    if (guardada) {
      this.avisos.exito(sucursal ? 'Cambios guardados.' : `Sucursal ${guardada.nombre} creada.`);
      this.datos.reload();
    }
  }

  protected async eliminar(sucursal: Sucursal): Promise<void> {
    if (this.esSedeActual(sucursal.idSucursal)) {
      this.avisos.error('Estás trabajando en esta sucursal. Cambia de sucursal en la barra superior antes de eliminarla.');
      return;
    }
    const confirmado = await this.confirmar.preguntar({
      titulo: 'Eliminar sucursal',
      mensaje: `Se eliminará ${sucursal.nombre}. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar sucursal',
      peligro: true,
    });
    if (!confirmado) return;
    try {
      await this.repo.eliminar(sucursal.idSucursal);
      this.avisos.exito('Sucursal eliminada.');
      this.datos.reload();
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
    }
  }
}
