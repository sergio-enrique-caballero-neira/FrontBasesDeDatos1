export function topeRedondo(valor: number, enteros = false): number {
  if (!(valor > 0)) return enteros ? 2 : 1;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const limpio = [1, 2, 3, 4, 5, 6, 8, 10].find((n) => valor <= n * potencia * (1 + 1e-9)) ?? 10;
  const tope = limpio * potencia;
  return enteros && tope < 10 && tope % 2 !== 0 ? tope + 1 : tope;
}

export function anchoTexto(texto: string): number {
  return texto.length * 6.4;
}
