import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { URL_API } from '../core/configuracion';
import { NoEncontrado } from '../core/domain-error';
import { EvaluacionesRepository, ProveedoresRepository, SuministrosRepository } from './proveedores.repository';

const ANDINA = {
  nit: '900215334-1',
  nombreProveedor: 'Distribuidora Ferretera Andina S.A.S.',
  direccionProveedor: 'Carrera 68 # 13-40, Bogotá',
  telefonos: ['601 405 7788', '310 555 0199'],
  correos: ['pedidos@ferreandina.demo'],
};

describe('Repositorios de proveedores', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('el proveedor llega con todos sus teléfonos', async () => {
    const respuesta = TestBed.inject(ProveedoresRepository).obtener(' 900215334-1 ');
    http.expectOne(`${URL_API}/proveedores/900215334-1`).flush(ANDINA);
    expect(await respuesta).toEqual({
      nit: '900215334-1',
      nombre: 'Distribuidora Ferretera Andina S.A.S.',
      direccion: 'Carrera 68 # 13-40, Bogotá',
      telefonos: ['601 405 7788', '310 555 0199'],
      correos: ['pedidos@ferreandina.demo'],
    });
  });

  it('un NIT que no existe lanza NoEncontrado', async () => {
    const respuesta = TestBed.inject(ProveedoresRepository).obtener('000000000-0');
    http.expectOne(`${URL_API}/proveedores/000000000-0`).flush(
      { estado: 404, codigo: 'NO_ENCONTRADO', mensaje: 'No existe el proveedor con NIT 000000000-0.' },
      { status: 404, statusText: 'Not Found' },
    );
    await expect(respuesta).rejects.toBeInstanceOf(NoEncontrado);
  });

  it('editar un proveedor usa PUT sobre su NIT', async () => {
    const guardado = TestBed.inject(ProveedoresRepository).guardar(
      { nit: '900215334-1', nombre: 'Andina', direccion: 'Cra 68', telefonos: ['601 405 7788'], correos: ['a@b.co'] },
      false,
    );
    const peticion = http.expectOne(`${URL_API}/proveedores/900215334-1`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({
      nit: '900215334-1',
      nombreProveedor: 'Andina',
      direccionProveedor: 'Cra 68',
      telefonos: ['601 405 7788'],
      correos: ['a@b.co'],
    });
    peticion.flush(ANDINA);
    await guardado;
  });

  it('editar un suministro solo envía precio y tiempo de entrega a su llave compuesta', async () => {
    const guardado = TestBed.inject(SuministrosRepository).guardar(
      { nit: '900215334-1', idProducto: 5, idSucursal: 2, precioSuministro: 21000, tiempoEntregaDias: 4 },
      false,
    );
    const peticion = http.expectOne(`${URL_API}/suministros/900215334-1/5/2`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body).toEqual({ precioSuministro: 21000, tiempoEntregaDias: 4 });
    peticion.flush({ nit: '900215334-1', idProducto: 5, idSucursal: 2, precioSuministro: 21000, tiempoEntregaDias: 4 });
    await guardado;
  });

  it('la evaluación no envía evaluador: el back usa al administrador de la sesión', async () => {
    const registrada = TestBed.inject(EvaluacionesRepository).registrar({
      nit: '900215334-1',
      idProducto: 5,
      idSucursal: 2,
      fechaEvaluacion: '2026-10-28',
      calificacion: 4,
      cumplimientoTiempo: true,
      observaciones: '',
    });
    const peticion = http.expectOne(`${URL_API}/evaluaciones`);
    expect(peticion.request.body).toEqual({
      nit: '900215334-1',
      idProducto: 5,
      idSucursal: 2,
      fechaEvaluacion: '2026-10-28',
      calificacion: 4,
      cumplimientoTiempo: true,
      observaciones: null,
    });
    peticion.flush({ ...peticion.request.body, idEvaluacion: 31, idEmpleado: 1, observaciones: null });
    expect(await registrada).toMatchObject({ idEvaluacion: 31, idEmpleado: 1, observaciones: '' });
  });
});
