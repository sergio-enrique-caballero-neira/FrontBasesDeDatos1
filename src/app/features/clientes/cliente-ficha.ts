import { Component, computed, effect, inject, input, resource } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation, faRotateRight, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NOMBRE_APP } from '../../core/app-info';
import { Avisos } from '../../core/avisos';
import { mensajeDeError, NoEncontrado } from '../../core/domain-error';
import { esConsumidorFinal, nombreCliente } from '../../core/models';
import { Session } from '../../core/session';
import { ClientesRepository } from '../../data/personas.repository';
import { VentasRepository } from '../../data/ventas.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoBloque } from '../../shared/esqueleto';
import { Miga, Migas } from '../../shared/migas';
import { ClienteHistorial } from './cliente-historial';

@Component({
  selector: 'app-cliente-ficha',
  imports: [Migas, ClienteHistorial, FaIconComponent, EsqueletoBloque],
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
              <button type="button" class="btn btn-soft text-danger" (click)="eliminar(d.nombre)">
                <fa-icon [icon]="iconos.faTrashCan" />
                Eliminar cliente
              </button>
            }
          </section>
        }
      } @else if (esAdmin() && datos.error() && !noExiste()) {
        <div class="franja-estado mt-5" role="alert">
          <fa-icon [icon]="iconos.faCircleExclamation" class="mt-1 text-danger" />
          <div class="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
            <p class="me-auto">No se pudo comprobar si el cliente tiene compras. {{ mensajeError() }}</p>
            <button type="button" class="btn btn-soft btn-sm" (click)="datos.reload()">
              <fa-icon [icon]="iconos.faRotateRight" />
              Reintentar
            </button>
          </div>
        </div>
      } @else if (esAdmin() && datos.isLoading()) {
        <app-esqueleto-bloque class="d-block mt-5" texto="Comprobando si el cliente tiene compras" [lineas]="1" />
      }
    </div>
  `,
})
export class ClienteFicha {
  private readonly session = inject(Session);
  private readonly clientesRepo = inject(ClientesRepository);
  private readonly ventasRepo = inject(VentasRepository);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  readonly id = input.required<string>();

  protected readonly idCliente = computed(() => Number(this.id()));
  protected readonly esAdmin = this.session.esAdmin;
  protected readonly iconos = { faCircleExclamation, faRotateRight, faTrashCan };

  protected readonly datos = resource({
    params: () => this.idCliente(),
    loader: async ({ params: idCliente }) => {
      const [cliente, ventas] = await Promise.all([
        this.clientesRepo.obtener(idCliente),
        this.ventasRepo.listar({ idSucursal: null, idCliente }),
      ]);
      return {
        nombre: nombreCliente(cliente),
        consumidorFinal: esConsumidorFinal(cliente),
        compras: ventas.length,
      };
    },
  });

  protected readonly noExiste = computed(() => this.datos.error() instanceof NoEncontrado);
  protected readonly mensajeError = computed(() => mensajeDeError(this.datos.error()));

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

  protected async eliminar(nombre: string): Promise<void> {
    const eliminado = await this.confirmar.eliminar({
      titulo: 'Eliminar cliente',
      mensaje: `Se eliminará a ${nombre} con sus teléfonos y correos. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar cliente',
      accion: (clave) => this.clientesRepo.eliminar(this.idCliente(), clave),
    });
    if (!eliminado) {
      this.datos.reload();
      return;
    }
    this.avisos.exito(`${nombre} eliminado de los clientes.`);
    await this.router.navigate(['/clientes']);
  }
}
