import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { URL_API } from '../core/configuracion';
import { Empleado } from '../core/models';
import { EmpleadosRepository } from './empleados.repository';

const VENDEDORA: Empleado = {
  idEmpleado: 0,
  documento: '1020456789',
  nombre: 'Camila',
  apellido: 'Rojas',
  cargo: 'Asesora de ventas',
  correo: 'camila.rojas@ferreteria.demo',
  telefonos: ['300 555 0123'],
  rol: 'VENDEDOR',
  comisionVenta: 0.1,
  idSucursal: 1,
};

describe('EmpleadosRepository', () => {
  let http: HttpTestingController;
  let empleados: EmpleadosRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    empleados = TestBed.inject(EmpleadosRepository);
  });

  afterEach(() => http.verify());

  it('crear un vendedor envía contraseña y sede, sin datos de administrador', async () => {
    const creado = empleados.guardar(VENDEDORA, { contrasena: 'Ferreteria2026', claveSeguridad: 'no-aplica' });
    const peticion = http.expectOne(`${URL_API}/empleados`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      documento: '1020456789',
      nombre: 'Camila',
      apellido: 'Rojas',
      cargo: 'Asesora de ventas',
      correo: 'camila.rojas@ferreteria.demo',
      telefonos: ['300 555 0123'],
      rol: 'VENDEDOR',
      contrasena: 'Ferreteria2026',
      nivelAcceso: null,
      claveSeguridad: null,
      comisionVenta: 0.1,
      idSucursal: 1,
    });
    peticion.flush({ ...peticion.request.body, idEmpleado: 9, nombreSucursal: 'Sede Centro' });
    const guardado = await creado;
    expect(guardado.idEmpleado).toBe(9);
    expect(guardado.nombreSucursal).toBe('Sede Centro');
  });

  it('editar sin escribir contraseña la deja como estaba', async () => {
    const editado = empleados.guardar({ ...VENDEDORA, idEmpleado: 3 }, { contrasena: '' });
    const peticion = http.expectOne(`${URL_API}/empleados/3`);
    expect(peticion.request.method).toBe('PUT');
    expect(peticion.request.body.contrasena).toBeNull();
    peticion.flush({ ...peticion.request.body, idEmpleado: 3, nombreSucursal: 'Sede Centro' });
    await editado;
  });

  it('un administrador viaja sin sede ni comisión', async () => {
    const creado = empleados.guardar(
      { ...VENDEDORA, rol: 'ADMINISTRADOR', nivelAcceso: 2, comisionVenta: undefined, idSucursal: undefined },
      { contrasena: 'Ferreteria2026', claveSeguridad: 'clave-segura' },
    );
    const peticion = http.expectOne(`${URL_API}/empleados`);
    expect(peticion.request.body).toMatchObject({ rol: 'ADMINISTRADOR', nivelAcceso: 2, claveSeguridad: 'clave-segura', comisionVenta: null, idSucursal: null });
    peticion.flush({ ...peticion.request.body, idEmpleado: 10, nombreSucursal: null });
    expect((await creado).idSucursal).toBeUndefined();
  });
});
