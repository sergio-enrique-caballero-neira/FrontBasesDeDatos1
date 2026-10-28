import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { URL_API } from '../core/configuracion';
import { DomainError } from '../core/domain-error';
import { VentasRepository } from './ventas.repository';

function venta(idVenta: number, lineas: unknown[] | null = null) {
  return {
    idVenta,
    numeroFactura: `FV-${String(idVenta).padStart(6, '0')}`,
    fecha: '2026-10-28',
    hora: '14:05:09',
    idCliente: 7,
    nombreCliente: 'Ana Díaz',
    documentoCliente: '1019876543',
    idEmpleado: 3,
    nombreVendedor: 'Camila Rojas',
    idSucursal: 1,
    nombreSucursal: 'Sede Centro',
    idMetodoPago: 2,
    tipoMetodoPago: 'Tarjeta débito',
    montoTotal: 55800,
    lineas,
  };
}

describe('VentasRepository', () => {
  let http: HttpTestingController;
  let ventas: VentasRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    ventas = TestBed.inject(VentasRepository);
  });

  afterEach(() => http.verify());

  function paginas(): TestRequest[] {
    return http.match((r) => r.url === `${URL_API}/ventas`);
  }

  it('listar recorre todas las páginas del back con los filtros dados', async () => {
    const lista = ventas.listar({ idSucursal: 1, desde: '2026-10-01' });
    const [primera] = paginas();
    expect(primera.request.params.get('pagina')).toBe('0');
    expect(primera.request.params.get('tamano')).toBe('100');
    expect(primera.request.params.get('idSucursal')).toBe('1');
    expect(primera.request.params.get('desde')).toBe('2026-10-01');
    expect(primera.request.params.has('idCliente')).toBe(false);
    primera.flush({ contenido: [venta(3)], pagina: 0, tamano: 100, totalElementos: 3, totalPaginas: 3 });
    await new Promise((listo) => setTimeout(listo));

    const resto = paginas();
    expect(resto.map((r) => r.request.params.get('pagina'))).toEqual(['1', '2']);
    resto[0].flush({ contenido: [venta(2)], pagina: 1, tamano: 100, totalElementos: 3, totalPaginas: 3 });
    resto[1].flush({ contenido: [venta(1)], pagina: 2, tamano: 100, totalElementos: 3, totalPaginas: 3 });

    const resultado = await lista;
    expect(resultado.map((v) => v.idVenta)).toEqual([3, 2, 1]);
    expect(resultado[0].hora).toBe('14:05');
  });

  it('registrar envía solo cliente, método y líneas: la sede y el vendedor salen de la sesión', async () => {
    const registro = ventas.registrar({ idCliente: 7, idMetodoPago: 2, lineas: [{ idProducto: 5, cantidad: 2 }] });
    const peticion = http.expectOne(`${URL_API}/ventas`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ idCliente: 7, idMetodoPago: 2, lineas: [{ idProducto: 5, cantidad: 2 }] });
    peticion.flush(venta(41, [{ idProducto: 5, codigo: 'HM-0005', nombreProducto: 'Nivel', cantidad: 2, precioUnitario: 27900, subtotal: 55800 }]));

    const { venta: registrada, detalles } = await registro;
    expect(registrada.numeroFactura).toBe('FV-000041');
    expect(detalles).toEqual([{ idVenta: 41, idProducto: 5, cantidad: 2, precioUnitario: 27900 }]);
  });

  it('sin stock muestra el mensaje del back', async () => {
    const registro = ventas.registrar({ idCliente: 7, idMetodoPago: 2, lineas: [{ idProducto: 5, cantidad: 99 }] });
    http.expectOne(`${URL_API}/ventas`).flush(
      { estado: 409, codigo: 'CONFLICTO', mensaje: 'Stock insuficiente de HM-0005 (Nivel): hay 3 y se piden 99.' },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(registro).rejects.toThrow(new DomainError('Stock insuficiente de HM-0005 (Nivel): hay 3 y se piden 99.'));
  });

  it('el historial de un cliente junta sus facturas y sus líneas', async () => {
    const historial = ventas.historialCliente(7);
    paginas()[0].flush({ contenido: [venta(41)], pagina: 0, tamano: 100, totalElementos: 1, totalPaginas: 1 });
    const lineas = http.expectOne((r) => r.url === `${URL_API}/ventas/lineas`);
    expect(lineas.request.params.get('idCliente')).toBe('7');
    lineas.flush([
      { idVenta: 41, numeroFactura: 'FV-000041', fecha: '2026-10-28', hora: '14:05:09', idSucursal: 1, idEmpleado: 3, idCliente: 7, idProducto: 5, cantidad: 2, precioUnitario: 27900 },
    ]);

    const { ventas: facturas, detalles } = await historial;
    expect(facturas).toHaveLength(1);
    expect(detalles).toEqual([{ idVenta: 41, idProducto: 5, cantidad: 2, precioUnitario: 27900 }]);
  });
});
