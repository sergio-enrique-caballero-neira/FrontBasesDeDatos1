import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation, faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { mensajeDeError } from '../../core/domain-error';
import { Inventario, Producto, Sucursal } from '../../core/models';
import { InventarioRepository } from '../../data/productos.repository';
import { CampoError } from '../../shared/campo-error';
import { numero } from '../../shared/formato';
import { ACCESIBILIDAD_FORMULARIOS } from '../../shared/accesibilidad-formularios';

export type ModoInventario = 'entrada' | 'conteo';

export interface DatosInventarioDialogo {
  sucursal: Sucursal;
  registro: Inventario | null;
  productos: Producto[];
  modo?: ModoInventario;
}

export interface ResultadoInventario {
  registro: Inventario;
  modo: ModoInventario;
}

@Component({
  selector: 'app-inventario-dialogo',
  imports: [ReactiveFormsModule, ACCESIBILIDAD_FORMULARIOS, CampoError, FaIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
      <div class="modal-header">
        <h2 class="modal-title" id="inventario-titulo">
          {{ esNuevo() ? 'Agregar producto a la sucursal' : 'Ajustar inventario' }}
        </h2>
        <button type="button" class="btn-close" aria-label="Cerrar" (click)="modal.dismiss()"></button>
      </div>
      <div class="modal-body pt-0 d-grid gap-3">
        <p class="text-body-secondary mb-0">{{ datos().sucursal.nombre }} · {{ datos().sucursal.ciudad }}</p>
        @if (error(); as error) {
          <div class="alert alert-danger d-flex gap-2 mb-0" role="alert">
            <fa-icon [icon]="iconos.faCircleExclamation" class="mt-1" />
            <span>{{ error }}</span>
          </div>
        }

        @if (esNuevo()) {
          <p class="form-text mb-0">
            @if (modo() === 'entrada') {
              Llegó mercancía de un producto que la sucursal aún no maneja: se crea su registro con las unidades recibidas.
            } @else {
              Registra el producto con las unidades que hay hoy en la bodega (puede ser 0).
            }
          </p>
        } @else {
          <div>
            <span class="form-label d-block" id="inv-modo-etiqueta">¿Qué quieres hacer?</span>
            <div class="segmento" role="group" aria-labelledby="inv-modo-etiqueta">
              <button type="button" [attr.aria-pressed]="modo() === 'entrada'" (click)="cambiarModo('entrada')">
                Registrar entrada
              </button>
              <button type="button" [attr.aria-pressed]="modo() === 'conteo'" (click)="cambiarModo('conteo')">
                Corregir conteo
              </button>
            </div>
            <p class="form-text mb-0 mt-2">
              @if (modo() === 'entrada') {
                Llegó mercancía: las unidades se suman a las que ya hay, aunque se venda algo mientras tanto.
              } @else {
                Úsalo después de un conteo físico; reemplaza la cantidad.
              }
            </p>
          </div>
        }

        <div>
          <label for="inv-producto" class="form-label">Producto</label>
          <select id="inv-producto" class="form-select" formControlName="idProducto"
            [class.is-invalid]="invalido('idProducto')" aria-describedby="inv-producto-error">
            <option [ngValue]="null" disabled>Elige un producto</option>
            @for (producto of datos().productos; track producto.idProducto) {
              <option [ngValue]="producto.idProducto">{{ producto.codigo }} · {{ producto.nombre }}</option>
            }
          </select>
          <app-campo-error [control]="form.controls.idProducto" [enviado]="enviado()" id="inv-producto-error" />
        </div>

        <div class="row g-3">
          <div class="col-sm-5">
            @if (modo() === 'entrada') {
              <label for="inv-unidades" class="form-label">Unidades recibidas</label>
              <input id="inv-unidades" type="number" min="1" step="1" inputmode="numeric" class="form-control num"
                formControlName="unidades" [class.is-invalid]="invalido('unidades')"
                aria-describedby="inv-unidades-error inv-vista-previa" />
              <app-campo-error [control]="form.controls.unidades" [enviado]="enviado()" id="inv-unidades-error"
                [mensajes]="{ min: 'Debe llegar al menos 1 unidad.' }" />
            } @else {
              <label for="inv-cantidad" class="form-label">{{ esNuevo() ? 'Cantidad inicial' : 'Cantidad contada' }}</label>
              <input id="inv-cantidad" type="number" min="0" step="1" inputmode="numeric" class="form-control num"
                formControlName="cantidadDisponible" [class.is-invalid]="invalido('cantidadDisponible')"
                aria-describedby="inv-cantidad-error inv-vista-previa" />
              <app-campo-error [control]="form.controls.cantidadDisponible" [enviado]="enviado()" id="inv-cantidad-error" />
            }
          </div>
          <div class="col-sm-7">
            <label for="inv-ubicacion" class="form-label">Ubicación en bodega</label>
            <input id="inv-ubicacion" class="form-control" formControlName="ubicacionBodega" placeholder="Pasillo y estante"
              [class.is-invalid]="invalido('ubicacionBodega')" aria-describedby="inv-ubicacion-error" />
            <app-campo-error [control]="form.controls.ubicacionBodega" [enviado]="enviado()" id="inv-ubicacion-error" />
          </div>
        </div>

        @if (cambioDesdeLista(); as antes) {
          <p class="form-text d-flex gap-2 mb-0">
            <fa-icon [icon]="iconos.faCircleInfo" class="mt-1" />
            <span>
              La cantidad cambió mientras tenías la lista abierta (decía {{ antes }}). Las cifras de aquí son las vigentes.
            </span>
          </p>
        }
        <p class="mb-0 fw-medium" id="inv-vista-previa" aria-live="polite">{{ vistaPrevia() }}</p>
        <p class="form-text mb-0">El stock total del producto se recalcula sumando todas las sucursales.</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-soft" (click)="modal.dismiss()">Cancelar</button>
        <button type="submit" class="btn btn-primary" [disabled]="guardando()">
          @if (guardando()) {
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            Guardando…
          } @else {
            {{ textoGuardar() }}
          }
        </button>
      </div>
    </form>
  `,
})
export class InventarioDialogo {
  protected readonly modal = inject(NgbActiveModal);
  private readonly repo = inject(InventarioRepository);
  private readonly fb = inject(FormBuilder);

  protected readonly iconos = { faCircleExclamation, faCircleInfo };
  protected readonly datos = signal<DatosInventarioDialogo>({ sucursal: {} as Sucursal, registro: null, productos: [] });
  protected readonly modo = signal<ModoInventario>('conteo');
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly vigente = signal<number | null>(null);

  protected readonly form = this.fb.group({
    idProducto: this.fb.control<number | null>(null, Validators.required),
    cantidadDisponible: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0), enteroValidator]),
    unidades: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), enteroValidator]),
    ubicacionBodega: this.fb.nonNullable.control('', Validators.required),
  });

  protected readonly esNuevo = computed(() => this.datos().registro === null);
  private readonly actual = computed(() => this.vigente() ?? this.datos().registro?.cantidadDisponible ?? 0);

  protected readonly cambioDesdeLista = computed(() => {
    const deLista = this.datos().registro?.cantidadDisponible;
    const vigente = this.vigente();
    return deLista !== undefined && vigente !== null && vigente !== deLista ? numero(deLista) : null;
  });

  protected readonly textoGuardar = computed(() => {
    if (this.modo() === 'entrada') {
      return 'Registrar entrada';
    }
    return this.esNuevo() ? 'Agregar a la sucursal' : 'Guardar conteo';
  });

  get modoElegido(): ModoInventario {
    return this.modo();
  }

  iniciar(datos: DatosInventarioDialogo): void {
    this.datos.set(datos);
    if (datos.registro) {
      this.form.patchValue(datos.registro);
      this.form.controls.idProducto.disable();
      void this.leerVigente(datos.registro);
    } else if (datos.productos.length === 1) {
      this.form.controls.idProducto.setValue(datos.productos[0].idProducto);
    }
    this.cambiarModo(datos.modo ?? 'conteo');
  }

  protected cambiarModo(modo: ModoInventario): void {
    this.modo.set(modo);
    this.error.set(null);
    const { unidades, cantidadDisponible } = this.form.controls;
    if (modo === 'entrada') {
      cantidadDisponible.disable();
      unidades.enable();
    } else {
      unidades.disable();
      cantidadDisponible.enable();
    }
  }

  private async leerVigente(registro: Inventario): Promise<void> {
    try {
      const filas = await this.repo.listar(registro.idSucursal);
      const fila = filas.find((f) => f.idProducto === registro.idProducto);
      if (!fila) {
        this.error.set('Este producto ya no está en el inventario de la sucursal. Cierra el diálogo y revisa la lista.');
        return;
      }
      this.vigente.set(fila.cantidadDisponible);
      const { cantidadDisponible } = this.form.controls;
      if (cantidadDisponible.pristine) {
        cantidadDisponible.setValue(fila.cantidadDisponible);
      }
    } catch {
    }
  }

  protected vistaPrevia(): string {
    const unidades = this.form.controls.unidades.value;
    const contada = this.form.controls.cantidadDisponible.value;
    if (this.esNuevo()) {
      const inicial = this.modo() === 'entrada' ? unidades : contada;
      const minimo = this.modo() === 'entrada' ? 1 : 0;
      return esEnteroPositivo(inicial, minimo)
        ? `Empieza con ${numero(inicial)} ${inicial === 1 ? 'unidad' : 'unidades'} en ${this.datos().sucursal.nombre}`
        : '';
    }
    const actual = this.actual();
    const hay = `Hay ${numero(actual)}`;
    if (this.modo() === 'entrada') {
      return esEnteroPositivo(unidades, 1) ? `${hay} · quedarán ${numero(actual + unidades)}` : hay;
    }
    if (!esEnteroPositivo(contada, 0)) {
      return hay;
    }
    const diferencia = contada - actual;
    const detalle =
      diferencia === 0 ? 'sin cambio' : `${numero(Math.abs(diferencia))} ${diferencia > 0 ? 'más' : 'menos'}`;
    return `${hay} · quedarán ${numero(contada)} (${detalle})`;
  }

  protected invalido(campo: 'idProducto' | 'cantidadDisponible' | 'unidades' | 'ubicacionBodega'): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  protected async guardar(): Promise<void> {
    this.enviado.set(true);
    if (this.form.invalid) {
      return;
    }
    const valor = this.form.getRawValue();
    const idProducto = valor.idProducto!;
    const idSucursal = this.datos().sucursal.idSucursal;
    const ubicacion = valor.ubicacionBodega.trim();
    this.guardando.set(true);
    this.error.set(null);
    try {
      const resultado =
        this.modo() === 'entrada'
          ? await this.repo.registrarEntrada(idProducto, idSucursal, valor.unidades!, ubicacion)
          : await this.repo.guardar({
              idProducto,
              idSucursal,
              cantidadDisponible: valor.cantidadDisponible,
              ubicacionBodega: ubicacion,
            });
      this.modal.close(resultado);
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }
}

function enteroValidator(control: AbstractControl): ValidationErrors | null {
  return control.value === null || Number.isInteger(control.value) ? null : { entero: true };
}

function esEnteroPositivo(valor: unknown, minimo: number): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= minimo;
}

export async function dialogoInventario(
  modal: NgbModal,
  datos: DatosInventarioDialogo,
): Promise<ResultadoInventario | undefined> {
  const ref = modal.open(InventarioDialogo, { ariaLabelledBy: 'inventario-titulo', backdrop: 'static' });
  const dialogo = ref.componentInstance as InventarioDialogo;
  dialogo.iniciar(datos);
  try {
    const registro = (await ref.result) as Inventario;
    return { registro, modo: dialogo.modoElegido };
  } catch {
    return undefined;
  }
}

export async function resultadoDialogoInventario(
  modal: NgbModal,
  datos: DatosInventarioDialogo,
): Promise<Inventario | undefined> {
  return (await dialogoInventario(modal, datos))?.registro;
}

export async function abrirDialogoInventario(modal: NgbModal, datos: DatosInventarioDialogo): Promise<boolean> {
  return (await dialogoInventario(modal, datos)) !== undefined;
}
