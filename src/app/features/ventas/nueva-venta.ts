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

type EstadoLinea = 'ok' | 'excede' | 'no-disponible';

interface LineaCarrito {
  idProducto: number;
  cantidad: number;
  nombre: string;
  existe: boolean;
  precio: number;
  disponible: number;
  ubicacion: string | null;
  estado: EstadoLinea;
  subtotal: number;
}

interface Anuncio {
  texto: string;
  problema: boolean;
}

const BILLETES = [2000, 5000, 10000, 20000, 50000, 100000];

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
  protected readonly nombreCliente = nombreCliente;
  protected readonly esConsumidorFinal = esConsumidorFinal;
  protected readonly unidades = unidades;
  protected readonly teclaModificadora =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? 'Cmd' : 'Ctrl';

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

  protected readonly d = computed(() => {
    const valor = this.datos.hasValue() ? this.datos.value() : undefined;
    return valor && valor.idSucursal === this.idSucursal() ? valor : undefined;
  });

  protected readonly clientes = linkedSignal(() => this.d()?.clientes ?? []);

  protected readonly busqueda = signal('');
  protected readonly categoria = signal<number | null>(null);
  protected readonly textoCliente = signal('');
  protected readonly intentoConfirmar = signal(false);
  protected readonly registrando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly anuncio = signal<Anuncio | null>(null);
  protected readonly recuperada = signal<{ recortados: string[] } | null>(null);

  private readonly enfocarTrasRecarga = signal(false);
  private readonly campoBusqueda = viewChild(CampoBusqueda, { read: ElementRef });
  private readonly buscador = viewChild(CampoBusqueda);
  private readonly panelHistorial = viewChild.required<TemplateRef<unknown>>('panelHistorial');
  private sucursalRevisada: number | null = null;
  private clienteDelEnlace: string | null = null;
  private focoInicialHecho = false;
  private temporizadorAnuncio: ReturnType<typeof setTimeout> | undefined;

  protected readonly productosFiltrados = computed(() => this.filtrar(this.busqueda()));

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

  protected readonly cambio = computed(() => {
    const recibido = this.recibido();
    return this.esEfectivo() && recibido !== null ? recibido - this.total() : null;
  });

  protected readonly montosSugeridos = computed(() => {
    const total = this.total();
    if (total <= 0) {
      return [];
    }
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

  protected readonly sinCoincidenciasCliente = computed(() => {
    const buscado = normalizar(this.textoCliente());
    return buscado.length >= 2 && !this.clientes().some((c) => coincideCliente(c, buscado));
  });

  protected readonly textoEsDocumento = computed(() => esTextoDocumento(this.textoCliente()));

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
    effect(() => {
      if (this.d()) {
        this.venta.resumen.set({ productos: this.lineas().length, total: this.total() });
      }
    });

    effect(() => {
      const d = this.d();
      if (!d || this.sucursalRevisada === d.idSucursal) {
        return;
      }
      this.sucursalRevisada = d.idSucursal;
      untracked(() => this.revisarVentaRecuperada(d.vendibles));
    });

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

  protected agregar(vendible: ProductoVendible): void {
    const { producto } = vendible;
    if (this.restante(vendible) <= 0) {
      this.anunciar(
        vendible.disponible === 0
          ? `${producto.nombre} está agotado en esta sucursal.`
          : `No hay más unidades de ${producto.nombre} en esta sucursal: todas están en el carrito.`,
        true,
      );
      return;
    }
    this.error.set(null);
    this.lineas.update((lineas) =>
      lineas.some((l) => l.idProducto === producto.idProducto)
        ? lineas.map((l) => (l.idProducto === producto.idProducto ? { ...l, cantidad: l.cantidad + 1 } : l))
        : [...lineas, { idProducto: producto.idProducto, cantidad: 1 }],
    );
    this.anunciar(`Agregado ${producto.nombre}, ${unidades(1)}. Total ${pesos(this.total())}.`, false);
  }

  protected alPulsarEnter(): void {
    const d = this.d();
    const termino = this.busqueda().trim();
    if (!d || !termino) {
      return;
    }
    const codigo = normalizar(termino);
    const exacto = d.vendibles.find((v) => normalizar(v.producto.codigo) === codigo);
    const resultados = this.productosFiltrados();
    const elegido = exacto ?? (resultados.length === 1 ? resultados[0] : undefined);
    if (elegido) {
      this.agregar(elegido);
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
    campo.value = String(this.lineas().find((l) => l.idProducto === linea.idProducto)?.cantidad ?? '');
  }

  protected dejarDisponible(linea: LineaCarrito): void {
    this.fijarCantidad(linea.idProducto, linea.disponible);
    this.anunciar(`${linea.nombre} quedó en ${unidades(linea.disponible)}. Total ${pesos(this.total())}.`, false);
    this.enfocarSiguienteMarcada();
  }

  protected quitar(linea: LineaCarrito): void {
    this.lineas.update((lineas) => lineas.filter((l) => l.idProducto !== linea.idProducto));
    this.anunciar(`Quitaste ${linea.nombre}. Total ${pesos(this.total())}.`, false);
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
    this.venta.limpiar();
    await this.router.navigate(['/inicio']);
  }

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
      this.venta.limpiar();
      await this.router.navigate(['/ventas', venta.idVenta], {
        state: { registrada: true, cambio, [VENTA_REGISTRADA]: true },
      });
    } catch (error) {
      this.error.set(mensajeDeError(error));
      this.enfocarTrasRecarga.set(true);
      this.datos.reload();
    } finally {
      this.registrando.set(false);
    }
  }

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
    if (evento.target instanceof HTMLInputElement && evento.target.type === 'number') {
      evento.target.dispatchEvent(new Event('change'));
    }
    void this.confirmar();
  }

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

  private enfocar(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  private entradaBusqueda(): HTMLInputElement | null {
    return (this.campoBusqueda()?.nativeElement as HTMLElement | undefined)?.querySelector('input') ?? null;
  }

  private anunciar(texto: string, problema: boolean): void {
    clearTimeout(this.temporizadorAnuncio);
    this.anuncio.set(null);
    this.temporizadorAnuncio = setTimeout(() => this.anuncio.set({ texto, problema }), 50);
  }
}

function coincideCliente(cliente: Cliente, buscado: string): boolean {
  return normalizar(nombreCliente(cliente)).includes(buscado) || normalizar(cliente.numeroDocumento).includes(buscado);
}
