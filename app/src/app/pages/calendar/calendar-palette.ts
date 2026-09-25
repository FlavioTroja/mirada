/**
 * **I colori delle quattro categorie**, in un posto solo: la griglia oraria, il
 * mese, la scheda e le chip-legenda devono dire la stessa cosa con lo stesso
 * colore, e tre copie divergerebbero alla prima correzione.
 *
 * Pieni con testo bianco nel chiaro (contrasto ≥ 4,5:1), pastello con testo
 * prugna nello scuro, come il resto del tema (`shared/mirada-theme.scss`).
 */
export const CALENDAR_PALETTE = `
  :host { --cal-now: #d93025; }
  :host-context([data-theme='dark']) { --cal-now: #ff6b5e; }

  .kind-lesson { --kind: #7a3a9e; --kind-ink: #ffffff; }
  .kind-openday { --kind: #9a560f; --kind-ink: #ffffff; }
  .kind-event { --kind: #a12a5c; --kind-ink: #ffffff; }
  .kind-appointment { --kind: #1f6770; --kind-ink: #ffffff; }

  :host-context([data-theme='dark']) .kind-lesson { --kind: #c495e3; --kind-ink: #170b1e; }
  :host-context([data-theme='dark']) .kind-openday { --kind: #f0a661; --kind-ink: #170b1e; }
  :host-context([data-theme='dark']) .kind-event { --kind: #ee7fae; --kind-ink: #170b1e; }
  :host-context([data-theme='dark']) .kind-appointment { --kind: #6cc5ce; --kind-ink: #170b1e; }

  .kind-lesson, .kind-openday, .kind-event, .kind-appointment {
    --kind-soft: color-mix(in srgb, var(--kind) 16%, rgb(var(--foreground-color)));
  }
`;
