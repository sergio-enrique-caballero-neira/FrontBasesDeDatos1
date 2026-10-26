import { Component, inject } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgbToast } from '@ng-bootstrap/ng-bootstrap';
import { Avisos } from '../core/avisos';

@Component({
  selector: 'app-avisos-host',
  imports: [NgbToast, FaIconComponent],
  template: `
    <div class="toast-container position-fixed bottom-0 end-0 p-3 no-print" aria-live="polite" aria-atomic="false">
      @for (aviso of avisos.lista(); track aviso.id) {
        <ngb-toast
          [autohide]="true"
          [delay]="aviso.tipo === 'error' ? 8000 : 4000"
          (hidden)="avisos.cerrar(aviso.id)"
          [attr.role]="aviso.tipo === 'error' ? 'alert' : 'status'"
        >
          <div class="d-flex align-items-start gap-2">
            <fa-icon
              [icon]="aviso.tipo === 'error' ? iconoError : iconoExito"
              [class.text-danger]="aviso.tipo === 'error'"
              class="mt-1"
            />
            <span class="flex-grow-1">{{ aviso.texto }}</span>
            <button type="button" class="btn-close ms-2" aria-label="Cerrar aviso" (click)="avisos.cerrar(aviso.id)"></button>
          </div>
        </ngb-toast>
      }
    </div>
  `,
})
export class AvisosHost {
  protected readonly avisos = inject(Avisos);
  protected readonly iconoExito = faCircleCheck;
  protected readonly iconoError = faCircleExclamation;
}
