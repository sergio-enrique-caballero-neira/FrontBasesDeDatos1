import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NOMBRE_APP } from '../../core/app-info';
import { mensajeDeError } from '../../core/domain-error';
import { Session } from '../../core/session';
import { ACCESIBILIDAD_FORMULARIOS } from '../../shared/accesibilidad-formularios';
import { BotonTema } from '../../shared/boton-tema';
import { CampoError } from '../../shared/campo-error';
import { VerClave } from '../../shared/ver-clave';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ACCESIBILIDAD_FORMULARIOS, CampoError, FaIconComponent, BotonTema, VerClave],
  templateUrl: './login.html',
  styleUrl: './auth.css',
})
export class Login {
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  readonly volver = input<string>();

  protected readonly nombreApp = NOMBRE_APP;
  protected readonly iconoError = faCircleExclamation;
  protected readonly enviado = signal(false);
  protected readonly entrando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', Validators.required],
  });

  protected async ingresar(): Promise<void> {
    this.enviado.set(true);
    if (this.form.invalid) {
      return;
    }
    const { correo, contrasena } = this.form.getRawValue();
    this.entrando.set(true);
    this.error.set(null);
    try {
      const empleado = await this.session.iniciarSesion(correo, contrasena);
      const volver = this.volver();
      if (empleado.rol === 'VENDEDOR') {
        await this.router.navigateByUrl(volver && volver.startsWith('/') && !volver.startsWith('/sucursal') ? volver : '/inicio');
      } else {
        await this.router.navigate(['/sucursal'], { queryParams: { volver } });
      }
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.entrando.set(false);
    }
  }
}
