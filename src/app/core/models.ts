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
  idCategoriaPrincipal: number | null;
}

export interface Producto {
  idProducto: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  costoCompra: number;
  precioBaseVenta: number;
  stock: number;
  idCategoria: number;
  idMarca: number;
}

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

export interface Suministro {
  nit: string;
  idProducto: number;
  idSucursal: number;
  tiempoEntregaDias: number;
  precioSuministro: number;
}

export interface Evaluacion {
  idEvaluacion: number;
  nit: string;
  idProducto: number;
  idSucursal: number;
  idEmpleado: number;
  fechaEvaluacion: string;
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
  nombre?: string;
  apellido?: string;
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
  nivelAcceso?: number;
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
  fecha: string;
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

export const UMBRAL_STOCK_BAJO = 5;

export const DOCUMENTO_CONSUMIDOR_FINAL = '222222222222';

export const DIAS_REEVALUACION = 30;

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
