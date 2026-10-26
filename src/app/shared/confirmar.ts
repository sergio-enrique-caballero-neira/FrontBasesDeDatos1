import { Component, inject, Injectable, signal } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

export interface OpcionesConfirmar {
  titulo: string;
  mensaje: string;
  confirmar: string;
  peligro?: boolean;
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
}
