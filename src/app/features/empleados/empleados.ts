import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faFileArrowDown,
  faIdBadge,
  faPen,
  faPrint,
  faReceipt,
  faTrashCan,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { fechaISO, hoyISO } from '../../core/fechas';
import { COMISION_VENDEDOR, Empleado, nombreEmpleado, Rol } from '../../core/models';
import { Session } from '../../core/session';
import { ComisionVendedor, EstadisticasRepository } from '../../data/estadisticas.repository';
import { EmpleadosRepository } from '../../data/empleados.repository';
import { normalizar } from '../../data/reglas';
import { VentasRepository } from '../../data/ventas.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoTabla } from '../../shared/esqueleto';
import { CampoBusqueda } from '../../shared/filtros';
import { fechaCorta, numero, pesos, PesosPipe } from '../../shared/formato';
import { BarraCelda } from '../../shared/graficos/barra-celda';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { descargarCsv } from '../../shared/tabla/exportar-csv';
import { paginar, PieTabla } from '../../shared/tabla/pie-tabla';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';
import { abrirDialogoEmpleado } from './empleado-dialogo';

interface Periodo {
  desde: string;
  hasta: string;
}

type ModoPeriodo = 'mes' | 'anterior' | 'rango';
type ColumnaComision = 'nombre' | 'cantidad' | 'total' | 'ticket' | 'tasa' | 'comision';

interface FilaComision extends ComisionVendedor {
  documento: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const NIVELES: Record<number, string> = { 1: 'Mostrador y productos', 2: 'Más proveedores', 3: 'Todo' };
const formatoMes = new Intl.DateTimeFormat('es-CO', { month: 'long' });
const formatoMesCorto = new Intl.DateTimeFormat('es-CO', { month: 'short' });

function desdeISO(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function esteMes(): Periodo {
  const hoy = new Date();
  return { desde: fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fechaISO(hoy) };
}

function mesAnterior(): Periodo {
  const hoy = new Date();
  return {
    desde: fechaISO(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
    hasta: fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
  };
}

function iguales(a: Periodo, b: Periodo): boolean {
  return a.desde === b.desde && a.hasta === b.hasta;
}

function modoDe(periodo: Periodo): ModoPeriodo {
  if (iguales(periodo, esteMes())) return 'mes';
  if (iguales(periodo, mesAnterior())) return 'anterior';
  return 'rango';
}

function textoPeriodo({ desde, hasta }: Periodo): string {
  const a = desdeISO(desde);
  const b = desdeISO(hasta);
  const fin = `${b.getDate()} de ${formatoMes.format(b)} de ${b.getFullYear()}`;
  if (desde === hasta) return fin;
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.getDate()} de ${formatoMes.format(a)} de ${a.getFullYear()} al ${fin}`;
  }
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} de ${formatoMes.format(a)} al ${fin}`;
  return `${a.getDate()} al ${fin}`;
}

function periodoEnFrase(periodo: Periodo): string {
  return `${periodo.desde === periodo.hasta ? 'el' : 'del'} ${textoPeriodo(periodo)}`;
}

function mesCorto(fecha: Date): string {
  return formatoMesCorto.format(fecha).replace('.', '');
}

function porcentaje(tasa: number): string {
  return `${numero(tasa * 100)} %`;
}

@Component({
  selector: 'app-empleados',
  imports: [
    FaIconComponent,
    RouterLink,
    NgbTooltip,
    PageHeader,
    ErrorCarga,
    Vacio,
    EsqueletoTabla,
    CampoBusqueda,
    BarraCelda,
    EncabezadoOrden,
    PieTabla,
    PesosPipe,
  ],
  templateUrl: './empleados.html',
})
export class Empleados {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly repo = inject(EmpleadosRepository);
  private readonly estadisticas = inject(EstadisticasRepository);
  private readonly ventasRepo = inject(VentasRepository);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);

  readonly desde = input<string>();
  readonly hasta = input<string>();

  protected readonly iconos = { faFileArrowDown, faIdBadge, faPen, faPrint, faReceipt, faTrashCan, faUserPlus };
  protected readonly nombre = nombreEmpleado;
  protected readonly pesos = pesos;
  protected readonly porcentaje = porcentaje;
  protected readonly hoy = hoyISO();
  protected readonly idUsuario = computed(() => this.session.usuario()?.idEmpleado);
  protected readonly nombreUsuario = computed(() => {
    const usuario = this.session.usuario();
    return usuario ? nombreEmpleado(usuario) : '';
  });

  protected readonly periodo = computed<Periodo>(() => {
    const desde = this.desde();
    const hasta = this.hasta();
    const validas = desde && hasta && ISO.test(desde) && ISO.test(hasta) && desde <= hasta && hasta <= this.hoy;
    return validas ? { desde, hasta } : esteMes();
  });

  protected readonly modo = linkedSignal<Periodo, ModoPeriodo>({
    source: this.periodo,
    computation: (periodo, anterior) => (anterior?.value === 'rango' ? 'rango' : modoDe(periodo)),
  });

  protected readonly textoPeriodo = computed(() => textoPeriodo(this.periodo()));
  protected readonly frasePeriodo = computed(() => {
    const frase = periodoEnFrase(this.periodo());
    const enCurso = this.periodo().hasta === this.hoy;
    return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}${enCurso ? ', hasta hoy' : ''}`;
  });

  protected readonly opcionesPeriodo = computed(() => {
    const actual = esteMes();
    const anterior = mesAnterior();
    const inicio = desdeISO(actual.desde);
    const hoy = desdeISO(actual.hasta);
    const dias = actual.desde === actual.hasta ? `${hoy.getDate()}` : `${inicio.getDate()} al ${hoy.getDate()}`;
    return [
      { modo: 'mes' as const, texto: 'Este mes', detalle: `${dias} ${mesCorto(hoy)}` },
      { modo: 'anterior' as const, texto: 'Mes anterior', detalle: formatoMes.format(desdeISO(anterior.desde)) },
      { modo: 'rango' as const, texto: 'Rango', detalle: '' },
    ];
  });

  protected readonly comisiones = resource({
    params: () => this.periodo(),
    loader: async ({ params }) => {
      const [filas, empleados] = await Promise.all([
        this.estadisticas.comisiones({ idSucursal: null, desde: params.desde, hasta: params.hasta }),
        this.repo.listar(),
      ]);
      const documento = new Map(empleados.map((e) => [e.idEmpleado, e.documento]));
      const conDocumento: FilaComision[] = filas.map((f) => ({ ...f, documento: documento.get(f.idEmpleado) ?? '' }));
      let registradas: Periodo | null = null;
      if (!filas.some((f) => f.cantidad > 0)) {
        const todas = await this.ventasRepo.listar({ idSucursal: null });
        if (todas.length) {
          const fechas = todas.map((v) => v.fecha).sort();
          registradas = { desde: fechas[0], hasta: fechas[fechas.length - 1] };
        }
      }
      return { filas: conDocumento, registradas };
    },
  });

  protected readonly orden = new Orden<ColumnaComision>();

  protected readonly filasComision = computed(() =>
    this.orden.aplicar<FilaComision>(this.comisiones.value()?.filas ?? [], {
      nombre: (f) => f.nombre,
      cantidad: (f) => f.cantidad,
      total: (f) => f.total,
      ticket: (f) => (f.cantidad ? f.ticketPromedio : null),
      tasa: (f) => f.tasa,
      comision: (f) => f.comision,
    }),
  );

  protected readonly hayVentas = computed(() => (this.comisiones.value()?.filas ?? []).some((f) => f.cantidad > 0));

  protected readonly totales = computed(() => {
    const filas = this.comisiones.value()?.filas ?? [];
    const cantidad = filas.reduce((s, f) => s + f.cantidad, 0);
    const total = filas.reduce((s, f) => s + f.total, 0);
    return {
      cantidad,
      total,
      ticket: cantidad ? total / cantidad : 0,
      comision: filas.reduce((s, f) => s + f.comision, 0),
      maximo: Math.max(0, ...filas.map((f) => f.total)),
      vendedores: filas.filter((f) => f.comision > 0).length,
    };
  });

  protected readonly vacioComisiones = computed(() => {
    const valor = this.comisiones.value();
    if (!valor?.filas.length) {
      return {
        titulo: 'No hay vendedores registrados',
        detalle: 'Las comisiones se calculan sobre las ventas de los empleados con rol de vendedor.',
      };
    }
    const registradas = valor.registradas;
    return {
      titulo: `Ningún vendedor registró ventas ${periodoEnFrase(this.periodo())}`,
      detalle: registradas
        ? `Las ventas registradas van ${periodoEnFrase(registradas)}. Elige un periodo dentro de esas fechas.`
        : 'Todavía no hay ventas registradas en ninguna sucursal.',
    };
  });

  constructor() {
    this.orden.estado.set({ columna: 'total', direccion: 'desc' });
  }

  protected elegirModo(modo: ModoPeriodo): void {
    this.modo.set(modo);
    if (modo === 'mes') this.irAPeriodo(esteMes());
    if (modo === 'anterior') this.irAPeriodo(mesAnterior());
  }

  protected cambiarFecha(campo: keyof Periodo, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    if (!ISO.test(valor)) return;
    const actual = this.periodo();
    let siguiente: Periodo = { ...actual, [campo]: valor > this.hoy ? this.hoy : valor };
    if (siguiente.desde > siguiente.hasta) {
      siguiente = campo === 'desde' ? { ...siguiente, hasta: siguiente.desde } : { ...siguiente, desde: siguiente.hasta };
    }
    this.irAPeriodo(siguiente);
  }

  protected verRegistradas(periodo: Periodo): void {
    this.modo.set('rango');
    this.irAPeriodo(periodo);
  }

  private irAPeriodo(periodo: Periodo): void {
    const porDefecto = iguales(periodo, esteMes());
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: porDefecto ? { desde: null, hasta: null } : periodo,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected imprimir(): void {
    window.print();
  }

  protected exportar(): void {
    const { desde, hasta } = this.periodo();
    descargarCsv<FilaComision>(
      `liquidacion-comisiones-${desde}-a-${hasta}`,
      [
        { titulo: 'Documento', valor: (f) => f.documento },
        { titulo: 'Vendedor', valor: (f) => f.nombre },
        { titulo: 'Sucursales', valor: (f) => f.sucursales.join(', ') },
        { titulo: 'Ventas', valor: (f) => f.cantidad },
        { titulo: 'Total vendido', valor: (f) => Math.round(f.total) },
        { titulo: 'Ticket promedio', valor: (f) => (f.cantidad ? Math.round(f.ticketPromedio) : '') },
        { titulo: 'Tasa (%)', valor: (f) => numero(f.tasa * 100) },
        { titulo: 'Comisión', valor: (f) => Math.round(f.comision) },
      ],
      this.filasComision(),
    );
  }

  protected proporcion(total: number): number {
    const maximo = this.totales().maximo;
    return maximo ? total / maximo : 0;
  }

  protected readonly personal = resource({ loader: () => this.repo.listar() });

  protected readonly busqueda = signal('');
  protected readonly rol = signal<Rol | null>(null);
  protected readonly filtrosActivos = computed(() => (this.busqueda().trim() ? 1 : 0) + (this.rol() !== null ? 1 : 0));

  protected readonly filtrados = computed(() => {
    const texto = normalizar(this.busqueda());
    const rol = this.rol();
    return (this.personal.value() ?? []).filter(
      (e) =>
        (rol === null || e.rol === rol) &&
        (!texto ||
          [nombreEmpleado(e), e.documento, e.correo, e.cargo, ...e.telefonos].some((campo) => normalizar(campo).includes(texto))),
    );
  });

  protected readonly pagina = linkedSignal({ source: () => [this.busqueda(), this.rol()], computation: () => 1 });
  protected readonly porPagina = signal(15);
  protected readonly visibles = computed(() => paginar(this.filtrados(), this.pagina(), this.porPagina()));

  protected detalleRol(empleado: Empleado): string {
    if (empleado.rol === 'ADMINISTRADOR') {
      const nivel = empleado.nivelAcceso ?? 1;
      return `Nivel ${nivel} · ${NIVELES[nivel] ?? 'Sin definir'}`;
    }
    const comision = `Comisión ${porcentaje(empleado.comisionVenta ?? COMISION_VENDEDOR)}`;
    return empleado.nombreSucursal ? `${empleado.nombreSucursal} · ${comision}` : comision;
  }

  protected quitarFiltros(): void {
    this.busqueda.set('');
    this.rol.set(null);
  }

  protected readonly pieImpresion = computed(() => {
    const quien = this.nombreUsuario();
    return `Periodo: ${this.textoPeriodo()}. Generada el ${fechaCorta(this.hoy)}${quien ? ` por ${quien}` : ''}.`;
  });

  protected async editar(empleado: Empleado | null): Promise<void> {
    const guardado = await abrirDialogoEmpleado(this.modal, empleado);
    if (!guardado) return;
    this.avisos.exito(empleado ? 'Cambios guardados.' : `Empleado ${nombreEmpleado(guardado)} creado.`);
    if (guardado.idEmpleado === this.idUsuario()) {
      this.session.usuario.set(guardado);
    }
    this.personal.reload();
    this.comisiones.reload();
  }

  protected async eliminar(empleado: Empleado): Promise<void> {
    const eliminado = await this.confirmar.eliminar({
      titulo: 'Eliminar empleado',
      mensaje: `Se eliminará a ${nombreEmpleado(empleado)} con sus teléfonos. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar empleado',
      accion: (clave) => this.repo.eliminar(empleado.idEmpleado, clave),
    });
    if (!eliminado) return;
    this.avisos.exito('Empleado eliminado.');
    this.personal.reload();
    this.comisiones.reload();
  }
}
