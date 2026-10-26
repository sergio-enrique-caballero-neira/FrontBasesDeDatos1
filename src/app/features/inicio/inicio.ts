import { afterRenderEffect, Component, computed, ElementRef, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faArrowDown,
  faArrowRight,
  faArrowUp,
  faCartShopping,
  faCircleCheck,
  faReceipt,
  faTriangleExclamation,
  faTruckRampBox,
} from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { fechaISO, hoyISO, sumarDias } from '../../core/fechas';
import {
  COMISION_VENDEDOR,
  DIAS_RITMO_VENTAS,
  Inventario,
  nombreCliente,
  Producto,
  Sucursal,
  Suministro,
  UMBRAL_STOCK_BAJO,
} from '../../core/models';
import { Session } from '../../core/session';
import { VentaEnCurso } from '../../core/venta-en-curso';
import { MetodosPagoRepository, SucursalesRepository } from '../../data/catalogos.repository';
import { EstadisticasRepository, FiltroPeriodo } from '../../data/estadisticas.repository';
import { ClientesRepository } from '../../data/personas.repository';
import { InventarioRepository, ProductosRepository } from '../../data/productos.repository';
import {
  claveSuministro,
  EvaluacionesRepository,
  ProveedoresRepository,
  SuministrosRepository,
} from '../../data/proveedores.repository';
import { VentasRepository } from '../../data/ventas.repository';
import { EsqueletoBloque, EsqueletoTabla } from '../../shared/esqueleto';
import { diaMes, numero, pesos, PesosPipe, pesosCompactos } from '../../shared/formato';
import { Bala } from '../../shared/graficos/bala';
import { BarraDato, GraficoBarras } from '../../shared/graficos/grafico-barras';
import { GraficoColumnas, TramoColumnas } from '../../shared/graficos/grafico-columnas';
import { PuntoTiempo } from '../../shared/graficos/grafico-tiempo';
import { Indicador, Variacion, variacionRelativa } from '../../shared/graficos/indicador';
import { paginar, PieTabla } from '../../shared/tabla/pie-tabla';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';
import { dialogoInventario } from '../inventario/inventario-dialogo';

/** Lo que muestra la columna "Alcanza para" y su veredicto frente a la entrega. */
interface Veredicto {
  /** true si el producto se queda sin unidades antes de que llegue un pedido. */
  alerta: boolean;
  texto: string;
}

interface FilaReabastecer {
  clave: string;
  fila: Inventario;
  producto: Producto;
  sucursal: Sucursal;
  /** Unidades vendidas en esa sucursal en los últimos DIAS_RITMO_VENTAS días. */
  vendidas: number;
  /** Días que alcanzan las unidades al ritmo reciente; null si no hubo ventas. */
  cobertura: number | null;
  /** Días de entrega del proveedor sugerido; null si no hay proveedor. */
  entrega: number | null;
  alcanza: string;
  veredicto: Veredicto | null;
  sugerido: {
    suministro: Suministro;
    proveedor: string;
    /** Promedio de las evaluaciones de ese suministro; null si no se ha evaluado. */
    calidad: number | null;
  } | null;
  /** Proveedores que también surten el producto a esa sucursal, además del sugerido. */
  otrasOpciones: number;
}

/** Panel pequeño de una sucursal en la vista de toda la cadena. */
interface PanelSucursal {
  idSucursal: number;
  nombre: string;
  puntos: PuntoTiempo[];
  total: number;
  cantidad: number;
  /** Cambio frente a los 7 días anteriores; null si entonces no hubo ventas. */
  relativa: number | null;
}

@Component({
  selector: 'app-inicio',
  imports: [
    RouterLink,
    FaIconComponent,
    NgbTooltip,
    PageHeader,
    ErrorCarga,
    Vacio,
    EsqueletoTabla,
    EsqueletoBloque,
    PieTabla,
    Indicador,
    GraficoBarras,
    GraficoColumnas,
    Bala,
    PesosPipe,
  ],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  private readonly session = inject(Session);
  private readonly ventaEnCurso = inject(VentaEnCurso);
  private readonly modal = inject(NgbModal);
  private readonly avisos = inject(Avisos);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ventasRepo = inject(VentasRepository);
  private readonly clientesRepo = inject(ClientesRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly metodosRepo = inject(MetodosPagoRepository);
  private readonly inventarioRepo = inject(InventarioRepository);
  private readonly productosRepo = inject(ProductosRepository);
  private readonly suministrosRepo = inject(SuministrosRepository);
  private readonly proveedoresRepo = inject(ProveedoresRepository);
  private readonly evaluacionesRepo = inject(EvaluacionesRepository);
  private readonly estadisticas = inject(EstadisticasRepository);

  protected readonly iconos = {
    faCartShopping,
    faReceipt,
    faTriangleExclamation,
    faCircleCheck,
    faTruckRampBox,
    faArrowUp,
    faArrowDown,
    faArrowRight,
  };
  protected readonly umbral = UMBRAL_STOCK_BAJO;
  protected readonly diasRitmo = DIAS_RITMO_VENTAS;
  protected readonly usuario = this.session.usuario;
  protected readonly esAdmin = this.session.esAdmin;
  protected readonly hoy = hoyISO();
  protected readonly porTodas = computed(() => this.session.idSucursalFiltro() === null);
  protected readonly hayVentaEnCurso = this.ventaEnCurso.hayVenta;
  protected readonly ventaEnCursoResumen = this.ventaEnCurso.resumen;
  protected readonly pesos = pesos;
  protected readonly pesosCompactos = pesosCompactos;

  // ---------------------------------------------------------------- Vendedor

  /**
   * Vendedor: sus ventas de hoy en la sucursal de trabajo (lo que cuadra la caja)
   * y su comisión del mes en todas las sedes donde vendió.
   */
  protected readonly vendedor = resource({
    params: () => {
      const usuario = this.usuario();
      return this.esAdmin() || !usuario
        ? undefined
        : { idEmpleado: usuario.idEmpleado, idSucursal: this.session.idSucursalFiltro() };
    },
    loader: async ({ params }) => {
      const hoy = this.hoy;
      const mes = tramoDelMes(hoy);
      const delDia: FiltroPeriodo = { ...params, desde: hoy, hasta: hoy };
      const delMes: FiltroPeriodo = { idSucursal: null, idEmpleado: params.idEmpleado, desde: mes.desde, hasta: hoy };
      const mesAnterior: FiltroPeriodo = { ...delMes, desde: mes.anteriorDesde, hasta: mes.anteriorHasta };
      const [ventas, clientes, metodos, sucursales, porMetodo, comisionMes, comisionAnterior, diasMes] = await Promise.all([
        this.ventasRepo.listar(delDia),
        this.clientesRepo.listar(),
        this.metodosRepo.listar(),
        this.sucursalesRepo.listar(),
        this.estadisticas.porMetodoPago(delDia),
        this.estadisticas.comisiones(delMes),
        this.estadisticas.comisiones(mesAnterior),
        this.estadisticas.ventasPorDia(delMes),
      ]);

      const suya = comisionMes.find((c) => c.idEmpleado === params.idEmpleado);
      const anterior = comisionAnterior.find((c) => c.idEmpleado === params.idEmpleado);
      const tasa = suya?.tasa ?? COMISION_VENDEDOR;
      const totalHoy = ventas.reduce((suma, v) => suma + v.montoTotal, 0);
      const cantidadMes = suya?.cantidad ?? 0;
      const sedes = suya?.sucursales ?? [];

      // Solo hay variación si el mismo tramo del mes anterior tuvo ventas.
      const variacionMes: Variacion | null =
        anterior && anterior.cantidad > 0
          ? {
              relativa: variacionRelativa(suya?.comision ?? 0, anterior.comision),
              periodo: `vs. ${tramoMesTexto(mes.anteriorDesde, mes.anteriorHasta)}`,
            }
          : null;

      return {
        sucursal: sucursales.find((s) => s.idSucursal === params.idSucursal)?.nombre ?? null,
        filas: ventas.map((venta) => {
          const cliente = clientes.find((c) => c.idCliente === venta.idCliente);
          return {
            venta,
            cliente: cliente ? nombreCliente(cliente) : 'Cliente eliminado',
            metodo: metodos.find((m) => m.idMetodoPago === venta.idMetodoPago)?.tipo ?? '',
          };
        }),
        hoy: { cantidad: ventas.length, total: totalHoy, comision: totalHoy * tasa },
        tasa,
        // Orden fijo por método (no por monto) para que cada medio esté siempre en su sitio.
        porMetodo: [...porMetodo]
          .sort((a, b) => a.id - b.id)
          .map<BarraDato>((m) => ({
            etiqueta: m.nombre,
            valor: m.total,
            detalle: cuentaVentas(m.cantidad),
            destacado: m.nombre.trim().toLowerCase() === 'efectivo',
          })),
        mes: {
          nombre: nombreMes(hoy),
          comision: suya?.comision ?? 0,
          variacion: variacionMes,
          tendencia: diasMes.map((d) => d.total * tasa),
          ayuda:
            cantidadMes === 0
              ? `Sin ventas desde el ${tramoMesTexto(mes.desde, mes.desde)}`
              : `${cuentaVentas(cantidadMes)} desde el ${tramoMesTexto(mes.desde, mes.desde)}${sedes.length ? ` en ${listaNatural(sedes)}` : ''}`,
        },
      };
    },
  });

  protected readonly descripcionVendedor = computed(() => {
    const sucursal = this.vendedor.hasValue() ? this.vendedor.value().sucursal : null;
    return sucursal ? `Esto es lo que llevas vendido hoy en ${sucursal}.` : 'Esto es lo que llevas vendido hoy.';
  });

  protected readonly paginaVentasHoy = signal(1);
  protected readonly porPaginaVentasHoy = signal(15);
  protected readonly filasVentasHoy = computed(() => {
    const filas = this.vendedor.hasValue() ? this.vendedor.value().filas : [];
    return paginar(filas, this.paginaVentasHoy(), this.porPaginaVentasHoy());
  });

  // ----------------------------------------------------------- Administrador

  /** Administrador: qué reabastecer primero, por cobertura frente al tiempo de entrega. */
  protected readonly reabastecer = resource({
    params: () => (this.esAdmin() ? { idSucursal: this.session.idSucursalFiltro() } : undefined),
    loader: async ({ params }) => {
      const hoy = this.hoy;
      const desde = restarDias(hoy, DIAS_RITMO_VENTAS - 1);
      const [inventario, productos, sucursales, suministros, proveedores, evaluaciones, vendidas] = await Promise.all([
        this.inventarioRepo.listar(params.idSucursal),
        this.productosRepo.listar(),
        this.sucursalesRepo.listar(),
        this.suministrosRepo.listar(),
        this.proveedoresRepo.listar(),
        this.evaluacionesRepo.listar(),
        this.estadisticas.unidadesPorInventario({ idSucursal: params.idSucursal, desde, hasta: hoy }),
      ]);

      // Promedio de calidad por suministro (proveedor + producto + sucursal).
      const notas = new Map<string, number[]>();
      for (const e of evaluaciones) {
        const clave = claveSuministro(e);
        notas.set(clave, [...(notas.get(clave) ?? []), e.calificacion]);
      }
      const calidadDe = (s: Suministro): number | null => {
        const lista = notas.get(claveSuministro(s));
        return lista?.length ? lista.reduce((a, b) => a + b, 0) / lista.length : null;
      };
      const vendidasDe = new Map(vendidas.map((v) => [`${v.idProducto}|${v.idSucursal}`, v.unidades]));

      const filas: FilaReabastecer[] = [];
      for (const fila of inventario) {
        const producto = productos.find((p) => p.idProducto === fila.idProducto);
        const sucursal = sucursales.find((s) => s.idSucursal === fila.idSucursal);
        if (!producto || !sucursal) continue;

        // Sugerido: menor tiempo de entrega; si empatan, mejor calidad (sin evaluar va
        // después de cualquier evaluado); si siguen empatados, menor precio.
        const opciones = suministros
          .filter((s) => s.idProducto === fila.idProducto && s.idSucursal === fila.idSucursal)
          .map((s) => ({ suministro: s, calidad: calidadDe(s) }))
          .sort(
            (a, b) =>
              a.suministro.tiempoEntregaDias - b.suministro.tiempoEntregaDias ||
              (b.calidad ?? 0) - (a.calidad ?? 0) ||
              a.suministro.precioSuministro - b.suministro.precioSuministro,
          );
        const elegido = opciones[0];

        const unidades = vendidasDe.get(`${fila.idProducto}|${fila.idSucursal}`) ?? 0;
        const ritmo = unidades / DIAS_RITMO_VENTAS;
        const cobertura = ritmo > 0 ? fila.cantidadDisponible / ritmo : null;
        const entrega = elegido ? elegido.suministro.tiempoEntregaDias : null;
        const seAgotaAntes = cobertura !== null && entrega !== null && cobertura < entrega;
        if (fila.cantidadDisponible > UMBRAL_STOCK_BAJO && !seAgotaAntes) continue;

        filas.push({
          clave: `${fila.idProducto}-${fila.idSucursal}`,
          fila,
          producto,
          sucursal,
          vendidas: unidades,
          cobertura,
          entrega,
          alcanza: textoAlcanza(fila.cantidadDisponible, cobertura),
          veredicto: veredicto(fila.cantidadDisponible, cobertura, entrega),
          sugerido: elegido
            ? {
                suministro: elegido.suministro,
                proveedor: proveedores.find((p) => p.nit === elegido.suministro.nit)?.nombre ?? 'Proveedor eliminado',
                calidad: elegido.calidad,
              }
            : null,
          otrasOpciones: Math.max(0, opciones.length - 1),
        });
      }

      return {
        sucursal: params.idSucursal === null ? null : (sucursales.find((s) => s.idSucursal === params.idSucursal)?.nombre ?? null),
        filas: filas.sort(ordenReabastecer),
      };
    },
  });

  /** Al cambiar de sucursal se vuelve a la primera página. */
  protected readonly paginaReabastecer = linkedSignal({ source: () => this.session.idSucursalFiltro(), computation: () => 1 });
  protected readonly porPaginaReabastecer = signal(15);
  protected readonly filasReabastecer = computed(() => {
    const filas = this.reabastecer.hasValue() ? this.reabastecer.value().filas : [];
    // Si una entrada saca filas de la lista, la página no queda fuera de rango.
    const ultima = Math.max(1, Math.ceil(filas.length / this.porPaginaReabastecer()));
    return paginar(filas, Math.min(this.paginaReabastecer(), ultima), this.porPaginaReabastecer());
  });

  /** Administrador: las ventas de los últimos 7 días frente a los 7 anteriores. */
  protected readonly ventas = resource({
    params: () => (this.esAdmin() ? { idSucursal: this.session.idSucursalFiltro() } : undefined),
    loader: async ({ params }) => {
      const hoy = this.hoy;
      const actual: FiltroPeriodo = { idSucursal: params.idSucursal, desde: restarDias(hoy, 6), hasta: hoy };
      const anterior = this.estadisticas.periodoAnterior(actual);
      const catorce: FiltroPeriodo = { idSucursal: params.idSucursal, desde: anterior.desde, hasta: hoy };
      const comparacion = `vs. ${rangoDias(anterior.desde, anterior.hasta)}`;
      const tramos: TramoColumnas[] = [
        { desde: anterior.desde, texto: '7 días anteriores' },
        { desde: actual.desde, texto: 'Últimos 7 días' },
      ];
      const aPuntos = (dias: { fecha: string; total: number; cantidad: number }[]): PuntoTiempo[] =>
        dias.map((d) => ({ fecha: d.fecha, valor: d.total, detalle: cuentaVentas(d.cantidad) }));

      if (params.idSucursal !== null) {
        const [dias, resumenActual, resumenAnterior] = await Promise.all([
          this.estadisticas.ventasPorDia(catorce),
          this.estadisticas.resumen(actual),
          this.estadisticas.resumen(anterior),
        ]);
        const deHoy = dias.at(-1);
        const hayBase = resumenAnterior.cantidad > 0;
        return {
          enfasisDesde: actual.desde,
          tramos,
          comparacion,
          sinBase: `Sin ventas del ${rangoDias(anterior.desde, anterior.hasta)} para comparar`,
          hoy: { cantidad: deHoy?.cantidad ?? 0, total: deHoy?.total ?? 0 },
          vacio: dias.every((d) => d.cantidad === 0),
          una: {
            puntos: aPuntos(dias),
            total: resumenActual.total,
            cantidad: resumenActual.cantidad,
            ticket: resumenActual.ticketPromedio,
            variacionTotal: hayBase
              ? { relativa: variacionRelativa(resumenActual.total, resumenAnterior.total), periodo: comparacion }
              : null,
            variacionTicket:
              hayBase && resumenActual.cantidad > 0
                ? { relativa: variacionRelativa(resumenActual.ticketPromedio, resumenAnterior.ticketPromedio), periodo: comparacion }
                : null,
          },
          paneles: [] as PanelSucursal[],
          maximo: 0,
        };
      }

      // Toda la cadena: un panel por sucursal, en orden fijo por nombre para que la
      // posición identifique la sede, y con la misma escala para poder compararlos.
      const sucursales = await this.sucursalesRepo.listar();
      const series = await Promise.all(
        sucursales.map((s) => this.estadisticas.ventasPorDia({ ...catorce, idSucursal: s.idSucursal })),
      );
      const paneles = sucursales.map<PanelSucursal>((s, i) => {
        const dias = series[i];
        const recientes = dias.filter((d) => d.fecha >= actual.desde);
        const previos = dias.filter((d) => d.fecha < actual.desde);
        const total = recientes.reduce((suma, d) => suma + d.total, 0);
        const totalPrevio = previos.reduce((suma, d) => suma + d.total, 0);
        return {
          idSucursal: s.idSucursal,
          nombre: s.nombre,
          puntos: aPuntos(dias),
          total,
          cantidad: recientes.reduce((suma, d) => suma + d.cantidad, 0),
          relativa: variacionRelativa(total, totalPrevio),
        };
      });
      const deHoy = series.map((dias) => dias.at(-1));
      return {
        enfasisDesde: actual.desde,
        tramos,
        comparacion,
        sinBase: `Sin ventas del ${rangoDias(anterior.desde, anterior.hasta)}`,
        hoy: {
          cantidad: deHoy.reduce((suma, d) => suma + (d?.cantidad ?? 0), 0),
          total: deHoy.reduce((suma, d) => suma + (d?.total ?? 0), 0),
        },
        vacio: series.every((dias) => dias.every((d) => d.cantidad === 0)),
        una: null,
        paneles,
        maximo: Math.max(0, ...series.flatMap((dias) => dias.map((d) => d.total))),
      };
    },
  });

  protected readonly descripcionAdmin = computed(() => {
    if (this.porTodas()) return 'Qué reabastecer primero y cómo van las ventas en toda la cadena.';
    const sucursal = this.reabastecer.hasValue() ? this.reabastecer.value().sucursal : null;
    return `Qué reabastecer primero y cómo van las ventas en ${sucursal ?? 'la sucursal de trabajo'}.`;
  });

  protected readonly saludo = computed(() => {
    const hora = new Date().getHours();
    const momento = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
    return `${momento}, ${this.usuario()?.nombre ?? ''}`;
  });

  /** Botón que se enfoca después de registrar una entrada y recargar la lista. */
  private readonly focoPendiente = signal<string | null>(null);

  constructor() {
    // El diálogo devuelve el foco a su botón, pero la recarga puede quitar esa fila:
    // entonces el foco pasa al título de la tarjeta para no perderse en la página.
    afterRenderEffect(() => {
      const clave = this.focoPendiente();
      if (clave === null || this.reabastecer.isLoading() || !this.reabastecer.hasValue()) return;
      const raiz = this.host.nativeElement;
      const destino =
        raiz.querySelector<HTMLElement>(`#entrada-${clave}`) ?? raiz.querySelector<HTMLElement>('#reabastecer-titulo');
      destino?.focus();
      this.focoPendiente.set(null);
    });
  }

  protected async registrarEntrada(item: FilaReabastecer): Promise<void> {
    const resultado = await dialogoInventario(this.modal, {
      sucursal: item.sucursal,
      registro: item.fila,
      productos: [item.producto],
      modo: 'entrada',
    });
    if (!resultado) return;
    // En el diálogo se puede cambiar a "Corregir conteo": el aviso dice lo que de verdad se guardó.
    const queda = `${item.producto.nombre} queda con ${cuentaUnidades(resultado.registro.cantidadDisponible)} en ${item.sucursal.nombre}.`;
    this.avisos.exito(resultado.modo === 'entrada' ? `Entrada registrada: ${queda}` : `Conteo corregido: ${queda}`);
    this.focoPendiente.set(item.clave);
    this.reabastecer.reload();
  }

  protected textoVariacion(relativa: number): string {
    const porcentaje = Math.round(relativa * 100);
    return `${porcentaje > 0 ? '+' : ''}${porcentaje} %`;
  }

  protected iconoVariacion(relativa: number) {
    return relativa > 0.005 ? faArrowUp : relativa < -0.005 ? faArrowDown : faArrowRight;
  }

  protected calidadTexto(calidad: number | null): string {
    return calidad === null ? 'sin evaluar' : `calidad ${numero(Math.round(calidad * 10) / 10)} de 5`;
  }

  protected porcentaje(tasa: number): string {
    return `${numero(tasa * 100)} %`;
  }

  protected cuentaVentas(n: number): string {
    return cuentaVentas(n);
  }

  protected cuentaDias(n: number): string {
    return cuentaDias(n);
  }

  protected cuentaVendidas(n: number): string {
    return n === 1 ? '1 vendida' : `${numero(n)} vendidas`;
  }

  protected etiquetaEntrada(item: FilaReabastecer): string {
    return `Registrar entrada de ${item.producto.nombre} en ${item.sucursal.nombre}`;
  }
}

// ------------------------------------------------------------------ Ayudas

function restarDias(iso: string, dias: number): string {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return fechaISO(sumarDias(new Date(anio, mes - 1, dia), -dias));
}

function cuentaVentas(n: number): string {
  return n === 1 ? '1 venta' : `${numero(n)} ventas`;
}

function cuentaUnidades(n: number): string {
  return n === 1 ? '1 unidad' : `${numero(n)} unidades`;
}

function cuentaDias(n: number): string {
  return n === 1 ? '1 día' : `${numero(n)} días`;
}

/** "11 al 17 de oct", o "28 de sep al 4 de oct" si cruza de mes. */
function rangoDias(desde: string, hasta: string): string {
  if (desde === hasta) return diaMes(desde);
  return desde.slice(0, 7) === hasta.slice(0, 7)
    ? `${Number(desde.slice(8))} al ${diaMes(hasta)}`
    : `${diaMes(desde)} al ${diaMes(hasta)}`;
}

const formatoMes = new Intl.DateTimeFormat('es-CO', { month: 'long' });

function nombreMes(iso: string): string {
  const [anio, mes] = iso.split('-').map(Number);
  return formatoMes.format(new Date(anio, mes - 1, 1));
}

/** "1 al 24 de septiembre", o "1 de octubre" si es un solo día. Ambos días del mismo mes. */
function tramoMesTexto(desde: string, hasta: string): string {
  const mes = nombreMes(desde);
  return desde === hasta ? `${Number(desde.slice(8))} de ${mes}` : `${Number(desde.slice(8))} al ${Number(hasta.slice(8))} de ${mes}`;
}

/**
 * Del día 1 a hoy, y el mismo tramo del mes anterior (recortado a su último día si
 * ese mes es más corto: el 31 de marzo se compara con el 1 al 28 de febrero).
 */
function tramoDelMes(hoy: string): { desde: string; anteriorDesde: string; anteriorHasta: string } {
  const [anio, mes, dia] = hoy.split('-').map(Number);
  const ultimoDiaAnterior = new Date(anio, mes - 1, 0).getDate();
  return {
    desde: fechaISO(new Date(anio, mes - 1, 1)),
    anteriorDesde: fechaISO(new Date(anio, mes - 2, 1)),
    anteriorHasta: fechaISO(new Date(anio, mes - 2, Math.min(dia, ultimoDiaAnterior))),
  };
}

/** "Centro", "Centro y Norte", "Centro, Norte y Sur". */
function listaNatural(nombres: string[]): string {
  return nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}

/** Cobertura en texto: estimada, sin decimales y con tope legible. */
function textoAlcanza(cantidad: number, cobertura: number | null): string {
  if (cantidad === 0) return 'Agotado';
  if (cobertura === null) return `Sin ventas en ${DIAS_RITMO_VENTAS} días`;
  if (cobertura < 1) return 'Menos de 1 día (aprox.)';
  if (cobertura > 30) return 'Más de 30 días (aprox.)';
  return `Aprox. ${cuentaDias(Math.round(cobertura))}`;
}

function veredicto(cantidad: number, cobertura: number | null, entrega: number | null): Veredicto | null {
  if (cantidad === 0) {
    return { alerta: true, texto: entrega === null ? 'Sin proveedor para reponerlo' : `Si pides hoy, llega en ${cuentaDias(entrega)}` };
  }
  if (cobertura === null || entrega === null) return null;
  if (cobertura < entrega) {
    const dias = Math.max(1, Math.round(entrega - cobertura));
    return { alerta: true, texto: `Se agota aprox. ${cuentaDias(dias)} antes de que llegue el pedido` };
  }
  return { alerta: false, texto: 'Alcanza hasta que llegue el pedido' };
}

/**
 * Primero lo agotado (lo que más se vendía arriba), luego lo que se acaba antes de
 * la entrega (lo más justo arriba) y al final lo que solo tiene pocas unidades.
 */
function ordenReabastecer(a: FilaReabastecer, b: FilaReabastecer): number {
  const grupo = (f: FilaReabastecer) =>
    f.fila.cantidadDisponible === 0 ? 0 : f.cobertura !== null && f.entrega !== null && f.cobertura < f.entrega ? 1 : 2;
  const margen = (f: FilaReabastecer) => (f.cobertura === null ? Number.POSITIVE_INFINITY : f.cobertura - (f.entrega ?? 0));
  const porNombre = a.producto.nombre.localeCompare(b.producto.nombre, 'es');
  const ga = grupo(a);
  const gb = grupo(b);
  if (ga !== gb) return ga - gb;
  if (ga === 0) return b.vendidas - a.vendidas || porNombre;
  return margen(a) - margen(b) || a.fila.cantidadDisponible - b.fila.cantidadDisponible || porNombre;
}
