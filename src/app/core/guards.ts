import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { Confirmar } from '../shared/confirmar';
import { pesos } from '../shared/formato';
import { Session } from './session';
import { VentaEnCurso } from './venta-en-curso';

export const VENTA_REGISTRADA = 'ventaRegistrada';

export const requiereSesion: CanActivateFn = async (_ruta, estado) => {
  const session = inject(Session);
  const router = inject(Router);
  await session.listo();
  return session.usuario() ? true : router.createUrlTree(['/login'], { queryParams: { volver: estado.url } });
};

export const requiereSucursal: CanActivateFn = async (_ruta, estado) => {
  const session = inject(Session);
  const router = inject(Router);
  await session.listo();
  return session.sucursal() !== undefined
    ? true
    : router.createUrlTree(['/sucursal'], { queryParams: { volver: estado.url } });
};

export const soloAdministrador: CanActivateFn = async (ruta) => {
  const session = inject(Session);
  const router = inject(Router);
  await session.listo();
  return session.esAdmin() ? true : sinPermiso(router, ruta);
};

export const soloVendedor: CanActivateFn = async (ruta) => {
  const session = inject(Session);
  const router = inject(Router);
  await session.listo();
  return session.esVendedor() ? true : sinPermiso(router, ruta);
};

export const eligeSucursal: CanActivateFn = async (ruta) => {
  const session = inject(Session);
  const router = inject(Router);
  await session.listo();
  if (!session.esVendedor()) {
    return true;
  }
  const volver = ruta.queryParamMap.get('volver');
  return router.parseUrl(volver && volver.startsWith('/') && !volver.startsWith('/sucursal') ? volver : '/inicio');
};

export const soloInvitado: CanActivateFn = async () => {
  const session = inject(Session);
  const router = inject(Router);
  await session.listo();
  return session.usuario() ? router.createUrlTree(['/inicio']) : true;
};

export const salirDeVenta: CanDeactivateFn<unknown> = async () => {
  const venta = inject(VentaEnCurso);
  const session = inject(Session);
  const router = inject(Router);
  const confirmar = inject(Confirmar);
  if (!venta.hayVenta() || !session.usuario()) {
    return true;
  }
  if (router.currentNavigation()?.extras.state?.[VENTA_REGISTRADA] === true) {
    return true;
  }
  const descartar = await confirmar.preguntar({
    titulo: '¿Descartar la venta en curso?',
    mensaje: mensajeVentaEnCurso(venta),
    confirmar: 'Descartar venta',
    peligro: true,
  });
  if (descartar) {
    venta.limpiar();
  }
  return descartar;
};

function mensajeVentaEnCurso(venta: VentaEnCurso): string {
  const { productos, total } = venta.resumen();
  const cantidad = productos > 0 ? productos : venta.lineas().length;
  const que = `${cantidad} ${cantidad === 1 ? 'producto' : 'productos'}`;
  const cuanto = total > 0 ? ` por ${pesos(total)}` : '';
  return `El carrito tiene ${que}${cuanto} y la venta aún no está registrada. Si sales, se pierde.`;
}

function sinPermiso(router: Router, ruta: ActivatedRouteSnapshot) {
  let destino = ruta;
  while (destino.firstChild) {
    destino = destino.firstChild;
  }
  const titulo = destino.routeConfig?.title ?? ruta.routeConfig?.title;
  return router.createUrlTree(['/sin-permiso'], {
    queryParams: typeof titulo === 'string' ? { seccion: titulo } : {},
  });
}
