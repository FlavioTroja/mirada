// keijo-ui: scaffolded — do not remove this marker if you intend to re-run ng add
import { Injectable, signal } from '@angular/core';
import { ToastNotification, KeijoIconShape } from '@keijo/ui';
import { check, warning, error as errorIcon, info } from '@keijo/ui/icons';

/**
 * ToastService a **signals** — è il pattern di stato del progetto (AGENTS.md).
 * La shell lega `<keijo-toast-notification [notifications]="toastService.notifications()" />`.
 *
 * Convertito dalla variante `plain` generata da `ng add @keijo/ui`, che era il
 * default dello schematic: il progetto è Angular 20 e usa i signal nativi.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly notifications = signal<ToastNotification[]>([]);
  private counter = 0;

  /** Titoli in italiano: l'interfaccia è italiana, il tipo è un enum interno (§1). */
  private static readonly TITLE: Record<ToastNotification['type'], string> = {
    SUCCESS: 'Fatto',
    WARNING: 'Attenzione',
    ERROR: 'Errore',
    INFO: 'Informazione',
  };

  show(
    type: ToastNotification['type'],
    message: string,
    icon?: KeijoIconShape,
    title?: string,
  ): void {
    const ic = icon ?? this.defaultIcon(type);
    this.notifications.update(current => [
      ...current,
      {
        code: `t-${++this.counter}`,
        type,
        icon: ic,
        title: title ?? ToastService.TITLE[type],
        message,
      },
    ]);
  }

  /**
   * Rimuove la toast uscita di scena. `<keijo-toast-notification>` emette
   * `(dismissed)` con il `code`: senza questa rimozione un array ri-legato
   * ri-mostrerebbe notifiche già chiuse (README di @keijo/ui).
   */
  dismiss(code: string): void {
    this.notifications.update((current) => current.filter((n) => n.code !== code));
  }

  private defaultIcon(type: ToastNotification['type']): KeijoIconShape {
    switch (type) {
      case 'SUCCESS': return check;
      case 'WARNING': return warning;
      case 'ERROR':   return errorIcon;
      case 'INFO':
      default:        return info;
    }
  }
}
