import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faClipboardCheck, faPen, faPlus, faStar, faTrashCan, faTruckRampBox } from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { mensajeDeError } from '../../core/domain-error';
import { Producto, Proveedor, Sucursal, Suministro } from '../../core/models';
import { Session } from '../../core/session';
import { SucursalesRepository } from '../../data/catalogos.repository';
import { ProductosRepository } from '../../data/productos.repository';
import {
  claveSuministro,
  EvaluacionesRepository,
  ProveedoresRepository,
  SuministrosRepository,
} from '../../data/proveedores.repository';
import { normalizar } from '../../data/reglas';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoTabla } from '../../shared/esqueleto';
import { CampoBusqueda } from '../../shared/filtros';
import { FechaPipe, numero, PesosPipe } from '../../shared/formato';
import { abrirFormulario } from '../../shared/formulario-dialogo';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { paginar, PieTabla } from '../../shared/tabla/pie-tabla';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';
import { abrirDialogoEvaluacion, suministrosElegibles } from '../evaluaciones/evaluacion-dialogo';

/** Catálogos que necesita el formulario de suministro para sus listas. */
export interface CatalogosSuministro {
  proveedores: Proveedor[];
  productos: Producto[];
  sucursales: Sucursal[];
}

/** Valores con los que se abre un suministro nuevo. */
export interface PrecargaSuministro {
  nit?: string;
  idSucursal?: number | null;
  /** Desde la ficha del proveedor el NIT queda fijo: el suministro es de ese proveedor. */
  nitFijo?: boolean;
}

/**
 * Formulario de crear o editar un suministro. Lo usan la lista de suministros y
 * la ficha del proveedor. Resuelve con el suministro guardado o undefined si se cancela.
 */
export function abrirDialogoSuministro(
  modal: NgbModal,
  repo: SuministrosRepository,
  catalogos: CatalogosSuministro,
  suministro: Suministro | null,
  precarga: PrecargaSuministro = {},
): Promise<Suministro | undefined> {
  return abrirFormulario(modal, {
    titulo: suministro ? 'Editar suministro' : 'Nuevo suministro',
    textoGuardar: suministro ? 'Guardar cambios' : 'Registrar suministro',
    campos: [
      {
        clave: 'nit',
        etiqueta: 'Proveedor',
        tipo: 'select',
        requerido: true,
        soloLectura: !!suministro || !!precarga.nitFijo,
        opciones: catalogos.proveedores.map((p) => ({ valor: p.nit, texto: p.nombre })),
      },
      {
        clave: 'idProducto',
        etiqueta: 'Producto',
        tipo: 'select',
        requerido: true,
        soloLectura: !!suministro,
        opciones: catalogos.productos.map((p) => ({ valor: String(p.idProducto), texto: `${p.codigo} · ${p.nombre}` })),
      },
      {
        clave: 'idSucursal',
        etiqueta: 'Sucursal que recibe',
        tipo: 'select',
        requerido: true,
        soloLectura: !!suministro,
        opciones: catalogos.sucursales.map((s) => ({ valor: String(s.idSucursal), texto: `${s.nombre} · ${s.ciudad}` })),
      },
      { clave: 'precioSuministro', etiqueta: 'Precio de suministro por unidad (COP)', tipo: 'number', requerido: true, minimo: 1, mitad: true },
      { clave: 'tiempoEntregaDias', etiqueta: 'Tiempo de entrega (días)', tipo: 'number', requerido: true, minimo: 0, maximo: 120, mitad: true },
    ],
    valores: suministro
      ? {
          nit: suministro.nit,
          idProducto: String(suministro.idProducto),
          idSucursal: String(suministro.idSucursal),
          precioSuministro: String(suministro.precioSuministro),
          tiempoEntregaDias: String(suministro.tiempoEntregaDias),
        }
      : {
          nit: precarga.nit ?? '',
          idSucursal: precarga.idSucursal === null || precarga.idSucursal === undefined ? '' : String(precarga.idSucursal),
        },
    guardar: (v) =>
      repo.guardar(
        {
          nit: v['nit'],
          idProducto: Number(v['idProducto']),
          idSucursal: Number(v['idSucursal']),
          precioSuministro: Math.round(Number(v['precioSuministro'])),
          tiempoEntregaDias: Math.round(Number(v['tiempoEntregaDias'])),
        },
        !suministro,
      ),
  });
}

@Component({
  selector: 'app-suministros',
  imports: [
    RouterLink,
    FaIconComponent,
    NgbTooltip,
    PageHeader,
    ErrorCarga,
    Vacio,
    EsqueletoTabla,
    CampoBusqueda,
    PieTabla,
    PesosPipe,
    FechaPipe,
    EncabezadoOrden,
  ],
  templateUrl: './suministros.html',
})
export class Suministros {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly repo = inject(SuministrosRepository);
  private readonly proveedoresRepo = inject(ProveedoresRepository);
  private readonly productosRepo = inject(ProductosRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly evaluacionesRepo = inject(EvaluacionesRepository);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);

  /** NIT que llega en ?proveedor= desde la lista o la ficha de proveedores. */
  readonly proveedor = input<string>();

  protected readonly iconos = { faClipboardCheck, faPen, faPlus, faStar, faTrashCan, faTruckRampBox };
  protected readonly porTodas = computed(() => this.session.idSucursalFiltro() === null);
  protected readonly busqueda = signal('');
  protected readonly nit = linkedSignal(() => this.proveedor() ?? '');
  protected readonly soloSinEvaluar = signal(false);
  protected readonly orden = new Orden<'proveedor' | 'producto' | 'sucursal' | 'precio' | 'entrega' | 'calidad'>();

  protected readonly datos = resource({
    params: () => ({ idSucursal: this.session.idSucursalFiltro() }),
    loader: async ({ params }) => {
      const [suministros, proveedores, productos, sucursales, evaluaciones] = await Promise.all([
        this.repo.listar(),
        this.proveedoresRepo.listar(),
        this.productosRepo.listar(),
        this.sucursalesRepo.listar(),
        this.evaluacionesRepo.listar(),
      ]);
      const filas = suministros
        .filter((s) => params.idSucursal === null || s.idSucursal === params.idSucursal)
        .map((suministro) => {
          const clave = claveSuministro(suministro);
          // Llegan de la más reciente a la más antigua: la primera es la última evaluación.
          const propias = evaluaciones.filter((e) => claveSuministro(e) === clave);
          const producto = productos.find((p) => p.idProducto === suministro.idProducto);
          return {
            clave,
            suministro,
            proveedor: proveedores.find((p) => p.nit === suministro.nit)?.nombre ?? 'Proveedor eliminado',
            producto: producto?.nombre ?? 'Producto eliminado del catálogo',
            existeProducto: !!producto,
            codigo: producto?.codigo ?? '',
            sucursal: sucursales.find((s) => s.idSucursal === suministro.idSucursal)?.nombre ?? 'Sucursal eliminada',
            evaluaciones: propias.length,
            promedio: propias.length ? propias.reduce((s, e) => s + e.calificacion, 0) / propias.length : 0,
            ultima: propias[0]?.fechaEvaluacion ?? '',
          };
        })
        .sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es') || a.producto.localeCompare(b.producto, 'es'));
      return { filas, proveedores, productos, sucursales, elegibles: suministrosElegibles(suministros, proveedores, productos, sucursales) };
    },
  });

  /** Los datos solo cuando hay valor: `value()` lanza si el último intento falló. */
  private readonly cargados = computed(() => (this.datos.hasValue() ? this.datos.value() : undefined));

  /** Proveedores que tienen suministros en la sucursal de trabajo: las opciones del filtro. */
  protected readonly proveedoresEnVista = computed(() => {
    const filas = this.cargados()?.filas ?? [];
    return (this.cargados()?.proveedores ?? []).filter((p) => p.nit === this.nit() || filas.some((f) => f.suministro.nit === p.nit));
  });

  /** Filtra por proveedor y texto; el interruptor de "sin evaluar" va aparte para poder contar. */
  private readonly porProveedorYTexto = computed(() => {
    const texto = normalizar(this.busqueda());
    const nit = this.nit();
    return (this.cargados()?.filas ?? []).filter(
      (f) =>
        (!nit || f.suministro.nit === nit) &&
        (!texto || normalizar(f.producto).includes(texto) || normalizar(f.codigo).includes(texto)),
    );
  });

  protected readonly sinEvaluar = computed(() => this.porProveedorYTexto().filter((f) => f.evaluaciones === 0).length);

  protected readonly filtradas = computed(() =>
    this.soloSinEvaluar() ? this.porProveedorYTexto().filter((f) => f.evaluaciones === 0) : this.porProveedorYTexto(),
  );

  /** Por qué la tabla quedó vacía: todo evaluado o nada coincide con la búsqueda. */
  protected readonly sinResultados = computed(() =>
    this.soloSinEvaluar() && this.porProveedorYTexto().length > 0
      ? {
          titulo: 'Todos estos suministros ya tienen evaluación',
          detalle: 'Apaga "Solo sin evaluar" para verlos, o elige otro proveedor.',
        }
      : {
          titulo: 'Ningún suministro coincide con los filtros',
          detalle: 'Busca otro producto por nombre o código, o elige otro proveedor.',
        },
  );

  protected readonly filtrosActivos = computed(
    () => (this.nit() ? 1 : 0) + (this.busqueda().trim() ? 1 : 0) + (this.soloSinEvaluar() ? 1 : 0),
  );

  protected readonly ordenadas = computed(() =>
    this.orden.aplicar(this.filtradas(), {
      proveedor: (f) => f.proveedor,
      producto: (f) => f.producto,
      sucursal: (f) => f.sucursal,
      precio: (f) => f.suministro.precioSuministro,
      entrega: (f) => f.suministro.tiempoEntregaDias,
      // Los suministros sin evaluar quedan al final en cualquier dirección.
      calidad: (f) => (f.evaluaciones ? f.promedio : null),
    }),
  );

  /** Cualquier cambio de filtro, orden o sucursal vuelve a la primera página. */
  protected readonly pagina = linkedSignal({
    source: () => [this.nit(), this.busqueda(), this.soloSinEvaluar(), this.orden.estado(), this.session.idSucursalFiltro()],
    computation: () => 1,
  });
  protected readonly porPagina = signal(15);
  protected readonly enPagina = computed(() => paginar(this.ordenadas(), this.pagina(), this.porPagina()));

  protected formatoCalificacion(valor: number): string {
    return numero(valor);
  }

  /** Cambia el proveedor y lo deja en la URL para que el enlace se pueda compartir. */
  protected elegirProveedor(nit: string): void {
    this.nit.set(nit);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { proveedor: nit || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected quitarFiltros(): void {
    this.busqueda.set('');
    this.soloSinEvaluar.set(false);
    this.elegirProveedor('');
  }

  protected async editar(suministro: Suministro | null): Promise<void> {
    const datos = this.cargados();
    if (!datos) return;
    const guardado = await abrirDialogoSuministro(this.modal, this.repo, datos, suministro, {
      nit: this.nit(),
      idSucursal: this.session.idSucursalFiltro(),
    });
    if (guardado) {
      this.avisos.exito(suministro ? 'Cambios guardados.' : 'Suministro registrado.');
      this.datos.reload();
    }
  }

  protected async evaluar(clave: string): Promise<void> {
    const datos = this.cargados();
    const fijo = datos?.elegibles.find((e) => e.clave === clave) ?? null;
    const idEvaluador = this.session.usuario()?.idEmpleado;
    if (!datos || !fijo || !idEvaluador) return;
    if (await abrirDialogoEvaluacion(this.modal, datos.elegibles, fijo, idEvaluador)) {
      this.avisos.exito('Evaluación registrada.');
      this.datos.reload();
    }
  }

  protected async eliminar(suministro: Suministro, descripcion: string): Promise<void> {
    const confirmado = await this.confirmar.preguntar({
      titulo: 'Eliminar suministro',
      mensaje: `Se eliminará el suministro ${descripcion}. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar suministro',
      peligro: true,
    });
    if (!confirmado) return;
    try {
      await this.repo.eliminar(suministro);
      this.avisos.exito('Suministro eliminado.');
      this.datos.reload();
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
    }
  }
}
