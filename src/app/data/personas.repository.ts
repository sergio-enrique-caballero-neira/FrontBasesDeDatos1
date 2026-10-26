import { inject, Injectable } from '@angular/core';
import { DomainError, NoEncontrado } from '../core/domain-error';
import {
  Cliente,
  DOCUMENTO_CONSUMIDOR_FINAL,
  Empleado,
  esConsumidorFinal,
  nombreCliente,
  nombreEmpleado,
} from '../core/models';
import { MockDb, siguienteId, Tablas } from './mock-db';
import { asegurarSinReferencias, normalizar, porNombre } from './reglas';

const CONSUMIDOR_FINAL_PROTEGIDO = 'El consumidor final es un registro del sistema y no se puede modificar.';

@Injectable({ providedIn: 'root' })
export class ClientesRepository {
  private readonly db = inject(MockDb);

  /** Incluye al consumidor final; quien lo muestre puede distinguirlo con `esConsumidorFinal`. */
  async listar(): Promise<Cliente[]> {
    return (await this.db.leer('clientes')).sort(porNombre(nombreCliente));
  }

  async obtener(idCliente: number): Promise<Cliente> {
    const cliente = (await this.db.leer('clientes')).find((c) => c.idCliente === idCliente);
    if (!cliente) {
      throw new NoEncontrado('Este cliente no existe o fue eliminado.');
    }
    return cliente;
  }

  guardar(cliente: Cliente): Promise<Cliente> {
    return this.db.transaccion((t) => {
      asegurarQueNoEsConsumidorFinal(t, cliente.idCliente);
      const documento = normalizar(cliente.numeroDocumento);
      if (documento === DOCUMENTO_CONSUMIDOR_FINAL) {
        throw new DomainError(
          `El documento ${DOCUMENTO_CONSUMIDOR_FINAL} está reservado para el consumidor final. Si el cliente no quiere dar sus datos, registra la venta a consumidor final.`,
        );
      }
      if (t.clientes.some((c) => c.idCliente !== cliente.idCliente && normalizar(c.numeroDocumento) === documento)) {
        throw new DomainError(`Ya existe un cliente con el documento ${cliente.numeroDocumento}.`);
      }
      // La especialización es disyunta: un cliente natural no guarda razón social y viceversa.
      const limpio: Cliente =
        cliente.tipo === 'NATURAL'
          ? { ...cliente, razonSocial: undefined }
          : { ...cliente, nombre: undefined, apellido: undefined };
      if (!limpio.idCliente) {
        const nuevo = { ...limpio, idCliente: siguienteId(t.clientes, (c) => c.idCliente) };
        t.clientes.push(nuevo);
        return nuevo;
      }
      t.clientes = t.clientes.map((c) => (c.idCliente === limpio.idCliente ? limpio : c));
      return limpio;
    });
  }

  eliminar(idCliente: number): Promise<void> {
    return this.db.transaccion((t) => {
      asegurarQueNoEsConsumidorFinal(t, idCliente);
      asegurarSinReferencias('el cliente', [['ventas', t.ventas.filter((v) => v.idCliente === idCliente).length]]);
      t.clientes = t.clientes.filter((c) => c.idCliente !== idCliente);
    });
  }
}

function asegurarQueNoEsConsumidorFinal(t: Tablas, idCliente: number): void {
  const actual = idCliente ? t.clientes.find((c) => c.idCliente === idCliente) : undefined;
  if (actual && esConsumidorFinal(actual)) {
    throw new DomainError(CONSUMIDOR_FINAL_PROTEGIDO);
  }
}

@Injectable({ providedIn: 'root' })
export class EmpleadosRepository {
  private readonly db = inject(MockDb);

  async listar(): Promise<Empleado[]> {
    return (await this.db.leer('empleados')).sort(porNombre(nombreEmpleado));
  }

  async buscarPorCorreo(correo: string): Promise<Empleado | undefined> {
    const empleados = await this.db.leer('empleados');
    return empleados.find((e) => normalizar(e.correo) === normalizar(correo));
  }

  guardar(empleado: Empleado): Promise<Empleado> {
    return this.db.transaccion((t) => {
      const otros = t.empleados.filter((e) => e.idEmpleado !== empleado.idEmpleado);
      if (otros.some((e) => normalizar(e.documento) === normalizar(empleado.documento))) {
        throw new DomainError(`Ya hay un empleado con el documento ${empleado.documento}.`);
      }
      if (otros.some((e) => normalizar(e.correo) === normalizar(empleado.correo))) {
        throw new DomainError(`El correo ${empleado.correo} ya está asignado a otro empleado.`);
      }
      const limpio: Empleado =
        empleado.rol === 'ADMINISTRADOR'
          ? { ...empleado, comisionVenta: undefined }
          : { ...empleado, nivelAcceso: undefined, claveSeguridad: undefined };
      if (!limpio.idEmpleado) {
        const nuevo = { ...limpio, idEmpleado: siguienteId(t.empleados, (e) => e.idEmpleado) };
        t.empleados.push(nuevo);
        return nuevo;
      }
      const anterior = t.empleados.find((e) => e.idEmpleado === limpio.idEmpleado);
      if (anterior && anterior.rol !== limpio.rol) {
        asegurarSinReferencias(`el rol ${anterior.rol === 'VENDEDOR' ? 'de vendedor' : 'de administrador'}`, [
          ['ventas', anterior.rol === 'VENDEDOR' ? t.ventas.filter((v) => v.idEmpleado === limpio.idEmpleado).length : 0],
          [
            'evaluaciones',
            anterior.rol === 'ADMINISTRADOR' ? t.evaluaciones.filter((e) => e.idEmpleado === limpio.idEmpleado).length : 0,
          ],
        ]);
      }
      t.empleados = t.empleados.map((e) => (e.idEmpleado === limpio.idEmpleado ? limpio : e));
      return limpio;
    });
  }

  eliminar(idEmpleado: number): Promise<void> {
    return this.db.transaccion((t) => {
      asegurarSinReferencias('el empleado', [
        ['ventas', t.ventas.filter((v) => v.idEmpleado === idEmpleado).length],
        ['evaluaciones', t.evaluaciones.filter((e) => e.idEmpleado === idEmpleado).length],
      ]);
      t.empleados = t.empleados.filter((e) => e.idEmpleado !== idEmpleado);
    });
  }
}
