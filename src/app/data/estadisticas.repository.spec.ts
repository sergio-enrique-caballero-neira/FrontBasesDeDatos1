import { TestBed } from '@angular/core/testing';
import { fechaISO, sumarDias } from '../core/fechas';
import { COMISION_VENDEDOR, UMBRAL_STOCK_BAJO } from '../core/models';
import { EstadisticasRepository, FiltroPeriodo } from './estadisticas.repository';
import { MockDb } from './mock-db';

describe('EstadisticasRepository', () => {
  let estadisticas: EstadisticasRepository;
  let db: MockDb;

  const hoy = new Date();
  /** Cubre todas las ventas semilla (llegan hasta 20 días atrás). */
  const todo: FiltroPeriodo = { idSucursal: null, desde: fechaISO(sumarDias(hoy, -40)), hasta: fechaISO(hoy) };
  /** Un periodo sin ventas. */
  const futuro: FiltroPeriodo = { idSucursal: null, desde: fechaISO(sumarDias(hoy, 10)), hasta: fechaISO(sumarDias(hoy, 12)) };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    db = TestBed.inject(MockDb);
    db.restaurar();
    estadisticas = TestBed.inject(EstadisticasRepository);
  });

  it('unidadesPorInventario reparte todas las unidades vendidas y trae cada registro de inventario', async () => {
    const [porPar, resumen, inventario] = await Promise.all([
      estadisticas.unidadesPorInventario({ ...todo, idSucursal: 1 }),
      estadisticas.resumen({ ...todo, idSucursal: 1 }),
      db.leer('inventario'),
    ]);
    expect(porPar.reduce((s, p) => s + p.unidades, 0)).toBe(resumen.unidades);
    expect(porPar.every((p) => p.idSucursal === 1)).toBe(true);
    for (const fila of inventario.filter((i) => i.idSucursal === 1)) {
      expect(porPar.some((p) => p.idProducto === fila.idProducto)).toBe(true);
    }
  });

  it('rendimientoPorProducto trae todo el catálogo y calcula la utilidad con el costo actual', async () => {
    const [rendimiento, resumen, productos, ventas, detalles] = await Promise.all([
      estadisticas.rendimientoPorProducto(todo),
      estadisticas.resumen(todo),
      db.leer('productos'),
      db.leer('ventas'),
      db.leer('detallesVenta'),
    ]);
    expect(rendimiento).toHaveLength(productos.length);
    expect(rendimiento.reduce((s, r) => s + r.total, 0)).toBe(resumen.total);

    const primero = rendimiento[0];
    const costo = productos.find((p) => p.idProducto === primero.idProducto)!.costoCompra;
    const ids = new Set(ventas.filter((v) => v.fecha >= todo.desde && v.fecha <= todo.hasta).map((v) => v.idVenta));
    const esperada = detalles
      .filter((d) => d.idProducto === primero.idProducto && ids.has(d.idVenta))
      .reduce((s, d) => s + d.cantidad * (d.precioUnitario - costo), 0);
    expect(primero.utilidadEstimada).toBe(esperada);
  });

  it('rendimientoPorProducto deja en cero los productos sin ventas', async () => {
    const [rendimiento, productos] = await Promise.all([estadisticas.rendimientoPorProducto(futuro), db.leer('productos')]);
    expect(rendimiento).toHaveLength(productos.length);
    expect(rendimiento.every((r) => r.unidades === 0 && r.total === 0 && r.utilidadEstimada === 0)).toBe(true);
  });

  it('porSucursalDetallado incluye sucursales sin ventas con su inventario', async () => {
    const [detallado, sucursales, inventario, productos] = await Promise.all([
      estadisticas.porSucursalDetallado(futuro),
      db.leer('sucursales'),
      db.leer('inventario'),
      db.leer('productos'),
    ]);
    expect(detallado).toHaveLength(sucursales.length);
    const costoDe = new Map(productos.map((p) => [p.idProducto, p.costoCompra]));
    for (const s of detallado) {
      const filas = inventario.filter((i) => i.idSucursal === s.idSucursal);
      expect(s).toMatchObject({ cantidad: 0, total: 0, ticketPromedio: 0, utilidadEstimada: 0 });
      expect(s.productosStockBajo).toBe(filas.filter((f) => f.cantidadDisponible <= UMBRAL_STOCK_BAJO).length);
      expect(s.capitalInventario).toBe(filas.reduce((acc, f) => acc + f.cantidadDisponible * costoDe.get(f.idProducto)!, 0));
    }
  });

  it('porSucursalDetallado reparte el total del periodo entre las sucursales', async () => {
    const [detallado, resumen] = await Promise.all([estadisticas.porSucursalDetallado(todo), estadisticas.resumen(todo)]);
    expect(detallado.reduce((s, d) => s + d.total, 0)).toBe(resumen.total);
    expect(detallado.reduce((s, d) => s + d.cantidad, 0)).toBe(resumen.cantidad);
  });

  it('comisiones solo incluye vendedores y aplica su tasa', async () => {
    const [comisiones, resumen, empleados] = await Promise.all([
      estadisticas.comisiones(todo),
      estadisticas.resumen(todo),
      db.leer('empleados'),
    ]);
    const vendedores = empleados.filter((e) => e.rol === 'VENDEDOR');
    expect(comisiones.map((c) => c.idEmpleado).sort()).toEqual(vendedores.map((e) => e.idEmpleado).sort());
    expect(comisiones.reduce((s, c) => s + c.total, 0)).toBe(resumen.total);
    for (const c of comisiones) {
      const tasa = vendedores.find((e) => e.idEmpleado === c.idEmpleado)!.comisionVenta ?? COMISION_VENDEDOR;
      expect(c.tasa).toBe(tasa);
      expect(c.comision).toBeCloseTo(c.total * tasa, 6);
      expect(c.sucursales.length > 0).toBe(c.cantidad > 0);
    }
  });

  it('comisiones con una sucursal filtrada solo muestra a quien vendió allí', async () => {
    const comisiones = await estadisticas.comisiones({ ...todo, idSucursal: 3 });
    expect(comisiones.every((c) => c.cantidad > 0 && c.sucursales.length === 1)).toBe(true);
  });
});
