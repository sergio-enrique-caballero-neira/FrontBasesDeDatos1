import { Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation, faRotateRight, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NOMBRE_APP } from '../../core/app-info';
import { Avisos } from '../../core/avisos';
import { mensajeDeError, NoEncontrado } from '../../core/domain-error';
import { esConsumidorFinal, nombreCliente, Venta } from '../../core/models';
import { Session } from '../../core/session';
import { MetodosPagoRepository, SucursalesRepository } from '../../data/catalogos.repository';
import { ClientesRepository } from '../../data/personas.repository';
import { VentasRepository } from '../../data/ventas.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoBloque } from '../../shared/esqueleto';
import { FechaPipe, PesosPipe } from '../../shared/formato';
import { Miga, Migas } from '../../shared/migas';
import { ClienteHistorial } from './cliente-historial';

interface Frecuente {
  nombres: string[];
  veces: number;
}

function masFrecuente(ventas: Venta[], clave: (v: Venta) => number, nombre: (id: number) => string): Frecuente {
  const conteo = new Map<number, number>();
  for (const venta of ventas) {
    conteo.set(clave(venta), (conteo.get(clave(venta)) ?? 0) + 1);
  }
  const veces = Math.max(0, ...conteo.values());
  const nombres = [...conteo.entries()]
    .filter(([, n]) => n === veces)
    .map(([id]) => nombre(id))
    .sort((a, b) => a.localeCompare(b, 'es'));
  return { nombres, veces };
}

function enumerar(nombres: string[]): string {
  return nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}

@Component({
  selector: 'app-cliente-ficha',
  imports: [Migas, ClienteHistorial, FaIconComponent, EsqueletoBloque, PesosPipe, FechaPipe],
  styles: `
    .eliminar {
      max-width: 40rem;
      border-top: 1px solid var(--hairline);
    }
  `,
  template: `
    <div class="page">
      <app-migas [items]="migas()" />
      <app-cliente-historial [idCliente]="idCliente()" encabezado="h1" (cambio)="datos.reload()" />

      @if (datos.hasValue()) {
        @let d = datos.value();
        @if (!d.consumidorFinal && d.compras > 0) {
          <section
            class="mt-5"
            aria-labelledby="ficha-como-compra"
            [attr.aria-busy]="datos.isLoading()"
            [class.actualizando]="datos.isLoading()"
          >
            <h2 class="h5 mb-1" id="ficha-como-compra">Cómo compra</h2>
            <p class="small text-body-secondary mb-3">
              Con sus <span class="num">{{ d.compras }}</span> {{ d.compras === 1 ? 'compra' : 'compras' }} en toda
              la cadena.
            </p>
            <dl class="datos-clave">
              <div>
                <dt>Ticket promedio</dt>
                <dd>
                  {{ d.total / d.compras | pesos }}
                  <small>{{ d.total | pesos }} en total</small>
                </dd>
              </div>
              <div>
                <dt>Primera compra</dt>
                <dd>{{ d.primera | fecha }}</dd>
              </div>
              <div>
                <dt>Compra sobre todo en</dt>
                <dd>
                  {{ enumerar(d.sucursal.nombres) }}
                  <small>{{ textoVeces(d.sucursal, d.compras, 'en cada una') }}</small>
                </dd>
              </div>
              <div>
                <dt>Paga sobre todo con</dt>
                <dd>
                  {{ enumerar(d.metodo.nombres) }}
                  <small>{{ textoVeces(d.metodo, d.compras, 'con cada uno') }}</small>
                </dd>
              </div>
              @if (enSucursal(); as s) {
                <div>
                  <dt>En {{ s.nombre }}</dt>
                  <dd>
                    @if (s.compras > 0) {
                      {{ s.compras }} {{ s.compras === 1 ? 'compra' : 'compras' }}
                      <small>por {{ s.total | pesos }}, la última el {{ s.ultima | fecha }}</small>
                    } @else {
                      Ninguna
                      <small>todas sus compras fueron en otras sucursales</small>
                    }
                  </dd>
                </div>
              }
            </dl>
          </section>
        }

        @if (esAdmin() && !d.consumidorFinal) {
          <section class="eliminar mt-5 pt-4" aria-labelledby="ficha-eliminar-titulo">
            <h2 class="h6 mb-1" id="ficha-eliminar-titulo">Eliminar cliente</h2>
            @if (d.compras > 0) {
              <p class="text-body-secondary mb-0">
                No se puede eliminar: tiene <span class="num">{{ d.compras }}</span>
                {{ d.compras === 1 ? 'compra registrada' : 'compras registradas' }} y sus facturas deben conservarse.
                Si cambió algún dato, usa Editar datos.
              </p>
            } @else {
              <p class="text-body-secondary mb-3">
                No tiene compras registradas. Se borran sus datos, teléfonos y correos, y no se puede deshacer.
              </p>
              <button type="button" class="btn btn-soft text-danger" [disabled]="eliminando()" (click)="eliminar(d.nombre)">
                @if (eliminando()) {
                  <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                  Eliminando…
                } @else {
                  <fa-icon [icon]="iconos.faTrashCan" />
                  Eliminar cliente
                }
              </button>
            }
          </section>
        }
      } @else if (datos.error() && !noExiste()) {
        <div class="franja-estado mt-5" role="alert">
          <fa-icon [icon]="iconos.faCircleExclamation" class="mt-1 text-danger" />
          <div class="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
            <p class="me-auto">No se pudo cargar cómo compra este cliente. {{ mensajeError() }}</p>
            <button type="button" class="btn btn-soft btn-sm" (click)="datos.reload()">
              <fa-icon [icon]="iconos.faRotateRight" />
              Reintentar
            </button>
          </div>
        </div>
      } @else if (datos.isLoading()) {
        <app-esqueleto-bloque class="d-block mt-5" texto="Cargando cómo compra el cliente" [lineas]="2" />
      }
    </div>
  `,
})
export class ClienteFicha {
  private readonly session = inject(Session);
  private readonly clientesRepo = inject(ClientesRepository);
  private readonly ventasRepo = inject(VentasRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly metodosRepo = inject(MetodosPagoRepository);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  readonly id = input.required<string>();

  protected readonly idCliente = computed(() => Number(this.id()));
  protected readonly esAdmin = this.session.esAdmin;
  protected readonly iconos = { faCircleExclamation, faRotateRight, faTrashCan };
  protected readonly eliminando = signal(false);
  protected readonly enumerar = enumerar;

  protected readonly datos = resource({
    params: () => this.idCliente(),
    loader: async ({ params: idCliente }) => {
      const [cliente, ventas, sucursales, metodos] = await Promise.all([
        this.clientesRepo.obtener(idCliente),
        this.ventasRepo.listar({ idSucursal: null, idCliente }),
        this.sucursalesRepo.listar(),
        this.metodosRepo.listar(),
      ]);
      const nombreSucursal = (id: number) => sucursales.find((s) => s.idSucursal === id)?.nombre ?? 'Sucursal eliminada';
      const nombreMetodo = (id: number) => metodos.find((m) => m.idMetodoPago === id)?.tipo ?? 'Método eliminado';
      const fechas = ventas.map((v) => v.fecha).sort();
      return {
        nombre: nombreCliente(cliente),
        consumidorFinal: esConsumidorFinal(cliente),
        ventas,
        compras: ventas.length,
        total: ventas.reduce((suma, v) => suma + v.montoTotal, 0),
        primera: fechas[0] ?? '',
        sucursal: masFrecuente(ventas, (v) => v.idSucursal, nombreSucursal),
        metodo: masFrecuente(ventas, (v) => v.idMetodoPago, nombreMetodo),
        nombreSucursal,
      };
    },
  });

  protected readonly noExiste = computed(() => this.datos.error() instanceof NoEncontrado);
  protected readonly mensajeError = computed(() => mensajeDeError(this.datos.error()));

  protected readonly enSucursal = computed(() => {
    const idSucursal = this.session.idSucursalFiltro();
    if (idSucursal === null || !this.datos.hasValue()) {
      return null;
    }
    const d = this.datos.value();
    const aqui = d.ventas.filter((v) => v.idSucursal === idSucursal);
    if (aqui.length === d.compras) {
      return null;
    }
    return {
      nombre: d.nombreSucursal(idSucursal),
      compras: aqui.length,
      total: aqui.reduce((suma, v) => suma + v.montoTotal, 0),
      ultima: aqui.map((v) => v.fecha).sort().at(-1) ?? '',
    };
  });

  protected readonly migas = computed<Miga[]>(() => [
    { texto: 'Clientes', enlace: '/clientes' },
    { texto: this.datos.hasValue() ? this.datos.value().nombre : this.noExiste() ? 'Cliente no encontrado' : 'Cliente' },
  ]);

  constructor() {
    effect(() => {
      if (this.datos.hasValue()) {
        this.title.setTitle(`${this.datos.value().nombre} · Clientes · ${NOMBRE_APP}`);
      } else if (this.noExiste()) {
        this.title.setTitle(`Cliente no encontrado · Clientes · ${NOMBRE_APP}`);
      }
    });
  }

  protected textoVeces(frecuente: Frecuente, compras: number, empate: string): string {
    if (frecuente.veces === compras) {
      return compras === 1 ? 'su única compra' : 'todas sus compras';
    }
    if (frecuente.nombres.length > 1) {
      return `${frecuente.veces} ${frecuente.veces === 1 ? 'compra' : 'compras'} ${empate}`;
    }
    return `${frecuente.veces} de ${compras} compras`;
  }

  protected async eliminar(nombre: string): Promise<void> {
    const confirmado = await this.confirmar.preguntar({
      titulo: 'Eliminar cliente',
      mensaje: `Se eliminará a ${nombre} con sus teléfonos y correos. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar cliente',
      peligro: true,
    });
    if (!confirmado) {
      return;
    }
    this.eliminando.set(true);
    try {
      await this.clientesRepo.eliminar(this.idCliente());
      this.avisos.exito(`${nombre} eliminado de los clientes.`);
      await this.router.navigate(['/clientes']);
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
      this.datos.reload();
    } finally {
      this.eliminando.set(false);
    }
  }
}
