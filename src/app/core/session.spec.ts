import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { autenticacion } from './autenticacion.interceptor';
import { Avisos } from './avisos';
import { URL_API } from './configuracion';
import { Credenciales } from './credenciales';
import { Session } from './session';

const LAURA = {
  idEmpleado: 1, documento: '52814736', nombre: 'Laura', apellido: 'Gómez', cargo: 'Gerente de operaciones',
  correo: 'laura.gomez@ferreteria.demo', telefonos: ['310 555 0141'], rol: 'ADMINISTRADOR', nivelAcceso: 3,
  comisionVenta: null, idSucursal: null, nombreSucursal: null,
};
const CAMILA = {
  idEmpleado: 3, documento: '1020456789', nombre: 'Camila', apellido: 'Rojas', cargo: 'Asesora de ventas',
  correo: 'camila.rojas@ferreteria.demo', telefonos: [], rol: 'VENDEDOR', nivelAcceso: null,
  comisionVenta: 0.1, idSucursal: 1, nombreSucursal: 'Sede Centro',
};

describe('Session', () => {
  let http: HttpTestingController;
  let credenciales: Credenciales;

  function crear(): Session {
    return TestBed.inject(Session);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([autenticacion])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    credenciales = TestBed.inject(Credenciales);
  });

  afterEach(() => http.verify());

  it('el vendedor inicia sesión y queda fijo en su sucursal', async () => {
    const session = crear();
    const login = session.iniciarSesion(' camila.rojas@ferreteria.demo ', 'Ferreteria2026');
    const peticion = http.expectOne(`${URL_API}/auth/login`);
    expect(peticion.request.body).toEqual({ correo: 'camila.rojas@ferreteria.demo', contrasena: 'Ferreteria2026' });
    peticion.flush({ token: 'token-camila', tipo: 'Bearer', expiraEnMs: 1000, empleado: CAMILA });
    await login;

    expect(credenciales.token()).toBe('token-camila');
    expect(session.esVendedor()).toBe(true);
    expect(session.sucursal()).toBe(1);
    session.elegirSucursal(2);
    expect(session.sucursal()).toBe(1);
  });

  it('el administrador inicia sesión sin sucursal y luego elige', async () => {
    const session = crear();
    const login = session.iniciarSesion('laura.gomez@ferreteria.demo', 'Ferreteria2026');
    http.expectOne(`${URL_API}/auth/login`).flush({ token: 't', tipo: 'Bearer', expiraEnMs: 1000, empleado: LAURA });
    await login;

    expect(session.sucursal()).toBeUndefined();
    session.elegirSucursal('TODAS');
    expect(session.idSucursalFiltro()).toBeNull();
    expect(localStorage.getItem('ferreteria.sucursal')).toBe('"TODAS"');
  });

  it('credenciales incorrectas no guardan token', async () => {
    const session = crear();
    const login = session.iniciarSesion('laura.gomez@ferreteria.demo', 'mala');
    http.expectOne(`${URL_API}/auth/login`).flush(
      { estado: 401, codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Correo o contraseña incorrectos.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await expect(login).rejects.toThrow('Correo o contraseña incorrectos.');
    expect(credenciales.token()).toBeNull();
    expect(session.usuario()).toBeNull();
  });

  it('al recargar recupera el perfil con el token guardado', async () => {
    credenciales.guardar('token-guardado');
    localStorage.setItem('ferreteria.sucursal', '2');
    const session = crear();
    const listo = session.listo();
    const peticion = http.expectOne(`${URL_API}/auth/yo`);
    expect(peticion.request.headers.get('Authorization')).toBe('Bearer token-guardado');
    peticion.flush(LAURA);
    await listo;

    expect(session.usuario()?.nombre).toBe('Laura');
    expect(session.sucursal()).toBe(2);
  });

  it('un token vencido al recargar deja la sesión cerrada', async () => {
    credenciales.guardar('vencido');
    const session = crear();
    const listo = session.listo();
    http.expectOne(`${URL_API}/auth/yo`).flush({ estado: 401 }, { status: 401, statusText: 'Unauthorized' });
    await listo;

    expect(session.usuario()).toBeNull();
    expect(credenciales.token()).toBeNull();
  });

  it('si el token vence trabajando, avisa y vuelve al login con la ruta actual', async () => {
    const session = crear();
    const login = session.iniciarSesion('laura.gomez@ferreteria.demo', 'Ferreteria2026');
    http.expectOne(`${URL_API}/auth/login`).flush({ token: 't', tipo: 'Bearer', expiraEnMs: 1000, empleado: LAURA });
    await login;
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    session.expirar();

    expect(session.vencida()).toBe(true);
    expect(session.usuario()).toBeNull();
    expect(TestBed.inject(Avisos).lista()[0].texto).toBe('Tu sesión venció. Inicia sesión de nuevo.');
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { volver: '/' } });
  });
});
