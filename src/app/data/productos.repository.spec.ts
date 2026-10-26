import { TestBed } from '@angular/core/testing';
import { DomainError, NoEncontrado } from '../core/domain-error';
import { MockDb } from './mock-db';
import { InventarioRepository, ProductosRepository } from './productos.repository';
import { ProveedoresRepository } from './proveedores.repository';

describe('InventarioRepository.registrarEntrada', () => {
  let inventario: InventarioRepository;
  let productos: ProductosRepository;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    TestBed.inject(MockDb).restaurar();
    inventario = TestBed.inject(InventarioRepository);
    productos = TestBed.inject(ProductosRepository);
  });

  it('suma a la cantidad vigente aunque dos entradas lleguen a la vez', async () => {
    const [fila] = await inventario.listar(1);
    const antes = await productos.obtener(fila.idProducto);

    await Promise.all([
      inventario.registrarEntrada(fila.idProducto, 1, 3),
      inventario.registrarEntrada(fila.idProducto, 1, 4),
    ]);

    const [despues, producto] = await Promise.all([inventario.listar(1), productos.obtener(fila.idProducto)]);
    const registro = despues.find((f) => f.idProducto === fila.idProducto)!;
    expect(registro.cantidadDisponible).toBe(fila.cantidadDisponible + 7);
    expect(registro.ubicacionBodega).toBe(fila.ubicacionBodega);
    expect(producto.stock).toBe(antes.stock + 7);
  });

  it('crea el registro cuando el producto no está en la sucursal y exige la ubicación', async () => {
    // En la semilla la Sede Norte (2) no maneja el vinilo tipo 2 (producto 13).
    await expect(inventario.registrarEntrada(13, 2, 10)).rejects.toBeInstanceOf(DomainError);
    expect((await inventario.listar(2)).some((f) => f.idProducto === 13)).toBe(false);

    const creado = await inventario.registrarEntrada(13, 2, 10, '  Bodega trasera, estante A ');

    expect(creado).toEqual({ idProducto: 13, idSucursal: 2, cantidadDisponible: 10, ubicacionBodega: 'Bodega trasera, estante A' });
    expect((await inventario.listar(2)).find((f) => f.idProducto === 13)?.cantidadDisponible).toBe(10);
  });

  it('rechaza unidades que no son enteros mayores que cero', async () => {
    const resultados = await Promise.allSettled([
      inventario.registrarEntrada(1, 1, 0),
      inventario.registrarEntrada(1, 1, -2),
      inventario.registrarEntrada(1, 1, 1.5),
    ]);
    for (const r of resultados) {
      expect(r.status === 'rejected' && r.reason).toBeInstanceOf(DomainError);
    }
  });
});

describe('obtener por llave', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    TestBed.inject(MockDb).restaurar();
  });

  it('ProductosRepository.obtener lanza NoEncontrado si el producto no existe', async () => {
    await expect(TestBed.inject(ProductosRepository).obtener(99999)).rejects.toBeInstanceOf(NoEncontrado);
  });

  it('ProveedoresRepository.obtener encuentra por NIT y lanza NoEncontrado si no existe', async () => {
    const proveedores = TestBed.inject(ProveedoresRepository);
    const [encontrado, inexistente] = await Promise.allSettled([
      proveedores.obtener(' 900215334-1 '),
      proveedores.obtener('000000000-0'),
    ]);
    expect(encontrado.status === 'fulfilled' && encontrado.value.nit).toBe('900215334-1');
    expect(inexistente.status === 'rejected' && inexistente.reason).toBeInstanceOf(NoEncontrado);
  });
});
