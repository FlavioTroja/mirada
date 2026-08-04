# Mirada Tango — Politica di rimborso, cancellazione e trasferimento (proposta)

> Redatta dall'analista su richiesta del committente. Le percentuali sono i **valori di
> default della piattaforma**: l'organizzatore può renderle più generose, non più
> restrittive. Da sottoporre a validazione legale prima della pubblicazione dei T&C.

## 1. Principi

1. **Il trasferimento viene prima del rimborso.** Il cambio nominativo è sempre più
   conveniente per tutti: il partecipante recupera l'intero importo dall'acquirente, la
   capienza resta piena, l'organizzatore non subisce contraccolpi. L'interfaccia propone
   quindi il trasferimento *prima* del rimborso, e lo consente anche quando il rimborso non
   è più possibile.
2. **La fee di piattaforma non è rimborsabile** quando la rinuncia dipende dal
   partecipante: il servizio di intermediazione è già stato reso. È invece integralmente
   rimborsata quando la causa è dell'organizzatore o della piattaforma.
3. **Un solo importo esposto, nessuna sorpresa.** Al momento dell'acquisto l'utente vede la
   percentuale che recupererebbe in ogni finestra temporale, non un rinvio ai T&C.
4. **Nessun rimborso in contanti fuori dal sistema.** Ogni rimborso è tracciato e ricondotto
   all'ordine originario, anche quando eseguito manualmente.

## 2. Scaglioni di default (rinuncia del partecipante)

Calcolati sulla data di inizio dell'evento, fuso Europe/Rome.

| Quando arriva la richiesta | Rimborsato sul prezzo del titolo | Fee di piattaforma |
|---|---|---|
| Oltre 30 giorni prima | **100%** | non rimborsata |
| Da 30 a 15 giorni prima | **70%** | non rimborsata |
| Da 14 a 7 giorni prima | **50%** | non rimborsata |
| Meno di 7 giorni prima | **0%** — resta possibile il **trasferimento** fino a 24 ore prima | non rimborsata |
| Dopo l'inizio dell'evento / mancata presentazione | **0%** | non rimborsata |

Per **milonghe e serate singole** (biglietto di importo contenuto, acquistato spesso lo
stesso giorno) lo scaglione di default è più semplice: **100% fino a 48 ore prima, poi 0%,
trasferimento libero fino all'apertura porte**.

## 3. Servizi accessori

Hanno una loro logica, perché l'organizzatore li ha già impegnati con fornitori terzi.

| Servizio | Regola proposta |
|---|---|
| Pasti | Rimborsabili al 100% fino al **cut-off dichiarato dall'organizzatore** (data entro cui comunica i numeri al catering), poi 0% |
| Alloggio / posto letto | Segue la policy della struttura, dichiarata dall'organizzatore per iscritto sull'evento |
| Merchandising personalizzato (t-shirt con taglia) | Non rimborsabile una volta chiuso l'ordine di produzione |
| Lezioni private durante l'evento | 100% fino a 7 giorni prima, poi 0%: il maestro ha bloccato uno slot |
| Transfer / shuttle | 100% fino a 48 ore prima |

Ogni servizio accessorio espone il proprio cut-off in fase di acquisto.

## 4. Cause non imputabili al partecipante

| Caso | Trattamento |
|---|---|
| **Annullamento dell'evento** | Rimborso **100% del prezzo + fee di piattaforma**, automatico, senza richiesta. Comunicazione massiva contestuale |
| **Rinvio a nuova data** | Il biglietto resta valido di diritto. Il partecipante ha **14 giorni** dalla comunicazione per chiedere il rimborso integrale, poi decade |
| **Cambio sostanziale** (location diversa, cast principale sostituito, riduzione del programma) | Come il rinvio: 14 giorni per il rimborso integrale |
| **Requisito rifiutato dall'organizzatore** (tessera o documento non ritenuto valido) | Rimborso **100% + fee**: l'organizzatore ha negato l'accesso |
| **Requisito non presentato dal partecipante** entro la scadenza | Trattato come rinuncia: si applicano gli scaglioni |
| **Sold out con doppia vendita** per contesa sull'ultimo posto | Rimborso **100% + fee** immediato e automatico, con notifica esplicativa. È il rovescio della scelta di non riservare posti nel carrello |
| **Errore tecnico** (doppio addebito, ordine duplicato) | Rimborso integrale automatico, senza approvazione |
| **Espulsione per violazione del regolamento** | Nessun rimborso, decisione dell'organizzatore motivata per iscritto |

## 5. Iscrizione a coppia

Poiché la coppia si acquista in un unico ordine, il rimborso è **per posto**, non per ordine:
è possibile rimborsare un solo componente. In quel caso il posto liberato torna
disponibile nella quota del ruolo corrispondente e il biglietto residuo resta valido.
Se l'organizzatore ha vincolato la vendita a coppie intere, la rinuncia di uno comporta la
rinuncia di entrambi: la regola va dichiarata sull'evento.

## 6. Flusso operativo

```
Partecipante                Sistema                     Organizzatore
     │
     ├─ "Rinuncio" ─────────►│
     │                       ├─ propone prima il TRASFERIMENTO
     │                       ├─ calcola lo scaglione e mostra
     │                       │  l'importo esatto recuperabile
     ├─ conferma ───────────►│
     │                       ├─ crea la richiesta (stato: DA APPROVARE) ──►│
     │                       │                                             ├─ approva
     │                       │◄────────────────────────────────────────────┤  o rifiuta
     │                       │                                                (motivando)
     │                       ├─ decorsi 7 giorni senza risposta:
     │                       │  APPROVAZIONE AUTOMATICA secondo scaglione
     │                       ├─ invalida il QR, libera il posto
     │                       ├─ ordina il rimborso al PSP
     │◄─ notifica + nota di credito
```

**Stati della richiesta:** `richiesta` → `approvata` | `rifiutata` → `in_esecuzione` →
`eseguita` | `fallita` (richiede intervento manuale).

L'approvazione automatica dopo 7 giorni è la clausola che evita il contenzioso più comune
del settore: l'organizzatore che semplicemente non risponde.

## 7. Vincoli tecnici multi-PSP

Con Stripe, PayPal e Satispay in parallelo il rimborso non è un'operazione uniforme:

- Ogni PSP ha una **finestra temporale** oltre la quale il rimborso sulla transazione
  originaria non è più possibile. Superata la finestra il sistema deve degradare a
  **rimborso manuale via bonifico**, con raccolta dell'IBAN e tracciamento dello stato.
- Il rimborso **parziale** (scaglioni al 70% e 50%) va verificato come supportato su ogni
  PSP; dove non lo è, serve il percorso manuale.
- Le **commissioni del PSP** sull'incasso originario in genere non vengono restituite: va
  deciso se restano a carico dell'organizzatore (proposta: sì, dichiarato in contratto).
- I rimborsi vanno riconciliati con i documenti fiscali già emessi (nota di credito).

## 8. Diritto di recesso

Gli eventi di intrattenimento con data o periodo di esecuzione specifici rientrano tra le
esclusioni al diritto di recesso di 14 giorni previsto per i contratti a distanza
(Codice del Consumo, esclusioni per i servizi relativi alle attività del tempo libero con
data prestabilita). La politica sopra è quindi una **concessione contrattuale volontaria**,
non un obbligo di legge, e va presentata come tale nei T&C. **Da confermare con il legale
del committente**, perché è il punto su cui si concentrano le contestazioni.

## 9. Cosa deve essere configurabile

- Scaglioni (numero di finestre, giorni, percentuali) per evento, entro i limiti di default
- Cut-off dei singoli servizi accessori
- Termine ultimo per il trasferimento del nominativo
- Se la fee di piattaforma è rimborsabile in caso di rinuncia (default: no)
- Se la rinuncia di un componente della coppia scioglie l'intera coppia
- Se il rimborso può essere sostituito da un **credito interno** riutilizzabile su eventi
  futuri dello stesso organizzatore (proposta: opzione volontaria, con un incentivo del 10%
  sull'importo, perché non impatta la cassa dell'organizzatore)
