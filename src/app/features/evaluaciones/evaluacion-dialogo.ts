import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faStar as faEstrellaVacia } from '@fortawesome/free-regular-svg-icons';
import { faCircleExclamation, faStar } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { mensajeDeError } from '../../core/domain-error';
import { hoyISO } from '../../core/fechas';
import { Evaluacion, Producto, Proveedor, Sucursal, Suministro } from '../../core/models';
import { claveSuministro, EvaluacionesRepository } from '../../data/proveedores.repository';
import { CampoError } from '../../shared/campo-error';
import { ACCESIBILIDAD_FORMULARIOS } from '../../shared/accesibilidad-formularios';

export interface SuministroElegible {
  clave: string;
  nit: string;
  idProducto: number;
  idSucursal: number;
  /** "Proveedor · Producto · Sucursal" */
  descripcion: string;
}

export function suministrosElegibles(
  suministros: Suministro[],
  proveedores: Proveedor[],
  productos: Producto[],
  sucursales: Sucursal[],
): SuministroElegible[] {
  return suministros
    .map((s) => ({
      clave: claveSuministro(s),
      nit: s.nit,
      idProducto: s.idProducto,
      idSucursal: s.idSucursal,
      descripcion: [
        proveedores.find((p) => p.nit === s.nit)?.nombre,
        productos.find((p) => p.idProducto === s.idProducto)?.nombre,
        sucursales.find((x) => x.idSucursal === s.idSucursal)?.nombre,
      ].join(' · '),
    }))
    .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
}

const TEXTO_CALIFICACION = ['', 'Muy mala', 'Mala', 'Aceptable', 'Buena', 'Excelente'];
const MAXIMO_OBSERVACIONES = 400;

@Component({
  selector: 'app-evaluacion-dialogo',
  imports: [ReactiveFormsModule, ACCESIBILIDAD_FORMULARIOS, CampoError, FaIconComponent],
  // Lee el estado del formulario reactivo (no son signals) en la plantilla.
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: `
    .estrellas {
      display: flex;
      gap: 0.25rem;
    }
    /* Área de toque de 44 px por estrella; la llena es tinta y la vacía, contorno gris (AA en ambos temas). */
    .estrellas label {
      display: inline-grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 10px;
      font-size: 1.25rem;
      cursor: pointer;
      color: var(--muted);
      transition: background-color 120ms ease;
    }
    .estrellas label.llena {
      color: var(--ink);
    }
    .estrellas label:hover {
      background: var(--soft-bg);
    }
    .estrellas input:focus-visible + label {
      outline: 2px solid var(--ink);
      outline-offset: 2px;
    }
    .estrellas.invalida label {
      color: var(--danger);
    }
  `,
  template: `
    <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title" id="evaluacion-titulo">Registrar evaluación de calidad</h2>
        <button type="button" class="btn-close" aria-label="Cerrar" (click)="modal.dismiss()"></button>
      </div>
      <div class="modal-body pt-0 d-grid gap-3">
        @if (error(); as error) {
          <div class="alert alert-danger d-flex gap-2 mb-0" role="alert">
            <fa-icon [icon]="iconos.faCircleExclamation" class="mt-1" />
            <span>{{ error }}</span>
          </div>
        }

        @if (fijo(); as fijo) {
          <div>
            <p class="eyebrow mb-1">Suministro evaluado</p>
            <p class="mb-0 fw-medium">{{ fijo.descripcion }}</p>
          </div>
        } @else {
          <div>
            <label for="eval-suministro" class="form-label">Suministro evaluado</label>
            <select id="eval-suministro" class="form-select" formControlName="clave" ngbAutofocus
              [class.is-invalid]="invalido('clave')" aria-describedby="eval-suministro-error eval-suministro-ayuda">
              <option value="">Elige proveedor, producto y sucursal</option>
              @for (s of suministros(); track s.clave) {
                <option [value]="s.clave">{{ s.descripcion }}</option>
              }
            </select>
            <div class="form-text" id="eval-suministro-ayuda">Se evalúa la entrega de un producto de un proveedor en una sucursal específica.</div>
            <app-campo-error [control]="form.controls.clave" [enviado]="enviado()" id="eval-suministro-error" />
          </div>
        }

        <fieldset>
          <legend class="form-label fs-6">Calificación</legend>
          <div class="d-flex align-items-center flex-wrap gap-2">
            <div class="estrellas" [class.invalida]="invalido('calificacion')" (mouseleave)="resaltada.set(0)">
              @for (n of escala; track n) {
                <input type="radio" class="visually-hidden" name="calificacion" [id]="'eval-estrella-' + n" [value]="n"
                  formControlName="calificacion" [attr.aria-label]="n + ' de 5, ' + textoCalificacion[n]"
                  [attr.aria-describedby]="invalido('calificacion') ? 'eval-calificacion-error' : null" />
                <label [for]="'eval-estrella-' + n" [class.llena]="n <= (resaltada() || calificacion())"
                  (mouseenter)="resaltada.set(n)">
                  <fa-icon [icon]="n <= (resaltada() || calificacion()) ? iconos.faStar : iconos.faEstrellaVacia" aria-hidden="true" />
                </label>
              }
            </div>
            <span class="text-body-secondary" aria-hidden="true">
              {{ resaltada() || calificacion() ? textoCalificacion[resaltada() || calificacion()] : 'Sin calificar' }}
            </span>
          </div>
          <p class="form-text mb-0">Con el teclado: Tab llega a las estrellas, las flechas cambian la calificación y Espacio la elige.</p>
          <app-campo-error [control]="form.controls.calificacion" [enviado]="enviado()" id="eval-calificacion-error"
            [mensajes]="{ min: 'Elige una calificación de 1 a 5 estrellas.' }" />
        </fieldset>

        <div class="row g-3">
          <div class="col-sm-6">
            <span class="form-label d-block" id="eval-tiempo-etiqueta">¿Entregó a tiempo?</span>
            <div class="segmento" role="group" aria-labelledby="eval-tiempo-etiqueta">
              <button type="button" [attr.aria-pressed]="form.controls.cumplimientoTiempo.value"
                (click)="form.controls.cumplimientoTiempo.setValue(true)">
                Sí, a tiempo
              </button>
              <button type="button" [attr.aria-pressed]="!form.controls.cumplimientoTiempo.value"
                (click)="form.controls.cumplimientoTiempo.setValue(false)">
                No, llegó tarde
              </button>
            </div>
          </div>
          <div class="col-sm-6">
            <label for="eval-fecha" class="form-label">Fecha de la evaluación</label>
            <input id="eval-fecha" type="date" class="form-control" formControlName="fechaEvaluacion" [max]="hoy"
              [class.is-invalid]="invalido('fechaEvaluacion')" aria-describedby="eval-fecha-error" />
            <app-campo-error [control]="form.controls.fechaEvaluacion" [enviado]="enviado()" id="eval-fecha-error" />
          </div>
        </div>

        <div>
          <label for="eval-observaciones" class="form-label">Observaciones</label>
          <textarea id="eval-observaciones" class="form-control" rows="3" formControlName="observaciones"
            [attr.maxlength]="maximoObservaciones"
            placeholder="Estado del empaque, faltantes, documentos, trato del transportador…"
            [class.is-invalid]="invalido('observaciones')"
            aria-describedby="eval-observaciones-error eval-observaciones-conteo"></textarea>
          <div class="d-flex justify-content-between gap-3">
            <app-campo-error [control]="form.controls.observaciones" [enviado]="enviado()" id="eval-observaciones-error" />
            <span class="form-text num ms-auto text-nowrap" id="eval-observaciones-conteo">
              {{ form.controls.observaciones.value.length }} de {{ maximoObservaciones }} caracteres
            </span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-soft" (click)="modal.dismiss()">Cancelar</button>
        <button type="submit" class="btn btn-primary" [disabled]="guardando()">
          @if (guardando()) {
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            Guardando…
          } @else {
            Registrar evaluación
          }
        </button>
      </div>
    </form>
  `,
})
export class EvaluacionDialogo {
  protected readonly modal = inject(NgbActiveModal);
  private readonly repo = inject(EvaluacionesRepository);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly iconos = { faCircleExclamation, faStar, faEstrellaVacia };
  protected readonly textoCalificacion = TEXTO_CALIFICACION;
  protected readonly escala = [1, 2, 3, 4, 5];
  protected readonly maximoObservaciones = MAXIMO_OBSERVACIONES;
  protected readonly hoy = hoyISO();
  protected readonly suministros = signal<SuministroElegible[]>([]);
  protected readonly fijo = signal<SuministroElegible | null>(null);
  private readonly idEvaluador = signal(0);
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Estrella bajo el puntero: anticipa la calificación antes de elegirla. */
  protected readonly resaltada = signal(0);

  protected readonly form = this.fb.group({
    clave: ['', Validators.required],
    fechaEvaluacion: [this.hoy, Validators.required],
    calificacion: [0, Validators.min(1)],
    cumplimientoTiempo: [true],
    observaciones: ['', [Validators.required, Validators.maxLength(MAXIMO_OBSERVACIONES)]],
  });

  protected readonly calificacion = signal(0);

  constructor() {
    this.form.controls.calificacion.valueChanges.subscribe((valor) => this.calificacion.set(Number(valor)));
  }

  iniciar(suministros: SuministroElegible[], fijo: SuministroElegible | null, idEvaluador: number): void {
    this.suministros.set(suministros);
    this.fijo.set(fijo);
    this.idEvaluador.set(idEvaluador);
    if (fijo) {
      this.form.controls.clave.setValue(fijo.clave);
    }
  }

  protected invalido(campo: 'clave' | 'fechaEvaluacion' | 'calificacion' | 'observaciones'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  protected async guardar(): Promise<void> {
    this.enviado.set(true);
    if (this.form.invalid) {
      return;
    }
    const valor = this.form.getRawValue();
    const suministro = this.fijo() ?? this.suministros().find((s) => s.clave === valor.clave);
    if (!suministro) {
      return;
    }
    if (valor.fechaEvaluacion > this.hoy) {
      this.error.set('La fecha de la evaluación no puede estar en el futuro.');
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const evaluacion = await this.repo.registrar({
        nit: suministro.nit,
        idProducto: suministro.idProducto,
        idSucursal: suministro.idSucursal,
        idEmpleado: this.idEvaluador(),
        fechaEvaluacion: valor.fechaEvaluacion,
        calificacion: Number(valor.calificacion),
        cumplimientoTiempo: valor.cumplimientoTiempo,
        observaciones: valor.observaciones.trim(),
      });
      this.modal.close(evaluacion);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}

export async function abrirDialogoEvaluacion(
  modal: NgbModal,
  suministros: SuministroElegible[],
  fijo: SuministroElegible | null,
  idEvaluador: number,
): Promise<Evaluacion | undefined> {
  const ref = modal.open(EvaluacionDialogo, { ariaLabelledBy: 'evaluacion-titulo', size: 'lg', backdrop: 'static' });
  (ref.componentInstance as EvaluacionDialogo).iniciar(suministros, fijo, idEvaluador);
  try {
    return (await ref.result) as Evaluacion;
  } catch {
    return undefined;
  }
}
