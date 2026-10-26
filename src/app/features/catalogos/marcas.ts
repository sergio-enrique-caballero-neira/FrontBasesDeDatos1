import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPen, faPlus, faTags, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { mensajeDeError } from '../../core/domain-error';
import { Marca } from '../../core/models';
import { MarcasRepository } from '../../data/catalogos.repository';
import { ProductosRepository } from '../../data/productos.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoTabla } from '../../shared/esqueleto';
import { abrirFormulario } from '../../shared/formulario-dialogo';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { paginar, PieTabla } from '../../shared/tabla/pie-tabla';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';

interface FilaMarca {
  marca: Marca;
  productos: number;
}

@Component({
  selector: 'app-marcas',
  imports: [FaIconComponent, RouterLink, NgbTooltip, PageHeader, ErrorCarga, Vacio, EsqueletoTabla, EncabezadoOrden, PieTabla],
  styles: `
    .acciones-fila {
      display: inline-flex;
      gap: 0.25rem;
    }
    .btn[aria-disabled='true'] {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
  template: `
    <div class="page">
      <app-page-header titulo="Marcas" descripcion="Fabricantes de los productos que vende la cadena.">
        <button type="button" class="btn btn-primary" (click)="editar(null)">
          <fa-icon [icon]="iconos.faPlus" />
          Nueva marca
        </button>
      </app-page-header>

      <div class="card">
        @if (marcas.hasValue()) {
          @if (!marcas.value().length) {
            <app-vacio
              [icono]="iconos.faTags"
              titulo="Aún no hay marcas"
              detalle="Cada producto pertenece a una marca, así que crea las marcas antes que los productos."
            >
              <button type="button" class="btn btn-primary" (click)="editar(null)">Crear la primera marca</button>
            </app-vacio>
          } @else {
            <div class="table-responsive" [attr.aria-busy]="marcas.isLoading()" [class.actualizando]="marcas.isLoading()">
              <table class="table align-middle">
                <caption class="visually-hidden">Marcas y cuántos productos del catálogo tiene cada una</caption>
                <thead>
                  <tr>
                    <th scope="col" [attr.aria-sort]="orden.ariaSort('nombre')">
                      <app-encabezado-orden [orden]="orden" columna="nombre" texto="Marca" />
                    </th>
                    <th scope="col" class="col-sec" [attr.aria-sort]="orden.ariaSort('pais')">
                      <app-encabezado-orden [orden]="orden" columna="pais" texto="País de origen" />
                    </th>
                    <th scope="col" class="text-end" [attr.aria-sort]="orden.ariaSort('productos')">
                      <app-encabezado-orden [orden]="orden" columna="productos" texto="Productos" />
                    </th>
                    <th scope="col" class="text-end"><span class="visually-hidden">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (fila of pagina(); track fila.marca.idMarca) {
                    <tr>
                      <td>
                        <span class="fw-medium">{{ fila.marca.nombre }}</span>
                        <div class="solo-movil small text-body-secondary">{{ fila.marca.paisOrigen }}</div>
                      </td>
                      <td class="col-sec">{{ fila.marca.paisOrigen }}</td>
                      <td class="text-end num">
                        @if (fila.productos > 0) {
                          <a routerLink="/productos" [queryParams]="{ marca: fila.marca.idMarca }"
                            >{{ fila.productos }}<span class="visually-hidden">
                              {{ fila.productos === 1 ? 'producto' : 'productos' }} de {{ fila.marca.nombre }}</span
                            ></a
                          >
                        } @else {
                          <span class="text-body-secondary">0</span>
                        }
                      </td>
                      <td class="text-end">
                        <div class="acciones-fila">
                          <button
                            type="button"
                            class="btn btn-soft btn-icon btn-sm"
                            [attr.aria-label]="'Editar ' + fila.marca.nombre"
                            [ngbTooltip]="'Editar ' + fila.marca.nombre"
                            container="body"
                            [openDelay]="300"
                            (click)="editar(fila.marca)"
                          >
                            <fa-icon [icon]="iconos.faPen" />
                          </button>
                          @let motivo = motivoNoEliminar(fila);
                          <button
                            type="button"
                            class="btn btn-soft btn-icon btn-sm"
                            [class.text-danger]="!motivo"
                            [attr.aria-disabled]="motivo ? 'true' : null"
                            [attr.aria-label]="motivo ?? 'Eliminar ' + fila.marca.nombre"
                            [ngbTooltip]="motivo ?? 'Eliminar ' + fila.marca.nombre"
                            container="body"
                            [openDelay]="300"
                            (click)="eliminar(fila, motivo)"
                          >
                            <fa-icon [icon]="iconos.faTrashCan" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <app-pie-tabla [total]="filas().length" nombre="marcas" [(pagina)]="numeroPagina" [(porPagina)]="porPagina" />
          }
        } @else if (marcas.error()) {
          <app-error-carga que="La lista de marcas" [error]="marcas.error()" (reintentar)="marcas.reload()" />
        } @else {
          <app-esqueleto-tabla [columnas]="['texto', 'texto', 'numero', 'numero']" [filas]="7" texto="Cargando marcas" />
        }
      </div>
    </div>
  `,
})
export class Marcas {
  private readonly repo = inject(MarcasRepository);
  private readonly productosRepo = inject(ProductosRepository);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);

  protected readonly iconos = { faPen, faPlus, faTags, faTrashCan };
  protected readonly orden = new Orden<'nombre' | 'pais' | 'productos'>();
  protected readonly numeroPagina = signal(1);
  protected readonly porPagina = signal(15);

  protected readonly marcas = resource({
    loader: async (): Promise<FilaMarca[]> => {
      const [marcas, productos] = await Promise.all([this.repo.listar(), this.productosRepo.listar()]);
      return marcas.map((marca) => ({ marca, productos: productos.filter((p) => p.idMarca === marca.idMarca).length }));
    },
  });

  protected readonly filas = computed(() =>
    this.orden.aplicar(this.marcas.hasValue() ? this.marcas.value() : [], {
      nombre: (f) => f.marca.nombre,
      pais: (f) => f.marca.paisOrigen,
      productos: (f) => f.productos,
    }),
  );

  protected readonly pagina = computed(() => paginar(this.filas(), this.numeroPagina(), this.porPagina()));

  constructor() {
    // Al eliminar la última marca de la última página, se vuelve a la página que sigue existiendo.
    effect(() => {
      const ultima = Math.max(1, Math.ceil(this.filas().length / this.porPagina()));
      if (this.numeroPagina() > ultima) {
        this.numeroPagina.set(ultima);
      }
    });
  }

  /** El repositorio no deja borrar una marca con productos; se avisa antes de intentarlo. */
  protected motivoNoEliminar(fila: FilaMarca): string | null {
    if (fila.productos === 0) {
      return null;
    }
    const que = fila.productos === 1 ? '1 producto' : `${fila.productos} productos`;
    return `No se puede eliminar ${fila.marca.nombre}: la usan ${que}`;
  }

  protected async editar(marca: Marca | null): Promise<void> {
    const guardada = await abrirFormulario(this.modal, {
      titulo: marca ? 'Editar marca' : 'Nueva marca',
      textoGuardar: marca ? 'Guardar cambios' : 'Crear marca',
      campos: [
        { clave: 'nombre', etiqueta: 'Nombre', requerido: true },
        { clave: 'paisOrigen', etiqueta: 'País de origen', requerido: true },
      ],
      valores: marca ? { nombre: marca.nombre, paisOrigen: marca.paisOrigen } : undefined,
      guardar: (v) => this.repo.guardar({ idMarca: marca?.idMarca ?? 0, nombre: v['nombre'], paisOrigen: v['paisOrigen'] }),
    });
    if (guardada) {
      this.avisos.exito(marca ? 'Cambios guardados.' : `Marca ${guardada.nombre} creada.`);
      this.marcas.reload();
    }
  }

  protected async eliminar(fila: FilaMarca, motivo: string | null): Promise<void> {
    if (motivo) {
      // En pantallas táctiles el tooltip no aparece: el toque explica por qué no se puede.
      this.avisos.error(`${motivo}. Primero cambia esos productos a otra marca.`);
      return;
    }
    const { marca } = fila;
    const confirmado = await this.confirmar.preguntar({
      titulo: 'Eliminar marca',
      mensaje: `Se eliminará la marca ${marca.nombre}. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar marca',
      peligro: true,
    });
    if (!confirmado) return;
    try {
      await this.repo.eliminar(marca.idMarca);
      this.avisos.exito('Marca eliminada.');
      this.marcas.reload();
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
    }
  }
}
