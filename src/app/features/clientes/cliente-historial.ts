import { Component, computed, inject, input, linkedSignal, output, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCartShopping, faCircleInfo, faPen, faReceipt, faUserSlash } from '@fortawesome/free-solid-svg-icons';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { NoEncontrado } from '../../core/domain-error';
import { Cliente, DOCUMENTO_CONSUMIDOR_FINAL, esConsumidorFinal, nombreCliente } from '../../core/models';
import { Session } from '../../core/session';
import { SucursalesRepository } from '../../data/catalogos.repository';
import { ClientesRepository } from '../../data/personas.repository';
import { VentasRepository } from '../../data/ventas.repository';
import { EsqueletoBloque, EsqueletoTabla } from '../../shared/esqueleto';
import { FechaPipe, PesosPipe } from '../../shared/formato';
import { paginar, PieTabla } from '../../shared/tabla/pie-tabla';
import { ErrorCarga, Vacio } from '../../shared/ui';
import { abrirDialogoCliente } from './cliente-dialogo';

@Component({
  selector: 'app-cliente-historial',
  imports: [RouterLink, FaIconComponent, ErrorCarga, Vacio, EsqueletoBloque, EsqueletoTabla, PieTabla, PesosPipe, FechaPipe],
  styles: `
    :host {
      display: block;
    }
    .contacto {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
      gap: 0.75rem 1.5rem;
      margin: 0;
    }
    .contacto dt {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--muted);
    }
    .contacto dd {
      margin: 0.125rem 0 0;
      overflow-wrap: anywhere;
    }
    .titulo-seccion {
      font-size: 1rem;
      font-weight: 600;
      margin: 0;
    }
  `,
  template: `
    @if (historial.hasValue()) {
      @let h = historial.value();
      <div [attr.aria-busy]="historial.isLoading()" [class.actualizando]="historial.isLoading()">
        <header class="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
          <div class="me-auto" style="min-width: 0">
            @if (encabezado() === 'h1') {
              <h1 class="mb-1">{{ h.nombre }}</h1>
            } @else {
              <h2 class="h4 mb-1">{{ h.nombre }}</h2>
            }
          </div>
          @if (mostrarAcciones()) {
            <div class="d-flex flex-wrap gap-2">
              @if (!h.consumidorFinal) {
                <button type="button" class="btn btn-soft" (click)="editar(h.cliente)">
                  <fa-icon [icon]="iconos.faPen" />
                  Editar datos
                </button>
              }
              @if (esVendedor()) {
                <a class="btn btn-accent" routerLink="/ventas/nueva" [queryParams]="{ cliente: h.cliente.idCliente }">
                  <fa-icon [icon]="iconos.faCartShopping" />
                  Nueva venta para este cliente
                </a>
              }
            </div>
          }
        </header>

        @if (h.consumidorFinal) {
          <div class="franja-estado mb-4">
            <fa-icon [icon]="iconos.faCircleInfo" class="mt-1" />
            <p>
              Agrupa las ventas a personas que no dieron sus datos, con el documento
              <span class="num">{{ documentoConsumidorFinal }}</span> que usa la DIAN. Es un registro del sistema:
              no se edita ni se elimina, y sus compras son de muchas personas, no de una sola.
            </p>
          </div>
        } @else {
          <dl class="contacto mb-4">
            <div>
              <dt>{{ h.cliente.tipo === 'NATURAL' ? 'Cédula' : 'NIT' }}</dt>
              <dd class="num">{{ h.cliente.numeroDocumento }}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{{ h.cliente.direccion }}</dd>
            </div>
            <div>
              <dt>{{ h.cliente.telefonos.length === 1 ? 'Teléfono' : 'Teléfonos' }}</dt>
              <dd>
                @for (telefono of h.cliente.telefonos; track telefono) {
                  <a class="d-block num link-body-emphasis" [href]="'tel:' + soloDigitos(telefono)">{{ telefono }}</a>
                }
              </dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>
                @for (correo of h.cliente.correos; track correo) {
                  <a class="d-block link-body-emphasis" [href]="'mailto:' + correo">{{ correo }}</a>
                } @empty {
                  <span class="text-body-secondary">Sin correo registrado</span>
                }
              </dd>
            </div>
          </dl>
        }

        @if (h.compras === 0) {
          <div class="card">
            <app-vacio [icono]="iconos.faReceipt" [titulo]="esVendedor() ? 'Aún no compra en tu sucursal' : 'Aún no tiene compras'" [detalle]="detalleSinCompras()">
              @if (mostrarAcciones() && esVendedor()) {
                <a class="btn btn-accent" routerLink="/ventas/nueva" [queryParams]="{ cliente: h.cliente.idCliente }">
                  Registrarle una venta
                </a>
              }
            </app-vacio>
          </div>
        } @else {
          <section class="card" [attr.aria-labelledby]="id + '-facturas'">
            <div class="card-body pb-2">
              <p class="titulo-seccion" role="heading" [attr.aria-level]="nivelSeccion()" [id]="id + '-facturas'">
                Facturas
              </p>
              <p class="small text-body-secondary mb-0">La más reciente primero, {{ esAdmin() ? 'de todas las sucursales' : 'de tu sucursal' }}.</p>
            </div>
            <div class="table-responsive">
              <table class="table align-middle">
                <thead>
                  <tr>
                    <th scope="col">Factura</th>
                    <th scope="col">Fecha</th>
                    <th scope="col" class="col-sec">Sucursal</th>
                    <th scope="col" class="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (fila of facturasPagina(); track fila.venta.idVenta) {
                    <tr>
                      <td>
                        <a
                          [routerLink]="['/ventas', fila.venta.idVenta]"
                          class="code-tag text-decoration-none"
                          [attr.aria-label]="'Ver factura ' + fila.venta.numeroFactura"
                        >
                          {{ fila.venta.numeroFactura }}
                        </a>
                        <span class="d-block solo-movil small text-body-secondary mt-1">{{ fila.sucursal }}</span>
                      </td>
                      <td class="num">{{ fila.venta.fecha | fecha }}</td>
                      <td class="col-sec">{{ fila.sucursal }}</td>
                      <td class="text-end num">{{ fila.venta.montoTotal | pesos }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <app-pie-tabla [total]="h.facturas.length" nombre="facturas" [(pagina)]="pagina" [(porPagina)]="porPagina" />
          </section>
        }
      </div>
    } @else if (noExiste()) {
      <div class="card">
        <app-vacio [icono]="iconos.faUserSlash" titulo="Este cliente no existe" detalle="Puede que lo hayan eliminado o que el enlace esté mal. Búscalo en la lista de clientes.">
          <a class="btn btn-soft" routerLink="/clientes">Ir a clientes</a>
        </app-vacio>
      </div>
    } @else if (historial.error()) {
      <div class="card">
        <app-error-carga que="El historial del cliente" [error]="historial.error()" (reintentar)="historial.reload()" />
      </div>
    } @else {
      <app-esqueleto-bloque texto="Cargando el historial del cliente" [lineas]="2" class="mb-4" />
      <div class="card">
        <app-esqueleto-tabla texto="Cargando las facturas" [columnas]="['texto', 'texto', 'texto', 'numero']" [filas]="5" />
      </div>
    }
  `,
})
export class ClienteHistorial {
  private static siguiente = 0;

  private readonly session = inject(Session);
  private readonly clientesRepo = inject(ClientesRepository);
  private readonly ventasRepo = inject(VentasRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly modal = inject(NgbModal);
  private readonly avisos = inject(Avisos);

  readonly idCliente = input.required<number>();
  readonly mostrarAcciones = input(true);
  readonly encabezado = input<'h1' | 'h2'>('h2');
  readonly cambio = output<Cliente>();

  protected readonly id = `historial-${++ClienteHistorial.siguiente}`;
  protected readonly iconos = { faCartShopping, faCircleInfo, faPen, faReceipt, faUserSlash };
  protected readonly documentoConsumidorFinal = DOCUMENTO_CONSUMIDOR_FINAL;
  protected readonly esVendedor = this.session.esVendedor;
  protected readonly esAdmin = this.session.esAdmin;
  protected readonly nivelSeccion = computed(() => (this.encabezado() === 'h1' ? 2 : 3));

  protected readonly historial = resource({
    params: () => this.idCliente(),
    loader: async ({ params: idCliente }) => {
      const [cliente, ventas, sucursales] = await Promise.all([
        this.clientesRepo.obtener(idCliente),
        this.ventasRepo.listar({ idSucursal: null, idCliente }),
        this.sucursalesRepo.listar(),
      ]);
      const nombreSucursal = (idSucursal: number) => {
        const sucursal = sucursales.find((s) => s.idSucursal === idSucursal);
        return sucursal ? `${sucursal.nombre} · ${sucursal.ciudad}` : 'Sucursal eliminada';
      };
      return {
        cliente,
        nombre: nombreCliente(cliente),
        consumidorFinal: esConsumidorFinal(cliente),
        compras: ventas.length,
        facturas: ventas.map((venta) => ({ venta, sucursal: nombreSucursal(venta.idSucursal) })),
      };
    },
  });

  protected readonly noExiste = computed(() => this.historial.error() instanceof NoEncontrado);

  protected readonly pagina = linkedSignal({ source: this.idCliente, computation: () => 1 });
  protected readonly porPagina = signal(15);

  protected readonly facturasPagina = computed(() =>
    this.historial.hasValue() ? paginar(this.historial.value().facturas, this.pagina(), this.porPagina()) : [],
  );

  protected readonly detalleSinCompras = computed(() =>
    this.esVendedor()
      ? 'Aquí ves solo las facturas de tu sucursal. Cuando le registres una venta, aparecerá en esta lista.'
      : 'Sus facturas aparecerán aquí cuando un vendedor le registre una venta.',
  );

  protected soloDigitos(telefono: string): string {
    return telefono.replace(/[^0-9+]/g, '');
  }

  protected async editar(cliente: Cliente): Promise<void> {
    const guardado = await abrirDialogoCliente(this.modal, cliente);
    if (guardado) {
      this.avisos.exito(`Datos de ${nombreCliente(guardado)} guardados.`);
      this.historial.reload();
      this.cambio.emit(guardado);
    }
  }
}
