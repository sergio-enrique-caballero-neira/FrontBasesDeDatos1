import { Component, computed, inject, input, linkedSignal, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faFileArrowDown, faPen, faPlus, faScrewdriverWrench, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { mensajeDeError } from '../../core/domain-error';
import { Categoria, Producto } from '../../core/models';
import { CategoriasRepository, MarcasRepository } from '../../data/catalogos.repository';
import { EstadisticasRepository } from '../../data/estadisticas.repository';
import { ProductosRepository } from '../../data/productos.repository';
import { normalizar } from '../../data/reglas';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoTabla } from '../../shared/esqueleto';
import { CampoBusqueda } from '../../shared/filtros';
import { diaMes, numero, pesos, PesosPipe } from '../../shared/formato';
import { BarraCelda } from '../../shared/graficos/barra-celda';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { descargarCsv } from '../../shared/tabla/exportar-csv';
import { paginar, PieTabla } from '../../shared/tabla/pie-tabla';
import { ultimosDias } from '../../shared/tabla/selector-periodo';
import { ErrorCarga, PageHeader, Vacio } from '../../shared/ui';
import { DialogoProducto } from './producto-dialogo';

/** Ventana con la que se mide qué rota: un mes corrido, en todas las sucursales. */
const DIAS_VENTAS = 30;

type Columna = 'nombre' | 'marca' | 'categoria' | 'precio' | 'margen' | 'stock' | 'vendidas' | 'utilidad';

interface FilaProducto {
  producto: Producto;
  marca: string;
  categoria: string;
  principal: string;
  idPrincipal: number | null;
  margen: number;
  unidades: number;
  ingresos: number;
  utilidad: number;
}

/**
 * Catálogo de la cadena con lo que rotó cada producto en los últimos 30 días.
 * Sirve para decidir qué empujar, qué revisar de precio y qué dejar de surtir:
 * el orden por columna responde cuál vende más o deja más utilidad.
 */
@Component({
  selector: 'app-productos',
  imports: [
    RouterLink,
    FaIconComponent,
    NgbTooltip,
    PageHeader,
    ErrorCarga,
    Vacio,
    EsqueletoTabla,
    CampoBusqueda,
    BarraCelda,
    PieTabla,
    PesosPipe,
    EncabezadoOrden,
  ],
  templateUrl: './productos.html',
})
export class Productos {
  private readonly repo = inject(ProductosRepository);
  private readonly marcasRepo = inject(MarcasRepository);
  private readonly categoriasRepo = inject(CategoriasRepository);
  private readonly estadisticas = inject(EstadisticasRepository);
  private readonly dialogo = inject(DialogoProducto);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);

  /** ?marca=ID, para llegar filtrado desde el catálogo de marcas. */
  readonly marca = input<string>();
  /** ?categoria=ID (principal o subcategoría), desde el catálogo de categorías. */
  readonly categoria = input<string>();
  /** ?q=texto, búsqueda inicial. */
  readonly q = input<string>();

  protected readonly iconos = { faFileArrowDown, faPen, faPlus, faScrewdriverWrench, faTrashCan };
  protected readonly periodo = ultimosDias(DIAS_VENTAS);
  protected readonly textoPeriodo = `del ${diaMes(this.periodo.desde)} al ${diaMes(this.periodo.hasta)}`;

  protected readonly busqueda = linkedSignal(() => this.q() ?? '');
  protected readonly idMarca = linkedSignal(() => idDesde(this.marca()));
  protected readonly idCategoria = linkedSignal(() => idDesde(this.categoria()));
  protected readonly soloSinVentas = signal(false);
  protected readonly orden = new Orden<Columna>();
  protected readonly porPagina = signal(15);

  protected readonly catalogo = resource({
    loader: async () => {
      const [productos, marcas, categorias, rendimiento] = await Promise.all([
        this.repo.listar(),
        this.marcasRepo.listar(),
        this.categoriasRepo.listar(),
        this.estadisticas.rendimientoPorProducto({ idSucursal: null, ...this.periodo }),
      ]);
      const filas: FilaProducto[] = productos.map((producto) => {
        const categoria = categorias.find((c) => c.idCategoria === producto.idCategoria);
        const principal = categoria?.idCategoriaPrincipal
          ? categorias.find((c) => c.idCategoria === categoria.idCategoriaPrincipal)
          : categoria;
        const ventas = rendimiento.find((r) => r.idProducto === producto.idProducto);
        return {
          producto,
          marca: marcas.find((m) => m.idMarca === producto.idMarca)?.nombre ?? '',
          categoria: categoria?.nombre ?? '',
          principal: principal?.nombre ?? '',
          idPrincipal: principal?.idCategoria ?? null,
          margen: (producto.precioBaseVenta - producto.costoCompra) / producto.precioBaseVenta,
          unidades: ventas?.unidades ?? 0,
          ingresos: ventas?.total ?? 0,
          utilidad: ventas?.utilidadEstimada ?? 0,
        };
      });
      return { filas, marcas, categorias };
    },
  });

  protected readonly principales = computed(() =>
    (this.catalogo.value()?.categorias ?? []).filter((c) => c.idCategoriaPrincipal === null),
  );

  /** La categoría elegida si es una subcategoría (llega así desde el catálogo de categorías). */
  protected readonly subcategoriaElegida = computed<Categoria | null>(() => {
    const id = this.idCategoria();
    const categoria = (this.catalogo.value()?.categorias ?? []).find((c) => c.idCategoria === id);
    return categoria && categoria.idCategoriaPrincipal !== null ? categoria : null;
  });

  /** Filas que pasan búsqueda, marca y categoría; el interruptor se aplica después para poder contarlo. */
  private readonly sinInterruptor = computed(() => {
    const texto = normalizar(this.busqueda());
    const idMarca = this.idMarca();
    const idCategoria = this.idCategoria();
    return (this.catalogo.value()?.filas ?? []).filter(
      (f) =>
        (idMarca === null || f.producto.idMarca === idMarca) &&
        (idCategoria === null || f.producto.idCategoria === idCategoria || f.idPrincipal === idCategoria) &&
        (!texto ||
          normalizar(f.producto.nombre).includes(texto) ||
          normalizar(f.producto.codigo).includes(texto) ||
          normalizar(f.marca).includes(texto)),
    );
  });

  protected readonly cantidadSinVentas = computed(() => this.sinInterruptor().filter((f) => f.unidades === 0).length);

  protected readonly filtrados = computed(() =>
    this.soloSinVentas() ? this.sinInterruptor().filter((f) => f.unidades === 0) : this.sinInterruptor(),
  );

  protected readonly ordenados = computed(() =>
    this.orden.aplicar(this.filtrados(), {
      nombre: (f) => f.producto.nombre,
      marca: (f) => f.marca,
      categoria: (f) => f.categoria,
      precio: (f) => f.producto.precioBaseVenta,
      margen: (f) => f.margen,
      stock: (f) => f.producto.stock,
      vendidas: (f) => f.unidades,
      utilidad: (f) => f.utilidad,
    }),
  );

  /** Vuelve a la primera página cuando cambian los filtros o el orden. */
  protected readonly pagina = linkedSignal(() => {
    this.filtrados();
    this.orden.estado();
    return 1;
  });

  protected readonly paginaActual = computed(() => paginar(this.ordenados(), this.pagina(), this.porPagina()));

  /** Topes de las barras: el mayor de las filas filtradas, para comparar lo que se ve. */
  protected readonly maxUnidades = computed(() => Math.max(0, ...this.filtrados().map((f) => f.unidades)));
  protected readonly maxUtilidad = computed(() => Math.max(0, ...this.filtrados().map((f) => f.utilidad)));

  protected readonly filtrosActivos = computed(
    () =>
      [this.busqueda().trim() !== '', this.idMarca() !== null, this.idCategoria() !== null, this.soloSinVentas()].filter(Boolean)
        .length,
  );

  protected elegirMarca(idMarca: number | null): void {
    this.idMarca.set(idMarca);
    this.reflejarEnUrl();
  }

  protected elegirCategoria(idCategoria: number | null): void {
    this.idCategoria.set(idCategoria);
    this.reflejarEnUrl();
  }

  protected quitarFiltros(): void {
    this.busqueda.set('');
    this.idMarca.set(null);
    this.idCategoria.set(null);
    this.soloSinVentas.set(false);
    this.reflejarEnUrl();
  }

  protected proporcion(valor: number, maximo: number): number {
    return maximo > 0 ? Math.max(0, valor) / maximo : 0;
  }

  protected unidades(valor: number): string {
    return numero(valor);
  }

  protected dinero(valor: number): string {
    return pesos(valor);
  }

  protected porcentaje(valor: number): string {
    return `${Math.round(valor * 100)} %`;
  }

  protected exportar(): void {
    descargarCsv(
      `productos-${this.periodo.hasta}`,
      [
        { titulo: 'Código', valor: (f) => f.producto.codigo },
        { titulo: 'Producto', valor: (f) => f.producto.nombre },
        { titulo: 'Marca', valor: (f) => f.marca },
        { titulo: 'Categoría', valor: (f) => f.categoria },
        { titulo: 'Categoría principal', valor: (f) => f.principal },
        { titulo: 'Costo de compra', valor: (f) => f.producto.costoCompra },
        { titulo: 'Precio base de venta', valor: (f) => f.producto.precioBaseVenta },
        { titulo: 'Margen de catálogo (%)', valor: (f) => Math.round(f.margen * 100) },
        { titulo: 'Stock', valor: (f) => f.producto.stock },
        { titulo: `Unidades vendidas (${this.periodo.desde} a ${this.periodo.hasta})`, valor: (f) => f.unidades },
        { titulo: 'Ingresos del periodo', valor: (f) => f.ingresos },
        { titulo: 'Utilidad estimada del periodo (costo actual)', valor: (f) => Math.round(f.utilidad) },
      ],
      this.ordenados(),
    );
  }

  protected async editar(producto: Producto | null): Promise<void> {
    const datos = this.catalogo.value();
    if (!datos) return;
    const guardado = await this.dialogo.abrir(producto, datos);
    if (!guardado) return;
    if (producto) {
      this.avisos.exito('Cambios guardados.');
      this.catalogo.reload();
      return;
    }
    // Un producto nuevo no está en ninguna sucursal: su ficha tiene "Agregar a esta sucursal" en cada una.
    this.avisos.exito(`Producto ${guardado.nombre} creado. Agrégalo a cada sucursal que lo maneje.`);
    void this.router.navigate(['/productos', guardado.idProducto]);
  }

  protected async eliminar(producto: Producto): Promise<void> {
    const confirmado = await this.confirmar.preguntar({
      titulo: 'Eliminar producto',
      mensaje: `Se eliminará ${producto.nombre} (${producto.codigo}) del catálogo. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar producto',
      peligro: true,
    });
    if (!confirmado) return;
    try {
      await this.repo.eliminar(producto.idProducto);
      this.avisos.exito('Producto eliminado.');
      this.catalogo.reload();
    } catch (error) {
      this.avisos.error(mensajeDeError(error));
    }
  }

  /** Marca y categoría quedan en la dirección para poder compartir o recargar la vista filtrada. */
  private reflejarEnUrl(): void {
    void this.router.navigate([], {
      queryParams: { marca: this.idMarca() ?? null, categoria: this.idCategoria() ?? null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function idDesde(valor: string | undefined): number | null {
  const id = Number(valor);
  return valor && Number.isInteger(id) && id > 0 ? id : null;
}
