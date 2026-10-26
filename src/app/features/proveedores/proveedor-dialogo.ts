import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { mensajeDeError } from '../../core/domain-error';
import { Proveedor } from '../../core/models';
import { ProveedoresRepository } from '../../data/proveedores.repository';
import { CampoError } from '../../shared/campo-error';
import { controlesLista, ListaCampos, valoresLista } from '../../shared/lista-campos';
import { ACCESIBILIDAD_FORMULARIOS } from '../../shared/accesibilidad-formularios';

@Component({
  selector: 'app-proveedor-dialogo',
  imports: [ReactiveFormsModule, ACCESIBILIDAD_FORMULARIOS, CampoError, ListaCampos, FaIconComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title" id="proveedor-titulo">{{ existente() ? 'Editar proveedor' : 'Nuevo proveedor' }}</h2>
        <button type="button" class="btn-close" aria-label="Cerrar" (click)="modal.dismiss()"></button>
      </div>
      <div class="modal-body pt-0 d-grid gap-3">
        @if (error(); as error) {
          <div class="alert alert-danger d-flex gap-2 mb-0" role="alert">
            <fa-icon [icon]="iconoError" class="mt-1" />
            <span>{{ error }}</span>
          </div>
        }
        <div class="row g-3">
          <div class="col-sm-5">
            <label for="prov-nit" class="form-label">NIT</label>
            <input id="prov-nit" class="form-control num" formControlName="nit" placeholder="900123456-7" autocomplete="off"
              [class.is-invalid]="invalido('nit')" aria-describedby="prov-nit-error prov-nit-ayuda" />
            @if (existente()) {
              <div class="form-text" id="prov-nit-ayuda">El NIT es la llave del proveedor y no se puede cambiar.</div>
            }
            <app-campo-error [control]="form.controls.nit" [enviado]="enviado()" id="prov-nit-error" />
          </div>
          <div class="col-sm-7">
            <label for="prov-nombre" class="form-label">Nombre o razón social</label>
            <input id="prov-nombre" class="form-control" formControlName="nombre" autocomplete="off"
              [class.is-invalid]="invalido('nombre')" aria-describedby="prov-nombre-error" />
            <app-campo-error [control]="form.controls.nombre" [enviado]="enviado()" id="prov-nombre-error" />
          </div>
        </div>
        <div class="row g-3">
          <div class="col-sm-7">
            <label for="prov-direccion" class="form-label">Dirección</label>
            <input id="prov-direccion" class="form-control" formControlName="direccion" autocomplete="off"
              [class.is-invalid]="invalido('direccion')" aria-describedby="prov-direccion-error" />
            <app-campo-error [control]="form.controls.direccion" [enviado]="enviado()" id="prov-direccion-error" />
          </div>
          <div class="col-sm-5">
            <label for="prov-telefono" class="form-label">Teléfono</label>
            <input id="prov-telefono" type="tel" class="form-control num" formControlName="telefono" autocomplete="off"
              [class.is-invalid]="invalido('telefono')" aria-describedby="prov-telefono-error" />
            <app-campo-error [control]="form.controls.telefono" [enviado]="enviado()" id="prov-telefono-error" />
          </div>
        </div>
        <app-lista-campos
          [arreglo]="form.controls.correos"
          etiqueta="Correos"
          idBase="prov-correo"
          tipo="email"
          placeholder="pedidos@proveedor.com"
          [minimo]="1"
          textoAgregar="Agregar correo"
          [enviado]="enviado()"
        />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-soft" (click)="modal.dismiss()">Cancelar</button>
        <button type="submit" class="btn btn-primary" [disabled]="guardando()">
          @if (guardando()) {
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            Guardando…
          } @else {
            {{ existente() ? 'Guardar cambios' : 'Crear proveedor' }}
          }
        </button>
      </div>
    </form>
  `,
})
export class ProveedorDialogo {
  protected readonly modal = inject(NgbActiveModal);
  private readonly repo = inject(ProveedoresRepository);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly iconoError = faCircleExclamation;
  protected readonly existente = signal<Proveedor | null>(null);
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nit: ['', [Validators.required, Validators.pattern(/^[0-9]{6,12}-?[0-9]$/)]],
    nombre: ['', Validators.required],
    direccion: ['', Validators.required],
    telefono: ['', [Validators.required, Validators.pattern(/^[0-9 +()-]{7,20}$/)]],
    correos: controlesLista('email', [], 1),
  });

  iniciar(proveedor: Proveedor | null): void {
    this.existente.set(proveedor);
    if (proveedor) {
      this.form.setControl('correos', controlesLista('email', proveedor.correos, 1));
      this.form.patchValue(proveedor);
      this.form.controls.nit.disable();
    }
  }

  protected invalido(campo: 'nit' | 'nombre' | 'direccion' | 'telefono'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  protected async guardar(): Promise<void> {
    this.enviado.set(true);
    if (this.form.invalid) {
      return;
    }
    const valor = this.form.getRawValue();
    this.guardando.set(true);
    this.error.set(null);
    try {
      const guardado = await this.repo.guardar(
        {
          nit: valor.nit.trim(),
          nombre: valor.nombre.trim(),
          direccion: valor.direccion.trim(),
          telefono: valor.telefono.trim(),
          correos: valoresLista(this.form.controls.correos),
        },
        !this.existente(),
      );
      this.modal.close(guardado);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}

export async function abrirDialogoProveedor(modal: NgbModal, proveedor: Proveedor | null): Promise<Proveedor | undefined> {
  const ref = modal.open(ProveedorDialogo, { ariaLabelledBy: 'proveedor-titulo', size: 'lg', backdrop: 'static' });
  (ref.componentInstance as ProveedorDialogo).iniciar(proveedor);
  try {
    return (await ref.result) as Proveedor;
  } catch {
    return undefined;
  }
}
