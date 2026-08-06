import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Le pagine **pubbliche** sono rese a ogni richiesta (`RenderMode.Server`): la
 * ricerca dipende dalla query string e la scheda evento da uno slug che vive nel
 * database, con numeri di disponibilità che cambiano di minuto in minuto.
 * Prerendere significherebbe servire una pagina vuota o vecchia al primo
 * caricamento — l'esatto contrario di ciò per cui `www` è SSR.
 *
 * Le due pagine **private** — iscrizione e accesso — sono invece
 * `RenderMode.Client`: non hanno valore per un motore di ricerca, e il loro
 * contenuto dipende da un token che vive solo nel browser. Renderle sul server
 * produrrebbe un marcatore «non sei entrato» che l'idratazione dovrebbe
 * smentire un istante dopo.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'eventi/:slug/iscrizione', renderMode: RenderMode.Client },
  { path: 'accedi', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
