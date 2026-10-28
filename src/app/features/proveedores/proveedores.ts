import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faPen, faPlus, faStar, faTrashCan, faTruck } from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { mensajeDeError } from '../../core/domain-error';
import { Proveedor } from '../../core/models';
import { EvaluacionesRepository, ProveedoresRepository, SuministrosRepository } from '../../data/proveedores.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoTabla } from '../../shared/esqueleto';
import { numero } from '../../shared/formato';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';
import { abrirDialogoProveedor } from './proveedor-dialogo';

@Component({
  selector: 'app-proveedores',
  imports: [RouterLink, FaIconComponent, NgbTooltip, PageHeader, ErrorCarga, Vacio, EsqueletoTabla, EncabezadoOrden],
  template: `
    <div class="page">
      <app-page-header titulo="Proveedores" descripcion="Empresas que abastecen los productos de cada sucursal. Abre uno para ver qué suministra y cómo ha cumplido.">
        <button type="button" class="btn btn-primary" (click)="editar(null)">
          <fa-icon [icon]="iconos.faPlus" />
          Nuevo proveedor
        </button>
      </app-page-header>

      <div class="card">
        @if (proveedores.hasValue()) {
          <div [attr.aria-busy]="proveedores.isLoading()" [class.actualizando]="proveedores.isLoading()">
            @if (proveedores.value().length === 0) {
              <app-vacio
                [icono]="iconos.faTruck"
                titulo="Aún no hay proveedores"
                detalle="Registra un proveedor y luego define qué productos suministra a cada sucursal."
              >
                <button type="button" class="btn btn-primary" (click)="editar(null)">Registrar el primer proveedor</button>
              </app-vacio>
            } @else {
              <div class="table-responsive">
                <table class="table align-middle">
                  <caption class="visually-hidden">Proveedores con su contacto, suministros y calidad promedio</caption>
                  <thead>
                    <tr>
                      <th scope="col" [attr.aria-sort]="orden.ariaSort('proveedor')">
                        <app-encabezado-orden [orden]="orden" columna="proveedor" texto="Proveedor" />
                      </th>
                      <th scope="col" class="col-sec">Contacto</th>
                      <th scope="col" class="col-sec">Dirección</th>
                      <th scope="col" class="text-end col-sec" [attr.aria-sort]="orden.ariaSort('suministros')">
                        <app-encabezado-orden [orden]="orden" columna="suministros" texto="Suministros" />
                      </th>
                      <th scope="col" [attr.aria-sort]="orden.ariaSort('calidad')">
                        <app-encabezado-orden [orden]="orden" columna="calidad" texto="Calidad" />
                      </th>
                      <th scope="col"><span class="visually-hidden">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (fila of ordenados(); track fila.proveedor.nit) {
                      <tr>
                        <td>
                          <a class="d-block fw-medium link-body-emphasis" [routerLink]="['/proveedores', fila.proveedor.nit]">
                            {{ fila.proveedor.nombre }}
                          </a>
                          <span class="small text-body-secondary num">NIT {{ fila.proveedor.nit }}</span>
                          <span class="d-block solo-movil small mt-1">
                            @if (fila.proveedor.telefonos[0]; as telefono) {
                              <a class="num link-body-emphasis" [href]="'tel:' + soloDigitos(telefono)">{{ telefono }}</a>
                            }
                            <span class="d-block text-body-secondary">
                              @if (fila.suministros) {
                                <a class="text-body-secondary" routerLink="/suministros" [queryParams]="{ proveedor: fila.proveedor.nit }">
                                  {{ fila.suministros }} {{ fila.suministros === 1 ? 'suministro' : 'suministros' }}
                                </a>
                              } @else {
                                Sin suministros
                              }
                            </span>
                          </span>
                        </td>
                        <td class="col-sec">
                          @for (telefono of fila.proveedor.telefonos; track telefono) {
                            <a class="d-block num link-body-emphasis" [href]="'tel:' + soloDigitos(telefono)">{{ telefono }}</a>
                          }
                          @for (correo of fila.proveedor.correos; track correo) {
                            <a class="d-block small text-body-secondary" [href]="'mailto:' + correo">{{ correo }}</a>
                          }
                        </td>
                        <td class="col-sec">{{ fila.proveedor.direccion }}</td>
                        <td class="text-end num col-sec">
                          @if (fila.suministros) {
                            <a
                              class="link-body-emphasis"
                              routerLink="/suministros"
                              [queryParams]="{ proveedor: fila.proveedor.nit }"
                              [attr.aria-label]="fila.suministros + ' suministros de ' + fila.proveedor.nombre"
                            >
                              {{ fila.suministros }}
                            </a>
                          } @else {
                            <span class="text-body-secondary">0</span>
                          }
                        </td>
                        <td>
                          @if (fila.evaluaciones) {
                            <a
                              class="d-inline-block link-body-emphasis text-decoration-none"
                              routerLink="/evaluaciones"
                              [queryParams]="{ proveedor: fila.proveedor.nit }"
                              [attr.aria-label]="'Calidad ' + formatoCalificacion(fila.promedio) + ' de 5 en ' + fila.evaluaciones + (fila.evaluaciones === 1 ? ' evaluación' : ' evaluaciones') + '. Ver las evaluaciones de ' + fila.proveedor.nombre"
                            >
                              <span class="text-nowrap">
                                <fa-icon [icon]="iconos.faStar" class="me-1" aria-hidden="true" />
                                <span class="num fw-medium">{{ formatoCalificacion(fila.promedio) }}</span>
                                <span class="text-body-secondary"> de 5</span>
                              </span>
                              <span class="d-block small text-body-secondary">
                                {{ fila.evaluaciones }} {{ fila.evaluaciones === 1 ? 'evaluación' : 'evaluaciones' }}
                              </span>
                            </a>
                          } @else {
                            <span class="text-body-secondary">Sin evaluar</span>
                          }
                        </td>
                        <td class="text-end text-nowrap">
                          <button
                            type="button"
                            class="btn btn-soft btn-icon btn-sm"
                            [attr.aria-label]="'Editar ' + fila.proveedor.nombre"
                            [ngbTooltip]="'Editar ' + fila.proveedor.nombre"
                            container="body"
                            (click)="editar(fila.proveedor)"
                          >
                            <fa-icon [icon]="iconos.faPen" />
                          </button>
                          @if (fila.suministros) {
                            <span
                              class="d-inline-block ms-1"
                              tabindex="0"
                              [ngbTooltip]="'No se puede eliminar: tiene ' + fila.suministros + (fila.suministros === 1 ? ' suministro' : ' suministros')"
                              container="body"
                            >
                              <button
                                type="button"
                                class="btn btn-soft btn-icon btn-sm text-danger"
                                disabled
                                [attr.aria-label]="'Eliminar ' + fila.proveedor.nombre + ' (no disponible: tiene suministros)'"
                              >
                                <fa-icon [icon]="iconos.faTrashCan" />
                              </button>
                            </span>
                          } @else {
                            <button
                              type="button"
                              class="btn btn-soft btn-icon btn-sm ms-1 text-danger"
                              [attr.aria-label]="'Eliminar ' + fila.proveedor.nombre"
                              [ngbTooltip]="'Eliminar ' + fila.proveedor.nombre"
                              container="body"
                              (click)="eliminar(fila.proveedor)"
                            >
                              <fa-icon [icon]="iconos.faTrashCan" />
                            </button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        } @else if (proveedores.error()) {
          <app-error-carga que="La lista de proveedores" [error]="proveedores.error()" (reintentar)="proveedores.reload()" />
        } @else {
          <app-esqueleto-tabla
            texto="Cargando proveedores"
            [columnas]="['texto', 'texto', 'texto', 'numero', 'texto', 'numero']"
            [filas]="4"
          />
        }
      </div>
    </div>
  `,
})
export class Proveedores {
  private readonly repo = inject(ProveedoresRepository);
  private readonly suministrosRepo = inject(SuministrosRepository);
  private readonly evaluacionesRepo = inject(EvaluacionesRepository);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);

  protected readonly iconos = { faPen, faPlus, faStar, faTrashCan, faTruck };

  protected readonly proveedores = resource({
    loader: async () => {
      const [proveedores, suministros, evaluaciones] = await Promise.all([
        this.repo.listar(),
        this.suministrosRepo.listar(),
        this.evaluacionesRepo.listar(),
      ]);
      return proveedores.map((proveedor) => {
        const propias = evaluaciones.filter((e) => e.nit === proveedor.nit);
        return {
          proveedor,
          suministros: suministros.filter((s) => s.nit === proveedor.nit).length,
          evaluaciones: propias.length,
          promedio: propias.length ? propias.reduce((s, e) => s + e.calificacion, 0) / propias.length : 0,
        };
      });
    },
  });

  protected readonly orden = new Orden<'proveedor' | 'suministros' | 'calidad'>();

  protected readonly ordenados = computed(() =>
    this.orden.aplicar(this.proveedores.hasValue() ? this.proveedores.value() : [], {
      proveedor: (f) => f.proveedor.nombre,
      suministros: (f) => f.suministros,
      calidad: (f) => (f.evaluaciones ? f.promedio : null),
    }),
  );

  protected formatoCalificacion(valor: number): string {
    return numero(valor);
  }

  protected soloDigitos(telefono: string): string {
    return telefono.replace(/[^0-9+]/g, '');
  }

  protected async editar(proveedor: Proveedor | null): Promise<void> {
    const guardado = await abrirDialogoProveedor(this.modal, proveedor);
    if (guardado) {
      this.avisos.exito(proveedor ? 'Cambios guardados.' : `Proveedor ${guardado.nombre} registrado.`);
      this.proveedores.reload();
    }
  }

  protected async eliminar(proveedor: Proveedor): Promise<void> {
    const confirmado = await this.confirmar.preguntar({
      titulo: 'Eliminar proveedor',
      mensaje: `Se eliminará ${proveedor.nombre} con sus correos. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar proveedor',
      peligro: true,
    });
    if (!confirmado) return;
    try {
      await this.repo.eliminar(proveedor.nit);
      this.avisos.exito('Proveedor eliminado.');
      this.proveedores.reload();
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
    }
  }
}
