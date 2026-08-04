import { AbstractControl, FormGroup } from '@angular/forms';
import { ApiError } from '../core/api/api-error';

/**
 * Gli errori di validazione arrivano come
 * `400 { error: "ZodError", issues: [{ path, code, message }] }` (§3.3):
 * `issues[].path` va mappato **sui campi del form**, non mostrato come testo
 * grezzo.
 */

/**
 * Applica le issue ai controlli corrispondenti e restituisce i messaggi che non
 * hanno trovato un campo (da mostrare a livello di sezione).
 */
export function applyZodIssues(form: FormGroup, error: unknown): string[] {
  if (!(error instanceof ApiError) || error.kind !== 'validation') return [];

  const unmatched: string[] = [];
  for (const issue of error.issues) {
    const control = findControl(form, issue.path);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: issue.message });
      control.markAsTouched();
    } else {
      unmatched.push(formatIssue(issue.path, issue.message));
    }
  }
  return unmatched;
}

function findControl(form: FormGroup, path: (string | number)[]): AbstractControl | null {
  if (!path.length) return null;
  // Il percorso completo, poi la sola foglia: i DTO annidano (`title.it`) ma il
  // form può appiattire in un unico controllo (`titleIt`).
  return form.get(path.map(String)) ?? form.get(String(path[path.length - 1])) ?? null;
}

function formatIssue(path: (string | number)[], message: string): string {
  const field = path.join('.');
  return field ? `${field}: ${message}` : message;
}

/** Messaggio da mostrare sotto un campo: errore del server o vincolo locale. */
export function controlError(control: AbstractControl | null | undefined): string | null {
  if (!control || !control.errors || !(control.touched || control.dirty)) return null;
  const errors = control.errors;
  if (typeof errors['server'] === 'string') return errors['server'] as string;
  if (errors['required']) return 'Campo obbligatorio.';
  if (errors['email']) return 'Indirizzo email non valido.';
  if (errors['min']) return 'Valore troppo basso.';
  if (errors['max']) return 'Valore troppo alto.';
  if (errors['minlength']) return 'Testo troppo corto.';
  return 'Valore non valido.';
}

/** Ripulisce gli errori lasciati dal server prima di un nuovo invio. */
export function clearServerErrors(form: FormGroup): void {
  for (const control of Object.values(form.controls)) {
    if (control.errors && 'server' in control.errors) {
      const { server: _server, ...rest } = control.errors;
      control.setErrors(Object.keys(rest).length ? rest : null);
    }
  }
}
