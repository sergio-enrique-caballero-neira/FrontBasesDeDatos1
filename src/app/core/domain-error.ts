export class DomainError extends Error {
  override readonly name: string = 'DomainError';
}

export class NoEncontrado extends DomainError {
  override readonly name: string = 'NoEncontrado';
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo y, si se repite, recarga la página.';
}
