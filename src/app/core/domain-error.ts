/**
 * Error de una regla de negocio (clave duplicada, llave foránea en uso, stock
 * insuficiente). Su mensaje está escrito para mostrarse tal cual al usuario.
 */
export class DomainError extends Error {
  override readonly name: string = 'DomainError';
}

/**
 * El registro pedido no existe (lo borraron o el enlace está mal). Equivale a
 * un 404 del back; el mensaje también se muestra tal cual.
 */
export class NoEncontrado extends DomainError {
  override readonly name: string = 'NoEncontrado';
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  return 'Ocurrió un error inesperado. Intenta de nuevo y, si se repite, restaura los datos de demostración.';
}
