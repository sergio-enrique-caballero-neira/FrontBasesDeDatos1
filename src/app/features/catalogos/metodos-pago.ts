import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCreditCard, faPen, faPlus, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { mensajeDeError } from '../../core/domain-error';
import { MetodoPago } from '../../core/models';
import { Session } from '../../core/session';
import { MetodosPagoRepository, SucursalesRepository } from '../../data/catalogos.repository';
import { VentasRepository } from '../../data/ventas.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoTabla } from '../../shared/esqueleto';
import { abrirFormulario } from '../../shared/formulario-dialogo';
import { numero } from '../../shared/formato';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';

interface FilaMetodo {
  metodo: MetodoPago;
  /** Ventas de toda la cadena: deciden si se puede eliminar. */
  ventasCadena: number;
  /** Ventas de la sucursal de la barra superior (o de la cadena con "Todas"): lo que muestra /ventas?metodo=ID. */
  ventas: number;
}

function textoVentas(n: number): string {
  return n === 1 ? '1 venta' : `${numero(n)} ventas`;
}

@Component({
  selector: 'app-metodos-pago',
  imports: [FaIconComponent, RouterLink, NgbTooltip, PageHeader, ErrorCarga, Vacio, EsqueletoTabla, EncabezadoOrden],
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
      <app-page-header titulo="Métodos de pago" descripcion="Formas de pago que el vendedor puede elegir al registrar una venta.">
        <button type="button" class="btn btn-primary" (click)="editar(null)">
          <fa-icon [icon]="iconos.faPlus" />
          Nuevo método
        </button>
      </app-page-header>

      <div class="card">
        @if (metodos.hasValue()) {
          @let datos = metodos.value();
          @if (!datos.filas.length) {
            <app-vacio
              [icono]="iconos.faCreditCard"
              titulo="No hay métodos de pago"
              detalle="Sin al menos uno no se pueden registrar ventas. Crea los que acepta la caja, como Efectivo o Tarjeta débito."
            >
              <button type="button" class="btn btn-primary" (click)="editar(null)">Crear método de pago</button>
            </app-vacio>
          } @else {
            <div class="table-responsive" [attr.aria-busy]="metodos.isLoading()" [class.actualizando]="metodos.isLoading()">
              <table class="table align-middle">
                <caption class="visually-hidden">
                  Métodos de pago y cuántas ventas {{ datos.sucursal ? 'de ' + datos.sucursal : 'de toda la cadena' }} se pagaron
                  con cada uno
                </caption>
                <thead>
                  <tr>
                    <th scope="col" [attr.aria-sort]="orden.ariaSort('tipo')">
                      <app-encabezado-orden [orden]="orden" columna="tipo" texto="Método" />
                    </th>
                    <th scope="col" class="text-end" [attr.aria-sort]="orden.ariaSort('ventas')">
                      <app-encabezado-orden [orden]="orden" columna="ventas" [texto]="tituloVentas()" />
                    </th>
                    <th scope="col" class="text-end"><span class="visually-hidden">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (fila of filas(); track fila.metodo.idMetodoPago) {
                    <tr>
                      <td class="fw-medium">{{ fila.metodo.tipo }}</td>
                      <td class="text-end num">
                        @if (fila.ventas > 0) {
                          <a routerLink="/ventas" [queryParams]="{ metodo: fila.metodo.idMetodoPago }"
                            >{{ numero(fila.ventas) }}<span class="visually-hidden">
                              {{ fila.ventas === 1 ? 'venta pagada' : 'ventas pagadas' }} con {{ fila.metodo.tipo }}</span
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
                            [attr.aria-label]="'Editar ' + fila.metodo.tipo"
                            [ngbTooltip]="'Editar ' + fila.metodo.tipo"
                            container="body"
                            [openDelay]="300"
                            (click)="editar(fila.metodo)"
                          >
                            <fa-icon [icon]="iconos.faPen" />
                          </button>
                          @let motivo = motivoNoEliminar(fila);
                          <button
                            type="button"
                            class="btn btn-soft btn-icon btn-sm"
                            [class.text-danger]="!motivo"
                            [attr.aria-disabled]="motivo ? 'true' : null"
                            [attr.aria-label]="motivo ?? 'Eliminar ' + fila.metodo.tipo"
                            [ngbTooltip]="motivo ?? 'Eliminar ' + fila.metodo.tipo"
                            container="body"
                            [openDelay]="300"
                            (click)="eliminar(fila.metodo, motivo)"
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
            @if (datos.sucursal) {
              <p class="card-body pt-0 mb-0 small text-body-secondary">
                Las ventas son de {{ datos.sucursal }}. Elige "Todas las sucursales" en la barra superior para ver las de toda
                la cadena.
              </p>
            }
          }
        } @else if (metodos.error()) {
          <app-error-carga que="La lista de métodos de pago" [error]="metodos.error()" (reintentar)="metodos.reload()" />
        } @else {
          <app-esqueleto-tabla [columnas]="['texto', 'numero', 'numero']" [filas]="5" texto="Cargando métodos de pago" />
        }
      </div>
    </div>
  `,
})
export class MetodosPago {
  private readonly repo = inject(MetodosPagoRepository);
  private readonly ventasRepo = inject(VentasRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly session = inject(Session);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);

  protected readonly iconos = { faCreditCard, faPen, faPlus, faTrashCan };
  protected readonly numero = numero;
  protected readonly orden = new Orden<'tipo' | 'ventas'>();

  protected readonly metodos = resource({
    params: () => ({ idSucursal: this.session.idSucursalFiltro() }),
    loader: async ({ params }): Promise<{ filas: FilaMetodo[]; sucursal: string | null }> => {
      const [metodos, ventas, sucursales] = await Promise.all([
        this.repo.listar(),
        this.ventasRepo.listar({ idSucursal: null }),
        params.idSucursal === null ? Promise.resolve([]) : this.sucursalesRepo.listar(),
      ]);
      const filas = metodos.map((metodo) => {
        const delMetodo = ventas.filter((v) => v.idMetodoPago === metodo.idMetodoPago);
        return {
          metodo,
          ventasCadena: delMetodo.length,
          ventas:
            params.idSucursal === null
              ? delMetodo.length
              : delMetodo.filter((v) => v.idSucursal === params.idSucursal).length,
        };
      });
      const sucursal = sucursales.find((s) => s.idSucursal === params.idSucursal)?.nombre ?? null;
      return { filas, sucursal };
    },
  });

  protected readonly tituloVentas = computed(() => {
    const sucursal = this.metodos.hasValue() ? this.metodos.value().sucursal : null;
    return sucursal ? `Ventas en ${sucursal}` : 'Ventas';
  });

  protected readonly filas = computed(() =>
    this.orden.aplicar(this.metodos.hasValue() ? this.metodos.value().filas : [], {
      tipo: (f) => f.metodo.tipo,
      ventas: (f) => f.ventas,
    }),
  );

  /** El repositorio no deja borrar un método que alguna venta de la cadena usó; se avisa antes de intentarlo. */
  protected motivoNoEliminar(fila: FilaMetodo): string | null {
    if (fila.ventasCadena === 0) {
      return null;
    }
    const donde = fila.ventasCadena === fila.ventas ? '' : ' de la cadena';
    return `No se puede eliminar ${fila.metodo.tipo}: lo usan ${textoVentas(fila.ventasCadena)}${donde}`;
  }

  protected async editar(metodo: MetodoPago | null): Promise<void> {
    const guardado = await abrirFormulario(this.modal, {
      titulo: metodo ? 'Editar método de pago' : 'Nuevo método de pago',
      textoGuardar: metodo ? 'Guardar cambios' : 'Crear método',
      campos: [{ clave: 'tipo', etiqueta: 'Nombre del método', requerido: true, placeholder: 'Por ejemplo: Nequi' }],
      valores: metodo ? { tipo: metodo.tipo } : undefined,
      guardar: (v) => this.repo.guardar({ idMetodoPago: metodo?.idMetodoPago ?? 0, tipo: v['tipo'] }),
    });
    if (guardado) {
      this.avisos.exito(metodo ? 'Cambios guardados.' : `Método ${guardado.tipo} creado.`);
      this.metodos.reload();
    }
  }

  protected async eliminar(metodo: MetodoPago, motivo: string | null): Promise<void> {
    if (motivo) {
      // En pantallas táctiles el tooltip no aparece: el toque explica por qué no se puede.
      this.avisos.error(`${motivo}. Las ventas registradas conservan su método de pago; puedes cambiarle el nombre.`);
      return;
    }
    const confirmado = await this.confirmar.preguntar({
      titulo: 'Eliminar método de pago',
      mensaje: `Se eliminará ${metodo.tipo}. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar método',
      peligro: true,
    });
    if (!confirmado) return;
    try {
      await this.repo.eliminar(metodo.idMetodoPago);
      this.avisos.exito('Método de pago eliminado.');
      this.metodos.reload();
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
    }
  }
}
