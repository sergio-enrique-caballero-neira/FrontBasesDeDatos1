// Modelos del front. Cada interfaz corresponde a una tabla de la transformación
// del MER (con los cambios acordados en docs/specs). Los atributos multivaluados
// (teléfonos y correos) viajan como arreglos; en la base de datos son tablas aparte.

export type Rol = 'ADMINISTRADOR' | 'VENDEDOR';

export interface Sucursal {
  idSucursal: number;
  nombre: string;
  ciudad: string;
  direccion: string;
  telefono: string;
  idAdministrador: number;
  nombreAdministrador: string;
}

export interface Marca {
  idMarca: number;
  nombre: string;
  paisOrigen: string;
}

export interface Categoria {
  idCategoria: number;
  nombre: string;
  descripcion: string;
  /** Categoría padre; null cuando es una categoría principal. */
  idCategoriaPrincipal: number | null;
}

export interface Producto {
  idProducto: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  costoCompra: number;
  precioBaseVenta: number;
  /** Suma de la cantidad disponible en todas las sucursales. */
  stock: number;
  idCategoria: number;
  idMarca: number;
}

/** Relación Registrar entre PRODUCTO y SUCURSAL. */
export interface Inventario {
  idProducto: number;
  idSucursal: number;
  cantidadDisponible: number;
  ubicacionBodega: string;
}

export interface Proveedor {
  nit: string;
  nombre: string;
  direccion: string;
  telefonos: string[];
  correos: string[];
}

/** Relación ternaria Suministrar entre PROVEEDOR, PRODUCTO y SUCURSAL. */
export interface Suministro {
  nit: string;
  idProducto: number;
  idSucursal: number;
  tiempoEntregaDias: number;
  precioSuministro: number;
}

/** Prueba de calidad que un administrador hace sobre un suministro. */
export interface Evaluacion {
  idEvaluacion: number;
  nit: string;
  idProducto: number;
  idSucursal: number;
  idEmpleado: number;
  fechaEvaluacion: string;
  /** De 1 a 5. */
  calificacion: number;
  cumplimientoTiempo: boolean;
  observaciones: string;
}

export type TipoCliente = 'NATURAL' | 'JURIDICO';

export interface Cliente {
  idCliente: number;
  tipo: TipoCliente;
  numeroDocumento: string;
  direccion: string;
  telefonos: string[];
  correos: string[];
  /** Solo cliente NATURAL. */
  nombre?: string;
  /** Solo cliente NATURAL. */
  apellido?: string;
  /** Solo cliente JURIDICO. */
  razonSocial?: string;
}

export interface Empleado {
  idEmpleado: number;
  documento: string;
  nombre: string;
  apellido: string;
  cargo: string;
  correo: string;
  telefonos: string[];
  rol: Rol;
  /** Solo ADMINISTRADOR. */
  nivelAcceso?: number;
  /** Solo VENDEDOR, como fracción (0.1 = 10 %). */
  comisionVenta?: number;
  idSucursal?: number;
  nombreSucursal?: string;
}

export interface MetodoPago {
  idMetodoPago: number;
  tipo: string;
}

export interface Venta {
  idVenta: number;
  numeroFactura: string;
  /** AAAA-MM-DD */
  fecha: string;
  /** HH:mm */
  hora: string;
  montoTotal: number;
  idMetodoPago: number;
  idCliente: number;
  idEmpleado: number;
  idSucursal: number;
}

export interface DetalleVenta {
  idVenta: number;
  idProducto: number;
  cantidad: number;
  precioUnitario: number;
}

export const COMISION_VENDEDOR = 0.1;

/** Cantidad a partir de la cual el inventario de una sucursal se marca como bajo. */
export const UMBRAL_STOCK_BAJO = 5;

/**
 * Documento con el que la DIAN identifica al consumidor final: la venta a quien
 * no da sus datos. El cliente con este documento es un registro del sistema.
 */
export const DOCUMENTO_CONSUMIDOR_FINAL = '222222222222';

/** Días sin evaluar a partir de los cuales un suministro debe volver a evaluarse. */
export const DIAS_REEVALUACION = 30;

/** Ventana de días con la que se mide el ritmo de ventas (unidades por día). */
export const DIAS_RITMO_VENTAS = 30;

export function esConsumidorFinal(c: Cliente): boolean {
  return c.numeroDocumento.trim() === DOCUMENTO_CONSUMIDOR_FINAL;
}

export function nombreCliente(cliente: Cliente): string {
  return cliente.tipo === 'NATURAL'
    ? `${cliente.nombre ?? ''} ${cliente.apellido ?? ''}`.trim()
    : (cliente.razonSocial ?? '');
}

export function nombreEmpleado(empleado: Empleado): string {
  return `${empleado.nombre} ${empleado.apellido}`;
}
