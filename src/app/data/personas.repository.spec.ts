import { TestBed } from '@angular/core/testing';
import { DomainError, NoEncontrado } from '../core/domain-error';
import { Cliente, DOCUMENTO_CONSUMIDOR_FINAL, esConsumidorFinal } from '../core/models';
import { MockDb } from './mock-db';
import { ClientesRepository } from './personas.repository';

describe('ClientesRepository', () => {
  let clientes: ClientesRepository;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    TestBed.inject(MockDb).restaurar();
    clientes = TestBed.inject(ClientesRepository);
  });

  async function consumidorFinal(): Promise<Cliente> {
    const encontrado = (await clientes.listar()).find(esConsumidorFinal);
    if (!encontrado) throw new Error('Los datos semilla no tienen consumidor final');
    return encontrado;
  }

  it('obtener devuelve el cliente o lanza NoEncontrado', async () => {
    const [carlos, inexistente] = await Promise.allSettled([clientes.obtener(1), clientes.obtener(99999)]);
    expect(carlos.status === 'fulfilled' && carlos.value.idCliente).toBe(1);
    expect(inexistente.status === 'rejected' && inexistente.reason).toBeInstanceOf(NoEncontrado);
  });

  it('no deja editar al consumidor final', async () => {
    const cf = await consumidorFinal();
    await expect(clientes.guardar({ ...cf, direccion: 'Calle 1 # 2-3' })).rejects.toThrow(
      'El consumidor final es un registro del sistema y no se puede modificar.',
    );
    const sinCambios = await clientes.obtener(cf.idCliente);
    expect(sinCambios.direccion).toBe('No aplica');
  });

  it('no deja eliminar al consumidor final', async () => {
    const cf = await consumidorFinal();
    await expect(clientes.eliminar(cf.idCliente)).rejects.toThrow(
      'El consumidor final es un registro del sistema y no se puede modificar.',
    );
  });

  it('no deja usar el documento del consumidor final en otro cliente', async () => {
    const nuevo: Cliente = {
      idCliente: 0,
      tipo: 'NATURAL',
      nombre: 'Ana',
      apellido: 'Ruiz',
      numeroDocumento: DOCUMENTO_CONSUMIDOR_FINAL,
      direccion: 'Calle 10 # 5-20',
      telefonos: [],
      correos: [],
    };
    const existente = await clientes.obtener(1);
    const [crear, editar] = await Promise.allSettled([
      clientes.guardar(nuevo),
      clientes.guardar({ ...existente, numeroDocumento: ` ${DOCUMENTO_CONSUMIDOR_FINAL} ` }),
    ]);
    expect(crear.status === 'rejected' && crear.reason).toBeInstanceOf(DomainError);
    expect(editar.status === 'rejected' && editar.reason).toBeInstanceOf(DomainError);
    expect((await clientes.listar()).filter(esConsumidorFinal).length).toBe(1);
  });
});
