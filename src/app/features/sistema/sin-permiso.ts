import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faHouse, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { nombreEmpleado } from '../../core/models';
import { Session } from '../../core/session';

/**
 * Sección de otro rol: dice para quién es, con qué usuario se entró y ofrece
 * volver o cambiar de usuario, en vez de devolver al inicio sin explicar nada.
 */
@Component({
  selector: 'app-sin-permiso',
  imports: [RouterLink, FaIconComponent],
  template: `
    <div class="page">
      <div class="card mx-auto" style="max-width: 36rem">
        <div class="card-body p-4 p-md-5">
          <p class="eyebrow mb-2">Sin permiso</p>
          <h1 class="mb-2">{{ titulo() }}</h1>
          <p class="text-body-secondary">
            {{ explicacion() }}
            @if (quien(); as quien) {
              Entraste como <span class="text-body fw-medium">{{ quien }}</span>.
            }
          </p>
          <div class="d-flex flex-wrap gap-2 mt-4">
            <a routerLink="/inicio" class="btn btn-primary">
              <fa-icon [icon]="iconos.faHouse" />
              Volver al inicio
            </a>
            <button type="button" class="btn btn-soft" (click)="cambiarUsuario()">
              <fa-icon [icon]="iconos.faRightFromBracket" />
              Entrar con otro usuario
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SinPermiso {
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  /** Query param `seccion`: el título de la pantalla que se pidió. */
  readonly seccion = input<string>();

  protected readonly iconos = { faHouse, faRightFromBracket };

  private readonly nombreSeccion = computed(() => this.seccion()?.trim().slice(0, 60) ?? '');

  /** La sección es del rol contrario al del usuario: un vendedor pidió algo de administración, o al revés. */
  private readonly paraQuien = computed(() => (this.session.esAdmin() ? 'vendedores' : 'administradores'));

  protected readonly titulo = computed(() =>
    this.nombreSeccion() ? `No puedes abrir ${this.nombreSeccion()}` : 'No puedes abrir esta sección',
  );

  protected readonly explicacion = computed(() => {
    const nombre = this.nombreSeccion();
    const sujeto = nombre ? `La sección ${nombre}` : 'Esta sección';
    return this.session.esAdmin()
      ? `${sujeto} es solo para ${this.paraQuien()}: las ventas las registra quien atiende en la sucursal.`
      : `${sujeto} es solo para ${this.paraQuien()}.`;
  });

  protected readonly quien = computed(() => {
    const usuario = this.session.usuario();
    return usuario ? `${nombreEmpleado(usuario)}, ${usuario.cargo.toLocaleLowerCase('es-CO')}` : '';
  });

  protected cambiarUsuario(): void {
    this.session.cerrarSesion();
    void this.router.navigateByUrl('/login');
  }
}
