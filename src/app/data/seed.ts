import { fechaISO, horaHHmm, sumarDias } from '../core/fechas';
import {
  Categoria,
  Cliente,
  DetalleVenta,
  DOCUMENTO_CONSUMIDOR_FINAL,
  Empleado,
  Evaluacion,
  Inventario,
  Marca,
  MetodoPago,
  Producto,
  Proveedor,
  Sucursal,
  Suministro,
  Venta,
} from '../core/models';
import type { Tablas } from './mock-db';

// Datos de demostración. La interfaz los marca como tales en la barra superior
// y se pueden restaurar en cualquier momento. Las marcas son reales; las
// personas, empresas, direcciones y teléfonos son inventados para la demo.

const sucursales: Sucursal[] = [
  { idSucursal: 1, nombre: 'Sede Centro', ciudad: 'Bogotá', direccion: 'Calle 13 # 8-45', telefono: '601 342 1180', idAdministrador: 1, nombreAdministrador: 'Laura Gómez' },
  { idSucursal: 2, nombre: 'Sede Norte', ciudad: 'Bogotá', direccion: 'Autopista Norte # 145-30', telefono: '601 615 2290', idAdministrador: 1, nombreAdministrador: 'Laura Gómez' },
  { idSucursal: 3, nombre: 'Sede Laureles', ciudad: 'Medellín', direccion: 'Circular 1 # 70-12', telefono: '604 411 3375', idAdministrador: 1, nombreAdministrador: 'Laura Gómez' },
];

const marcas: Marca[] = [
  { idMarca: 1, nombre: 'Stanley', paisOrigen: 'Estados Unidos' },
  { idMarca: 2, nombre: 'Truper', paisOrigen: 'México' },
  { idMarca: 3, nombre: 'Bosch', paisOrigen: 'Alemania' },
  { idMarca: 4, nombre: 'DeWalt', paisOrigen: 'Estados Unidos' },
  { idMarca: 5, nombre: 'Pavco', paisOrigen: 'Colombia' },
  { idMarca: 6, nombre: 'Pintuco', paisOrigen: 'Colombia' },
  { idMarca: 7, nombre: '3M', paisOrigen: 'Estados Unidos' },
];

const categorias: Categoria[] = [
  { idCategoria: 1, nombre: 'Herramientas manuales', descripcion: 'Herramientas que no requieren energía eléctrica', idCategoriaPrincipal: null },
  { idCategoria: 2, nombre: 'Martillos', descripcion: 'Martillos de uña, bola y mazos', idCategoriaPrincipal: 1 },
  { idCategoria: 3, nombre: 'Destornilladores', descripcion: 'Destornilladores y juegos de puntas', idCategoriaPrincipal: 1 },
  { idCategoria: 4, nombre: 'Llaves', descripcion: 'Llaves ajustables, combinadas y de tubo', idCategoriaPrincipal: 1 },
  { idCategoria: 5, nombre: 'Herramientas eléctricas', descripcion: 'Herramientas con cable o batería', idCategoriaPrincipal: null },
  { idCategoria: 6, nombre: 'Taladros', descripcion: 'Taladros percutores y atornilladores', idCategoriaPrincipal: 5 },
  { idCategoria: 7, nombre: 'Pulidoras', descripcion: 'Pulidoras angulares y de banco', idCategoriaPrincipal: 5 },
  { idCategoria: 8, nombre: 'Plomería', descripcion: 'Tubería, accesorios y adhesivos', idCategoriaPrincipal: null },
  { idCategoria: 9, nombre: 'Tubería y accesorios PVC', descripcion: 'Tubos, codos, uniones y soldadura PVC', idCategoriaPrincipal: 8 },
  { idCategoria: 10, nombre: 'Pinturas', descripcion: 'Pinturas y recubrimientos', idCategoriaPrincipal: null },
  { idCategoria: 11, nombre: 'Vinilos', descripcion: 'Pinturas a base de agua para muros', idCategoriaPrincipal: 10 },
  { idCategoria: 12, nombre: 'Fijaciones', descripcion: 'Tornillos, puntillas y chazos', idCategoriaPrincipal: null },
  { idCategoria: 13, nombre: 'Tornillería', descripcion: 'Tornillos para madera, metal y drywall', idCategoriaPrincipal: 12 },
  { idCategoria: 14, nombre: 'Seguridad industrial', descripcion: 'Elementos de protección personal', idCategoriaPrincipal: null },
];

type FilaProducto = [codigo: string, nombre: string, descripcion: string, costo: number, precio: number, categoria: number, marca: number];

const filasProductos: FilaProducto[] = [
  ['HM-0001', 'Martillo de uña 16 oz', 'Mango de fibra de vidrio con agarre antideslizante', 28000, 42900, 2, 1],
  ['HM-0002', 'Martillo de bola 24 oz', 'Cabeza de acero forjado, mango de madera', 31000, 46900, 2, 2],
  ['HM-0010', 'Juego de destornilladores x6', 'Puntas planas y de estrella, mango ergonómico', 35000, 54900, 3, 1],
  ['HM-0020', 'Llave ajustable 10"', 'Acero cromo vanadio, apertura de 30 mm', 24000, 37900, 4, 2],
  ['HM-0021', 'Juego de llaves combinadas x12', 'Medidas de 8 a 19 mm con estuche', 89000, 134900, 4, 1],
  ['HE-0100', 'Taladro percutor 1/2" 750 W', 'Velocidad variable y reversa, incluye maletín', 210000, 319900, 6, 3],
  ['HE-0101', 'Taladro atornillador inalámbrico 20 V', 'Dos baterías de litio y cargador', 380000, 559900, 6, 4],
  ['HE-0110', 'Pulidora angular 4 1/2" 850 W', 'Disco de 115 mm, guarda ajustable', 175000, 259900, 7, 3],
  ['PL-0200', 'Tubo PVC presión 1/2" x 6 m', 'RDE 13.5 para agua fría', 14500, 22900, 9, 5],
  ['PL-0201', 'Codo PVC presión 1/2" x 90°', 'Para tubería de presión', 650, 1200, 9, 5],
  ['PL-0202', 'Soldadura líquida PVC 1/4 gal', 'Para tubería de presión y sanitaria', 32000, 48900, 9, 5],
  ['PI-0300', 'Vinilo tipo 1 blanco, galón', 'Lavable, para interiores', 52000, 79900, 11, 6],
  ['PI-0301', 'Vinilo tipo 2 blanco, cuñete 5 gal', 'Para interiores de bajo tráfico', 145000, 219900, 11, 6],
  ['FJ-0400', 'Tornillo drywall 6 x 1", caja x100', 'Punta fina, cabeza de trompeta', 6500, 11900, 13, 2],
  ['SI-0500', 'Gafas de seguridad lente claro', 'Protección lateral, antiempañante', 7200, 13900, 14, 7],
  ['SI-0501', 'Respirador media cara', 'Cartuchos y filtros se venden por separado', 58000, 89900, 14, 7],
];

const pasillos = ['Pasillo 1', 'Pasillo 2', 'Pasillo 3', 'Pasillo 4', 'Bodega trasera'];
const estantes = ['estante A', 'estante B', 'estante C', 'estante D'];

/** Productos que cada sucursal no maneja, para que el inventario no sea idéntico. */
const noManeja: Record<number, number[]> = { 1: [], 2: [13], 3: [5, 13, 16] };

const proveedores: Proveedor[] = [
  { nit: '900215334-1', nombre: 'Distribuidora Ferretera Andina S.A.S.', direccion: 'Carrera 68 # 13-40, Bogotá', telefonos: ['601 405 7788'], correos: ['pedidos@ferreandina.demo', 'cartera@ferreandina.demo'] },
  { nit: '830104552-8', nombre: 'Importadora de Herramientas del Caribe S.A.S.', direccion: 'Vía 40 # 71-120, Barranquilla', telefonos: ['605 360 1422'], correos: ['ventas@herracaribe.demo'] },
  { nit: '901330871-5', nombre: 'Tubos y Conexiones de Antioquia S.A.S.', direccion: 'Calle 10 Sur # 50-28, Medellín', telefonos: ['604 285 9010'], correos: ['comercial@tuboscon.demo'] },
  { nit: '860002184-3', nombre: 'Pinturas y Recubrimientos Mayoristas Ltda.', direccion: 'Avenida Boyacá # 64-15, Bogotá', telefonos: ['601 744 2036'], correos: ['pedidos@pinturasmayoristas.demo'] },
];

/** [NIT, productos, sucursales, días de entrega] */
const planSuministro: [string, number[], number[], number][] = [
  ['900215334-1', [1, 2, 3, 4, 5, 14, 15, 16], [1, 2], 3],
  ['830104552-8', [6, 7, 8], [1, 2, 3], 8],
  ['830104552-8', [1, 2, 3, 4, 14, 15], [3], 6],
  ['901330871-5', [9, 10, 11], [1, 2, 3], 4],
  ['860002184-3', [12, 13], [1, 2, 3], 2],
];

const empleados: Empleado[] = [
  { idEmpleado: 1, documento: '52814736', nombre: 'Laura', apellido: 'Gómez', cargo: 'Gerente de operaciones', correo: 'laura.gomez@ferreteria.demo', telefonos: ['310 555 0141'], rol: 'ADMINISTRADOR', nivelAcceso: 3 },
  { idEmpleado: 2, documento: '80123987', nombre: 'Andrés', apellido: 'Pardo', cargo: 'Jefe de compras', correo: 'andres.pardo@ferreteria.demo', telefonos: ['315 555 0177'], rol: 'ADMINISTRADOR', nivelAcceso: 2 },
  { idEmpleado: 3, documento: '1020456789', nombre: 'Camila', apellido: 'Rojas', cargo: 'Asesora de ventas', correo: 'camila.rojas@ferreteria.demo', telefonos: ['300 555 0123', '601 555 0190'], rol: 'VENDEDOR', comisionVenta: 0.1 },
  { idEmpleado: 4, documento: '1015332048', nombre: 'Julián', apellido: 'Herrera', cargo: 'Asesor de ventas', correo: 'julian.herrera@ferreteria.demo', telefonos: ['311 555 0166'], rol: 'VENDEDOR', comisionVenta: 0.1 },
  { idEmpleado: 5, documento: '1032478115', nombre: 'Daniela', apellido: 'Ortiz', cargo: 'Asesora de ventas', correo: 'daniela.ortiz@ferreteria.demo', telefonos: ['318 555 0105'], rol: 'VENDEDOR', comisionVenta: 0.1 },
  { idEmpleado: 6, documento: '1128907634', nombre: 'Mateo', apellido: 'Castaño', cargo: 'Asesor de ventas', correo: 'mateo.castano@ferreteria.demo', telefonos: ['304 555 0158'], rol: 'VENDEDOR', comisionVenta: 0.1 },
];

/** Registro del sistema para las ventas a quien no da sus datos (convención DIAN). */
const ID_CONSUMIDOR_FINAL = 7;

const clientes: Cliente[] = [
  { idCliente: 1, tipo: 'NATURAL', nombre: 'Carlos', apellido: 'Medina', numeroDocumento: '79845123', direccion: 'Calle 45 # 22-10, Bogotá', telefonos: ['312 555 0110'], correos: ['carlos.medina@correo.demo'] },
  { idCliente: 2, tipo: 'NATURAL', nombre: 'Paola', apellido: 'Suárez', numeroDocumento: '1019876543', direccion: 'Carrera 15 # 120-33, Bogotá', telefonos: ['320 555 0187'], correos: [] },
  { idCliente: 3, tipo: 'NATURAL', nombre: 'Jorge', apellido: 'Villamil', numeroDocumento: '19456782', direccion: 'Calle 33 # 74-21, Medellín', telefonos: ['301 555 0139', '604 555 0172'], correos: ['jvillamil@correo.demo'] },
  { idCliente: 4, tipo: 'NATURAL', nombre: 'Natalia', apellido: 'Cárdenas', numeroDocumento: '1036654321', direccion: 'Transversal 39 # 70-05, Medellín', telefonos: ['317 555 0194'], correos: ['natalia.cardenas@correo.demo'] },
  { idCliente: 5, tipo: 'JURIDICO', razonSocial: 'Constructora Altos del Río S.A.S.', numeroDocumento: '901456789-2', direccion: 'Avenida Calle 26 # 69-76, Bogotá', telefonos: ['601 555 0150'], correos: ['compras@altosdelrio.demo', 'tesoreria@altosdelrio.demo'] },
  { idCliente: 6, tipo: 'JURIDICO', razonSocial: 'Mantenimientos Integrales JM S.A.S.', numeroDocumento: '900874512-6', direccion: 'Carrera 43A # 1-50, Medellín', telefonos: ['604 555 0181'], correos: ['jm.mantenimientos@correo.demo'] },
  { idCliente: ID_CONSUMIDOR_FINAL, tipo: 'NATURAL', nombre: 'Consumidor', apellido: 'final', numeroDocumento: DOCUMENTO_CONSUMIDOR_FINAL, direccion: 'No aplica', telefonos: ['000 000 0000'], correos: [] },
];

const metodosPago: MetodoPago[] = [
  { idMetodoPago: 1, tipo: 'Efectivo' },
  { idMetodoPago: 2, tipo: 'Tarjeta débito' },
  { idMetodoPago: 3, tipo: 'Tarjeta crédito' },
  { idMetodoPago: 4, tipo: 'Transferencia' },
];

/** Qué sucursal atiende cada vendedor en los datos de demostración. */
const sucursalesPorVendedor: Record<number, number[]> = { 3: [1], 4: [1, 2], 5: [2], 6: [3] };
const clientesPorSucursal: Record<number, number[]> = { 1: [1, 2, 5], 2: [1, 2, 5], 3: [3, 4, 6] };

export function crearDatosSemilla(hoy: Date): Tablas {
  const azar = generadorDeterminista(20261031);
  const elegir = <T>(lista: T[]): T => lista[Math.floor(azar() * lista.length)];

  const productos: Producto[] = filasProductos.map(([codigo, nombre, descripcion, costo, precio, cat, marca], i) => ({
    idProducto: i + 1,
    codigo,
    nombre,
    descripcion,
    costoCompra: costo,
    precioBaseVenta: precio,
    stock: 0,
    idCategoria: cat,
    idMarca: marca,
  }));

  const inventario: Inventario[] = [];
  for (const sucursal of sucursales) {
    for (const producto of productos) {
      if (noManeja[sucursal.idSucursal].includes(producto.idProducto)) {
        continue;
      }
      // Los consumibles baratos se manejan por cientos; algunas herramientas quedan con stock bajo.
      const base = producto.precioBaseVenta < 15000 ? 80 : 6;
      const cantidad = Math.floor(azar() * base * 2) + (azar() < 0.18 ? 0 : 2);
      inventario.push({
        idProducto: producto.idProducto,
        idSucursal: sucursal.idSucursal,
        cantidadDisponible: cantidad,
        ubicacionBodega: `${elegir(pasillos)}, ${elegir(estantes)}`,
      });
    }
  }
  for (const producto of productos) {
    producto.stock = inventario
      .filter((fila) => fila.idProducto === producto.idProducto)
      .reduce((suma, fila) => suma + fila.cantidadDisponible, 0);
  }

  const suministros: Suministro[] = [];
  for (const [nit, idsProducto, idsSucursal, dias] of planSuministro) {
    for (const idProducto of idsProducto) {
      for (const idSucursal of idsSucursal) {
        if (noManeja[idSucursal].includes(idProducto)) {
          continue;
        }
        const producto = productos[idProducto - 1];
        suministros.push({
          nit,
          idProducto,
          idSucursal,
          tiempoEntregaDias: dias + Math.floor(azar() * 3),
          precioSuministro: Math.round((producto.costoCompra * (0.95 + azar() * 0.1)) / 50) * 50,
        });
      }
    }
  }

  const observaciones = [
    'Llegó completo y en la fecha acordada.',
    'Dos cajas con el empaque golpeado, el producto en buen estado.',
    'Entrega con un día de retraso, sin aviso previo.',
    'Faltaron unidades; el proveedor las repuso en la siguiente entrega.',
    'Producto conforme a la orden de compra.',
    'Factura con referencia errada, se corrigió al día siguiente.',
  ];
  const evaluaciones: Evaluacion[] = [];
  for (let i = 0; i < 14; i++) {
    const suministro = elegir(suministros);
    const calificacion = 2 + Math.floor(azar() * 4);
    evaluaciones.push({
      idEvaluacion: i + 1,
      nit: suministro.nit,
      idProducto: suministro.idProducto,
      idSucursal: suministro.idSucursal,
      idEmpleado: elegir([1, 2]),
      fechaEvaluacion: fechaISO(sumarDias(hoy, -Math.floor(azar() * 75) - 1)),
      calificacion,
      cumplimientoTiempo: calificacion >= 4 || azar() < 0.3,
      observaciones: elegir(observaciones),
    });
  }
  evaluaciones.sort((a, b) => a.fechaEvaluacion.localeCompare(b.fechaEvaluacion));
  evaluaciones.forEach((evaluacion, i) => (evaluacion.idEvaluacion = i + 1));

  const ventas: Venta[] = [];
  const detallesVenta: DetalleVenta[] = [];
  const minutosAhora = hoy.getHours() * 60 + hoy.getMinutes();
  for (let i = 0; i < 40; i++) {
    const diasAtras = i < 5 ? 0 : 1 + Math.floor(azar() * 20);
    let minutos = 8 * 60 + Math.floor(azar() * 10 * 60);
    if (diasAtras === 0) {
      // Las ventas de hoy no pueden quedar en el futuro.
      if (minutosAhora < 8 * 60 + 15) {
        continue;
      }
      minutos = 8 * 60 + Math.floor(azar() * (minutosAhora - 8 * 60));
    }
    const fecha = sumarDias(hoy, -diasAtras);
    fecha.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);

    const idEmpleado = elegir([3, 4, 5, 6]);
    const idSucursal = elegir(sucursalesPorVendedor[idEmpleado]);
    const disponibles = inventario.filter((fila) => fila.idSucursal === idSucursal);
    const idVenta = ventas.length + 1;
    const usados = new Set<number>();
    const lineas = 1 + Math.floor(azar() * 3);
    let total = 0;
    for (let l = 0; l < lineas; l++) {
      const idProducto = elegir(disponibles).idProducto;
      if (usados.has(idProducto)) {
        continue;
      }
      usados.add(idProducto);
      const producto = productos[idProducto - 1];
      const cantidad = producto.precioBaseVenta < 15000 ? 2 + Math.floor(azar() * 20) : 1 + Math.floor(azar() * 2);
      detallesVenta.push({ idVenta, idProducto, cantidad, precioUnitario: producto.precioBaseVenta });
      total += cantidad * producto.precioBaseVenta;
    }
    const idMetodoPago = elegir([1, 1, 2, 3, 4]);
    const clienteHabitual = elegir(clientesPorSucursal[idSucursal]);
    ventas.push({
      idVenta,
      numeroFactura: '',
      fecha: fechaISO(fecha),
      hora: horaHHmm(fecha),
      montoTotal: total,
      idMetodoPago,
      // Una de cada cuatro ventas va a consumidor final. Se decide por posición y no
      // con `azar` para no mover la secuencia que genera el resto de los datos.
      idCliente: i % 4 === 3 ? ID_CONSUMIDOR_FINAL : clienteHabitual,
      idEmpleado,
      idSucursal,
    });
  }
  // Las facturas se numeran en orden cronológico, como en la realidad.
  const renumerar = new Map<number, number>();
  ventas
    .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
    .forEach((venta, i) => {
      renumerar.set(venta.idVenta, i + 1);
      venta.idVenta = i + 1;
      venta.numeroFactura = numeroFactura(i + 1);
    });
  for (const detalle of detallesVenta) {
    detalle.idVenta = renumerar.get(detalle.idVenta)!;
  }

  return structuredClone({
    sucursales,
    marcas,
    categorias,
    productos,
    inventario,
    proveedores,
    suministros,
    evaluaciones,
    clientes,
    empleados,
    metodosPago,
    ventas,
    detallesVenta,
  });
}

export function numeroFactura(consecutivo: number): string {
  return `FV-${String(consecutivo).padStart(6, '0')}`;
}

/** Mulberry32: la misma semilla produce siempre los mismos datos de demostración. */
function generadorDeterminista(semilla: number): () => number {
  let estado = semilla;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
