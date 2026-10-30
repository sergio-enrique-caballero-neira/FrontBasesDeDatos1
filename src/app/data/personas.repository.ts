import { inject, Injectable } from '@angular/core';
import { Api } from '../core/api';
import { Cliente, nombreCliente, TipoCliente } from '../core/models';
import { porNombre } from './reglas';

interface ClienteApi {
  idCliente: number;
  tipo: TipoCliente;
  numeroDocumento: string;
  direccionCliente: string | null;
  telefonos: string[];
  correos: string[];
  nombre: string | null;
  apellido: string | null;
  razonSocial: string | null;
}

function aCliente(c: ClienteApi): Cliente {
  return {
    idCliente: c.idCliente,
    tipo: c.tipo,
    numeroDocumento: c.numeroDocumento,
    direccion: c.direccionCliente ?? '',
    telefonos: c.telefonos ?? [],
    correos: c.correos ?? [],
    nombre: c.nombre ?? undefined,
    apellido: c.apellido ?? undefined,
    razonSocial: c.razonSocial ?? undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class ClientesRepository {
  private readonly api = inject(Api);

  async listar(): Promise<Cliente[]> {
    return (await this.api.get<ClienteApi[]>('/clientes')).map(aCliente).sort(porNombre(nombreCliente));
  }

  async obtener(idCliente: number): Promise<Cliente> {
    return aCliente(await this.api.get<ClienteApi>(`/clientes/${idCliente}`));
  }

  async guardar(cliente: Cliente): Promise<Cliente> {
    const natural = cliente.tipo === 'NATURAL';
    const cuerpo = {
      tipo: cliente.tipo,
      numeroDocumento: cliente.numeroDocumento,
      direccionCliente: cliente.direccion || null,
      telefonos: cliente.telefonos,
      correos: cliente.correos,
      nombre: natural ? (cliente.nombre ?? null) : null,
      apellido: natural ? (cliente.apellido ?? null) : null,
      razonSocial: natural ? null : (cliente.razonSocial ?? null),
    };
    const guardado = cliente.idCliente
      ? await this.api.put<ClienteApi>(`/clientes/${cliente.idCliente}`, cuerpo)
      : await this.api.post<ClienteApi>('/clientes', cuerpo);
    return aCliente(guardado);
  }

  eliminar(idCliente: number, claveSeguridad: string): Promise<void> {
    return this.api.delete(`/clientes/${idCliente}`, claveSeguridad);
  }
}
