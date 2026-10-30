import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faStar as faEstrellaVacia } from '@fortawesome/free-regular-svg-icons';
import {
  faAddressCard,
  faCircleInfo,
  faClipboardCheck,
  faFilterCircleXmark,
  faPlus,
  faStar,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { hoyISO } from '../../core/fechas';
import { DIAS_REEVALUACION, nombreEmpleado } from '../../core/models';
import { Session } from '../../core/session';
import { SucursalesRepository } from '../../data/catalogos.repository';
import { EmpleadosRepository } from '../../data/empleados.repository';
import { ProductosRepository } from '../../data/productos.repository';
import {
  claveSuministro,
  EvaluacionesRepository,
  ProveedoresRepository,
  SuministrosRepository,
} from '../../data/proveedores.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoBloque, EsqueletoTabla } from '../../shared/esqueleto';
import { FechaPipe } from '../../shared/formato';
import { Medidor } from '../../shared/graficos/medidor';
import { EscalaCalificaciones, TiraCalificaciones } from '../../shared/graficos/tira-calificaciones';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { paginar, PieTabla } from '../../shared/tabla/pie-tabla';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';
import { abrirDialogoEvaluacion, SuministroElegible, suministrosElegibles } from './evaluacion-dialogo';

const MINIMO_EVALUACIONES = 3;
const PENDIENTES_VISIBLES = 8;

type FiltroCalificacion = 'todas' | 'baja' | 'media' | 'alta';
type FiltroATiempo = 'todos' | 'si' | 'no';
type DestinoFoco = 'resumen-titulo' | 'pendientes-titulo' | 'historial-titulo';

function diasEntre(desde: string, hasta: string): number {
  const utc = (iso: string) => {
    const [anio, mes, dia] = iso.split('-').map(Number);
    return Date.UTC(anio, mes - 1, dia);
  };
  return Math.round((utc(hasta) - utc(desde)) / 86_400_000);
}

@Component({
  selector: 'app-evaluaciones',
  imports: [
    FaIconComponent,
    NgbTooltip,
    RouterLink,
    PageHeader,
    ErrorCarga,
    Vacio,
    EsqueletoBloque,
    EsqueletoTabla,
    FechaPipe,
    Medidor,
    TiraCalificaciones,
    EscalaCalificaciones,
    EncabezadoOrden,
    PieTabla,
  ],
  styles: `
    tr.elegida > * {
      background: var(--soft-bg);
      --grafico-superficie: var(--soft-bg);
    }
    .celda-tira {
      min-width: 11.5rem;
    }
    .celda-medidor {
      min-width: 10rem;
    }
    .observaciones {
      min-width: 14rem;
    }
    h2[tabindex='-1']:focus {
      outline: none;
    }
  `,
  templateUrl: './evaluaciones.html',
})
export class Evaluaciones {
  private readonly session = inject(Session);
  private readonly repo = inject(EvaluacionesRepository);
  private readonly suministrosRepo = inject(SuministrosRepository);
  private readonly proveedoresRepo = inject(ProveedoresRepository);
  private readonly productosRepo = inject(ProductosRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly empleadosRepo = inject(EmpleadosRepository);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  readonly proveedor = input<string>();

  protected readonly iconos = {
    faAddressCard,
    faCircleInfo,
    faClipboardCheck,
    faFilterCircleXmark,
    faPlus,
    faStar,
    faEstrellaVacia,
    faTrashCan,
  };
  protected readonly estrellas = [1, 2, 3, 4, 5];
  protected readonly diasReevaluacion = DIAS_REEVALUACION;
  protected readonly minimoEvaluaciones = MINIMO_EVALUACIONES;
  protected readonly pendientesVisibles = PENDIENTES_VISIBLES;
  protected readonly porTodas = computed(() => this.session.idSucursalFiltro() === null);

  protected readonly opcionesCalificacion: { clave: FiltroCalificacion; texto: string }[] = [
    { clave: 'todas', texto: 'Todas' },
    { clave: 'baja', texto: '1 a 2' },
    { clave: 'media', texto: '3' },
    { clave: 'alta', texto: '4 a 5' },
  ];
  protected readonly opcionesATiempo: { clave: FiltroATiempo; texto: string }[] = [
    { clave: 'todos', texto: 'Todos' },
    { clave: 'si', texto: 'Sí' },
    { clave: 'no', texto: 'No' },
  ];

  protected readonly nit = linkedSignal(() => this.proveedor() ?? '');
  protected readonly calificacion = signal<FiltroCalificacion>('todas');
  protected readonly aTiempo = signal<FiltroATiempo>('todos');
  protected readonly verTodosPendientes = signal(false);
  protected readonly orden = new Orden<'fecha' | 'calificacion' | 'proveedor'>();
  protected readonly porPagina = signal(15);

  private readonly focoTrasRecargar = signal<DestinoFoco | null>(null);

  protected readonly datos = resource({
    params: () => ({ idSucursal: this.session.idSucursalFiltro() }),
    loader: async ({ params }) => {
      const [evaluaciones, suministros, proveedores, productos, sucursales, empleados] = await Promise.all([
        this.repo.listar(),
        this.suministrosRepo.listar(),
        this.proveedoresRepo.listar(),
        this.productosRepo.listar(),
        this.sucursalesRepo.listar(),
        this.empleadosRepo.listar(),
      ]);
      const hoy = hoyISO();
      const enVista = (s: { idSucursal: number }) => params.idSucursal === null || s.idSucursal === params.idSucursal;
      const evaluacionesEnVista = evaluaciones.filter(enVista);
      const suministrosEnVista = suministros.filter(enVista);
      const nombreProveedor = (nit: string) => proveedores.find((p) => p.nit === nit)?.nombre ?? '';
      const nombreProducto = (id: number) => productos.find((p) => p.idProducto === id)?.nombre ?? '';
      const nombreSucursal = (id: number) => sucursales.find((s) => s.idSucursal === id)?.nombre ?? '';

      const filas = evaluacionesEnVista.map((evaluacion) => {
        const evaluador = empleados.find((e) => e.idEmpleado === evaluacion.idEmpleado);
        return {
          evaluacion,
          proveedor: nombreProveedor(evaluacion.nit),
          producto: nombreProducto(evaluacion.idProducto),
          sucursal: nombreSucursal(evaluacion.idSucursal),
          evaluador: evaluador ? nombreEmpleado(evaluador) : '',
        };
      });

      const elegibles = suministrosElegibles(suministrosEnVista, proveedores, productos, sucursales);

      const pendientes = suministrosEnVista
        .map((suministro) => {
          const clave = claveSuministro(suministro);
          const ultima = evaluacionesEnVista.find((e) => claveSuministro(e) === clave)?.fechaEvaluacion ?? null;
          return {
            clave,
            nit: suministro.nit,
            idProducto: suministro.idProducto,
            proveedor: nombreProveedor(suministro.nit),
            producto: nombreProducto(suministro.idProducto),
            sucursal: nombreSucursal(suministro.idSucursal),
            ultima,
            dias: ultima ? diasEntre(ultima, hoy) : null,
            elegible: elegibles.find((e) => e.clave === clave) ?? null,
          };
        })
        .filter((p) => p.dias === null || p.dias > DIAS_REEVALUACION)
        .sort(
          (a, b) =>
            (b.dias ?? Infinity) - (a.dias ?? Infinity) ||
            a.proveedor.localeCompare(b.proveedor, 'es') ||
            a.producto.localeCompare(b.producto, 'es'),
        );

      const resumen = proveedores
        .map((proveedor) => {
          const propias = evaluacionesEnVista.filter((e) => e.nit === proveedor.nit);
          const valores = propias.map((e) => e.calificacion);
          return {
            nit: proveedor.nit,
            nombre: proveedor.nombre,
            valores,
            cantidad: propias.length,
            promedio: propias.length ? valores.reduce((s, v) => s + v, 0) / propias.length : null,
            aTiempo: propias.filter((e) => e.cumplimientoTiempo).length,
            ultima: propias[0]?.fechaEvaluacion ?? null,
            suministros: elegibles.filter((e) => e.nit === proveedor.nit),
          };
        })
        .filter((r) => r.cantidad > 0 || r.suministros.length > 0)
        .sort(
          (a, b) =>
            (b.promedio ?? -1) - (a.promedio ?? -1) || b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'),
        );

      return { filas, resumen, pendientes, elegibles };
    },
  });

  protected readonly nitVigente = computed(() => {
    const nit = this.nit();
    return nit && this.datos.hasValue() && this.datos.value().resumen.some((r) => r.nit === nit) ? nit : '';
  });

  protected readonly nombreProveedorElegido = computed(() => {
    const nit = this.nitVigente();
    return nit && this.datos.hasValue() ? (this.datos.value().resumen.find((r) => r.nit === nit)?.nombre ?? '') : '';
  });

  protected readonly opcionesProveedor = computed(() =>
    this.datos.hasValue()
      ? [...this.datos.value().resumen].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      : [],
  );

  protected readonly pendientes = computed(() => {
    const nit = this.nitVigente();
    return (this.datos.hasValue() ? this.datos.value().pendientes : []).filter((p) => !nit || p.nit === nit);
  });

  protected readonly pendientesMostrados = computed(() =>
    this.verTodosPendientes() ? this.pendientes() : this.pendientes().slice(0, PENDIENTES_VISIBLES),
  );

  protected readonly filtrosActivos = computed(
    () => (this.nitVigente() ? 1 : 0) + (this.calificacion() !== 'todas' ? 1 : 0) + (this.aTiempo() !== 'todos' ? 1 : 0),
  );

  protected readonly filtradas = computed(() => {
    const nit = this.nitVigente();
    const calificacion = this.calificacion();
    const aTiempo = this.aTiempo();
    return (this.datos.hasValue() ? this.datos.value().filas : []).filter(({ evaluacion: e }) => {
      if (nit && e.nit !== nit) return false;
      if (calificacion === 'baja' && e.calificacion > 2) return false;
      if (calificacion === 'media' && e.calificacion !== 3) return false;
      if (calificacion === 'alta' && e.calificacion < 4) return false;
      if (aTiempo === 'si' && !e.cumplimientoTiempo) return false;
      if (aTiempo === 'no' && e.cumplimientoTiempo) return false;
      return true;
    });
  });

  protected readonly ordenadas = computed(() =>
    this.orden.aplicar(this.filtradas(), {
      fecha: (f) => f.evaluacion.fechaEvaluacion,
      calificacion: (f) => f.evaluacion.calificacion,
      proveedor: (f) => f.proveedor,
    }),
  );

  protected readonly pagina = linkedSignal({
    source: () => [this.nitVigente(), this.calificacion(), this.aTiempo(), this.orden.estado(), this.porPagina()],
    computation: () => 1,
  });

  protected readonly paginaValida = computed(() =>
    Math.min(this.pagina(), Math.max(1, Math.ceil(this.ordenadas().length / this.porPagina()))),
  );

  protected readonly paginaActual = computed(() => paginar(this.ordenadas(), this.paginaValida(), this.porPagina()));

  constructor() {
    effect(() => {
      const destino = this.focoTrasRecargar();
      if (!destino || this.datos.isLoading()) return;
      untracked(() => {
        this.focoTrasRecargar.set(null);
        afterNextRender(() => document.getElementById(destino)?.focus(), { injector: this.injector });
      });
    });
  }

  protected elegirProveedor(nit: string): void {
    this.nit.set(nit);
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { proveedor: nit || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected alternarProveedor(nit: string): void {
    this.elegirProveedor(this.nitVigente() === nit ? '' : nit);
  }

  protected quitarFiltros(): void {
    this.calificacion.set('todas');
    this.aTiempo.set('todos');
    if (this.nit()) this.elegirProveedor('');
  }

  protected valor(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }

  protected haceCuanto(dias: number): string {
    return dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
  }

  protected porcentaje(parte: number, total: number): string {
    return `${Math.round((parte / total) * 100)} %`;
  }

  protected async nueva(): Promise<void> {
    if (!this.datos.hasValue()) return;
    await this.evaluar(this.datos.value().elegibles, null, null);
  }

  protected async evaluarProveedor(suministros: SuministroElegible[]): Promise<void> {
    await this.evaluar(suministros, suministros.length === 1 ? suministros[0] : null, 'resumen-titulo');
  }

  protected async evaluarPendiente(elegible: SuministroElegible | null): Promise<void> {
    if (!elegible) return;
    await this.evaluar([elegible], elegible, 'pendientes-titulo');
  }

  private async evaluar(
    suministros: SuministroElegible[],
    fijo: SuministroElegible | null,
    foco: DestinoFoco | null,
  ): Promise<void> {
    if (suministros.length === 0) return;
    if (await abrirDialogoEvaluacion(this.modal, suministros, fijo)) {
      this.avisos.exito('Evaluación registrada.');
      this.datos.reload();
      this.focoTrasRecargar.set(foco);
    }
  }

  protected async eliminar(fila: { evaluacion: { idEvaluacion: number }; proveedor: string; producto: string }): Promise<void> {
    const eliminado = await this.confirmar.eliminar({
      titulo: 'Eliminar evaluación',
      mensaje: `La evaluación de ${fila.producto} (${fila.proveedor}) dejará de contar en el promedio del proveedor. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar evaluación',
      accion: (clave) => this.repo.eliminar(fila.evaluacion.idEvaluacion, clave),
    });
    if (!eliminado) return;
    this.avisos.exito('Evaluación eliminada.');
    this.datos.reload();
    this.focoTrasRecargar.set('historial-titulo');
  }

  protected formatoPromedio(promedio: number): string {
    return promedio.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
}
