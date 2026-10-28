import { TestBed } from '@angular/core/testing';
import { NoEncontrado } from '../core/domain-error';
import { MockDb } from './mock-db';
import { ProveedoresRepository } from './proveedores.repository';

describe('ProveedoresRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    TestBed.inject(MockDb).restaurar();
  });

  it('obtener encuentra por NIT y lanza NoEncontrado si no existe', async () => {
    const proveedores = TestBed.inject(ProveedoresRepository);
    const [encontrado, inexistente] = await Promise.allSettled([
      proveedores.obtener(' 900215334-1 '),
      proveedores.obtener('000000000-0'),
    ]);
    expect(encontrado.status === 'fulfilled' && encontrado.value.nit).toBe('900215334-1');
    expect(inexistente.status === 'rejected' && inexistente.reason).toBeInstanceOf(NoEncontrado);
  });
});
