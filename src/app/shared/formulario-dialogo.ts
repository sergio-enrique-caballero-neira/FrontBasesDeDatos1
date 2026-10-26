import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { mensajeDeError } from '../core/domain-error';
import { CampoError } from './campo-error';
import { ACCESIBILIDAD_FORMULARIOS } from './accesibilidad-formularios';

export interface OpcionCampo {
  valor: string;
  texto: string;
  grupo?: string;
}

export interface CampoFormulario {
  clave: string;
  etiqueta: string;
  tipo?: 'text' | 'tel' | 'number' | 'textarea' | 'select';
  requerido?: boolean;
  /** Para números: valor mínimo. */
  minimo?: number;
  maximo?: number;
  patron?: RegExp;
  placeholder?: string;
  ayuda?: string;
  opciones?: OpcionCampo[];
  /** Se muestra pero no se edita (por ejemplo, la llave de un registro existente). */
  soloLectura?: boolean;
  /** Ocupa media fila en pantallas medianas o más. */
  mitad?: boolean;
}

export interface OpcionesFormulario<T> {
  titulo: string;
  textoGuardar: string;
  campos: CampoFormulario[];
  valores?: Record<string, string>;
  guardar: (valores: Record<string, string>) => Promise<T>;
}

/**
 * Formulario en diálogo para entidades con atributos simples (marcas, métodos de
 * pago, sucursales, categorías, productos). Los campos se describen con datos y
 * el guardado lo hace el repositorio que recibe en `guardar`.
 */
@Component({
  selector: 'app-formulario-dialogo',
  imports: [ReactiveFormsModule, ACCESIBILIDAD_FORMULARIOS, CampoError, FaIconComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title" id="formulario-titulo">{{ opciones().titulo }}</h2>
        <button type="button" class="btn-close" aria-label="Cerrar" (click)="modal.dismiss()"></button>
      </div>
      <div class="modal-body pt-0">
        @if (error(); as error) {
          <div class="alert alert-danger d-flex gap-2" role="alert">
            <fa-icon [icon]="iconoError" class="mt-1" />
            <span>{{ error }}</span>
          </div>
        }
        <div class="row g-3">
          @for (campo of opciones().campos; track campo.clave) {
            @let id = 'campo-' + campo.clave;
            @let control = form.controls[campo.clave];
            <div [class]="campo.mitad ? 'col-12 col-md-6' : 'col-12'">
              <label [for]="id" class="form-label">{{ campo.etiqueta }}</label>
              @switch (campo.tipo) {
                @case ('textarea') {
                  <textarea [id]="id" class="form-control" rows="3" [formControl]="control" [placeholder]="campo.placeholder ?? ''"
                    [class.is-invalid]="invalido(campo.clave)" [attr.aria-describedby]="id + '-error ' + id + '-ayuda'"></textarea>
                }
                @case ('select') {
                  <select [id]="id" class="form-select" [formControl]="control"
                    [class.is-invalid]="invalido(campo.clave)" [attr.aria-describedby]="id + '-error ' + id + '-ayuda'">
                    <option value="">{{ campo.placeholder ?? 'Elige una opción' }}</option>
                    @for (grupo of grupos(campo); track grupo.nombre) {
                      @if (grupo.nombre) {
                        <optgroup [label]="grupo.nombre">
                          @for (opcion of grupo.opciones; track opcion.valor) {
                            <option [value]="opcion.valor">{{ opcion.texto }}</option>
                          }
                        </optgroup>
                      } @else {
                        @for (opcion of grupo.opciones; track opcion.valor) {
                          <option [value]="opcion.valor">{{ opcion.texto }}</option>
                        }
                      }
                    }
                  </select>
                }
                @default {
                  <input [id]="id" [type]="campo.tipo ?? 'text'" class="form-control" [formControl]="control"
                    [class.num]="campo.tipo === 'number' || campo.tipo === 'tel'"
                    [attr.min]="campo.minimo ?? null" [attr.max]="campo.maximo ?? null"
                    [placeholder]="campo.placeholder ?? ''" autocomplete="off"
                    [class.is-invalid]="invalido(campo.clave)" [attr.aria-describedby]="id + '-error ' + id + '-ayuda'" />
                }
              }
              @if (campo.ayuda) {
                <div class="form-text" [id]="id + '-ayuda'">{{ campo.ayuda }}</div>
              }
              <app-campo-error [control]="control" [enviado]="enviado()" [id]="id + '-error'" />
            </div>
          }
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-soft" (click)="modal.dismiss()">Cancelar</button>
        <button type="submit" class="btn btn-primary" [disabled]="guardando()">
          @if (guardando()) {
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            Guardando…
          } @else {
            {{ opciones().textoGuardar }}
          }
        </button>
      </div>
    </form>
  `,
})
export class FormularioDialogo {
  protected readonly modal = inject(NgbActiveModal);
  protected readonly iconoError = faCircleExclamation;
  protected readonly opciones = signal<OpcionesFormulario<unknown>>({ titulo: '', textoGuardar: '', campos: [], guardar: async () => null });
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected form = new FormGroup<Record<string, FormControl<string>>>({});

  iniciar(opciones: OpcionesFormulario<unknown>): void {
    const controles: Record<string, FormControl<string>> = {};
    for (const campo of opciones.campos) {
      const validadores: ValidatorFn[] = [];
      if (campo.requerido) validadores.push(Validators.required);
      if (campo.minimo !== undefined) validadores.push(Validators.min(campo.minimo));
      if (campo.maximo !== undefined) validadores.push(Validators.max(campo.maximo));
      if (campo.patron) validadores.push(Validators.pattern(campo.patron));
      controles[campo.clave] = new FormControl(
        { value: opciones.valores?.[campo.clave] ?? '', disabled: !!campo.soloLectura },
        { nonNullable: true, validators: validadores },
      );
    }
    this.form = new FormGroup(controles);
    this.opciones.set(opciones);
  }

  protected grupos(campo: CampoFormulario): { nombre: string; opciones: OpcionCampo[] }[] {
    const grupos = new Map<string, OpcionCampo[]>();
    for (const opcion of campo.opciones ?? []) {
      const nombre = opcion.grupo ?? '';
      grupos.set(nombre, [...(grupos.get(nombre) ?? []), opcion]);
    }
    return [...grupos].map(([nombre, opciones]) => ({ nombre, opciones }));
  }

  protected invalido(clave: string): boolean {
    const control = this.form.controls[clave];
    return !!control && control.invalid && (control.touched || this.enviado());
  }

  protected async enviar(): Promise<void> {
    this.enviado.set(true);
    if (this.form.invalid) {
      return;
    }
    const valores = Object.fromEntries(
      Object.entries(this.form.getRawValue()).map(([clave, valor]) => [clave, String(valor ?? '').trim()]),
    );
    this.guardando.set(true);
    this.error.set(null);
    try {
      this.modal.close(await this.opciones().guardar(valores));
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}

/** Abre el formulario. Resuelve con lo que devolvió `guardar`, o undefined si se cancela. */
export async function abrirFormulario<T>(modal: NgbModal, opciones: OpcionesFormulario<T>): Promise<T | undefined> {
  const ref = modal.open(FormularioDialogo, { ariaLabelledBy: 'formulario-titulo', backdrop: 'static' });
  (ref.componentInstance as FormularioDialogo).iniciar(opciones as OpcionesFormulario<unknown>);
  try {
    return (await ref.result) as T;
  } catch {
    return undefined;
  }
}
