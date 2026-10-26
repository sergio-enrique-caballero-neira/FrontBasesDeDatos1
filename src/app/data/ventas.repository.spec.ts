import { TestBed } from '@angular/core/testing';
import { DomainError, NoEncontrado } from '../core/domain-error';
import { MockDb } from './mock-db';
import { InventarioRepository, ProductosRepository } from './productos.repository';
import { VentasRepository } from './ventas.repository';

describe('VentasRepository.registrar', () => {
  let ventas: VentasRepository;
  let inventario: InventarioRepository;
  let productos: ProductosRepository;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    TestBed.inject(MockDb).restaurar();
    ventas = TestBed.inject(VentasRepository);
    inventario = TestBed.inject(InventarioRepository);
    productos = TestBed.inject(ProductosRepository);
  });

  async function filaConStock(idSucursal: number, minimo: number) {
    const filas = await inventario.listar(idSucursal);
    const fila = filas.find((f) => f.cantidadDisponible >= minimo);
    if (!fila) throw new Error('Los datos semilla no tienen stock suficiente para la prueba');
    return fila;
  }

  it('calcula el total desde las líneas y descuenta el inventario de la sucursal', async () => {
    const fila = await filaConStock(1, 2);
    const producto = (await productos.listar()).find((p) => p.idProducto === fila.idProducto)!;

    const { venta, detalles } = await ventas.registrar({
      idCliente: 1,
      idMetodoPago: 1,
      idSucursal: 1,
      idEmpleado: 3,
      lineas: [{ idProducto: fila.idProducto, cantidad: 2 }],
    });

    expect(venta.montoTotal).toBe(producto.precioBaseVenta * 2);
    expect(detalles).toEqual([
      { idVenta: venta.idVenta, idProducto: fila.idProducto, cantidad: 2, precioUnitario: producto.precioBaseVenta },
    ]);
    const despues = (await inventario.listar(1)).find((f) => f.idProducto === fila.idProducto)!;
    expect(despues.cantidadDisponible).toBe(fila.cantidadDisponible - 2);
    const productoDespues = (await productos.listar()).find((p) => p.idProducto === fila.idProducto)!;
    expect(productoDespues.stock).toBe(producto.stock - 2);
  });

  it('rechaza la venta completa si una línea supera el stock y no toca el inventario', async () => {
    const conStock = await filaConStock(1, 1);
    const otra = (await inventario.listar(1)).find((f) => f.idProducto !== conStock.idProducto)!;

    await expect(
      ventas.registrar({
        idCliente: 1,
        idMetodoPago: 1,
        idSucursal: 1,
        idEmpleado: 3,
        lineas: [
          { idProducto: conStock.idProducto, cantidad: 1 },
          { idProducto: otra.idProducto, cantidad: otra.cantidadDisponible + 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(DomainError);

    const sinCambios = (await inventario.listar(1)).find((f) => f.idProducto === conStock.idProducto)!;
    expect(sinCambios.cantidadDisponible).toBe(conStock.cantidadDisponible);
  });

  it('solo permite que un vendedor registre ventas', async () => {
    const fila = await filaConStock(1, 1);
    await expect(
      ventas.registrar({
        idCliente: 1,
        idMetodoPago: 1,
        idSucursal: 1,
        idEmpleado: 1,
        lineas: [{ idProducto: fila.idProducto, cantidad: 1 }],
      }),
    ).rejects.toThrow('Solo un vendedor');
  });
});

describe('VentasRepository, consultas', () => {
  let ventas: VentasRepository;
  let db: MockDb;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    db = TestBed.inject(MockDb);
    db.restaurar();
    ventas = TestBed.inject(VentasRepository);
  });

  function enOrdenDescendente(filas: { fecha: string; hora: string }[]): boolean {
    return filas.every((f, i) => i === 0 || `${filas[i - 1].fecha} ${filas[i - 1].hora}` >= `${f.fecha} ${f.hora}`);
  }

  it('obtener lanza NoEncontrado si la venta no existe', async () => {
    await expect(ventas.obtener(99999)).rejects.toBeInstanceOf(NoEncontrado);
  });

  it('listar filtra por cliente y por método de pago', async () => {
    const todas = await db.leer('ventas');
    const { idCliente, idMetodoPago } = todas[0];

    const delCliente = await ventas.listar({ idSucursal: null, idCliente });
    expect(delCliente.length).toBe(todas.filter((v) => v.idCliente === idCliente).length);
    expect(delCliente.every((v) => v.idCliente === idCliente)).toBe(true);

    const conMetodo = await ventas.listar({ idSucursal: null, idMetodoPago });
    expect(conMetodo.length).toBe(todas.filter((v) => v.idMetodoPago === idMetodoPago).length);
    expect(conMetodo.every((v) => v.idMetodoPago === idMetodoPago)).toBe(true);
  });

  it('listarLineas devuelve una fila por detalle con los datos de su venta', async () => {
    const [lineas, todas, detalles] = await Promise.all([
      ventas.listarLineas({ idSucursal: 1 }),
      db.leer('ventas'),
      db.leer('detallesVenta'),
    ]);
    const deSucursal = new Map(todas.filter((v) => v.idSucursal === 1).map((v) => [v.idVenta, v]));

    expect(lineas.length).toBe(detalles.filter((d) => deSucursal.has(d.idVenta)).length);
    for (const linea of lineas) {
      const venta = deSucursal.get(linea.idVenta)!;
      expect(linea).toMatchObject({
        fecha: venta.fecha,
        hora: venta.hora,
        idSucursal: 1,
        idEmpleado: venta.idEmpleado,
        idCliente: venta.idCliente,
        numeroFactura: venta.numeroFactura,
      });
    }
    expect(enOrdenDescendente(lineas)).toBe(true);
  });

  it('historialCliente trae solo las compras del cliente, la más reciente primero', async () => {
    const todas = await db.leer('ventas');
    const idCliente = todas[0].idCliente;

    const historial = await ventas.historialCliente(idCliente);

    expect(historial.ventas.length).toBe(todas.filter((v) => v.idCliente === idCliente).length);
    expect(historial.ventas.every((v) => v.idCliente === idCliente)).toBe(true);
    expect(enOrdenDescendente(historial.ventas)).toBe(true);
    const ids = new Set(historial.ventas.map((v) => v.idVenta));
    expect(historial.detalles.length).toBeGreaterThan(0);
    expect(historial.detalles.every((d) => ids.has(d.idVenta))).toBe(true);
  });
});
