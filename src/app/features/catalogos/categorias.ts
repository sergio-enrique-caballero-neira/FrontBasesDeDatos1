import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPen, faPlus, faSitemap, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { mensajeDeError } from '../../core/domain-error';
import { Categoria } from '../../core/models';
import { CategoriasRepository } from '../../data/catalogos.repository';
import { ProductosRepository } from '../../data/productos.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoBloque } from '../../shared/esqueleto';
import { abrirFormulario } from '../../shared/formulario-dialogo';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';

interface NodoHija {
  categoria: Categoria;
  /** Productos clasificados en esta subcategoría. */
  productos: number;
}

/** Por qué no se puede eliminar y qué hacer antes. */
interface Motivo {
  texto: string;
  solucion: string;
}

interface NodoPrincipal {
  categoria: Categoria;
  hijas: NodoHija[];
  /** Productos clasificados directamente en la principal, sin contar sus subcategorías. */
  propios: number;
  /** Propios más los de todas sus subcategorías: lo que lista /productos?categoria=ID. */
  productos: number;
}

/** Lista de productos filtrada por la categoría (la de una principal incluye sus subcategorías). */
const RUTA_PRODUCTOS = '/productos';

function textoProductos(n: number): string {
  return n === 1 ? '1 producto' : `${n} productos`;
}

@Component({
  selector: 'app-categorias',
  imports: [NgTemplateOutlet, FaIconComponent, RouterLink, NgbTooltip, PageHeader, ErrorCarga, Vacio, EsqueletoBloque],
  styles: `
    .principal {
      padding: 1rem var(--bs-card-spacer-x);
      border-bottom: 1px solid var(--hairline);
    }
    .principal:last-child {
      border-bottom: 0;
    }
    .sub {
      margin: 0.75rem 0 0;
      padding: 0 0 0 1.25rem;
      border-left: 1px solid var(--hairline);
      list-style: none;
    }
    .fila {
      display: flex;
      align-items: center;
      gap: 0.5rem 1rem;
      min-height: 2.5rem;
    }
    .sub .fila + .fila {
      margin-top: 0.5rem;
    }
    .texto {
      flex: 1;
      min-width: 0;
    }
    .conteo {
      flex: none;
      white-space: nowrap;
    }
    .acciones-fila {
      display: inline-flex;
      flex: none;
      gap: 0.25rem;
    }
    .btn[aria-disabled='true'] {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .esqueleto {
      padding: 1.25rem var(--bs-card-spacer-x);
    }
  `,
  template: `
    <div class="page">
      <app-page-header
        titulo="Categorías"
        descripcion="Categorías principales y sus subcategorías. Cada producto se clasifica en una de ellas."
      >
        <button type="button" class="btn btn-primary" (click)="editar(null, null)">
          <fa-icon [icon]="iconos.faPlus" />
          Nueva categoría principal
        </button>
      </app-page-header>

      <div class="card">
        @if (arbol.hasValue()) {
          @if (!arbol.value().length) {
            <app-vacio
              [icono]="iconos.faSitemap"
              titulo="Aún no hay categorías"
              detalle="Cada producto se clasifica en una categoría. Crea una principal, como Herramientas manuales, y luego sus subcategorías."
            >
              <button type="button" class="btn btn-primary" (click)="editar(null, null)">Crear la primera categoría</button>
            </app-vacio>
          } @else {
            <ul
              class="list-unstyled mb-0"
              aria-label="Categorías principales"
              [attr.aria-busy]="arbol.isLoading()"
              [class.actualizando]="arbol.isLoading()"
            >
              @for (nodo of arbol.value(); track nodo.categoria.idCategoria) {
                <li class="principal">
                  <div class="fila">
                    <div class="texto">
                      <span class="fw-semibold d-block">{{ nodo.categoria.nombre }}</span>
                      <span class="small text-body-secondary d-block">{{ nodo.categoria.descripcion }}</span>
                      <span class="solo-movil small">
                        <ng-container *ngTemplateOutlet="conteo; context: { $implicit: nodo.categoria, n: nodo.productos }" />
                      </span>
                    </div>
                    <span class="conteo small col-sec">
                      <ng-container *ngTemplateOutlet="conteo; context: { $implicit: nodo.categoria, n: nodo.productos }" />
                    </span>
                    <div class="acciones-fila">
                      <button
                        type="button"
                        class="btn btn-soft btn-sm text-nowrap"
                        [attr.aria-label]="'Agregar subcategoría a ' + nodo.categoria.nombre"
                        [ngbTooltip]="'Agregar subcategoría a ' + nodo.categoria.nombre"
                        container="body"
                        [openDelay]="300"
                        (click)="editar(null, nodo.categoria)"
                      >
                        <fa-icon [icon]="iconos.faPlus" />
                        <span class="d-none d-sm-inline" aria-hidden="true">Subcategoría</span>
                      </button>
                      <ng-container *ngTemplateOutlet="acciones; context: { $implicit: nodo.categoria, motivo: motivoPrincipal(nodo) }" />
                    </div>
                  </div>
                  @if (nodo.hijas.length) {
                    <ul class="sub" [attr.aria-label]="'Subcategorías de ' + nodo.categoria.nombre">
                      @for (hija of nodo.hijas; track hija.categoria.idCategoria) {
                        <li class="fila">
                          <div class="texto">
                            <span class="d-block">{{ hija.categoria.nombre }}</span>
                            <span class="small text-body-secondary d-block">{{ hija.categoria.descripcion }}</span>
                            <span class="solo-movil small">
                              <ng-container *ngTemplateOutlet="conteo; context: { $implicit: hija.categoria, n: hija.productos }" />
                            </span>
                          </div>
                          <span class="conteo small col-sec">
                            <ng-container *ngTemplateOutlet="conteo; context: { $implicit: hija.categoria, n: hija.productos }" />
                          </span>
                          <div class="acciones-fila">
                            <ng-container *ngTemplateOutlet="acciones; context: { $implicit: hija.categoria, motivo: motivoHija(hija) }" />
                          </div>
                        </li>
                      }
                    </ul>
                  }
                </li>
              }
            </ul>
          }
        } @else if (arbol.error()) {
          <app-error-carga que="Las categorías" [error]="arbol.error()" (reintentar)="arbol.reload()" />
        } @else {
          <app-esqueleto-bloque class="esqueleto" [lineas]="8" texto="Cargando categorías" />
        }
      </div>
    </div>

    <ng-template #conteo let-categoria let-n="n">
      @if (n > 0) {
        <a [routerLink]="rutaProductos" [queryParams]="{ categoria: categoria.idCategoria }" class="num"
          >{{ textoProductos(n) }}<span class="visually-hidden"> en {{ categoria.nombre }}</span></a
        >
      } @else {
        <span class="text-body-secondary">Sin productos</span>
      }
    </ng-template>

    <ng-template #acciones let-categoria let-motivo="motivo">
      <button
        type="button"
        class="btn btn-soft btn-icon btn-sm"
        [attr.aria-label]="'Editar ' + categoria.nombre"
        [ngbTooltip]="'Editar ' + categoria.nombre"
        container="body"
        [openDelay]="300"
        (click)="editar(categoria, null)"
      >
        <fa-icon [icon]="iconos.faPen" />
      </button>
      <button
        type="button"
        class="btn btn-soft btn-icon btn-sm"
        [class.text-danger]="!motivo"
        [attr.aria-disabled]="motivo ? 'true' : null"
        [attr.aria-label]="motivo?.texto ?? 'Eliminar ' + categoria.nombre"
        [ngbTooltip]="motivo?.texto ?? 'Eliminar ' + categoria.nombre"
        container="body"
        [openDelay]="300"
        (click)="eliminar(categoria, motivo)"
      >
        <fa-icon [icon]="iconos.faTrashCan" />
      </button>
    </ng-template>
  `,
})
export class Categorias {
  private readonly repo = inject(CategoriasRepository);
  private readonly productosRepo = inject(ProductosRepository);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);

  protected readonly iconos = { faPen, faPlus, faSitemap, faTrashCan };
  protected readonly rutaProductos = RUTA_PRODUCTOS;
  protected readonly textoProductos = textoProductos;

  protected readonly arbol = resource({
    loader: async (): Promise<NodoPrincipal[]> => {
      const [categorias, productos] = await Promise.all([this.repo.listar(), this.productosRepo.listar()]);
      const contar = (c: Categoria) => productos.filter((p) => p.idCategoria === c.idCategoria).length;
      return categorias
        .filter((c) => c.idCategoriaPrincipal === null)
        .map((categoria) => {
          const hijas = categorias
            .filter((c) => c.idCategoriaPrincipal === categoria.idCategoria)
            .map((hija) => ({ categoria: hija, productos: contar(hija) }));
          const propios = contar(categoria);
          return { categoria, hijas, propios, productos: propios + hijas.reduce((s, h) => s + h.productos, 0) };
        });
    },
  });

  /** El repositorio no deja borrar una categoría con subcategorías o productos; se avisa antes de intentarlo. */
  protected motivoPrincipal(nodo: NodoPrincipal): Motivo | null {
    const { nombre } = nodo.categoria;
    if (nodo.hijas.length) {
      const cuantas = nodo.hijas.length === 1 ? '1 subcategoría' : `${nodo.hijas.length} subcategorías`;
      return {
        texto: `No se puede eliminar ${nombre}: tiene ${cuantas}`,
        solucion: 'Primero elimina sus subcategorías o muévelas a otra principal.',
      };
    }
    return nodo.propios > 0 ? this.motivoProductos(nombre, nodo.propios) : null;
  }

  protected motivoHija(hija: NodoHija): Motivo | null {
    return hija.productos > 0 ? this.motivoProductos(hija.categoria.nombre, hija.productos) : null;
  }

  private motivoProductos(nombre: string, productos: number): Motivo {
    return {
      texto: `No se puede eliminar ${nombre}: la usan ${textoProductos(productos)}`,
      solucion: 'Primero cambia esos productos a otra categoría.',
    };
  }

  /** `categoria` = la que se edita; `padre` = la principal bajo la que se crea una subcategoría. */
  protected async editar(categoria: Categoria | null, padre: Categoria | null): Promise<void> {
    const nodos = this.arbol.hasValue() ? this.arbol.value() : [];
    const principales = nodos.map((n) => n.categoria).filter((c) => c.idCategoria !== categoria?.idCategoria);
    const idPadre = categoria ? categoria.idCategoriaPrincipal : (padre?.idCategoria ?? null);
    // Solo hay dos niveles: una principal con subcategorías no puede colgar de otra.
    const tieneHijas = !!categoria && nodos.some((n) => n.categoria.idCategoria === categoria.idCategoria && n.hijas.length > 0);
    const guardada = await abrirFormulario(this.modal, {
      titulo: categoria ? 'Editar categoría' : padre ? `Nueva subcategoría de ${padre.nombre}` : 'Nueva categoría principal',
      textoGuardar: categoria ? 'Guardar cambios' : 'Crear categoría',
      campos: [
        { clave: 'nombre', etiqueta: 'Nombre', requerido: true },
        { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', requerido: true },
        ...(tieneHijas
          ? []
          : [
              {
                clave: 'idCategoriaPrincipal',
                etiqueta: 'Categoría principal',
                tipo: 'select' as const,
                placeholder: 'Ninguna (es una categoría principal)',
                opciones: principales.map((c) => ({ valor: String(c.idCategoria), texto: c.nombre })),
                ayuda: 'Déjala en "Ninguna" para que sea una categoría principal.',
              },
            ]),
      ],
      valores: {
        nombre: categoria?.nombre ?? '',
        descripcion: categoria?.descripcion ?? '',
        ...(tieneHijas ? {} : { idCategoriaPrincipal: idPadre === null ? '' : String(idPadre) }),
      },
      guardar: (v) =>
        this.repo.guardar({
          idCategoria: categoria?.idCategoria ?? 0,
          nombre: v['nombre'],
          descripcion: v['descripcion'],
          idCategoriaPrincipal: v['idCategoriaPrincipal'] ? Number(v['idCategoriaPrincipal']) : null,
        }),
    });
    if (guardada) {
      this.avisos.exito(categoria ? 'Cambios guardados.' : `Categoría ${guardada.nombre} creada.`);
      this.arbol.reload();
    }
  }

  protected async eliminar(categoria: Categoria, motivo: Motivo | null): Promise<void> {
    if (motivo) {
      // En pantallas táctiles el tooltip no aparece: el toque explica por qué no se puede.
      this.avisos.error(`${motivo.texto}. ${motivo.solucion}`);
      return;
    }
    const confirmado = await this.confirmar.preguntar({
      titulo: 'Eliminar categoría',
      mensaje: `Se eliminará ${categoria.nombre}. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar categoría',
      peligro: true,
    });
    if (!confirmado) return;
    try {
      await this.repo.eliminar(categoria.idCategoria);
      this.avisos.exito('Categoría eliminada.');
      this.arbol.reload();
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
    }
  }
}
