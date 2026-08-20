# CLAUDE.md

mirada-www — the public site (Angular 20 **with SSR**), served at `mirada.dance`.

UI conventions come from `@keijo/ui` and the keijo skills. This file records what
is specific to this application — and here that means, above all, the handful of
settings that switch server-side rendering off **without any error**.

## Server-side rendering is the point of this app

`outputMode: server`, every public route `RenderMode.Server`. Not for speed:

> **None of the crawlers that matter execute JavaScript.** WhatsApp, Telegram,
> Facebook, LinkedIn and X read the HTML as it arrives.

Without SSR the Open Graph tags exist only in the visitor's browser — that is,
for the only readers who do not need them. A shared link degrades to a grey
rectangle with a bare domain. Anything that breaks SSR breaks the product's
reason to exist, and none of the four ways to break it raises an error.

### The four silent killers

| what | where | symptom when missing |
|---|---|---|
| `trustProxyHeaders` | `src/server.ts` | behind the proxy SSR **stops happening**; loopback still renders fine |
| `API_ORIGIN` | container env | SSR calls `localhost:5000` *inside its own container* → «Evento non trovato» |
| `security.allowedHosts` | `angular.json`, **compiled into the build** | production hostnames answer `400` |
| `RenderMode.Client` | `app.routes.server.ts` | that route ships an empty shell — deliberate, but see below |

⚠️ `allowedHosts` is baked in at build time: adding a domain means **rebuilding**,
not restarting. Both the build and the dev-server blocks have their own list.

⚠️ Diagnose SSR by **size and marker**, never by eye — a hydrated page looks
identical:

```bash
curl -s https://mirada.dance/eventi | wc -c        # reso dal server: decine di KB
curl -s https://mirada.dance/eventi | grep -c 'ng-server-context="ssr"'
```

## Sharing previews

`SeoService` writes title, description, Open Graph, Twitter Card, canonical and
`schema.org/Event` JSON-LD **before serialization**. It touches the DOM through
`DOCUMENT`, never `window`.

- ⚠️ **Social poster order is horizontal → square → vertical**, the *opposite* of
  the page. Those networks crop to 1.91:1, and a vertical poster lands cropped
  across its middle — exactly where a poster has nothing, since title and dates
  sit top and bottom.
- ⚠️ **WhatsApp drops images over roughly 300 KB.** No error, no preview.
- ⚠️ The static tags in `src/index.html` are a **deliberate duplicate** of what
  `SeoService` writes, and exist for the day SSR fails. They must stay aligned
  with `IMMAGINE_PREDEFINITA` in `seo.service.ts`: one promise written twice, and
  two copies drift.
- `og:type` for an event is `article`. `event` is not a recognised Open Graph type
  and networks that do not understand it skip the preview; the event stays an
  `Event` in the JSON-LD, which is where that fact counts.

## Private routes and the crawlers

`accedi`, `profilo` and `eventi/:slug/iscrizione` are `RenderMode.Client`: they
have no value for a search engine. But that also means their `<meta robots>`
**never reaches a crawler**, which receives the static shell.

The `noindex` for those three is therefore an HTTP header — the `map $uri
$robots_tag` in `deploy/production/nginx-proxy/nginx.conf`. Adding a private route
means adding it there too; the meta tag alone is not enough.

## Traps

⚠️ **Backticks in a component comment break the build** — in the template *and* in
`styles`. `npm run check:templates` (run by `prebuild`) covers templates only; in
`styles` the compiler reports `Failed to resolve styles at position 1 to a
string`, a message about types for what is a quoting mistake.

⚠️ **The dev server runs on 4310**, not the CLI's 4200: it is the port the backend
writes into confirmation links. `npm start -- --port 4310`. See `README.md`.

## Cross-app

`../shared/mirada-theme.scss` is shared with `app/`: the palette lives in one
place, and both frontends must be rebuilt when it changes.
