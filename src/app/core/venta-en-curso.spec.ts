import { TestBed } from '@angular/core/testing';
import { Empleado } from './models';
import { Session } from './session';
import { VentaEnCurso } from './venta-en-curso';

describe('VentaEnCurso', () => {
  let session: Session;
  let venta: VentaEnCurso;
  const vendedor = { idEmpleado: 3, rol: 'VENDEDOR' } as Empleado;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    session = TestBed.inject(Session);
    venta = TestBed.inject(VentaEnCurso);
    session.usuario.set(vendedor);
    session.sucursal.set(1);
    TestBed.tick();
  });

  it('guarda la venta por sucursal y la restaura al volver', () => {
    venta.lineas.set([{ idProducto: 5, cantidad: 2 }]);
    TestBed.tick();
    expect(sessionStorage.getItem('ferreteria.venta-en-curso.3.1')).toContain('"idProducto":5');

    session.sucursal.set(2);
    TestBed.tick();
    expect(venta.hayVenta()).toBe(false);

    session.sucursal.set(1);
    TestBed.tick();
    expect(venta.lineas()).toEqual([{ idProducto: 5, cantidad: 2 }]);
  });

  it('borra todas las ventas guardadas al cerrar sesión', () => {
    venta.lineas.set([{ idProducto: 5, cantidad: 2 }]);
    TestBed.tick();
    session.sucursal.set(undefined);
    TestBed.tick();
    session.usuario.set(null);
    TestBed.tick();
    expect(sessionStorage.getItem('ferreteria.venta-en-curso.3.1')).toBeNull();
    expect(venta.hayVenta()).toBe(false);
  });

  it('limpiar descarta la venta y su copia guardada', () => {
    venta.lineas.set([{ idProducto: 5, cantidad: 2 }]);
    venta.idCliente.set(7);
    TestBed.tick();
    venta.limpiar();
    TestBed.tick();
    expect(venta.hayVenta()).toBe(false);
    expect(sessionStorage.getItem('ferreteria.venta-en-curso.3.1')).toBeNull();
  });
});
