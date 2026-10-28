import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { URL_API } from '../core/configuracion';
import { CategoriasRepository, MarcasRepository, SucursalesRepository } from './catalogos.repository';

describe('Repositorios de catálogos', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('las sucursales llegan ordenadas por nombre y con su encargado', async () => {
    const lista = TestBed.inject(SucursalesRepository).listar();
    http.expectOne(`${URL_API}/sucursales`).flush([
      { idSucursal: 2, nombreSucursal: 'Sede Norte', ciudad: 'Bogotá', direccion: 'Cra 1', telefono: '601', idAdministrador: 2, nombreAdministrador: 'Andrés Pardo' },
      { idSucursal: 1, nombreSucursal: 'Sede Centro', ciudad: 'Bogotá', direccion: 'Cl 13', telefono: '601', idAdministrador: 1, nombreAdministrador: 'Laura Gómez' },
    ]);
    const sucursales = await lista;
    expect(sucursales.map((s) => s.nombre)).toEqual(['Sede Centro', 'Sede Norte']);
    expect(sucursales[0].nombreAdministrador).toBe('Laura Gómez');
  });

  it('crear una sucursal envía el encargado que la dirige', async () => {
    const creada = TestBed.inject(SucursalesRepository).guardar({
      idSucursal: 0,
      nombre: 'Sede Sur',
      ciudad: 'Bogotá',
      direccion: 'Av. Boyacá # 40 Sur',
      telefono: '601 700 1000',
      idAdministrador: 2,
    });
    const peticion = http.expectOne(`${URL_API}/sucursales`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      nombreSucursal: 'Sede Sur',
      ciudad: 'Bogotá',
      direccion: 'Av. Boyacá # 40 Sur',
      telefono: '601 700 1000',
      idAdministrador: 2,
    });
    peticion.flush({ idSucursal: 4, ...peticion.request.body, nombreAdministrador: 'Andrés Pardo' });
    expect((await creada).idSucursal).toBe(4);
  });

  it('un administrador que ya dirige otra sede devuelve el conflicto del back', async () => {
    const creada = TestBed.inject(SucursalesRepository).guardar({
      idSucursal: 3,
      nombre: 'Sede Laureles',
      ciudad: 'Medellín',
      direccion: 'Circular 1',
      telefono: '604',
      idAdministrador: 1,
    });
    http.expectOne(`${URL_API}/sucursales/3`).flush(
      { estado: 409, codigo: 'CONFLICTO', mensaje: 'Ese administrador ya dirige la sucursal "Sede Centro".' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(creada).rejects.toThrow('Ese administrador ya dirige la sucursal "Sede Centro".');
  });

  it('la marca viaja como nombreMarca', async () => {
    const guardada = TestBed.inject(MarcasRepository).guardar({ idMarca: 0, nombre: 'Makita', paisOrigen: 'Japón' });
    const peticion = http.expectOne(`${URL_API}/marcas`);
    expect(peticion.request.body).toEqual({ nombreMarca: 'Makita', paisOrigen: 'Japón' });
    peticion.flush({ idMarca: 8, nombreMarca: 'Makita', paisOrigen: 'Japón' });
    expect(await guardada).toEqual({ idMarca: 8, nombre: 'Makita', paisOrigen: 'Japón' });
  });

  it('una categoría sin descripción queda con texto vacío', async () => {
    const lista = TestBed.inject(CategoriasRepository).listar();
    http.expectOne(`${URL_API}/categorias`).flush([
      { idCategoria: 1, nombre: 'Herramientas', descripcion: null, idCategoriaPrincipal: null, nombreCategoriaPrincipal: null },
    ]);
    expect(await lista).toEqual([{ idCategoria: 1, nombre: 'Herramientas', descripcion: '', idCategoriaPrincipal: null }]);
  });
});
