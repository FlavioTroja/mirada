# Produzione — conduzione dello stack

Lo stack di **produzione** di Mirada Tango su `https://mirada.dance`: cinque
container su una macchina dedicata, dietro un reverse proxy che **è nostro** e
sta in questo stesso repository.

Questa cartella è **il sorgente di ciò che vive sul server**, non un ambiente
locale. Da qui non si costruisce niente: le immagini arrivano già fatte da GHCR.

| | |
|---|---|
| server | `mirada.dance` → **169.58.103.150**, porta SSH **1022**, utente `manager` |
| cartella | `/home/manager/orch/mirada/production` |
| domini | **`mirada.dance`** (sito), **`www.mirada.dance`** (301 → apex), **`app.mirada.dance`** (gestionale) |
| reverse proxy | container **`proxy`** (`nginx:stable-alpine`), definito in `/home/manager/orch/docker-compose.yml` — sorgente in `orch/` |
| container dello stack | `mirada-production-{db,backend,app,www,files}` |
| volumi | `mirada-production-pgdata`, `mirada-production-public` |
| reti | `mirada-production-internal` (creata da qui), `proxy_network` (creata dal proxy) |

```
[ internet ] → container `proxy` ─┬─ mirada.dance ────┬→ /api /docs /ws  → backend :5000
   :443/:80     termina il TLS    │                   ├→ /images /tickets
                                  │                   │  /receipts /exports → files :80
                                  │                   └→ /                 → www :4000 (SSR)
                                  │
                                  └─ app.mirada.dance ┬→ /api /docs /ws  → backend :5000
                                                      ├→ /images /…      → files :80
                                                      └→ /               → app :80 (SPA)

                                                        backend → db :5432 (rete interna)
```

`db` non pubblica porte e non sta sulla rete del proxy: da internet non esiste.
`app`, `www` e `files` pubblicano una porta **sul solo loopback**, per essere
diagnosticabili dal server senza passare da DNS e TLS.

> **La regola sui segreti, in una riga.** I file `.env` vivono **solo sul
> server**, si scrivono **a mano** la prima volta partendo dai `.env.example`, e
> il workflow di deploy **non li sovrascrive mai**. Nel repository ci sono solo
> i modelli, con valori palesemente finti. Un segreto vero committato è
> compromesso anche se lo si cancella subito dopo: resta nella storia di git.

### I file di questa cartella

| file | cos'è |
|---|---|
| `docker-compose.yml` | lo stack, **senza commenti**: si legge la struttura in un colpo d'occhio |
| `docker-compose.md` | **le ragioni** di ogni scelta del compose, servizio per servizio |
| `.env.example` | modello del `.env` **di stack**: solo ciò che il compose interpola |
| `backend/.env.example` | modello del `.env` **del backend**: la sua configurazione a runtime |
| `files/nginx.conf` | configurazione del container che serve i binari del backend |
| `s3-backup/` | modello e manuale del **backup notturno su S3** (predisposto, spento) |
| `nginx-proxy/` | copia versionata di **tutta** `/etc/nginx` del proxy |
| `orch/docker-compose.yml` | lo stack del **proxy stesso** (nginx + certbot) |
| `README.md` | questo: come si conduce lo stack |

Sul server la stessa struttura, con i file veri al posto dei modelli:

```
/home/manager/orch/
├── docker-compose.yml          ← lo stack del proxy (nginx + certbot)
├── nginx/                      ← /etc/nginx del proxy, montata da disco
│   ├── nginx.conf
│   ├── mime.types              ← estratto dall'immagine, vedi §2
│   ├── mirada.dance.conf
│   ├── app.mirada.dance.conf
│   └── snippets/{ssl,mirada-backend}.conf
├── certbot/{conf,www}/         ← certificati e webroot ACME
└── mirada/production/
    ├── docker-compose.yml      ← lo copia il deploy a ogni corsa
    ├── .env                    ← a mano, 600. IMAGE_TAG, POSTGRES_*, TZ
    ├── backend/.env            ← a mano, 600. Segreti e configurazione
    ├── files/nginx.conf        ← lo copia il deploy a ogni corsa
    └── s3-backup/
        ├── .env                ← a mano, 600 (quando servirà)
        └── logs/
```

**Perché due `.env`.** Nel `.env` di stack sta ciò che il *compose* deve leggere
per costruire qualcosa: le credenziali del database alimentano il servizio `db`
**e** compongono la `DATABASE_URL` del backend, quindi stare in un solo posto è
ciò che impedisce che l'API cerchi un database che non esiste. In `backend/.env`
sta la configurazione applicativa, che al compose non interessa e arriva al
container intera con `env_file:`.

---

## 0 · Stato attuale — cosa c'è già, e cosa manca

Descrive la macchina **com'è** al 18/08/2026. La procedura completa, per la
prossima macchina, sta alla sezione 6.

**Fatto e verificato:**

- **accesso SSH solo a chiave, porta 1022.** Password disattivata per tutti,
  `root` non entra. `flavio` è sudoer, `manager` no. I dettagli e le due
  insidie incontrate stanno in `.github/workflows/README.md`, §Precondizioni;
- `manager` è nel gruppo `docker`: `docker ps` risponde senza `permission denied`;
- **Docker 29.7.2 + Compose v5.5.0**, con limite globale sui log (10 MB × 5);
- lo **stack del proxy è in esercizio**: `proxy` e `certbot` su, `proxy_network`
  creata;
- **certificato Let's Encrypt emesso** per `mirada.dance` e `www.mirada.dance`,
  scadenza 16/11/2026, rinnovo automatico ogni 12 ore;
- `db` **avviato e sano**: PostgreSQL **18.6**, volume `mirada-production-pgdata`;
- `files` **avviato e sano**: risponde 404 su un file inesistente, cioè
  l'instradamento dal dominio pubblico al volume funziona;
- i due `.env` sono scritti, a `600`, con segreti generati.

**Manca**, e in quest'ordine:

1. **il record DNS di `app.mirada.dance`**, che oggi non esiste. Finché manca, il
   gestionale non è raggiungibile e il suo nome non può entrare nel certificato;
2. **le credenziali SMTP** in `backend/.env` (le uniche righe ancora `CAMBIAMI`).
   ⚠️ Senza, il backend **non spedisce e non fallisce**: scrive la mail nel log e
   prosegue. Iscrizioni senza conferma, biglietti che non arrivano, nessun errore;
3. **la prima corsa del workflow *Build***. Finché non pubblica le immagini su
   GHCR, `backend`, `app` e `www` **non sono avviabili**: `docker compose pull`
   risponde `manifest unknown`, che non è un guasto della macchina — è l'immagine
   che non esiste ancora;
4. **subito dopo, un passaggio a mano su GitHub**: i pacchetti nascono
   **privati e scollegati** dal repository, e da *Package settings → Manage
   Actions access* va dato `Write` a `mirada`, per ciascuno dei tre;
5. **la prima corsa del workflow *Deploy***.

**Come si controlla dove siamo**, dalla cartella dello stack sul server:

```bash
docker compose ps
```

Oggi mostra **due righe**, `db` e `files`, entrambe `Up (healthy)`. Quando ce ne
saranno cinque, il primo deploy è passato.

---

## 1 · Conduzione ordinaria

Tutti i comandi si danno **dalla cartella** `/home/manager/orch/mirada/production`.

```bash
ssh -p 1022 flavio@mirada.dance      # le persone entrano come `flavio`
sudo -i -u manager                   # e poi passano a `manager` sulla macchina
cd ~/orch/mirada/production
```

> ⚠️ **`ssh manager@…` non funziona, ed è voluto.** In
> `~manager/.ssh/authorized_keys` c'è **solo** la chiave del deploy, e porta
> davanti `restrict,no-pty,no-port-forwarding,no-agent-forwarding`: quella
> chiave esegue comandi e `scp`, e nient'altro — niente terminale, niente
> tunnel. Nessuna chiave personale è autorizzata su `manager`, quindi nessuna
> persona apre una sessione SSH con quell'utente. Ci si arriva **dalla
> macchina**, da `flavio`, con `sudo -i -u manager` (oppure `su - manager`, che
> chiede la password di `manager`).

### Log

```bash
docker compose logs -f                    # tutti, intrecciati
docker compose logs -f backend            # solo l'API
docker compose logs -f www                # il processo SSR: qui si vedono le eccezioni
docker compose logs -f app                # nginx della SPA: qui i 404
docker compose logs --since 30m backend
docker compose logs --tail 200 db
```

I log sono limitati a **10 MB per file, 5 file per container**. Il rovescio è che
i vecchi si perdono: se serve conservare un episodio va salvato subito
(`docker compose logs --no-color backend > /tmp/episodio.log`).

Il proxy ha i suoi, e non stanno qui: `docker logs --tail 50 proxy`. È lì che si
vedono i 502 che non arrivano mai allo stack.

### Stato

```bash
docker compose ps                        # chi è su, chi è sano
docker stats --no-stream                 # memoria e CPU
docker compose exec backend env | sort   # le variabili come le vede DAVVERO il processo
```

L'ultimo è il comando che chiude più discussioni: mostra cosa è arrivato al
container, non cosa è scritto nel `.env`.

### Aggiornare alla versione più recente

Di norma **non si fa a mano**: lo fa il workflow *Deploy*, che in più ricarica il
proxy e verifica dall'esterno. A mano serve quando Actions non è disponibile:

```bash
docker compose pull backend app www
docker compose up -d --no-deps backend app www
docker compose ps
docker exec proxy nginx -t && docker exec proxy nginx -s reload
```

`--no-deps` e i servizi nominati sono la parte che conta: senza, un `depends_on`
si trascina dietro `db`, che in un aggiornamento applicativo non va toccato. Le
migrazioni le applica da sé il backend all'avvio (`prisma migrate deploy`).

**Il reload del proxy alla fine non è facoltativo**: i container nuovi hanno IP
nuovi, e nginx tiene quelli vecchi. Il workflow lo fa da sé; a mano no.

> ⚠️ **Un `pull` a mano subito dopo un deploy risponde `denied`, ed è voluto.**
> Il workflow chiude la sessione con `docker logout ghcr.io`, per non lasciare in
> `~/.docker/config.json` una credenziale con il token della corsa — che scade
> con la corsa. Quindi il primo `pull` manuale è **anonimo** su un pacchetto
> privato. Si rimedia con un login proprio, non riaprendo quello del deploy:
>
> ```bash
> # PAT classic con il solo scope read:packages
> echo '<IL_TOKEN>' | docker login ghcr.io -u <utente-github> --password-stdin
> ```
>
> Deve stampare `Login Succeeded`. Non basta: un login riuscito non garantisce
> che *quel* token veda *quel* pacchetto — la prova vera è il `pull`.

### Rollback — rimettere in linea la versione precedente

Non si ricostruisce niente e non si tocca git: si cambia **un tag**. La strada
maestra è il workflow *Deploy* con `tag` = sha corto. A mano:

```bash
nano .env                 # IMAGE_TAG=4f2a9c1
docker compose pull backend app www
docker compose up -d --no-deps backend app www
docker exec proxy nginx -s reload
```

Per sapere quali tag esistono: la pagina *Packages* del repository, oppure il
riepilogo del workflow *Build* che li ha pubblicati.

**Verifica** che stia girando davvero quello che credi:

```bash
docker compose images
docker inspect mirada-production-backend --format '{{.Config.Image}}'
```

> ⚠️ **Il rollback dell'immagine non annulla le migrazioni.** Prisma applica in
> avanti e non torna indietro: se la versione nuova ha aggiunto una colonna, il
> database la conserva. Di norma è innocuo (una versione precedente ignora una
> colonna che non conosce), ma **una migrazione distruttiva** — una colonna
> rimossa, un tipo cambiato — rende il rollback dell'immagine **insufficiente**:
> lì serve un ripristino del database. Guardare cosa c'è in
> `backend/prisma/migrations` fra le due versioni **prima** di considerarlo fatto.

> ⚠️ **E non annulla i biglietti già emessi.** I QR sono firmati con
> `QR_SIGNING_PRIVATE_KEY`: quella chiave non si cambia mai senza spostare la
> vecchia in `QR_SIGNING_RETIRED_KEYS`, altrimenti tutti i biglietti in mano ai
> ballerini diventano non verificabili.

### Riavviare, fermare

```bash
docker compose restart backend
docker compose stop
docker compose up -d
docker compose down               # ferma E rimuove i container; i VOLUMI restano
```

> 💀 **`docker compose down -v` cancella i volumi**, cioè l'intero database **e
> tutti i biglietti, le ricevute e le locandine**, senza chiedere conferma e
> senza modo di tornare indietro. Non esiste una ragione ordinaria per darlo.
>
> 💀 **Mai `--remove-orphans`.** Su questa macchina rimuoverebbe `proxy` e
> `certbot`, cioè il modo di raggiungere l'applicazione **e** i certificati. Il
> nome di progetto dichiarato (`mirada-production`) riduce il rischio, non lo
> annulla.

---

## 2 · Il proxy

**Non c'è nginx di sistema, e non va installato.** Le porte 80 e 443 sono del
container **`proxy`**, definito insieme a `certbot` in
`/home/manager/orch/docker-compose.yml`. Monta `/home/manager/orch/nginx` su
`/etc/nginx`.

> ⚠️ **Montare una cartella su `/etc/nginx` nasconde tutto ciò che l'immagine ci
> teneva dentro**, `mime.types` compreso — che `nginx.conf` include. Per questo
> sul server c'è `nginx/mime.types`, estratto dall'immagine:
>
> ```bash
> docker run --rm --entrypoint cat nginx:stable-alpine /etc/nginx/mime.types > nginx/mime.types
> ```
>
> Senza, nginx non parte e l'errore (`open() "/etc/nginx/mime.types" failed`)
> sembra un refuso nella configurazione. Non è versionato perché appartiene
> all'immagine, non a noi: si riestrae, non si modifica.

Il comando del container **ricarica nginx una volta al giorno**, per far entrare
in servizio i certificati rinnovati. Quindi un upstream sbagliato «si aggiusta da
solo» entro 24 ore: è il modo peggiore in cui un guasto possa manifestarsi,
perché sembra intermittente e non lo è.

### Dove sta cosa

| file sul server | copia versionata |
|---|---|
| `/home/manager/orch/nginx/nginx.conf` | `nginx-proxy/nginx.conf` |
| `…/nginx/mirada.dance.conf` | `nginx-proxy/mirada.dance.conf` |
| `…/nginx/app.mirada.dance.conf` | `nginx-proxy/app.mirada.dance.conf` |
| `…/nginx/snippets/ssl.conf` | `nginx-proxy/snippets/ssl.conf` |
| `…/nginx/snippets/mirada-backend.conf` | `nginx-proxy/snippets/mirada-backend.conf` |
| `…/nginx/mime.types` | — (dell'immagine) |

Sul server non c'è storia: un blocco modificato a mano e poi dimenticato è il
modo classico di perdere un pomeriggio. Chi lo cambia lo cambia **nel
repository**, e poi lo riporta là.

### Perché gli upstream sono scritti in una variabile

È la scelta meno ovvia, e la più importante:

```nginx
resolver 127.0.0.11 valid=30s ipv6=off;
set $backoffice mirada-production-www;
proxy_pass http://$backoffice:4000;
```

Con l'host **letterale**, nginx lo risolve **una volta sola**, al caricamento:

1. se il container non esiste — al primo allestimento, o dopo un
   `docker compose down` — **`nginx -t` fallisce** con *«host not found in
   upstream»* e il proxy **non riparte**, portandosi dietro **tutti** i domini.
   Uno stack spento diventa un guasto generale;
2. dopo ogni deploy il container è nuovo e ha un **IP nuovo**, mentre nginx tiene
   il vecchio: **502 sul dominio pubblico con l'applicazione sanissima dietro**,
   e nei log dell'applicazione non c'è niente, perché la richiesta non ci arriva.

Con l'host in una variabile nginx risolve a ogni richiesta (cache di 30 s). Il
deploy fa **comunque** `nginx -s reload`: le due cose non sono ridondanti — il
reload rende immediato il passaggio, il resolver fa sì che nulla si rompa se il
reload non avviene.

### I comandi, e l'ordine

```bash
docker exec proxy nginx -t          # PRIMA: la configurazione sta in piedi?
docker exec proxy nginx -s reload   # POI: ricarica senza far cadere le connessioni
docker logs --tail 50 proxy
```

`nginx -s reload` e **non** `docker restart proxy`: il secondo fa cadere tutti i
domini. Non è la stessa cosa fatta in due modi.

### I certificati

Emissione già fatta per `mirada.dance` e `www.mirada.dance`. Il rinnovo è
automatico (certbot ci prova ogni 12 ore, Let's Encrypt rinnova a 30 giorni dalla
scadenza).

```bash
cd ~/orch
docker compose run --rm --entrypoint certbot certbot certificates
```

**Aggiungere `app.mirada.dance`** quando il record DNS esisterà — è
un'**estensione** del certificato esistente, non un secondo certificato, e per
questo la lista dei domini va ripetuta **intera**:

```bash
cd ~/orch
docker compose run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  --email info@overzoom.it --agree-tos --no-eff-email --non-interactive \
  --cert-name mirada.dance --expand \
  -d mirada.dance -d www.mirada.dance -d app.mirada.dance

docker exec proxy nginx -t && docker exec proxy nginx -s reload
```

**Verifica:**

```bash
echo | openssl s_client -connect mirada.dance:443 -servername mirada.dance 2>/dev/null \
  | openssl x509 -noout -ext subjectAltName
```

Devono comparire tutti e tre i nomi.

> ⚠️ **Prima di un'emissione, provare con `--staging`.** Let's Encrypt limita a 5
> emissioni per settimana sullo stesso insieme di nomi: un errore di
> configurazione speso in emissioni vere blocca per giorni.

> ⚠️ **I record AAAA contano quanto gli A.** Let's Encrypt **preferisce IPv6**:
> se il dominio ha un AAAA che punta altrove, la validazione va su quella
> macchina e fallisce con *«The key authorization file from the server did not
> match this challenge»* — un messaggio che sembra un problema di permessi sul
> webroot e non lo è. Successo il 18/08/2026: l'AAAA puntava ancora al server
> OVH precedente. Si controlla così:
>
> ```bash
> dig +short mirada.dance A; dig +short mirada.dance AAAA
> ```

---

## 3 · Ispezionare il database

Il database **non pubblica porte**, di proposito.

### Dall'interno del container (per un'occhiata)

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Sfrutta le variabili che il container ha già dentro, quindi non c'è modo di
sbagliare utente o database.

```sql
\dt
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;
```

L'ultima è quella da guardare quando un deploy sembra non aver applicato niente:
`applied_steps_count` e `finished_at` dicono se la migrazione è passata, e `logs`
perché no.

### Da un client grafico, via tunnel SSH (senza aprire niente)

Il tunnel non tocca la configurazione del server: espone la porta del container
sulla propria macchina per il tempo del comando.

```bash
# sul server: l'IP del container sulla rete interna
sudo docker inspect mirada-production-db \
  --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

# dalla propria macchina, sostituendo <IP>:
ssh -p 1022 -N -L 15432:<IP>:5432 flavio@mirada.dance
```

> ⚠️ **Il tunnel si apre come `flavio`, non come `manager`.** La chiave di
> `manager` è dichiarata `restrict`, che comprende `no-port-forwarding`: un
> `ssh -L` con quella chiave apre la porta locale — la apre il *client* — e poi
> non ci passa niente, perché il server rifiuta il canale
> (`administratively prohibited`). È il modo peggiore di fallire, perché il
> tunnel *sembra* attivo: il client di database resta appeso e si finisce a
> cercare il guasto nel database.
>
> `flavio` è sudoer ma **non** è nel gruppo `docker`, quindi il `docker inspect`
> qui sopra vuole `sudo`. Il tunnel invece no: attraversa la rete dell'host, che
> raggiunge i container senza bisogno di privilegi.

Poi il client si punta su `localhost:15432`, con le credenziali del `.env`. `-N`
non apre una shell: il comando resta lì, e si chiude con Ctrl-C.

**Verifica:** se resta appeso, l'IP è cambiato — quello dei container non è
stabile fra un riavvio e l'altro, e va riletto ogni volta.

### Copia di sicurezza e ripristino

```bash
# dump, sul server
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > produzione-$(date +%Y%m%d-%H%M).sql

# ripristino su un database VUOTO
cat produzione-20260818-1200.sql | \
  docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

`-T` è obbligatorio: senza, Docker alloca un TTY e nel file finiscono i codici di
controllo del terminale, che lo rendono inutilizzabile — e il dump *sembra*
riuscito.

> ⚠️ **Il database non è l'unica cosa da salvare.** Il volume
> `mirada-production-public` contiene i PDF dei biglietti già venduti e le
> locandine: un ripristino del solo database lascerebbe righe che puntano a file
> che non esistono più.
>
> ```bash
> docker run --rm -v mirada-production-public:/dati:ro -v "$PWD":/fuori alpine \
>   tar czf /fuori/public-$(date +%Y%m%d).tar.gz -C /dati .
> ```

**Un dump prima di ogni deploy che porta migrazioni** è la sola cosa che rende
reversibile un aggiornamento andato male: il rollback del tag, da solo, non lo è.

---

## 4 · Quando non funziona — sintomo, causa, verifica

La prima colonna è ciò che si vede; la seconda il comando che **decide** fra le
ipotesi; la terza la causa che quel comando conferma.

| sintomo | verifica che decide | causa probabile |
|---|---|---|
| 502 sul dominio, ma `curl -I http://127.0.0.1:8082/` risponde | `docker logs --tail 50 proxy` | il proxy parla a un IP vecchio: `docker exec proxy nginx -t && docker exec proxy nginx -s reload`. Se **non** si risolve entro 30 s, il file sul server non è quello versionato (manca il `resolver`) |
| il proxy non riparte, e cadono **tutti** i domini | `docker exec proxy nginx -t` | *«host not found in upstream»*: qualcuno ha rimesso l'host letterale al posto della variabile, e i container sono giù |
| `nginx -t` → *«open() /etc/nginx/mime.types failed»* | `ls ~/orch/nginx/mime.types` | il file è stato perso: si riestrae dall'immagine (§2) |
| 502 anche su `curl http://127.0.0.1:8082/` | `docker compose ps` | `www` giù, o mai partito |
| il sito risponde **400** con *«Header "host" with value "mirada.dance" is not allowed»* | `grep -A8 '"security"' www/angular.json` | `security.allowedHosts` in `www/angular.json` non contiene il dominio. È **compilato dentro il build**: non si corregge sul server né nel proxy, va aggiunto lì e l'immagine ricostruita. ⚠️ Il container resta `healthy` e la sonda interna passa, perché entrambe interrogano `127.0.0.1`, che è in lista: il guasto si vede **solo** dal dominio pubblico |
| `docker compose pull` → `manifest unknown` | pagina *Packages* del repository | il tag di `IMAGE_TAG` non esiste su GHCR: la build non è mai passata, o il tag è sbagliato |
| `docker compose pull` → `denied` a mano | `docker login ghcr.io` | il deploy chiude con `docker logout`: la sessione manuale è anonima su un pacchetto privato |
| `up -d` → `network proxy_network … could not be found` | `docker network ls \| grep proxy_network` | il proxy non è in esecuzione. **Non** creare la rete a mano: una rete senza proxy attaccato fa riuscire `up` e restituisce 502 |
| `db` riparte in ciclo, *«there appears to be PostgreSQL data in /var/lib/postgresql/data»* | `docker compose logs db` | il volume è montato sul percorso vecchio: da postgres 18 va su `/var/lib/postgresql` (vedi `docker-compose.md`) |
| `backend` riparte in ciclo | `docker compose logs --tail 100 backend` | credenziali del database, o una migrazione fallita — tabella qui sotto |
| **le email non arrivano, e non c'è alcun errore** | `docker compose logs backend \| grep -i smtp` | `SMTP_HOST` non impostato: il backend **logga e non spedisce**, di proposito. È il guasto più silenzioso dello stack |
| i biglietti emessi ieri non si verificano più | `docker compose exec backend env \| grep QR_SIGNING` | `QR_SIGNING_PRIVATE_KEY` vuota: il backend ne genera una **effimera** a ogni avvio |
| un biglietto dà 404 sul dominio | `docker compose ps files` | `files` giù: è lui a servire `/tickets`, `/images`, `/receipts`, `/exports` — il backend in produzione **non** li serve |
| le date sono sfasate di un'ora | `docker compose exec backend date` | `TZ` non applicata: deve stampare CET o CEST, non UTC |
| certificato rifiutato su `app.mirada.dance` | `openssl s_client … -ext subjectAltName` | quel nome non è ancora nel certificato: va aggiunto con `--expand` (§2) |

Cosa cercare nei log di `backend`, in ordine di frequenza:

| nei log | causa |
|---|---|
| `password authentication failed` | `POSTGRES_PASSWORD` cambiata **dopo** il primo avvio: vale solo su un volume vuoto |
| `Can't reach database server` | `db` non ancora sano |
| `P3009` / `migrate found failed migrations` | una migrazione è morta a metà: **non** rilanciare alla cieca, guardare `_prisma_migrations` |
| `SMTP_HOST is not set — mail will be logged and NOT delivered` | la posta **non parte**. Vedi sopra |

---

## 5 · Entrare la prima volta

Alla prima apertura esistono **solo** le utenze create dal seed. In produzione
gli utenti di sviluppo non ci sono: si entra su `https://app.mirada.dance` con
`GOD_USERNAME` / `GOD_PASSWORD` di `backend/.env`, e da lì si creano gli utenti
veri.

> Cambiare `GOD_PASSWORD` nel `.env` **dopo** il primo avvio non ha effetto: il
> seed salta l'intero blocco utenti se ne esiste già almeno uno. La password si
> cambia dall'applicazione.

---

## 6 · Primo allestimento su una macchina nuova

Su questa macchina la procedura **è già stata percorsa** (§0): resta qui per la
prossima. I passi vanno fatti **in quest'ordine**, e quasi tutti, sbagliati,
falliscono *dopo*, altrove, con un sintomo che non punta alla causa.

### 6.1 · Accesso SSH, utenti, Docker

Descritto in `.github/workflows/README.md`, §Precondizioni sul server. In breve:
`manager` non sudoer, nel gruppo `docker`, accesso solo a chiave sulla 1022.

```bash
ssh -p 1022 flavio@<host>
sudo -i -u manager
docker ps
```

Se `docker ps` dice *«permission denied … Docker daemon socket»*, l'utente non è
nel gruppo `docker`: fermarsi qui, perché ogni passo successivo fallirebbe allo
stesso modo. Si risolve con `sudo usermod -aG docker manager` **e una nuova
sessione SSH** (il gruppo si legge al login).

### 6.2 · Il DNS, prima di tutto il resto

```bash
dig +short mirada.dance A
dig +short mirada.dance AAAA      # ⚠️ anche questo
```

Entrambi devono puntare alla macchina nuova. Farlo **adesso**: la propagazione
richiede tempo, e senza DNS corretto il passo 6.5 non può riuscire.

### 6.3 · Lo stack del proxy

```bash
mkdir -p ~/orch/nginx/snippets ~/orch/certbot/{conf,www}
# dalla macchina di sviluppo:
scp -P 1022 deploy/production/orch/docker-compose.yml manager@<host>:~/orch/
scp -P 1022 deploy/production/nginx-proxy/*.conf manager@<host>:~/orch/nginx/
scp -P 1022 deploy/production/nginx-proxy/snippets/*.conf manager@<host>:~/orch/nginx/snippets/
```

> `scp` con la chiave del deploy **funziona** anche se una sessione
> interattiva no: `restrict` nega terminale, inoltri e X11, ma lascia
> l'esecuzione di comandi, che è ciò su cui `scp` si appoggia. Chi non ha quella
> chiave copia in due passi, via `flavio` e `/tmp`.

Poi, sul server, il file che appartiene all'immagine:

```bash
cd ~/orch
docker run --rm --entrypoint cat nginx:stable-alpine /etc/nginx/mime.types > nginx/mime.types
```

### 6.4 · Il primo avvio del proxy — l'uovo e la gallina

I blocchi `server` in HTTPS dichiarano `ssl_certificate`, e nginx verifica che il
file **esista** prima di partire. Ma il certificato si ottiene con una sfida ACME
servita… da nginx. Quindi al primo giro si parte **senza** i domini:

```bash
cd ~/orch
cp nginx/nginx.conf nginx/nginx.conf.completa
sed -i 's|^\( *include /etc/nginx/mirada\)|#BOOTSTRAP \1|; s|^\( *include /etc/nginx/app\.mirada\)|#BOOTSTRAP \1|' nginx/nginx.conf
docker compose up -d
docker exec proxy nginx -t
```

**Verifica** che la sfida sia raggiungibile **da internet**, non dal server:

```bash
mkdir -p certbot/www/.well-known/acme-challenge && echo prova > certbot/www/.well-known/acme-challenge/prova
# dalla propria macchina:
curl http://mirada.dance/.well-known/acme-challenge/prova     # deve stampare "prova"
```

### 6.5 · Il certificato

**Prima in collaudo**, per non bruciare i limiti:

```bash
docker compose run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot --staging \
  --email info@overzoom.it --agree-tos --no-eff-email --non-interactive \
  -d mirada.dance -d www.mirada.dance
```

Poi quello vero, **dopo aver cancellato quello di collaudo** (occupa lo stesso
nome in `/etc/letsencrypt/live`, e certbot si limiterebbe a rinnovarlo):

```bash
docker compose run --rm --entrypoint certbot certbot delete --cert-name mirada.dance --non-interactive
docker compose run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  --email info@overzoom.it --agree-tos --no-eff-email --non-interactive \
  -d mirada.dance -d www.mirada.dance
```

### 6.6 · La configurazione completa

```bash
mv nginx/nginx.conf.completa nginx/nginx.conf
docker exec proxy nginx -t && docker exec proxy nginx -s reload
```

**Verifica:** `curl -I https://mirada.dance/`. Finché `www` non esiste ci si
aspetta un **502**, non un errore di TLS: il 502 dice che il proxy ha preso in
carico il dominio e non trova il container — cioè che questo passo è a posto e
manca il prossimo. Un errore di certificato dice che manca ancora qualcosa qui.

### 6.7 · Lo stack applicativo

```bash
mkdir -p ~/orch/mirada/production/{backend,files,s3-backup/logs}
# dalla macchina di sviluppo:
scp -P 1022 deploy/production/docker-compose.yml manager@<host>:~/orch/mirada/production/
scp -P 1022 deploy/production/files/nginx.conf   manager@<host>:~/orch/mirada/production/files/
scp -P 1022 deploy/production/.env.example       manager@<host>:~/orch/mirada/production/
scp -P 1022 deploy/production/backend/.env.example manager@<host>:~/orch/mirada/production/backend/
```

Poi i due `.env`, **a mano**:

```bash
cd ~/orch/mirada/production
cp .env.example .env && chmod 600 .env && nano .env
cp backend/.env.example backend/.env && chmod 600 backend/.env && nano backend/.env
```

Vanno sostituiti **tutti** i valori che cominciano con `CAMBIAMI-`:

```bash
openssl rand -hex 24      # POSTGRES_PASSWORD (senza simboli: finisce in una URL)
openssl rand -base64 48   # JWT_SECRET
docker run --rm node:22-alpine node -e "console.log(require('crypto').generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'der'}).toString('base64'))"   # QR_SIGNING_PRIVATE_KEY
```

**Verifica** — vale la pena farla adesso, perché è l'errore che costa di più:

```bash
grep -c CAMBIAMI .env backend/.env    # deve rispondere 0 su entrambi
docker compose config >/dev/null && echo "env a posto"
```

Se manca una variabile obbligatoria, `config` fallisce **nominandola**.

### 6.8 · Database e file, da soli

```bash
docker compose up -d db files
docker compose ps
```

Separato dal resto di proposito: il primo avvio inizializza il cluster da zero e
può prendersi decine di secondi; conviene vederlo diventare `(healthy)` prima di
aggiungere variabili al problema.

### 6.9 · Le immagini, e il primo deploy

`backend`, `app` e `www` **non sono avviabili** finché la prima build non ha
pubblicato le immagini su GHCR. La sequenza è quella della §0 — build, permessi
dei pacchetti su GitHub, deploy — ed è descritta in
`.github/workflows/README.md`.

---

## 7 · Cosa NON sta in questa cartella

- **Le immagini.** Le costruisce la CI dai `Dockerfile` di `backend/`, `app/` e
  `www/` e le pubblica su GHCR. Qui si sceglie solo *quale tag* mettere in linea.
- **Il fallback SPA.** Sta nell'nginx *dentro* l'immagine `app`
  (`app/docker/nginx.conf`). Il proxy non lo conosce.
- **Il rendering del sito.** `www` è un processo Node: non c'è configurazione
  nginx da scrivere per lui, e un suo 502 è un problema di *processo*.
- **L'healthcheck del backend.** Lo dichiara `backend/Dockerfile`, e quella è
  l'unica definizione: un blocco `healthcheck:` nel compose la
  **sovrascriverebbe**, e due copie della stessa condizione divergono alla prima
  modifica fatta su una sola delle due.
- **I `.env`.** Solo sul server. Il `.gitignore` di radice li esclude già — la
  regola `.env` non ha una barra, quindi vale a **qualsiasi** profondità, e
  l'eccezione `!.env.example` lascia passare i soli modelli.
