# CLAUDE.md

**Mirada Tango** — piattaforma multi-cliente per eventi di tango argentino.
Un organizzatore apre la sua organizzazione, costruisce festival, marathon o
encuentro, vende i titoli d'ingresso; chi balla li trova su un sito pubblico.

Questo file orienta. Il dettaglio sta nei documenti che indica, e non è
duplicato qui: due copie della stessa regola divergono.

## Le quattro parti

| cartella | cos'è | in produzione |
|---|---|---|
| `backend/` | API REST — Fastify 5 + Prisma 7 + PostgreSQL 18 | dietro tutti i domini, su `/api` |
| `app/` | back-office, Angular 20 + `@keijo/ui` (SPA) | `app.mirada.dance` |
| `www/` | sito pubblico, Angular 20 **con SSR** | `mirada.dance` |
| `deploy/` | produzione: compose, nginx, Authentik, manuali | — |

`shared/mirada-theme.scss` è la tavolozza, inclusa da **entrambi** i frontend:
toccarla e ricostruirne uno solo lascia l'altro con la grafica vecchia.
`tools/` contiene i controlli invocati dal `prebuild` dei frontend.

Ogni parte ha le sue regole: `backend/CLAUDE.md` (+ `.claude/rules/`) e
`app/CLAUDE.md`. **`www/` non ha ancora un CLAUDE.md**, e i suoi invarianti
vivono nei commenti del codice — in particolare `www/src/server.ts`.

## Come si entra

**Authentik** (`auth.mirada.dance`) è l'unico fornitore di identità, e da
`PASSWORD_LOGIN=off` è l'unica strada per il back-office.

> Authentik dice **chi** sei. Mirada decide **cosa** puoi.

Ruoli, appartenenza all'organizzazione e permessi restano in banca dati e non
arrivano mai da una rivendicazione del token. Il dettaglio, con le ragioni delle
scelte che sembrano arbitrarie e non lo sono, sta in
`backend/.claude/rules/authentication.md`.

Gli organizzatori si registrano da soli; per entrare in un'organizzazione altrui
serve un invito. La regola che tiene insieme le due strade: **è il gettone
dell'invito a decidere se nasce un tenant.**

## La produzione

Una macchina sola, `169.58.103.150`, **SSH sulla 1022** e solo a chiave.
Due utenti: `flavio` (sudo, amministrazione) e `manager` (non sudoer, possiede lo
stack; l'accesso umano è chiuso, resta la sola chiave di deploy).

```
/home/manager/orch/
├── docker-compose.yml      proxy nginx + certbot — possiede la 80 e la 443
├── nginx/                  /etc/nginx del proxy, montata da disco
├── authentik/              il fornitore di identità (stack separato)
└── mirada/production/      db, backend, app, www, files
```

Chiavi e scorciatoie: `../keys/mirada/` — `bash mgr '<comando>'` esegue sul
server, `bash put <locale> '<remoto>'` copia.

Manuali: `deploy/production/README.md` (conduzione, proxy, certificati,
ripristini), `deploy/production/authentik/README.md` (identità e marchiatura),
`.github/workflows/README.md` (build e deploy).

## Costruire e distribuire

**Costruire non è distribuire**, ed è il motivo per cui i workflow sono due —
oltre a essere l'unica cosa che rende possibile un rollback.

```bash
# la build parte da sé a ogni push, e costruisce SOLO i componenti toccati
gh run list --workflow=build.yml --limit 3

# il deploy è manuale
gh workflow run deploy.yml -f componente=tutti -f tag=production -f migrazioni=true
gh run watch
```

⚠️ **`gh run list` dice `success` anche quando un lavoro della matrice è stato
annullato o è fallito** (`fail-fast: false`). Alla domanda «la mia immagine è
stata pubblicata?» si risponde sui **lavori**, non sulla corsa:

```bash
gh run view <id> --json jobs -q '.jobs[] | "\(.name): \(.conclusion)"'
```

E in via definitiva sull'immagine, che porta scritto dentro il commit:

```bash
docker image inspect ghcr.io/flaviotroja/mirada/backend:production \
  --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
```

Il backend applica le migrazioni Prisma **a ogni avvio** (`start:migrate:prod`):
distribuirlo «senza migrare» non è possibile, ed è ciò che l'input `migrazioni`
ti fa confermare.

## Trappole già pagate

Sono documentate dove servono; qui l'elenco, perché sono tutte dello stesso tipo
— **qualcosa che nel repository esiste e in esercizio non c'è, senza che nulla
fallisca**.

- **Un controller nuovo va aggiunto a `src/server.ts`**: elenco esplicito, non
  glob. Compila, i tipi tornano, ogni rotta risponde 404.
- **Un vhost nuovo va aggiunto agli `include` di `nginx.conf`**: idem, e le
  richieste finiscono sul primo blocco della 443 — sembra il DNS.
- **In Authentik, creare un flusso non lo mette in servizio**: lo accende lo
  stadio di identificazione.
- **Backtick nei commenti di `styles`**: rompono la compilazione con un errore
  che parla di tipi. `npm run check:templates` copre i template, non gli stili.

## Sviluppo in locale

`docker-compose.yml` in radice: PostgreSQL (porta **5442**, la 5432 è occupata),
Redis, backend. I frontend si avviano con `npm start` nelle loro cartelle.

⚠️ **Il compose di sviluppo monta PostgreSQL 18 su `/var/lib/postgresql/data`.**
È il percorso della 16, e sulla 18 manda il container in ciclo di riavvio: in
produzione è già corretto (`/var/lib/postgresql`), qui **no**. Non è stato
toccato perché nessuno l'ha ancora incontrato — quando succederà, la causa è
questa.
