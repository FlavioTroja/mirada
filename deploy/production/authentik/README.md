# Authentik — il fornitore di identità

`https://auth.mirada.dance` · stack `~/orch/authentik/` sul server · versione **2026.5.6**

Autentica lo staff del backoffice. Oggi solo lo staff; il disegno è però quello
che servirà quando entreranno ballerini e cast dall'app mobile, ed è la ragione
di alcune scelte che altrimenti sembrerebbero sovradimensionate.

## Cosa fa e cosa NON fa

**Authentik dice chi sei. Mirada decide cosa puoi.**

Questa riga è il confine, e conviene rileggerla prima di ogni modifica. In mirada
i permessi nascono da `PermissionConfig` per ruolo e lo scope di tenancy da
`OrganizationMember`: un impianto a cui ogni finder dell'applicazione è legato.
Spostarlo in Authentik non era un'integrazione ma una riscrittura, e non si è
fatto. Quindi:

| cosa | dove vive |
|---|---|
| credenziali, secondo fattore, accesso con Google, recupero password | Authentik |
| `User`, `RoleToUser`, `OrganizationMember`, `PermissionConfig` | banca dati di mirada |

Aggiungere un ruolo o cambiare l'organizzazione di un titolare si fa **dal
backoffice di mirada**, non da qui.

## Com'è fatto

```
[internet] → proxy (auth.mirada.dance)
               └── authentik-server:9000
                     ├── authentik-worker   (task, email, blueprint)
                     └── authentik-db       (PostgreSQL 16, rete interna)
```

Tre container, circa 1 GB di memoria. **Redis non c'è**: dalle versioni 2026 la
coda dei task è passata su PostgreSQL. Se trovi una guida che lo pretende, sta
parlando di una versione vecchia.

Lo stack è **separato** da quello di mirada di proposito: un ripristino del
database dell'applicazione dal dump — cosa già capitata in questo progetto — non
deve poter travolgere le credenziali di chi deve poi rientrare per accorgersi del
guaio.

## La configurazione, oggetto per oggetto

Tutto è stato creato via API con il token di bootstrap. Elenco di ciò che esiste,
perché ritrovarlo nell'interfaccia richiede di sapere già cosa cercare.

**Provider OIDC `mirada-backoffice`** (pk 1)

| campo | valore | perché |
|---|---|---|
| `client_type` | `public` | una SPA nel browser non può custodire un segreto, e nemmeno un'app mobile. Il flusso corretto per entrambi è Authorization Code con **PKCE** |
| `grant_types` | `authorization_code`, `refresh_token` | ⚠️ vedi sotto |
| `sub_mode` | `user_uuid` | il `sub` del token è un UUID stabile, non lo username: rinominare un utente non ne cambia l'identità |
| `redirect_uris` | `https://app.mirada.dance/auth/callback`, `http://localhost:4200/auth/callback` | corrispondenza **stretta**; un URI non in elenco riceve `400`, verificato |
| durate | codice 1 min, access token 10 min, refresh 30 giorni | |

⚠️ **`grant_types` nasce VUOTO.** In questa versione di Authentik è un campo
esplicito, e un provider creato via API senza valorizzarlo rifiuta ogni
autorizzazione con `invalid_request` e «The request is otherwise malformed» —
messaggio che non nomina la causa. Nei log del server la riga vera è
`"event": "Invalid grant_type for provider"`. Ci si perde mezz'ora: è il primo
posto da guardare se l'accesso non parte.

Non sono attivi `implicit` e `hybrid` (esporrebbero il token nel frammento
dell'URL), né `password` (aggirerebbe secondo fattore e flussi), né
`client_credentials` (non ha senso per un client pubblico).

**Applicazione `mirada-backoffice`**, vincolata al gruppo **`mirada-staff`**.
Il vincolo non è cosmetico: senza, qualsiasi utenza di Authentik potrebbe
ottenere un token per il backoffice — e il giorno in cui entrano i ballerini
sarebbero migliaia.

**Sorgente OAuth `google`**, con `user_matching_mode: email_link`: un accesso
Google si aggancia all'utenza Authentik con la **stessa email**. Google verifica
gli indirizzi, quindi l'agganciamento è sicuro; con un fornitore che non li
verifica sarebbe una via d'ingresso.

**Flusso di recupero password** `default-recovery-flow`, dal blueprint di esempio
`example/flows-recovery-email-verification.yaml`, collegato al brand
predefinito. Senza il collegamento al brand il flusso esiste ma la pagina di
accesso non mostra «password dimenticata».

**Secondo fattore: disponibile e facoltativo.** Il flusso di accesso predefinito
contiene già lo stadio `default-authentication-mfa-validation`, quindi chi
registra un TOTP dal proprio profilo se lo vede chiedere al successivo accesso, e
chi non lo registra entra come prima. Per renderlo obbligatorio serve una policy
sullo stadio di validazione — non c'è, ed è una scelta.

## Il documento di scoperta

```
https://auth.mirada.dance/application/o/mirada-backoffice/.well-known/openid-configuration
```

⚠️ **Interrogato dal loopback restituisce URL su `127.0.0.1:9000`**, perché
Authentik costruisce l'issuer dall'`Host` della richiesta. Non è un guasto di
configurazione: chiedilo dal dominio e sono corretti. Verificarlo dal loopback e
concludere che l'issuer è sbagliato è un falso allarme facile.

## La posta

Legge le variabili `AUTHENTIK_EMAIL__*` del `.env`, riempite con la **stessa
casella OVH** del backend di mirada (`ssl0.ovh.net:465`, utenza `@mirada.dance`).
La password è stata **copiata dal `.env` del backend** invece di essere
ridigitata: l'utente l'ha cambiata a mano, e una copia battuta a tastiera è una
copia che divergerà.

Sulla 465 il TLS è implicito: `USE_SSL=true`, `USE_TLS=false`. Accenderli
entrambi è l'errore classico e produce un handshake che non termina.

## Operazioni

```bash
cd ~/orch/authentik
docker compose ps
docker compose logs -f authentik-server
docker compose restart authentik-server
```

**Primo avvio: da tre a cinque minuti.** Applica alcune centinaia di migrazioni
Django prima di rispondere, e nel frattempo il controllo di salute dice
`unhealthy`. È normale e non va interrotto.

⚠️ Nel controllare lo stato, `grep healthy` corrisponde **anche** a `unhealthy`.
Usa `grep '(healthy)'` con le parentesi — errore già commesso qui, con la
conseguenza di dichiarare pronto un servizio che non lo era.

**I blueprint si applicano in modo asincrono.** `POST .../apply/` risponde `200`
e ritorna subito; l'oggetto compare qualche decina di secondi dopo, quando il
worker ha eseguito il task. Controllare troppo presto e concludere che il
blueprint è fallito è un altro falso allarme facile: si guarda
`status: successful` sull'istanza, non l'esito della chiamata.

## Aggiornamenti

`AUTHENTIK_TAG` è fissato nel `.env` e **non è `latest`** di proposito: gli
aggiornamenti maggiori migrano il database e non tornano indietro. Si alza a
mano, dopo aver letto le note di rilascio, e con un dump fresco:

```bash
docker compose exec -T authentik-db pg_dump -U authentik authentik | gzip > ~/authentik-$(date +%F).sql.gz
```

## Quel che resta da fare

- **Il backup su S3 non copre questo database.** Lo stack `backup` di mirada
  salva il suo Postgres; `authentik-db` è un altro container e un altro volume.
- **Le email dello staff sono segnaposto** (`ragno@mirada.dance` e simili): il
  recupero password e l'agganciamento a Google non possono funzionare finché non
  diventano indirizzi veri, e vanno corretti **in due posti** — qui e in mirada.
- **L'integrazione applicativa non c'è ancora** (fase 3): il backoffice continua
  a usare `POST /auth/login` con utente e password. Authentik è in piedi e
  configurato, ma nessuno ci passa ancora.
- **Sulla 443 non esiste un `default_server`.** Un nome sconosciuto che risolva a
  questa macchina viene servito dal primo blocco della 443 invece di essere
  chiuso: sulla 80 il blocco che risponde `444` c'è, sulla 443 no.
