import { Component, inject, input, resource } from '@angular/core';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faLayerGroup, faStore } from '@fortawesome/free-solid-svg-icons';
import { NOMBRE_APP } from '../../core/app-info';
import { SeleccionSucursal, Session } from '../../core/session';
import { SucursalesRepository } from '../../data/catalogos.repository';
import { BotonTema } from '../../shared/boton-tema';
import { ErrorCarga, Vacio } from '../../shared/ui';

const FILAS_ESQUELETO = [0, 1, 2];

@Component({
  selector: 'app-elegir-sucursal',
  imports: [FaIconComponent, ErrorCarga, Vacio, BotonTema],
  templateUrl: './elegir-sucursal.html',
  styleUrl: './auth.css',
})
export class ElegirSucursal {
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly sucursalesRepo = inject(SucursalesRepository);

  readonly volver = input<string>();

  protected readonly nombreApp = NOMBRE_APP;
  protected readonly iconos = { faStore, faLayerGroup };
  protected readonly usuario = this.session.usuario;
  protected readonly filasEsqueleto = FILAS_ESQUELETO;
  protected readonly sucursales = resource({ loader: () => this.sucursalesRepo.listar() });

  protected esActual(seleccion: SeleccionSucursal): boolean {
    return this.session.sucursal() === seleccion;
  }

  protected elegir(seleccion: SeleccionSucursal): void {
    this.session.elegirSucursal(seleccion);
    const destino = this.volver();
    void this.router.navigateByUrl(destino && destino.startsWith('/') && !destino.startsWith('/sucursal') ? destino : '/inicio');
  }

  protected salir(): void {
    this.session.cerrarSesion();
    void this.router.navigateByUrl('/login');
  }
}
