import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { URL_API } from '../core/configuracion';
import { DomainError, NoEncontrado } from '../core/domain-error';
import { InventarioRepository, ProductosRepository } from './productos.repository';

const MARTILLO = {
  idProducto: 1,
  codigo: 'HM-0001',
  nombreProducto: 'Martillo de uña 16 oz',
  descripcion: null,
  costoCompra: 18500,
  precioBaseVenta: 27900,
  idCategoria: 6,
  nombreCategoria: 'Martillos',
  idMarca: 1,
  nombreMarca: 'Stanley',
  stock: 42,
};

describe('ProductosRepository', () => {
  let http: HttpTestingController;
  let productos: ProductosRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    productos = TestBed.inject(ProductosRepository);
  });

  afterEach(() => http.verify());

  it('traduce el producto del back al modelo de las pantallas', async () => {
    const lista = productos.listar();
    http.expectOne(`${URL_API}/productos`).flush([MARTILLO]);
    expect(await lista).toEqual([
      {
        idProducto: 1,
        codigo: 'HM-0001',
        nombre: 'Martillo de uña 16 oz',
        descripcion: '',
        costoCompra: 18500,
        precioBaseVenta: 27900,
        stock: 42,
        idCategoria: 6,
        idMarca: 1,
      },
    ]);
  });

  it('editar envía PUT con los nombres de campo del back y sin el stock', async () => {
    const guardado = productos.guardar({
      idProducto: 1,
      codigo: 'HM-0001',
      nombre: 'Martillo de uña 20 oz',
      descripcion: 'Mango de fibra',
      costoCompra: 19000,
      precioBaseVenta: 29900,
      stock: 42,
      idCategoria: 6,
      idMarca: 1,
    });
    const peticion = http.expectOne(`${URL_API}/productos/1`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({
      codigo: 'HM-0001',
      nombreProducto: 'Martillo de uña 20 oz',
      descripcion: 'Mango de fibra',
      costoCompra: 19000,
      precioBaseVenta: 29900,
      idCategoria: 6,
      idMarca: 1,
    });
    peticion.flush({ ...MARTILLO, nombreProducto: 'Martillo de uña 20 oz' });
    expect((await guardado).nombre).toBe('Martillo de uña 20 oz');
  });

  it('obtener un producto que no existe lanza NoEncontrado', async () => {
    const respuesta = productos.obtener(99999);
    http.expectOne(`${URL_API}/productos/99999`).flush(
      { estado: 404, codigo: 'NO_ENCONTRADO', mensaje: 'No existe el producto con id 99999.' },
      { status: 404, statusText: 'Not Found' },
    );
    await expect(respuesta).rejects.toBeInstanceOf(NoEncontrado);
  });
});

describe('InventarioRepository', () => {
  let http: HttpTestingController;
  let inventario: InventarioRepository;
  const fila = {
    idSucursal: 2,
    nombreSucursal: 'Sede Norte',
    idProducto: 1,
    codigo: 'HM-0001',
    nombreProducto: 'Martillo',
    cantidadDisponible: 8,
    ubicacionBodega: 'A-3',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    inventario = TestBed.inject(InventarioRepository);
  });

  afterEach(() => http.verify());

  it('lista una sede o todas según el filtro', async () => {
    const deUna = inventario.listar(2);
    const deTodas = inventario.listar(null);
    http.expectOne(`${URL_API}/sucursales/2/inventario`).flush([fila]);
    http.expectOne(`${URL_API}/inventario`).flush([fila]);
    expect(await deUna).toEqual([{ idProducto: 1, idSucursal: 2, cantidadDisponible: 8, ubicacionBodega: 'A-3' }]);
    expect(await deTodas).toHaveLength(1);
  });

  it('una entrada de mercancía suma en el back con un POST, sin calcular la cantidad aquí', async () => {
    const entrada = inventario.registrarEntrada(1, 2, 5, '  ');
    const peticion = http.expectOne(`${URL_API}/inventario/2/1/entradas`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ unidades: 5, ubicacionBodega: null });
    peticion.flush({ ...fila, cantidadDisponible: 13 });
    expect((await entrada).cantidadDisponible).toBe(13);
  });

  it('retirar con unidades muestra la regla del back', async () => {
    const retiro = inventario.eliminar(1, 2, 'demo-admin');
    const peticion = http.expectOne(`${URL_API}/inventario/2/1`);
    expect(peticion.request.headers.get('X-Clave-Seguridad')).toBe('demo-admin');
    peticion.flush(
      { estado: 400, codigo: 'REGLA_NEGOCIO', mensaje: 'Aún quedan 8 unidades en esta sucursal. Lleve la cantidad a 0 antes de retirar el producto.' },
      { status: 400, statusText: 'Bad Request' },
    );
    await expect(retiro).rejects.toThrow(new DomainError('Aún quedan 8 unidades en esta sucursal. Lleve la cantidad a 0 antes de retirar el producto.'));
  });
});
