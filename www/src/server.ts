import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();

/**
 * ⚠️ `trustProxyHeaders` NON è una rifinitura: senza, dietro un reverse proxy
 * **l'SSR non avviene affatto**.
 *
 * Angular 20 rifiuta di fidarsi delle intestazioni `X-Forwarded-*` finché non
 * gliene si dà licenza, e quando ne trova di non autorizzate rinuncia a
 * costruire l'URL della richiesta e ripiega sul guscio da rendere nel browser.
 * Il sintomo, misurato in produzione il 18/08/2026:
 *
 *   curl https://mirada.dance/eventi        → 5 635 byte, nessun contenuto
 *   curl http://127.0.0.1:8082/eventi       → 20 171 byte, ng-server-context="ssr"
 *
 * cioè il sito rendeva benissimo sul loopback e serviva un guscio vuoto dal
 * dominio pubblico. Nel log del container, a ogni richiesta:
 *
 *   Received "x-forwarded-for" header but "trustProxyHeaders" was not set up to allow it.
 *
 * La conseguenza vera non era la velocità: era che **i crawler non eseguono
 * JavaScript**. WhatsApp, Telegram, Facebook e Google ricevevano l'`index.html`
 * statico, quindi il titolo del sito al posto di quello dell'evento e nessuna
 * anteprima — che è esattamente ciò per cui questa applicazione è SSR.
 *
 * Si dichiarano le DUE intestazioni che il nostro nginx manda davvero
 * (`deploy/production/nginx-proxy/`), non `true`. `true` autorizzerebbe anche
 * `X-Forwarded-Host`, con cui chiunque riuscisse a parlare direttamente al
 * container potrebbe far generare URL assoluti — quelli di `og:url`, del link
 * canonico e dei link nelle email — verso un dominio scelto da lui.
 */
const angularApp = new AngularNodeAppEngine({
  trustProxyHeaders: ['x-forwarded-proto', 'x-forwarded-for'],
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
