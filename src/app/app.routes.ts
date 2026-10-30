import { Routes } from '@angular/router';
import {
  eligeSucursal,
  requiereNivel,
  requiereSesion,
  requiereSucursal,
  salirDeVenta,
  soloAdministrador,
  soloInvitado,
  soloVendedor,
} from './core/guards';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Iniciar sesión',
    canActivate: [soloInvitado],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'sucursal',
    title: 'Elegir sucursal',
    canActivate: [requiereSesion, eligeSucursal],
    loadComponent: () => import('./features/auth/elegir-sucursal').then((m) => m.ElegirSucursal),
  },
  {
    path: '',
    component: Shell,
    canActivate: [requiereSesion, requiereSucursal],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio',
        loadComponent: () => import('./features/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'ventas/nueva',
        title: 'Nueva venta',
        canActivate: [soloVendedor],
        canDeactivate: [salirDeVenta],
        loadComponent: () => import('./features/ventas/nueva-venta').then((m) => m.NuevaVentaPage),
      },
      {
        path: 'ventas/:id',
        title: 'Detalle de venta',
        loadComponent: () => import('./features/ventas/venta-detalle').then((m) => m.VentaDetalle),
      },
      {
        path: 'ventas',
        title: 'Ventas',
        loadComponent: () => import('./features/ventas/ventas-lista').then((m) => m.VentasLista),
      },
      {
        path: 'clientes/:id',
        title: 'Cliente',
        loadComponent: () => import('./features/clientes/cliente-ficha').then((m) => m.ClienteFicha),
      },
      {
        path: 'clientes',
        title: 'Clientes',
        loadComponent: () => import('./features/clientes/clientes').then((m) => m.Clientes),
      },
      {
        path: 'inventario',
        title: 'Inventario',
        loadComponent: () => import('./features/inventario/inventario').then((m) => m.InventarioPage),
      },
      {
        path: 'sin-permiso',
        title: 'Sin permiso',
        loadComponent: () => import('./features/sistema/sin-permiso').then((m) => m.SinPermiso),
      },
      {
        path: '',
        canActivate: [soloAdministrador],
        children: [
          {
            path: 'productos/:id',
            title: 'Producto',
            loadComponent: () => import('./features/productos/producto-ficha').then((m) => m.ProductoFicha),
          },
          {
            path: 'productos',
            title: 'Productos',
            loadComponent: () => import('./features/productos/productos').then((m) => m.Productos),
          },
          {
            path: '',
            canActivate: [requiereNivel(2)],
            children: [
              {
                path: 'proveedores/:nit',
                title: 'Proveedor',
                loadComponent: () => import('./features/proveedores/proveedor-ficha').then((m) => m.ProveedorFicha),
              },
              {
                path: 'proveedores',
                title: 'Proveedores',
                loadComponent: () => import('./features/proveedores/proveedores').then((m) => m.Proveedores),
              },
              {
                path: 'suministros',
                title: 'Suministros',
                loadComponent: () => import('./features/suministros/suministros').then((m) => m.Suministros),
              },
              {
                path: 'evaluaciones',
                title: 'Evaluaciones de calidad',
                loadComponent: () => import('./features/evaluaciones/evaluaciones').then((m) => m.Evaluaciones),
              },
            ],
          },
          {
            path: '',
            canActivate: [requiereNivel(3)],
            children: [
              {
                path: 'sucursales',
                title: 'Sucursales',
                loadComponent: () => import('./features/sucursales/sucursales').then((m) => m.Sucursales),
              },
              {
                path: 'empleados',
                title: 'Empleados',
                loadComponent: () => import('./features/empleados/empleados').then((m) => m.Empleados),
              },
              {
                path: 'catalogos/marcas',
                title: 'Marcas',
                loadComponent: () => import('./features/catalogos/marcas').then((m) => m.Marcas),
              },
              {
                path: 'catalogos/categorias',
                title: 'Categorías',
                loadComponent: () => import('./features/catalogos/categorias').then((m) => m.Categorias),
              },
              {
                path: 'catalogos/metodos-pago',
                title: 'Métodos de pago',
                loadComponent: () => import('./features/catalogos/metodos-pago').then((m) => m.MetodosPago),
              },
            ],
          },
        ],
      },
      {
        path: '**',
        title: 'Página no encontrada',
        loadComponent: () => import('./features/sistema/no-encontrada').then((m) => m.NoEncontrada),
      },
    ],
  },
];
