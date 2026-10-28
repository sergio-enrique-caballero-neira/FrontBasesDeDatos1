import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { autenticacion } from './autenticacion.interceptor';
import { URL_API } from './configuracion';
import { Credenciales } from './credenciales';
import { Session } from './session';

describe('autenticacion', () => {
  let http: HttpTestingController;
  let cliente: HttpClient;
  let expirar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([autenticacion])), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    cliente = TestBed.inject(HttpClient);
    expirar = vi.spyOn(TestBed.inject(Session), 'expirar').mockImplementation(() => undefined);
  });

  afterEach(() => http.verify());

  it('agrega el token solo a las peticiones del back', () => {
    TestBed.inject(Credenciales).guardar('abc');

    void firstValueFrom(cliente.get(`${URL_API}/marcas`));
    void firstValueFrom(cliente.get('https://otro.sitio/recurso'));

    expect(http.expectOne(`${URL_API}/marcas`).request.headers.get('Authorization')).toBe('Bearer abc');
    expect(http.expectOne('https://otro.sitio/recurso').request.headers.has('Authorization')).toBe(false);
  });

  it('un 401 con sesión abierta la da por vencida', async () => {
    TestBed.inject(Credenciales).guardar('abc');

    const respuesta = firstValueFrom(cliente.get(`${URL_API}/ventas`));
    http.expectOne(`${URL_API}/ventas`).flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(respuesta).rejects.toBeTruthy();
    expect(expirar).toHaveBeenCalledTimes(1);
  });

  it('un 401 del login no vence nada: son credenciales incorrectas', async () => {
    TestBed.inject(Credenciales).guardar('abc');

    const respuesta = firstValueFrom(cliente.post(`${URL_API}/auth/login`, {}));
    http.expectOne(`${URL_API}/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });

    await expect(respuesta).rejects.toBeTruthy();
    expect(expirar).not.toHaveBeenCalled();
  });
});
