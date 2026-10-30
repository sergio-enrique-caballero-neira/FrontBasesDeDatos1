import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCartShopping, faPen, faTrashCan, faUserPlus, faUsers } from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { Cliente, esConsumidorFinal, nombreCliente, TipoCliente } from '../../core/models';
import { Session } from '../../core/session';
import { ClientesRepository } from '../../data/personas.repository';
import { normalizar } from '../../data/reglas';
import { VentasRepository } from '../../data/ventas.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoTabla } from '../../shared/esqueleto';
import { CampoBusqueda } from '../../shared/filtros';
import { FechaPipe } from '../../shared/formato';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { paginar, PieTabla } from '../../shared/tabla/pie-tabla';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';
import { abrirDialogoCliente } from './cliente-dialogo';

type ColumnaCliente = 'cliente' | 'compras' | 'ultima';

interface FilaCliente {
  cliente: Cliente;
  nombre: string;
  compras: number;
  ultimaCompra: string | null;
}

const TIPOS: { valor: TipoCliente | null; texto: string }[] = [
  { valor: null, texto: 'Todos' },
  { valor: 'NATURAL', texto: 'Naturales' },
  { valor: 'JURIDICO', texto: 'Jurídicos' },
];

@Component({
  selector: 'app-clientes',
  imports: [
    RouterLink,
    FaIconComponent,
    NgbTooltip,
    PageHeader,
    ErrorCarga,
    Vacio,
    EsqueletoTabla,
    CampoBusqueda,
    EncabezadoOrden,
    PieTabla,
    FechaPipe,
  ],
  styles: `
    .btn[aria-disabled='true'] {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .fila-sistema {
      --bs-table-bg: var(--soft-bg);
    }
  `,
  templateUrl: './clientes.html',
})
export class Clientes {
  private readonly session = inject(Session);
  private readonly repo = inject(ClientesRepository);
  private readonly ventasRepo = inject(VentasRepository);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);

  protected readonly iconos = { faCartShopping, faPen, faTrashCan, faUserPlus, faUsers };
  protected readonly tipos = TIPOS;
  protected readonly esAdmin = this.session.esAdmin;
  protected readonly esVendedor = this.session.esVendedor;
  protected readonly busqueda = signal('');
  protected readonly tipo = signal<TipoCliente | null>(null);
  protected readonly orden = new Orden<ColumnaCliente>();

  protected readonly clientes = resource({
    loader: async () => {
      const [clientes, ventas] = await Promise.all([this.repo.listar(), this.ventasRepo.listar({ idSucursal: null })]);
      const porCliente = new Map<number, { compras: number; ultima: string }>();
      for (const venta of ventas) {
        const actual = porCliente.get(venta.idCliente);
        if (actual) {
          actual.compras++;
        } else {
          porCliente.set(venta.idCliente, { compras: 1, ultima: venta.fecha });
        }
      }
      const filas = clientes.map<FilaCliente>((cliente) => {
        const resumen = porCliente.get(cliente.idCliente);
        return {
          cliente,
          nombre: nombreCliente(cliente),
          compras: resumen?.compras ?? 0,
          ultimaCompra: resumen?.ultima ?? null,
        };
      });
      return {
        consumidorFinal: filas.find((f) => esConsumidorFinal(f.cliente)) ?? null,
        registrados: filas.filter((f) => !esConsumidorFinal(f.cliente)),
      };
    },
  });

  protected readonly filtrosActivos = computed(() => (this.busqueda().trim() ? 1 : 0) + (this.tipo() !== null ? 1 : 0));

  private readonly coincide = computed(() => {
    const texto = normalizar(this.busqueda());
    const digitos = texto.replace(/\D/g, '');
    const tipo = this.tipo();
    return ({ cliente, nombre }: FilaCliente) =>
      (tipo === null || cliente.tipo === tipo) &&
      (!texto ||
        normalizar(nombre).includes(texto) ||
        normalizar(cliente.numeroDocumento).includes(texto) ||
        (digitos.length >= 3 && cliente.telefonos.some((t) => t.replace(/\D/g, '').includes(digitos))) ||
        cliente.correos.some((c) => normalizar(c).includes(texto)));
  });

  protected readonly consumidorFinal = computed(() => {
    const fila = this.clientes.value()?.consumidorFinal;
    return fila && this.coincide()(fila) ? fila : null;
  });

  protected readonly filtrados = computed(() => {
    const coincide = this.coincide();
    const filas = (this.clientes.value()?.registrados ?? []).filter(coincide);
    return this.orden.aplicar(filas, {
      cliente: (f) => f.nombre,
      compras: (f) => f.compras,
      ultima: (f) => f.ultimaCompra,
    });
  });

  protected readonly pagina = linkedSignal({
    source: () => {
      const orden = this.orden.estado();
      return [this.busqueda(), this.tipo(), orden?.columna, orden?.direccion, this.filtrados().length].join('|');
    },
    computation: () => 1,
  });
  protected readonly porPagina = signal(15);
  protected readonly visibles = computed(() => paginar(this.filtrados(), this.pagina(), this.porPagina()));

  protected readonly anuncio = computed(() => {
    if (!this.clientes.hasValue() || this.filtrosActivos() === 0) {
      return '';
    }
    const total = this.filtrados().length;
    if (total === 0) {
      return this.consumidorFinal()
        ? 'Solo coincide el consumidor final.'
        : 'Ningún cliente coincide con los filtros.';
    }
    return total === 1 ? 'Un cliente coincide con los filtros.' : `${total} clientes coinciden con los filtros.`;
  });

  protected quitarFiltros(): void {
    this.busqueda.set('');
    this.tipo.set(null);
  }

  protected documento(cliente: Cliente): string {
    return `${cliente.tipo === 'NATURAL' ? 'C.C.' : 'NIT'} ${cliente.numeroDocumento}`;
  }

  protected etiquetaCompras(fila: FilaCliente): string {
    return fila.compras === 1 ? `Ver la compra de ${fila.nombre}` : `Ver las ${fila.compras} compras de ${fila.nombre}`;
  }

  protected motivoSinEliminar(fila: FilaCliente): string {
    return `No se puede eliminar: tiene ${fila.compras} ${fila.compras === 1 ? 'compra registrada' : 'compras registradas'}.`;
  }

  protected async editar(cliente: Cliente | null): Promise<void> {
    const guardado = await abrirDialogoCliente(this.modal, cliente);
    if (guardado) {
      this.avisos.exito(
        cliente ? `Datos de ${nombreCliente(guardado)} guardados.` : `Cliente ${nombreCliente(guardado)} creado.`,
      );
      this.clientes.reload();
    }
  }

  protected async crearDesdeBusqueda(): Promise<void> {
    const guardado = await abrirDialogoCliente(this.modal, null, this.busqueda());
    if (guardado) {
      this.avisos.exito(`Cliente ${nombreCliente(guardado)} creado.`);
      this.busqueda.set(guardado.numeroDocumento);
      this.tipo.set(null);
      this.clientes.reload();
    }
  }

  protected async eliminar(fila: FilaCliente): Promise<void> {
    if (fila.compras > 0) {
      return;
    }
    const eliminado = await this.confirmar.eliminar({
      titulo: 'Eliminar cliente',
      mensaje: `Se eliminará a ${fila.nombre} con sus teléfonos y correos. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar cliente',
      accion: (clave) => this.repo.eliminar(fila.cliente.idCliente, clave),
    });
    if (!eliminado) {
      return;
    }
    this.avisos.exito(`${fila.nombre} eliminado de los clientes.`);
    this.clientes.reload();
  }
}
