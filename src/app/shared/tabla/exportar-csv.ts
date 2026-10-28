export interface ColumnaCsv<T> {
  titulo: string;
  valor: (fila: T) => string | number | null | undefined;
}

export function descargarCsv<T>(nombreArchivo: string, columnas: ColumnaCsv<T>[], filas: T[]): void {
  const celda = (valor: string | number | null | undefined) => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const lineas = [
    columnas.map((c) => celda(c.titulo)).join(';'),
    ...filas.map((fila) => columnas.map((c) => celda(c.valor(fila))).join(';')),
  ];
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
