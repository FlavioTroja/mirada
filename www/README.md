# `www` — il sito pubblico

L'applicazione che vede **il ballerino**: scopre gli eventi, apre la scheda, si
iscrive, paga, riceve il biglietto. È anonima fino al checkout e non ha sidebar.

È una delle tre applicazioni di Mirada, e l'unica renderizzata **lato server**:

| | cos'è | chi la usa |
|---|---|---|
| **`www`** | sito pubblico, Angular **SSR** | il ballerino (`DANCER`) |
| `app` | gestionale, SPA con `@keijo/ui` | organizzatori e staff |
| `backend` | API Fastify + Prisma | — |

**Perché SSR e non una SPA.** La scheda evento deve servire `schema.org/Event`,
un URL stabile e un'immagine di condivisione (`RF-PUB-6` del brief): un guscio
vuoto riempito dal JavaScript non li dà a chi indicizza né a chi incolla il link
in una chat. Questa scelta ha una conseguenza che si paga tutti i giorni —
**qui gira del codice su Node**, non solo nel browser: vedi *Il rendering lato
server* più sotto.

> ⚠️ **`@keijo/ui` è fra le dipendenze, ma `www` non ne usa i componenti.**
> `src/styles.scss` ne importa i **soli stili** (variabili e primitive), e tutto
> il resto è di casa, con le classi `www-*`. Non c'è la shell keijo: niente
> sidebar, niente testata di pagina. Chi arriva da `app` non trovi
> `<keijo-…>` qui e non lo aggiunga: il sito pubblico ha un altro linguaggio.

---

## Far girare il progetto

Node **22** (`nvm use 22`; il file `.nvmrc` dice la versione esatta).

```bash
npm install
npm start          # ng serve
```

L'applicazione ha bisogno del **backend sulla 5000**: `proxy.conf.json` gli
inoltra `/api` e `/images`.

```bash
# dalla radice del repository, in un altro terminale
docker compose up -d postgres
cd backend && yarn dev
```

> **La porta del dev server è la 4310**, non la 4200 del CLI: è quella su cui è
> impostata `PUBLIC_URL` in `backend/.env`, cioè quella che il backend scrive
> dentro i link delle email di conferma. Aprirne un'altra funziona per navigare,
> ma i link ricevuti per posta continueranno a puntare alla 4310.
>
> ```bash
> npm start -- --port 4310
> ```

> ⚠️ **`/images` passa dal backend anche in sviluppo.** Le locandine non stanno
> in `public/` di questo progetto: le carica l'organizzatore e vivono sul disco
> del backend. Un `<img>` che non carica in locale quasi sempre vuol dire
> backend spento, non percorso sbagliato.

### Il contesto di build è la radice del repository

Non `www/`. Due cose stanno un livello più su e servono a compilare:

- `../shared/mirada-theme.scss` — il tema, condiviso con `app`, dichiarato negli
  `includePaths` di Sass in `angular.json`;
- `../tools/check-template-backticks.mjs` — lo esegue lo script `prebuild`.

Vale per `npm run build` come per `docker build` (vedi `Dockerfile`, che infatti
si costruisce dalla radice).

### `check:templates`, e perché esiste

```bash
npm run check:templates      # gira da sé prima di ogni build
```

Un **backtick dentro un template literal lo chiude**. In un componente Angular i
template e gli stili *sono* template literal, quindi una riga innocente come

```ts
// dentro template: ` … `
<!-- `alt` vuoto di proposito -->
```

fa fallire la compilazione con errori che parlano di virgole mancanti e di
proprietà che non esistono, a decine, e nessuno dei quali nomina il backtick.

> ⚠️ Il controllo guarda i commenti del **template**. I commenti dentro il
> blocco **`styles`** no, e lì l'errore è diverso e ancora meno leggibile:
> *«Failed to resolve styles at position 1 to a string — Value could not be
> determined statically»*. Nei commenti CSS di un componente, apostrofi al posto
> dei backtick.

---

## Le rotte

`src/app/app.routes.ts`. Sono **in italiano**: sono indirizzi che il pubblico
legge, condivide e digita.

| rotta | pagina | note |
|---|---|---|
| `/` | → `/eventi` | |
| `/eventi` | ricerca pubblica | `POST /api/public/events/`, anonima e paginata |
| `/eventi/:slug` | scheda evento | è la pagina con `schema.org/Event` |
| `/eventi/:slug/iscrizione` | checkout | |
| `/accedi` | accesso | serve al checkout e all'area personale |
| `/profilo` | area personale | iscrizioni e biglietti |
| `/conferma-email` | conferma dell'indirizzo | ci si arriva dal link in una email |
| `**` | → `/eventi` | |

**I filtri della ricerca vivono nella query string**, anch'essa in italiano
(`?cerca=`, `?citta=`, `?regione=`, `?dal=`, `?al=`, `?ruolo=`). Non è un
vezzo: un risultato di ricerca dev'essere un indirizzo che si manda a un'amica,
e la resa lato server deve poterlo ricostruire **senza JavaScript**. Le funzioni
di conversione stanno in fondo a `events-search.page.ts`.

---

## `/eventi` — le due decisioni che si vedono

### La barra sola, i filtri a comparsa

In vista c'è **solo la barra di ricerca**. *Dove*, *Quando* e *Ruolo* stanno in
un pannello che si apre col bottone «Filtri», con le sezioni elencate a sinistra
e i campi a destra — il modo di lavorare del componente `cerca` di `@keijo/ui`,
rifatto nello stile di `www`. La stragrande maggioranza delle ricerche è una
parola in un campo; chi ha bisogno di restringere lo chiede.

> ⚠️ **Un pannello chiuso non deve nascondere perché l'elenco è corto.** È il
> difetto classico di questa interfaccia: si vedono tre eventi, la ragione è
> chiusa dentro un pannello, e chi guarda conclude che eventi non ce ne sono.
> Per questo i filtri attivi restano **sempre in vista come pastiglie**, ognuna
> con la propria croce, e il bottone porta il loro numero.
>
> Qui pesa doppio, perché i filtri vengono dalla query string: un indirizzo
> condiviso arriva già filtrato a chi non ha visto nessuno impostarlo.

Due dettagli del comportamento, entrambi deliberati:

- **le pastiglie si calcolano da ciò che è in vigore** (`initial()`), non dai
  campi del modulo. Mostrare «Puglia» mentre qualcuno la sta ancora scegliendo
  direbbe che l'elenco sotto è già filtrato, e non lo è;
- **la croce di una pastiglia applica subito**, senza aspettare *Applica*: una
  croce che non fa niente finché non si preme un altro bottone è una croce rotta;
- **il pannello non si apre da sé** quando arrivano filtri dall'indirizzo. Chi
  apre un link condiviso vuole vedere *i risultati*; a dire che dei filtri ci
  sono bastano le pastiglie.

### La bacheca

I risultati sono una **bacheca**: la locandina è il contenuto, non un
francobollo a lato. Sotto restano poche righe — tipo di evento, titolo, date,
città, «da €…» — e per il resto si apre la scheda.

Non compaiono più i posti per ruolo né la pastiglia «iscrizioni aperte»: sotto
ogni immagine erano rumore, e stanno già nella scheda dell'evento. Resta solo
ciò che **cambia la decisione**: *esaurito*, o un ruolo *in pausa*.

> ⚠️ **La locandina si mostra intera (`object-fit: contain`), mai ritagliata.**
> Le immagini caricate non hanno un formato unico: misurate sui dati veri vanno
> da 3:4 a 16:9 fino a una striscia 2.46:1, e nessun ritaglio fisso le contiene
> tutte. Con `cover` si è visto «20 GIUGNO 2026» diventare «0 GIUGNO 2026» e
> «MILONGA GRATUITA» perdere la prima lettera: **su una locandina i lati sono
> testo**. Si accetta la banda vuota, che il fondo neutro rende discreta.

---

## Il rendering lato server

`angular.json` dichiara `outputMode: "server"` e `ssr.entry: "src/server.ts"`.
Il build produce `dist/www/{browser,server}`; l'eseguibile è
`server/server.mjs`, che serve anche `browser/`.

```bash
npm run build
npm run serve:ssr:www        # ascolta sulla PORT dell'ambiente, o 4000
```

Tre conseguenze che valgono la pena di essere sapute prima di incontrarle:

**1. Un 502 in produzione significa «il processo non risponde», non «i file non
ci sono».** `www` non è un nginx con dentro dei file, come `app`: è un processo
Node che genera l'HTML a ogni richiesta. Si guarda in `docker compose logs www`,
e ci si aspetta di trovare un'eccezione JavaScript.

**2. Il codice gira anche dove `window` non esiste.** Tutto ciò che tocca
`window`, `document`, `localStorage` o le misure del viewport va protetto, o
rompe la resa lato server con un errore che il browser non vedrà mai.

**3. ⚠️ `security.allowedHosts` è compilato DENTRO il build.** In
`angular.json`, sotto `build.options`:

```json
"security": { "allowedHosts": ["localhost", "127.0.0.1", "mirada.dance", "www.mirada.dance"] }
```

Il server SSR **rifiuta con `400`** ogni richiesta il cui header `Host` non sia
in quella lista, con il messaggio
*«Header "host" with value "mirada.dance" is not allowed»*. Dietro un reverse
proxy, che passa il nome pubblico, significa **il sito intero fuori servizio**.

Ed è un guasto che si nasconde bene: `127.0.0.1` è in lista, quindi
l'`HEALTHCHECK` dell'immagine e le sonde del deploy — che interrogano il
loopback — passano, il container risulta `healthy` e il deploy esce verde. Si
vede **solo** dal dominio pubblico. Successo il 18/08/2026.

**Aggiungendo un dominio va aggiunto qui e l'immagine ricostruita**: non si
corregge sul server né nella configurazione del proxy.

---

## Messa in linea

Il `Dockerfile` di questa cartella (contesto: la radice del repository) e tutto
il resto — compose, proxy, workflow — stanno in
[`deploy/production/`](../deploy/production/README.md). In produzione `www`
serve `https://mirada.dance`.
