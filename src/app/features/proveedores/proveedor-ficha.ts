import { Component, computed, effect, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faStar as faEstrellaVacia } from '@fortawesome/free-regular-svg-icons';
import {
  faCheck,
  faClipboardCheck,
  faPen,
  faPlus,
  faStar,
  faTrashCan,
  faTruck,
  faTruckRampBox,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { NOMBRE_APP } from '../../core/app-info';
import { Avisos } from '../../core/avisos';
import { mensajeDeError, NoEncontrado } from '../../core/domain-error';
import { nombreEmpleado, Suministro } from '../../core/models';
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
import { FechaPipe, numero, PesosPipe } from '../../shared/formato';
import { Miga, Migas } from '../../shared/migas';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { paginar, PieTabla } from '../../shared/tabla/pie-tabla';
import { ErrorCarga, Vacio } from '../../shared/ui';
import { abrirDialogoEvaluacion, suministrosElegibles } from '../evaluaciones/evaluacion-dialogo';
import { abrirDialogoSuministro } from '../suministros/suministros';
import { abrirDialogoProveedor } from './proveedor-dialogo';

function promedio(valores: number[]): number {
  return valores.length ? valores.reduce((suma, v) => suma + v, 0) / valores.length : 0;
}

/**
 * Ficha de un proveedor (ruta /proveedores/:nit): contacto, cómo ha cumplido,
 * qué suministra en cada sucursal con su calidad y, si existe, otro proveedor que
 * ya surte el mismo producto. Sirve para decidir si conviene mover un producto
 * a otro proveedor.
 */
@Component({
  selector: 'app-proveedor-ficha',
  imports: [
    RouterLink,
    FaIconComponent,
    NgbTooltip,
    Migas,
    ErrorCarga,
    Vacio,
    EsqueletoBloque,
    EsqueletoTabla,
    EncabezadoOrden,
    PieTabla,
    PesosPipe,
    FechaPipe,
  ],
  templateUrl: './proveedor-ficha.html',
  styleUrl: './proveedor-ficha.css',
})
export class ProveedorFicha {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly repo = inject(ProveedoresRepository);
  private readonly suministrosRepo = inject(SuministrosRepository);
  private readonly evaluacionesRepo = inject(EvaluacionesRepository);
  private readonly productosRepo = inject(ProductosRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly empleadosRepo = inject(EmpleadosRepository);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);
  private readonly title = inject(Title);

  /** Viene de la ruta /proveedores/:nit. */
  readonly nit = input.required<string>();

  protected readonly iconos = {
    faCheck,
    faClipboardCheck,
    faEstrellaVacia,
    faPen,
    faPlus,
    faStar,
    faTrashCan,
    faTruck,
    faTruckRampBox,
    faXmark,
  };
  protected readonly estrellas = [1, 2, 3, 4, 5];

  protected readonly datos = resource({
    params: () => this.nit(),
    loader: async ({ params: nit }) => {
      const [proveedor, suministros, evaluaciones, proveedores, productos, sucursales, empleados] = await Promise.all([
        this.repo.obtener(nit),
        this.suministrosRepo.listar(),
        this.evaluacionesRepo.listar(),
        this.repo.listar(),
        this.productosRepo.listar(),
        this.sucursalesRepo.listar(),
        this.empleadosRepo.listar(),
      ]);
      const producto = (idProducto: number) => productos.find((p) => p.idProducto === idProducto);
      const nombreSucursal = (idSucursal: number) =>
        sucursales.find((s) => s.idSucursal === idSucursal)?.nombre ?? 'Sucursal eliminada';
      const nombreProveedor = (nitOtro: string) => proveedores.find((p) => p.nit === nitOtro)?.nombre ?? 'Proveedor eliminado';

      const propios = suministros.filter((s) => s.nit === proveedor.nit);
      // El repositorio las entrega de la más reciente a la más antigua.
      const evaluacionesPropias = evaluaciones.filter((e) => e.nit === proveedor.nit);

      const filas = propios
        .map((suministro) => {
          const clave = claveSuministro(suministro);
          const propias = evaluacionesPropias.filter((e) => claveSuministro(e) === clave);
          const p = producto(suministro.idProducto);
          // Otra opción: el proveedor más rápido que ya surte este producto en cualquier sede;
          // a igual tiempo, el más barato.
          const otra = suministros
            .filter((o) => o.idProducto === suministro.idProducto && o.nit !== proveedor.nit)
            .sort((a, b) => a.tiempoEntregaDias - b.tiempoEntregaDias || a.precioSuministro - b.precioSuministro)[0];
          return {
            clave,
            suministro,
            producto: p?.nombre ?? 'Producto eliminado del catálogo',
            codigo: p?.codigo ?? '',
            existeProducto: !!p,
            sucursal: nombreSucursal(suministro.idSucursal),
            evaluaciones: propias.length,
            promedio: promedio(propias.map((e) => e.calificacion)),
            ultima: propias[0]?.fechaEvaluacion ?? '',
            alternativa: otra
              ? {
                  nit: otra.nit,
                  proveedor: nombreProveedor(otra.nit),
                  sucursal: nombreSucursal(otra.idSucursal),
                  dias: otra.tiempoEntregaDias,
                  precio: otra.precioSuministro,
                }
              : null,
          };
        })
        .sort((a, b) => a.producto.localeCompare(b.producto, 'es') || a.sucursal.localeCompare(b.sucursal, 'es'));

      const historial = evaluacionesPropias.map((evaluacion) => {
        const p = producto(evaluacion.idProducto);
        const evaluador = empleados.find((e) => e.idEmpleado === evaluacion.idEmpleado);
        return {
          evaluacion,
          producto: p?.nombre ?? 'Producto eliminado del catálogo',
          existeProducto: !!p,
          sucursal: nombreSucursal(evaluacion.idSucursal),
          evaluador: evaluador ? nombreEmpleado(evaluador) : 'Empleado retirado',
        };
      });

      // Calidad por sucursal: separa una sede que rinde mal del promedio general.
      const porSucursal = [...new Set(evaluacionesPropias.map((e) => e.idSucursal))]
        .map((idSucursal) => {
          const enSede = evaluacionesPropias.filter((e) => e.idSucursal === idSucursal);
          return {
            idSucursal,
            nombre: nombreSucursal(idSucursal),
            cantidad: enSede.length,
            promedio: promedio(enSede.map((e) => e.calificacion)),
            aTiempo: enSede.filter((e) => e.cumplimientoTiempo).length,
          };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

      const evaluados = filas.filter((f) => f.evaluaciones > 0);
      const peor = [...evaluados].sort((a, b) => a.promedio - b.promedio)[0];
      const mejor = [...evaluados].sort((a, b) => b.promedio - a.promedio)[0];

      return {
        proveedor,
        filas,
        historial,
        porSucursal,
        calidad: evaluacionesPropias.length
          ? {
              cantidad: evaluacionesPropias.length,
              promedio: promedio(evaluacionesPropias.map((e) => e.calificacion)),
              aTiempo: evaluacionesPropias.filter((e) => e.cumplimientoTiempo).length,
              primera: evaluacionesPropias[evaluacionesPropias.length - 1].fechaEvaluacion,
              ultima: evaluacionesPropias[0].fechaEvaluacion,
              // Solo tiene sentido nombrar la más baja si hay con qué compararla.
              masBaja: evaluados.length > 1 && peor.promedio < mejor.promedio ? peor : null,
            }
          : null,
        hayAlternativas: filas.some((f) => f.alternativa),
        elegibles: suministrosElegibles(propios, proveedores, productos, sucursales),
        catalogos: { proveedores, productos, sucursales },
      };
    },
  });

  protected readonly noExiste = computed(() => this.datos.error() instanceof NoEncontrado);

  protected readonly migas = computed<Miga[]>(() => [
    { texto: 'Proveedores', enlace: '/proveedores' },
    {
      texto: this.datos.hasValue()
        ? this.datos.value().proveedor.nombre
        : this.noExiste()
          ? 'Proveedor no encontrado'
          : 'Proveedor',
    },
  ]);

  // Qué suministra
  protected readonly soloSinEvaluar = linkedSignal({ source: this.nit, computation: () => false });
  protected readonly orden = new Orden<'producto' | 'sucursal' | 'precio' | 'entrega' | 'calidad' | 'ultima'>();

  protected readonly sinEvaluar = computed(() =>
    this.datos.hasValue() ? this.datos.value().filas.filter((f) => f.evaluaciones === 0).length : 0,
  );

  protected readonly suministrosVisibles = computed(() => {
    if (!this.datos.hasValue()) return [];
    const filas = this.datos.value().filas;
    return this.orden.aplicar(this.soloSinEvaluar() ? filas.filter((f) => f.evaluaciones === 0) : filas, {
      producto: (f) => f.producto,
      sucursal: (f) => f.sucursal,
      precio: (f) => f.suministro.precioSuministro,
      entrega: (f) => f.suministro.tiempoEntregaDias,
      // Sin evaluar queda al final en cualquier dirección.
      calidad: (f) => (f.evaluaciones ? f.promedio : null),
      ultima: (f) => f.ultima || null,
    });
  });

  protected readonly paginaSuministros = linkedSignal({
    source: () => [this.nit(), this.soloSinEvaluar(), this.orden.estado()],
    computation: () => 1,
  });
  protected readonly porPaginaSuministros = signal(15);
  protected readonly suministrosEnPagina = computed(() =>
    paginar(this.suministrosVisibles(), this.paginaSuministros(), this.porPaginaSuministros()),
  );

  // Historial de evaluaciones
  protected readonly paginaHistorial = linkedSignal({ source: this.nit, computation: () => 1 });
  protected readonly porPaginaHistorial = signal(15);
  protected readonly historialEnPagina = computed(() =>
    this.datos.hasValue() ? paginar(this.datos.value().historial, this.paginaHistorial(), this.porPaginaHistorial()) : [],
  );

  constructor() {
    // La pestaña nombra al proveedor, no solo "Proveedor".
    effect(() => {
      if (this.datos.hasValue()) {
        this.title.setTitle(`${this.datos.value().proveedor.nombre} · Proveedores · ${NOMBRE_APP}`);
      }
    });
  }

  protected calificacion(valor: number): string {
    return numero(valor);
  }

  protected dias(valor: number): string {
    return `${valor} ${valor === 1 ? 'día' : 'días'}`;
  }

  protected plural(cantidad: number, singular: string, plural: string): string {
    return `${cantidad} ${cantidad === 1 ? singular : plural}`;
  }

  protected soloDigitos(telefono: string): string {
    return telefono.replace(/[^0-9+]/g, '');
  }

  protected async editarProveedor(): Promise<void> {
    if (!this.datos.hasValue()) return;
    const guardado = await abrirDialogoProveedor(this.modal, this.datos.value().proveedor);
    if (guardado) {
      this.avisos.exito('Cambios guardados.');
      this.datos.reload();
    }
  }

  protected async eliminarProveedor(): Promise<void> {
    if (!this.datos.hasValue()) return;
    const proveedor = this.datos.value().proveedor;
    const confirmado = await this.confirmar.preguntar({
      titulo: 'Eliminar proveedor',
      mensaje: `Se eliminará ${proveedor.nombre} con sus correos. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar proveedor',
      peligro: true,
    });
    if (!confirmado) return;
    try {
      await this.repo.eliminar(proveedor.nit);
      this.avisos.exito(`Proveedor ${proveedor.nombre} eliminado.`);
      void this.router.navigateByUrl('/proveedores');
    } catch (error) {
      // Si tiene suministros, el repositorio explica cuántos y por qué no se puede.
      this.avisos.error(mensajeDeError(error));
    }
  }

  protected async editarSuministro(suministro: Suministro | null): Promise<void> {
    if (!this.datos.hasValue()) return;
    const { proveedor, catalogos } = this.datos.value();
    const guardado = await abrirDialogoSuministro(this.modal, this.suministrosRepo, catalogos, suministro, {
      nit: proveedor.nit,
      nitFijo: true,
      idSucursal: this.session.idSucursalFiltro(),
    });
    if (guardado) {
      this.avisos.exito(suministro ? 'Cambios guardados.' : 'Suministro registrado.');
      this.datos.reload();
    }
  }

  /** Sin clave elige el suministro en el diálogo; con clave lo deja fijo. */
  protected async evaluar(clave: string | null): Promise<void> {
    const idEvaluador = this.session.usuario()?.idEmpleado;
    if (!this.datos.hasValue() || !idEvaluador) return;
    const { elegibles } = this.datos.value();
    const fijo = clave ? (elegibles.find((e) => e.clave === clave) ?? null) : elegibles.length === 1 ? elegibles[0] : null;
    if (clave && !fijo) return;
    if (await abrirDialogoEvaluacion(this.modal, elegibles, fijo, idEvaluador)) {
      this.avisos.exito('Evaluación registrada.');
      this.datos.reload();
    }
  }
}
