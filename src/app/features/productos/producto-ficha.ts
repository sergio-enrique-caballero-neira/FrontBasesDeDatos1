import { Component, computed, inject, input, linkedSignal, resource } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faBoxOpen,
  faClipboardCheck,
  faPen,
  faPlus,
  faReceipt,
  faStar,
  faTrashCan,
  faTriangleExclamation,
  faTruckRampBox,
} from '@fortawesome/free-solid-svg-icons';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../../core/avisos';
import { NoEncontrado } from '../../core/domain-error';
import { Inventario, Producto, Sucursal, Suministro, UMBRAL_STOCK_BAJO } from '../../core/models';
import { Session } from '../../core/session';
import { CategoriasRepository, MarcasRepository, SucursalesRepository } from '../../data/catalogos.repository';
import { EstadisticasRepository } from '../../data/estadisticas.repository';
import { InventarioRepository, ProductosRepository } from '../../data/productos.repository';
import {
  claveSuministro,
  EvaluacionesRepository,
  ProveedoresRepository,
  SuministrosRepository,
} from '../../data/proveedores.repository';
import { LineaVendida, VentasRepository } from '../../data/ventas.repository';
import { Confirmar } from '../../shared/confirmar';
import { EsqueletoBloque, EsqueletoTabla } from '../../shared/esqueleto';
import { diaLargo, diaMes, FechaPipe, numero, pesos, PesosPipe } from '../../shared/formato';
import { abrirFormulario } from '../../shared/formulario-dialogo';
import { GraficoColumnas } from '../../shared/graficos/grafico-columnas';
import { PuntoTiempo } from '../../shared/graficos/grafico-tiempo';
import { Migas } from '../../shared/migas';
import { EncabezadoOrden, Orden } from '../../shared/orden';
import { ultimosDias } from '../../shared/tabla/selector-periodo';
import { ErrorCarga, Vacio } from '../../shared/ui';
import { abrirDialogoEvaluacion, SuministroElegible, suministrosElegibles } from '../evaluaciones/evaluacion-dialogo';
import { dialogoInventario } from '../inventario/inventario-dialogo';
import { DialogoProducto } from './producto-dialogo';

const DIAS_VENTAS = 30;
const LINEAS_RECIENTES = 10;

interface FilaExistencia {
  sucursal: Sucursal;
  registro: Inventario | null;
  vendidas: number;
}

interface FilaSuministro {
  clave: string;
  suministro: Suministro;
  proveedor: string;
  sucursal: string;
  margen: number;
  evaluaciones: number;
  promedio: number | null;
  elegible: SuministroElegible | undefined;
}

interface LineaFicha extends LineaVendida {
  sucursal: string;
}

@Component({
  selector: 'app-producto-ficha',
  imports: [
    RouterLink,
    FaIconComponent,
    Migas,
    ErrorCarga,
    Vacio,
    EsqueletoBloque,
    EsqueletoTabla,
    GraficoColumnas,
    EncabezadoOrden,
    PesosPipe,
    FechaPipe,
  ],
  templateUrl: './producto-ficha.html',
  styleUrl: './producto-ficha.css',
})
export class ProductoFicha {
  private readonly session = inject(Session);
  private readonly productosRepo = inject(ProductosRepository);
  private readonly inventarioRepo = inject(InventarioRepository);
  private readonly marcasRepo = inject(MarcasRepository);
  private readonly categoriasRepo = inject(CategoriasRepository);
  private readonly sucursalesRepo = inject(SucursalesRepository);
  private readonly suministrosRepo = inject(SuministrosRepository);
  private readonly proveedoresRepo = inject(ProveedoresRepository);
  private readonly evaluacionesRepo = inject(EvaluacionesRepository);
  private readonly ventasRepo = inject(VentasRepository);
  private readonly estadisticas = inject(EstadisticasRepository);
  private readonly dialogoProducto = inject(DialogoProducto);
  private readonly modal = inject(NgbModal);
  private readonly confirmar = inject(Confirmar);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly iconos = {
    faBoxOpen,
    faClipboardCheck,
    faPen,
    faPlus,
    faReceipt,
    faStar,
    faTrashCan,
    faTriangleExclamation,
    faTruckRampBox,
  };
  protected readonly umbral = UMBRAL_STOCK_BAJO;
  protected readonly veProveedores = computed(() => this.session.tieneNivel(2));
  protected readonly ordenProveedores = new Orden<'proveedor' | 'sucursal' | 'precio' | 'entrega' | 'calidad'>();

  protected readonly ficha = resource({
    params: () => ({ idProducto: Number(this.id()), conProveedores: this.veProveedores() }),
    loader: async ({ params: { idProducto, conProveedores } }) => {
      const periodo = ultimosDias(DIAS_VENTAS);
      const filtro = { idSucursal: null, ...periodo };
      const [producto, marcas, categorias, inventario, sucursales, suministros, proveedores, evaluaciones, ventas, lineas] =
        await Promise.all([
          this.productosRepo.obtener(idProducto),
          this.marcasRepo.listar(),
          this.categoriasRepo.listar(),
          this.inventarioRepo.listar(null),
          this.sucursalesRepo.listar(),
          conProveedores ? this.suministrosRepo.listar() : Promise.resolve([]),
          conProveedores ? this.proveedoresRepo.listar() : Promise.resolve([]),
          conProveedores ? this.evaluacionesRepo.listar() : Promise.resolve([]),
          this.estadisticas.ventasDeProducto(idProducto, filtro),
          this.ventasRepo.listarLineas(filtro),
        ]);

      const categoria = categorias.find((c) => c.idCategoria === producto.idCategoria);
      const principal = categoria?.idCategoriaPrincipal
        ? categorias.find((c) => c.idCategoria === categoria.idCategoriaPrincipal)
        : undefined;
      const nombreSucursal = (id: number) => sucursales.find((s) => s.idSucursal === id)?.nombre ?? 'Sucursal eliminada';

      const suyas: LineaFicha[] = lineas
        .filter((l) => l.idProducto === idProducto)
        .map((l) => ({ ...l, sucursal: nombreSucursal(l.idSucursal) }));

      const existencias: FilaExistencia[] = sucursales.map((sucursal) => ({
        sucursal,
        registro: inventario.find((i) => i.idProducto === idProducto && i.idSucursal === sucursal.idSucursal) ?? null,
        vendidas: suyas.filter((l) => l.idSucursal === sucursal.idSucursal).reduce((s, l) => s + l.cantidad, 0),
      }));

      const propios = suministros.filter((s) => s.idProducto === idProducto);
      const elegibles = suministrosElegibles(propios, proveedores, [producto], sucursales);
      const filasSuministro: FilaSuministro[] = propios
        .map((suministro) => {
          const clave = claveSuministro(suministro);
          const notas = evaluaciones.filter((e) => claveSuministro(e) === clave).map((e) => e.calificacion);
          return {
            clave,
            suministro,
            proveedor: proveedores.find((p) => p.nit === suministro.nit)?.nombre ?? 'Proveedor eliminado',
            sucursal: nombreSucursal(suministro.idSucursal),
            margen: (producto.precioBaseVenta - suministro.precioSuministro) / producto.precioBaseVenta,
            evaluaciones: notas.length,
            promedio: notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null,
            elegible: elegibles.find((e) => e.clave === clave),
          };
        })
        .sort((a, b) => a.suministro.precioSuministro - b.suministro.precioSuministro || a.proveedor.localeCompare(b.proveedor, 'es'));

      const precios = propios.map((s) => s.precioSuministro);
      const puntos: PuntoTiempo[] = ventas.porDia.map((d) => ({
        fecha: d.fecha,
        valor: d.cantidad,
        detalle: d.cantidad > 0 ? `${pesos(d.total)} en ventas` : undefined,
      }));

      return {
        producto,
        marca: marcas.find((m) => m.idMarca === producto.idMarca)?.nombre ?? 'Sin marca',
        categoria: categoria?.nombre ?? 'Sin categoría',
        principal: principal?.nombre ?? null,
        periodo,
        existencias,
        sucursalesConRegistro: existencias.filter((e) => e.registro).length,
        totalDisponible: existencias.reduce((s, e) => s + (e.registro?.cantidadDisponible ?? 0), 0),
        totalVendidas: suyas.reduce((s, l) => s + l.cantidad, 0),
        suministros: filasSuministro,
        costoReal: precios.length ? { minimo: Math.min(...precios), maximo: Math.max(...precios) } : null,
        proveedores,
        sucursales,
        catalogos: { marcas, categorias },
        ventas: {
          unidades: ventas.unidades,
          total: ventas.total,
          facturas: new Set(suyas.map((l) => l.idVenta)).size,
          puntos,
          lineas: suyas,
        },
      };
    },
  });

  protected readonly noExiste = computed(() => this.ficha.error() instanceof NoEncontrado);

  protected readonly nombre = computed(() => {
    if (this.ficha.hasValue()) return this.ficha.value().producto.nombre;
    return this.noExiste() ? 'Producto no encontrado' : 'Producto';
  });

  protected readonly migas = computed(() => [{ texto: 'Productos', enlace: '/productos' }, { texto: this.nombre() }]);

  protected readonly diaElegido = linkedSignal<number, string | null>({ source: () => Number(this.id()), computation: () => null });

  protected readonly rangoPeriodo = computed(() => {
    const periodo = this.ficha.value()?.periodo;
    return periodo ? `${diaMes(periodo.desde)} al ${diaMes(periodo.hasta)}` : '';
  });

  protected readonly textoPeriodo = computed(() => `del ${this.rangoPeriodo()}`);

  protected readonly lineasVisibles = computed(() => {
    const lineas = this.ficha.value()?.ventas.lineas ?? [];
    const dia = this.diaElegido();
    return dia ? lineas.filter((l) => l.fecha === dia) : lineas.slice(0, LINEAS_RECIENTES);
  });

  protected readonly suministrosOrdenados = computed(() =>
    this.ordenProveedores.aplicar(this.ficha.value()?.suministros ?? [], {
      proveedor: (f) => f.proveedor,
      sucursal: (f) => f.sucursal,
      precio: (f) => f.suministro.precioSuministro,
      entrega: (f) => f.suministro.tiempoEntregaDias,
      calidad: (f) => f.promedio,
    }),
  );

  protected readonly formatoUnidades = (valor: number): string => `${numero(valor)} ${valor === 1 ? 'unidad' : 'unidades'}`;
  protected readonly formatoEje = (valor: number): string => numero(valor);

  protected cifra(valor: number): string {
    return numero(valor);
  }

  protected unidades(valor: number): string {
    return this.formatoUnidades(valor);
  }

  protected porcentaje(valor: number): string {
    return `${Math.round(valor * 100)} %`;
  }

  protected calificacion(valor: number): string {
    return numero(Math.round(valor * 10) / 10);
  }

  protected dias(valor: number): string {
    if (valor === 0) return 'Mismo día';
    return `${valor} ${valor === 1 ? 'día' : 'días'}`;
  }

  protected tituloLineas(): string {
    const dia = this.diaElegido();
    return dia ? `Ventas del ${diaLargo(dia)}` : 'Ventas más recientes';
  }

  protected async editar(): Promise<void> {
    if (!this.ficha.hasValue()) return;
    const { producto, catalogos } = this.ficha.value();
    const guardado = await this.dialogoProducto.abrir(producto, catalogos);
    if (guardado) {
      this.avisos.exito('Cambios guardados.');
      this.ficha.reload();
    }
  }

  protected async eliminar(): Promise<void> {
    if (!this.ficha.hasValue()) return;
    const producto = this.ficha.value().producto;
    const eliminado = await this.confirmar.eliminar({
      titulo: 'Eliminar producto',
      mensaje: `Se eliminará ${producto.nombre} (${producto.codigo}) del catálogo. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar producto',
      accion: (clave) => this.productosRepo.eliminar(producto.idProducto, clave),
    });
    if (!eliminado) return;
    this.avisos.exito(`Producto ${producto.nombre} eliminado.`);
    void this.router.navigate(['/productos']);
  }

  protected async registrarEntrada(fila: FilaExistencia): Promise<void> {
    if (!this.ficha.hasValue()) return;
    const producto: Producto = this.ficha.value().producto;
    const resultado = await dialogoInventario(this.modal, {
      sucursal: fila.sucursal,
      registro: fila.registro,
      productos: [producto],
      modo: 'entrada',
    });
    if (resultado) {
      const queda = `${fila.sucursal.nombre} queda con ${this.formatoUnidades(resultado.registro.cantidadDisponible)} de ${producto.nombre}.`;
      this.avisos.exito(`${resultado.modo === 'entrada' ? 'Entrada registrada' : 'Conteo guardado'}. ${queda}`);
      this.ficha.reload();
    }
  }

  protected async registrarSuministro(): Promise<void> {
    if (!this.ficha.hasValue()) return;
    const { producto, proveedores, sucursales } = this.ficha.value();
    const guardado = await abrirFormulario(this.modal, {
      titulo: 'Nuevo suministro',
      textoGuardar: 'Registrar suministro',
      campos: [
        {
          clave: 'nit',
          etiqueta: 'Proveedor',
          tipo: 'select',
          requerido: true,
          opciones: proveedores.map((p) => ({ valor: p.nit, texto: p.nombre })),
        },
        {
          clave: 'idProducto',
          etiqueta: 'Producto',
          tipo: 'select',
          requerido: true,
          soloLectura: true,
          opciones: [{ valor: String(producto.idProducto), texto: `${producto.codigo} · ${producto.nombre}` }],
        },
        {
          clave: 'idSucursal',
          etiqueta: 'Sucursal que recibe',
          tipo: 'select',
          requerido: true,
          opciones: sucursales.map((s) => ({ valor: String(s.idSucursal), texto: `${s.nombre} · ${s.ciudad}` })),
        },
        {
          clave: 'precioSuministro',
          etiqueta: 'Precio de suministro por unidad (COP)',
          tipo: 'number',
          requerido: true,
          minimo: 1,
          mitad: true,
          ayuda: `El precio base de venta es ${pesos(producto.precioBaseVenta)}.`,
        },
        { clave: 'tiempoEntregaDias', etiqueta: 'Tiempo de entrega (días)', tipo: 'number', requerido: true, minimo: 0, maximo: 120, mitad: true },
      ],
      valores: { idProducto: String(producto.idProducto) },
      guardar: (v) =>
        this.suministrosRepo.guardar(
          {
            nit: v['nit'],
            idProducto: producto.idProducto,
            idSucursal: Number(v['idSucursal']),
            precioSuministro: Math.round(Number(v['precioSuministro'])),
            tiempoEntregaDias: Math.round(Number(v['tiempoEntregaDias'])),
          },
          true,
        ),
    });
    if (guardado) {
      this.avisos.exito('Suministro registrado.');
      this.ficha.reload();
    }
  }

  protected async evaluar(fila: FilaSuministro): Promise<void> {
    const datos = this.ficha.value();
    if (!datos || !fila.elegible) return;
    const elegibles = datos.suministros.flatMap((s) => (s.elegible ? [s.elegible] : []));
    if (await abrirDialogoEvaluacion(this.modal, elegibles, fila.elegible)) {
      this.avisos.exito(`Evaluación de ${fila.proveedor} registrada.`);
      this.ficha.reload();
    }
  }
}
