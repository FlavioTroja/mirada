# Mirada Tango — La Dashboard

Stato: **approvato** il 25 settembre 2026 (modello:
https://claude.ai/artifact/SAzLbUPj4z5GKtXmt8WjDt).

## 1. Il problema

Il cruscotto di oggi guarda **un evento alla volta**, scelto da un menu. Una scuola che la sera
tiene tre lezioni e fra sei giorni ha un festival non ha un posto che dica **che cosa sta
succedendo adesso**: chi è entrato, quale lezione è in corso, che cosa si è incassato, che cosa
va sistemato.

La **Dashboard** si apre sulla giornata dell'organizzazione e si muove da sola: ogni ingresso,
iscrizione, incasso o cambio di calendario compare mentre succede.

## 2. Decisioni

| # | Tema | Decisione |
|---|---|---|
| D1 | Nome | «Cruscotto» diventa **Dashboard** nel menu e nel titolo. Il cruscotto della piattaforma (`GOD`) resta com'è |
| D2 | Il cruscotto per evento | **Resta**, come vista «Evento» della Dashboard: `/dashboard/event?id=…`. Ci si arriva dal riquadro «Prossimo evento» e dal selettore in alto |
| D3 | Chi la vede | Chi vede il cruscotto oggi: `OWNER` ed `EVENT_MANAGER`. Una vista ridotta per porta e cassa è un passo successivo |
| D4 | Registro e «In tempo reale» | Una tabella **`Activity`** per organizzazione (§4). `Log` non ha organizzazione e `log/notification` va a tutta la piattaforma per ruolo: usarlo mostrerebbe a una scuola le azioni di un'altra |
| D5 | Colori | Le quattro fonti (ingressi viola, iscrizioni verde acqua, incassi arancio, calendario blu) superano il controllo per daltonismo in chiaro e in scuro; gli stati hanno sempre icona ed etichetta |

## 3. «Oggi» — `GET /dashboard/today`

Una lettura sola, per l'organizzazione del chiamante (`DASHBOARD` READ), nel giorno di
`Europe/Rome`:

| blocco | da dove |
|---|---|
| **Adesso / Oggi** | le sessioni di oggi (tutte le famiglie), con gli ingressi di ciascuna e gli iscritti attesi; quali sono in corso lo decide l'ora. Nell'agenda anche gli appuntamenti dello staff |
| **In sala adesso** | ingressi validi (non revocati, non in conflitto) alle sessioni in corso. Non esiste l'uscita: «in sala» vuol dire «entrati» |
| **Ingressi di stasera** | ingressi di oggi per quarto d'ora, con `date_bin` sull'indice `[sessionId, scannedAt]` |
| **Iscrizioni oggi** | iscrizioni create oggi, per famiglia e canale, e i sette giorni precedenti |
| **Incassato oggi** | ordini pagati oggi (`paidAt`) · saldi incassati (`collectedAt`) · vendite esterne ricevute; in centesimi. Più i saldi ancora aperti |
| **Da sistemare** | vendite esterne in quarantena · requisiti in verifica · conflitti di ingresso aperti · saldi in doppio |
| **Prossimo evento** | il primo evento (`EVENT`) che non è finito: si riusa `EventDashboardService.build`. Se è già cominciato, il riquadro dice «Evento in corso» |

⚠️ **Le lezioni non hanno presenze.** Un ingresso (`CheckIn`) è la scansione di un biglietto, e
l'iscrizione a un corso non emette biglietti (`15-corsi.md` §3.4, `RF-COR-6`): il registro
presenze dei corsi è stato escluso per scelta. Per una lezione la Dashboard mostra quindi gli
**iscritti attesi**; presenti e ingressi valgono per festival e milonghe. Il «18 presenti su 24»
del modello, su una lezione, arriverà solo con il registro presenze.

Gli importi sono dati di chi tiene la cassa (`RB27`): `EVENT_MANAGER` li vede oggi nel cruscotto
dell'evento, e continua a vederli qui.

## 4. L'attività — `Activity`

```prisma
model Activity {
  id             Int      @id @default(autoincrement())
  organizationId Int
  kind           ActivityKind   // CHECK_IN, REGISTRATION, PAYMENT, CALENDAR, PROSPECT, ALERT
  text           String         // «Ingresso di Sara Pugliese · Corso Principianti, Sala grande»
  actorName      String?        // chi l'ha fatto, quando è una persona dello staff
  amount         Int?           // centesimi, solo per gli incassi
  eventId        Int?
  severity       ActivitySeverity @default(INFO)   // INFO, WARNING, CRITICAL
  createdAt      DateTime @default(now())
  @@index([organizationId, createdAt])
}
```

- Si scrive **dove oggi parte il segnale**, dopo la transazione, e un errore non risale mai: la
  lezione o l'incasso restano, anche se la riga d'attività manca.
- Poi parte **`activity/recorded`** ai membri dell'organizzazione: un invito a rileggere, senza
  testo, perché un fotogramma non passa dal controllo di permesso della rotta.
- **`GET /dashboard/activity?since=…`** restituisce le ultime righe. Il «Registro di oggi» è la
  stessa lettura, ristretta alle azioni dello staff.
- Si cancellano da sole dopo **30 giorni**: è la cronaca recente, non l'archivio.
- Copre anche gli **ordini pagati online** (oggi `payment/succeeded` avvisa solo chi compra) e i
  **contatti dell'open day** (oggi `ProspectService` non avvisa nessuno).

## 5. Il back-office

La pagina del modello, con i segnali già esistenti più `activity/recorded`. Ogni riquadro rilegge
solo quando un segnale lo tocca, e le riletture ravvicinate si fondono.

## 6. Il lavoro

1. **Backend, «Oggi»**: risorsa `DASHBOARD`, `GET /dashboard/today`, letture per organizzazione e
   per giorno. Prove sul fuso, sullo scope e sui conteggi.
2. **Backend, attività**: tabella, scritture nei punti dei segnali, `activity/recorded`, lettura,
   pulizia a 30 giorni.
3. **Back-office**: la nuova Dashboard, la vista «Evento», il nome nel menu.
