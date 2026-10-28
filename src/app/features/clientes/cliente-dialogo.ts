import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { mensajeDeError } from '../../core/domain-error';
import { Cliente, TipoCliente } from '../../core/models';
import { ClientesRepository } from '../../data/personas.repository';
import { CampoError } from '../../shared/campo-error';
import { controlesLista, ListaCampos, valoresLista } from '../../shared/lista-campos';
import { ACCESIBILIDAD_FORMULARIOS } from '../../shared/accesibilidad-formularios';

type CampoTexto = 'nombre' | 'apellido' | 'razonSocial' | 'numeroDocumento' | 'direccion';

export interface PrefillCliente {
  numeroDocumento?: string;
  nombre?: string;
}

export function prefillDesdeTexto(texto: string): PrefillCliente {
  const limpio = texto.trim();
  if (!limpio) {
    return {};
  }
  return /^[0-9.\-\s]+$/.test(limpio) ? { numeroDocumento: limpio.replace(/\s+/g, '') } : { nombre: limpio };
}

@Component({
  selector: 'app-cliente-dialogo',
  imports: [ReactiveFormsModule, ACCESIBILIDAD_FORMULARIOS, CampoError, ListaCampos, FaIconComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { class: 'd-flex flex-column flex-grow-1 overflow-hidden' },
  templateUrl: './cliente-dialogo.html',
})
export class ClienteDialogo {
  protected readonly modal = inject(NgbActiveModal);
  private readonly documentoInput = viewChild<ElementRef<HTMLInputElement>>('documento');
  private readonly repo = inject(ClientesRepository);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly iconoError = faCircleExclamation;
  protected readonly existente = signal<Cliente | null>(null);
  protected readonly enviado = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly campoInicial = signal<CampoTexto>('nombre');
  private readonly errorDocumento = signal('');
  protected readonly mensajesDocumento = computed(() => ({
    pattern: 'Escribe de 5 a 15 caracteres: números y, si quieres, puntos o guion (900.123.456-7).',
    servidor: this.errorDocumento(),
  }));

  protected readonly form = this.fb.group({
    tipo: this.fb.control<TipoCliente>('NATURAL'),
    nombre: ['', Validators.required],
    apellido: ['', Validators.required],
    razonSocial: [''],
    numeroDocumento: ['', [Validators.required, Validators.pattern(/^[0-9.-]{5,15}$/)]],
    direccion: ['', Validators.required],
    telefonos: controlesLista('tel', [], 1),
    correos: controlesLista('email', [], 0),
  });

  constructor() {
    this.form.controls.tipo.valueChanges.subscribe((tipo) => this.aplicarTipo(tipo));
  }

  iniciar(cliente: Cliente | null, prefill?: PrefillCliente): void {
    this.existente.set(cliente);
    if (!cliente) {
      this.form.patchValue({
        numeroDocumento: prefill?.numeroDocumento?.trim() ?? '',
        nombre: prefill?.nombre?.trim() ?? '',
      });
      this.campoInicial.set(this.primerCampoVacio());
      return;
    }
    this.form.setControl('telefonos', controlesLista('tel', cliente.telefonos, 1));
    this.form.setControl('correos', controlesLista('email', cliente.correos, 0));
    this.form.patchValue({
      tipo: cliente.tipo,
      nombre: cliente.nombre ?? '',
      apellido: cliente.apellido ?? '',
      razonSocial: cliente.razonSocial ?? '',
      numeroDocumento: cliente.numeroDocumento,
      direccion: cliente.direccion,
    });
    this.campoInicial.set(cliente.tipo === 'NATURAL' ? 'nombre' : 'razonSocial');
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
    const valor = this.form.getRawValue();
    const natural = valor.tipo === 'NATURAL';
    const cliente: Cliente = {
      idCliente: this.existente()?.idCliente ?? 0,
      tipo: valor.tipo,
      numeroDocumento: valor.numeroDocumento.trim(),
      direccion: valor.direccion.trim(),
      telefonos: valoresLista(this.form.controls.telefonos),
      correos: valoresLista(this.form.controls.correos),
      nombre: natural ? valor.nombre.trim() : undefined,
      apellido: natural ? valor.apellido.trim() : undefined,
      razonSocial: natural ? undefined : valor.razonSocial.trim(),
    };
    this.guardando.set(true);
    this.error.set(null);
    try {
      this.modal.close(await this.repo.guardar(cliente));
    } catch (error) {
      this.mostrarError(mensajeDeError(error));
    } finally {
      this.guardando.set(false);
    }
  }

  private mostrarError(mensaje: string): void {
    if (!/documento/i.test(mensaje)) {
      this.error.set(mensaje);
      return;
    }
    const documento = this.form.controls.numeroDocumento;
    this.errorDocumento.set(mensaje);
    documento.setErrors({ ...documento.errors, servidor: mensaje });
    documento.markAsTouched();
    this.documentoInput()?.nativeElement.focus();
  }

  private primerCampoVacio(): CampoTexto {
    const valor = this.form.getRawValue();
    const orden: CampoTexto[] =
      valor.tipo === 'NATURAL'
        ? ['nombre', 'apellido', 'numeroDocumento', 'direccion']
        : ['razonSocial', 'numeroDocumento', 'direccion'];
    return orden.find((campo) => !valor[campo].trim()) ?? orden[0];
  }

  private aplicarTipo(tipo: TipoCliente): void {
    const { nombre, apellido, razonSocial } = this.form.controls;
    const natural = tipo === 'NATURAL';
    nombre.setValidators(natural ? Validators.required : null);
    apellido.setValidators(natural ? Validators.required : null);
    razonSocial.setValidators(natural ? null : Validators.required);
    for (const control of [nombre, apellido, razonSocial]) {
      control.updateValueAndValidity();
    }
  }
}

export async function abrirDialogoCliente(
  modal: NgbModal,
  cliente: Cliente | null,
  prefill?: PrefillCliente | string,
): Promise<Cliente | undefined> {
  const ref = modal.open(ClienteDialogo, {
    ariaLabelledBy: 'cliente-titulo',
    size: 'lg',
    backdrop: 'static',
    scrollable: true,
    fullscreen: 'sm',
  });
  (ref.componentInstance as ClienteDialogo).iniciar(cliente, typeof prefill === 'string' ? prefillDesdeTexto(prefill) : prefill);
  try {
    return (await ref.result) as Cliente;
  } catch {
    return undefined;
  }
}
