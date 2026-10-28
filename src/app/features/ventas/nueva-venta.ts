import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBoxOpen,
  faCartShopping,
  faCheck,
  faCircleExclamation,
  faClockRotateLeft,
  faLocationDot,
  faMinus,
  faPlus,
  faReceipt,
  faTriangleExclamation,
  faUserPlus,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbOffcanvas, NgbTooltip, NgbTypeahead, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { debounceTime, distinctUntilChanged, map, Observable } from 'rxjs';
import { Avisos } from '../../core/avisos';
import { mensajeDeError } from '../../core/domain-error';
import { fechaISO, sumarDias } from '../../core/fechas';
import { VENTA_REGISTRADA } from '../../core/guards';
import { Cliente, esConsumidorFinal, nombreCliente, Producto } from '../../core/models';
import { Session } from '../../core/session';
import { VentaEnCurso } from '../../core/venta-en-curso';
import {
  CategoriasRepository,
  MarcasRepository,
  MetodosPagoRepository,
  SucursalesRepository,
} from '../../data/catalogos.repository';
import { ClientesRepository } from '../../data/personas.repository';
import { InventarioRepository, ProductosRepository } from '../../data/productos.repository';
import { normalizar } from '../../data/reglas';
import { VentasRepository } from '../../data/ventas.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoBloque, EsqueletoTabla } from '../../shared/esqueleto';
import { CampoBusqueda } from '../../shared/filtros';
import { FechaPipe, pesos, PesosPipe } from '../../shared/formato';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';
import { ClienteHistorial } from '../clientes/cliente-historial';
import { abrirDialogoCliente } from '../clientes/cliente-dialogo';

interface ProductoVendible {
  producto: Producto;
  marca: string;
  idCategoriaPrincipal: number;
  disponible: number;
  ubicacion: string;
}

/**
 * ok: se puede vender. excede: pide más de lo que hay en la sucursal (o se agotó).
 * no-disponible: la sucursal no maneja el producto o salió del catálogo.
 */
type EstadoLinea = 'ok' | 'excede' | 'no-disponible';

interface LineaCarrito {
  idProducto: number;
  cantidad: number;
  nombre: string;
  /** False si el producto ya no está en el catálogo. */
  existe: boolean;
  precio: number;
  disponible: number;
  ubicacion: string | null;
  estado: EstadoLinea;
  subtotal: number;
}

interface OtraSede {
  nombre: string;
  cantidad: number;
}

interface Anuncio {
  texto: string;
  problema: boolean;
}

/** Ventana con la que se eligen los clientes frecuentes de la sede. */
const DIAS_FRECUENTES = 30;
const MAX_FRECUENTES = 4;

/** Billetes colombianos en circulación, para sugerir con cuánto paga el cliente. */
const BILLETES = [2000, 5000, 10000, 20000, 50000, 100000];

/** "20*PL-0201": las primeras cifras antes del asterisco son la cantidad. */
function interpretarBusqueda(texto: string): { cantidad: number | null; termino: string } {
  const partes = /^\s*(\d{1,4})\s*\*\s*(.*)$/.exec(texto);
  return partes ? { cantidad: Number(partes[1]), termino: partes[2].trim() } : { cantidad: null, termino: texto.trim() };
}

function unidades(n: number): string {
  return `${n} ${n === 1 ? 'unidad' : 'unidades'}`;
}

function esTextoDocumento(texto: string): boolean {
  return /^[0-9.\-\s]+$/.test(texto.trim());
}

@Component({
  selector: 'app-nueva-venta',
  imports: [
    FaIconComponent,
    NgbTypeahead,
    NgbTooltip,
    PageHeader,
    ErrorCarga,
    Vacio,
    EsqueletoBloque,
    EsqueletoTabla,
    CampoBusqueda,
    ClienteHistorial,
    PesosPipe,
    FechaPipe,
  ],
  templateUrl: './nueva-venta.html',
  styleUrl: './nueva-venta.css',
  host: {
    '(document:keydown)': 'alPulsarTecla($event)',
    '(window:beforeunload)': 'antesDeCerrar($event)',
  },
})
export class NuevaVentaPage {
  private readonly session = inject(Session);
  private readonly venta = inject(VentaEnCurso);
  private readonly router = inject(Router);
  private readonly modal = inject(NgbModal);
  private readonly offcanvas = inject(NgbOffcanvas);
  private readonly confirmarDialogo = inject(Confirmar);
  private readonly avisos = inject(Avisos);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ventasRepo = inject(VentasRepository);
  private readonly productosRepo = inject(ProductosRepository);
  private readonly inventarioRepo = inject(InventarioRepository);
  private readonly categoriasRepo = inject(CategoriasRepository);
  private readonly marcasRepo = inject(MarcasRepository);
  private readonly clientesRepo = inject(ClientesRepository);
  private readonly metodosRepo = inject(MetodosPagoRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);

  /** Query param `?cliente=ID`: llega desde la ficha del cliente con "Nueva venta para este cliente". */
  readonly cliente = input<string>();

  protected readonly iconos = {
    faBoxOpen,
    faCartShopping,
    faCheck,
    faCircleExclamation,
    faClockRotateLeft,
    faLocationDot,
    faMinus,
    faPlus,
    faReceipt,
    faTriangleExclamation,
    faUserPlus,
    faXmark,
  };
  protected readonly diasFrecuentes = DIAS_FRECUENTES;
  protected readonly nombreCliente = nombreCliente;
  protected readonly esConsumidorFinal = esConsumidorFinal;
  protected readonly unidades = unidades;
  protected readonly teclaModificadora =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? 'Cmd' : 'Ctrl';

  // La venta vive en VentaEnCurso para sobrevivir a la navegación y a una recarga.
  protected readonly lineas = this.venta.lineas;
  protected readonly idCliente = this.venta.idCliente;
  protected readonly idMetodoPago = this.venta.idMetodoPago;
  protected readonly recibido = this.venta.recibido;

  protected readonly idSucursal = this.session.idSucursalFiltro;

  protected readonly datos = resource({
    params: () => this.idSucursal() ?? undefined,
    loader: async ({ params: idSucursal }) => {
      const [productos, inventario, categorias, marcas, clientes, metodos, sucursales] = await Promise.all([
        this.productosRepo.listar(),
        this.inventarioRepo.listar(idSucursal),
        this.categoriasRepo.listar(),
        this.marcasRepo.listar(),
        this.clientesRepo.listar(),
        this.metodosRepo.listar(),
        this.sucursalesRepo.listar(),
      ]);
      const principalDe = (idCategoria: number) => {
        const categoria = categorias.find((c) => c.idCategoria === idCategoria);
        return categoria?.idCategoriaPrincipal ?? idCategoria;
      };
      const vendibles: ProductoVendible[] = inventario
        .flatMap((fila) => {
          const producto = productos.find((p) => p.idProducto === fila.idProducto);
          return producto
            ? [
                {
                  producto,
                  marca: marcas.find((m) => m.idMarca === producto.idMarca)?.nombre ?? '',
                  idCategoriaPrincipal: principalDe(producto.idCategoria),
                  disponible: fila.cantidadDisponible,
                  ubicacion: fila.ubicacionBodega,
                },
              ]
            : [];
        })
        // Los agotados van al final: lo primero que se ve es lo que se puede vender.
        .sort(
          (a, b) =>
            Number(a.disponible === 0) - Number(b.disponible === 0) ||
            a.producto.nombre.localeCompare(b.producto.nombre, 'es'),
        );
      const principales = categorias.filter(
        (c) => c.idCategoriaPrincipal === null && vendibles.some((v) => v.idCategoriaPrincipal === c.idCategoria),
      );
      const sucursal = sucursales.find((s) => s.idSucursal === idSucursal)?.nombre ?? 'Esta sucursal';
      return { idSucursal, sucursal, productos, vendibles, principales, clientes, metodos };
    },
  });

  /**
   * Existencias en las otras sedes y compras recientes de la sede. Va aparte de `datos`:
   * si falla, se sigue vendiendo y solo faltan las sugerencias.
   */
  protected readonly cadena = resource({
    params: () => this.idSucursal() ?? undefined,
    loader: async ({ params: idSucursal }) => {
      const desde = fechaISO(sumarDias(new Date(), -(DIAS_FRECUENTES - 1)));
      const [inventario, ventas, sucursales] = await Promise.all([
        this.inventarioRepo.listar(null),
        this.ventasRepo.listar({ idSucursal, desde }),
        this.sucursalesRepo.listar(),
      ]);
      const otrasSedes = new Map<number, OtraSede[]>();
      for (const fila of inventario) {
        if (fila.idSucursal === idSucursal || fila.cantidadDisponible <= 0) {
          continue;
        }
        const nombre = sucursales.find((s) => s.idSucursal === fila.idSucursal)?.nombre ?? `Sucursal ${fila.idSucursal}`;
        const lista = otrasSedes.get(fila.idProducto) ?? [];
        lista.push({ nombre, cantidad: fila.cantidadDisponible });
        otrasSedes.set(fila.idProducto, lista);
      }
      for (const lista of otrasSedes.values()) {
        lista.sort((a, b) => b.cantidad - a.cantidad);
      }
      // Ventas ya vienen de la más reciente a la más antigua: la primera de cada cliente es su última.
      const comprasPorCliente = new Map<number, { compras: number; ultima: string }>();
      for (const v of ventas) {
        const actual = comprasPorCliente.get(v.idCliente);
        comprasPorCliente.set(v.idCliente, { compras: (actual?.compras ?? 0) + 1, ultima: actual?.ultima ?? v.fecha });
      }
      return { idSucursal, otrasSedes, comprasPorCliente };
    },
  });

  /** Datos de la sucursal vigente; mientras llegan los de otra sucursal, nada (se ve el esqueleto). */
  protected readonly d = computed(() => {
    const valor = this.datos.hasValue() ? this.datos.value() : undefined;
    return valor && valor.idSucursal === this.idSucursal() ? valor : undefined;
  });

  private readonly cadenaActual = computed(() => {
    const valor = this.cadena.hasValue() ? this.cadena.value() : undefined;
    return valor && valor.idSucursal === this.idSucursal() ? valor : undefined;
  });

  /** Clientes conocidos; crece cuando se crea uno desde esta pantalla. */
  protected readonly clientes = linkedSignal(() => this.d()?.clientes ?? []);

  protected readonly busqueda = signal('');
  protected readonly categoria = signal<number | null>(null);
  protected readonly textoCliente = signal('');
  protected readonly intentoConfirmar = signal(false);
  protected readonly registrando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Lo último que pasó al escanear o agregar: se ve bajo el buscador y lo leen los lectores de pantalla. */
  protected readonly anuncio = signal<Anuncio | null>(null);
  /** Venta que ya estaba en curso al abrir la pantalla, con los productos cuya cantidad se recortó. */
  protected readonly recuperada = signal<{ recortados: string[] } | null>(null);

  private readonly enfocarTrasRecarga = signal(false);
  private readonly campoBusqueda = viewChild(CampoBusqueda, { read: ElementRef });
  private readonly buscador = viewChild(CampoBusqueda);
  private readonly panelHistorial = viewChild.required<TemplateRef<unknown>>('panelHistorial');
  private sucursalRevisada: number | null = null;
  private clienteDelEnlace: string | null = null;
  private focoInicialHecho = false;
  private temporizadorAnuncio: ReturnType<typeof setTimeout> | undefined;

  protected readonly consulta = computed(() => interpretarBusqueda(this.busqueda()));

  protected readonly productosFiltrados = computed(() => this.filtrar(this.consulta().termino));

  protected readonly filtrosActivos = computed(() => Number(this.busqueda().trim() !== '') + Number(this.categoria() !== null));

  protected readonly enCarrito = computed(() => new Map(this.lineas().map((l) => [l.idProducto, l.cantidad])));

  protected readonly clienteElegido = computed(
    () => this.clientes().find((c) => c.idCliente === this.idCliente()) ?? null,
  );

  protected readonly consumidorFinal = computed(() => this.clientes().find(esConsumidorFinal) ?? null);

  protected readonly metodoElegido = computed(
    () => this.d()?.metodos.find((m) => m.idMetodoPago === this.idMetodoPago()) ?? null,
  );

  protected readonly esEfectivo = computed(() => {
    const metodo = this.metodoElegido();
    return metodo !== null && normalizar(metodo.tipo) === 'efectivo';
  });

  protected readonly carrito = computed<LineaCarrito[]>(() => {
    const d = this.d();
    if (!d) {
      return [];
    }
    return this.lineas().map((linea) => {
      const vendible = d.vendibles.find((v) => v.producto.idProducto === linea.idProducto);
      const producto = vendible?.producto ?? d.productos.find((p) => p.idProducto === linea.idProducto);
      const disponible = vendible?.disponible ?? 0;
      const precio = producto?.precioBaseVenta ?? 0;
      const estado: EstadoLinea = !vendible ? 'no-disponible' : linea.cantidad > disponible ? 'excede' : 'ok';
      return {
        idProducto: linea.idProducto,
        cantidad: linea.cantidad,
        nombre: producto?.nombre ?? 'Producto retirado del catálogo',
        existe: producto !== undefined,
        precio,
        disponible,
        ubicacion: vendible?.ubicacion ?? null,
        estado,
        subtotal: linea.cantidad * precio,
      };
    });
  });

  protected readonly lineasMarcadas = computed(() => this.carrito().filter((l) => l.estado !== 'ok'));
  protected readonly total = computed(() => this.carrito().reduce((suma, l) => suma + l.subtotal, 0));
  protected readonly totalUnidades = computed(() => this.lineas().reduce((suma, l) => suma + l.cantidad, 0));

  /**
   * Cambio a devolver. Solo existe en pantalla: la tabla VENTA no tiene columna de monto
   * recibido, así que no se guarda con la factura; se pasa a la confirmación y ahí termina.
   */
  protected readonly cambio = computed(() => {
    const recibido = this.recibido();
    return this.esEfectivo() && recibido !== null ? recibido - this.total() : null;
  });

  /** Exacto aparte: hasta 3 montos redondeados hacia arriba a un billete, mayores que el total. */
  protected readonly montosSugeridos = computed(() => {
    const total = this.total();
    if (total <= 0) {
      return [];
    }
    // Desde $10.000 el billete de $2.000 solo daría montos casi iguales al de $5.000
    // (285.000 y 286.000): se sugiere lo que un cliente suele entregar.
    const billetes = total >= 10000 ? BILLETES.filter((b) => b >= 5000) : BILLETES;
    const montos = new Set(billetes.map((b) => Math.ceil(total / b) * b).filter((m) => m > total));
    return [...montos].sort((a, b) => a - b).slice(0, 3);
  });

  protected readonly faltantes = computed(() => {
    const faltan: string[] = [];
    if (this.lineas().length === 0) faltan.push('Agrega al menos un producto.');
    if (this.lineasMarcadas().length > 0) faltan.push('Corrige las cantidades marcadas en el resumen.');
    if (this.clienteElegido() === null) faltan.push('Elige el cliente o créalo.');
    if (this.metodoElegido() === null) faltan.push('Elige el método de pago.');
    const cambio = this.cambio();
    if (cambio !== null && cambio < 0) faltan.push('El efectivo recibido no cubre el total.');
    return faltan;
  });

  protected readonly frecuentes = computed(() => {
    const cadena = this.cadenaActual();
    if (!cadena) {
      return [];
    }
    const clientes = this.clientes();
    return [...cadena.comprasPorCliente.entries()]
      .flatMap(([idCliente, datos]) => {
        const cliente = clientes.find((c) => c.idCliente === idCliente);
        return cliente && !esConsumidorFinal(cliente) ? [{ cliente, ...datos }] : [];
      })
      .sort((a, b) => b.compras - a.compras || b.ultima.localeCompare(a.ultima))
      .slice(0, MAX_FRECUENTES);
  });

  /** Lo que el vendedor escribió en el buscador de clientes no coincide con nadie. */
  protected readonly sinCoincidenciasCliente = computed(() => {
    const buscado = normalizar(this.textoCliente());
    return buscado.length >= 2 && !this.clientes().some((c) => coincideCliente(c, buscado));
  });

  protected readonly textoEsDocumento = computed(() => esTextoDocumento(this.textoCliente()));

  /** Compras del cliente elegido en toda la cadena, para la línea bajo su nombre. */
  protected readonly comprasCliente = resource({
    params: () => {
      const c = this.clienteElegido();
      return c && !esConsumidorFinal(c) ? c.idCliente : undefined;
    },
    loader: async ({ params: idCliente }) => {
      const ventas = await this.ventasRepo.listar({ idSucursal: null, idCliente });
      return { idCliente, compras: ventas.length, ultima: ventas[0]?.fecha ?? null };
    },
  });

  /** Las compras del cliente que está elegido ahora (no las del anterior mientras llegan). */
  protected readonly comprasActuales = computed(() => {
    const valor = this.comprasCliente.hasValue() ? this.comprasCliente.value() : undefined;
    return valor && valor.idCliente === this.idCliente() ? valor : null;
  });

  protected readonly buscarCliente = (texto$: Observable<string>): Observable<Cliente[]> =>
    texto$.pipe(
      debounceTime(150),
      distinctUntilChanged(),
      map((texto) => {
        const buscado = normalizar(texto);
        return buscado.length < 2 ? [] : this.clientes().filter((c) => coincideCliente(c, buscado)).slice(0, 8);
      }),
    );

  protected readonly formatoCliente = (cliente: Cliente) => `${nombreCliente(cliente)} · ${cliente.numeroDocumento}`;

  constructor() {
    // Los precios vigentes salen de aquí; el aviso al salir y la barra superior los leen del servicio.
    effect(() => {
      if (this.d()) {
        this.venta.resumen.set({ productos: this.lineas().length, total: this.total() });
      }
    });

    // Al llegar el inventario de una sucursal, una venta que ya estaba en curso se revisa
    // contra lo que hay de verdad: las cantidades se recortan al disponible.
    effect(() => {
      const d = this.d();
      if (!d || this.sucursalRevisada === d.idSucursal) {
        return;
      }
      this.sucursalRevisada = d.idSucursal;
      untracked(() => this.revisarVentaRecuperada(d.vendibles));
    });

    // ?cliente=ID desde la ficha del cliente: lo deja elegido una vez por enlace.
    effect(() => {
      const param = this.cliente();
      const d = this.d();
      if (!param || !d || param === this.clienteDelEnlace) {
        return;
      }
      this.clienteDelEnlace = param;
      const elegido = d.clientes.find((c) => c.idCliente === Number(param));
      untracked(() => {
        if (elegido) {
          this.idCliente.set(elegido.idCliente);
        } else {
          this.avisos.error('El cliente del enlace ya no existe. Búscalo o créalo en el resumen de la venta.');
        }
      });
    });

    // Cambiar de sucursal con productos lo confirma la barra superior (la venta queda
    // guardada con la sucursal en VentaEnCurso); aquí no se repite el aviso.

    // Foco inicial en el buscador para escanear de una vez. En pantallas táctiles no, porque
    // abriría el teclado sobre la lista. El campo se vuelve a crear al cambiar de sucursal:
    // el foco solo se da la primera vez.
    effect(() => {
      const campo = this.campoBusqueda();
      if (!campo) {
        return;
      }
      const enfocar = !this.focoInicialHecho;
      this.focoInicialHecho = true;
      afterNextRender(
        () => {
          const entrada = this.entradaBusqueda();
          if (enfocar && entrada && matchMedia('(pointer: fine)').matches) {
            entrada.focus();
          }
        },
        { injector: this.injector },
      );
    });

    // Tras un fallo al registrar, el inventario se recarga; al llegar, el foco va a la primera línea marcada.
    effect(() => {
      if (!this.enfocarTrasRecarga() || !this.d() || this.datos.isLoading()) {
        return;
      }
      untracked(() => {
        this.enfocarTrasRecarga.set(false);
        if (this.lineasMarcadas().length) {
          this.enfocar('.linea.marcada .linea-accion');
        }
      });
    });
  }

  protected restante(v: ProductoVendible): number {
    return Math.max(0, v.disponible - (this.enCarrito().get(v.producto.idProducto) ?? 0));
  }

  /** La sede con más unidades de un producto, fuera de esta. */
  protected otraSede(idProducto: number): OtraSede | null {
    return this.cadenaActual()?.otrasSedes.get(idProducto)?.[0] ?? null;
  }

  /** True si ya se sabe que ninguna otra sede lo tiene (la consulta de la cadena respondió). */
  protected agotadoEnCadena(idProducto: number): boolean {
    const cadena = this.cadenaActual();
    return cadena !== undefined && !cadena.otrasSedes.has(idProducto);
  }

  protected agregar(vendible: ProductoVendible, pedidas = 1): void {
    const { producto } = vendible;
    const restante = this.restante(vendible);
    if (restante <= 0) {
      this.anunciar(
        vendible.disponible === 0
          ? `${producto.nombre} está agotado en esta sucursal.`
          : `No hay más unidades de ${producto.nombre} en esta sucursal: todas están en el carrito.`,
        true,
      );
      return;
    }
    const agregadas = Math.min(pedidas, restante);
    this.error.set(null);
    this.lineas.update((lineas) =>
      lineas.some((l) => l.idProducto === producto.idProducto)
        ? lineas.map((l) => (l.idProducto === producto.idProducto ? { ...l, cantidad: l.cantidad + agregadas } : l))
        : [...lineas, { idProducto: producto.idProducto, cantidad: agregadas }],
    );
    const total = pesos(this.total());
    if (agregadas < pedidas) {
      this.anunciar(
        `Pediste ${pedidas} de ${producto.nombre} y solo quedaban ${agregadas}: se agregaron ${unidades(agregadas)}. Total ${total}.`,
        true,
      );
    } else {
      this.anunciar(`Agregado ${producto.nombre}, ${unidades(agregadas)}. Total ${total}.`, false);
    }
  }

  /**
   * Enter en el buscador: un código exacto (lo que teclea un lector de barras) o un único
   * resultado se agregan de una vez; con varios, el foco pasa al primero de la lista.
   */
  protected alPulsarEnter(): void {
    const d = this.d();
    const { cantidad, termino } = this.consulta();
    if (!d || !termino) {
      return;
    }
    const pedidas = cantidad === null ? 1 : cantidad;
    if (pedidas < 1) {
      this.anunciar('La cantidad debe ser al menos 1.', true);
      return;
    }
    const codigo = normalizar(termino);
    const exacto = d.vendibles.find((v) => normalizar(v.producto.codigo) === codigo);
    const resultados = this.productosFiltrados();
    const elegido = exacto ?? (resultados.length === 1 ? resultados[0] : undefined);
    if (elegido) {
      this.agregar(elegido, pedidas);
      // Se vacía el campo mismo y no solo `busqueda`: un lector de barras teclea el código y
      // el Enter antes de que la vista se repinte, y el enlace no notaría el cambio.
      this.buscador()?.valor.set('');
      this.busqueda.set('');
      const entrada = this.entradaBusqueda();
      if (entrada) {
        entrada.value = '';
        entrada.focus();
      }
      return;
    }
    if (resultados.length === 0) {
      const enCadena = this.productoFueraDeSede(codigo);
      this.anunciar(
        enCadena
          ? `${d.sucursal} no maneja ${enCadena.nombre} (${enCadena.codigo}).`
          : `Ningún producto de esta sucursal coincide con "${termino}".`,
        true,
      );
      return;
    }
    this.enfocar('.productos button[data-agregar]:not(:disabled)');
  }

  protected cambiarCantidad(linea: LineaCarrito, cantidad: number): void {
    if (linea.disponible < 1) {
      return;
    }
    const ajustada = Math.min(Math.max(1, Math.floor(cantidad) || 1), linea.disponible);
    if (cantidad > linea.disponible) {
      this.anunciar(`Solo hay ${linea.disponible} de ${linea.nombre} en esta sucursal.`, true);
    }
    this.fijarCantidad(linea.idProducto, ajustada);
  }

  protected cambiarCantidadDesdeCampo(linea: LineaCarrito, campo: HTMLInputElement): void {
    this.cambiarCantidad(linea, campo.valueAsNumber);
    // Si el valor ajustado es el mismo que había, la vinculación no repinta el campo.
    campo.value = String(this.lineas().find((l) => l.idProducto === linea.idProducto)?.cantidad ?? '');
  }

  /** "Dejar M": ajusta la línea a lo que hay en la sucursal. */
  protected dejarDisponible(linea: LineaCarrito): void {
    this.fijarCantidad(linea.idProducto, linea.disponible);
    this.anunciar(`${linea.nombre} quedó en ${unidades(linea.disponible)}. Total ${pesos(this.total())}.`, false);
    this.enfocarSiguienteMarcada();
  }

  protected quitar(linea: LineaCarrito): void {
    this.lineas.update((lineas) => lineas.filter((l) => l.idProducto !== linea.idProducto));
    this.anunciar(`Quitaste ${linea.nombre}. Total ${pesos(this.total())}.`, false);
    // El botón pulsado desaparece con la línea: el foco no se pierde, vuelve al título de productos.
    if (linea.estado !== 'ok' && this.lineasMarcadas().length) {
      this.enfocarSiguienteMarcada();
    } else {
      this.enfocar('#productos-titulo');
    }
  }

  protected quitarFiltros(): void {
    this.busqueda.set('');
    this.categoria.set(null);
  }

  protected elegirCliente(evento: NgbTypeaheadSelectItemEvent<Cliente>): void {
    this.idCliente.set(evento.item.idCliente);
    this.textoCliente.set('');
  }

  protected elegirClientePorId(idCliente: number): void {
    this.idCliente.set(idCliente);
    this.textoCliente.set('');
  }

  protected cambiarCliente(): void {
    this.idCliente.set(null);
    this.enfocar('#buscar-cliente');
  }

  protected async crearCliente(): Promise<void> {
    const texto = this.textoCliente().trim();
    const creado = await abrirDialogoCliente(this.modal, null, texto || undefined);
    if (creado) {
      this.clientes.update((clientes) => [...clientes, creado]);
      this.elegirClientePorId(creado.idCliente);
      this.avisos.exito(`Cliente ${nombreCliente(creado)} creado y elegido para esta venta.`);
    }
  }

  protected verHistorial(): void {
    this.offcanvas.open(this.panelHistorial(), { position: 'end', ariaLabelledBy: 'historial-titulo' });
  }

  protected elegirMetodo(idMetodoPago: number): void {
    this.idMetodoPago.set(idMetodoPago);
  }

  // Campo "Recibido": mientras se escribe muestra las cifras tal cual; al salir, en pesos.
  protected readonly editandoRecibido = signal(false);
  private readonly textoRecibido = signal('');
  protected readonly valorRecibido = computed(() => {
    if (this.editandoRecibido()) {
      return this.textoRecibido();
    }
    const recibido = this.recibido();
    return recibido === null ? '' : pesos(recibido);
  });

  protected alEnfocarRecibido(campo: HTMLInputElement): void {
    const recibido = this.recibido();
    this.textoRecibido.set(recibido === null ? '' : String(recibido));
    this.editandoRecibido.set(true);
    afterNextRender(() => campo.select(), { injector: this.injector });
  }

  protected alEscribirRecibido(texto: string): void {
    this.textoRecibido.set(texto);
    const cifras = texto.replace(/\D/g, '').slice(0, 12);
    this.recibido.set(cifras ? Number(cifras) : null);
  }

  protected alSalirRecibido(): void {
    this.editandoRecibido.set(false);
  }

  /** "Exacto" o un billete sugerido. */
  protected fijarRecibido(monto: number): void {
    this.editandoRecibido.set(false);
    this.recibido.set(monto);
  }

  protected irAlResumen(): void {
    const titulo = this.host.nativeElement.querySelector<HTMLElement>('#resumen-titulo');
    titulo?.scrollIntoView({ block: 'start' });
    titulo?.focus({ preventScroll: true });
  }

  protected async descartar(): Promise<void> {
    if (this.lineas().length > 0) {
      const { productos, total } = this.venta.resumen();
      const descartar = await this.confirmarDialogo.preguntar({
        titulo: '¿Descartar la venta en curso?',
        mensaje: `Tienes ${productos} ${productos === 1 ? 'producto' : 'productos'} por ${pesos(total)} sin registrar. Si la descartas, se pierde.`,
        confirmar: 'Descartar venta',
        peligro: true,
      });
      if (!descartar) {
        return;
      }
    }
    // Se limpia antes de navegar: así el guard de salida no vuelve a preguntar.
    this.venta.limpiar();
    await this.router.navigate(['/inicio']);
  }

  /** "Empezar de nuevo" desde la franja de venta recuperada: se queda en la pantalla. */
  protected async empezarDeNuevo(): Promise<void> {
    const { productos, total } = this.venta.resumen();
    const descartar = await this.confirmarDialogo.preguntar({
      titulo: '¿Empezar una venta nueva?',
      mensaje: `Se descarta la venta recuperada: ${productos} ${productos === 1 ? 'producto' : 'productos'} por ${pesos(total)}.`,
      confirmar: 'Empezar de nuevo',
      peligro: true,
    });
    if (descartar) {
      this.venta.limpiar();
      this.recuperada.set(null);
      this.intentoConfirmar.set(false);
      this.error.set(null);
      this.entradaBusqueda()?.focus();
    }
  }

  protected async confirmar(): Promise<void> {
    if (this.registrando()) {
      return;
    }
    this.intentoConfirmar.set(true);
    const idSucursal = this.idSucursal();
    const cliente = this.clienteElegido();
    const metodo = this.metodoElegido();
    if (this.faltantes().length > 0 || idSucursal === null || !cliente || !metodo) {
      this.enfocarPrimerFaltante();
      return;
    }
    const cambio = this.cambio();
    this.registrando.set(true);
    this.error.set(null);
    try {
      const { venta } = await this.ventasRepo.registrar({
        idCliente: cliente.idCliente,
        idMetodoPago: metodo.idMetodoPago,
        lineas: this.lineas(),
      });
      // La factura muestra la confirmación con el cambio; la venta en curso ya no existe.
      this.venta.limpiar();
      await this.router.navigate(['/ventas', venta.idVenta], {
        state: { registrada: true, cambio, [VENTA_REGISTRADA]: true },
      });
    } catch (error) {
      this.error.set(mensajeDeError(error));
      // El inventario pudo cambiar: se recarga para marcar las líneas con lo que hay de verdad.
      this.enfocarTrasRecarga.set(true);
      this.datos.reload();
      this.cadena.reload();
    } finally {
      this.registrando.set(false);
    }
  }

  /** Ctrl/Cmd + Enter confirma desde cualquier parte de la pantalla, salvo con un diálogo abierto. */
  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key !== 'Enter' || !(evento.ctrlKey || evento.metaKey) || evento.defaultPrevented) {
      return;
    }
    if (document.body.classList.contains('modal-open') || document.querySelector('.offcanvas.show')) {
      return;
    }
    if (!this.d()) {
      return;
    }
    evento.preventDefault();
    // Una cantidad recién tecleada solo se aplica en "change" (al salir del campo): se aplica ya.
    if (evento.target instanceof HTMLInputElement && evento.target.type === 'number') {
      evento.target.dispatchEvent(new Event('change'));
    }
    void this.confirmar();
  }

  /** Cerrar o recargar la pestaña con productos en el carrito pide confirmación al navegador. */
  protected antesDeCerrar(evento: BeforeUnloadEvent): void {
    if (this.venta.hayVenta()) {
      evento.preventDefault();
      evento.returnValue = '';
    }
  }

  private filtrar(termino: string): ProductoVendible[] {
    const texto = normalizar(termino);
    const categoria = this.categoria();
    return (this.d()?.vendibles ?? []).filter(
      (v) =>
        (categoria === null || v.idCategoriaPrincipal === categoria) &&
        (!texto ||
          normalizar(v.producto.nombre).includes(texto) ||
          normalizar(v.producto.codigo).includes(texto) ||
          normalizar(v.marca).includes(texto)),
    );
  }

  /** Un código escaneado que existe en el catálogo pero no en el inventario de esta sede. */
  private productoFueraDeSede(codigo: string): Producto | undefined {
    const d = this.d();
    return d?.productos.find(
      (p) => normalizar(p.codigo) === codigo && !d.vendibles.some((v) => v.producto.idProducto === p.idProducto),
    );
  }

  private fijarCantidad(idProducto: number, cantidad: number): void {
    this.lineas.update((lineas) => lineas.map((l) => (l.idProducto === idProducto ? { ...l, cantidad } : l)));
  }

  private revisarVentaRecuperada(vendibles: ProductoVendible[]): void {
    const lineas = this.lineas();
    if (lineas.length === 0) {
      this.recuperada.set(null);
      return;
    }
    const recortados: string[] = [];
    const ajustadas = lineas.map((linea) => {
      const vendible = vendibles.find((v) => v.producto.idProducto === linea.idProducto);
      // Sin unidades o sin el producto en la sede, la línea queda marcada para que el vendedor decida.
      if (vendible && vendible.disponible > 0 && linea.cantidad > vendible.disponible) {
        recortados.push(`${vendible.producto.nombre} (quedan ${vendible.disponible})`);
        return { ...linea, cantidad: vendible.disponible };
      }
      return linea;
    });
    if (recortados.length) {
      this.lineas.set(ajustadas);
    }
    this.recuperada.set({ recortados });
  }

  private enfocarPrimerFaltante(): void {
    if (this.lineas().length === 0) {
      this.entradaBusqueda()?.focus();
    } else if (this.lineasMarcadas().length) {
      this.enfocar('.linea.marcada .linea-accion');
    } else if (this.clienteElegido() === null) {
      this.enfocar('#buscar-cliente');
    } else if (this.metodoElegido() === null) {
      this.enfocar('input[name="metodo"]');
    } else if ((this.cambio() ?? 0) < 0) {
      this.enfocar('#recibido');
    }
  }

  private enfocarSiguienteMarcada(): void {
    if (this.lineasMarcadas().length) {
      this.enfocar('.linea.marcada .linea-accion');
    }
  }

  /** Mueve el foco después de que la vista refleje el cambio de estado. */
  private enfocar(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  private entradaBusqueda(): HTMLInputElement | null {
    return (this.campoBusqueda()?.nativeElement as HTMLElement | undefined)?.querySelector('input') ?? null;
  }

  /**
   * Se vacía y se vuelve a escribir para que un lector de pantalla repita un mensaje
   * idéntico (por ejemplo, dos veces "no hay más unidades").
   */
  private anunciar(texto: string, problema: boolean): void {
    clearTimeout(this.temporizadorAnuncio);
    this.anuncio.set(null);
    this.temporizadorAnuncio = setTimeout(() => this.anuncio.set({ texto, problema }), 50);
  }
}

function coincideCliente(cliente: Cliente, buscado: string): boolean {
  return normalizar(nombreCliente(cliente)).includes(buscado) || normalizar(cliente.numeroDocumento).includes(buscado);
}
