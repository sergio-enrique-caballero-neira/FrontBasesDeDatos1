import { DOCUMENTO_CONSUMIDOR_FINAL, esConsumidorFinal } from '../core/models';
import { crearDatosSemilla } from './seed';

describe('crearDatosSemilla', () => {
  const hoy = new Date(2026, 9, 24, 15, 30);

  it('es determinista para la misma fecha', () => {
    expect(crearDatosSemilla(new Date(hoy))).toEqual(crearDatosSemilla(new Date(hoy)));
  });

  it('incluye un único consumidor final y le asigna cerca de una de cada cuatro ventas', () => {
    const { clientes, ventas } = crearDatosSemilla(hoy);
    const finales = clientes.filter(esConsumidorFinal);

    expect(finales).toHaveLength(1);
    expect(finales[0]).toMatchObject({
      tipo: 'NATURAL',
      nombre: 'Consumidor',
      apellido: 'final',
      numeroDocumento: DOCUMENTO_CONSUMIDOR_FINAL,
      direccion: 'No aplica',
      telefonos: ['000 000 0000'],
      correos: [],
    });
    const proporcion = ventas.filter((v) => v.idCliente === finales[0].idCliente).length / ventas.length;
    expect(proporcion).toBeGreaterThanOrEqual(0.2);
    expect(proporcion).toBeLessThanOrEqual(0.3);
  });

  it('solo referencia clientes que existen', () => {
    const { clientes, ventas } = crearDatosSemilla(hoy);
    const ids = new Set(clientes.map((c) => c.idCliente));
    expect(ventas.every((v) => ids.has(v.idCliente))).toBe(true);
  });
});
