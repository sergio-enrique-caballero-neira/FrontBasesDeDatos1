import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { URL_API } from '../core/configuracion';
import { NoEncontrado } from '../core/domain-error';
import { ClientesRepository } from './personas.repository';

const EMPRESA = {
  idCliente: 4,
  tipo: 'JURIDICO',
  numeroDocumento: '900215334',
  direccionCliente: null,
  telefonos: ['601 555 0101'],
  correos: [],
  nombre: null,
  apellido: null,
  razonSocial: 'Constructora Andes SAS',
  nombreMostrado: 'Constructora Andes SAS',
  consumidorFinal: false,
};

describe('ClientesRepository', () => {
  let http: HttpTestingController;
  let clientes: ClientesRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    clientes = TestBed.inject(ClientesRepository);
  });

  afterEach(() => http.verify());

  it('traduce la dirección y deja vacíos los datos que no aplican al tipo', async () => {
    const respuesta = clientes.obtener(4);
    http.expectOne(`${URL_API}/clientes/4`).flush(EMPRESA);
    expect(await respuesta).toEqual({
      idCliente: 4,
      tipo: 'JURIDICO',
      numeroDocumento: '900215334',
      direccion: '',
      telefonos: ['601 555 0101'],
      correos: [],
      nombre: undefined,
      apellido: undefined,
      razonSocial: 'Constructora Andes SAS',
    });
  });

  it('un cliente natural no envía razón social aunque el formulario la tenga', async () => {
    const creado = clientes.guardar({
      idCliente: 0,
      tipo: 'NATURAL',
      numeroDocumento: '1019876543',
      direccion: 'Cl 80 # 20-15',
      telefonos: ['300 555 0110'],
      correos: ['ana@correo.com'],
      nombre: 'Ana',
      apellido: 'Díaz',
      razonSocial: 'Sobrante',
    });
    const peticion = http.expectOne(`${URL_API}/clientes`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      tipo: 'NATURAL',
      numeroDocumento: '1019876543',
      direccionCliente: 'Cl 80 # 20-15',
      telefonos: ['300 555 0110'],
      correos: ['ana@correo.com'],
      nombre: 'Ana',
      apellido: 'Díaz',
      razonSocial: null,
    });
    peticion.flush({ ...peticion.request.body, idCliente: 12, nombreMostrado: 'Ana Díaz', consumidorFinal: false });
    expect((await creado).idCliente).toBe(12);
  });

  it('editar al consumidor final muestra la regla del back', async () => {
    const editado = clientes.guardar({
      idCliente: 1,
      tipo: 'NATURAL',
      numeroDocumento: '222222222222',
      direccion: '',
      telefonos: [],
      correos: [],
      nombre: 'Consumidor',
      apellido: 'Final',
    });
    http.expectOne(`${URL_API}/clientes/1`).flush(
      { estado: 400, codigo: 'REGLA_NEGOCIO', mensaje: 'El consumidor final es un registro del sistema y no se puede modificar.' },
      { status: 400, statusText: 'Bad Request' },
    );
    await expect(editado).rejects.toThrow('El consumidor final es un registro del sistema y no se puede modificar.');
  });

  it('un cliente que no existe lanza NoEncontrado', async () => {
    const respuesta = clientes.obtener(999);
    http.expectOne(`${URL_API}/clientes/999`).flush(
      { estado: 404, codigo: 'NO_ENCONTRADO', mensaje: 'No existe el cliente con id 999.' },
      { status: 404, statusText: 'Not Found' },
    );
    await expect(respuesta).rejects.toBeInstanceOf(NoEncontrado);
  });
});
