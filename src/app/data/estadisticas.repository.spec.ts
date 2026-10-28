import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { URL_API } from '../core/configuracion';
import { EstadisticasRepository, FiltroPeriodo } from './estadisticas.repository';

const OCTUBRE: FiltroPeriodo = { idSucursal: 2, desde: '2026-10-01', hasta: '2026-10-28' };

describe('EstadisticasRepository', () => {
  let http: HttpTestingController;
  let estadisticas: EstadisticasRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    estadisticas = TestBed.inject(EstadisticasRepository);
  });

  afterEach(() => http.verify());

  it('envía el periodo y la sede como parámetros, sin los vacíos', async () => {
    const dias = estadisticas.ventasPorDia({ idSucursal: null, desde: '2026-10-27', hasta: '2026-10-28' });
    const peticion = http.expectOne((r) => r.url === `${URL_API}/estadisticas/ventas-por-dia`);
    expect(peticion.request.params.keys().sort()).toEqual(['desde', 'hasta']);
    peticion.flush([
      { fecha: '2026-10-27', total: 0, cantidad: 0 },
      { fecha: '2026-10-28', total: 55800, cantidad: 2 },
    ]);
    expect((await dias).map((d) => d.cantidad)).toEqual([0, 2]);
  });

  it('el resumen trae el periodo actual y el anterior en una sola consulta', async () => {
    const resumen = estadisticas.resumen(OCTUBRE);
    const peticion = http.expectOne((r) => r.url === `${URL_API}/estadisticas/resumen`);
    expect(peticion.request.params.get('idSucursal')).toBe('2');
    peticion.flush({
      desde: '2026-10-01',
      hasta: '2026-10-28',
      actual: { total: 900000, cantidad: 30, unidades: 75, ticketPromedio: 30000 },
      desdeAnterior: '2026-09-03',
      hastaAnterior: '2026-09-30',
      anterior: { total: 600000, cantidad: 20, unidades: 50, ticketPromedio: 30000 },
    });
    const { actual, anterior } = await resumen;
    expect(actual.cantidad).toBe(30);
    expect(anterior.total).toBe(600000);
  });

  it('el periodo anterior tiene los mismos días y termina justo antes', () => {
    expect(estadisticas.periodoAnterior(OCTUBRE)).toEqual({ idSucursal: 2, desde: '2026-09-03', hasta: '2026-09-30' });
  });

  it('el rendimiento por producto usa el nombre del producto del back', async () => {
    const filas = estadisticas.rendimientoPorProducto(OCTUBRE);
    http.expectOne((r) => r.url === `${URL_API}/estadisticas/rendimiento-productos`).flush([
      { idProducto: 1, codigo: 'HM-0001', nombreProducto: 'Martillo', unidades: 3, total: 83700, utilidadEstimada: 28200 },
    ]);
    expect(await filas).toEqual([{ idProducto: 1, nombre: 'Martillo', codigo: 'HM-0001', unidades: 3, total: 83700, utilidadEstimada: 28200 }]);
  });

  it('el comparativo de sedes renombra nombreSucursal', async () => {
    const filas = estadisticas.porSucursalDetallado(OCTUBRE);
    http.expectOne((r) => r.url === `${URL_API}/estadisticas/sucursales`).flush([
      {
        idSucursal: 2,
        nombreSucursal: 'Sede Norte',
        ciudad: 'Bogotá',
        cantidad: 30,
        total: 900000,
        ticketPromedio: 30000,
        utilidadEstimada: 250000,
        productosStockBajo: 4,
        capitalInventario: 12000000,
      },
    ]);
    const [norte] = await filas;
    expect(norte.nombre).toBe('Sede Norte');
    expect(norte).not.toHaveProperty('nombreSucursal');
  });
});
