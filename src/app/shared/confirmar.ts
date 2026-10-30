import { Component, ElementRef, inject, Injectable, signal, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { mensajeDeError } from '../core/domain-error';
import { VerClave } from './ver-clave';

export interface OpcionesConfirmar {
  titulo: string;
  mensaje: string;
  confirmar: string;
  peligro?: boolean;
}

export interface OpcionesEliminar {
  titulo: string;
  mensaje: string;
  confirmar: string;
  accion: (clave: string) => Promise<unknown>;
}

@Component({
  selector: 'app-dialogo-eliminar',
  imports: [FaIconComponent, VerClave],
  template: `
    <form (submit)="$event.preventDefault(); eliminar()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title" id="eliminar-titulo">{{ opciones().titulo }}</h2>
      </div>
      <div class="modal-body pt-0">
        <p id="eliminar-mensaje">{{ opciones().mensaje }}</p>
        @if (error(); as error) {
          <div class="alert alert-danger d-flex gap-2" role="alert" id="eliminar-error">
            <fa-icon [icon]="iconoError" class="mt-1" />
            <span>{{ error }}</span>
          </div>
        }
        <label for="eliminar-clave" class="form-label">Clave de seguridad</label>
        <div class="campo-clave">
          <input #campoClave id="eliminar-clave" type="password" class="form-control" autocomplete="off" ngbAutofocus
            [readOnly]="eliminando()" [class.is-invalid]="!!error()" [attr.aria-invalid]="!!error()"
            aria-describedby="eliminar-clave-ayuda eliminar-error" />
          <app-ver-clave [campo]="campoClave" />
        </div>
        <div class="form-text" id="eliminar-clave-ayuda">Es tu clave de administrador, no la contraseña con la que inicias sesión.</div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-soft" [disabled]="eliminando()" (click)="modal.close(false)">Cancelar</button>
        <button type="submit" class="btn btn-danger" [disabled]="eliminando()">
          @if (eliminando()) {
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            Eliminando…
          } @else {
            {{ opciones().confirmar }}
          }
        </button>
      </div>
    </form>
  `,
})
export class DialogoEliminar {
  protected readonly modal = inject(NgbActiveModal);
  protected readonly iconoError = faCircleExclamation;
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campoClave');
  readonly opciones = signal<OpcionesEliminar>({ titulo: '', mensaje: '', confirmar: 'Eliminar', accion: async () => null });
  readonly eliminando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async eliminar(): Promise<void> {
    if (this.eliminando()) {
      return;
    }
    const clave = this.campo().nativeElement.value;
    if (!clave.trim()) {
      this.fallar('Escribe tu clave de seguridad para eliminar.');
      return;
    }
    this.eliminando.set(true);
    this.error.set(null);
    try {
      await this.opciones().accion(clave);
      this.modal.close(true);
    } catch (error) {
      this.fallar(mensajeDeError(error));
    } finally {
      this.eliminando.set(false);
    }
  }

  private fallar(mensaje: string): void {
    this.error.set(mensaje);
    const campo = this.campo().nativeElement;
    queueMicrotask(() => {
      campo.focus();
      campo.select();
    });
  }
}

@Component({
  selector: 'app-dialogo-confirmar',
  template: `
    <div class="modal-header">
      <h2 class="modal-title" id="confirmar-titulo">{{ opciones().titulo }}</h2>
    </div>
    <div class="modal-body pt-0">
      <p class="mb-0" id="confirmar-mensaje">{{ opciones().mensaje }}</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-soft" (click)="modal.close(false)">Cancelar</button>
      <button
        type="button"
        class="btn"
        [class.btn-danger]="opciones().peligro"
        [class.btn-primary]="!opciones().peligro"
        (click)="modal.close(true)"
      >
        {{ opciones().confirmar }}
      </button>
    </div>
  `,
})
export class DialogoConfirmar {
  protected readonly modal = inject(NgbActiveModal);
  readonly opciones = signal<OpcionesConfirmar>({ titulo: '', mensaje: '', confirmar: 'Aceptar' });
}

@Injectable({ providedIn: 'root' })
export class Confirmar {
  private readonly modal = inject(NgbModal);

  async preguntar(opciones: OpcionesConfirmar): Promise<boolean> {
    const ref = this.modal.open(DialogoConfirmar, {
      ariaLabelledBy: 'confirmar-titulo',
      ariaDescribedBy: 'confirmar-mensaje',
      role: 'alertdialog',
      centered: true,
    });
    (ref.componentInstance as DialogoConfirmar).opciones.set(opciones);
    try {
      return (await ref.result) === true;
    } catch {
      return false;
    }
  }

  async eliminar(opciones: OpcionesEliminar): Promise<boolean> {
    const ref = this.modal.open(DialogoEliminar, {
      ariaLabelledBy: 'eliminar-titulo',
      ariaDescribedBy: 'eliminar-mensaje',
      role: 'alertdialog',
      centered: true,
      beforeDismiss: () => !dialogo.eliminando(),
    });
    const dialogo = ref.componentInstance as DialogoEliminar;
    dialogo.opciones.set(opciones);
    try {
      return (await ref.result) === true;
    } catch {
      return false;
    }
  }
}
