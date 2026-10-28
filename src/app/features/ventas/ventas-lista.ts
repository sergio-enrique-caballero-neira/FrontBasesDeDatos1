import { Component, computed, effect, inject, input, linkedSignal, resource, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCalendarDay, faCartShopping, faFileCsv, faReceipt, faXmark } from '@fortawesome/free-solid-svg-icons';
import { fechaISO, hoyISO, sumarDias } from '../../core/fechas';
import { Venta, nombreCliente, nombreEmpleado } from '../../core/models';
import { Session } from '../../core/session';
import { MetodosPagoRepository, SucursalesRepository } from '../../data/catalogos.repository';
import { EmpleadosRepository } from '../../data/empleados.repository';
import { ClientesRepository } from '../../data/personas.repository';
import { normalizar, porNombre } from '../../data/reglas';
import { VentasRepository } from '../../data/ventas.repository';
import { EsqueletoBloque, EsqueletoTabla } from '../../shared/esqueleto';
import { CampoBusqueda } from '../../shared/filtros';
import { FechaPipe, PesosPipe, diaLargo, diaMes, fechaCorta, pesos, pesosCompactos } from '../../shared/formato';
import { BarraDato, GraficoBarras } from '../../shared/graficos/grafico-barras';
import { GraficoColumnas } from '../../shared/graficos/grafico-columnas';
import { PuntoTiempo } from '../../shared/graficos/grafico-tiempo';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { descargarCsv } from '../../shared/tabla/exportar-csv';
import { PieTabla, paginar } from '../../shared/tabla/pie-tabla';
import { Periodo, SelectorPeriodo, ultimosDias } from '../../shared/tabla/selector-periodo';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';

interface PeriodoVentas {
  desde: string | null;
  hasta: string;
}

type ClavePeriodo = 'todo' | 'hoy' | '7' | '30' | 'mes' | 'dia' | 'rango';

interface FilaVenta {
  venta: Venta;
  cliente: string;
  documento: string;
  vendedor: string;
  metodo: string;
  sucursal: string;
}

type ColumnaOrden = 'fecha' | 'cliente' | 'total';

type ParametrosUrl = Record<
  'desde' | 'hasta' | 'q' | 'metodo' | 'vendedor' | 'cliente' | 'sucursal' | 'dia' | 'pagina' | 'mias',
  string | null
>;

const TODO_EL_HISTORIAL = 'todo';
const ESPERA_BUSQUEDA_MS = 300;
const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;
const FORMA_FACTURA = /^fv-?\d+/;

function aFecha(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, mes - 1, dia);
}

function fechaValida(valor: string | undefined): string | null {
  return valor && FORMATO_ISO.test(valor) && !Number.isNaN(aFecha(valor).getTime()) ? valor : null;
}

function entero(valor: string | undefined): number | null {
  const n = Number(valor);
  return valor && Number.isInteger(n) && n > 0 ? n : null;
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000) + 1;
}

function iguales(a: Periodo, b: PeriodoVentas): boolean {
  return a.desde === b.desde && a.hasta === b.hasta;
}

function clavePeriodo(p: PeriodoVentas): ClavePeriodo {
  if (p.desde === null) return 'todo';
  if (iguales(ultimosDias(1), p)) return 'hoy';
  if (iguales(ultimosDias(7), p)) return '7';
  if (iguales(ultimosDias(30), p)) return '30';
  const hoy = new Date();
  if (p.hasta === fechaISO(hoy) && p.desde === fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1))) return 'mes';
  return p.desde === p.hasta ? 'dia' : 'rango';
}

function rangoTexto(desde: string, hasta: string): string {
  return desde.slice(0, 4) === hasta.slice(0, 4)
    ? `${diaMes(desde)} al ${diaMes(hasta)}`
    : `${fechaCorta(desde)} al ${fechaCorta(hasta)}`;
}

function cantidadVentas(n: number): string {
  return n === 1 ? '1 venta' : `${n} ventas`;
}

class OrdenVentas extends Orden<ColumnaOrden> {
  constructor(private readonly alCambiar: () => void) {
    super();
  }

  override alternar(columna: ColumnaOrden): void {
    super.alternar(columna);
    this.alCambiar();
  }
}

@Component({
  selector: 'app-ventas-lista',
  imports: [
    RouterLink,
    FaIconComponent,
    PageHeader,
    ErrorCarga,
    Vacio,
    EsqueletoTabla,
    EsqueletoBloque,
    CampoBusqueda,
    SelectorPeriodo,
    PieTabla,
    GraficoColumnas,
    GraficoBarras,
    EncabezadoOrden,
    PesosPipe,
    FechaPipe,
  ],
  templateUrl: './ventas-lista.html',
  styleUrl: './ventas-lista.css',
  host: { '(document:keydown.escape)': 'alPulsarEscape($event)' },
})
export class VentasLista {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly ventasRepo = inject(VentasRepository);
  private readonly clientesRepo = inject(ClientesRepository);
  private readonly empleadosRepo = inject(EmpleadosRepository);
  private readonly metodosRepo = inject(MetodosPagoRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);

  readonly desde = input<string>();
  readonly hasta = input<string>();
  readonly q = input<string>();
  readonly metodo = input<string>();
  readonly vendedor = input<string>();
  readonly cliente = input<string>();
  readonly sucursal = input<string>();
  readonly dia = input<string>();
  readonly pagina = input<string>();
  readonly mias = input<string>();

  protected readonly iconos = { faCartShopping, faReceipt, faFileCsv, faXmark, faCalendarDay };
  protected readonly esVendedor = this.session.esVendedor;
  protected readonly esAdmin = this.session.esAdmin;
  protected readonly porTodas = computed(() => this.session.idSucursalFiltro() === null);
  protected readonly pesos = pesos;
  protected readonly pesosCompactos = pesosCompactos;
  protected readonly diaLargo = diaLargo;

  private readonly periodoPorDefecto = computed<PeriodoVentas>(() =>
    this.esVendedor() ? ultimosDias(1) : ultimosDias(30),
  );

  protected readonly periodo = linkedSignal<PeriodoVentas>(() => this.leerPeriodo(this.desde(), this.hasta()));
  protected readonly busqueda = linkedSignal(() => this.q() ?? '');
  protected readonly idMetodo = linkedSignal(() => entero(this.metodo()));
  protected readonly idVendedor = linkedSignal(() => entero(this.vendedor()));
  protected readonly idCliente = linkedSignal(() => entero(this.cliente()));
  protected readonly idSucursal = linkedSignal(() => entero(this.sucursal()));
  protected readonly diaElegido = linkedSignal(() => fechaValida(this.dia()));
  protected readonly paginaElegida = linkedSignal(() => entero(this.pagina()) ?? 1);
  protected readonly soloMias = linkedSignal(() => this.mias() !== 'no');
  protected readonly porPagina = signal(15);
  protected readonly orden = new OrdenVentas(() => this.paginaElegida.set(1));

  protected readonly buscaFactura = computed(() => FORMA_FACTURA.test(normalizar(this.busqueda())));
  protected readonly enTodoElHistorial = computed(() => this.periodo().desde === null);

  private readonly vendedorAplicado = computed(() => (this.esAdmin() ? this.idVendedor() : null));
  private readonly sucursalAplicada = computed(() => (this.esAdmin() && this.porTodas() ? this.idSucursal() : null));
  protected readonly filtraMias = computed(() => this.esVendedor() && this.soloMias());

  protected readonly catalogos = resource({
    loader: async () => {
      const [clientes, empleados, metodos, sucursales] = await Promise.all([
        this.clientesRepo.listar(),
        this.empleadosRepo.listar(),
        this.metodosRepo.listar(),
        this.sucursalesRepo.listar(),
      ]);
      return {
        clientes: new Map(clientes.map((c) => [c.idCliente, c])),
        empleados: new Map(empleados.map((e) => [e.idEmpleado, e])),
        vendedores: empleados.filter((e) => e.rol === 'VENDEDOR').sort(porNombre(nombreEmpleado)),
        metodos: [...metodos].sort((a, b) => a.idMetodoPago - b.idMetodoPago),
        sucursales: [...sucursales].sort(porNombre((s) => s.nombre)),
      };
    },
  });

  protected readonly ventas = resource({
    params: () => {
      const periodo = this.periodo();
      const sinFechas = periodo.desde === null || this.buscaFactura();
      return {
        idSucursal: this.session.idSucursalFiltro() ?? this.sucursalAplicada(),
        idEmpleado: (this.filtraMias() ? this.session.usuario()?.idEmpleado : this.vendedorAplicado()) ?? undefined,
        idCliente: this.idCliente() ?? undefined,
        desde: sinFechas ? undefined : (periodo.desde ?? undefined),
        hasta: sinFechas ? undefined : periodo.hasta,
      };
    },
    loader: ({ params }) => this.ventasRepo.listar(params),
  });

  private readonly cat = computed(() => (this.catalogos.hasValue() ? this.catalogos.value() : undefined));

  private readonly ventasVistas = linkedSignal<Venta[] | undefined, Venta[] | undefined>({
    source: () => (this.ventas.hasValue() ? this.ventas.value() : undefined),
    computation: (actuales, previo) => actuales ?? previo?.value,
  });

  protected readonly errorCarga = computed(() => this.catalogos.error() ?? this.ventas.error());
  protected readonly listo = computed(() => !this.errorCarga() && this.cat() !== undefined && this.ventasVistas() !== undefined);
  protected readonly actualizando = computed(() => this.ventas.isLoading() || this.catalogos.isLoading());
  protected readonly vendedores = computed(() => this.cat()?.vendedores ?? []);
  protected readonly sucursales = computed(() => this.cat()?.sucursales ?? []);
  protected readonly metodos = computed(() => this.cat()?.metodos ?? []);

  private readonly filas = computed<FilaVenta[]>(() => {
    const catalogos = this.cat();
    if (!catalogos) return [];
    const metodos = new Map(catalogos.metodos.map((m) => [m.idMetodoPago, m.tipo]));
    const sucursales = new Map(catalogos.sucursales.map((s) => [s.idSucursal, s.nombre]));
    return (this.ventasVistas() ?? []).map((venta) => {
      const cliente = catalogos.clientes.get(venta.idCliente);
      const vendedor = catalogos.empleados.get(venta.idEmpleado);
      return {
        venta,
        cliente: cliente ? nombreCliente(cliente) : 'Cliente eliminado',
        documento: cliente?.numeroDocumento ?? '',
        vendedor: vendedor ? nombreEmpleado(vendedor) : '',
        metodo: metodos.get(venta.idMetodoPago) ?? '',
        sucursal: sucursales.get(venta.idSucursal) ?? '',
      };
    });
  });

  protected readonly hayVentasEnPeriodo = computed(() => this.filas().length > 0);

  private readonly porBusqueda = computed(() => {
    const texto = normalizar(this.busqueda());
    if (!texto) return this.filas();
    const consecutivo = this.buscaFactura() ? Number(texto.replace(/\D/g, '')) : null;
    return this.filas().filter(
      (f) =>
        normalizar(f.venta.numeroFactura).includes(texto) ||
        (consecutivo !== null && Number(f.venta.numeroFactura.replace(/\D/g, '')) === consecutivo) ||
        normalizar(f.cliente).includes(texto) ||
        normalizar(f.documento).includes(texto),
    );
  });

  protected readonly hayCoincidencias = computed(() => this.porBusqueda().length > 0);

  private readonly diasDelPeriodo = computed<{ desde: string; hasta: string } | null>(() => {
    if (this.buscaFactura()) return null;
    const { desde, hasta } = this.periodo();
    const inicio = desde ?? this.primeraFecha();
    return inicio === null ? null : { desde: inicio, hasta };
  });

  protected readonly mostrarColumnas = computed(() => {
    const dias = this.diasDelPeriodo();
    return dias !== null && dias.desde < dias.hasta;
  });

  protected readonly diaAplicado = computed(() => {
    const dia = this.diaElegido();
    const dias = this.diasDelPeriodo();
    return dia && dias && this.mostrarColumnas() && dia >= dias.desde && dia <= dias.hasta ? dia : null;
  });

  private readonly metodoAplicado = computed(() => {
    const id = this.idMetodo();
    return id !== null && (this.cat()?.metodos ?? []).some((m) => m.idMetodoPago === id) ? id : null;
  });

  protected readonly puntosPorDia = computed<PuntoTiempo[]>(() => {
    const dias = this.diasDelPeriodo();
    if (!dias || !this.mostrarColumnas()) return [];
    const idMetodo = this.metodoAplicado();
    const porDia = new Map<string, { total: number; cantidad: number }>();
    for (const f of this.porBusqueda()) {
      if (idMetodo !== null && f.venta.idMetodoPago !== idMetodo) continue;
      const acumulado = porDia.get(f.venta.fecha) ?? { total: 0, cantidad: 0 };
      acumulado.total += f.venta.montoTotal;
      acumulado.cantidad += 1;
      porDia.set(f.venta.fecha, acumulado);
    }
    const puntos: PuntoTiempo[] = [];
    for (let fecha = aFecha(dias.desde), fin = aFecha(dias.hasta); fecha <= fin; fecha = sumarDias(fecha, 1)) {
      const iso = fechaISO(fecha);
      const dia = porDia.get(iso);
      puntos.push({ fecha: iso, valor: dia?.total ?? 0, detalle: dia ? cantidadVentas(dia.cantidad) : 'Sin ventas' });
    }
    return puntos;
  });

  protected readonly barrasPorMetodo = computed<BarraDato[]>(() => {
    const dia = this.diaAplicado();
    const filas = dia ? this.porBusqueda().filter((f) => f.venta.fecha === dia) : this.porBusqueda();
    return (this.cat()?.metodos ?? []).map((m) => {
      const delMetodo = filas.filter((f) => f.venta.idMetodoPago === m.idMetodoPago);
      return {
        etiqueta: m.tipo,
        valor: delMetodo.reduce((suma, f) => suma + f.venta.montoTotal, 0),
        detalle: cantidadVentas(delMetodo.length),
      };
    });
  });

  protected readonly metodoElegidoTexto = computed(() => {
    const id = this.metodoAplicado();
    return this.cat()?.metodos.find((m) => m.idMetodoPago === id)?.tipo ?? null;
  });

  protected readonly filtradas = computed(() => {
    const idMetodo = this.metodoAplicado();
    const dia = this.diaAplicado();
    return this.porBusqueda().filter(
      (f) => (idMetodo === null || f.venta.idMetodoPago === idMetodo) && (dia === null || f.venta.fecha === dia),
    );
  });

  private readonly ordenadas = computed(() =>
    this.orden.aplicar(this.filtradas(), {
      fecha: (f) => `${f.venta.fecha} ${f.venta.hora}`,
      cliente: (f) => f.cliente,
      total: (f) => f.venta.montoTotal,
    }),
  );

  protected readonly paginaVisible = computed(() =>
    Math.min(this.paginaElegida(), Math.max(1, Math.ceil(this.filtradas().length / this.porPagina()))),
  );

  protected readonly paginaActual = computed(() => paginar(this.ordenadas(), this.paginaVisible(), this.porPagina()));

  protected readonly totalFiltrado = computed(() => this.filtradas().reduce((suma, f) => suma + f.venta.montoTotal, 0));
  protected readonly ticketPromedio = computed(() => {
    const n = this.filtradas().length;
    return n === 0 ? 0 : Math.round(this.totalFiltrado() / n);
  });
  protected readonly textoCantidad = computed(() => cantidadVentas(this.filtradas().length));

  protected readonly clavePeriodo = computed(() => clavePeriodo(this.periodo()));

  protected readonly etiquetaConteo = computed(() => {
    const dia = this.diaAplicado();
    if (dia) return diaLargo(dia);
    if (this.buscaFactura()) return 'todas las fechas';
    const p = this.periodo();
    switch (this.clavePeriodo()) {
      case 'todo':
        return 'todo el historial';
      case 'hoy':
        return 'hoy';
      case '7':
        return 'últimos 7 días';
      case '30':
        return 'últimos 30 días';
      case 'mes':
        return 'este mes';
      case 'dia':
        return diaMes(p.hasta);
      default:
        return rangoTexto(p.desde!, p.hasta);
    }
  });

  protected readonly frasePeriodo = computed(() => {
    const p = this.periodo();
    switch (this.clavePeriodo()) {
      case 'todo':
        return 'en todo el historial';
      case 'hoy':
        return 'hoy';
      case '7':
        return 'en los últimos 7 días';
      case '30':
        return 'en los últimos 30 días';
      case 'mes':
        return 'en lo que va del mes';
      case 'dia':
        return `el ${diaMes(p.hasta)}`;
      default:
        return `del ${rangoTexto(p.desde!, p.hasta)}`;
    }
  });

  protected readonly tituloSinVentas = computed(() => {
    const quien = this.filtraMias() ? 'No registraste ventas' : 'No hay ventas';
    const cuando = this.buscaFactura() ? 'en ninguna fecha' : this.frasePeriodo();
    return `${quien} ${cuando}${this.filtrosDeServidor() > 0 ? ' con estos filtros' : ''}`;
  });

  protected readonly detalleSinVentas = computed(() => {
    if (this.filtrosDeServidor() > 0) {
      return 'El vendedor, la sucursal o el cliente elegidos no tienen ventas aquí. Amplía el periodo o quita esos filtros.';
    }
    if (this.filtraMias()) {
      return 'Aquí aparecen las ventas que registras. Para revisar una venta de un compañero, incluye las suyas.';
    }
    if (this.esAdmin() && !this.porTodas()) {
      return 'Amplía el periodo o elige otra sucursal (o todas) en la barra superior.';
    }
    return this.enTodoElHistorial() ? 'Las ventas aparecen aquí en cuanto se registran.' : 'Amplía el periodo para ver ventas anteriores.';
  });

  protected readonly puedeBuscarEnTodo = computed(
    () => !!this.busqueda().trim() && !this.enTodoElHistorial() && !this.buscaFactura(),
  );

  protected readonly tituloSinCoincidencias = computed(() => {
    const texto = this.busqueda().trim();
    return texto ? `Ninguna venta coincide con «${texto}»` : 'Ninguna venta con estos filtros';
  });

  protected readonly detalleSinCoincidencias = computed(() => {
    if (this.puedeBuscarEnTodo()) {
      return `La búsqueda mira solo ${this.frasePeriodo()}. Si la compra es anterior, búscala en todas las fechas.`;
    }
    if (this.busqueda().trim()) {
      return 'Revisa el número de factura o el documento, o prueba con parte del nombre del cliente.';
    }
    const metodo = this.metodoElegidoTexto()?.toLowerCase();
    const dia = this.diaAplicado();
    if (metodo && dia) return `El ${diaLargo(dia)} no hubo ventas pagadas con ${metodo}. Quita uno de los dos filtros.`;
    if (metodo) return `No hubo ventas pagadas con ${metodo} ${this.frasePeriodo()}. Elige otro medio de pago o amplía el periodo.`;
    return 'Quita alguno de los filtros para ver más ventas.';
  });

  protected readonly puedeAmpliarA30 = computed(() => {
    const p = this.periodo();
    return p.desde !== null && diasEntre(p.desde, p.hasta) < 30;
  });

  protected readonly primeraFecha = computed(() =>
    this.filas().reduce<string | null>((min, f) => (min === null || f.venta.fecha < min ? f.venta.fecha : min), null),
  );

  protected readonly periodoSelector = computed<Periodo>(() => {
    const p = this.periodo();
    if (p.desde !== null) return { desde: p.desde, hasta: p.hasta };
    const primera = this.primeraFecha();
    return { desde: primera && primera < p.hasta ? primera : fechaISO(sumarDias(aFecha(p.hasta), -1)), hasta: p.hasta };
  });

  protected readonly chips = computed(() => {
    const catalogos = this.cat();
    const chips: { clave: 'metodo' | 'vendedor' | 'sucursal' | 'cliente'; texto: string }[] = [];
    const metodo = this.metodoElegidoTexto();
    if (metodo) chips.push({ clave: 'metodo', texto: `Pago: ${metodo}` });
    const idVendedor = this.vendedorAplicado();
    if (idVendedor !== null) {
      const empleado = catalogos?.empleados.get(idVendedor);
      chips.push({ clave: 'vendedor', texto: `Vendedor: ${empleado ? nombreEmpleado(empleado) : 'no encontrado'}` });
    }
    const idSucursal = this.sucursalAplicada();
    if (idSucursal !== null) {
      const sucursal = catalogos?.sucursales.find((s) => s.idSucursal === idSucursal);
      chips.push({ clave: 'sucursal', texto: `Sucursal: ${sucursal?.nombre ?? 'no encontrada'}` });
    }
    const idCliente = this.idCliente();
    if (idCliente !== null) {
      const cliente = catalogos?.clientes.get(idCliente);
      chips.push({ clave: 'cliente', texto: `Cliente: ${cliente ? nombreCliente(cliente) : 'no encontrado'}` });
    }
    return chips;
  });

  protected readonly filtrosActivos = computed(
    () => this.chips().length + (this.busqueda().trim() ? 1 : 0) + (this.diaAplicado() ? 1 : 0),
  );

  protected readonly filtrosDeServidor = computed(() => this.chips().filter((c) => c.clave !== 'metodo').length);

  protected readonly mostrarVendedor = computed(() => !this.filtraMias());

  protected readonly anuncio = computed(() => {
    if (!this.listo() || this.actualizando()) return '';
    const n = this.filtradas().length;
    if (n === 0) return 'Ninguna venta con estos filtros.';
    return `${this.textoCantidad()}, ${pesos(this.totalFiltrado())}, ${this.etiquetaConteo()}.`;
  });

  private readonly parametrosDeseados = computed<ParametrosUrl>(() => {
    const p = this.periodo();
    const filtros = {
      q: this.busqueda().trim() ? this.busqueda() : null,
      metodo: this.idMetodo()?.toString() ?? null,
      vendedor: this.idVendedor()?.toString() ?? null,
      cliente: this.idCliente()?.toString() ?? null,
      sucursal: this.idSucursal()?.toString() ?? null,
      dia: this.diaElegido(),
      pagina: this.paginaElegida() > 1 ? String(this.paginaElegida()) : null,
      mias: this.soloMias() ? null : 'no',
    };
    const porDefecto = this.periodoPorDefecto();
    const esPorDefecto = p.desde === porDefecto.desde && p.hasta === porDefecto.hasta;
    const conPeriodo = !esPorDefecto || Object.values(filtros).some((v) => v !== null);
    return {
      ...filtros,
      desde: conPeriodo ? (p.desde ?? TODO_EL_HISTORIAL) : null,
      hasta: conPeriodo && p.desde !== null ? p.hasta : null,
    };
  });

  private readonly parametrosEnUrl = computed<ParametrosUrl>(() => ({
    desde: this.desde() ?? null,
    hasta: this.hasta() ?? null,
    q: this.q() ?? null,
    metodo: this.metodo() ?? null,
    vendedor: this.vendedor() ?? null,
    cliente: this.cliente() ?? null,
    sucursal: this.sucursal() ?? null,
    dia: this.dia() ?? null,
    pagina: this.pagina() ?? null,
    mias: this.mias() ?? null,
  }));

  constructor() {
    effect((alLimpiar) => {
      const deseados = this.parametrosDeseados();
      const actuales = this.parametrosEnUrl();
      const distintos = (Object.keys(deseados) as (keyof ParametrosUrl)[]).filter((k) => deseados[k] !== actuales[k]);
      if (distintos.length === 0) return;
      const navegar = () =>
        void this.router.navigate([], {
          relativeTo: this.ruta,
          queryParams: deseados,
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      if (distintos.every((k) => k === 'q' || k === 'pagina')) {
        const espera = setTimeout(navegar, ESPERA_BUSQUEDA_MS);
        alLimpiar(() => clearTimeout(espera));
      } else {
        untracked(navegar);
      }
    });
  }

  protected abrir(idVenta: number): void {
    void this.router.navigate(['/ventas', idVenta]);
  }

  protected cambiarBusqueda(texto: string): void {
    this.busqueda.set(texto);
    this.paginaElegida.set(1);
  }

  protected elegirPeriodo(periodo: PeriodoVentas): void {
    this.periodo.set({ desde: periodo.desde, hasta: periodo.hasta });
    this.diaElegido.set(null);
    this.paginaElegida.set(1);
  }

  protected verTodoElHistorial(): void {
    this.periodo.set({ desde: null, hasta: hoyISO() });
    this.diaElegido.set(null);
    this.paginaElegida.set(1);
  }

  protected volverAlPeriodoPorDefecto(): void {
    this.elegirPeriodo(this.periodoPorDefecto());
  }

  protected alternarTodoElHistorial(): void {
    if (this.enTodoElHistorial()) this.volverAlPeriodoPorDefecto();
    else this.verTodoElHistorial();
  }

  protected verUltimos30Dias(): void {
    this.elegirPeriodo(ultimosDias(30));
  }

  protected elegirMetodo(idMetodo: number | null): void {
    this.idMetodo.set(idMetodo);
    this.paginaElegida.set(1);
  }

  protected elegirMetodoPorNombre(tipo: string | null): void {
    const metodo = this.cat()?.metodos.find((m) => m.tipo === tipo);
    this.elegirMetodo(metodo?.idMetodoPago ?? null);
  }

  protected elegirDia(dia: string | null): void {
    this.diaElegido.set(dia);
    this.paginaElegida.set(1);
  }

  protected elegirVendedor(evento: Event): void {
    this.idVendedor.set(entero((evento.target as HTMLSelectElement).value));
    this.paginaElegida.set(1);
  }

  protected elegirSucursal(evento: Event): void {
    this.idSucursal.set(entero((evento.target as HTMLSelectElement).value));
    this.paginaElegida.set(1);
  }

  protected elegirMetodoDesdeLista(evento: Event): void {
    this.elegirMetodo(entero((evento.target as HTMLSelectElement).value));
  }

  protected elegirSoloMias(valor: boolean): void {
    this.soloMias.set(valor);
    this.paginaElegida.set(1);
  }

  protected incluirCompaneros(): void {
    this.soloMias.set(false);
    this.paginaElegida.set(1);
  }

  protected quitarChip(clave: 'metodo' | 'vendedor' | 'sucursal' | 'cliente'): void {
    if (clave === 'metodo') this.idMetodo.set(null);
    if (clave === 'vendedor') this.idVendedor.set(null);
    if (clave === 'sucursal') this.idSucursal.set(null);
    if (clave === 'cliente') this.idCliente.set(null);
    this.paginaElegida.set(1);
  }

  protected quitarFiltros(): void {
    this.busqueda.set('');
    this.idMetodo.set(null);
    this.idVendedor.set(null);
    this.idSucursal.set(null);
    this.idCliente.set(null);
    this.diaElegido.set(null);
    this.paginaElegida.set(1);
  }

  protected irAPagina(pagina: number): void {
    this.paginaElegida.set(pagina);
  }

  protected reintentar(): void {
    if (this.catalogos.error()) this.catalogos.reload();
    if (this.ventas.error()) this.ventas.reload();
  }

  protected exportar(): void {
    const p = this.periodo();
    const nombre = this.buscaFactura() ? 'ventas_busqueda' : `ventas_${p.desde ?? 'historial'}_${p.hasta}`;
    descargarCsv(
      nombre,
      [
        { titulo: 'Factura', valor: (f: FilaVenta) => f.venta.numeroFactura },
        { titulo: 'Fecha', valor: (f) => f.venta.fecha },
        { titulo: 'Hora', valor: (f) => f.venta.hora },
        { titulo: 'Cliente', valor: (f) => f.cliente },
        { titulo: 'Documento', valor: (f) => f.documento },
        { titulo: 'Sucursal', valor: (f) => f.sucursal },
        { titulo: 'Vendedor', valor: (f) => f.vendedor },
        { titulo: 'Método de pago', valor: (f) => f.metodo },
        { titulo: 'Total', valor: (f) => f.venta.montoTotal },
      ],
      this.ordenadas(),
    );
  }

  protected alPulsarEscape(evento: Event): void {
    if (!this.diaAplicado() || evento.defaultPrevented || document.body.classList.contains('modal-open')) return;
    const objetivo = evento.target;
    if (objetivo instanceof HTMLElement && (objetivo.isContentEditable || objetivo.matches('input, textarea, select'))) return;
    this.elegirDia(null);
  }

  private leerPeriodo(desde: string | undefined, hasta: string | undefined): PeriodoVentas {
    const hoy = hoyISO();
    const hastaValida = fechaValida(hasta);
    const fin = hastaValida && hastaValida <= hoy ? hastaValida : hoy;
    if (desde === TODO_EL_HISTORIAL) return { desde: null, hasta: hoy };
    const inicio = fechaValida(desde);
    if (inicio) return inicio <= fin ? { desde: inicio, hasta: fin } : { desde: fin, hasta: inicio <= hoy ? inicio : hoy };
    const llegaConEntidad = untracked(() => !!(this.cliente() || this.metodo() || this.vendedor()));
    if (!desde && !hasta && llegaConEntidad) return { desde: null, hasta: hoy };
    if (hastaValida) return { desde: fechaISO(sumarDias(aFecha(fin), -29)), hasta: fin };
    return untracked(() => this.periodoPorDefecto());
  }
}
