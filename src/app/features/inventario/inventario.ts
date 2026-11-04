import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBoxesStacked,
  faCircleExclamation,
  faEllipsis,
  faFileArrowDown,
  faPen,
  faPlus,
  faRotateRight,
  faTrashCan,
  faTriangleExclamation,
  faTruckRampBox,
} from '@fortawesome/free-solid-svg-icons';
import {
  NgbDropdown,
  NgbDropdownItem,
  NgbDropdownMenu,
  NgbDropdownToggle,
  NgbModal,
  NgbPopover,
  NgbTooltip,
} from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { hoyISO } from '../../core/fechas';
import { Inventario, Producto, Sucursal, UMBRAL_STOCK_BAJO } from '../../core/models';
import { Session } from '../../core/session';
import { CategoriasRepository, SucursalesRepository } from '../../data/catalogos.repository';
import { InventarioRepository, ProductosRepository } from '../../data/productos.repository';
import { normalizar } from '../../data/reglas';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoTabla } from '../../shared/esqueleto';
import { CampoBusqueda } from '../../shared/filtros';
import { numero, PesosPipe } from '../../shared/formato';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { ColumnaCsv, descargarCsv } from '../../shared/tabla/exportar-csv';
import { paginar, PieTabla } from '../../shared/tabla/pie-tabla';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';
import { DatosInventarioDialogo, dialogoInventario, ModoInventario } from './inventario-dialogo';

type Vista = 'registro' | 'producto';

interface FilaRegistro {
  fila: Inventario;
  producto: Producto;
  categoria: string;
  sucursal: Sucursal;
}

interface CeldaMatriz {
  sucursal: Sucursal;
  fila: Inventario | null;
}

interface FilaMatriz {
  producto: Producto;
  categoria: string;
  celdas: CeldaMatriz[];
  total: number;
  bajo: boolean;
}

interface OtrasSedes {
  total: number;
  manejan: number;
  sedes: { sucursal: Sucursal; cantidad: number | null }[];
}

const CLAVE_VISTA = 'ferreteria.inventario.vista';

@Component({
  selector: 'app-inventario',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    FaIconComponent,
    NgbTooltip,
    NgbPopover,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownItem,
    PageHeader,
    ErrorCarga,
    Vacio,
    EncabezadoOrden,
    EsqueletoTabla,
    CampoBusqueda,
    PieTabla,
    PesosPipe,
  ],
  templateUrl: './inventario.html',
  styles: `
    .sin-flecha::after {
      display: none;
    }
    .celda-sede {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.375rem;
      min-height: 2rem;
      min-width: 3.5rem;
      padding: 0.25rem 0.5rem;
      margin-right: -0.5rem;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--ink);
      font: inherit;
      white-space: nowrap;
    }
    .celda-sede:hover {
      background: var(--soft-bg);
    }
    .celda-sede .no-maneja {
      color: var(--muted);
      font-size: 0.8125rem;
    }
    .bloques {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .bloques > li {
      padding: 1rem var(--bs-card-spacer-x);
      border-top: 1px solid var(--hairline);
    }
    .linea-sede {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      width: 100%;
      min-height: 2.25rem;
      padding: 0.25rem 0.5rem;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--ink);
      font: inherit;
      text-align: left;
    }
    .linea-sede:hover {
      background: var(--soft-bg);
    }
    .linea-sede .no-maneja {
      color: var(--muted);
      font-size: 0.8125rem;
    }
    .otras-sedes {
      padding: 0;
      border: 0;
      background: none;
      color: var(--ink);
      font: inherit;
      text-decoration: underline dotted;
      text-underline-offset: 0.25em;
    }
    .otras-sedes.ninguna {
      color: var(--muted);
    }
    .espera {
      display: inline-block;
      width: 2.5rem;
      height: 0.75rem;
      border-radius: 50rem;
      background: var(--soft-bg);
      vertical-align: middle;
    }
  `,
})
export class InventarioPage {
  private readonly session = inject(Session);
  private readonly repo = inject(InventarioRepository);
  private readonly productosRepo = inject(ProductosRepository);
  private readonly categoriasRepo = inject(CategoriasRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);

  protected readonly iconos = {
    faBoxesStacked,
    faCircleExclamation,
    faEllipsis,
    faFileArrowDown,
    faPen,
    faPlus,
    faRotateRight,
    faTrashCan,
    faTriangleExclamation,
    faTruckRampBox,
  };
  protected readonly umbral = UMBRAL_STOCK_BAJO;
  protected readonly esAdmin = this.session.esAdmin;
  protected readonly porTodas = computed(() => this.session.idSucursalFiltro() === null);
  protected readonly busqueda = signal('');
  protected readonly soloBajo = signal(false);
  protected readonly orden = new Orden<'producto' | 'categoria' | 'sucursal' | 'ubicacion' | 'precio' | 'disponible' | 'otras'>();
  protected readonly ordenMatriz = new Orden<'producto' | 'total'>();

  protected readonly vista = linkedSignal<Vista>(() => leerVista(this.session.usuario()?.idEmpleado));
  protected readonly puedeVerMatriz = computed(() => this.porTodas() && this.esAdmin());
  protected readonly vistaActiva = computed<Vista>(() => (this.puedeVerMatriz() ? this.vista() : 'registro'));

  protected readonly inventario = resource({
    params: () => ({ idSucursal: this.session.idSucursalFiltro() }),
    loader: async ({ params }) => {
      const [filas, productos, categorias, sucursales] = await Promise.all([
        this.repo.listar(params.idSucursal),
        this.productosRepo.listar(),
        this.categoriasRepo.listar(),
        this.sucursalesRepo.listar(),
      ]);
      const nombreCategoria = (p: Producto) => categorias.find((c) => c.idCategoria === p.idCategoria)?.nombre ?? '';
      const items: FilaRegistro[] = filas
        .flatMap((fila) => {
          const producto = productos.find((p) => p.idProducto === fila.idProducto);
          const sucursal = sucursales.find((s) => s.idSucursal === fila.idSucursal);
          return producto && sucursal ? [{ fila, producto, categoria: nombreCategoria(producto), sucursal }] : [];
        })
        .sort(
          (a, b) =>
            a.producto.nombre.localeCompare(b.producto.nombre, 'es') || a.sucursal.nombre.localeCompare(b.sucursal.nombre, 'es'),
        );
      const sucursal = sucursales.find((s) => s.idSucursal === params.idSucursal) ?? null;
      const faltantes = sucursal ? productos.filter((p) => !filas.some((f) => f.idProducto === p.idProducto)) : [];
      const matriz: FilaMatriz[] =
        params.idSucursal !== null
          ? []
          : productos
              .map((producto) => {
                const celdas = sucursales.map((s) => ({
                  sucursal: s,
                  fila: filas.find((f) => f.idProducto === producto.idProducto && f.idSucursal === s.idSucursal) ?? null,
                }));
                return {
                  producto,
                  categoria: nombreCategoria(producto),
                  celdas,
                  total: celdas.reduce((suma, c) => suma + (c.fila?.cantidadDisponible ?? 0), 0),
                  bajo: celdas.some((c) => c.fila !== null && c.fila.cantidadDisponible <= UMBRAL_STOCK_BAJO),
                };
              })
              .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, 'es'));
      return { items, sucursal, sucursales, faltantes, productos, matriz };
    },
  });

  protected readonly otrasSedes = resource({
    params: () => {
      const idSucursal = this.session.idSucursalFiltro();
      return idSucursal === null ? undefined : { idSucursal };
    },
    loader: async ({ params }) => {
      const [filas, sucursales] = await Promise.all([this.repo.listar(null), this.sucursalesRepo.listar()]);
      const otras = sucursales.filter((s) => s.idSucursal !== params.idSucursal);
      const porProducto = new Map<number, OtrasSedes>();
      for (const idProducto of new Set(filas.map((f) => f.idProducto))) {
        const sedes = otras.map((sucursal) => ({
          sucursal,
          cantidad: filas.find((f) => f.idProducto === idProducto && f.idSucursal === sucursal.idSucursal)?.cantidadDisponible ?? null,
        }));
        porProducto.set(idProducto, {
          total: sedes.reduce((suma, s) => suma + (s.cantidad ?? 0), 0),
          manejan: sedes.filter((s) => s.cantidad !== null).length,
          sedes,
        });
      }
      return { porProducto, otras };
    },
  });

  protected readonly datos = computed(() => (this.inventario.hasValue() ? this.inventario.value() : undefined));
  private readonly cadena = computed(() => (this.otrasSedes.hasValue() ? this.otrasSedes.value() : undefined));
  protected readonly sucursales = computed(() => this.datos()?.sucursales ?? []);

  protected readonly descripcion = computed(() => {
    if (!this.porTodas()) {
      const nombre = this.datos()?.sucursal?.nombre;
      return nombre
        ? `Existencias, precio y ubicación en bodega de ${nombre}, y cuánto hay en las otras sedes.`
        : 'Existencias, precio y ubicación en bodega de la sucursal de trabajo.';
    }
    return this.vistaActiva() === 'producto'
      ? 'Cuánto hay de cada producto en cada sucursal, para decidir dónde reabastecer.'
      : 'Existencias de cada producto en todas las sucursales.';
  });

  private readonly texto = computed(() => normalizar(this.busqueda()));
  protected readonly filtrosActivos = computed(() => (this.busqueda().trim() ? 1 : 0) + (this.soloBajo() ? 1 : 0));

  protected readonly filtrados = computed(() => {
    const texto = this.texto();
    return (this.datos()?.items ?? []).filter(
      (item) =>
        (!this.soloBajo() || item.fila.cantidadDisponible <= UMBRAL_STOCK_BAJO) &&
        (!texto ||
          normalizar(item.producto.nombre).includes(texto) ||
          normalizar(item.producto.codigo).includes(texto) ||
          normalizar(item.fila.ubicacionBodega).includes(texto)),
    );
  });

  protected readonly ordenados = computed(() =>
    this.orden.aplicar(this.filtrados(), {
      producto: (i) => i.producto.nombre,
      categoria: (i) => i.categoria,
      sucursal: (i) => i.sucursal.nombre,
      ubicacion: (i) => i.fila.ubicacionBodega,
      precio: (i) => i.producto.precioBaseVenta,
      disponible: (i) => i.fila.cantidadDisponible,
      otras: (i) => this.otrasDe(i.producto.idProducto)?.total ?? null,
    }),
  );

  protected readonly matrizFiltrada = computed(() => {
    const texto = this.texto();
    return (this.datos()?.matriz ?? []).filter(
      (fila) =>
        (!this.soloBajo() || fila.bajo) &&
        (!texto ||
          normalizar(fila.producto.nombre).includes(texto) ||
          normalizar(fila.producto.codigo).includes(texto) ||
          fila.celdas.some((c) => c.fila !== null && normalizar(c.fila.ubicacionBodega).includes(texto))),
    );
  });

  protected readonly matrizOrdenada = computed(() =>
    this.ordenMatriz.aplicar(this.matrizFiltrada(), {
      producto: (f) => f.producto.nombre,
      total: (f) => f.total,
    }),
  );

  protected readonly cantidadBajo = computed(() =>
    this.vistaActiva() === 'producto'
      ? (this.datos()?.matriz ?? []).filter((f) => f.bajo).length
      : (this.datos()?.items ?? []).filter((i) => i.fila.cantidadDisponible <= UMBRAL_STOCK_BAJO).length,
  );

  protected readonly hayDatos = computed(() =>
    this.vistaActiva() === 'producto' ? (this.datos()?.matriz.length ?? 0) > 0 : (this.datos()?.items.length ?? 0) > 0,
  );

  protected readonly totalVisible = computed(() =>
    this.vistaActiva() === 'producto' ? this.matrizFiltrada().length : this.filtrados().length,
  );

  protected readonly nombreConteo = computed(() =>
    this.vistaActiva() === 'registro' && this.porTodas() ? 'registros' : 'productos',
  );

  protected readonly porPagina = signal(15);
  protected readonly pagina = linkedSignal({
    source: () => ({
      busqueda: this.busqueda(),
      soloBajo: this.soloBajo(),
      vista: this.vistaActiva(),
      sucursal: this.session.idSucursalFiltro(),
      orden: this.orden.estado(),
      ordenMatriz: this.ordenMatriz.estado(),
    }),
    computation: () => 1,
  });
  protected readonly paginaActual = computed(() =>
    Math.min(this.pagina(), Math.max(1, Math.ceil(this.totalVisible() / this.porPagina()))),
  );
  protected readonly paginaRegistros = computed(() => paginar(this.ordenados(), this.paginaActual(), this.porPagina()));
  protected readonly paginaMatriz = computed(() => paginar(this.matrizOrdenada(), this.paginaActual(), this.porPagina()));

  protected cambiarVista(vista: Vista): void {
    this.vista.set(vista);
    guardarVista(this.session.usuario()?.idEmpleado, vista);
  }

  protected quitarFiltros(): void {
    this.busqueda.set('');
    this.soloBajo.set(false);
  }

  protected otrasDe(idProducto: number): OtrasSedes | null {
    const cadena = this.cadena();
    if (!cadena) {
      return null;
    }
    return (
      cadena.porProducto.get(idProducto) ?? {
        total: 0,
        manejan: 0,
        sedes: cadena.otras.map((sucursal) => ({ sucursal, cantidad: null })),
      }
    );
  }

  protected etiquetaOtras(nombre: string, otras: OtrasSedes): string {
    if (otras.manejan === 0) {
      return `${nombre}: ninguna otra sede lo maneja`;
    }
    const detalle = otras.sedes
      .map((s) => `${s.sucursal.nombre}, ${s.cantidad === null ? 'no lo maneja' : unidades(s.cantidad)}`)
      .join('; ');
    return `${nombre} en otras sedes: ${unidades(otras.total)}. ${detalle}`;
  }

  protected etiquetaCelda(producto: Producto, celda: CeldaMatriz): string {
    if (!celda.fila) {
      return `${producto.nombre}: ${celda.sucursal.nombre} no lo maneja. Agregar a esta sucursal`;
    }
    const bajo = celda.fila.cantidadDisponible <= UMBRAL_STOCK_BAJO ? ', stock bajo' : '';
    return `${producto.nombre} en ${celda.sucursal.nombre}: ${unidades(celda.fila.cantidadDisponible)}${bajo}. Registrar entrada o corregir conteo`;
  }

  protected async agregar(): Promise<void> {
    const datos = this.datos();
    if (!datos?.sucursal || datos.faltantes.length === 0) {
      return;
    }
    await this.abrirDialogo({ sucursal: datos.sucursal, registro: null, productos: datos.faltantes });
  }

  protected async abrirRegistro(item: FilaRegistro, modo: ModoInventario): Promise<void> {
    await this.abrirDialogo({ sucursal: item.sucursal, registro: item.fila, productos: [item.producto], modo });
  }

  protected async abrirCelda(producto: Producto, celda: CeldaMatriz): Promise<void> {
    await this.abrirDialogo(
      celda.fila
        ? { sucursal: celda.sucursal, registro: celda.fila, productos: [producto], modo: 'entrada' }
        : { sucursal: celda.sucursal, registro: null, productos: [producto] },
    );
  }

  private async abrirDialogo(datos: DatosInventarioDialogo): Promise<void> {
    const resultado = await dialogoInventario(this.modal, datos);
    if (!resultado) {
      return;
    }
    const { registro, modo } = resultado;
    const sede = datos.sucursal.nombre;
    if (!datos.registro) {
      const producto = datos.productos.find((p) => p.idProducto === registro.idProducto);
      this.avisos.exito(
        `${producto?.nombre ?? 'El producto'} quedó en el inventario de ${sede} con ${unidades(registro.cantidadDisponible)}.`,
      );
    } else if (modo === 'entrada') {
      this.avisos.exito(`Entrada registrada: ahora hay ${numero(registro.cantidadDisponible)} en ${sede}.`);
    } else {
      this.avisos.exito(`Conteo guardado: ahora hay ${numero(registro.cantidadDisponible)} en ${sede}.`);
    }
    this.recargar();
  }

  protected async retirar(item: FilaRegistro): Promise<void> {
    const { fila, producto, sucursal } = item;
    if (fila.cantidadDisponible > 0) {
      const corregir = await this.confirmar.preguntar({
        titulo: 'Aún hay unidades en la sucursal',
        mensaje: `Quedan ${unidades(fila.cantidadDisponible)} de ${producto.nombre} en ${sucursal.nombre}. Para retirarlo, primero corrige el conteo a 0.`,
        confirmar: 'Corregir conteo',
      });
      if (corregir) {
        await this.abrirRegistro(item, 'conteo');
      }
      return;
    }
    const eliminado = await this.confirmar.eliminar({
      titulo: 'Retirar producto de la sucursal',
      mensaje: `${producto.nombre} dejará de aparecer en el inventario de ${sucursal.nombre}. El producto sigue existiendo en el catálogo.`,
      confirmar: 'Retirar de la sucursal',
      accion: (clave) => this.repo.eliminar(fila.idProducto, fila.idSucursal, clave),
    });
    if (!eliminado) {
      return;
    }
    this.avisos.exito(`${producto.nombre} se retiró de ${sucursal.nombre}.`);
    this.recargar();
  }

  protected recargar(): void {
    this.inventario.reload();
    this.otrasSedes.reload();
  }

  protected exportar(): void {
    const datos = this.datos();
    if (!datos) {
      return;
    }
    const sufijo = datos.sucursal ? slug(datos.sucursal.nombre) : this.vistaActiva() === 'producto' ? 'por-producto' : 'todas-las-sedes';
    const archivo = `inventario-${sufijo}-${hoyISO()}`;
    if (this.vistaActiva() === 'producto') {
      const columnas: ColumnaCsv<FilaMatriz>[] = [
        { titulo: 'Código', valor: (f) => f.producto.codigo },
        { titulo: 'Producto', valor: (f) => f.producto.nombre },
        { titulo: 'Categoría', valor: (f) => f.categoria },
        ...datos.sucursales.map((s, i) => ({
          titulo: s.nombre,
          valor: (f: FilaMatriz) => f.celdas[i].fila?.cantidadDisponible ?? 'No lo maneja',
        })),
        { titulo: 'Total', valor: (f) => f.total },
      ];
      descargarCsv(archivo, columnas, this.matrizOrdenada());
      return;
    }
    const columnas: ColumnaCsv<FilaRegistro>[] = [
      { titulo: 'Código', valor: (i) => i.producto.codigo },
      { titulo: 'Producto', valor: (i) => i.producto.nombre },
      { titulo: 'Categoría', valor: (i) => i.categoria },
      { titulo: 'Sucursal', valor: (i) => i.sucursal.nombre },
      { titulo: 'Ubicación en bodega', valor: (i) => i.fila.ubicacionBodega },
      { titulo: 'Precio de venta', valor: (i) => i.producto.precioBaseVenta },
      { titulo: 'Disponible', valor: (i) => i.fila.cantidadDisponible },
    ];
    if (datos.sucursal && this.cadena()) {
      columnas.push({ titulo: 'Otras sedes', valor: (i) => this.otrasDe(i.producto.idProducto)?.total ?? null });
    }
    descargarCsv(archivo, columnas, this.ordenados());
  }
}

function unidades(cantidad: number): string {
  return `${numero(cantidad)} ${cantidad === 1 ? 'unidad' : 'unidades'}`;
}

function slug(texto: string): string {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function leerVista(idEmpleado: number | undefined): Vista {
  try {
    const guardada = localStorage.getItem(`${CLAVE_VISTA}.${idEmpleado ?? 'anonimo'}`);
    return guardada === 'registro' ? 'registro' : 'producto';
  } catch {
    return 'producto';
  }
}

function guardarVista(idEmpleado: number | undefined, vista: Vista): void {
  try {
    localStorage.setItem(`${CLAVE_VISTA}.${idEmpleado ?? 'anonimo'}`, vista);
  } catch {
  }
}
