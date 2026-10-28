import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Api } from './api';
import { URL_API } from './configuracion';
import { DomainError, NoEncontrado } from './domain-error';

describe('Api', () => {
  let api: Api;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(Api);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('omite los parámetros vacíos y llama a la URL del back', async () => {
    const respuesta = api.get<number[]>('/productos', { q: 'martillo', idMarca: null, idCategoria: undefined, vacio: '' });
    const peticion = http.expectOne((r) => r.url === `${URL_API}/productos`);
    expect(peticion.request.params.keys()).toEqual(['q']);
    peticion.flush([1, 2]);
    expect(await respuesta).toEqual([1, 2]);
  });

  it('un 404 se convierte en NoEncontrado con el mensaje del back', async () => {
    const respuesta = api.get('/productos/99');
    http.expectOne(`${URL_API}/productos/99`).flush(
      { estado: 404, codigo: 'NO_ENCONTRADO', mensaje: 'No existe el producto con id 99.' },
      { status: 404, statusText: 'Not Found' },
    );
    await expect(respuesta).rejects.toThrow(NoEncontrado);
    await expect(respuesta).rejects.toThrow('No existe el producto con id 99.');
  });

  it('un 409 muestra el mensaje del back', async () => {
    const respuesta = api.delete('/marcas/1');
    http.expectOne(`${URL_API}/marcas/1`).flush(
      { estado: 409, codigo: 'CONFLICTO', mensaje: 'No se puede eliminar la marca: la usan 3 productos.' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(respuesta).rejects.toThrow(new DomainError('No se puede eliminar la marca: la usan 3 productos.'));
  });

  it('un 400 de validación muestra el primer campo con error', async () => {
    const respuesta = api.post('/marcas', {});
    http.expectOne(`${URL_API}/marcas`).flush(
      { estado: 400, codigo: 'VALIDACION', mensaje: 'Hay datos inválidos o incompletos.', campos: { nombreMarca: 'El nombre de la marca es obligatorio.' } },
      { status: 400, statusText: 'Bad Request' },
    );
    await expect(respuesta).rejects.toThrow('El nombre de la marca es obligatorio.');
  });

  it('sin conexión explica que el servidor no responde', async () => {
    const respuesta = api.get('/marcas');
    http.expectOne(`${URL_API}/marcas`).error(new ProgressEvent('error'), { status: 0 });
    await expect(respuesta).rejects.toThrow(/No hay conexión con el servidor/);
  });

  it('cada cambio exitoso avisa; las consultas no', async () => {
    const consulta = api.get('/marcas');
    http.expectOne(`${URL_API}/marcas`).flush([]);
    await consulta;
    expect(api.cambios()).toBe(0);

    const creacion = api.post('/marcas', { nombreMarca: 'Makita', paisOrigen: 'Japón' });
    http.expectOne(`${URL_API}/marcas`).flush({ idMarca: 8 });
    await creacion;
    expect(api.cambios()).toBe(1);
  });
});
