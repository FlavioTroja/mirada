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

⚠️ Da quando gli organizzatori si registrano da soli, il gruppo significa **«chi
può raggiungere il backoffice»**, non «lo staff assunto»: chi si iscrive ci entra
automaticamente (`create_users_group` sugli stadi di scrittura). Senza quel
passaggio l'autoregistrazione sarebbe stata inutilizzabile — il vincolo avrebbe
respinto ogni nuovo iscritto **prima** che potesse raggiungere il modulo di
mirada, e il sintomo sarebbe stato «non sei autorizzato» a chi non ha ancora
nulla da essere autorizzato a fare.

**Sorgente OAuth `google`**, con `user_matching_mode: email_link`: un accesso
Google si aggancia all'utenza Authentik con la **stessa email**. Google verifica
gli indirizzi, quindi l'agganciamento è sicuro; con un fornitore che non li
verifica sarebbe una via d'ingresso.

**Iscrizione autonoma** `default-enrollment-flow` (blueprint
`example/flows-enrollment-email-verification.yaml`) e **recupero password**
`default-recovery-flow` (`example/flows-recovery-email-verification.yaml`).

⚠️ **Creare i flussi non basta: vanno agganciati allo STADIO DI IDENTIFICAZIONE**
(`default-authentication-identification`), che è ciò che disegna la schermata
d'accesso. Sono tre campi su quello stadio, e finché restano vuoti la pagina non
mostra né «Iscriviti», né «Password dimenticata», né il tasto Google — mentre
tutti e tre gli oggetti esistono e sembrano configurati.

| campo dello stadio | cosa accende |
|---|---|
| `enrollment_flow` | il link «Iscriviti» |
| `recovery_flow` | il link «Password dimenticata» |
| `sources` | i tasti dei fornitori esterni |

Collegare il flusso di recupero al **brand** non basta: è lo stadio a disegnare
il link. Verificato interrogando il flusso come lo interroga il browser —
`GET /api/v3/flows/executor/default-authentication-flow/`, che è il modo onesto
di sapere cosa vede davvero chi arriva:

```
iscrizione: /if/flow/default-enrollment-flow/
recupero:   /if/flow/default-recovery-flow/
sorgenti:   ['Google']
```

⚠️ In `sources` va tenuta **anche la sorgente interna** (`authentik-built-in`):
è quella che permette di entrare con utente e password. Lasciandoci la sola
Google si spegnerebbe l'accesso con password per tutti, in silenzio.

⚠️ **`create_users_group` sui DUE stadi di scrittura**, non su uno solo. Si entra
in Authentik per due strade — il modulo d'iscrizione
(`default-enrollment-user-write`) e il primo accesso con Google
(`default-source-enrollment-write`) — e chi arriva dalla strada dimenticata
resterebbe fuori dal gruppo, quindi respinto dal vincolo sull'applicazione con
un messaggio che non nomina la causa.

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

## Come ci passa l'applicazione

```
[SPA app.mirada.dance]          [Authentik]                  [backend mirada]

  /login ──"Accedi con Authentik"─▶ /authorize (code + PKCE)
                                      │ password, TOTP, Google
  /auth/callback ◀───── code ─────────┘
       │
       └─ POST /api/auth/sso { code, codeVerifier, redirectUri, nonce }
                    │
                    └──▶ scambia il codice con Authentik (lato server)
                         verifica la firma dell'id_token su JWKS
                         controlla iss · aud · exp · nonce
                         sub → User.authentikSub, altrimenti aggancio per email
                    ◀──  JWT di mirada, identico a quello dell'accesso con password
```

**Lo scambio del codice avviene nel backend, non nel browser.** Il client è
`public` e la SPA potrebbe farlo da sé: facendolo lato server nessun token di
Authentik entra mai nella pagina — l'unica cosa che resta in `localStorage` è il
JWT di mirada, come prima dell'SSO — e non si dipende dalle intestazioni CORS del
token endpoint, che sono configurazione di Authentik. PKCE conserva il suo scopo:
il verificatore nasce nel browser e viaggia insieme al codice.

**Dal `POST /auth/sso` in poi le due strade sono indistinguibili**: stesso
payload firmato, stesso `wsCode`, stessi cancelli d'accesso. È il motivo per cui
`Authenticate.ts` e la catena dei permessi non sono cambiati.

**L'SSO non crea utenze.** Chi si autentica senza avere un'utenza su mirada viene
respinto con un messaggio che dice cosa fare. Crearla vorrebbe dire decidere che
ruolo darle, e nascerebbe un utente che entra e non vede nulla — indistinguibile
da un guasto. Quando entreranno i ballerini il ruolo giusto esisterà (`DANCER`) e
quello sarà il punto in cui aggiungerlo (`SsoService.linkByEmail`).

**Il primo accesso aggancia per email, poi vale il `sub`.** `User.authentikSub`
è un UUID che Authentik non riusa: l'email cambia e può essere riassegnata, e
continuare a cercare per email significherebbe che chi eredita un indirizzo
eredita l'account.

### Le tre righe che lo accendono

Nel `.env` del backend (`~/orch/mirada/production/backend/.env`):

```
OIDC_ISSUER=https://auth.mirada.dance/application/o/mirada-backoffice/
OIDC_CLIENT_ID=mirada-backoffice
OIDC_SCOPE=openid profile email
```

⚠️ **Senza queste righe l'SSO è spento, non guasto**: `GET /auth/sso/config`
risponde `enabled: false` e la pagina di accesso mostra il solo form con utente e
password. Vale anche quando Authentik è irraggiungibile — un fornitore di
identità che non risponde non deve poter rendere inaccessibile il backoffice.

⚠️ **L'issuer termina con lo slash.** `jose` confronta la stringa esatta, e uno
slash mancante fa fallire ogni verifica con un messaggio che non dice quale dei
due issuer sia quello sbagliato.

## ⚠️ `email_verified`, e perché la mappatura è stata riscritta

La mappatura di serie dello scope `email` restituisce **`False` fisso**:

```python
return {"email": request.user.email, "email_verified": False}
```

Non è un dato dell'utente, è una costante — vale per chiunque, sempre, anche per
chi è appena arrivato da Google. Un consumatore che la prenda sul serio rifiuta
tutti, e infatti è successo: il backend di mirada rispondeva
`unverified email — link refused` a ogni accesso, e l'autoregistrazione era
inutilizzabile mentre tutto il resto sembrava a posto.

Ora la mappatura restituisce `True`, e lo fa **legittimamente**: in questo
Authentik un'utenza non può nascere con un indirizzo non dimostrato.

| come nasce l'utenza | cosa dimostra l'indirizzo |
|---|---|
| flusso di iscrizione | lo stadio di verifica email: se il link non viene aperto, **l'utente non esiste** |
| accesso con Google | lo verifica Google |
| creata da un amministratore | l'ha scelta una persona |

⚠️ **Aggiungendo una sorgente o un flusso che non verifica l'indirizzo, quella
riga diventa una bugia.** E non è una bugia innocua: mirada usa `email_verified`
per decidere se agganciare un'identità a un'utenza **già esistente**, cioè come
controllo contro l'appropriazione di account. Va cambiata insieme a quella
modifica.

## ⚠️ Gli utenti creati dai flussi nascono `external`

Gli stadi di scrittura di serie assegnano `user_type: external`, e un utente
esterno **non può aprire la propria pagina** su Authentik: niente secondo
fattore da registrare, niente password da cambiare. Peggio, il sintomo non lo
dice — al termine dell'iscrizione il flusso manda la persona proprio su quella
pagina, l'interfaccia riceve HTML invece di JSON e mostra:

> The request failed and the interceptors did not return an alternative response.

Un messaggio che parla di intercettori mentre il problema è un permesso, dopo
un'iscrizione **riuscita**. I due stadi che creano utenze —
`default-enrollment-user-write` e `default-source-enrollment-write` — sono stati
messi su `internal`.

## Chiudere la porta dell'accesso con password

Oggi si entra in **due** modi: da Authentik e con utente e password. È voluto —
Authentik è un punto di rottura unico davanti al backoffice, e senza la seconda
porta un suo guasto chiude fuori anche chi dovrebbe entrare per ripararlo.

Non è però un assetto definitivo: finché la porta è aperta, le politiche
configurate qui (secondo fattore, Google, scadenze) valgono solo per chi sceglie
di passare di qui.

Si chiude con **una riga nel `.env` del backend**, senza deploy:

```bash
cd ~/orch/mirada/production
sed -i 's/^PASSWORD_LOGIN=.*/PASSWORD_LOGIN=god-only/' backend/.env
docker compose up -d --force-recreate backend
```

| valore | chi entra con la password |
|---|---|
| `on` | tutti — **predefinito** |
| `god-only` | solo chi ha il ruolo `GOD`: la chiave d'emergenza |
| `off` | nessuno |

La pagina di accesso si adegua da sola: legge il valore da
`GET /api/auth/sso/config` e con `off` smette di mostrare il form invece di
lasciarne uno che risponderà `403` a chi ci ha già battuto dentro le credenziali.

⚠️ **Un valore non riconosciuto vale `on`, non `off`.** Deliberato: un
`PASSWORD_LOGIN=of` battuto male non deve poter chiudere fuori lo staff. Si perde
la chiusura, non l'accesso — e l'errore viene urlato nel log all'avvio.

⚠️ **`off` con Authentik irraggiungibile non lascia alcuna porta.** La pagina lo
dice apertamente invece di fingere un guasto, ma il rientro passa dal server:
si rimette `PASSWORD_LOGIN=on` e si ricrea il container. Chi conduce la macchina
deve saperlo **prima** di chiudere, non mentre cerca di rientrare.

### Prima di chiudere, quattro condizioni

1. le email dello staff sono indirizzi veri e verificati — oggi sono segnaposto,
   quindi il recupero password di Authentik scrive nel nulla;
2. ciascuno ha registrato un secondo fattore, altrimenti la chiusura non porta
   il guadagno per cui la si fa;
3. l'accesso via Authentik ha settimane di uso reale alle spalle;
4. la via di rientro qui sopra è scritta dove la si ritrova **senza** poter
   entrare nel backoffice.

## Quel che resta da fare

- **Il backup su S3 non copre questo database.** Lo stack `backup` di mirada
  salva il suo Postgres; `authentik-db` è un altro container e un altro volume.
- **Le email dello staff sono segnaposto** (`ragno@mirada.dance` e simili): il
  recupero password e l'agganciamento a Google non possono funzionare finché non
  diventano indirizzi veri, e vanno corretti **in due posti** — qui e in mirada.
- **Il secondo fattore è disponibile ma nessuno l'ha registrato.** Finché non lo
  fa, l'accesso via Authentik è una password come le altre — con in più il
  recupero autonomo e l'accesso con Google.
- **Sulla 443 non esiste un `default_server`.** Un nome sconosciuto che risolva a
  questa macchina viene servito dal primo blocco della 443 invece di essere
  chiuso: sulla 80 il blocco che risponde `444` c'è, sulla 443 no.
