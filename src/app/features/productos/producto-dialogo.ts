import { inject, Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Categoria, Marca, Producto } from '../../core/models';
import { ProductosRepository } from '../../data/productos.repository';
import { abrirFormulario, OpcionCampo } from '../../shared/formulario-dialogo';

export interface CatalogosProducto {
  marcas: Marca[];
  categorias: Categoria[];
}

@Injectable({ providedIn: 'root' })
export class DialogoProducto {
  private readonly modal = inject(NgbModal);
  private readonly repo = inject(ProductosRepository);

  abrir(producto: Producto | null, catalogos: CatalogosProducto): Promise<Producto | undefined> {
    return abrirFormulario(this.modal, {
      titulo: producto ? 'Editar producto' : 'Nuevo producto',
      textoGuardar: producto ? 'Guardar cambios' : 'Crear producto',
      campos: [
        { clave: 'codigo', etiqueta: 'Código', requerido: true, patron: /^[A-Za-z0-9-]{3,20}$/, placeholder: 'HM-0001', mitad: true },
        { clave: 'nombre', etiqueta: 'Nombre', requerido: true, mitad: true },
        { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'textarea', requerido: true },
        { clave: 'idMarca', etiqueta: 'Marca', tipo: 'select', requerido: true, opciones: opcionesMarca(catalogos.marcas), mitad: true },
        {
          clave: 'idCategoria',
          etiqueta: 'Categoría',
          tipo: 'select',
          requerido: true,
          opciones: opcionesCategoria(catalogos.categorias),
          mitad: true,
        },
        { clave: 'costoCompra', etiqueta: 'Costo de compra (COP)', tipo: 'number', requerido: true, minimo: 1, mitad: true },
        {
          clave: 'precioBaseVenta',
          etiqueta: 'Precio base de venta (COP)',
          tipo: 'number',
          requerido: true,
          minimo: 1,
          mitad: true,
          ayuda: 'No puede ser menor que el costo de compra.',
        },
      ],
      valores: producto
        ? {
            codigo: producto.codigo,
            nombre: producto.nombre,
            descripcion: producto.descripcion,
            idMarca: String(producto.idMarca),
            idCategoria: String(producto.idCategoria),
            costoCompra: String(producto.costoCompra),
            precioBaseVenta: String(producto.precioBaseVenta),
          }
        : undefined,
      guardar: (v) =>
        this.repo.guardar({
          idProducto: producto?.idProducto ?? 0,
          codigo: v['codigo'].toUpperCase(),
          nombre: v['nombre'],
          descripcion: v['descripcion'],
          idMarca: Number(v['idMarca']),
          idCategoria: Number(v['idCategoria']),
          costoCompra: Math.round(Number(v['costoCompra'])),
          precioBaseVenta: Math.round(Number(v['precioBaseVenta'])),
          stock: producto?.stock ?? 0,
        }),
    });
  }
}

function opcionesMarca(marcas: Marca[]): OpcionCampo[] {
  return marcas.map((m) => ({ valor: String(m.idMarca), texto: m.nombre }));
}

function opcionesCategoria(categorias: Categoria[]): OpcionCampo[] {
  const principales = categorias.filter((c) => c.idCategoriaPrincipal === null);
  return principales.flatMap((principal) => {
    const hijas = categorias.filter((c) => c.idCategoriaPrincipal === principal.idCategoria);
    return hijas.length
      ? hijas.map((h) => ({ valor: String(h.idCategoria), texto: h.nombre, grupo: principal.nombre }))
      : [{ valor: String(principal.idCategoria), texto: principal.nombre, grupo: 'Sin subcategorías' }];
  });
}
