import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { mensajeDeError } from '../../core/domain-error';
import { COMISION_VENDEDOR, Empleado, Rol } from '../../core/models';
import { EmpleadosRepository } from '../../data/personas.repository';
import { CampoError } from '../../shared/campo-error';
import { VerClave } from '../../shared/ver-clave';
import { controlesLista, ListaCampos, valoresLista } from '../../shared/lista-campos';
import { ACCESIBILIDAD_FORMULARIOS } from '../../shared/accesibilidad-formularios';

type CampoTexto = 'nombre' | 'apellido' | 'documento' | 'cargo' | 'correo' | 'nivelAcceso' | 'claveSeguridad' | 'comision';

@Component({
  selector: 'app-empleado-dialogo',
  imports: [ReactiveFormsModule, ACCESIBILIDAD_FORMULARIOS, CampoError, ListaCampos, FaIconComponent, VerClave],
  templateUrl: './empleado-dialogo.html',
  // La plantilla lee el estado del formulario reactivo (rol elegido, errores), que no son signals.
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class EmpleadoDialogo {
  protected readonly modal = inject(NgbActiveModal);
  private readonly repo = inject(EmpleadosRepository);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly iconoError = faCircleExclamation;
  protected readonly comisionPorDefecto = COMISION_VENDEDOR * 100;
  protected readonly existente = signal<Empleado | null>(null);
  protected readonly esUsuarioActual = signal(false);
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    rol: this.fb.control<Rol>('VENDEDOR'),
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    documento: ['', [Validators.required, Validators.pattern(/^[0-9]{5,12}$/)]],
    cargo: ['', Validators.required],
    correo: ['', [Validators.required, Validators.email]],
    telefonos: controlesLista('tel', [], 1),
    nivelAcceso: [1],
    claveSeguridad: [''],
    /** Porcentaje (10 = 10 %); el modelo lo guarda como fracción. */
    comision: [COMISION_VENDEDOR * 100],
  });

  constructor() {
    this.form.controls.rol.valueChanges.subscribe((rol) => this.aplicarRol(rol));
    this.aplicarRol(this.form.controls.rol.value);
  }

  iniciar(empleado: Empleado | null, idUsuarioActual: number): void {
    this.existente.set(empleado);
    this.esUsuarioActual.set(empleado?.idEmpleado === idUsuarioActual);
    if (!empleado) {
      return;
    }
    this.form.setControl('telefonos', controlesLista('tel', empleado.telefonos, 1));
    this.form.patchValue({
      rol: empleado.rol,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      documento: empleado.documento,
      cargo: empleado.cargo,
      correo: empleado.correo,
      nivelAcceso: empleado.nivelAcceso ?? 1,
      claveSeguridad: empleado.claveSeguridad ?? '',
      comision: Math.round((empleado.comisionVenta ?? COMISION_VENDEDOR) * 10000) / 100,
    });
    if (this.esUsuarioActual()) {
      // Cambiar el propio rol cerraría el acceso a esta misma pantalla.
      this.form.controls.rol.disable();
    }
  }

  protected invalido(campo: CampoTexto): boolean {
    const control = this.form.controls[campo];
    return control.invalid && (control.touched || this.enviado());
  }

  protected async guardar(): Promise<void> {
    this.enviado.set(true);
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    const admin = v.rol === 'ADMINISTRADOR';
    const empleado: Empleado = {
      idEmpleado: this.existente()?.idEmpleado ?? 0,
      rol: v.rol,
      nombre: v.nombre.trim(),
      apellido: v.apellido.trim(),
      documento: v.documento.trim(),
      cargo: v.cargo.trim(),
      correo: v.correo.trim().toLowerCase(),
      telefonos: valoresLista(this.form.controls.telefonos),
      nivelAcceso: admin ? Number(v.nivelAcceso) : undefined,
      claveSeguridad: admin ? v.claveSeguridad : undefined,
      comisionVenta: admin ? undefined : Math.round(Number(v.comision) * 100) / 10000,
    };
    this.guardando.set(true);
    this.error.set(null);
    try {
      this.modal.close(await this.repo.guardar(empleado));
    } catch (error) {
      this.error.set(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  private aplicarRol(rol: Rol): void {
    const { nivelAcceso, claveSeguridad, comision } = this.form.controls;
    const admin = rol === 'ADMINISTRADOR';
    nivelAcceso.setValidators(admin ? [Validators.required, Validators.min(1), Validators.max(3)] : null);
    claveSeguridad.setValidators(admin ? [Validators.required, Validators.minLength(6)] : null);
    comision.setValidators(admin ? null : [Validators.required, Validators.min(0), Validators.max(50)]);
    nivelAcceso.updateValueAndValidity();
    comision.updateValueAndValidity();
    claveSeguridad.updateValueAndValidity();
  }
}

export async function abrirDialogoEmpleado(
  modal: NgbModal,
  empleado: Empleado | null,
  idUsuarioActual: number,
): Promise<Empleado | undefined> {
  const ref = modal.open(EmpleadoDialogo, { ariaLabelledBy: 'empleado-titulo', size: 'lg', backdrop: 'static' });
  (ref.componentInstance as EmpleadoDialogo).iniciar(empleado, idUsuarioActual);
  try {
    return (await ref.result) as Empleado;
  } catch {
    return undefined;
  }
}
