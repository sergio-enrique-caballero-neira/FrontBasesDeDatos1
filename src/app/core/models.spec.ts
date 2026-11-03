import { pendienteDeEvaluar } from './models';

describe('pendienteDeEvaluar', () => {
  it('marca lo que nunca se evaluó', () => {
    expect(pendienteDeEvaluar(null, '2026-10-30')).toBe(true);
    expect(pendienteDeEvaluar('', '2026-10-30')).toBe(true);
  });

  it('marca lo evaluado hace más de 30 días y no lo de hace 30 o menos', () => {
    expect(pendienteDeEvaluar('2026-09-29', '2026-10-30')).toBe(true);
    expect(pendienteDeEvaluar('2026-09-30', '2026-10-30')).toBe(false);
    expect(pendienteDeEvaluar('2026-10-30', '2026-10-30')).toBe(false);
  });
});
