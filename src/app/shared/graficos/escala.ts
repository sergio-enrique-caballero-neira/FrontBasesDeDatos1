/**
 * Tope "limpio" para un eje que arranca en cero y lleva tres marcas (0, la mitad y
 * el tope). Elige el menor de 1, 2, 3, 4, 5, 6, 8 o 10 por potencia de 10 que cubra
 * el valor, así la marca del medio también es un número redondo y sobra poco aire
 * arriba. Con datos enteros (ventas, unidades) un tope pequeño impar sube al par
 * siguiente para que la marca del medio no quede en 1,5 ventas.
 *
 * Para paneles pequeños con escala compartida, el padre puede pasar el mayor valor
 * de todos los paneles: cada panel redondea el mismo número y obtiene el mismo tope.
 */
export function topeRedondo(valor: number, enteros = false): number {
  if (!(valor > 0)) return enteros ? 2 : 1;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const limpio = [1, 2, 3, 4, 5, 6, 8, 10].find((n) => valor <= n * potencia * (1 + 1e-9)) ?? 10;
  const tope = limpio * potencia;
  return enteros && tope < 10 && tope % 2 !== 0 ? tope + 1 : tope;
}

/**
 * Ancho aproximado, en píxeles, de un texto del eje (0,6875 rem de Geist con cifras
 * tabulares). Sirve para reservar el margen izquierdo y no cortar ni encimar etiquetas.
 */
export function anchoTexto(texto: string): number {
  return texto.length * 6.4;
}
