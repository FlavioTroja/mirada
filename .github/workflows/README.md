# Workflow GitHub Actions — Mirada

Due workflow, con due indoli diverse:

- **Build** parte da sé a **ogni push, su qualunque ramo**, e costruisce **solo i
  componenti toccati** — se hai cambiato solo `www/`, il backend non si
  ricostruisce. Si può lanciare anche a mano scegliendo il componente.
- **Deploy** è **solo manuale**. Costruire non è distribuire: è tutto il motivo
  per cui i workflow sono due, e l'unica cosa che rende possibile un rollback —
  poter distribuire un'immagine **vecchia**.

| workflow | file | cosa fa |
|---|---|---|
| **Build — immagini Docker su GHCR** | `build.yml` | costruisce `backend/`, `app/` e/o `www/` e pubblica su GHCR |
| **Deploy — produzione su mirada.dance** | `deploy.yml` | tira giù immagini **già costruite** e le mette in esercizio |

La macchina di destinazione e lo stack che ci gira sono descritti in
`deploy/production/README.md`. Qui si dice cosa fanno i workflow, e cosa devono
trovare già pronto per poterlo fare.

---

## Build

**Input**

| input | tipo | default |
|---|---|---|
| `componente` | scelta: `backend`, `app`, `www`, `tutti` | `tutti` |

### Cosa viene costruito, e come lo si decide

Il lavoro `scopri` confronta i file cambiati fra il commit precedente del ramo e
quello spinto. Il filtro per percorso è **esatto, non un'euristica**.

| cosa hai toccato | cosa si costruisce |
|---|---|
| solo `backend/` | `backend` |
| solo `app/` | `app` |
| solo `www/` | `www` |
| **`shared/` o `tools/`** | **`app` e `www`** — entrano in entrambi i frontend |
| solo `docs/`, `deploy/`, `.claude/` | **niente**, e il riepilogo lo dice |
| `.github/workflows/build.yml` o `.dockerignore` | **tutti** — è la sola occasione di accorgersi che il workflow nuovo non costruisce |
| ramo nuovo, force-push, storia riscritta | **tutti** — manca un termine di paragone, e in dubbio si costruisce |

⚠️ **`shared/` e `tools/` entrano in entrambi i frontend**, e non è ovvio
guardando le cartelle: `app/angular.json` e `www/angular.json` dichiarano
`../shared` fra gli `includePaths` di Sass (ci vive `mirada-theme.scss`), e lo
script `prebuild` di entrambi esegue `../tools/check-template-backticks.mjs`.
Toccare il tema e ricostruire un solo frontend lascerebbe l'altro con la grafica
vecchia — e nulla lo direbbe.

### ⚠️ Il contesto di build dei frontend è la RADICE del repository

| componente | contesto | dockerfile |
|---|---|---|
| `backend` | `./backend` | `backend/Dockerfile` |
| `app` | **`.`** | `app/Dockerfile` |
| `www` | **`.`** | `www/Dockerfile` |

Per la ragione appena detta: con il contesto su `app/`, `../shared` e `../tools`
cadono fuori e il build fallisce a metà con un errore su un file che «non
esiste» — mentre esiste, un livello più su. Il `.dockerignore` che conta per i
frontend è quindi quello **di radice**, non uno dentro le loro cartelle.

### Cosa pubblica

Ogni corsa pubblica **due tag** per ogni componente costruito:

| tag | natura | a cosa serve |
|---|---|---|
| sha corto del commit (es. `a1b2c3d`) | **immutabile** | è ciò che rende possibile il rollback |
| `production` | mobile, punta all'ultima build del ramo principale | il deploy quotidiano |

Immagini:

```
ghcr.io/flaviotroja/mirada/backend
ghcr.io/flaviotroja/mirada/app
ghcr.io/flaviotroja/mirada/www
```

(tutto minuscolo: GHCR non accetta maiuscole nel percorso, e il workflow abbassa
`GITHUB_REPOSITORY` da sé — `FlavioTroja` le ha.)

⚠️ **Il tag mobile `production` si sposta solo da `master`/`main`.** Se lo
muovesse ogni push di qualunque ramo, un deploy lanciato col default
`tag: production` metterebbe in linea l'ultimo esperimento spinto, e nessuno se
ne accorgerebbe finché non guarda `docker ps`. I rami di lavoro pubblicano
comunque il loro sha corto, quindi distribuirne uno resta possibile — va solo
chiesto per nome.

### Il token del registry privato

I `Dockerfile` di `app` e `www` leggono `@keijo/ui` da `npm.overzoom.it` e
ricevono il token come **secret BuildKit con id `npm_token`**, non come
build-arg: un build-arg resterebbe leggibile per sempre in `docker history`. Il
valore viene dal secret GitHub `NPM_TOKEN`. **Il backend non riceve alcun
token**, e infatti non gliene serve.

I `.npmrc` di `app/` e `www/` **stanno nel repository** e non contengono
credenziali: dichiarano solo che lo scope `@keijo` va preso da npm.overzoom.it.
⚠️ Non puntarci il registry *di default*: quel server risponde 401 anche per i
pacchetti pubblici, e l'installazione fallirebbe con «authorization required» su
`@angular/core` — un messaggio che non nomina la causa.

`cache-from`/`cache-to` con **`scope` distinto per componente**: senza lo scope
le tre build si sovrascriverebbero la cache a vicenda, e ogni corsa ripartirebbe
da zero senza che si capisca perché.

> ⚠️ **Dopo la PRIMA build serve un passaggio a mano su GitHub.** I pacchetti
> nascono **privati e scollegati** dal repository: da *Package settings → Manage
> Actions access* va dato **`Write`** a `mirada`, per **ciascuno dei tre**.
> Sintomo di chi lo salta: la prima corsa riesce (l'ha creato lei, il
> pacchetto), la seconda **fallisce sul push** con un errore di permessi che
> sembra un problema del `GITHUB_TOKEN` e non lo è.

---

## Deploy

**Input**

| input | tipo | default | note |
|---|---|---|---|
| `componente` | `backend`, `app`, `www`, `frontend (app + www)`, `tutti` | `tutti` | |
| `tag` | testo | `production` | uno sha corto per tornare indietro |
| `migrazioni` | spunta | `true` | è una **conferma**, non un interruttore |

**I servizi `db` e `files` non si distribuiscono mai.** `db` perché in un deploy
applicativo non si tocca — se non è in esecuzione il deploy **si ferma** e lo
dice, perché avviarlo è una decisione che si prende a mano. `files` perché non è
una nostra immagine (è `nginx` di serie): il deploy si limita a **avviarlo**
(`up -d files`, idempotente), perché se fosse giù biglietti e locandine
darebbero 502 e il deploy uscirebbe verde lo stesso.

### L'input `migrazioni`, e perché ha questa semantica

Il container del backend esegue `prisma migrate deploy` **a ogni avvio** — è
dentro `start:migrate:prod`, che è il `CMD` del `backend/Dockerfile`.

Quindi la spunta **non può aggiungere** le migrazioni: ci sono comunque, e un
input che promettesse di toglierle mentirebbe. È una **conferma esplicita**:

- spunta messa → si procede;
- spunta tolta **e** il deploy tocca il backend → il workflow **si ferma prima di
  distribuire**. Non distribuisce fingendo di non migrare;
- deploy dei soli frontend → l'input non ha effetto, e lo step lo dice a voce.

Se un giorno servisse davvero un deploy del backend *senza* migrare, la cosa va
realizzata nel container (un entrypoint che salta `migrate deploy` su una
variabile d'ambiente), non simulata nel workflow.

### Cosa fa, in ordine

1. traduce l'input in servizi e **valida il tag**
   (`^[A-Za-z0-9_][A-Za-z0-9._-]{0,126}$`): il tag finisce dentro un comando
   eseguito via `ssh`, e ciò che non è un tag Docker valido non passa;
2. verifica la conferma delle migrazioni;
3. prepara la chiave SSH e popola `known_hosts`. **`StrictHostKeyChecking`
   resta attivo**;
4. copia `docker-compose.yml` **e** `files/nginx.conf` sul server. **Solo i file
   versionati viaggiano**: i segreti stanno nei `.env`;
5. `docker login ghcr.io` sul server, con il `GITHUB_TOKEN` della corsa passato
   via **stdin** — non compare nei log né nella riga di comando del server;
6. sul server: `up -d files`, poi `pull` e `up -d --no-deps` dei **soli** servizi
   scelti, poi `docker image prune -f`, poi **`docker logout ghcr.io`**;
7. **ricarica il proxy**;
8. **verifica dall'interno della macchina** — i servizi rispondono?
9. **verifica dal mondo esterno** — i domini rispondono?
10. riepilogo su `$GITHUB_STEP_SUMMARY`;
11. rimozione della chiave SSH, `if: always()`.

### Il `logout` finale, che non è pulizia formale

Il login era stato fatto con il `GITHUB_TOKEN` **di quella corsa**, che scade
appena la corsa finisce: lasciarlo in `~/.docker/config.json` non apre un buco,
ma lascia sul server una credenziale morta. Il sintomo, il giorno dopo, è un
`401` su un `docker compose pull` dato a mano — un errore che non si spiega,
perché chi lo riceve non sa di essere autenticato come qualcun altro. Con il
logout, il `pull` manuale è **anonimo**, cioè fallisce nel modo comprensibile
(«pacchetto privato, fai login»).

### Il reload del proxy — perché esiste un passo apposta

L'nginx del container `proxy` risolve gli upstream **una volta**, e poi tiene
l'indirizzo. `docker compose up -d` ricrea i container, che ripartono con un **IP
nuovo** su `proxy_network`: da quel momento il proxy manda il traffico a un
indirizzo che non risponde più. Il sintomo è un **502 sul dominio pubblico
mentre il container nuovo è sanissimo**, e nei log dell'applicazione non c'è
niente, perché la richiesta non ci arriva mai.

Il proxy ricarica nginx **una volta al giorno** da sé, per i certificati
rinnovati: quindi il guasto «si risolve da solo» entro 24 ore, che è il modo
peggiore di manifestarsi.

Il passo, in due decisioni:

- **`docker exec proxy nginx -t` PRIMA di ricaricare.** Un reload su una
  configurazione rotta lascia il proxy con quella vecchia in memoria ma segnala
  un errore che sembra nostro. Se `nginx -t` fallisce, il passo fallisce e il
  proxy **resta com'è**;
- **`nginx -s reload`, non `docker restart proxy`.** Rilegge la configurazione e
  ririsolve gli upstream **senza far cadere le connessioni in corso**.

Se il container `proxy` non è in esecuzione, il passo lo dice e **non fallisce**:
non c'è niente da ricaricare, e non è questo deploy ad aver spento il proxy.

> Il reload e il `resolver` dei blocchi `server` non sono ridondanti: il reload
> rende **immediato** il passaggio al container nuovo, il resolver fa sì che
> nulla si rompa **se il reload non avviene**.

### Le due verifiche, e perché sono due

Un deploy che esce verde senza aver controllato nulla è peggio di un deploy
rosso.

**Dall'interno della macchina.** Si attende una **condizione**, con un ciclo e un
limite di **240 secondi** — non un `sleep` a caso:

- `app` → `curl http://127.0.0.1:8081/` **dal server**, sul loopback;
- `www` → `curl http://127.0.0.1:8082/`, con timeout più largo: è SSR, il primo
  render è più lento di un file statico;
- `backend` → sonda HTTP **da dentro il container**
  (`docker compose exec -T backend node -e …` su `http://127.0.0.1:5000/docs/json`),
  perché quella porta **non** è pubblicata sull'host. Il percorso è lo stesso
  dell'`HEALTHCHECK` **dichiarato dall'immagine** — è l'unica GET **anonima** che
  risponde `200`, mentre tutto ciò che sta sotto `/api` risponde `401`, che per
  una sonda è indistinguibile da un guasto. Si usa `node`, che nell'immagine c'è
  di sicuro, mentre `curl` e `wget` no.

Si accetta qualsiasi stato < 500; un *connection refused* no, quello è il guasto
vero. Si verificano **solo i servizi effettivamente distribuiti**. Se la
condizione non si avvera entro il limite, il job stampa
`docker compose logs --tail 80` e **fallisce**.

Questa verifica **non dipende dal DNS pubblico**, e non deve: misura una sola
cosa — *lo stack è sano?* — e un DNS rotto per ragioni che con questo deploy non
c'entrano non deve poterla far fallire.

**Dal mondo esterno.** `curl` dal runner su `https://mirada.dance/` e su
`https://mirada.dance/docs/json`, tre tentativi a 5 secondi di distanza.

È l'unica verifica che percorre la catena **intera** — DNS, TLS, proxy, reload
appena fatto, container nuovo — e quindi l'**unica che si accorge dello scenario
per cui il passo di reload esiste**: applicazione sana sul loopback, dominio
pubblico in 502. La prima verifica, da sola, direbbe verde. Sta **dopo** il
reload di proposito: prima, misurerebbe lo stato precedente.

⚠️ `app.mirada.dance` si prova **solo se ha un DNS**. Finché il record non
esiste, un fallimento lì direbbe «il deploy è andato male» mentre il deploy è
andato benissimo e manca un record DNS.

---

## Precondizioni sul server

Il deploy non allestisce niente: verifica, e se non trova si ferma con un
messaggio esplicito.

| precondizione | come si presenta se manca |
|---|---|
| accesso SSH a chiave per `manager` sulla porta **1022** | il passo *Copia i file* fallisce con `Permission denied (publickey)` |
| l'utente `manager` nel gruppo `docker` | `permission denied while trying to connect to the Docker daemon socket` |
| la cartella `/home/manager/orch/mirada/production` | *«la cartella … non esiste sul server»* |
| `.env` e `backend/.env` (copie dei modelli, permessi `600`) | *«manca … — è un file d'ambiente…»* |
| la rete Docker esterna `proxy_network` | `network proxy_network declared as external, but could not be found` |
| il servizio **`db` già in esecuzione** | *«il servizio 'db' non è in esecuzione…»* |
| le immagini pubblicate su GHCR | `manifest unknown` sul `pull` |

### Com'è configurato l'accesso a questa macchina

Allestito il 18/08/2026 su Ubuntu 26.04. Tre cose non ovvie, tutte già
sistemate, che si ripresentano su qualunque macchina nuova.

**1. `Port 1022` in `sshd_config` non bastava: la macchina ascoltava sulla 22.**
Ubuntu attiva `ssh.socket`, e con la socket activation è **systemd** ad aprire la
porta — la direttiva `Port` del demone non viene nemmeno guardata, e quella vera
sta in `ListenStream=` dell'unità socket. Il file diceva 1022 e la macchina
rispondeva sulla 22: il tipo di divergenza che costa un pomeriggio a chiunque la
incontri. Risolto passando a `ssh.service`, il modello classico, dove sshd apre
la porta da sé e `sshd_config` torna a essere l'unica verità:

```bash
sudo systemctl disable --now ssh.socket
sudo systemctl enable --now ssh.service
```

**2. I file di `sshd_config.d/` si contraddicevano.** `50-cloud-init.conf` diceva
`PasswordAuthentication yes`, `60-cloudimg-settings.conf` diceva `no`. In
OpenSSH, per quasi ogni parola chiave **vince la prima occorrenza letta**, e i
file si leggono in ordine lessicale: vinceva `yes`. La configurazione nostra sta
quindi in **`01-mirada-hardening.conf`**, che viene letto per primo; e
`50-cloud-init.conf` è stato corretto lo stesso, perché due file che si
contraddicono sono un guasto in attesa di chi legga solo il secondo. In più,
`/etc/cloud/cloud.cfg.d/99-disable-ssh-pwauth.cfg` (`ssh_pwauth: false`)
impedisce a cloud-init di riscriverlo a ogni riavvio.

**3. `~/.ssh/authorized_keys` era `664`, cioè scrivibile dal gruppo.** Con
`StrictModes` attivo — che è il **default** — sshd **scarta le chiavi senza dire
perché**. Il sintomo è `Permission denied (publickey)`, che sembra una chiave
sbagliata e fa perdere tempo a rigenerare chiavi giuste. Ora `~/.ssh` è `700` e
`authorized_keys` `600`.

Vale la pena controllarli **insieme**, prima di sospettare della chiave:

```bash
sudo sshd -T | grep -iE '^(port|passwordauthentication|permitrootlogin|strictmodes)'
sudo ls -ld ~manager/.ssh ~manager/.ssh/authorized_keys   # devono essere 700 e 600
```

### Gli utenti

| utente | sudo | gruppo docker | SSH | a cosa serve |
|---|:--:|:--:|---|---|
| `flavio` | **sì** | no | chiave personale | amministrazione (pacchetti, sshd, systemd) **e** unica porta d'ingresso per le persone |
| `manager` | **no** | **sì** | **solo la chiave del deploy, ristretta** | conduzione dei container |
| `root` | — | — | **negato** | — |

**Nessuna persona entra da SSH come `manager`.** In
`~manager/.ssh/authorized_keys` c'è una sola chiave, quella del deploy, e porta
davanti:

```
restrict,no-pty,no-port-forwarding,no-agent-forwarding ssh-ed25519 AAAA…
```

`restrict` è la forma sicura per difetto: nega terminale, inoltro di porte,
inoltro dell'agente, X11 e `~/.ssh/rc`, e lascia **solo l'esecuzione di
comandi** — cioè esattamente ciò di cui il deploy ha bisogno (`ssh <host>
"comando"`, `bash -s` con lo script sullo stdin, `scp`). Le tre `no-*` che
seguono sono già implicate da `restrict`: stanno scritte lo stesso, così
l'intento non dipende da cosa `restrict` includerà in una versione futura di
OpenSSH.

Chi deve condurre i container a mano entra come `flavio` e passa a `manager`
sulla macchina:

```bash
ssh -p 1022 flavio@mirada.dance
sudo -i -u manager
```

⚠️ Conseguenze da conoscere, entrambe verificate il 18/08/2026:

- **una shell interattiva con la chiave di deploy fallisce** con *«PTY
  allocation request failed on channel 0»*. Non è un guasto;
- **`ssh -L` con la chiave di deploy sembra funzionare e non funziona**: la
  porta locale si apre (la apre il *client*), ma il server rifiuta il canale
  (*«administratively prohibited»*) e non ci passa niente. Il tunnel verso
  PostgreSQL va aperto come `flavio`.

> ⚠️ **Appartenere al gruppo `docker` equivale a poter diventare root** (si monta
> `/` dentro un container). Non è un privilegio minore di sudo: è lo stesso
> privilegio per una strada diversa. Ciò che lo rende accettabile è che l'unica
> credenziale SSH di `manager` è una chiave dedicata, che non apre una shell e
> non serve a nient'altro sulla macchina.

---

## Secret e variabili da creare su GitHub

*Settings → Secrets and variables → Actions.*

| nome | obbligatorio | usato da | cos'è |
|---|:--:|---|---|
| `NPM_TOKEN` | sì (per `app` e `www`) | build | token di `npm.overzoom.it` per lo scope `@keijo`; entra come secret BuildKit `npm_token` |
| `SSH_PRIVATE_KEY` | sì | deploy | chiave privata **senza passphrase** dell'utente `manager`; la pubblica corrispondente è già in `~manager/.ssh/authorized_keys` |
| `SSH_KNOWN_HOSTS` | no | deploy | riga di `known_hosts` dell'host. Se assente si usa `ssh-keyscan`, che si fida del primo contatto: metterlo è la versione robusta |
| `GITHUB_TOKEN` | — | build, deploy | **non va creato**: lo fornisce Actions a ogni corsa |

**Per GHCR non serve alcun PAT**, né nella build né nel deploy: basta il
`GITHUB_TOKEN` della corsa, e funziona anche con pacchetti privati. Un PAT con
`read:packages` serve **solo** a chi vuole fare un `docker compose pull` a mano
sul server.

Nessuna *variable* (non-secret) è necessaria: host, porta, utente e cartella
remota sono costanti nel blocco `env:` di `deploy.yml`. Se cambiano, si cambiano
lì.

---

## Come si fa un rollback

Il rollback è un **deploy normale con un tag vecchio**. Non si ricostruisce
nulla: si rimette in esercizio esattamente il binario che girava prima.

1. trova lo sha corto della versione buona — nel riepilogo della corsa **Build**
   che l'ha prodotta, nella pagina *Packages*, o con `git log --oneline -n 20`;
2. lancia **Deploy** con `componente` = quello da riportare indietro, `tag` = lo
   sha corto (**non** `production`), `migrazioni` = spunta messa se tocca il
   backend;
3. le verifiche automatiche dicono se ha funzionato.

> ⚠️ **Il rollback riporta indietro il codice, non lo schema.**
> `prisma migrate deploy` applica migrazioni, non le disfa. Un codice vecchio su
> uno schema nuovo di norma regge (le migrazioni additive sono compatibili
> all'indietro); una migrazione **distruttiva** no, e lì serve una migrazione di
> compensazione scritta a mano. Vale la pena saperlo **prima** di distribuire una
> migrazione distruttiva, non dopo.

Il tag `production` continua a puntare all'ultima **build**, non all'ultimo
**deploy**: dopo un rollback restano disallineati, ed è voluto. La prossima build
lo riporta avanti.

---

## Note operative

- `docker compose` (v2+, plugin), mai `docker-compose`.
- I `name:` dei workflow, le descrizioni degli input e i commenti sono in
  **italiano**: sono l'interfaccia che si legge nella pagina Actions.
- Nessun secret viene mai stampato, nemmeno parzialmente: del `NPM_TOKEN` si
  stampa la sola lunghezza, per distinguere «assente» da «presente ma sbagliato».
- I controlli sulla presenza di un secret stanno **dentro gli step**, mai in un
  `if:` di livello job: lì il contesto `secrets` non è affidabile.
- Nei comandi remoti, ciò che deve essere espanso da Actions sta nel prefisso di
  ambiente del comando `ssh`; il corpo dello script viaggia **letterale**, in un
  here-doc con delimitatore quotato (`<<'REMOTE'`).
- `concurrency`: un solo deploy per volta; una sola build per volta per ciascuna
  combinazione ref+componente.
