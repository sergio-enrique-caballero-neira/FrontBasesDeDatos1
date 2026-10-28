export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function porNombre<T>(nombre: (fila: T) => string): (a: T, b: T) => number {
  return (a, b) => nombre(a).localeCompare(nombre(b), 'es');
}
