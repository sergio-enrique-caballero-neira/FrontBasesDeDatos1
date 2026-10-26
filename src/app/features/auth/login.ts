import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NOMBRE_APP } from '../../core/app-info';
import { mensajeDeError } from '../../core/domain-error';
import { Session } from '../../core/session';
import { BotonTema } from '../../shared/boton-tema';
import { CampoError } from '../../shared/campo-error';
import { VerClave } from '../../shared/ver-clave';
import { ACCESIBILIDAD_FORMULARIOS } from '../../shared/accesibilidad-formularios';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ACCESIBILIDAD_FORMULARIOS, CampoError, FaIconComponent, BotonTema, VerClave],
  templateUrl: './login.html',
  styleUrl: './auth.css',
})
export class Login {
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  /** Ruta a la que se quería entrar antes de iniciar sesión. */
  readonly volver = input<string>();

  protected readonly nombreApp = NOMBRE_APP;
  protected readonly iconoError = faCircleExclamation;
  protected readonly enviado = signal(false);
  protected readonly entrando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    clave: [''],
  });

  protected async ingresar(): Promise<void> {
    this.enviado.set(true);
    if (this.form.invalid) {
      return;
    }
    const { correo, clave } = this.form.getRawValue();
    await this.entrar(correo, clave);
  }

  protected entrarDemo(correo: string, clave: string): Promise<void> {
    this.form.setValue({ correo, clave });
    return this.entrar(correo, clave);
  }

  private async entrar(correo: string, clave: string): Promise<void> {
    this.entrando.set(true);
    this.error.set(null);
    try {
      await this.session.iniciarSesion(correo, clave);
      await this.router.navigate(['/sucursal'], { queryParams: { volver: this.volver() } });
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.entrando.set(false);
    }
  }
}
