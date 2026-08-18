# Il compose di produzione — le ragioni, servizio per servizio

`docker-compose.yml` è scritto **senza commenti**, così la struttura si legge in
un colpo d'occhio. Le ragioni stanno qui.

> ⚠️ **I due file si aggiornano insieme.** Chi tocca l'uno apre l'altro nello
> stesso passaggio. Un documento che descrive un compose che non esiste più è
> peggio di nessun documento: viene creduto.

## Il nome di progetto

```yaml
name: mirada-production
```

Non è cosmetica. Compose lo usa come prefisso per reti e container e come chiave
per capire «cosa appartiene a questo stack». Senza, prenderebbe il nome della
cartella (`production`) — generico al punto da poter collidere con un altro
stack sulla stessa macchina, e a quel punto un `docker compose down` dato nella
cartella sbagliata fermerebbe roba di qualcun altro.

---

## `db` — PostgreSQL 18

**Non pubblica porte**, di proposito: da fuori la macchina il database non
esiste. Ci si arriva con `docker compose exec` o con un tunnel SSH (README §3).

```yaml
- pgdata:/var/lib/postgresql
```

⚠️ **Sul percorso senza `/data`, e questa riga è costata un guasto.** Le immagini
`postgres` 18+ tengono i dati in una sottocartella col numero di versione
(`/var/lib/postgresql/18/docker`), perché è ciò che rende possibile un
`pg_upgrade --link` senza attraversare un punto di mount. Col volume montato sul
vecchio percorso il container **si rifiuta di partire** e riparte in ciclo:

```
Error: in 18+, these Docker images are configured to store database data in a
       format which is compatible with "pg_ctlcluster" …
       Counter to that, there appears to be PostgreSQL data in:
         /var/lib/postgresql/data (unused mount/volume)
```

Misurato su questa macchina il 18/08/2026. Il sintomo (`Restarting (1)`) non
nomina la causa, e il messaggio è lungo abbastanza da non essere letto fino in
fondo.

> ⚠️ Il `docker-compose.yml` **di sviluppo**, alla radice del repository, monta
> ancora `postgres_data:/var/lib/postgresql/data` con `postgres:18-alpine`: ha
> lo stesso difetto, e non si manifesta solo finché quel volume resta com'è. Il
> giorno che qualcuno lo ricrea da zero, si ferma allo stesso modo.

`TZ` **e** `PGTZ`: la prima è l'orologio del container, la seconda il fuso con
cui il server risponde alle query. Impostarne una sola lascia le due cose
disallineate, e la differenza si vede solo su un `NOW()` confrontato con un
timestamp scritto dall'applicazione.

L'`healthcheck` interroga `pg_isready` con **le stesse variabili** che il
servizio ha dentro: non c'è modo di sbagliare utente o database scrivendoli due
volte. `start_period: 30s` perché il primo avvio inizializza il cluster da zero e
si prende decine di secondi — senza, il container risulterebbe malato mentre sta
semplicemente nascendo.

---

## `backend` — l'API

L'immagine viene da GHCR, **già costruita**: qui non si compila niente.

`env_file: ./backend/.env` **più** un blocco `environment:`. La divisione conta:

| dove | cosa | perché |
|---|---|---|
| `environment:` | `NODE_ENV`, `HOST`, `PORT`, `DATABASE_URL`, `TZ`, `TIMEZONE` | le compone il compose, e **vincono** su `env_file` |
| `backend/.env` | segreti e configurazione applicativa | al compose non interessano, e arrivano al container interi |

`DATABASE_URL` si compone **qui** dalle stesse variabili che alimentano `db`:
una sola verità. Se le credenziali stessero in due file diversi, il primo cambio
fatto su uno solo produrrebbe un backend che non entra più nel proprio database.

> ⚠️ **`env_file` non controlla niente.** Le variabili interpolate dal compose
> hanno default (`${VAR:-…}`) e obbligatorietà (`${VAR:?…}`, che fa fallire
> `config` **nominando** la variabile). Quelle di `backend/.env` no: Compose
> passa quel che trova e tace su quel che manca. Una variabile omessa lì non
> blocca l'avvio — fa comportare il backend in un modo che nessuno ha deciso.

`volumes: - public:/app/public` — i binari (locandine, PDF dei biglietti,
ricevute, export) stanno sul disco, decisione D-K del brief. **Senza questo
volume sparirebbero a ogni redeploy**, e con loro i biglietti già venduti.

**Niente blocco `healthcheck:`**, ed è voluto: lo dichiara `backend/Dockerfile`,
e quella è l'unica definizione. Un `healthcheck:` qui la **sovrascriverebbe**, e
due copie della stessa condizione divergono alla prima modifica fatta su una sola
delle due.

Sta su **entrambe** le reti: `internal` per parlare col database, `proxy_network`
perché il proxy lo raggiunge direttamente per `/api`, `/docs` e `/ws`.

---

## `app` — il gestionale, e `www` — il sito

Due immagini di natura diversa, e la differenza si paga se la si dimentica:

| | `app` | `www` |
|---|---|---|
| cos'è | nginx che serve file statici | **processo Node che renderizza a ogni richiesta** |
| porta | 80 | 4000 |
| un 502 significa | il container non c'è | il **processo** non risponde |
| dove si guarda | `logs app` (nginx) | `logs www` (eccezioni JavaScript) |

Entrambe pubblicano una porta **sul solo loopback** (`127.0.0.1:8081` e
`127.0.0.1:8082`): serve a diagnosticare dal server senza passare dal DNS e dal
TLS, cioè a distinguere «l'applicazione è rotta» da «il proxy non la trova». Da
internet quelle porte non esistono.

Nessuna delle due sta su `internal`: non hanno niente da dirsi con il database.

---

## `files` — i binari che il backend produce e non serve

Il servizio meno ovvio dello stack, e c'è una ragione precisa.

Il backend compone URL assoluti verso i propri file (`${DOMAIN_URL}/tickets/…`,
`/images/…`, `/receipts/…`, `/exports/…`) e li scrive **dentro i PDF e le
email** — cioè in posti che non si possono correggere dopo. Ma `src/server.ts`
registra `@fastify/static` **solo in sviluppo**:

```ts
if (process.env.NODE_ENV !== "development") { return; }
```

In produzione, quindi, il backend genera quei file e poi risponde **404** agli
URL che ha appena distribuito. Non è un difetto di questo stack: è un buco fra
l'applicazione e il suo esercizio, e va colmato da una delle due parti.

Colmarlo qui — un `nginx` montato **in sola lettura** sullo stesso volume —
invece che nel backend:

1. non richiede di toccare il codice, quindi non lega la messa in linea a un
   rilascio dell'applicazione;
2. i PDF non passano dall'event loop di Node;
3. `:ro` significa che qualunque cosa vada storta da questo lato, i biglietti già
   emessi non si possono corrompere.

Il suo `nginx.conf` espone **quattro prefissi** e nient'altro: `/assets/`, che
pure sta nel volume, contiene i font Poppins usati per **generare** i PDF lato
server e non ha motivo di essere pubblico.

> ⚠️ Se un domani il backend tornasse a servire `public/` anche in produzione,
> ci sarebbero due strade verso gli stessi file: a quel punto questo container va
> **tolto**, non lasciato «per sicurezza».

> ⚠️ Il workflow di deploy non lo *distribuisce* (non è una nostra immagine) ma
> lo *avvia* (`docker compose up -d files`, idempotente): se fosse giù,
> biglietti e locandine darebbero 502 e il deploy uscirebbe verde.

---

## `backup` — predisposto, spento

```yaml
profiles: ["backup"]
```

Non parte con un `docker compose up -d`. È spento finché le credenziali S3 non
sono vere: un container che ogni notte tenta di scrivere su un bucket che non
esiste produce log d'errore che nessuno legge e la **falsa impressione che il
backup ci sia** — che è peggio di non averlo.

Si accende con `docker compose --profile backup up -d backup`, e da quel momento
il flag va ripetuto in ogni comando che lo riguarda. Il manuale è in
`s3-backup/README.md`.

---

## Le reti

```yaml
internal:      name: mirada-production-internal   # creata da qui
proxy_network: name: proxy_network, external: true # è del proxy
```

`external: true` significa «esiste già, non la creo io»: la crea lo stack del
proxy (`orch/docker-compose.yml`). Se non c'è, `up` fallisce con
`network proxy_network declared as external, but could not be found`, e la
risposta è **avviare il proxy**, non creare la rete a mano — una rete con quel
nome e nessun proxy attaccato fa **riuscire** `up` e restituisce 502, cioè il
modo peggiore di sbagliare, perché non sembra un errore.

Il `name:` esplicito su entrambe è necessario: senza, Compose le chiamerebbe
`mirada-production_internal` e `mirada-production_proxy_network`, e nessun altro
stack le troverebbe.

---

## I log

```yaml
logging: &logging
  driver: json-file
  options: { max-size: "10m", max-file: "5" }
```

50 MB per container al massimo. Il default di Docker è json-file **senza
limite**: un container loquace si prende i 96 GB del disco e la macchina si
ferma per un motivo che non ha niente a che vedere con l'applicazione. Il
rovescio è che i log vecchi si perdono: se serve conservare un episodio va
salvato subito (`docker compose logs --no-color backend > /tmp/episodio.log`).

L'àncora YAML (`&logging` / `*logging`) è lì perché cinque copie della stessa
politica divergono alla prima modifica fatta su una sola.
