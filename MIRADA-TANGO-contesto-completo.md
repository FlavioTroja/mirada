# Mirada Tango — Contesto completo del progetto

**Esportato il** 31 luglio 2026 · **Documento unico** che raccoglie l'intera analisi funzionale
e tutti gli allegati prodotti finora.

Questo file è la concatenazione dei documenti da `00` a `13` della cartella
`analisi-progetto-mirada-tango`, preceduta da un punto di situazione. Serve ad aprire il
progetto altrove senza perdere nulla: ogni documento resta identico all'originale ed è
introdotto dal proprio nome di file.

---

## Punto di situazione

### Che cos'è il progetto

**Marketplace multi-organizzatore di eventi di tango argentino.** Gli organizzatori pubblicano
festival, marathon, encuentro e stage; i ballerini li scoprono, si iscrivono e pagano online;
lo staff gestisce l'accesso in sala; durante l'evento una chat moderata alimenta un maxischermo
proiettato in location.

Il principio architetturale che regge tutta l'analisi: **l'organizzatore configura, la
piattaforma non impone.** Tipi di evento, quote di capienza, requisiti e servizi accessori sono
cataloghi estensibili composti in fase di creazione dell'evento.

Tre elementi distinguono il prodotto da un ticketing generalista: il **ruolo di ballo come
dimensione di capienza**, l'**iscrizione a coppia** come transazione a due soggetti su un unico
ordine, e la **chat con Live Wall** proiettata in sala.

### Decisioni strutturali già prese

| Ambito | Decisione |
|---|---|
| Modello | Marketplace multi-organizzatore, Italia, interfaccia IT + EN, EUR |
| Tipologie evento | Milonghe, festival, marathon/encuentro, stage, corsi e lezioni private — con tipo evento estensibile a runtime |
| Incassi | Diretti sull'account dell'organizzatore; **diritti di prevendita** pagati dal partecipante e incassati dalla piattaforma, calcolati **per biglietto** |
| Metodi di pagamento | Stripe, PayPal, Satispay. Bonifico in fase 2 |
| Ammissione | First-come-first-served con **quote per ruolo** e **iscrizione a coppia**. Nessuna lista d'attesa, nessuna selezione o lotteria |
| Capienza | Prenotazione temporanea di **15 minuti**, sempre attiva, riarmata all'avvio del pagamento. Sforamento tollerato sulle quote commerciali |
| Sovranità dell'organizzatore | Aggiorna i totali quando vuole, emette pass manualmente senza vincolo di capienza, sceglie se gestire i canali esterni. I contatori sono **vincolanti verso il pubblico, informativi verso di lui** |
| Titoli | Elenco esplicito di sessioni incluse; scaglioni di prezzo facoltativi definiti dall'organizzatore; vendita per persona o per coppia; un solo QR per biglietto; **peso di ripartizione per sessione** |
| Requisiti di partecipazione | Configurabili per evento. **Tesseramento e certificato medico fuori dalla piattaforma**: nessun dato sanitario trattato |
| Fiscalità | Adempimenti in capo all'organizzatore, fuori dalla piattaforma. La piattaforma emette una **conferma d'ordine con QR**, non un titolo fiscale |
| Chat e Live Wall | Nel primo rilascio. Accesso in scrittura: biglietto valido + presenza accertata + piano Premium. Chat libera nel testo, immagini classificate automaticamente, wall curata, layout focus singolo a rotazione |
| Premium | **4,99 € all'anno**, piano unico, attivazione in fase 2 a data fissa. Ricerca partner avanzata e accesso anticipato |
| Community | Solo ticketing, con la sola eccezione della bacheca cerco-partner |
| Check-in | Web app con supporto offline, più vendita alla porta. **Sblocco di sala** con QR a rotazione per la sola chat |
| Minori | **Ammessi**: account dai 14 anni; sotto quella soglia iscrizione da parte di un adulto; chat riservata ai maggiorenni |

### Ordine di costruzione

La priorità è mettere gli **organizzatori già clienti** in condizione di aprire le prenotazioni
del prossimo evento. La fase 1 si articola quindi in due:

| Fase | Contenuto |
|---|---|
| **1a — Primo taglio** | Motore di capienza, evento con sessioni e titoli, scheda pubblica, checkout **solo Stripe**, biglietto QR, ruolo di ballo e coppia, check-in offline, back-office con esportazioni. Rimborsi e onboarding sono presidio umano. Perimetro in `13-primo-taglio.md` |
| **1b — Completamento** | Onboarding self-service, calendario e ricerca, PayPal e Satispay, motore di rimborso, codici promozionali, bacheca, box office, **chat e Live Wall** |
| **2 — L'app del tanghero** | Le cinque funzioni di `12-app-tanghero.md`, più corsi, lezioni private e attivazione del Premium |

Con il solo Stripe la ripartizione dei diritti di prevendita è nativa: **Q19 esce dal percorso
critico** e l'accordo di partner PayPal corre in parallelo allo sviluppo.

### La strategia di adozione

I **ballerini sono i promotori**: l'organizzatore adotta la piattaforma quando i suoi tangheri
gliela chiedono. Ne discende che l'app del tanghero è gratuita, curata nell'estetica — toni
caldi e scuri, la stessa palette che RF-WALL-31 impone già alla wall — e costruita attorno a
cinque funzioni ad alto impatto: Social Matcher per workshop con lo stile di ballo · Tanda e DJ
Live Tracker · passaporto con wallet e notifica geolocalizzata · mappa della community ·
bacheca dei nomadi. È il traguardo del prodotto, non il punto di partenza.

### Segmento del primo rilascio

Escludendo la vendita come quota associativa, il perimetro si sposta su **festival, marathon,
encuentro e stage** — gli eventi con il biglietto più alto e il maggior bisogno delle funzioni
distintive. Le milonghe settimanali, che operano in forma associativa, restano fuori dal primo
rilascio.

### Che cosa resta aperto

L'audit `06` è **chiuso integralmente**: i sedici punti da B3 a C5 sono stati risolti il 31
luglio in `11-chiusura-audit.md`, e le tre scelte di merito che restavano al committente — D10
minori, D11 classificazione automatica delle immagini, D12 regime delle contestazioni di
addebito — sono state confermate lo stesso giorno secondo la raccomandazione dell'analista.
Trentaquattro requisiti nuovi, recepiti nella revisione 1.1b di `04`.

| # | Tema | Natura |
|---|---|---|
| 1 | **Data di apertura vendite del primo evento reale** (Q7): è la scadenza vera del progetto | Per pianificare a ritroso il primo taglio |
| 2 | **D13–D16**: app nativa o web · chat gratuita o Premium · catalogo degli stili di ballo · contropartita per il DJ che alimenta il tracker | Prima della pianificazione della fase 2 |
| 2b | **Le quattro decisioni sulla matrice dei ruoli** (Q1) | Prima dello sviluppo dei permessi |
| 3 | **Versione presentabile al cliente**: i documenti attuali sono strumenti di lavoro | Deliverable concordato, non ancora prodotto |
| 4 | **Revisione 1.2 di `04`** con la rinumerazione continua dei requisiti (C1) | Contestuale al deliverable per il cliente |
| 5 | Contropartita per l'accesso anticipato, data di attivazione del Premium, presentazione del livello di ballo, revisione del prezzo | Prima della fase 2 |
| 6 | Stack tecnologico, timeline, migrazione dati, identità visiva, interviste a organizzatori reali | Fuori scope dell'analisi finora |

### Indice dei documenti

| File | Contenuto |
|---|---|
| `00-questionario-analisi.md` | Questionario di raccolta requisiti, 93 domande su 14 aree |
| `01-decisioni-prese.md` | Tutte le decisioni prese, nove giri, con le conseguenze |
| `02-matrice-ruoli.md` | 11 ruoli e matrice dei permessi per capacità |
| `03-politica-rimborsi.md` | Scaglioni, casi non imputabili, flusso, vincoli multi-PSP |
| `04-analisi-funzionale.md` | **Documento principale**: 11 capitoli, 300 requisiti codificati, 24 regole di business |
| `05-modello-capienza.md` | Motore di capienza: schema, algoritmi, invarianti, 27 casi di test |
| `06-audit-analisi.md` | Audit critico dell'analisi, con lo stato di ogni risoluzione. **Chiuso** |
| `07-piano-premium.md` | Piano Premium: catalogo dei diritti, tutele, economia, rischi |
| `08-modello-ticketone.md` | Modello "alla TicketOne": fattibilità e stime di impegno |
| `09-titoli-e-pass.md` | Titoli d'ingresso, pass, scaglioni di prezzo |
| `10-briefing-verifica-fiscale.md` | Briefing da inoltrare a un consulente fiscale. Non bloccante |
| `11-chiusura-audit.md` | Chiusura dei sedici punti dell'audit da B3 a C5, con le tre decisioni D10–D12 |
| `12-app-tanghero.md` | **Milestone di fase 2**: le cinque funzioni dell'app per i ballerini |
| `13-primo-taglio.md` | **Perimetro immediato**: che cosa serve per aprire le vendite del primo evento reale |

---
---

<!-- ============================================================ -->
<!-- SORGENTE: 00-questionario-analisi.md -->
<!-- ============================================================ -->

# Mirada Tango — Questionario di Analisi Funzionale

> Documento di raccolta requisiti. Rispondi anche solo in parte / a voce: le risposte
> confluiranno nell'analisi funzionale. Le domande marcate **[BLOCCANTE]** determinano
> l'impianto architetturale e vanno chiuse per prime.

---

## 1. Contesto, business e obiettivi

1. Chi è il committente: una scuola/associazione singola, un network di organizzatori, una startup che vuole fare prodotto?
2. Qual è il problema principale oggi? (es. iscrizioni gestite via Google Form + bonifici + Excel, incassi non tracciati, no-show, liste d'attesa ingestibili…)
3. **[BLOCCANTE]** Modello di prodotto: marketplace multi-organizzatore (SaaS), piattaforma verticale per una sola realtà, o ibrido (partiamo mono-tenant ma predisposto)?
4. Modello di ricavo: commissione sul biglietto? fee fissa? abbonamento per organizzatore? gratuito (strumento interno)? Chi paga le fee di pagamento: organizzatore o partecipante (fee "on top")?
5. Esistono competitor/riferimenti che vuoi emulare o superare? (Eventbrite, DICE, Tango-Argentino.de, tangopartner, Encuentro registration systems tipo "Tango Registration", Meetup, Bonjour Tango…)
6. Numeri attesi al go-live e a 12 mesi: n° organizzatori, n° eventi/anno, n° partecipanti per evento, picco di vendite concorrenti (es. apertura iscrizioni festival: 800 persone in 5 minuti?)
7. Ambito geografico: Italia, Europa, mondo? Serve multi-valuta?
8. C'è già un brand/identità ("Mirada")? Esiste sito o community da migrare?

## 2. Attori e ruoli

9. Elenco ruoli da gestire e relativi permessi. Ipotesi da confermare:
   - Visitatore anonimo
   - Partecipante/ballerino registrato
   - Organizzatore (owner di un evento/associazione)
   - Staff dell'organizzatore (cassa, check-in, comunicazione) — con permessi granulari?
   - Maestro/insegnante (profilo pubblico, gestione propri corsi/stage)
   - DJ (profilo pubblico, ingaggi, lineup)
   - Musicista/orchestra
   - Venue/location (profilo, disponibilità sale)
   - Amministratore di piattaforma / supporto
   - Contabile-amministrazione (accesso solo a incassi e documenti fiscali)
10. Un utente può avere più ruoli contemporaneamente (ballerino + DJ + organizzatore)? Serve switch di contesto/"organizzazione attiva"?
11. Serve concetto di **team/organizzazione** con più membri, o l'organizzatore è sempre una persona singola?
12. Serve delega tra organizzatori (co-organizzazione di un evento, split degli incassi)?

## 3. Tipologie di evento e loro anatomia

13. **[BLOCCANTE]** Quali tipologie devono essere supportate e con quale priorità?
    - **Milonga** (serata singola, ricorrente settimanale, ingresso a porta)
    - **Práctica / pratica guidata**
    - **Stage / workshop** (uno o più seminari, per livello, a coppia o singolo)
    - **Festival** (più giorni, workshop + milonghe, pass multipli)
    - **Marathon / Encuentro** (solo ballo, ratio leader-follower vincolante, selezione/lotteria)
    - **Corso ricorrente** (trimestre/anno, abbonamento a lezioni, presenze)
    - **Lezione privata** (booking su calendario del maestro)
    - **Tango holiday / viaggio / crociera** (pacchetto con alloggio e trasporti)
    - **Campionati / competizioni** (iscrizione a categorie, giuria, tabelloni)
    - **Concerto / evento culturale**
14. Un evento può contenere sotto-eventi/sessioni (es. festival → 12 workshop + 4 milonghe + 1 concerto), ognuno con capienza, orario, sala, prezzo propri?
15. Serve gestione **eventi ricorrenti** (milonga ogni giovedì) come serie, con eccezioni (salto agosto, cambio location)?
16. Multi-sala/multi-pista contemporanee con programmi distinti? Programma pubblicabile in formato timetable?
17. Anagrafica location: indirizzo, mappa, capienza, tipo pavimento, aria condizionata, parcheggio, accessibilità? È una entità riutilizzabile tra eventi?
18. Il cast (maestri, DJ, orchestre) è un'entità riutilizzabile con profilo pubblico e "storico eventi"?
19. Gestione **livelli** (principianti/intermedio/avanzato/all levels), con eventuale verifica/audizione o approvazione del maestro?

## 4. Ciclo di vita dell'evento

20. Stati previsti: bozza → in revisione (moderazione piattaforma?) → pubblicato → iscrizioni aperte → sold out → in corso → concluso → archiviato/annullato. Confermi? Serve moderazione centrale prima della pubblicazione?
21. Serve duplicazione evento / template di evento (edizione 2027 clonata dalla 2026)?
22. Serve **finestra di apertura iscrizioni programmata** (countdown, apertura a data/ora precisa, coda virtuale)?
23. Cosa succede in caso di **annullamento/rinvio**: rimborso automatico, voucher, comunicazione massiva?
24. Serve versionamento/log delle modifiche a un evento pubblicato (audit trail)?

## 5. Ticketing, prezzi, promozioni

25. Tipi di titolo da gestire: biglietto singolo, full pass, pass milonghe, pass workshop, day pass, pacchetto personalizzabile ("scegli 4 workshop su 12"), ingresso libero con RSVP, lista alla porta, omaggio/accredito staff.
26. Come si compone il prezzo: prezzo per titolo, early bird a scadenza o a esaurimento quote, prezzo residenti/soci/studenti, prezzo a coppia, tariffe di gruppo, "pay what you want", donazione?
27. Gestione **capienza**: totale evento, per sessione, per tipo di titolo, per ruolo (leader/follower), per livello. Overbooking consentito?
28. **Carrello**: si acquista un titolo alla volta o carrello multi-titolo/multi-evento? Acquisto per più persone in un solo ordine (chi sono i nominativi? servono dati anagrafici per ogni partecipante)?
29. Biglietti **nominali** o trasferibili? Serve cambio nominativo / rivendita ufficiale (resale) / trasferimento a un amico?
30. Timer di **prenotazione temporanea** durante il checkout (es. 15 min di hold sulla capienza)?
31. Codici promo e voucher: percentuale/importo, limite di utilizzi, per singolo utente, cumulabili? Codici affiliazione/referral per maestri e scuole?
32. Politica di **rimborso e cancellazione**: finestre temporali con percentuali, trattenuta fee, rimborso automatico o su approvazione, credito interno anziché rimborso, assicurazione annullamento?
33. Serve **lista d'attesa** con promozione automatica quando si libera un posto (e finestra di tempo per pagare)?
34. Biglietto emesso: PDF con QR, Apple/Google Wallet, solo email, stampa a casa? Anti-frode sul QR?

## 6. Iscrizioni "tango-specific" (il cuore del dominio)

35. **Ruolo di ballo**: leader / follower / both / switch. Il ruolo è attributo del profilo, dell'iscrizione, o di entrambi (posso iscrivermi come follower a un evento e leader a un altro)?
36. Serve **balance ratio** leader/follower vincolante (tipico di marathon/encuentro)? Con quale logica: quote separate per ruolo, sblocco a coppie, tolleranza percentuale?
37. **Iscrizione a coppia**: come si lega la coppia? (codice invito, email del partner, ricerca utente). Cosa accade se il partner non paga entro X giorni? Cosa se una coppia si "rompe" dopo l'iscrizione?
38. Serve **partner matching / bacheca cerco-partner** per chi si iscrive singolo a workshop a coppie?
39. Modalità di ammissione: first-come-first-served, **selezione manuale dell'organizzatore** (application con domande + approvazione), **lotteria/sorteggio**, priorità a partecipanti storici, quote per paese/comunità di provenienza (pratica comune negli encuentros)?
40. Serve un **form di candidatura personalizzabile** (domande custom: anni di ballo, referenze, con chi ballo, community di appartenenza, allergie, note)?
41. Serve gestione **quote per nazionalità/città** o "diversity quota" della community?
42. Gestione **accompagnatori** non ballerini (partner, figli) e ingressi ridotti?
43. Servizi accessori vendibili in iscrizione: pasti (con diete/allergie), t-shirt (taglia), shuttle/transfer, **alloggio** (camera condivisa, hosting presso locali, assegnazione stanze), lezione privata, foto/video.
44. Serve **hosting/ospitalità** con matching tra chi offre e chi cerca posto letto?

## 7. Pagamenti, fiscalità, contabilità

45. Metodi di pagamento: carta (Stripe/Adyen/Nexi?), PayPal, Satispay, bonifico con riconciliazione manuale, contanti alla porta, Klarna/rate, Apple/Google Pay.
46. **[BLOCCANTE]** Chi incassa: la piattaforma (poi bonifica agli organizzatori — serve marketplace tipo Stripe Connect, con KYC e payout) oppure ogni organizzatore col proprio account (piattaforma solo application fee)?
47. Serve **acconto + saldo** (tipico dei festival: caparra ora, saldo 30 giorni prima) con solleciti automatici?
48. Documenti fiscali: ricevuta di cortesia, ricevuta fiscale, **fattura elettronica** (SDI), fattura a soggetto estero, split payment PA, scontrino/corrispettivi telematici? Chi li emette?
49. Contesto associativo italiano: gestione **quota associativa/tesseramento** (ASD/APS/FIDS/MIDAS), rinnovo annuale, obbligo di tesseramento per accedere all'evento, **certificato medico** con scadenza, registro soci?
50. **SIAE**: serve supporto a permessi/borderò, elenco brani del DJ, calcolo diritti?
51. Serve export per il commercialista (prima nota, incassi per evento, IVA, riconciliazione bancaria)? Integrazione con software contabile (Fatture in Cloud, TeamSystem, Datev…)?
52. Gestione compensi al cast (maestri, DJ): contratti, note di prestazione, rimborsi spese?

## 8. Operatività on-site (giorno dell'evento)

53. **Check-in** con scansione QR da smartphone: serve app dedicata, PWA, o basta web? Serve funzionamento **offline** con sincronizzazione (le sale da ballo hanno spesso rete scarsa)?
54. Check-in multi-punto (più addetti in parallelo) con anti-doppio-ingresso?
55. Vendita alla porta (box office) con incasso contanti/POS e registrazione a sistema?
56. Braccialetti/badge per pass multi-giorno? Stampa badge con nome e ruolo?
57. Lista partecipanti esportabile/stampabile con filtri (per sessione, per ruolo, per pass)?
58. Serve conteggio presenze in tempo reale (capienza legale/sicurezza)?

## 9. Corsi, abbonamenti, lezioni

59. Gestione **corsi ricorrenti**: iscrizione a trimestre, calendario lezioni, registro presenze, recuperi, sospensioni, pacchetti "10 lezioni" con scadenza?
60. **Abbonamenti/membership** ricorrenti (mensile/annuale) con addebito automatico e sospensione/disdetta?
61. **Lezioni private**: calendario e disponibilità del maestro, prenotazione, conferma, cancellazione con policy, pagamento anticipato?
62. Serve gestione **sostituzioni/prove** e lista d'attesa per corsi pieni?

## 10. Community e social

63. **Profilo ballerino**: cosa contiene (foto, città, anni di esperienza, ruolo, lingue, preferenze musicali, eventi a cui parteciperà, badge)? È pubblico, semi-pubblico, o privato?
64. Serve vedere **chi partecipa** a un evento prima dell'acquisto (fortissima leva di conversione nel tango) — con opt-in privacy?
65. Serve follow/amicizia, messaggistica diretta, feed, commenti, recensioni di eventi/DJ/maestri, foto e video post-evento?
66. Serve moderazione contenuti e **segnalazioni/codice di condotta** (tema sensibile nella community tango: safe space, gestione comportamenti scorretti, ban)?
67. Serve area riservata ai soci con contenuti (video lezioni, playlist, dispense)?

## 11. Discovery e marketing

68. Come si trovano gli eventi: calendario, mappa, ricerca con filtri (città, data, tipo, livello, prezzo, maestri, DJ), "vicino a me", raccomandazioni personalizzate?
69. Serve **pagina pubblica dell'evento** SEO-friendly con URL personalizzato, OG image, dati strutturati schema.org/Event? Serve landing personalizzabile dall'organizzatore (blocchi, colori, logo, dominio custom)?
70. Serve **widget/embed** del ticketing sul sito dell'organizzatore?
71. Serve integrazione con Facebook Events, Instagram, Google Calendar/iCal, Google Business, canali WhatsApp/Telegram?
72. Newsletter e comunicazioni: strumento interno o integrazione (Mailchimp/Brevo)? Segmentazione (chi ha partecipato all'edizione precedente, chi ha carrello abbandonato)?
73. Notifiche transazionali e reminder: email, SMS, WhatsApp, push? Quali trigger (conferma acquisto, promemoria 24h, apertura iscrizioni, promozione da lista d'attesa)?
74. Serve programma **referral/affiliazione** e tracciamento sorgenti (UTM, codici ambassador)?

## 12. Reporting e analytics

75. Dashboard organizzatore: venduto per titolo, andamento nel tempo, ratio leader/follower, provenienza geografica, tasso di conversione, no-show, incasso netto, break-even sui costi dell'evento?
76. Serve gestione **budget/costi evento** (cachet, sala, service, promozione) per calcolare il margine?
77. Dashboard piattaforma: GMV, take rate, organizzatori attivi, retention utenti?
78. Export CSV/Excel, API pubbliche, webhook verso terzi?

## 13. Requisiti non funzionali

79. **Lingue**: italiano, inglese, spagnolo, altre? Traduzione dei contenuti inseriti dagli organizzatori o solo dell'interfaccia?
80. Fusi orari (eventi all'estero) e formati locali?
81. Dispositivi: mobile-first web, PWA installabile, app nativa iOS/Android? In quale fase?
82. Accessibilità (WCAG 2.1 AA) è un requisito?
83. **Privacy/GDPR**: base giuridica, consensi granulari, informativa, DPA con l'organizzatore (chi è titolare e chi responsabile?), esportazione e cancellazione dati, retention, dati particolari (allergie/certificato medico = dati sanitari!), minori.
84. Sicurezza: 2FA, login social, magic link, protezione bot in apertura iscrizioni (rate limit, captcha, coda), PCI-DSS delegato al PSP?
85. SLA, disponibilità, backup, disaster recovery? Picchi di traffico prevedibili (apertura iscrizioni)?
86. Ambienti (dev/staging/prod), CI/CD, monitoraggio, test?

## 14. Vincoli di progetto

87. **[BLOCCANTE]** Stack tecnologico: esiste un vincolo? (preferenze note: Angular + keijo/ui lato FE — confermi? Backend: Node/NestJS, .NET, Laravel, Java?) Cloud di riferimento?
88. Esiste un sistema attuale da integrare o da cui **migrare dati** (utenti, storico iscrizioni, contabilità)?
89. Budget e timeline. C'è una data-evento che fa da deadline (es. iscrizioni di un festival da aprire entro X)?
90. Team di sviluppo e manutenzione: interno, tu solo, misto?
91. Chi sono gli stakeholder da intervistare oltre a te? Possiamo parlare con 1-2 organizzatori reali e 2-3 ballerini?
92. **Perimetro MVP**: qual è il minimo indispensabile per andare live con il primo evento reale? Cosa può slittare in fase 2/3?
93. Criteri di successo misurabili (es. 80% delle iscrizioni online, tempo di check-in < 10s/persona, azzeramento riconciliazioni manuali)?

---

## Ipotesi di default (se non specificato diversamente)

Per non bloccare l'analisi, in assenza di risposta procedo con:
- Piattaforma multi-tenant, mono-lingua IT+EN all'avvio
- Ticketing con biglietti nominali, QR, capienza per sessione e per ruolo
- Stripe come PSP con incasso diretto dell'organizzatore + application fee
- Web responsive mobile-first, no app nativa in MVP
- Check-in via web app con cache offline minimale
- GDPR: organizzatore titolare, piattaforma responsabile del trattamento


---

<!-- ============================================================ -->
<!-- SORGENTE: 01-decisioni-prese.md -->
<!-- ============================================================ -->

# Mirada Tango — Decisioni prese in fase di raccolta requisiti

Aggiornato: 2026-07-30

## Impianto di prodotto

| Tema | Decisione | Conseguenze sull'analisi |
|---|---|---|
| Modello | **Marketplace multi-organizzatore** (SaaS) | Multi-tenancy, onboarding organizzatori, calendario pubblico comune, permessi per organizzazione, moderazione |
| Tipologie di evento | Milonghe/pratiche, festival e marathon/encuentro, stage/workshop, corsi ricorrenti e lezioni private — **con possibilità di aggiungerne di nuove in corso d'opera** | Il "tipo evento" è un'entità configurabile, non un enum nel codice: ogni tipo compone capacità, politiche di iscrizione e requisiti |
| Incassi | **Stripe Connect, incasso diretto all'organizzatore** + application fee della piattaforma | Nessuna custodia di fondi di terzi, KYC delegato al PSP, payout non gestiti dalla piattaforma |
| Monetizzazione | **Fee pagata dal partecipante**, "on top" e visibile in checkout | Prezzo esposto = netto organizzatore; la fee è configurabile (%, fisso, minimo/massimo) per organizzatore/piano |
| Ammissione | **First-come-first-served** + **quote per ruolo (leader/follower) con iscrizione a coppia** | Motore di capienza multi-dimensionale; gestione coppia (invito, sblocco 2 posti, scadenza pagamento partner, rottura coppia) |
| Community | **Bassa: solo ticketing** | Nessun profilo pubblico, feed, messaggistica o recensioni. L'utente ha account, biglietti, storico ordini |
| Adempimenti | **Configurabili per singolo evento** dall'organizzatore (tesseramento associativo e altri requisiti) | Motore di requisiti di partecipazione estensibile: tipi di requisito (tessera valida, documento con scadenza, dichiarazione, upload, campo custom) componibili per evento con blocco/avviso |
| Servizi accessori | **Selezionabili da catalogo in fase di creazione evento** (incl. lezioni private durante l'evento) | Catalogo di tipi di servizio, ognuno con prezzo, capienza propria e attributi specifici (taglia, dieta, slot orario) |
| Geografia e lingue | **Italia, interfaccia IT + EN**, valuta EUR | i18n dell'interfaccia dal giorno uno, contenuti organizzatore con campi traducibili opzionali; un solo regime fiscale |
| Check-in | **Web app con supporto offline** + **vendita alla porta (box office)** | Scansione QR multi-addetto, coda locale e sincronizzazione, anti-doppio-ingresso, incasso in loco con emissione immediata |
| Perimetro MVP | Ticketing completo con quote ruolo/coppia, lista d'attesa, Stripe, QR/check-in, requisiti configurabili. **Corsi ricorrenti e lezioni private in fase 2** | Roadmap a fasi; il modello dati però prevede già corsi e prenotazioni a calendario |
| Deliverable | **Analisi funzionale completa** + **versione presentabile al cliente** | Documento strutturato + impaginazione (PDF/pagina web) per stakeholder non tecnici |

## Secondo giro di decisioni (2026-07-30)

| Tema | Decisione | Conseguenze sull'analisi |
|---|---|---|
| **Modulo Live Wall + Chat** | **Dentro il primo rilascio.** Chat di evento in tempo reale con invio di testo e foto; console separata dove l'organizzatore decide cosa proiettare sulla *wall*. Attenzione particolare alla resa della schermata wall | Nuovo sottosistema realtime (canali per evento, upload media, moderazione, proiezione). Richiede un capitolo dedicato con specifica di layout, tipografia, leggibilità a distanza e comportamento in caso di rete instabile |
| Acconti | **Aboliti**: si paga l'intero importo in fase di acquisto | Nessun saldo, nessun sollecito, nessun ordine parzialmente pagato |
| Rimborsi | **Politica da definire dall'analista** (proposta in `03-politica-rimborsi.md`) | Motore di rimborso a scaglioni configurabile entro limiti di piattaforma |
| Cambio nominativo | **Sì**, trasferimento del biglietto ad altro ballerino | Storico titolarità del biglietto, invalidazione del QR precedente, limite temporale |
| Metodi di pagamento | **Stripe (carta), PayPal, Satispay**. Bonifico bancario in sviluppi futuri | Astrazione multi-PSP dal giorno uno: la fee e la riconciliazione non possono dipendere da Stripe |
| Onboarding organizzatori | Registrazione libera con **approvazione obbligatoria del super admin di piattaforma** | Stato "in attesa di approvazione", coda di verifica, motivazione del rifiuto, riapprovazione |
| Ruoli | **Serve una matrice di ruoli granulare**, da definire insieme (proposta in `02-matrice-ruoli.md`) | Permessi per singola capacità, non per ruolo monolitico |
| Co-organizzazione | **No** | Un solo titolare per evento, nessuno split degli incassi |
| Pagina evento | **Non personalizzabile**: layout unico di piattaforma, con **upload della locandina** | Un solo template di pagina evento; la locandina va gestita in più formati e ritagli |
| Quote di capienza | **Interamente customizzabili in fase di creazione evento** | Quote per ruolo, per titolo, per sessione, per servizio: tutte definite dall'organizzatore, nessuna regola imposta |
| Carrello e scadenze | **Nessun hold, nessuna scadenza**: si mette nel carrello ciò che si vuole e si paga subito | Capienza decrementata al pagamento riuscito, non alla selezione. Serve gestione della contesa: due utenti sull'ultimo posto |
| Liste d'attesa | **No** | Sold out è definitivo; niente promozione automatica |
| Cerco-partner | **Sì**, bacheca per stage e lezioni a coppie | Annuncio con evento, ruolo cercato, livello, contatto; unica eccezione al perimetro "solo ticketing" |
| Stack tecnologico | Fuori scope in questa fase | L'analisi resta tecnologicamente neutra |

## Terzo giro — modulo Chat e Live Wall (2026-07-30)

| Tema | Decisione |
|---|---|
| Accesso alla chat | **Tre condizioni congiunte**: biglietto valido + **check-in effettuato** (QR scansionato) + **piano premium attivo**. Il piano premium **non è un requisito del primo rilascio**, ma l'architettura va progettata come se il vincolo fosse già obbligatorio |
| Moderazione | **Chat libera, wall curata**: i messaggi appaiono subito in chat, sulla wall va solo ciò che il moderatore seleziona |
| Layout wall | **Focus singolo a rotazione**: un contenuto per volta, grande, transizione morbida, leggibile a 15-20 metri in sala buia |
| Output wall | **Solo browser a schermo intero con codice schermo**. Multi-schermo, wall consultabile dai partecipanti e resilienza offline restano fuori dal primo rilascio |

### Conseguenze da non sottovalutare

- **Nasce una seconda linea di ricavo**: l'abbonamento premium del ballerino, accanto alla fee
  sul biglietto. Serve un **layer di entitlement** (piani, abbonamenti, diritti) presente nel
  modello dati dal giorno uno e governato da un interruttore di configurazione, spento in MVP.
  Va deciso cosa comprende il premium oltre alla chat.
- Il vincolo del check-in rende la chat un **servizio di sala**: la sua durata di vita coincide
  con l'evento, e la sua utilità dipende dalla rete presente in location.
- **Rischio segnalato**: avendo escluso la resilienza offline, un calo di rete durante l'evento
  manda la wall a schermo nero davanti al pubblico. Mitigazione minima proposta e inclusa
  nell'analisi: buffer locale del contenuto in proiezione e degli ultimi contenuti approvati,
  così la rotazione continua anche senza connessione.

### Punto di attenzione aperto (segnalato)

L'assenza di hold e scadenze è coerente con l'assenza di liste d'attesa, ma incide
sull'**iscrizione a coppia**: senza posti riservati e senza finestra di pagamento per il
partner, la coppia funziona in un solo modo pulito — **un unico ordine paga entrambi i
posti** (chi iscrive inserisce i dati del partner e salda per due). L'alternativa "invito al
partner che paga dopo" richiederebbe per forza un hold. Procedo con l'ordine unico, salvo
diversa indicazione.

## Quarto giro — modello Premium (2026-07-30)

| Tema | Decisione |
|---|---|
| Applicazione di base | **Gratuita**: registrazione, consultazione di calendario e programma, acquisto, biglietti e check-in non costano nulla |
| Premium | **Funzionalità a pagamento per i ballerini**, come seconda linea di ricavo accanto alla fee sui biglietti. Ordine di grandezza indicato: 4,99 € |
| Funzioni Premium indicate dal committente | **Ricerca partner avanzata** con filtro per livello di ballo · **accesso prioritario** alle prenotazioni dei maestri più richiesti |
| Prezzo | **4,99 € all'anno**, piano unico, nessuna opzione mensile |
| Chat di evento | **Resta Premium**, come già deciso. Da dichiarare prima dell'acquisto del biglietto |
| Fee ridotta sui biglietti | **Esclusa** dal piano |
| Attivazione | **Fase 2, a data fissa**, indipendentemente dai numeri raggiunti |

### Conseguenze rilevanti

- Il **livello di ballo diventa un attributo della persona**, non solo della sessione. Poiché
  l'autodichiarazione nel tango è inaffidabile, il livello si compone di tre fonti mostrate
  separatamente: dichiarato, **desunto dallo storico delle partecipazioni in piattaforma** (dato
  che nessun concorrente possiede) e attestato da un maestro.
- Il perimetro «solo ticketing, community bassa» **cambia**: il prodotto acquisisce una
  componente relazionale a pagamento, con il profilo di rischio e i requisiti di moderazione
  che ne derivano.
- L'accesso prioritario è l'unica funzione Premium che **dispone di inventario non della
  piattaforma**: richiede l'adesione dell'organizzatore evento per evento.
- La piattaforma diventa **venditrice diretta al consumatore** sugli abbonamenti, non più solo
  intermediaria: account di incasso proprio, IVA ordinaria, documenti e numerazione propri,
  addebito ricorrente e diritto di recesso di quattordici giorni, che sui servizi digitali si
  applica a differenza dei biglietti per eventi con data certa.
- Progetto completo, tutele, adempimenti, soglie di attivazione e sei decisioni residue in
  `07-piano-premium.md`.

## Quinto giro — risoluzione dell'audit (2026-07-30)

| Tema | Decisione |
|---|---|
| Impegno di capienza | **Prenotazione temporanea a tempo all'avvio dell'ordine**, come nei ticketing generalisti: il posto è bloccato per la finestra che l'utente usa per completare l'acquisto, e si rilascia alla scadenza, al fallimento o all'abbandono. Riarmata all'avvio del pagamento per coprire il reindirizzamento al prestatore. **Durata 15 minuti, sempre attiva su ogni evento**, parametro di piattaforma e non dell'organizzatore. Uno **sforamento di pochi posti resta accettato** come rete di sicurezza |
| Diritti di prevendita | Pagati dal partecipante e **incassati dalla piattaforma**, non dall'organizzatore |
| Moderazione del primo evento | **Eliminata**: un solo cancello, all'approvazione dell'organizzazione |
| Cardinalità | **Una iscrizione per persona per evento**, con più biglietti collegati |
| Modello fiscale | Impostato **come i ticketing generalisti italiani**: prezzo dell'organizzatore più diritti di prevendita della piattaforma |

### Temi rinviati a sessioni dedicate

| Tema | Stato provvisorio |
|---|---|
| **Titoli d'ingresso e pass multi-sessione** | RF-EVT-7 e RF-EVT-8 restano ipotesi non concordate. L'utilizzo del biglietto è modellato per coppia biglietto-sessione, che è la forma più generale e non pregiudica nessuna scelta |
| **Tesseramento associativo** | Requisito presente, **entità assente dal modello dati**: è il debito di analisi più rilevante ancora aperto |
| **Modello fiscale degli organizzatori non commerciali** | Impostazione generale definita; resta da chiudere il trattamento di associazioni e quote associative, che riguarda la maggioranza delle milonghe |

### Nota dell'analista sullo sforamento

Lo sforamento è stato accettato sulle quote commerciali, e la semplificazione che ne deriva è
reale: cade la necessità del percorso di rimborso automatico per vendita oltre capienza. Ho
però escluso lo sforamento sulla **capienza della sala**, che non è un limite commerciale ma un
vincolo di sicurezza, spesso fissato da un'autorizzazione o da un certificato di prevenzione
incendi, e la cui responsabilità in caso di controllo ricade sull'organizzatore. Consentirgli di
superarlo per una svista di configurazione sarebbe un danno fatto a lui, non un servizio.

## Sesto giro — tesseramento (2026-07-31)

| Tema | Decisione |
|---|---|
| Natura dei titoli | **Solo biglietti commerciali.** Nessuna vendita come quota di partecipazione riservata ai soci |
| Tesseramento | **Interamente fuori dalla piattaforma**, almeno in fase 1: nessuna anagrafica delle tessere, nessuna vendita della quota associativa, nessuna verifica automatica |
| Certificato medico | **Non trattato.** Nessun documento sanitario entra in piattaforma |

### Cosa si semplifica

- Cadono l'entità Tessera, l'ente affiliante, l'anno associativo, la domanda di ammissione a
  socio e il portafoglio delle tessere.
- Cade il trattamento dei **dati sanitari**: niente cifratura dedicata, niente accessi tracciati
  sui documenti, niente valutazione d'impatto, niente cancellazione automatica dei certificati.
  Restano solo diete e allergie per i pasti. Il rischio R8 si chiude.
- L'upload di documenti nei requisiti esce dal primo rilascio: restano dichiarazioni e campi
  custom, che non trattano dati di nessun tipo.
- Il modello fiscale diventa uniforme: un solo tipo di titolo, un solo regime.

### Cosa si complica, e va detto

Era la **natura associativa** a tenere la maggior parte degli eventi di ballo fuori dal regime
del titolo di accesso fiscale. Vendendo solo biglietti commerciali quella strada non è più
percorribile, e l'obbligo del titolo di accesso passa **da eventuale ad attuale** per gli eventi
soggetti. La verifica con un commercialista dello spettacolo diventa una precondizione per
aprire le vendite del primo evento reale.

Cambia anche il **segmento di mercato del primo rilascio**: le milonghe settimanali operano in
forma associativa e restano fuori. Il perimetro si sposta su festival, marathon, encuentro e
stage — che sono però anche gli eventi con il biglietto più alto e il maggior bisogno delle
funzioni distintive della piattaforma. È una scelta coerente, purché dichiarata come
posizionamento.

## Settimo giro — titoli e pass (2026-07-31)

| Tema | Decisione |
|---|---|
| Sessioni incluse | **Elenco esplicito**, non una regola: aggiungere una sessione a evento pubblicato non cambia i titoli già venduti |
| Scaglioni di prezzo | **Facoltativi e definiti dall'organizzatore in fase di creazione**: a data, a quantità o combinati. Default: **prezzo unico che non cambia mai** |
| Blocco del prezzo | **Alla creazione dell'ordine**, coerentemente con la prenotazione da quindici minuti |
| Unità di vendita | Per persona o **per coppia**; il titolo a coppia non è acquistabile da solo |
| Sovrapposizioni | **Avvisare senza bloccare**, senza doppio consumo delle quote di sessione |
| QR | **Uno per biglietto**, non uno per sessione: in sala nessuno cerca il codice giusto tra dodici |
| Composizione libera e upgrade di titolo | **Fase 2** |

Chiude definitivamente la correzione provvisoria **A4**: l'utilizzo non è uno stato del
biglietto ma un check-in sulla coppia biglietto-sessione, con sessione implicita per gli eventi
semplici. Dettaglio completo in `09-titoli-e-pass.md`.

## Ottavo giro — posizionamento fiscale (2026-07-31)

| Tema | Decisione |
|---|---|
| Adempimenti fiscali e SIAE | **In capo all'organizzatore, gestiti fuori dalla piattaforma**, come già avviene oggi |
| Natura della piattaforma | **Strumento di vendita, non intermediario fiscale.** Emette una conferma d'ordine con QR di accesso, non un titolo fiscale |
| Verifica fiscale | **Non è più una precondizione allo sviluppo.** Il briefing `10` resta disponibile come consulenza di conferma |

### Le tre condizioni che tengono in piedi il posizionamento

1. **RF-ORG-8** — l'organizzatore dichiara il proprio inquadramento e attesta per ogni evento di
   adempiere a ciò che gli compete, con dichiarazione versionata e richiamata dalle condizioni.
2. **RF-TCK-11** — il documento emesso è dichiaratamente una conferma d'ordine: nessuna
   numerazione progressiva, nessun sigillo, nessuna dicitura che possa farlo sembrare un titolo
   fiscale.
3. **RF-BKO-9** — esportazione delle vendite con il dettaglio per titolo e per sessione, così
   che l'organizzatore possa fare le proprie ripartizioni. Senza questa terza condizione il
   posizionamento sarebbe uno scarico di responsabilità; con essa è una divisione di compiti.

La piattaforma continua a documentare e assoggettare a imposta **la propria componente** — i
diritti di prevendita — perché è ricavo suo e non dell'organizzatore.

### Sovranità dell'organizzatore sui numeri

| Tema | Decisione |
|---|---|
| Totale posti | L'organizzatore lo **aggiorna quando vuole**, anche sotto il venduto: si chiude la vendita online, non si invalida nulla |
| Emissione manuale di pass | **A sua totale discrezione, in qualunque quantità, senza vincolo di capienza**, con QR annesso |
| Conteggi | La piattaforma **tiene conto e mostra a schermo**, come informazione **non bloccante** |
| Vendite fuori piattaforma | La gestione è una **scelta in fase di creazione dell'evento**: chi non la vuole non la incontra |

**Il principio che ne risulta**: le quote governano la **sola vendita online**, dove la
piattaforma non deve vendere ciò che non c'è. Verso l'organizzatore i contatori sono
informativi: conta e mostra, non impedisce. L'unica cautela mantenuta è che ogni numero
dichiari su quali dati è calcolato (RB21), perché un conteggio parziale presentato come
completo è peggio di nessun conteggio.

### Canali di vendita

**La piattaforma non è l'unico canale**: affianca la biglietteria dell'organizzatore. Questo
chiude definitivamente il residuo legale — la qualificazione di canale di prevendita è solida —
e R15 si chiude.

Ne discende però una **conseguenza funzionale che non era stata considerata**: vendendo
l'organizzatore anche fuori, i contatori di capienza non conoscono quelle vendite. La
disponibilità mostrata al pubblico risulterebbe sovrastimata, e l'evento potrebbe essere pieno
in sala pur risultando aperto online. Introdotti quindi il **contingente riservato ai canali
esterni** (RF-EVT-32), la **registrazione delle vendite esterne** (RF-BKO-10), la **vista di
allineamento dei canali** (RF-BKO-11) e l'**ingresso di chi ha comprato altrove** (RF-CHK-15).
Nuovo rischio R17.

## Nono giro — chiusura dell'audit (2026-07-31)

Chiusi i sedici punti che restavano aperti in `06-audit-analisi.md`, da **B3** a **C5**.
Risoluzione completa in `11-chiusura-audit.md`, requisiti recepiti nella revisione 1.1b di
`04-analisi-funzionale.md`.

| Tema | Decisione |
|---|---|
| **Contestazioni di addebito** | La piattaforma prende in carico l'intero ciclo per conto dell'organizzatore: fascicolo di prova costituito automaticamente, trasmissione entro il termine, esito applicato con lo stesso percorso del rimborso. I diritti di prevendita seguono la sorte della transazione |
| **Immagini in chat** | Classificazione automatica preventiva delle sole immagini, con trattenimento selettivo di ciò che risulta sospetto. La chat resta libera per il testo. Un contenuto trattenuto e mai esaminato resta trattenuto |
| **Nickname** | Filtrato alla creazione e a ogni modifica, oscurabile dal moderatore sulla wall: è l'unico dato dell'autore che finisce su un maxischermo |
| **Persone iscritte da altri** | Iscrizione in stato `da_confermare` che **non blocca mai l'ingresso**, facoltà di rifiuto che restituisce il biglietto all'acquirente, raccolta dei soli dati necessari all'emissione |
| **Account di incasso** | Si verifica lo **stato di abilitazione**, non il collegamento, e in modo continuativo. La decadenza sospende la vendita; biglietti emessi e rimborsi restano intatti |
| **Annullamento di una singola sessione** | Ammesso, con **peso di ripartizione** per sessione — default uniforme, personalizzabile — e rimborso proporzionale senza scaglioni. Oltre il 30% del peso del titolo scatta il diritto al rimborso integrale |
| **Carnet** | Confermato fuori dal primo rilascio per conseguenza della decisione sul tesseramento, con la dipendenza dichiarata |
| **Minori** | Account dai 14 anni; sotto quella soglia nessun account e iscrizione da parte di un adulto; chat riservata ai maggiorenni; l'organizzatore dichiara sull'evento se li ammette |
| **Wall** | Modalità prova con carta di calibrazione per l'allestimento, e rotazione di sicurezza sui soli contenuti già approvati quando manca il presidio: la wall non resta mai a schermo fisso per ore |
| **Chat negli eventi senza check-in** | **Sblocco di sala**: il QR della schermata di cortesia vale come check-in leggero ai soli fini della chat, con codice a rotazione breve |
| **Archivio della wall** | L'esportazione comprende i soli contenuti **effettivamente proiettati**, e il consenso al primo invio dichiara che l'organizzatore può conservarli e riutilizzarli |
| **Carrello multi-organizzatore** | Suddivisione automatica in un ordine per organizzatore, con pagamenti sequenziali. I **diritti di prevendita si calcolano per biglietto**, così la suddivisione non cambia il totale |
| **Traduzioni** | La seconda lingua copre tutti i testi dell'organizzatore che compaiono in un percorso di acquisto o di adempimento, non la sola descrizione dell'evento |
| **Chiusura della vendita** | Quattro criteri configurabili — data, esaurimento, decisione manuale, inizio dell'evento — e chiude il primo che si verifica. Riguarda la sola vendita online |
| **Numerazione dei requisiti** | Rinumerazione continua **una sola volta**, alla revisione 1.2, con tabella di corrispondenza. Da lì in avanti gli identificativi sono stabili e mai riusati |

### Le tre decisioni residue, chiuse in giornata

Confermate dal committente il 31 luglio 2026, tutte e tre secondo la raccomandazione
dell'analista. **L'audit non ha più alcuna voce aperta.**

| # | Decisione | Esito |
|---|---|---|
| D10 | Minori | **Ammessi** alle tre soglie: account dai 14 anni compiuti · sotto i 14 nessun account, iscrizione da parte di un adulto che dichiara di esercitare la responsabilità genitoriale · chat riservata ai maggiorenni. L'organizzatore dichiara sull'evento se li ammette e a quali condizioni |
| D11 | Classificazione automatica delle immagini | **Adottata.** Ogni immagine è classificata prima di comparire in chat; ciò che risulta sospetto è trattenuto in attesa di un moderatore e non è visibile a nessuno. Il costo ricorrente entra in piano; il fornitore entra nell'elenco dei trasferimenti dell'informativa |
| D12 | Contestazioni di addebito | **Penale del prestatore a carico dell'organizzatore**, dichiarata nelle condizioni di servizio. **Soglia di sospensione allineata a quella del prestatore**, con avviso all'Owner al superamento di una soglia di attenzione inferiore |

**Perché la penale all'organizzatore.** La contestazione nasce nel rapporto tra organizzatore e
partecipante — evento diverso da quello promesso, rimborso non concesso, comunicazione assente —
e la piattaforma non ha leva su nessuna di queste cause. Farla ricadere su chi può prevenirla è
anche l'unico incentivo che funziona. La piattaforma sopporta comunque lo storno dei propri
diritti di prevendita (RF-PAY-30), quindi non è indenne: entrambe le parti perdono qualcosa, ed
entrambe hanno motivo di evitare che accada.

**Perché la soglia allineata al prestatore.** Fissarne una più severa sarebbe arbitrario, una
più permissiva sarebbe inutile: oltre la propria soglia il prestatore sospende comunque
l'account, e un organizzatore che non può incassare non può operare (RF-ORG-11). Alla
piattaforma resta il compito di **avvisare prima**, con una soglia di attenzione più bassa che
dà all'organizzatore il tempo di correggere.

### Un effetto collaterale utile

Il **peso di ripartizione per sessione**, introdotto per calcolare il rimborso di una sessione
annullata, è esattamente la struttura dati che servirebbe se la verifica fiscale rispondesse che
un pass misto va scomposto tra componente didattica e componente danzante (`10` domanda 8). Un
requisito nato per i rimborsi copre gratuitamente l'unico rischio fiscale che avrebbe imposto
una modifica al modello dati.

## Decimo giro — strategia di prodotto e ordine di costruzione (2026-07-31)

| Tema | Decisione |
|---|---|
| **Priorità immediata** | Mettere gli **organizzatori già clienti** in condizione di aprire le prenotazioni del prossimo evento. Perimetro in `13-primo-taglio.md` |
| **L'app del tanghero** | **Resta in fase 2.** Cinque funzioni indicate dal committente, registrate come milestone di progetto in `12-app-tanghero.md`: Social Matcher per workshop · Tanda e DJ Live Tracker · passaporto con wallet e notifica geolocalizzata · mappa della community · bacheca dei nomadi |
| **Chi promuove il prodotto** | I ballerini. L'adozione degli organizzatori è **dal basso**: il tanghero usa l'app e chiede al proprio organizzatore di esserci. Ne discende che l'app dev'essere gratuita e curata nell'estetica |
| **Estetica** | Toni caldi e scuri — nero, bordeaux come superficie, oro e avorio come testo — transizioni fluide. Eredita la palette che RF-WALL-31 già impone alla wall per ragioni funzionali, con verifica di contrasto WCAG 2.1 AA sulla palette |
| **Prestatore di pagamento del primo taglio** | **Solo Stripe.** La ripartizione dei diritti di prevendita è nativa: **Q19 esce dal percorso critico** e l'accordo PayPal corre in parallelo allo sviluppo |
| **Fasi** | La fase 1 si articola in **1a — primo taglio** e **1b — completamento**. L'app del tanghero apre la fase 2 |

### Le tre previsioni da fare in fase 1 perché la fase 2 non costi il doppio

1. La rotazione della **Live Wall accetta un segnale esterno di avanzamento**, oltre al proprio
   timer: è ciò che permetterà al tracker delle tande di dare il ritmo alla proiezione. La
   cortina è già indicata nel glossario come il momento naturale della rotazione, ed è il momento
   di massima attenzione della serata.
2. Il **check-in registra la presenza anche dove non c'è vendita**: passaporto e livello desunto
   valgono in proporzione a quante presenze conoscono.
3. Il **profilo ha spazio per attributi di ballo estensibili** — livello, stile, e ciò che verrà.

### Conseguenze da registrare

- Il perimetro «solo ticketing, community bassa» **cade definitivamente**: mappa della community,
  bacheca dei nomadi e passaporto sono componenti relazionali piene.
- Le **notifiche push** passano dalla fase 3 alla fase 2.
- Lo **stile di ballo** (milonguero, salon, nuevo) entra nel profilo: per l'abbinamento tra due
  ballerini discrimina più del livello.
- La decisione **D2 — chat riservata al Premium — va riesaminata** prima della fase 2: se il
  ballerino è il promotore, la funzione più condivisibile del prodotto è dietro il paywall meno
  redditizio. Nuova decisione **D14**.
- Nuove decisioni aperte: **D13** app nativa o web, **D14** chat gratuita o Premium, **D15**
  catalogo degli stili, **D16** contropartita per il DJ che alimenta il tracker.

## Principio architetturale trasversale emerso

Tre risposte su quattro convergono sullo stesso principio: **l'organizzatore configura, la piattaforma non impone**.
Tipi di evento, requisiti di partecipazione e servizi accessori sono cataloghi estensibili
selezionati e parametrizzati in fase di creazione evento. L'analisi tratterà quindi come
requisito di primo livello un modello "component-based" dell'evento, non uno schema rigido
per tipologia.

## Punti ancora aperti

Vedi `00-questionario-analisi.md` per il questionario integrale. Aggiornato dopo il nono giro:

| # | Tema | Natura |
|---|---|---|
| 1 | **Data di apertura vendite del primo evento reale** (Q7): è la scadenza vera del progetto | Per pianificare a ritroso il primo taglio |
| 2 | **D13–D16**: app nativa o web, chat gratuita o Premium, catalogo degli stili, contropartita per il DJ | Prima della pianificazione della fase 2 |
| 3 | **Le quattro decisioni sulla matrice dei ruoli** (Q1) | Prima dello sviluppo dei permessi |
| 4 | **Versione presentabile al cliente** | Deliverable concordato, non ancora prodotto |
| 5 | **Revisione 1.2** di `04` con la rinumerazione continua dei requisiti (C1) | Contestuale al deliverable per il cliente |
| 6 | Contropartita per l'accesso anticipato, data di attivazione del Premium, presentazione del livello, revisione del prezzo (Q13, Q16, Q17, Q18) | Prima della fase 2 |
| 7 | Stack tecnologico, migrazione dati, identità visiva (Q8–Q10) | Fuori scope dell'analisi finora |

**L'audit `06` non ha più alcuna voce aperta.** La **ripartizione su PayPal e Satispay (Q19)**
non è più bloccante: con il solo Stripe nel primo taglio, l'accordo di partner corre in
parallelo allo sviluppo.

Le politiche di rimborso, l'onboarding e la moderazione degli organizzatori e il pagamento in
acconto sono chiusi rispettivamente in `03`, al secondo e quinto giro, e al secondo giro.


---

<!-- ============================================================ -->
<!-- SORGENTE: 02-matrice-ruoli.md -->
<!-- ============================================================ -->

# Mirada Tango — Matrice ruoli e permessi (proposta da validare)

Legenda: **●** pieno · **◐** limitato (solo eventi assegnati o azione subordinata) · **○** sola lettura · **–** nessun accesso

## I ruoli proposti

### Lato piattaforma
| Codice | Ruolo | Perché esiste |
|---|---|---|
| **SA** | Super Admin ("god") | Unico ruolo con potere di approvazione degli organizzatori e configurazione dei cataloghi |
| **PS** | Supporto e Moderazione | Assiste utenti e organizzatori, modera contenuti segnalati (chat/wall). Non tocca denaro né configurazioni |
| **PF** | Amministrazione piattaforma | Fee, riconciliazioni, fatturazione delle commissioni, report economici. Non tocca eventi né utenti |

### Lato organizzatore (ruoli assegnati dentro una singola organizzazione)
| Codice | Ruolo | Perché esiste |
|---|---|---|
| **OW** | Owner | Titolare dell'organizzazione: dati fiscali, account di incasso, staff, annullamenti, rimborsi |
| **EM** | Event Manager | Costruisce e gestisce gli eventi che gli sono assegnati, senza accedere a banca e staff |
| **BO** | Box Office / Cassa | Vende alla porta, incassa in loco, corregge nominativi. Nessun accesso ai report economici complessivi |
| **CI** | Operatore Check-in | Solo scansione QR e lista presenze dell'evento in corso. È il ruolo dei volontari: deve vedere il minimo indispensabile |
| **WM** | Moderatore Live Wall | Governa chat e proiezione durante l'evento. Ruolo separato perché lavora in tempo reale e spesso è una persona diversa dallo staff di cassa |
| **CM** | Comunicazione | Email ai partecipanti, codici promo, contenuti della pagina evento. Nessun accesso a incassi e dati sensibili |
| **AC** | Contabile (esterno) | Sola lettura su incassi e documenti fiscali, nessun accesso operativo |

### Lato utente finale
| Codice | Ruolo | Note |
|---|---|---|
| **BA** | Ballerino / partecipante | Account personale: acquisti, biglietti, trasferimenti, cerco-partner, chat |
| **GU** | Ospite non registrato | Naviga il calendario e le pagine evento. **Proposta: per acquistare serve un account**, creato contestualmente al checkout in un solo passaggio (serve per QR nominale, requisiti di partecipazione e trasferimento biglietto) |

> **Maestri e DJ** non hanno un accesso proprio nel primo rilascio: sono anagrafica di cast dell'evento, coerentemente con la scelta "solo ticketing". Un ruolo **Maestro** con login diventa necessario in fase 2, con corsi ricorrenti e lezioni private.

## Matrice dei permessi

### Governo della piattaforma
| Capacità | SA | PS | PF | OW | EM | BO | CI | WM | CM | AC | BA |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Approvare / rifiutare la richiesta di un nuovo organizzatore | ● | ○ | – | – | – | – | – | – | – | – | – |
| Sospendere o bannare un'organizzazione o un utente | ● | ◐ propone | – | – | – | – | – | – | – | – | – |
| Configurare i cataloghi (tipi evento, requisiti, servizi accessori) | ● | – | – | – | – | – | – | – | – | – | – |
| Configurare la fee di piattaforma e le sue eccezioni | ● | – | ○ | – | – | – | – | – | – | – | – |
| Report globali (venduto, fee maturate, organizzatori attivi) | ● | – | ● | – | – | – | – | – | – | – | – |
| Moderare contenuti segnalati su chat e wall di qualsiasi evento | ● | ● | – | – | – | – | – | – | – | – | – |
| Impersonare un utente per assistenza (con log di audit) | ● | ◐ | – | – | – | – | – | – | – | – | – |

### Organizzazione ed evento
| Capacità | SA | PS | PF | OW | EM | BO | CI | WM | CM | AC | BA |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Modificare anagrafica e dati fiscali dell'organizzazione | ○ | – | – | ● | – | – | – | – | – | ○ | – |
| Collegare o scollegare l'account di incasso (PSP) | ○ | – | ○ | ● | – | – | – | – | – | – | – |
| Invitare / rimuovere membri e assegnare ruoli | ○ | – | – | ● | – | – | – | – | – | – | – |
| Creare un evento in bozza | – | – | – | ● | ● | – | – | – | – | – | – |
| Pubblicare / depubblicare un evento | – | – | – | ● | ● | – | – | – | – | – | – |
| Definire titoli d'ingresso, prezzi e quote di capienza | – | – | – | ● | ● | – | – | – | – | – | – |
| Definire i requisiti di partecipazione richiesti | – | – | – | ● | ● | – | – | – | – | – | – |
| Definire i servizi accessori in vendita | – | – | – | ● | ● | – | – | – | – | – | – |
| Caricare la locandina e i contenuti descrittivi | – | – | – | ● | ● | – | – | – | ● | – | – |
| Annullare l'evento e avviare i rimborsi massivi | ○ | – | – | ● | – | – | – | – | – | – | – |

### Partecipanti e dati personali
| Capacità | SA | PS | PF | OW | EM | BO | CI | WM | CM | AC | BA |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Consultare l'elenco partecipanti con dati di contatto | – | ◐ | – | ● | ● | ◐ | – | – | ◐ | – | – |
| Vedere solo nome, ruolo di ballo e titolo (vista check-in) | – | – | – | ● | ● | ● | ● | – | – | – | – |
| Esportare l'elenco partecipanti | – | – | – | ● | ● | – | – | – | – | – | – |
| Vedere l'**esito** di un requisito (valido / non valido) | – | – | – | ● | ● | ● | ● | – | – | – | – |
| Aprire il **documento** caricato (tessera, certificato) | – | ◐ | – | ● | ◐ | – | – | – | – | – | – |
| Approvare o rifiutare un requisito | – | – | – | ● | ● | – | – | – | – | – | – |

> Il documento caricato e le informazioni su diete e allergie sono dati che meritano il trattamento più restrittivo: la regola proposta è che lo staff veda **l'esito**, non il file. L'accesso al file è tracciato in audit log.

### Vendita, cassa, denaro
| Capacità | SA | PS | PF | OW | EM | BO | CI | WM | CM | AC | BA |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Vendere alla porta e registrare l'incasso (contanti / POS) | – | – | – | ● | – | ● | – | – | – | – | – |
| Emettere un accredito o un omaggio | – | – | – | ● | ◐ | – | – | – | – | – | – |
| Effettuare il check-in (scansione QR) | – | – | – | ● | ● | ● | ● | – | – | – | – |
| Cambiare il nominativo di un biglietto | – | ◐ | – | ● | ● | ● | – | – | – | – | ● proprio |
| Approvare un rimborso | – | – | – | ● | ◐ propone | – | – | – | – | – | – |
| Consultare incassi e report dell'evento | – | – | ○ | ● | ◐ | – | – | – | – | ○ | – |
| Accedere a documenti fiscali ed export contabile | – | – | ○ | ● | – | – | – | – | – | ● | – |
| Creare codici promozionali | – | – | – | ● | ◐ | – | – | – | ● | – | – |
| Inviare comunicazioni ai partecipanti | – | – | – | ● | ◐ | – | – | – | ● | – | – |

### Chat e Live Wall
| Capacità | SA | PS | PF | OW | EM | BO | CI | WM | CM | AC | BA |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Scrivere in chat e inviare foto | – | – | – | ● | ● | – | – | ● | – | – | ◐ |
| Approvare / rifiutare messaggi e foto | ● | ● | – | ● | ● | – | – | ● | – | – | – |
| Scegliere cosa mandare in proiezione sulla wall | – | – | – | ● | ● | – | – | ● | – | – | – |
| Configurare aspetto e layout della wall | – | – | – | ● | ● | – | – | ◐ | – | – | – |
| Silenziare / espellere un utente dalla chat dell'evento | ● | ● | – | ● | ● | – | – | ● | – | – | – |

### Utente finale
| Capacità | BA |
|---|:-:|
| Acquistare biglietti e servizi accessori | ● |
| Consultare i propri biglietti e ristampare il QR | ● |
| Trasferire un proprio biglietto a un altro ballerino | ● |
| Richiedere un rimborso | ● |
| Pubblicare e gestire un annuncio cerco-partner | ● |
| Partecipare alla chat dell'evento | ◐ da definire: solo con biglietto valido? |
| Esportare o cancellare i propri dati (GDPR) | ● |

## Punti da decidere su questa matrice

1. **BO (cassa) può emettere rimborsi** in loco o solo l'Owner? (proposta: no, solo Owner)
2. **EM può pubblicare** senza passare dall'Owner? (proposta: sì, altrimenti il ruolo è inutile)
3. Un ruolo si assegna **per organizzazione o per singolo evento**? (proposta: EM, BO, CI e WM assegnabili per evento; OW, CM e AC per organizzazione)
4. Serve un ruolo unico "Staff" cumulativo per le realtà piccole dove una persona fa tutto? (proposta: sì, come preset che accorpa EM+BO+CI+WM)


---

<!-- ============================================================ -->
<!-- SORGENTE: 03-politica-rimborsi.md -->
<!-- ============================================================ -->

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


---

<!-- ============================================================ -->
<!-- SORGENTE: 04-analisi-funzionale.md -->
<!-- ============================================================ -->

# Mirada Tango — Analisi Funzionale

**Versione** 1.1b · **Data** 31 luglio 2026 · **Stato** bozza per validazione

Documenti collegati: `00-questionario-analisi.md` (raccolta requisiti) · `01-decisioni-prese.md` (decisioni) · `02-matrice-ruoli.md` (ruoli e permessi) · `03-politica-rimborsi.md` (policy commerciale) · `05-modello-capienza.md` (motore di capienza) · `09-titoli-e-pass.md` (titoli e pass) · `11-chiusura-audit.md` (chiusura dei punti B3–C5)

*Revisione 1.1: recepite le decisioni sul flag `limitante` delle quote di sessione e sulla gestione della disponibilità parziale in checkout. Il motore di capienza è specificato nell'allegato `05-modello-capienza.md`.*

*Revisione 1.1b: recepiti i sedici punti chiusi in `11-chiusura-audit.md` — contestazioni di addebito, moderazione delle immagini, consenso dei terzi iscritti, abilitazione all'incasso, annullamento di singola sessione, minori, prova e presidio della wall, sblocco di sala, archivio, carrello multi-organizzatore, traduzioni, chiusura della vendita. Trentuno requisiti nuovi, tre regole di business nuove, quattro requisiti modificati. La rinumerazione continua degli identificativi è pianificata con la revisione 1.2 (C1).*

---

## 1. Sommario esecutivo

Mirada Tango è un **marketplace di eventi di tango argentino**: gli organizzatori pubblicano
milonghe, festival, marathon, encuentros e stage; i ballerini li scoprono, si iscrivono e
pagano online; lo staff gestisce l'accesso in sala; durante l'evento una **chat moderata
alimenta un maxischermo** proiettato in location.

L'analisi poggia su un principio emerso con chiarezza in fase di intervista e assunto come
vincolo architetturale: **l'organizzatore configura, la piattaforma non impone.** Tipi di
evento, quote di capienza, requisiti di partecipazione e servizi accessori non sono elenchi
fissi scritti nel codice, ma cataloghi estensibili che l'organizzatore compone quando crea
l'evento. È la scelta che consente di coprire con un solo modello una milonga del giovedì da
80 persone e un encuentro internazionale su tre giorni con ratio leader/follower vincolante,
e di aggiungere nuove tipologie in corso d'opera senza rilasci di sviluppo.

Tre caratteristiche distinguono il prodotto da un ticketing generalista:

1. **Il ruolo di ballo è un dato di primo livello.** Non è un campo descrittivo: governa la
   capienza. Un evento può essere pieno per i follower e aperto per i leader.
2. **L'iscrizione a coppia** è una transazione a due soggetti su un unico ordine.
3. **La chat con Live Wall** trasforma il biglietto in un accesso a un servizio digitale
   di sala, e apre la strada all'abbonamento premium del ballerino.

Il primo rilascio copre l'intero percorso dalla pubblicazione dell'evento al check-in in
sala, chat e wall inclusi. Corsi ricorrenti e lezioni private sono rinviati alla fase 2, con
modello dati già predisposto.

---

## 2. Contesto, obiettivi, perimetro

### 2.1 Obiettivi

| # | Obiettivo | Misura di successo proposta |
|---|---|---|
| OB1 | Portare online le iscrizioni oggi gestite con form e bonifici | ≥ 80% delle iscrizioni concluse online senza intervento manuale |
| OB2 | Azzerare la riconciliazione manuale degli incassi | Ogni incasso riconducibile a un ordine, zero fogli di calcolo paralleli |
| OB3 | Rendere gestibile la capienza per ruolo di ballo | Ratio leader/follower entro la tolleranza dichiarata su tutti gli eventi che la usano |
| OB4 | Ridurre i tempi di ingresso in sala | < 10 secondi per persona al check-in, code fluide anche con più addetti |
| OB5 | Costruire un canale diretto verso i ballerini | Base utenti riutilizzabile per la comunicazione e, in prospettiva, per l'abbonamento premium |
| OB6 | Aumentare la partecipazione percepita durante l'evento | Contenuti in chat e proiezioni per evento, come indicatore di coinvolgimento |

### 2.2 Dentro il perimetro del primo rilascio

Registrazione utenti · onboarding organizzatori con approvazione · creazione evento
component-based · titoli d'ingresso, prezzi e quote customizzabili · requisiti di
partecipazione configurabili · servizi accessori da catalogo · carrello e checkout
multi-PSP (Stripe, PayPal, Satispay) con fee a carico del partecipante · biglietti nominali
con QR · trasferimento del nominativo · iscrizione a coppia · quote per ruolo di ballo ·
bacheca cerco-partner · check-in con supporto offline · vendita alla porta · rimborsi e
annullamenti · chat di evento con Live Wall · comunicazioni transazionali · back-office e
report per organizzatore · console di amministrazione della piattaforma.

### 2.3 Fuori dal perimetro del primo rilascio

Corsi ricorrenti e abbonamenti a lezioni · lezioni private con calendario del maestro ·
liste d'attesa · acconto e saldo · co-organizzazione con split degli incassi · pagina evento
personalizzabile e widget da incorporare · profili pubblici, feed, messaggistica privata,
recensioni · bonifico bancario come metodo di pagamento · multi-schermo per la wall · wall
consultabile dai partecipanti · app native · piano premium attivo (progettato, non attivato)
· selezione manuale delle candidature e lotteria · gestione SIAE e borderò · fatturazione
elettronica automatica · **tesseramento associativo, vendita della quota associativa e
certificato medico**, che restano interamente fuori dalla piattaforma · vendita come quota di
partecipazione riservata ai soci: **tutti i titoli sono biglietti commerciali** · upload di
documenti nei requisiti.

### 2.4 Assunzioni

| # | Assunzione | Se cade |
|---|---|---|
| AS1 | Il prezzo esposto al partecipante è il netto dell'organizzatore; la fee di piattaforma è aggiunta in checkout | Cambia il calcolo di ogni riga d'ordine e la comunicazione di prezzo |
| AS2 | L'acquisto richiede un account, creato contestualmente al checkout in un solo passaggio | Serve un percorso ospite, incompatibile con QR nominale e requisiti |
| AS3 | La coppia si acquista in un unico ordine che salda entrambi i posti | Serve un meccanismo di prenotazione temporanea, escluso per decisione |
| AS4 | La capienza si impegna all'avvio dell'ordine con una prenotazione temporanea a tempo, e si rilascia alla scadenza o al fallimento | Senza prenotazione si torna al rischio di doppia vendita per tutta la durata dell'ordine |
| AS5 | La location dispone di rete durante l'evento per chat e wall | La chat non è utilizzabile e la wall si ferma sul buffer locale |
| AS6 | Un solo regime fiscale (Italia) e una sola valuta (EUR) | Serve modellare paese, valuta e imposte per riga |

### 2.5 Posizionamento: cosa la piattaforma fa e cosa non fa

Mirada Tango è **uno strumento di vendita, non un intermediario fiscale.** Gli adempimenti
restano dell'organizzatore e si svolgono fuori dalla piattaforma, come già avviene oggi. È una
scelta di posizionamento, va dichiarata come tale nelle condizioni di servizio e riflessa nel
prodotto, non lasciata implicita.

| La piattaforma fa | La piattaforma non fa |
|---|---|
| Espone il catalogo degli eventi e raccoglie l'ordine | Non emette titoli di accesso fiscali |
| Incassa il prezzo sull'account dell'organizzatore | Non calcola né versa le imposte dell'organizzatore |
| Trattiene i propri **diritti di prevendita**, che sono ricavo suo, e li documenta e assoggetta a imposta autonomamente | Non gestisce SIAE, borderò né diritti d'autore |
| Emette una **conferma d'ordine con QR di accesso** e ne governa il controllo all'ingresso | Non tiene la contabilità dell'organizzatore né emette documenti in suo nome |
| Conserva ed esporta i dati di vendita in forma completa, perché l'organizzatore possa adempiere | Non si sostituisce agli adempimenti, né verifica che siano stati assolti |

Ne discendono tre requisiti che tengono in piedi il posizionamento: la **dichiarazione e
attestazione dell'organizzatore** (RF-ORG-8), la **natura non fiscale del documento emesso**
(RF-TCK-11), e **l'esportazione dei dati con il dettaglio necessario** (RF-BKO-9). Senza il
terzo il posizionamento è scarico di responsabilità; con il terzo è una divisione di compiti.

---

## 3. Glossario di dominio

Il vocabolario del tango è parte dei requisiti: usarlo correttamente nell'interfaccia è un
fattore di credibilità verso la community.

| Termine | Significato | Rilievo funzionale |
|---|---|---|
| **Milonga** | Serata di ballo. Indica anche uno dei tre ritmi del tango | Evento singolo o ricorrente, biglietto a serata |
| **Práctica** | Incontro informale di pratica, spesso con assistenza | Come la milonga, prezzo ridotto |
| **Marathon** | Più giorni di solo ballo, senza lezioni, ritmo intenso | Ratio leader/follower vincolante, pass unico |
| **Encuentro** | Evento di ballo tradizionale, milonguero, molto curato nella selezione dei partecipanti | Quote per ruolo strette, spesso capienza ridotta |
| **Festival** | Più giorni con workshop, milonghe, spettacoli | Struttura a sessioni, pass multipli |
| **Stage / workshop** | Seminario intensivo, per livello | Iscrizione singola o a coppia, quote per ruolo |
| **Leader / Follower** | Ruoli di ballo (chi propone, chi interpreta). Sostituiscono "uomo/donna": nel tango contemporaneo il ruolo è indipendente dal genere | **Dimensione di capienza.** Mai derivare il ruolo dal genere |
| **Both / switch** | Chi balla entrambi i ruoli | Deve poter scegliere il ruolo per singolo evento |
| **Tanda** | Serie di 3-4 brani dello stesso stile, si balla con lo stesso partner | Utile per il programma e per gli annunci sulla wall |
| **Cortina** | Stacco musicale tra due tande, si cambia partner | Momento naturale per la rotazione dei contenuti sulla wall |
| **Cabeceo / Mirada** | L'invito a ballare con lo sguardo e il cenno del capo. Dà il nome al progetto | Riferimento identitario, non funzionale |
| **Ronda** | Il senso di marcia sulla pista | — |
| **Taxi dancer** | Ballerino ingaggiato per garantire il ballo agli ospiti | Possibile ruolo/servizio accessorio in fase 2 |
| **Balance / ratio** | Rapporto tra leader e follower ammessi | Regola di capienza configurabile |

---

## 4. Attori

| Attore | Descrizione sintetica |
|---|---|
| **Visitatore** | Consulta calendario e pagine evento senza account |
| **Ballerino** | Utente registrato: acquista, gestisce biglietti, cerca partner, partecipa alla chat |
| **Organizzatore (Owner)** | Titolare dell'organizzazione: dati fiscali, incassi, staff, eventi |
| **Event Manager** | Costruisce e gestisce gli eventi assegnati |
| **Box Office** | Vende alla porta e incassa in loco |
| **Operatore Check-in** | Scansiona i QR all'ingresso |
| **Moderatore Wall** | Governa chat e proiezione durante l'evento |
| **Comunicazione** | Invia comunicazioni e gestisce codici promozionali |
| **Contabile** | Sola lettura su incassi e documenti |
| **Super Admin** | Amministratore della piattaforma: approva organizzatori, configura i cataloghi |
| **Supporto e Moderazione** | Assistenza e moderazione dei contenuti segnalati |
| **Amministrazione piattaforma** | Fee, riconciliazioni, report economici |

La matrice completa dei permessi, con le quattro decisioni ancora da limare, è in
`02-matrice-ruoli.md`.

---

## 5. Modello concettuale dei dati

### 5.1 Vista d'insieme

```
                        ┌──────────────────┐
                        │   TipoEvento     │  catalogo (Super Admin)
                        │  ·capacità       │  es. milonga, festival,
                        │  ·template       │      marathon, stage…
                        └────────┬─────────┘
                                 │ istanzia
┌───────────────┐       ┌────────▼─────────┐       ┌──────────────────┐
│ Organizzazione├──────►│     Evento       │──────►│    Location      │
│ ·dati fiscali │ 1   n │ ·stato ·locandina│  n  1 │ ·capienza ·mappa │
│ ·account PSP  │       │ ·policy rimborso │       └──────────────────┘
└───────┬───────┘       └───┬───┬───┬───┬──┘
        │ n                 │   │   │   │
┌───────▼───────┐       ┌───▼─┐ │ ┌─▼───────────────┐ ┌──────────────┐
│MembroOrg+Ruolo│       │Sess.│ │ │TitoloIngresso   │ │  CastEvento  │
└───────────────┘       │·sala│ │ │·prezzo ·include │ │ maestri, DJ  │
                        │·ora │ │ │·vincolo coppia  │ └──────────────┘
                        └──┬──┘ │ └────────┬────────┘
                           │    │          │
                  ┌────────▼────▼──────────▼────────┐
                  │        QuotaCapienza            │  modello unico:
                  │ dimensione × ruolo → limite     │  evento | sessione |
                  └─────────────────────────────────┘  titolo | servizio
                                 │
        ┌────────────────────────┼────────────────────────┐
┌───────▼──────────┐   ┌─────────▼────────┐   ┌───────────▼──────────┐
│RequisitoEvento   │   │ServizioAccessorio│   │  PolicyRimborso      │
│·tipo ·blocco     │   │·prezzo ·attributi│   │  ·scaglioni          │
│·verifica         │   │·cut-off          │   │  ·termine trasferim. │
└──────────────────┘   └──────────────────┘   └──────────────────────┘

┌──────────┐    ┌──────────┐    ┌────────────┐    ┌──────────────┐
│  Utente  ├───►│  Ordine  ├───►│ RigaOrdine ├───►│  Biglietto   │
│ ·ruolo   │ 1 n│ ·totale  │ 1 n│ ·titolo    │ 1 1│ ·QR ·titolare│
│  ballo   │    │ ·fee     │    │ ·servizio  │    │ ·stato       │
│ ·piano   │    │ ·stato   │    └────────────┘    └───┬──────┬───┘
└────┬─────┘    └────┬─────┘                          │      │
     │               │ 1                      ┌───────▼──┐ ┌─▼──────────┐
     │          ┌────▼─────┐                  │Trasferim.│ │ CheckIn    │
     │          │Pagamento │ multi-PSP        │·da ·a    │ │ ·operatore │
     │          │·psp ·rif │                  └──────────┘ │ ·offline   │
     │          └────┬─────┘                               └────────────┘
     │               │
     │          ┌────▼──────────┐    ┌──────────────┐
     │          │RichiestaRimb. │    │ Iscrizione   │◄── una per persona
     │          │·scaglione     │    │ ·ruolo ballo │    nell'evento
     │          └───────────────┘    │ ·esiti req.  │
     │                               │ ·coppia      │
     │                               └──────┬───────┘
     │                                      │ 0..1
     │          ┌───────────────┐     ┌──────▼───────┐
     ├─────────►│AnnuncioPartner│     │   Coppia     │
     │          └───────────────┘     │ 2 iscrizioni │
     │                                └──────────────┘
     │
     │   ┌──────────────┐   ┌────────────────┐   ┌──────────────┐
     └──►│MessaggioChat ├──►│  CodaWall      ├──►│   Schermo    │
         │·testo ·foto  │   │ ·ordine ·pin   │   │ ·codice      │
         │·stato moder. │   │ ·in_proiezione │   │ ·heartbeat   │
         └──────────────┘   └────────────────┘   └──────────────┘

         ┌──────────┐   ┌──────────────┐
         │  Piano   ├──►│ Abbonamento  │  layer di entitlement,
         │ ·diritti │   │ ·stato ·rinn.│  progettato, spento in MVP
         └──────────┘   └──────────────┘
```

### 5.2 Le entità che meritano una spiegazione

**TipoEvento** — È il perno dell'estensibilità. Un tipo evento non è un'etichetta: dichiara
quali *capacità* l'evento espone (sessioni multiple sì/no, quote per ruolo sì/no, livelli
sì/no, cast sì/no, iscrizione a coppia sì/no) e porta un template di valori di default. Il
Super Admin può creare un nuovo tipo — "tango holiday", "campionato", "concerto" — senza
sviluppo, e gli organizzatori lo trovano disponibile alla creazione dell'evento. La
conseguenza per l'interfaccia è che il wizard di creazione evento è **generato dalle
capacità del tipo**, non disegnato caso per caso.

**QuotaCapienza** — Un solo modello per tutte le quote, perché la richiesta è che siano
interamente customizzabili. Una quota è una terna *(dimensione, ruolo opzionale, limite)*
dove la dimensione può essere l'evento, una sessione, un titolo d'ingresso o un servizio
accessorio. Esempi reali:

| Intenzione dell'organizzatore | Quote da configurare |
|---|---|
| Milonga da 120 persone, nessun vincolo di ruolo | evento → 120 |
| Encuentro da 100 posti, 50 leader e 50 follower | evento+leader → 50, evento+follower → 50 |
| Marathon con tolleranza: 60+60 ma si accetta uno sbilancio di 5 | evento+leader → 60, evento+follower → 60, tolleranza → 5 |
| Festival: 200 al pass completo, ma il workshop avanzato ha 30 coppie | titolo "full pass" → 200, sessione "avanzato"+leader → 30, +follower → 30 |
| Cena per 80 persone | servizio "cena" → 80 |

La regola di ammissione è la congiunzione: **un acquisto è possibile solo se tutte le quote
limitanti coinvolte hanno capienza residua**, e solo se supera il cancello di tolleranza sullo
sbilancio dei ruoli.

Due qualificatori completano il modello:

- **`limitante`** — una quota può contare i posti senza bloccare la vendita. Serve alle
  sessioni incluse in un pass dove non esiste un posto assegnato: una milonga del festival non
  deve rendere invendibile il Full Pass, un workshop con 25 coppie effettive sì. Le quote di
  capienza della sala e di ruolo dell'evento sono sempre limitanti e il flag non è modificabile.
- **`tolleranza_sbilancio`** — non estende il limite, restringe dinamicamente l'accesso al ruolo
  sovrarappresentato: un'iscrizione nel ruolo X passa se `iscritti(X) − iscritti(Y) ≤ tolleranza`.
  Ne deriva una proprietà utile: una coppia aggiunge un'unità per parte, non altera lo
  sbilancio e supera quindi sempre il cancello. È il motivo per cui gli encuentros aprono
  prima le iscrizioni a coppie.

Struttura dei dati, algoritmi di risoluzione e impegno atomico, regole di rilascio, invarianti
e casistica di test sono specificati nell'allegato **`05-modello-capienza.md`**.

**RequisitoEvento** — Istanza, sull'evento, di un tipo di requisito preso dal catalogo. Il
catalogo dei tipi è governato dal Super Admin e comprende almeno: *tessera associativa
valida*, *documento con scadenza* (certificato medico e simili), *dichiarazione da
accettare*, *upload di file*, *campo informativo custom*. Per ogni requisito l'organizzatore
sceglie: obbligatorio o facoltativo · quando blocca (impedisce l'acquisto oppure impedisce
l'ingresso) · come si verifica (automatica o approvazione manuale) · entro quando va
soddisfatto. È questa la struttura che risponde alla richiesta "il manager inserisce gli
adempimenti che servono per quel determinato evento".

**ServizioAccessorio** — Istanza, sull'evento, di un tipo di servizio preso dal catalogo:
lezione privata durante l'evento, pasto, posto letto, transfer, merchandising, servizio
fotografico. Ogni tipo dichiara quali attributi raccogliere all'acquisto (taglia, preferenza
alimentare, slot orario, note) e ogni istanza ha prezzo, quota di capienza e cut-off di
rimborso propri.

Due voci del catalogo vanno distinte da funzioni omonime della roadmap, perché la
sovrapposizione dei nomi ha già generato un'apparente contraddizione:

| Servizio del primo rilascio | Funzione diversa, rinviata |
|---|---|
| **Posto letto** — inventario noto in convenzione con una struttura: N posti, un prezzo, una quota, un cut-off. È identico a una cena | **Gestione dell'ospitalità** (fase 3) — matching tra ballerini, chi offre un divano e chi cerca dove dormire. Ha il profilo di rischio della ricerca partner, non quello di un servizio |
| **Lezione privata** — slot orari predisposti dall'organizzatore e venduti come qualunque accessorio; il maestro non ha accesso alla piattaforma | **Prenotazione sul calendario del maestro** (fase 2) — disponibilità reali, conferma, politica di cancellazione, e il ruolo Maestro con login |

**Iscrizione** — Distinta dal Biglietto per una ragione precisa: il biglietto è un titolo
economico trasferibile, l'iscrizione è la **presenza di una persona in un evento** con il suo
ruolo di ballo, i suoi esiti dei requisiti e il suo check-in. Quando un biglietto viene
trasferito, l'iscrizione cambia titolare e i requisiti vanno rivalutati sul nuovo
partecipante: senza questa separazione il trasferimento aprirebbe un buco nei controlli.

**Cardinalità dichiarata: una Iscrizione per persona per evento, con più Biglietti collegati.**
Chi acquista un pass e in aggiunta un ingresso singolo ha due biglietti e una sola iscrizione.
Ne consegue che i consumi di capienza, i requisiti, il ruolo di ballo e le presenze sono
ancorati all'iscrizione, mentre il valore economico e la trasferibilità stanno sul biglietto.

**Piano e Abbonamento** — Presenti nel modello dal primo giorno, inattivi. Un Piano è un
insieme di diritti (`chat_evento`, e in prospettiva altri); un Abbonamento lega un utente a
un piano con stato e data di rinnovo. Ogni funzionalità premium interroga un unico servizio
di verifica dei diritti che, con l'interruttore spento, risponde sempre affermativamente.

---

## 6. Requisiti funzionali

Codifica: **RF-<area>-<n>**. Priorità: **M** = primo rilascio, **2** = fase 2, **3** = fase 3.

### 6.1 Account e identità (ACC)

| ID | Requisito | Pr. |
|---|---|---|
| RF-ACC-1 | Registrazione con email e password, oppure accesso con Google/Apple, con verifica dell'indirizzo email | M |
| RF-ACC-2 | Accesso senza password tramite link via email (utile in sala, dove nessuno ricorda le password) | M |
| RF-ACC-3 | Il profilo raccoglie: nome, cognome, nickname, email, telefono, città, **ruolo di ballo preferito** (leader / follower / entrambi), lingua, foto opzionale | M |
| RF-ACC-4 | Il ruolo di ballo del profilo è un default sovrascrivibile per singola iscrizione | M |
| RF-ACC-5 | Il nickname è il solo dato mostrato in chat e sulla wall: nome e cognome non sono mai proiettati | M |
| RF-ACC-6 | Autenticazione a due fattori, obbligatoria per Super Admin e Owner, opzionale per gli altri | M |
| RF-ACC-7 | Esportazione e cancellazione dell'account su richiesta dell'utente, con conservazione dei soli dati contabili obbligatori in forma pseudonimizzata | M |
| RF-ACC-8 | Un utente può appartenere a più organizzazioni con ruoli diversi e passare da un contesto all'altro | M |
| RF-ACC-9 | Il **nickname è soggetto a filtro automatico** alla creazione e a ogni modifica, ed è modificabile un numero limitato di volte nell'arco di un periodo: è l'unico dato dell'autore che finisce proiettato su un maxischermo | M |
| RF-ACC-10 | **Età minima per l'account: 14 anni compiuti**, con dichiarazione dell'età alla registrazione e conseguenze dichiarate in caso di dichiarazione mendace | M |
| RF-ACC-11 | Sotto i 14 anni **non esiste account**: il minore partecipa come iscritto senza account, inserito nell'ordine da un adulto che **dichiara di esercitare la responsabilità genitoriale** o di esserne delegato. Il biglietto è nominale ed è gestito dall'adulto, che ne esercita anche i diritti | M |
| RF-ACC-12 | L'accesso in scrittura alla chat di evento è **riservato ai maggiorenni**; lo stesso vincolo si applica alla ricerca partner di fase 2 | M |

### 6.2 Onboarding dell'organizzatore (ORG)

| ID | Requisito | Pr. |
|---|---|---|
| RF-ORG-1 | Chiunque può inviare una richiesta di attivazione come organizzatore: denominazione, forma giuridica, partita IVA o codice fiscale, sede, referente, tipologia di eventi, sito o pagina social di riferimento | M |
| RF-ORG-2 | La richiesta entra in una coda di approvazione del Super Admin, con esiti: approvata, rifiutata con motivazione, sospesa in attesa di chiarimenti | M |
| RF-ORG-3 | Fino all'approvazione l'organizzazione può preparare eventi in bozza ma non pubblicarli | M |
| RF-ORG-4 | Notifica dell'esito via email; in caso di rifiuto è possibile integrare e ripresentare | M |
| RF-ORG-5 | Prima della prima pubblicazione l'Owner deve collegare almeno un account di incasso e accettare le condizioni di servizio con versione e data | M |
| RF-ORG-6 | Il Super Admin può sospendere un'organizzazione: gli eventi futuri vengono depubblicati, quelli con biglietti già venduti restano accessibili per la gestione e i rimborsi | M |
| RF-ORG-7 | L'Owner invita membri via email assegnando uno o più ruoli, per organizzazione o per singolo evento | M |
| RF-ORG-8 | In fase di registrazione l'organizzatore **dichiara il proprio inquadramento fiscale** e, per ciascun evento pubblicato, **attesta di adempiere agli obblighi di emissione che gli competono**. La dichiarazione è versionata, datata e tracciata, e le condizioni di servizio la richiamano | M |
| RF-ORG-9 | La piattaforma mette a disposizione all'organizzatore l'esportazione completa delle vendite in forma utilizzabile per i propri adempimenti, senza sostituirsi a essi | M |
| RF-ORG-10 | La piattaforma verifica presso il prestatore lo **stato di abilitazione all'incasso**, non il solo collegamento dell'account. La prima pubblicazione richiede l'abilitazione piena | M |
| RF-ORG-11 | **Controllo periodico** dello stato di abilitazione. Alla sua decadenza: sospensione della pubblicazione di nuovi eventi e della vendita su quelli già pubblicati, con avviso all'Owner che indica quale adempimento manca presso il prestatore. **I biglietti emessi restano validi e i rimborsi restano eseguibili** | M |
| RF-ORG-12 | **Cruscotto dello stato di incasso** in evidenza nell'area dell'organizzazione, con gli eventuali fondi in attesa di trasferimento presso il prestatore e le azioni richieste | M |
| RF-ORG-13 | Le **condizioni di servizio per l'organizzatore** dichiarano che la penale applicata dal prestatore su ogni contestazione di addebito è **a suo carico**, e la addebitano sul primo regolamento utile. La dichiarazione è versionata come tutte le altre | M |

### 6.3 Creazione e configurazione dell'evento (EVT)

| ID | Requisito | Pr. |
|---|---|---|
| RF-EVT-1 | La creazione è un percorso guidato le cui sezioni dipendono dalle capacità del tipo di evento scelto | M |
| RF-EVT-2 | Dati di base: titolo, tipo, descrizione, data e ora di inizio e fine, location, lingua dei contenuti, tag di ricerca | M |
| RF-EVT-3 | **Upload della locandina** con ritaglio guidato per i tre formati necessari: verticale per la scheda, orizzontale per la copertina, quadrato per la condivisione. Nessun'altra personalizzazione grafica | M |
| RF-EVT-4 | Location scelta da anagrafica riutilizzabile o creata al volo: nome, indirizzo, coordinate, capienza, note su pavimento, climatizzazione, parcheggio, accessibilità | M |
| RF-EVT-5 | Eventi articolati in **sessioni** (workshop, milonghe, spettacoli) con orario, sala, livello, cast, capienza e quote proprie | M |
| RF-EVT-6 | Cast dell'evento: maestri, DJ, orchestre, come anagrafica riutilizzabile senza account | M |
| RF-EVT-7 | Definizione dei **titoli d'ingresso**: nome, descrizione, prezzo, sessioni incluse, finestra di vendita, visibilità (pubblico o riservato con codice), vincolo di ruolo, vincolo di acquisto a coppia, quantità minima e massima per ordine | M |
| RF-EVT-23 | Le **sessioni incluse in un titolo sono un elenco esplicito**, non una regola. In fase di composizione l'organizzatore dispone di selettori rapidi (tutti i workshop, tutto il sabato, tutte le milonghe) che producono comunque un elenco modificabile | M |
| RF-EVT-24 | Aggiungere una sessione a evento pubblicato **non la aggiunge ai titoli già venduti**: il sistema segnala la sessione orfana e chiede cosa farne, distinguendo i titoli invenduti da quelli già acquistati. Su questi ultimi l'aggiunta è ammessa solo come miglioria, mai come sottrazione | M |
| RF-EVT-25 | **Scaglioni di prezzo facoltativi**, definiti dall'organizzatore in fase di creazione: a data, a quantità venduta, o combinati. Il comportamento predefinito è il **prezzo unico che non cambia mai**, e chi non attiva la funzione non la incontra | M |
| RF-EVT-26 | Lo scaglione attivo e il criterio con cui scade sono sempre visibili al partecipante, con dati reali: "120 € fino al 31 gennaio" oppure "120 €, restano 8 posti a questo prezzo" | M |
| RF-EVT-27 | Il prezzo si blocca **alla creazione dell'ordine**: chi entra in checkout con lo scaglione disponibile non se lo vede cambiare durante i quindici minuti di prenotazione, anche se nel frattempo lo scaglione si esaurisce | M |
| RF-EVT-28 | Unità di vendita del titolo: **per persona** oppure **per coppia** (un prezzo, due posti, due iscrizioni con ruoli complementari). Il titolo a coppia non è acquistabile da solo, e la scheda evento lo dichiara | M |
| RF-EVT-29 | Titoli che **non consumano quote di ruolo**, per accompagnatori non ballerini e per il pubblico dello spettacolo | M |
| RF-EVT-30 | Modelli di titoli precompilati per tipologia di evento, così che l'organizzatore non parta da un foglio bianco | M |
| RF-EVT-8 | Titolo a composizione libera: "scegli N sessioni tra quelle disponibili" con prezzo del pacchetto | 2 |
| RF-EVT-31 | Upgrade di titolo con versamento della differenza, decadenza del biglietto precedente ed emissione del nuovo | 2 |
| RF-EVT-9 | Definizione delle **quote di capienza** su qualunque dimensione, con eventuale tolleranza di sbilancio tra ruoli | M |
| RF-EVT-20 | Ogni quota di sessione è dichiarabile **limitante** o **non limitante**: la prima blocca la vendita dei titoli che includono la sessione, la seconda conta i posti senza impedire l'acquisto. Le quote di capienza della sala e di ruolo dell'evento sono sempre limitanti | M |
| RF-EVT-21 | Se l'organizzatore include in un titolo una sessione limitante già satura, il sistema lo segnala e propone tre alternative: aumentare la quota, dichiarare la sessione non limitante, oppure pubblicare una variante di titolo che non la include | M |
| RF-EVT-22 | Le quote riservate agli **accrediti** sono distinte dall'inventario in vendita: consumano capienza di sala e quote di ruolo, non quelle di titolo | M |
| RF-EVT-32 | **Contingente riservato ai canali esterni**: l'organizzatore può sottrarre alla vendita online una parte della capienza, destinata alla propria biglietteria o ad altri canali. Non è acquistabile in piattaforma e non compare nella disponibilità pubblica | M |
| RF-EVT-33 | L'organizzatore può **aggiornare in qualunque momento il totale dei posti e la disponibilità residua**, anche portandola sotto il venduto. L'unico effetto è la chiusura della vendita online: **nessun biglietto già emesso viene mai invalidato** | M |
| RF-EVT-34 | In fase di creazione l'organizzatore sceglie se **gestire o no i biglietti venduti fuori piattaforma**. Se sceglie di no, i contatori riflettono le sole vendite online e l'interfaccia lo dichiara apertamente, così che nessuno legga quei numeri come il quadro completo | M |
| RF-EVT-10 | Selezione dei **requisiti di partecipazione** dal catalogo, con parametri per requisito | M |
| RF-EVT-11 | Selezione dei **servizi accessori** dal catalogo, con prezzo, quota e cut-off per servizio | M |
| RF-EVT-12 | Scelta della **policy di rimborso** tra i preset di piattaforma, con possibilità di renderla più favorevole al partecipante | M |
| RF-EVT-13 | Configurazione del modulo chat e wall: attivazione, layout, durate di proiezione, moderatori, testo della schermata di attesa | M |
| RF-EVT-14 | Anteprima della scheda evento come la vedrà il pubblico, prima della pubblicazione | M |
| RF-EVT-15 | Ciclo di vita: `bozza` → `pubblicato` → `vendita_chiusa` → `in_corso` → `concluso` → `archiviato`, più `annullato` da qualunque stato pubblicato. **Nessuna moderazione del singolo evento**: il controllo della piattaforma avviene una volta sola, all'approvazione dell'organizzazione | M |
| RF-EVT-16 | Duplicazione di un evento come base per una nuova edizione, con azzeramento di vendite e iscrizioni | M |
| RF-EVT-17 | Eventi ricorrenti come serie generata da una regola (es. ogni giovedì), con singole occorrenze modificabili o annullabili | M |
| RF-EVT-18 | Registro delle modifiche su evento pubblicato, con autore e momento, consultabile da Owner e Super Admin | M |
| RF-EVT-19 | Modifiche sostanziali a evento pubblicato (data, location, cast principale) richiedono conferma esplicita e generano comunicazione automatica agli acquirenti, con diritto di rimborso integrale | M |
| RF-EVT-35 | **Annullamento di una singola sessione** su evento che si svolge regolarmente, con motivazione, comunicazione ai soli titolari di titoli che la includono, e rilascio delle quote della sessione | M |
| RF-EVT-36 | Ogni sessione porta un **peso di ripartizione** che determina la quota di prezzo a essa attribuibile dentro un titolo multi-sessione. Default uniforme sul numero di sessioni incluse; pesi diversi assegnabili dall'organizzatore in fase di creazione. Lo stesso peso è la struttura che consente, se la verifica fiscale lo richiedesse, di scomporre un pass misto tra componente didattica e componente danzante | M |
| RF-EVT-37 | I **servizi accessori legati alla sessione annullata** — la lezione privata in quello slot, il pasto di quella giornata — seguono la sessione e sono rimborsati integralmente | M |
| RF-EVT-38 | L'organizzatore **dichiara sull'evento se ammette minori** e a quali condizioni: accompagnamento obbligatorio, fasce orarie, sessioni consentite. Il default è che l'evento non ammette minori non accompagnati, e la scheda evento lo espone | M |
| RF-EVT-39 | Se il modulo chat è attivo su un evento **per cui non è previsto il check-in**, la configurazione lo segnala e propone l'attivazione dello sblocco di sala (RF-CHK-16). Un modulo che non si sbloccherà mai non si pubblica in silenzio | M |
| RF-EVT-40 | Il passaggio a `vendita_chiusa` avviene per il **primo dei criteri configurati che si verifica**: data e ora dichiarate · esaurimento di tutte le quote limitanti · decisione manuale dell'organizzatore · inizio dell'evento, criterio sempre attivo come ultimo. La **riapertura manuale** è possibile finché l'evento non è iniziato e la capienza lo consente | M |
| RF-EVT-41 | `vendita_chiusa` chiude la **sola vendita online**: vendita alla porta ed emissione manuale di pass restano possibili, coerentemente con RB20 | M |

### 6.4 Pubblicazione e ricerca (PUB)

| ID | Requisito | Pr. |
|---|---|---|
| RF-PUB-1 | Calendario pubblico con vista elenco e vista mensile | M |
| RF-PUB-2 | Filtri: città e raggio, periodo, tipo di evento, livello, fascia di prezzo, maestro o DJ, disponibilità per il proprio ruolo di ballo | M |
| RF-PUB-3 | Ricerca testuale su titolo, descrizione, cast, location | M |
| RF-PUB-4 | Vista mappa degli eventi | M |
| RF-PUB-5 | Scheda evento con locandina, programma per sessioni, cast, location con mappa, titoli disponibili con **disponibilità per ruolo**, requisiti richiesti, servizi accessori, policy di rimborso, organizzatore | M |
| RF-PUB-6 | URL leggibile e stabile, immagine di condivisione, dati strutturati `schema.org/Event` per l'indicizzazione | M |
| RF-PUB-7 | Aggiunta al calendario personale (iCal, Google) | M |
| RF-PUB-8 | Indicatore di scarsità calcolato sulla **disponibilità residua alla vendita online**, mai su un valore inventato. Poiché l'organizzatore può vendere anche altrove, l'indicatore è onesto rispetto a ciò che la piattaforma sa, e non promette ciò che non può sapere | M |
| RF-PUB-9 | Interfaccia in italiano e inglese; i contenuti dell'organizzatore possono avere una seconda versione linguistica opzionale | M |
| RF-PUB-10 | La seconda lingua opzionale copre **tutti i testi redatti dall'organizzatore che compaiono in un percorso di acquisto o di adempimento**: nomi e descrizioni dei titoli e delle sessioni, nomi e testi dei requisiti e delle dichiarazioni da accettare, descrizioni dei servizi accessori, testo della policy di rimborso, contenuti di servizio della wall. In assenza della traduzione si mostra il testo originale **con l'indicazione della lingua**, mai una stringa vuota | M |
| RF-PUB-11 | Il back-office segnala all'organizzatore **quali testi obbligatori non sono ancora tradotti** quando l'evento dichiara una seconda lingua, prima della pubblicazione | M |

### 6.5 Carrello, checkout, pagamento (PAY)

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAY-1 | Carrello con più titoli, più servizi accessori e più partecipanti, anche su eventi di **organizzatori diversi**, con la suddivisione prevista da RF-PAY-34 | M |
| RF-PAY-2 | **Prenotazione temporanea con conto alla rovescia di 15 minuti**, come nei ticketing generalisti: all'avvio dell'ordine i posti selezionati sono bloccati per la finestra che l'utente usa per inserire i dati e pagare. La sola navigazione del catalogo non blocca nulla. La durata è un parametro di piattaforma, non una scelta dell'organizzatore | M |
| RF-PAY-25 | La prenotazione è **sempre attiva**, su qualunque evento e indipendentemente dalla disponibilità residua: comportamento uniforme, prevedibile e identico a quello che l'utente conosce dagli altri siti di biglietteria | M |
| RF-PAY-26 | **Sovrapposizione tra titoli**: se una sessione è già inclusa in un titolo posseduto, il sistema lo segnala con precisione ma non blocca l'acquisto. La quota di quella sessione non viene però consumata due volte per la stessa persona | M |
| RF-PAY-20 | Il conto alla rovescia è **sempre visibile** durante l'ordine, con avviso quando mancano pochi minuti | M |
| RF-PAY-21 | Alla scadenza la prenotazione decade, i posti tornano disponibili e l'utente è riportato al carrello con un messaggio esplicito: nessun addebito, nessun ordine parziale | M |
| RF-PAY-22 | La prenotazione è **riarmata all'avvio del pagamento** ad almeno 10 minuti residui, per coprire il tempo di reindirizzamento verso il prestatore: con PayPal e Satispay l'utente esce dall'applicazione e non deve trovare il posto perduto al rientro | M |
| RF-PAY-23 | Una sola prenotazione attiva per utente e per evento: non è possibile accumulare blocchi su più ordini in parallelo | M |
| RF-PAY-24 | Rilascio immediato in caso di abbandono esplicito dell'ordine, e processo di recupero automatico delle prenotazioni scadute che non siano state rilasciate | M |
| RF-PAY-3 | Per ogni partecipante nell'ordine si raccolgono nome, cognome, email, **ruolo di ballo** e gli attributi richiesti dai servizi acquistati | M |
| RF-PAY-4 | Verifica dei requisiti bloccanti in acquisto prima di procedere al pagamento | M |
| RF-PAY-5 | Codici promozionali: importo o percentuale, validità temporale, limite di utilizzi totali e per utente, applicabilità a titoli specifici | M |
| RF-PAY-6 | Riepilogo con prezzi dell'organizzatore, sconti, **diritti di prevendita della piattaforma esposti come voce separata**, totale | M |
| RF-PAY-7 | Pagamento con **Stripe** (carta, Apple Pay, Google Pay), **PayPal**, **Satispay** | M |
| RF-PAY-8 | **Impegno atomico della capienza all'avvio dell'ordine**, con rilascio automatico alla scadenza della prenotazione, al fallimento del pagamento o all'abbandono | M |
| RF-PAY-9 | Sulle quote commerciali è ammessa una **tolleranza di sforamento** configurabile: l'ordine è accettato anche appena oltre il limite e non genera rimborsi automatici. La capienza della sala resta un blocco assoluto | M |
| RF-PAY-19 | Rimborso automatico integrale nel caso residuo di incasso riuscito oltre la capienza assoluta della sala | 2 |
| RF-PAY-10 | Gestione idempotente delle notifiche dei PSP: nessun ordine duplicato in caso di doppia notifica o di ritorno tardivo dell'utente | M |
| RF-PAY-11 | Gli ordini in stato `in_attesa_di_pagamento` scadono dopo il tempo tecnico e **rilasciano immediatamente la capienza impegnata** | M |
| RF-PAY-12 | Emissione della ricevuta all'acquirente e della documentazione della fee all'organizzatore | M |
| RF-PAY-13 | Storico ordini con dettaglio, ricevute e biglietti scaricabili | M |
| RF-PAY-15 | **Disponibilità parziale**: se in fase di pagamento risultano esaurite soltanto quote di servizi accessori, l'ordine non viene rifiutato. Il sistema segnala le righe indisponibili, propone di rimuoverle, ricalcola il totale e richiede una conferma esplicita prima di procedere | M |
| RF-PAY-16 | Se risulta esaurita una quota di evento, di titolo o di sessione limitante, l'ordine è rifiutato con l'indicazione precisa di cosa manca: nel caso della sessione vengono nominati la sessione e il ruolo, e vengono proposti i titoli alternativi disponibili | M |
| RF-PAY-17 | I due motivi di rifiuto sono distinti nei messaggi: **esaurito** (limite assoluto, situazione definitiva) e **ruolo in attesa** (blocco temporaneo per sbilancio, con invito all'iscrizione a coppia o alla bacheca cerco-partner) | M |
| RF-PAY-14 | Bonifico bancario come metodo con conferma manuale dell'incasso | 2 |
| RF-PAY-33 | Chi acquista per altri fornisce i **soli dati necessari all'emissione del titolo**: nome, cognome, email e ruolo di ballo. Nessun altro attributo del terzo è raccolto dall'acquirente, compresi quelli richiesti dai servizi accessori, che sono chiesti direttamente all'interessato | M |
| RF-PAY-34 | Il carrello con eventi di **organizzatori diversi si suddivide in un ordine per organizzatore**, con pagamenti separati e sequenziali. La suddivisione è dichiarata prima del pagamento, con l'importo di ciascun ordine | M |
| RF-PAY-35 | I **diritti di prevendita si calcolano per biglietto**, non per ordine: la suddivisione del carrello non modifica il totale complessivo pagato dal partecipante | M |
| RF-PAY-36 | Ogni sotto-ordine ha la **propria prenotazione temporanea**, avviata contestualmente; il conto alla rovescia mostrato è il più stringente. L'abbandono dopo il primo pagamento rilascia le prenotazioni residue e **non annulla ciò che è già stato pagato** | M |
| RF-PAY-37 | Riepilogo finale e area personale presentano i sotto-ordini come **un solo acquisto**, con il dettaglio per organizzatore e ricevute distinte | M |

**Contestazioni di addebito.** Il modello di incasso diretto crea un'asimmetria: la contestazione
colpisce il conto dell'organizzatore, ma le prove sono tutte in piattaforma. Un organizzatore
lasciato solo davanti a una richiesta di prova la perde per omessa risposta, non perché avesse
torto. La piattaforma prende quindi in carico l'intero ciclo per suo conto.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAY-27 | Registrazione delle **contestazioni di addebito** notificate dal prestatore, con stato, importo conteso, motivo dichiarato e termine di risposta, visibili all'organizzatore e all'amministrazione di piattaforma | M |
| RF-PAY-28 | **Costituzione automatica del fascicolo di prova** alla ricezione: ordine e righe, biglietto emesso, momento e indirizzo di rete dell'accettazione delle condizioni, versione della policy di rimborso vigente all'acquisto, storico dei trasferimenti, orario e postazione di check-in, comunicazioni recapitate. Trasmissione al prestatore entro il termine, con sollecito all'organizzatore se serve un suo contributo | M |
| RF-PAY-29 | **Esito**: se la contestazione è accolta, il biglietto è invalidato, l'iscrizione decade e le quote sono rilasciate con lo stesso meccanismo del rimborso; se è respinta, nulla cambia. In entrambi i casi le parti sono notificate | M |
| RF-PAY-30 | I **diritti di prevendita seguono la sorte della transazione contestata**: una contestazione accolta ne produce lo storno a carico della piattaforma, coerentemente con il funzionamento dell'incasso diretto | M |
| RF-PAY-31 | Monitoraggio del **tasso di contestazione per organizzazione** | M |
| RF-PAY-38 | Il monitoraggio opera su **due soglie**: una di **attenzione**, più bassa, che genera un avviso all'Owner con l'indicazione delle cause ricorrenti mentre c'è ancora tempo per correggere; una di **sospensione**, allineata a quella del prestatore, che porta la questione al Super Admin | M |
| RF-PAY-32 | La conferma d'ordine e l'area personale espongono in evidenza **come chiedere un rimborso e come raggiungere l'organizzatore**: è la misura che riduce le contestazioni alla radice, perché la maggior parte nasce da chi non ha trovato il percorso corretto | M |

**I diritti di prevendita.** Il modello è quello dei ticketing generalisti italiani: il prezzo
del titolo è dell'organizzatore, i **diritti di prevendita sono ricavo della piattaforma**,
pagati dal partecipante ed esposti come voce separata in checkout. Non transitano
dall'organizzatore in nessuna forma: la piattaforma li incassa direttamente e ne emette il
proprio documento fiscale verso il partecipante, come prestazione di servizio di
intermediazione soggetta a IVA ordinaria. L'organizzatore resta responsabile dell'evento e
del titolo d'accesso.

**Vincolo tecnico residuo, da chiudere prima dello sviluppo del checkout.** Perché i diritti di
prevendita raggiungano la piattaforma in un pagamento unico, il prestatore di pagamento deve
supportare la ripartizione a favore del gestore della piattaforma:

| Metodo | Supporto alla ripartizione | Conseguenza |
|---|---|---|
| Carta, Apple Pay, Google Pay via Stripe Connect | Nativo | Nessun problema: la quota di piattaforma è trattenuta sulla transazione |
| PayPal | Esiste un prodotto per piattaforme con commissione, subordinato a un accordo di partner | Da attivare formalmente, con tempi di approvazione da mettere in piano |
| Satispay | **Da verificare**: non risulta un prodotto di ripartizione equivalente | Se non esiste, due strade: rinviare il metodo, oppure limitatamente a Satispay far incassare la piattaforma e girare il netto all'organizzatore — con le implicazioni che comporta la detenzione di fondi di terzi |

Nessuna delle tre righe rimette in discussione la decisione: cambia solo quali metodi si
possono aprire al lancio e con quale sequenza.

### 6.6 Requisiti di partecipazione (REQ)

| ID | Requisito | Pr. |
|---|---|---|
| RF-REQ-1 | Al partecipante è mostrato, in scheda evento e in checkout, l'elenco dei requisiti con la relativa scadenza | M |
| RF-REQ-2 | **Il tesseramento avviene fuori dalla piattaforma.** Non esistono anagrafica delle tessere, vendita della quota associativa né verifica automatica di validità. L'organizzatore che deve accertarlo usa il requisito *dichiarazione*: il partecipante dichiara di essere in regola, e la piattaforma non tratta alcun dato associativo | M |
| RF-REQ-3 | **Nessun trattamento di dati sanitari.** Il certificato medico non è raccolto né caricato: dove serve, si usa la dichiarazione di possesso, che lascia la responsabilità a chi dichiara | M |
| RF-REQ-11 | Requisito *upload di documento con scadenza*, per finalità diverse da quelle sanitarie | 2 |
| RF-REQ-4 | Requisito *dichiarazione*: testo definito dall'organizzatore con accettazione tracciata (momento, versione, indirizzo di rete) | M |
| RF-REQ-5 | Requisito *campo custom*: domanda a risposta libera, a scelta singola o multipla | M |
| RF-REQ-6 | Ogni requisito ha uno stato per iscrizione: `da_fornire`, `in_verifica`, `valido`, `rifiutato`, `scaduto` | M |
| RF-REQ-7 | I requisiti dichiarati bloccanti in ingresso impediscono il check-in e l'operatore vede il motivo | M |
| RF-REQ-8 | Solleciti automatici sui requisiti mancanti a intervalli configurabili prima dell'evento | M |
| RF-REQ-9 | Lo staff operativo vede **l'esito** del requisito; l'accesso a un eventuale documento è riservato ai ruoli autorizzati e tracciato in audit log | 2 |
| RF-REQ-10 | I documenti sono conservati per il tempo strettamente necessario e cancellati automaticamente dopo un periodo configurato dalla chiusura dell'evento | 2 |

### 6.7 Biglietto, QR, trasferimento (TCK)

| ID | Requisito | Pr. |
|---|---|---|
| RF-TCK-1 | Biglietto nominale con codice QR firmato, non deducibile e verificabile offline | M |
| RF-TCK-2 | Consegna via email in PDF e disponibilità nell'area personale; nessuna dipendenza dalla stampa | M |
| RF-TCK-3 | Il PDF riporta evento, data, location, titolo, nominativo, **ruolo di ballo**, sessioni incluse, servizi acquistati, QR | M |
| RF-TCK-4 | Stati del biglietto: `valido`, `trasferito`, `annullato`, `rimborsato`. L'utilizzo **non è uno stato del biglietto** ma un check-in registrato sulla coppia biglietto-sessione; per gli eventi senza sessioni si usa una sessione implicita, così il modello resta unico. *Correzione provvisoria, da confermare nella sessione dedicata ai titoli e ai pass* | M |
| RF-TCK-5 | **Trasferimento del nominativo** a un altro ballerino tramite email o nickname, entro il termine configurato sull'evento | M |
| RF-TCK-6 | Il trasferimento invalida il QR precedente, ne emette uno nuovo, sposta l'iscrizione e **rivaluta i requisiti** sul nuovo titolare | M |
| RF-TCK-7 | Se il nuovo titolare ha un ruolo di ballo diverso, il trasferimento è consentito solo se le quote del nuovo ruolo lo permettono | M |
| RF-TCK-8 | Storico completo dei passaggi di titolarità, visibile all'organizzatore | M |
| RF-TCK-9 | La regolazione economica del trasferimento è tra i due ballerini, fuori dalla piattaforma; il sistema lo dichiara con chiarezza | M |
| RF-TCK-14 | **Emissione manuale di pass da parte dell'organizzatore**, in qualunque momento e quantità, **senza vincolo di capienza**: singolarmente con nominativo, oppure in blocco. Ogni pass porta un QR firmato e verificabile esattamente come quelli venduti online | M |
| RF-TCK-15 | All'emissione si indicano titolo, causale (accredito, vendita esterna, omaggio, cortesia) e — se l'evento usa quote per ruolo — il **ruolo di ballo**: senza quel dato l'equilibrio leader/follower mostrato all'organizzatore diventa falso proprio dove serve | M |
| RF-TCK-16 | I pass emessi manualmente sono scaricabili in PDF, stampabili e inviabili per email, e **revocabili singolarmente** con invalidazione del QR | M |
| RF-TCK-17 | Ogni emissione manuale è tracciata con autore, momento, quantità e causale | M |
| RF-TCK-18 | I pass emessi in blocco senza nominativo sono **al portatore**: non danno accesso alla chat, che richiede un account e un check-in nominale, e non consentono il trasferimento. Il sistema lo dichiara al momento dell'emissione | M |
| RF-TCK-11 | Il documento emesso dalla piattaforma è una **conferma d'ordine con QR di accesso**, non un titolo fiscale. Denominazione, testi e contenuto lo dichiarano esplicitamente: non compaiono numerazioni progressive, sigilli o diciture che possano farlo apparire tale | M |
| RF-TCK-12 | L'eventuale **titolo fiscale resta emesso dall'organizzatore** con i propri strumenti. La piattaforma può registrarne gli estremi sull'iscrizione, senza generarlo | M |
| RF-TCK-13 | L'emissione è **astratta dietro un'interfaccia** con due implementazioni previste: titolo interno con QR firmato, e delega a un emittente autorizzato. La seconda non è realizzata nel primo rilascio, ma l'interfaccia è definita perché l'aggiunta sia un'integrazione e non una riscrittura | M |
| RF-TCK-10 | Carte Apple Wallet e Google Wallet | 2 |

### 6.8 Ruolo di ballo e iscrizione a coppia (CPL)

| ID | Requisito | Pr. |
|---|---|---|
| RF-CPL-1 | Il ruolo di ballo è obbligatorio su ogni iscrizione a eventi con quote per ruolo | M |
| RF-CPL-2 | La disponibilità è mostrata per ruolo, con esaurimento indipendente | M |
| RF-CPL-3 | Chi balla entrambi i ruoli sceglie il ruolo con cui si iscrive; l'organizzatore può abilitare l'iscrizione "ruolo flessibile", assegnata alla quota meno affollata | M |
| RF-CPL-4 | **Cancello di tolleranza**: un'iscrizione nel ruolo X è ammessa se `iscritti(X) − iscritti(Y) ≤ tolleranza`. Il ruolo in eccesso viene bloccato temporaneamente, con messaggio distinto dall'esaurimento e possibilità di sbloccarsi all'arrivo del ruolo mancante | M |
| RF-CPL-12 | La tolleranza è valutata sull'ordine intero e non riga per riga: è ciò che consente a una coppia di essere ammessa anche quando la singola iscrizione nello stesso ruolo verrebbe bloccata | M |
| RF-CPL-5 | L'organizzatore può **riallocare posti tra i ruoli** in qualunque momento, con effetto immediato sulla disponibilità | M |
| RF-CPL-6 | **Iscrizione a coppia**: unico ordine, unico pagamento, due iscrizioni legate con ruoli complementari. Chi acquista inserisce i dati del partner | M |
| RF-CPL-7 | L'acquisto a coppia consuma un posto per ciascuna quota di ruolo e va a buon fine solo se entrambe sono disponibili | M |
| RF-CPL-8 | Il partner riceve una notifica con il proprio biglietto e, se non ha un account, l'invito a crearlo per gestirlo | M |
| RF-CPL-9 | La coppia può essere sciolta: le due iscrizioni restano valide come individuali se l'evento lo consente, altrimenti si applica la regola dichiarata sull'evento | M |
| RF-CPL-10 | Rimborso per singolo componente della coppia, se l'evento non vincola la vendita a coppie intere | M |
| RF-CPL-11 | Vista di controllo per l'organizzatore: iscritti per ruolo, sbilancio corrente, coppie complete, andamento nel tempo | M |
| RF-CPL-13 | La persona iscritta da altri riceve una **richiesta di conferma** della propria partecipazione. Fino alla conferma l'iscrizione è in stato `da_confermare`: il biglietto è valido e **l'ingresso è consentito**, ma restano inattivi il profilo, le comunicazioni non essenziali e l'accesso alla chat | M |
| RF-CPL-14 | La persona iscritta da altri può **rifiutare**. Il rifiuto rende il biglietto privo di titolare e lo restituisce alla disponibilità dell'acquirente, che può trasferirlo o chiederne il rimborso secondo la policy dell'evento; i dati del terzo sono cancellati, con la sola traccia contabile obbligatoria | M |
| RF-CPL-15 | L'acquirente **attesta di essere autorizzato** a comunicare i dati delle persone che iscrive, e l'informativa dichiara la base giuridica del trattamento dei dati inseriti da terzi | M |
| RF-CPL-16 | **Sollecito automatico della conferma** a intervalli configurabili, e comunque prima dell'evento: un biglietto senza titolare scoperto la sera stessa non è più trasferibile | M |

### 6.9 Bacheca cerco-partner (PRT)

| ID | Requisito | Pr. |
|---|---|---|
| RF-PRT-1 | Un utente registrato pubblica un annuncio riferito a un evento con iscrizione a coppia: ruolo proprio, ruolo cercato, livello, anni di pratica, note, città di provenienza | M |
| RF-PRT-2 | La bacheca è consultabile dalla scheda dell'evento e filtrabile per ruolo cercato e livello | M |
| RF-PRT-3 | Il contatto avviene attraverso un messaggio interno all'annuncio: le email non sono mai esposte | M |
| RF-PRT-4 | L'autore chiude l'annuncio quando ha trovato il partner; gli annunci si chiudono da soli all'inizio dell'evento | M |
| RF-PRT-5 | Segnalazione di annunci e utenti inopportuni, con presa in carico da parte della moderazione di piattaforma | M |
| RF-PRT-6 | Se due utenti collegati da un annuncio completano insieme un'iscrizione a coppia, l'annuncio si chiude automaticamente | 2 |

> La bacheca è l'unica funzione a carattere relazionale del primo rilascio ed è un'eccezione
> consapevole al perimetro "solo ticketing", perché senza di essa gli stage a coppie
> escludono di fatto i ballerini singoli. Va però presidiata: è la superficie con il maggior
> rischio di uso improprio dell'intero prodotto, e richiede segnalazione, blocco utente e un
> codice di condotta pubblicato.

### 6.10 Check-in e box office (CHK)

| ID | Requisito | Pr. |
|---|---|---|
| RF-CHK-1 | Applicazione web mobile per la scansione del QR con la fotocamera, senza installazione | M |
| RF-CHK-2 | Prima dell'evento l'operatore **scarica la lista** dell'evento sul dispositivo | M |
| RF-CHK-3 | **Funzionamento senza connessione**: verifica della firma del QR e dell'appartenenza alla lista locale, registrazione dell'ingresso in coda locale, sincronizzazione automatica al ritorno della rete | M |
| RF-CHK-4 | Esiti di scansione distinti e inequivocabili: valido · già utilizzato **per questa sessione** (con ora e postazione del primo ingresso) · non valido per questo evento · rimborsato o annullato · requisito bloccante non soddisfatto (con indicazione del requisito) | M |
| RF-CHK-5 | La schermata di esito mostra nominativo, **ruolo di ballo**, titolo, sessioni incluse e servizi acquistati (es. cena, taglia t-shirt) | M |
| RF-CHK-6 | Più operatori in parallelo; i doppi ingressi rilevati in fase di sincronizzazione sono segnalati come conflitti da risolvere, non risolti in silenzio | M |
| RF-CHK-7 | Ricerca manuale per nome o email, con check-in senza scansione | M |
| RF-CHK-8 | Check-in per singola sessione negli eventi articolati | M |
| RF-CHK-9 | Annullamento di un check-in errato entro un tempo breve | M |
| RF-CHK-10 | **Vendita alla porta**: selezione del titolo, dati minimi del partecipante, ruolo di ballo, incasso in contanti o con POS esterno, emissione immediata del biglietto e check-in contestuale | M |
| RF-CHK-11 | La vendita alla porta rispetta le quote residue e registra l'incasso con il metodo dichiarato | M |
| RF-CHK-12 | Chiusura di cassa: totale incassato per metodo, per operatore, per titolo, con quadratura | M |
| RF-CHK-13 | Contatore presenze in tempo reale con soglia di capienza segnalata | M |
| RF-CHK-14 | Il check-in è l'evento che **abilita l'accesso alla chat** dell'evento. Dove il check-in non è previsto, la stessa funzione è svolta dallo sblocco di sala di RF-CHK-16 | M |
| RF-CHK-15 | **Ingresso di chi ha acquistato fuori dalla piattaforma**: registrazione rapida in lista con nome, ruolo di ballo e titolo, senza QR e senza incasso, così che i conteggi di presenza e l'equilibrio dei ruoli restino corretti anche sui partecipanti arrivati da altri canali | M |
| RF-CHK-16 | **Sblocco di sala**: il QR mostrato sulla schermata di cortesia della wall (RF-WALL-34) vale come check-in leggero **ai soli fini dell'accesso alla chat**. Registra un check-in di tipo `AUTO_SALA` previa verifica del possesso di un titolo valido per l'evento. Non sostituisce il controllo accessi e non entra nelle liste di presenza operative, che restano quelle registrate dagli operatori | M |
| RF-CHK-17 | Il codice contenuto nel QR di sala **ruota a intervalli brevi** e vale solo per l'intervallo corrente: una fotografia dello schermo condivisa fuori dalla sala non consente l'accesso. Il moderatore può rigenerarlo in qualunque momento | M |

### 6.11 Chat di evento e Live Wall (WALL)

Il modulo si articola su tre interfacce distinte: la **chat** per il partecipante, la
**console** per il moderatore, la **wall** proiettata in sala.

#### 6.11.1 Chat del partecipante

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-1 | La chat è un canale unico per evento, attivo da un'ora prima dell'inizio a un'ora dopo la fine (finestra configurabile) | M |
| RF-WALL-2 | **Condizioni di accesso in scrittura, congiunte**: biglietto valido · **presenza accertata**, per check-in all'ingresso o per sblocco di sala (RF-CHK-16) · piano premium attivo. Il vincolo del piano è implementato ma disattivato nel primo rilascio. Si aggiunge il vincolo di maggiore età di RF-ACC-12 | M |
| RF-WALL-3 | Chi ha un biglietto ma non ha ancora fatto il check-in vede la chat in sola lettura, con l'indicazione di come sbloccarla | M |
| RF-WALL-4 | Invio di messaggi di testo con limite di lunghezza e di emoji | M |
| RF-WALL-5 | Invio di **foto** dalla fotocamera o dalla galleria, con compressione lato client, correzione dell'orientamento e limite dimensionale | M |
| RF-WALL-6 | L'autore è identificato dal solo **nickname**, con ruolo di ballo opzionale | M |
| RF-WALL-7 | I messaggi appaiono immediatamente nella chat: **nessuna pre-moderazione** | M |
| RF-WALL-8 | Il partecipante vede quali dei suoi contenuti sono stati proiettati sulla wall | M |
| RF-WALL-9 | Limitazione di frequenza per utente (messaggi al minuto, foto totali per evento) e filtro automatico su linguaggio inappropriato | M |
| RF-WALL-10 | Segnalazione di un messaggio da parte di qualunque partecipante | M |
| RF-WALL-11 | Cancellazione di un proprio messaggio; se è in proiezione, viene rimosso anche dalla wall | M |
| RF-WALL-12 | Alla chiusura dell'evento la chat diventa di sola lettura e i contenuti sono cancellati dopo un periodo configurato | M |
| RF-WALL-43 | **Classificazione automatica di ogni immagine prima della pubblicazione in chat.** L'immagine sospetta è trattenuta e non compare a nessuno, in attesa della decisione di un moderatore; il flusso normale non subisce ritardi percepibili e la chat resta libera. All'autore è indicato che il contenuto è in verifica e non perduto | M |
| RF-WALL-44 | L'esito della classificazione è registrato e la coda dei contenuti trattenuti compare in console **con priorità su tutto il resto**. Se nessun moderatore decide, il contenuto **resta trattenuto**: il silenzio non pubblica | M |
| RF-WALL-50 | Il **consenso richiesto al primo invio** dichiara che i contenuti proiettati sono resi pubblici in sala e **possono essere conservati e riutilizzati dall'organizzatore**, che ne diventa titolare autonomo. Senza il consenso l'invio non è possibile | M |

#### 6.11.2 Console del moderatore

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-13 | Flusso dei messaggi in arrivo in tempo reale, con anteprima grande delle foto | M |
| RF-WALL-14 | Azioni su ogni contenuto: **approva per la wall** · **proietta subito** · rifiuta · rimuovi dalla chat · segnala l'autore | M |
| RF-WALL-15 | Coda di proiezione riordinabile per trascinamento, con possibilità di **fissare** un contenuto e di rimetterlo in coda | M |
| RF-WALL-16 | Pannello "in onda": cosa è attualmente proiettato, da quanti secondi, cosa segue | M |
| RF-WALL-17 | Comandi di regia: pausa della rotazione · avanti · indietro · **schermo di cortesia immediato** (il pulsante di emergenza per togliere qualunque contenuto dal maxischermo in un gesto) | M |
| RF-WALL-18 | Inserimento di **contenuti di servizio** creati dal moderatore: annuncio testuale, immagine, prossima tanda, ringraziamento agli sponsor | M |
| RF-WALL-19 | Scorciatoie da tastiera per approvare, rifiutare e proiettare: la moderazione avviene in tempo reale, il mouse è troppo lento | M |
| RF-WALL-20 | Annullamento dell'ultima azione | M |
| RF-WALL-21 | Più moderatori contemporanei, con visibilità di chi ha già preso in carico un contenuto per evitare doppie decisioni | M |
| RF-WALL-22 | Silenziamento o espulsione di un utente dalla chat dell'evento, con motivazione | M |
| RF-WALL-23 | Stato dello schermo collegato: online o offline, ultimo contatto, contenuto effettivamente in proiezione | M |
| RF-WALL-24 | Archivio dell'evento: i contenuti **effettivamente proiettati**, scaricabili in blocco dall'organizzatore a fine serata | M |
| RF-WALL-45 | Il moderatore può **oscurare o sostituire il nickname** mostrato sulla wall per un singolo contenuto, e segnalare l'utente perché il nickname sia cambiato d'ufficio dalla moderazione di piattaforma | M |
| RF-WALL-48 | **Contenuti di servizio programmabili in anticipo**, con orario o ricorrenza: annunci, ringraziamenti agli sponsor, avvisi logistici, chiusura della serata | M |
| RF-WALL-49 | **Segnalazione di assenza di presidio**: se la coda dei contenuti in attesa cresce e nessuna azione di moderazione avviene entro un tempo configurato, il sistema avvisa i moderatori designati sui loro dispositivi | M |
| RF-WALL-51 | L'esportazione di fine serata comprende i **soli contenuti effettivamente proiettati**. Un contenuto approvato e mai andato in onda non è mai stato reso pubblico e non entra nell'archivio | M |
| RF-WALL-52 | Ogni esportazione è **registrata** con autore, momento e numero di contenuti, ed è consultabile dal partecipante nella sezione dei propri contenuti | M |

#### 6.11.3 La wall proiettata — specifica di visualizzazione

L'organizzatore genera un **codice schermo** di sei caratteri; su un computer collegato al
proiettore o al LED wall si apre l'indirizzo della wall, si inserisce il codice e la pagina
va a schermo intero. Nessun software da installare, nessuna autenticazione da digitare in
sala.

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-25 | Attivazione con codice schermo a sei caratteri, revocabile e rigenerabile dall'organizzatore | M |
| RF-WALL-26 | Layout **focus singolo a rotazione**: un contenuto per volta, al centro, con transizione in dissolvenza | M |
| RF-WALL-27 | Durata di permanenza configurabile: default 10 secondi per le foto, 8 per i testi | M |
| RF-WALL-28 | Adattamento a 1920×1080 e 3840×2160 in 16:9, con area di sicurezza del 5% sui bordi per compensare l'overscan dei proiettori | M |
| RF-WALL-29 | **Tipografia scalata alla distanza**: corpo minimo equivalente a 48 px su 1080p, ridimensionato automaticamente in base alla lunghezza del messaggio; oltre la lunghezza gestibile il testo non viene proiettato e la console lo segnala | M |
| RF-WALL-30 | **Foto verticali gestite come cittadine di serie**: sono la maggioranza degli scatti da telefono. L'immagine è contenuta senza ritagli, su un fondo derivato dall'immagine stessa e sfocato, così da riempire il 16:9 senza bande nere | M |
| RF-WALL-31 | **Palette per sala buia**: fondo molto scuro e testo avorio anziché bianco pieno, per non abbagliare chi balla; luminosità media stabile tra un contenuto e l'altro | M |
| RF-WALL-32 | **Nessun lampeggio, nessuna transizione a stacco**: dissolvenze morbide di 600-800 ms. Requisito di sicurezza, non estetico: un maxischermo che lampeggia in una sala buia è un rischio per le persone fotosensibili | M |
| RF-WALL-33 | Attribuzione discreta in basso: nickname e, se disponibile, ruolo di ballo. Mai nome e cognome | M |
| RF-WALL-34 | **Schermata di cortesia** quando la coda è vuota: locandina o logo dell'evento, titolo, e istruzione per partecipare alla chat con QR inquadrabile | M |
| RF-WALL-35 | La wall non mostra mai contenuti non approvati, in nessuna circostanza, nemmeno in caso di errore: in assenza di contenuti validi si torna alla schermata di cortesia | M |
| RF-WALL-36 | Rimozione di un contenuto in proiezione con effetto entro un secondo | M |
| RF-WALL-37 | **Buffer locale**: i contenuti approvati e le immagini sono precaricati. In caso di caduta della rete la rotazione continua sul materiale disponibile, con un indicatore discreto di disconnessione visibile solo alla console. Alla riconnessione lo stato si allinea | M |
| RF-WALL-38 | Nessun elemento di interfaccia sullo schermo: niente cursore, niente barre, niente notifiche del browser. Reingresso automatico a schermo intero dopo un'interruzione | M |
| RF-WALL-39 | Il consumo di memoria resta stabile su una sessione di otto ore consecutive: le wall restano accese tutta la notte | M |
| RF-WALL-46 | **Modalità prova**, attivabile prima dell'apertura porte: proietta contenuti campione — testo lungo, testo breve, foto verticale, foto orizzontale, schermata di cortesia — e una **carta di calibrazione** con area di sicurezza, riferimenti tipografici e scala dei grigi, per verificare proiettore, risoluzione, colori e leggibilità a distanza durante l'allestimento | M |
| RF-WALL-47 | **Rotazione di sicurezza in assenza di presidio**: esaurita la coda, la wall ripropone i contenuti **già approvati** dell'evento e i contenuti di servizio programmati, con un tetto configurabile alle ripetizioni. Nessun contenuto non approvato entra mai in rotazione; se non esiste materiale approvato si torna alla schermata di cortesia | M |
| RF-WALL-53 | La cancellazione automatica dei contenuti è **dichiarata per ciò che è**: la piattaforma cancella quanto detiene e non può revocare le copie già esportate dall'organizzatore. L'accordo con l'organizzatore ne disciplina la conservazione | M |
| RF-WALL-40 | Multi-schermo con code e layout indipendenti | 2 |
| RF-WALL-41 | Wall consultabile dai partecipanti in piattaforma, durante e dopo l'evento | 2 |
| RF-WALL-42 | Layout alternativi (mosaico, focus con coda, cornice con programma) selezionabili per evento | 2 |

**Nota di progetto sulla schermata wall.** È l'unica interfaccia del prodotto vista
contemporaneamente da centinaia di persone, a distanza, in condizioni di luce sfavorevoli, e
messa in scena dentro un evento a pagamento: un difetto qui non è un bug, è un incidente
pubblico. Le tre regole non negoziabili che ne derivano sono la leggibilità a venti metri, la
gestione dignitosa delle foto verticali, e il pulsante che in un gesto solo riporta lo
schermo alla cortesia.

### 6.12 Rimborsi, cancellazioni, annullamenti (RMB)

Policy commerciale completa in `03-politica-rimborsi.md`.

| ID | Requisito | Pr. |
|---|---|---|
| RF-RMB-1 | Richiesta di rinuncia dall'area personale, con l'importo recuperabile calcolato e mostrato prima della conferma | M |
| RF-RMB-2 | Il percorso propone **prima il trasferimento** del biglietto e lo mantiene disponibile anche quando il rimborso non è più previsto | M |
| RF-RMB-3 | Motore di scaglioni configurabile per evento entro i limiti di piattaforma | M |
| RF-RMB-4 | Cut-off di rimborso per singolo servizio accessorio, indipendenti dal titolo | M |
| RF-RMB-5 | Approvazione dell'organizzatore, con **approvazione automatica** decorsi sette giorni dalla richiesta | M |
| RF-RMB-6 | Rimborsi parziali e rimborso per singolo componente della coppia | M |
| RF-RMB-7 | Esecuzione sul metodo di pagamento originario; oltre la finestra tecnica del PSP, percorso manuale con raccolta dell'IBAN e tracciamento | M |
| RF-RMB-8 | Annullamento dell'evento: rimborso integrale comprensivo di fee, avviato in blocco, con comunicazione contestuale e monitoraggio degli esiti | M |
| RF-RMB-9 | Il rimborso libera la capienza sulle quote coinvolte e invalida il QR | M |
| RF-RMB-10 | Rimborsi falliti in una coda di gestione con motivo e possibilità di ritentare | M |
| RF-RMB-12 | L'**annullamento di una sessione** dà diritto al rimborso della quota di prezzo a essa attribuibile su ogni titolo che la include, secondo il peso di ripartizione di RF-EVT-36, comprensiva della corrispondente parte di diritti di prevendita e **senza applicazione degli scaglioni**: la causa non è imputabile al partecipante | M |
| RF-RMB-13 | Se le sessioni annullate superano una **soglia di peso** configurabile sul titolo — default 30% — o se la sessione annullata è l'unica inclusa, il partecipante ha diritto al **rimborso integrale del titolo**, esercitabile entro 14 giorni dalla comunicazione secondo RB14 | M |
| RF-RMB-11 | Credito interno riutilizzabile come alternativa volontaria al rimborso | 2 |

### 6.13 Comunicazioni e notifiche (COM)

| ID | Requisito | Pr. |
|---|---|---|
| RF-COM-1 | Email transazionali: benvenuto, conferma d'ordine con biglietti, esito trasferimento, sollecito requisiti, promemoria a 48 e 24 ore, esito rimborso, annullamento o modifica dell'evento | M |
| RF-COM-2 | Comunicazione manuale dell'organizzatore ai partecipanti di un evento, con segmentazione per titolo, ruolo di ballo, stato dei requisiti, presenza al check-in | M |
| RF-COM-3 | Registro degli invii e stato di recapito | M |
| RF-COM-4 | Preferenze di contatto separate tra comunicazioni di servizio e promozionali, con disiscrizione a un clic dalle seconde | M |
| RF-COM-5 | Notifiche in piattaforma per messaggi della bacheca, esiti di richieste, aggiornamenti sugli eventi acquistati | M |
| RF-COM-6 | Template email in italiano e inglese, secondo la lingua dell'utente | M |
| RF-COM-7 | Notifiche push e messaggistica su canali esterni | 3 |

### 6.14 Back-office dell'organizzatore (BKO)

| ID | Requisito | Pr. |
|---|---|---|
| RF-BKO-1 | Cruscotto per evento: venduto per titolo, incasso netto, fee maturate, **iscritti per ruolo con sbilancio corrente**, coppie complete, servizi accessori venduti, requisiti mancanti, andamento delle vendite nel tempo | M |
| RF-BKO-2 | Elenco iscritti con filtri e ricerca, dettaglio della singola iscrizione con ordine, requisiti, servizi, check-in, storico | M |
| RF-BKO-3 | Esportazione in CSV di iscritti, ordini, incassi, presenze, con selezione delle colonne | M |
| RF-BKO-4 | Liste operative stampabili: elenco per ruolo, elenco pasti con diete, elenco taglie, elenco slot delle lezioni private | M |
| RF-BKO-5 | Gestione degli accrediti e degli omaggi per staff, cast e ospiti, con quota dedicata e tracciamento | M |
| RF-BKO-6 | Riepilogo economico dell'evento: incassato per metodo di pagamento, rimborsato, netto, fee, incasso alla porta | M |
| RF-BKO-7 | Registro delle attività dello staff sull'evento | M |
| RF-BKO-9 | Esportazione delle vendite con il **dettaglio per titolo e per sessione inclusa**, sufficiente all'organizzatore per le proprie ripartizioni e per i propri adempimenti, compresa l'eventuale separazione tra componente didattica e componente danzante | M |
| RF-BKO-10 | **Registrazione delle vendite effettuate su canali esterni**, per quantità e per titolo, così che i contatori di capienza e la disponibilità mostrata al pubblico restino veritieri. Inserimento manuale rapido, con storico e autore | M |
| RF-BKO-11 | Vista di **allineamento dei canali**: venduto online, venduto fuori, pass emessi manualmente, contingente residuo, totale rispetto alla capienza. È la schermata che l'organizzatore guarda prima di aprire le porte | M |
| RF-BKO-12 | I conteggi che comprendono emissioni manuali e vendite esterne sono **informativi e non bloccanti**: la piattaforma li mostra, non li impone, e dichiara sempre su quali dati sono calcolati | M |
| RF-BKO-8 | Costi dell'evento e calcolo del margine | 3 |

### 6.15 Amministrazione della piattaforma (ADM)

| ID | Requisito | Pr. |
|---|---|---|
| RF-ADM-1 | Coda di approvazione degli organizzatori con scheda della richiesta e storico delle decisioni | M |
| RF-ADM-2 | Gestione dei **cataloghi**: tipi di evento con le loro capacità, tipi di requisito, tipi di servizio accessorio, preset di policy di rimborso, livelli, tag | M |
| RF-ADM-3 | Configurazione della fee di piattaforma: percentuale, importo fisso, minimo e massimo, eccezioni per organizzazione | M |
| RF-ADM-4 | Elenco organizzazioni, eventi, utenti con ricerca, sospensione e riattivazione | M |
| RF-ADM-5 | Coda dei contenuti segnalati (chat, wall, bacheca) con azioni di moderazione | M |
| RF-ADM-6 | Cruscotto di piattaforma: transato, fee maturate, organizzatori attivi, eventi pubblicati, utenti registrati | M |
| RF-ADM-7 | Impersonificazione di un utente per assistenza, con consenso registrato e traccia in audit log | M |
| RF-ADM-8 | Gestione dei **piani premium** e dei diritti associati, con interruttore generale di attivazione | M |
| RF-ADM-9 | Audit log immutabile delle azioni sensibili: approvazioni, sospensioni, accessi ai documenti, modifiche di prezzo, rimborsi | M |
| RF-ADM-10 | Le **soglie di contestazione** di RF-PAY-38 e la sensibilità della classificazione automatica delle immagini sono **parametri di configurazione della piattaforma**, modificabili dal Super Admin senza rilascio: le soglie dei prestatori cambiano nel tempo | M |

### 6.16 Piano premium ed entitlement (PRM)

| ID | Requisito | Pr. |
|---|---|---|
Progetto completo del piano, catalogo dei diritti, tutele, adempimenti e soglie di attivazione
in **`07-piano-premium.md`**.

**L'applicazione di base è e resta gratuita**: registrarsi, consultare il calendario e il
programma, acquistare, ricevere i titoli e fare il check-in non costano nulla. Il Premium è una
seconda linea di ricavo, pagata dal ballerino, indipendente dalla fee sui biglietti e — con la
sola eccezione dell'accesso anticipato — indipendente dagli organizzatori.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PRM-1 | Modello dei piani con **diritti** associati, aggiungibili per configurazione | M |
| RF-PRM-2 | Ogni funzione premium verifica il diritto attraverso **un unico servizio di controllo**, mai con controlli sparsi | M |
| RF-PRM-3 | Interruttore globale che, a piano disattivato, concede il diritto a tutti: è così che il primo rilascio non impone il premium pur essendo progettato come se lo imponesse | M |
| RF-PRM-4 | Le interfacce sono predisposte per lo stato "funzione riservata al piano Premium", non visibile finché l'interruttore è spento | M |
| RF-PRM-5 | **Nessuna funzione di tutela è mai Premium**: blocco, segnalazione, controllo della propria visibilità, limiti alle richieste ricevute e cancellazione dei dati sono gratuiti per tutti, sempre | M |
| RF-PRM-6 | **Livello di ballo del profilo** con tre fonti distinte e mostrate separatamente: dichiarato dall'utente, desunto dallo storico delle sessioni frequentate in piattaforma, attestato da un maestro | M |
| RF-PRM-7 | Il confronto tra livelli è sempre motivato in modo verificabile ("ha frequentato quattro workshop avanzati negli ultimi dodici mesi"), mai ridotto a una sola etichetta | M |
| RF-PRM-8 | **Ricerca partner avanzata**: filtri per ruolo, livello, città, lingua ed evento a cui si partecipa. Esclusi deliberatamente genere, età, posizione precisa, distanza e presenza online | 2 |
| RF-PRM-9 | La messaggistica richiede **accettazione reciproca**: il diritto Premium sblocca l'iniziativa, non la conversazione. Chi non è abbonato riceve le richieste e risponde liberamente | 2 |
| RF-PRM-10 | Limite giornaliero alle richieste inviate, anche per gli abbonati; facoltà per chiunque di sospendere o restringere la ricezione | 2 |
| RF-PRM-11 | Nessun segnale di lettura o di rifiuto: ignorare una richiesta non produce alcuna informazione visibile a chi l'ha inviata | 2 |
| RF-PRM-12 | Codice di condotta con accettazione obbligatoria all'attivazione della funzione, e sospensione della sola funzione senza perdita dei biglietti in caso di violazione | 2 |
| RF-PRM-13 | **Accesso anticipato**: una finestra di vendita di RF-EVT-7 può essere riservata a un piano per un periodo definito, su titoli, slot e servizi accessori | 2 |
| RF-PRM-14 | L'accesso anticipato richiede l'**adesione dell'organizzatore evento per evento**: la piattaforma non dispone unilateralmente di inventario che non è suo | 2 |
| RF-PRM-15 | Date di apertura anticipata e pubblica dichiarate sulla pagina dell'evento fin dalla pubblicazione; tetto percentuale configurabile sull'inventario allocabile nella finestra riservata | 2 |
| RF-PRM-16 | Nessuna priorità di coda a pagamento: il vantaggio è la finestra temporale, non un privilegio dentro la stessa finestra | 2 |
| RF-PRM-17 | Sottoscrizione, addebito ricorrente con autenticazione forte, gestione dei tentativi falliti, periodo di tolleranza, rinnovo comunicato in anticipo e disdetta con lo stesso numero di passaggi della sottoscrizione | 2 |
| RF-PRM-18 | Alla cessazione i diritti decadono alla fine del periodo pagato, senza cancellare dati, biglietti o storico | 2 |
| RF-PRM-19 | L'incasso degli abbonamenti passa da un account di pagamento **proprio della piattaforma**, separato dall'infrastruttura marketplace dei biglietti, con documenti fiscali e numerazione propri | 2 |
| RF-PRM-20 | Gestione del diritto di recesso di quattordici giorni, che sui servizi digitali in abbonamento **si applica** a differenza dei biglietti per eventi con data certa | 2 |
| RF-PRM-21 | **Piano unico annuale a 4,99 €**, senza opzione mensile: l'attività dei ballerini è stagionale e si interrompe in estate. Preavviso di rinnovo obbligatorio, tentativi ripetuti in caso di carta scaduta, periodo di tolleranza prima della decadenza dei diritti | 2 |
| RF-PRM-23 | La scheda dell'evento e la conferma d'ordine dichiarano **prima dell'acquisto del biglietto** che la chat di sala richiede il Premium | M |
| RF-PRM-22 | Altri diritti previsti: annuncio in evidenza nella bacheca, avvisi anticipati sull'apertura delle iscrizioni degli eventi seguiti, archivio delle proprie foto proiettate, storico personale di partecipazione | 2 |

> **Sequenza di lancio.** Il Premium è interamente progettato dal primo rilascio con il suo
> interruttore, e **si attiva in fase 2 a data fissa**. Il prezzo di 4,99 € all'anno e la data
> fissa si sostengono a vicenda: la conversione alta costruisce in fretta la densità di profili
> di cui la ricerca partner ha bisogno. Restano tre condizioni preparatorie — lancio per
> densità e non per copertura, bacino precostituito dalla bacheca cerco-partner, livello
> desunto già alimentato — dettagliate in `07-piano-premium.md` §8.
>
> **Natura del piano.** A 4,99 € all'anno il netto per la piattaforma è di circa 3,77 € per
> abbonato: il Premium non è una linea di ricavo, è uno strumento di **qualificazione**. Un
> pagamento tracciato dietro ogni richiesta di contatto è, su una funzione di messaggistica tra
> sconosciuti, una misura di sicurezza prima che un ricavo — ed è l'argomento migliore per
> giustificare il paywall. Analisi economica in `07` §2.2.

---

## 7. Regole di business trasversali

| # | Regola |
|---|---|
| RB1 | Il prezzo esposto è dell'organizzatore. I **diritti di prevendita** sono ricavo della piattaforma, pagati dal partecipante, sempre visibili come voce separata prima del pagamento, e non transitano mai dall'organizzatore |
| RB2 | La capienza si impegna **all'avvio dell'ordine**, con una prenotazione temporanea a tempo che l'utente usa per completare l'acquisto, e si rilascia alla scadenza, al fallimento o all'abbandono. La sola consultazione del catalogo non blocca nulla |
| RB3 | Un acquisto è ammesso solo se **tutte** le quote **limitanti** coinvolte hanno capienza residua e se supera il cancello di tolleranza sui ruoli |
| RB4 | Uno **sforamento di pochi posti sulle quote commerciali è tollerato** e non genera rimborsi automatici: è una situazione gestibile in sala. Resta invalicabile la **capienza della sala**, che è un limite di sicurezza e non una scelta commerciale |
| RB5 | Sold out è definitivo. Nessuna lista d'attesa, nessuna promozione automatica |
| RB6 | Il ruolo di ballo non è mai derivato dal genere della persona |
| RB7 | Ogni ingresso è nominale e tracciato: un QR vale una sola volta per sessione |
| RB8 | Il trasferimento del biglietto ricalcola sempre le quote di ruolo e rivaluta i requisiti sul nuovo titolare |
| RB9 | Nessun contenuto raggiunge la wall senza approvazione esplicita di un moderatore |
| RB10 | Sulla wall e in chat compare il nickname, mai nome e cognome |
| RB11 | La chat richiede biglietto valido, **presenza accertata** — per check-in all'ingresso o per sblocco di sala — e diritto premium: tre condizioni congiunte |
| RB12 | Lo staff operativo vede l'esito di un requisito, non il documento che lo prova |
| RB13 | Un evento non è pubblicabile se l'organizzazione non è approvata e non ha un account di incasso collegato **e abilitato all'incasso** |
| RB14 | Una modifica sostanziale a un evento pubblicato dà diritto al rimborso integrale |
| RB15 | Ogni movimento di denaro è riconducibile a un ordine e a un evento: nessun incasso fuori sistema, nemmeno alla porta |
| RB16 | Ogni azione sensibile lascia una traccia non modificabile con autore e momento |
| RB17 | Un'iscrizione da novanta euro non fallisce per un servizio accessorio da venticinque: se manca solo un accessorio, si propone la rimozione e si chiede conferma, non si annulla l'ordine |
| RB18 | Nessuna modifica di capienza invalida un biglietto già emesso. Il limite è abbassabile anche sotto il venduto: l'effetto è la chiusura della vendita online, mai l'espulsione di qualcuno |
| RB20 | Le quote governano **la sola vendita online**. L'emissione manuale di pass da parte dell'organizzatore e le vendite sui suoi canali non sono mai bloccate: la piattaforma conta e mostra, non impedisce |
| RB21 | Ogni numero mostrato dichiara **su quali dati è calcolato**. Un conteggio che non comprende i canali esterni lo dice, invece di presentarsi come il quadro completo |
| RB19 | Le quote governano l'ammissione, il contatore presenze governa la sicurezza: sono due assi distinti e il check-in non consuma capienza |
| RB22 | Una **contestazione di addebito accolta** produce gli stessi effetti di un rimborso: biglietto invalidato, iscrizione decaduta, quote rilasciate. Nessun ingresso avviene con un titolo il cui incasso è stato revocato |
| RB23 | Nessuna immagine raggiunge la **chat** senza aver superato la classificazione automatica; nessun contenuto raggiunge la **wall** senza approvazione umana. Le due soglie sono distinte e cumulative, e un contenuto trattenuto e mai esaminato resta trattenuto |
| RB24 | **Nessuno risulta iscritto a un evento senza esserne informato e senza poter rifiutare.** Il rifiuto non lede chi ha pagato: restituisce il biglietto alla sua disponibilità |

---

## 8. Requisiti non funzionali

| Area | Requisito |
|---|---|
| **Lingue** | Interfaccia italiana e inglese complete; contenuti dell'organizzatore con seconda lingua opzionale. Valuta EUR, fuso Europe/Rome |
| **Dispositivi** | Progettazione mobile-first: l'acquisto avviene in gran parte da telefono. Console di moderazione e box office ottimizzate per tablet e desktop. Wall solo desktop a schermo intero |
| **Prestazioni** | Scheda evento utilizzabile entro 2,5 secondi su rete mobile; esito di scansione al check-in entro 1 secondo, anche offline; contenuto sulla wall entro 2 secondi dalla decisione del moderatore |
| **Concorrenza** | L'apertura delle vendite di un evento atteso concentra centinaia di accessi in pochi minuti: il decremento della capienza deve essere corretto sotto contesa, con protezione da automatismi e limitazione di frequenza |
| **Realtime** | Chat e wall su canale persistente con riconnessione automatica e recupero dei messaggi perduti |
| **Affidabilità** | Nessuna perdita di ordini o check-in. La coda offline del check-in sopravvive alla chiusura del browser e all'esaurimento della batteria |
| **Sicurezza** | Doppio fattore per i ruoli amministrativi, QR firmati, dati di pagamento mai transitanti dalla piattaforma, protezione da automatismi in fase di apertura vendite, limitazione di frequenza su chat e upload, scansione dei file caricati |
| **Accessibilità** | Percorso pubblico e area personale conformi a WCAG 2.1 AA. La wall è esclusa dalla navigabilità ma soggetta al vincolo sui lampeggi |
| **Osservabilità** | Tracciamento degli errori, metriche su vendite e pagamenti, allarme su rimborsi falliti, su schermi wall disconnessi e su code di sincronizzazione bloccate |
| **Conservazione** | Documenti dei requisiti e contenuti della chat cancellati automaticamente dopo il periodo configurato; dati contabili conservati secondo l'obbligo di legge |

---

## 9. Privacy e protezione dei dati

| Tema | Impostazione proposta |
|---|---|
| **Titolarità** | La piattaforma è titolare per gli account e i servizi comuni; l'organizzatore è titolare autonomo per i dati dei propri partecipanti. Serve un accordo di contitolarità o di responsabilità del trattamento, allegato alle condizioni per gli organizzatori |
| **Dati particolari** | Con l'esclusione di tesseramento e certificato medico, l'unico dato riconducibile alla salute che resta sono **diete e allergie** raccolte per i pasti: accesso ristretto, cancellazione automatica dopo l'evento, mai esposti nelle esportazioni generiche né nella vista di check-in. Nessun documento sanitario è conservato dalla piattaforma |
| **Minimizzazione** | Lo staff vede l'esito, non il documento. L'operatore di check-in vede nome, ruolo e titolo, non contatti né documenti |
| **Contenuti generati** | Le foto inviate in chat sono contenuti dell'utente proiettati in pubblico: serve un consenso esplicito e informato al momento del primo invio, con menzione della proiezione in sala, della conservazione e del **riutilizzo da parte dell'organizzatore**, che sui contenuti esportati diventa titolare autonomo (RF-WALL-50) |
| **Cancellazione dei contenuti** | La cancellazione automatica riguarda ciò che la piattaforma detiene e non può revocare le copie già esportate: va dichiarata per quello che è, e l'esportazione è ristretta ai soli contenuti effettivamente proiettati, cioè già resi pubblici in sala (RF-WALL-51, RF-WALL-53) |
| **Immagini di terzi** | Le foto scattate in sala ritraggono altre persone: il regolamento dell'evento deve disciplinare la ripresa, e la moderazione deve poter rifiutare contenuti che ritraggono terzi in modo inopportuno |
| **Dati inseriti da terzi** | Chi acquista per altri comunica dati di persone che non hanno fatto nulla. Si raccoglie **il minimo necessario all'emissione del titolo**, l'acquirente attesta di essere autorizzato, l'interessato riceve una richiesta di conferma e può rifiutare. Fino alla conferma nessun trattamento ulteriore ha luogo (RF-PAY-33, RF-CPL-13/14/15) |
| **Minori** | Account dai 14 anni compiuti, età per il consenso autonomo ai servizi online in Italia. Sotto quella soglia nessun account: il minore è iscritto da un adulto che dichiara di esercitare la responsabilità genitoriale. La chat è riservata ai maggiorenni (RF-ACC-10/11/12) |
| **Nickname** | La scelta di proiettare solo il nickname è una misura di minimizzazione, non un vezzo grafico. Essendo l'unico dato dell'autore che finisce su un maxischermo, è soggetto a filtro e può essere oscurato dal moderatore |
| **Consensi** | Granulari e versionati: condizioni, informativa, comunicazioni promozionali, partecipazione alla chat, conservazione e riutilizzo dei contenuti proiettati |
| **Diritti dell'interessato** | Accesso, esportazione, rettifica e cancellazione dall'area personale, con conservazione dei soli dati contabili obbligatori |
| **Trasferimenti** | Da verificare per ciascun fornitore utilizzato (pagamenti, invio email, archiviazione, **classificazione automatica delle immagini**) |

---

## 10. Roadmap

**Fase 1a — Primo taglio.** Il sottoinsieme che porta in vendita l'evento di un organizzatore
cliente: motore di capienza per intero · evento con sessioni, titoli e quote · scheda pubblica ·
checkout **solo Stripe** con prenotazione di 15 minuti e diritti di prevendita · biglietto QR e
trasferimento · ruolo di ballo e iscrizione a coppia · check-in offline · back-office con
esportazioni · email transazionali. Rimborsi, contestazioni e onboarding degli organizzatori
sono presidio umano. Perimetro, tagli e sostituti in **`13-primo-taglio.md`**.

> Con il solo Stripe la ripartizione dei diritti di prevendita è nativa: **Q19 esce dal percorso
> critico** e l'accordo di partner PayPal corre in parallelo allo sviluppo.

**Fase 1b — Completamento del primo rilascio.** Onboarding degli organizzatori con
approvazione · calendario e ricerca · PayPal e Satispay · motore di rimborso a scaglioni e
contestazioni di addebito · codici promozionali · bacheca cerco-partner · box office · chat e
Live Wall · console di piattaforma · entitlement predisposto e disattivato.

**Fase 2 — L'app del tanghero e l'estensione del dominio.** Le cinque funzioni della milestone
in **`12-app-tanghero.md`**: Social Matcher per workshop con lo stile di ballo · Tanda e DJ Live
Tracker · passaporto con Apple e Google Wallet e notifica geolocalizzata · mappa della community
in opt-in · bacheca dei nomadi. Con esse: corsi ricorrenti con registro presenze · lezioni
private con calendario del maestro e ruolo Maestro · attivazione del piano premium · bonifico
bancario · wall multi-schermo e layout alternativi · wall consultabile dai partecipanti ·
credito interno · widget da incorporare.

**Fase 3 — Scala e sofisticazione.** Selezione manuale delle candidature e lotteria per gli
encuentros · liste d'attesa · gestione alloggi con matching di ospitalità · costi e margine
dell'evento · notifiche push e canali di messaggistica · apertura internazionale con
multivaluta e multi-paese · integrazioni contabili e fiscali · profili pubblici e componente
sociale, se il posizionamento lo richiederà.

---

## 11. Rischi e questioni aperte

### Rischi

| # | Rischio | Impatto | Mitigazione proposta |
|---|---|---|---|
| R1 | ~~Contesa sull'ultimo posto~~ | Ridotto a basso | **Chiuso**: la capienza si impegna all'avvio del pagamento e lo sforamento di pochi posti sulle quote commerciali è accettato. Resta il solo presidio del limite assoluto di sala |
| R1b | **Posti bloccati da ordini abbandonati**: la prenotazione temporanea sottrae posti anche a chi non concluderà. In apertura vendite di un evento atteso, decine di ordini abbandonati in contemporanea fanno apparire esaurito ciò che non lo è | Medio-alto in apertura vendite | Durata breve e configurabile, una sola prenotazione attiva per utente e per evento, rilascio immediato all'abbandono esplicito, processo di recupero delle prenotazioni scadute, monitoraggio del tasso di abbandono e del tempo medio di completamento sul primo evento reale |
| R2 | **Ripartizione dei diritti di prevendita non supportata da tutti i prestatori di pagamento** | Alto sui ricavi se non risolto | Stripe nativo al lancio; accordo di partner per PayPal da avviare subito per i tempi di approvazione; verifica su Satispay, con rinvio del metodo se la ripartizione non esiste |
| R3 | **Rete assente in sala**: chat inutilizzabile e wall a schermo nero davanti al pubblico | Alto sulla percezione | Buffer locale della wall (RF-WALL-37), verifica preventiva della rete in fase di allestimento, check-in comunque offline |
| R4 | **Contenuto inopportuno proiettato** su un maxischermo | Alto, anche legale | Nessuna proiezione senza approvazione, schermo di cortesia immediato, filtro automatico, doppio moderatore sugli eventi grandi |
| R5 | **Bacheca cerco-partner usata in modo improprio** | Alto sulla fiducia della community | Nessuna email esposta, messaggistica interna, segnalazione, blocco, codice di condotta pubblicato |
| R6 | **Adozione degli organizzatori**: la fee sul partecipante è accettata, ma il cambio di abitudini è il vero ostacolo | Alto sul business | Importazione della lista contatti, affiancamento sul primo evento, esportazioni che sostituiscano i fogli di calcolo esistenti |
| R7 | **Assenza di liste d'attesa** su eventi che vanno esauriti in minuti: domanda inevasa e pressione sull'organizzatore | Medio | Monitorare la frequenza dei sold out; è il primo candidato al rientro in scopo |
| R8 | ~~Dati sanitari trattati in un contesto amatoriale~~ | — | **Chiuso**: nessun certificato medico e nessun documento sanitario entra in piattaforma. Restano le sole diete per i pasti |
| R15 | ~~Obbligo del titolo di accesso fiscale~~ | **Chiuso** | Adempimenti dell'organizzatore, fuori dalla piattaforma. La piattaforma **affianca la biglietteria dell'organizzatore e non è l'unico canale di vendita**: la qualificazione di canale di prevendita è quindi solida. Reggono il posizionamento RF-TCK-11, RF-ORG-8 e RF-BKO-9 |
| R17 | **Disallineamento tra canali di vendita**: vendendo l'organizzatore anche fuori dalla piattaforma, i contatori di capienza non conoscono quelle vendite. La disponibilità mostrata al pubblico è sovrastimata e l'evento può risultare pieno in sala pur risultando aperto online | **Alto sull'operatività e sulla fiducia** | Contingente riservato ai canali esterni non vendibile online, registrazione delle vendite esterne, allineamento prima dell'apertura porte, ingresso gestibile anche per chi ha acquistato altrove |
| R16 | **Segmento di mercato escluso**: le milonghe settimanali operano in forma associativa e non possono usare la piattaforma senza cambiare il proprio inquadramento | Medio-alto sul volume | Scelta consapevole: il primo rilascio si rivolge a festival, marathon, encuentro e stage, che sono anche gli eventi con biglietto più alto e maggior bisogno delle funzioni distintive. Da dichiarare come posizionamento, non subire come sorpresa |
| R9 | **Complessità del wizard** di creazione evento generato dalle capacità del tipo | Medio | Preset per tipologia, percorso rapido per la milonga singola, anteprima costante |
| R10 | **Lancio prematuro del Premium** su una base utenti troppo piccola: la ricerca partner restituisce risultati vuoti e non mantiene la promessa | Alto, brucia la fiducia una volta sola | Soglie di attivazione (`07` §8), ricerca partner gratuita e limitata fino a quel momento |
| R11 | **La ricerca partner diventa un canale di molestie**, con effetti sulla reputazione dell'intera piattaforma nella community del tango | Il più alto del prodotto | Consenso reciproco obbligatorio, tutele sempre gratuite, nessuna funzione di prossimità o di presenza online, moderazione presidiata, codice di condotta |
| R12 | **Percezione di app di incontri travestita** | Alto e difficilmente reversibile | Esclusioni deliberate di genere, età e distanza; linguaggio dei testi; nessuna scoperta casuale di profili |
| R13 | **Gli organizzatori percepiscono l'accesso anticipato come disposizione arbitraria del loro inventario** | Alto sul rapporto con i clienti principali | Adesione volontaria evento per evento, tetto sull'inventario riservato, beneficio misurato e mostrato |
| R14 | **Doppia natura fiscale della piattaforma**: intermediaria sui biglietti, venditrice diretta sugli abbonamenti | Medio | Separare i flussi contabili e i documenti dall'inizio, non dopo |
| R18 | **Falsi positivi della classificazione automatica delle immagini**: una foto innocua trattenuta durante una serata in cui il tempo è tutto, e un partecipante che non capisce perché il suo contenuto non appare | Medio sull'esperienza | Coda prioritaria in console, notifica al moderatore, indicazione all'autore che il contenuto è in verifica e non perduto, soglia di sensibilità tarabile |
| R19 | **Sblocco di sala usato fuori dalla sala**: il QR della schermata di cortesia fotografato e condiviso allargherebbe la chat a chi non è presente | Medio sulla tenuta del vincolo di accesso | Codice a rotazione breve, verifica del possesso di un titolo valido, limitazione di frequenza, rigenerazione su richiesta del moderatore |
| R20 | **Biglietto senza titolare a ridosso dell'evento**: la persona iscritta da altri rifiuta tardi e non resta tempo per trasferire o rimborsare | Basso-medio | Richiesta di conferma inviata immediatamente, solleciti automatici, trasferimento proposto per primo all'acquirente |

### Questioni aperte

| # | Questione | Serve entro |
|---|---|---|
| Q1 | Le quattro decisioni sulla matrice dei ruoli (rimborsi alla cassa, pubblicazione autonoma dell'Event Manager, assegnazione per evento, preset "Staff") | Prima dello sviluppo dei permessi |
| Q2 | Meccanismo di raccolta della fee su PayPal e Satispay | Prima del checkout |
| Q3 | Contenuto del piano premium oltre alla chat, e prezzo | Prima della fase 2 |
| Q4 | Percentuali definitive della politica di rimborso e validazione legale dei T&C | Prima della pubblicazione |
| Q5 | Fatturazione: quali documenti emette la piattaforma, quali l'organizzatore, con quale strumento | Prima del primo incasso reale |
| Q6 | Tempistiche di conservazione di documenti dei requisiti e contenuti della chat | Prima del primo evento |
| Q7 | Timeline di progetto ed eventuale evento reale che fa da scadenza | Per la pianificazione |
| Q8 | Dati e utenti da migrare da sistemi esistenti | Per la pianificazione |
| Q9 | Disponibilità di uno o due organizzatori reali e di alcuni ballerini per la validazione dei flussi | Prima della progettazione delle interfacce |
| Q10 | Identità visiva: esiste un marchio "Mirada" con linee guida? | Prima della progettazione delle interfacce |
| Q13 | Contropartita per l'organizzatore che aderisce all'accesso anticipato (proposta: nessuna, con beneficio misurato) | Prima della fase 2 |
| Q16 | La data di attivazione del Premium coincide con l'inizio della fase 2 o cade più avanti dentro di essa? | Alla pianificazione della fase 2 |
| Q17 | Se alla data di attivazione lo storico è ancora sottile, il livello si presenta come indicazione e non come garanzia, puntando sull'attestazione dei maestri: si accetta? | Prima dell'attivazione |
| Q18 | Revisione del prezzo dopo il primo anno di dati: si programma da subito nelle condizioni contrattuali? | Prima dell'attivazione |
| Q19 | Ripartizione dei diritti di prevendita: attivazione dell'accordo di partner PayPal e verifica della fattibilità su Satispay | **Prima dello sviluppo del checkout** |
| ~~Q20~~ | ~~Minori~~ | **Chiusa** il 31 luglio (`11` D10): ammessi alle tre soglie di età |
| ~~Q21~~ | ~~Classificazione automatica delle immagini~~ | **Chiusa** il 31 luglio (`11` D11): adottata |
| ~~Q22~~ | ~~Contestazioni di addebito~~ | **Chiusa** il 31 luglio (`11` D12): penale all'organizzatore, doppia soglia |

### Sessioni di approfondimento da pianificare

I temi rinviati a una trattazione dedicata sono stati chiusi tutti. Ne resta traccia qui per
sapere dove sono stati risolti.

| Tema | Stato |
|---|---|
| ~~Titoli d'ingresso e pass multi-sessione~~ | **Chiuso** in `09-titoli-e-pass.md`: elenco esplicito delle sessioni incluse, scaglioni facoltativi, unità di vendita per persona o per coppia, un QR per biglietto. Chiude anche la correzione provvisoria A4 |
| ~~Tesseramento associativo~~ | **Chiuso**: il tesseramento avviene interamente fuori dalla piattaforma, almeno in fase 1. Nessuna entità da modellare; dove serve accertarlo, si usa una dichiarazione |
| ~~Titolo di accesso fiscale~~ | **Chiuso per posizionamento** all'ottavo giro: gli adempimenti restano dell'organizzatore e si svolgono fuori dalla piattaforma, che emette una conferma d'ordine con QR e non un titolo fiscale. Reggono RF-ORG-8, RF-TCK-11 e RF-BKO-9; il briefing `10` resta disponibile come consulenza di conferma, non come precondizione |
| ~~Audit, punti da B3 a C5~~ | **Chiuso** in `11-chiusura-audit.md`, con tre decisioni residue del committente (Q20, Q21, Q22) |


---

<!-- ============================================================ -->
<!-- SORGENTE: 05-modello-capienza.md -->
<!-- ============================================================ -->

# Mirada Tango — Allegato tecnico-funzionale: il motore di capienza

**Versione** 1.0 · **Data** 30 luglio 2026 · Allegato a `04-analisi-funzionale.md` §5.2

Questo allegato specifica il modello che governa la disponibilità dei posti. È il componente
più delicato del prodotto: sbaglia in silenzio, sbaglia sotto carico, e ogni errore si
traduce in una persona che ha pagato e non entra. Va implementato con test prima che con
codice.

---

## 1. Perché un'entità dedicata

Sullo stesso evento convivono vincoli di natura diversa e indipendente:

| Vincolo | Origine | Esempio |
|---|---|---|
| Capienza della sala | Sicurezza, obbligo di legge | 220 persone |
| Equilibrio dei ruoli | Qualità del ballo | 110 leader, 110 follower |
| Disponibilità commerciale | Scelta di prezzo | 150 full pass, 60 milonga pass |
| Capienza di una sala secondaria | Logistica | workshop avanzato: 25 coppie |
| Impegno con un fornitore | Contratto esterno | cena di gala: 90 coperti |

Un campo `capienza` sull'evento e un altro sul titolo coprono i primi tre casi male e gli
ultimi due per niente. Modellare la quota come **entità** rende ogni vincolo una riga di
configurazione, e rende identico il codice che serve una milonga da 120 posti e un encuentro
50+50 con tolleranza.

---

## 2. Schema dei dati

### 2.1 `QuotaCapienza`

| Campo | Tipo | Note |
|---|---|---|
| `id` | identificativo | |
| `evento_id` | riferimento | Ogni quota appartiene a un evento |
| `ambito` | enum | `EVENTO` · `SESSIONE` · `TITOLO` · `SERVIZIO` |
| `ambito_id` | riferimento nullo | Nullo quando `ambito = EVENTO` |
| `ruolo` | enum nullo | `LEADER` · `FOLLOWER` · nullo = quota totale, indifferente al ruolo |
| `limite` | intero ≥ 0 | Tetto assoluto |
| `consumato` | intero ≥ 0 | Contatore denormalizzato, aggiornato nella stessa transazione dei consumi |
| `limitante` | booleano | Se falso, la quota conta i posti ma **non blocca** la vendita. Default: vero |
| `riservata_a` | enum nullo | `ACCREDITO` per gli omaggi, `CANALE_ESTERNO` per la biglietteria dell'organizzatore e gli altri canali di vendita. Una quota riservata è sottratta alla vendita online e non compare nella disponibilità pubblica. Nullo = quota ordinaria |
| `tolleranza_sbilancio` | intero nullo | Valorizzato solo sulle quote di ruolo appaiate del medesimo ambito. Nullo = nessun cancello |
| `sforamento_ammesso` | intero ≥ 0 | Posti accettabili oltre il limite senza rifiutare l'ordine. Default 0. **Forzato a 0 e non modificabile sulla quota di capienza della sala** |
| `visibile_al_pubblico` | booleano | Se falso la disponibilità residua non viene esposta in scheda evento |

**Vincoli di integrità**

- Unicità della terna `(evento_id, ambito, ambito_id, ruolo)`: non esistono due quote per la stessa cosa.
- `consumato ≤ limite + sforamento_ammesso` sempre, in ogni istante, anche transitorio.
- `ambito_id` non nullo per ogni ambito diverso da `EVENTO`.
- `ruolo` valorizzabile solo su ambiti `EVENTO` e `SESSIONE`: le quote di titolo e di servizio sono per persona, indipendentemente da come balla.
- `tolleranza_sbilancio` coerente tra le due quote appaiate dello stesso ambito.

### 2.2 `ConsumoQuota`

Il registro di ciò che ogni iscrizione occupa. È l'elemento che rende il rilascio esatto
anziché ricostruito.

| Campo | Tipo | Note |
|---|---|---|
| `quota_id` | riferimento | |
| `iscrizione_id` | riferimento | |
| `quantita` | intero ≥ 1 | Normalmente 1 |
| `creato_il` | data e ora | |

Chiave unica su `(quota_id, iscrizione_id)`: è ciò che rende l'impegno **idempotente** anche
in caso di doppia notifica del PSP.

### 2.3 Campi rilevanti su `Iscrizione`

| Campo | Note |
|---|---|
| `ruolo_dichiarato` | Ciò che l'utente ha scelto: `LEADER`, `FOLLOWER`, `FLESSIBILE` |
| `ruolo_assegnato` | Il ruolo effettivo, risolto alla conferma del pagamento. Mai nullo su eventi con quote di ruolo |
| `canale` | `VENDITA_ONLINE` · `VENDITA_PORTA` · `ACCREDITO` |

Conservare entrambi i ruoli serve a due cose: spiegare all'utente perché è stato messo tra i
follower, e permettere all'organizzatore di riequilibrare i flessibili se lo sbilancio cambia.

---

## 3. Il flag `limitante`

Recepisce la prima decisione approvata. Nasce da un caso concreto: il Full Pass include 12
sessioni; se una sola è esaurita per un ruolo, il pass diventerebbe invendibile a metà del
pubblico.

| `limitante` | Comportamento | Quando usarlo |
|---|---|---|
| **vero** | La quota blocca l'acquisto quando è satura | Workshop con posti effettivi, cene, posti letto, capienza di sala |
| **falso** | La quota conta e mostra i numeri, ma non impedisce la vendita | Milonghe incluse in un pass, dove non esiste un posto assegnato e la sala assorbe |

Regola derivata: **la capienza dell'evento e le quote di ruolo dell'evento sono sempre
limitanti** e il flag non è modificabile su di esse. Sono vincoli fisici e di sicurezza, non
scelte commerciali.

Conseguenza operativa: quando un organizzatore include in un pass una sessione limitante e
satura, il sistema non nasconde il problema. Gli propone tre strade: aumentare la quota della
sessione, dichiararla non limitante, oppure mettere in vendita una variante di pass che non
la include.

---

## 4. Risoluzione delle quote applicabili

```
funzione quote_applicabili(iscrizione, titolo, servizi_scelti, ruolo) → insieme di quote

  Q ← insieme vuoto

  # 1. Livello evento: sempre
  Q ← Q ∪ quota(EVENTO, null, ruolo: null)          # capienza della sala
  Q ← Q ∪ quota(EVENTO, null, ruolo: ruolo)         # equilibrio dei ruoli

  # 2. Livello titolo: solo se la vendita è commerciale
  se iscrizione.canale ≠ ACCREDITO
      Q ← Q ∪ quota(TITOLO, titolo.id, ruolo: null)
  altrimenti
      Q ← Q ∪ quota_accrediti(EVENTO)               # quota riservata agli omaggi

  # 3. Livello sessione: una per ogni sessione inclusa nel titolo
  per ogni sessione in titolo.sessioni_incluse
      Q ← Q ∪ quota(SESSIONE, sessione.id, ruolo: null)
      Q ← Q ∪ quota(SESSIONE, sessione.id, ruolo: ruolo)

  # 4. Livello servizio: uno per ogni accessorio acquistato
  per ogni servizio in servizi_scelti
      Q ← Q ∪ quota(SERVIZIO, servizio.id, ruolo: null)

  ritorna Q privo dei riferimenti nulli    # le quote non configurate semplicemente non esistono
```

**Assenza di quota significa assenza di vincolo.** Un evento senza alcuna quota configurata
vende senza limite; la capienza della location, se presente in anagrafica, viene proposta
come valore di default alla creazione, non imposta.

**Gli accrediti** consumano la capienza della sala e le quote di ruolo — un ospite non pagante
occupa comunque spazio in pista — ma non le quote di titolo, che sono inventario commerciale.
Se l'organizzatore vuole 110 leader paganti più 5 accrediti leader, configura la quota leader
a 115: è configurazione, non un caso particolare del codice.

---

## 5. Verifica e impegno

```
funzione impegna(iscrizioni_ordine) → esito

  # A. Risoluzione, con assegnazione dei ruoli flessibili
  per ogni i in iscrizioni_ordine
      se i.ruolo_dichiarato = FLESSIBILE
          i.ruolo_assegnato ← risolvi_flessibile(evento, iscrizioni_ordine)
      altrimenti
          i.ruolo_assegnato ← i.ruolo_dichiarato
      i.quote ← quote_applicabili(i, ...)

  # B. Aggregazione: quante unità serve su ciascuna quota per l'intero ordine
  richiesta ← mappa quota → somma delle quantità richieste

  # C. Cancello di tolleranza, valutato sull'ordine intero
  se non supera_cancello_tolleranza(evento, iscrizioni_ordine)
      ritorna RIFIUTO(motivo: RUOLO_IN_ATTESA, ruolo: ..., ...)

  # D. Impegno atomico
  transazione
      per ogni quota in richiesta, ordinate per quota.id crescente     # evita i deadlock
          se non quota.limitante
              registra_consumo(quota, iscrizione, quantita)            # conta, non blocca
              continua
          righe ← AGGIORNA quota
                  IMPOSTA consumato = consumato + :quantita
                  DOVE id = :quota.id E consumato + :quantita <= limite
          se righe = 0
              annulla transazione
              ritorna RIFIUTO(motivo: ESAURITO, quota: quota)
          registra_consumo(quota, iscrizione, quantita)                # unicità → idempotenza
  fine transazione

  ritorna ACCETTATO
```

Note di implementazione che non sono dettagli:

- L'ordinamento per identificativo crescente è l'unica difesa contro i deadlock quando due
  ordini toccano lo stesso insieme di quote in ordine diverso.
- L'aggiornamento **condizionato** (`DOVE ... consumato + quantita <= limite`) è ciò che rende
  la verifica e l'impegno una sola operazione. Leggere prima e scrivere dopo è la modalità
  con cui si vendono posti inesistenti.
- L'unicità su `ConsumoQuota` rende l'operazione ripetibile: se il PSP notifica due volte lo
  stesso incasso, il secondo tentativo non muove i contatori.
- L'impegno avviene **all'avvio dell'ordine** e prende la forma di una **prenotazione
  temporanea a tempo**, sul modello dei ticketing generalisti: l'utente dispone di una finestra
  per inserire i dati e pagare. Si rilascia alla scadenza, al fallimento del pagamento o
  all'abbandono esplicito. La prenotazione è **riarmata all'avvio del pagamento**, per coprire
  il tempo di reindirizzamento verso i prestatori che portano l'utente fuori
  dall'applicazione. Conseguenza da monitorare: nelle finestre di apertura vendite gli ordini
  abbandonati sottraggono posti fino alla scadenza.

**Nota sulla differenza rispetto a un ticketing per spettacoli.** TicketOne blocca *quel*
posto, identificato sulla mappa della sala: deve gestire un lock su una risorsa singola e
nominata. Qui i posti non sono numerati, quindi la prenotazione è un semplice **impegno di
quantità sul contatore**, con lo stesso aggiornamento condizionato già descritto. È la ragione
per cui questa funzione, che in un ticketing generalista è una delle più delicate, qui costa
poco: cambia solo il momento in cui l'impegno scatta e si aggiunge la scadenza.

### 5.1 Tolleranza di sforamento

Decisione del committente: **uno sforamento di pochi posti sulle quote commerciali è accettato
e non genera rimborsi automatici.** È una situazione gestibile in sala, e la scelta semplifica
sensibilmente il sistema: cade la necessità del percorso di rimborso automatico per vendita
oltre capienza.

L'aggiornamento condizionato del passaggio D diventa quindi:

```
DOVE id = :quota.id E consumato + :quantita <= limite + quota.sforamento_ammesso
```

con `sforamento_ammesso` configurabile per quota e pari a zero per default.

**La capienza della sala.** Sulla **vendita online** la quota di capienza della sala non ammette
sforamento: `sforamento_ammesso` è forzato a zero e non modificabile. Non è un limite
commerciale ma un vincolo di sicurezza, e la piattaforma non deve vendere di propria iniziativa
oltre quel numero. Sull'**emissione manuale** da parte dell'organizzatore, invece, il
superamento è possibile e produce un avviso ben visibile ma nessun blocco: la responsabilità
della sala è sua, ed è lui a sapere se quel numero corrisponde ancora alla realtà.

Per le quote di servizi accessori vincolate a un fornitore esterno, dove lo sforamento significa
una persona senza cena o senza letto, il default resta zero ma l'organizzatore può alzarlo
consapevolmente.

### 5.2 I tre canali che alimentano i contatori

| Canale | Bloccato dalle quote? | Come entra nei contatori |
|---|---|---|
| **Vendita online** | **Sì**, con la tolleranza di sforamento | Impegno atomico, come descritto sopra |
| **Emissione manuale di pass** dell'organizzatore | **No, mai** | Registrata all'emissione, con titolo, causale e ruolo di ballo |
| **Vendite su canali esterni** | **No**, e la gestione è facoltativa per evento | Registrazione manuale delle quantità, se l'organizzatore ha scelto di gestirle |

È la distinzione che tiene insieme due esigenze opposte: la piattaforma deve impedire di
vendere ciò che non c'è, e non deve impedire all'organizzatore di fare ciò che ritiene sul
proprio evento. **I contatori sono vincolanti verso il pubblico e informativi verso
l'organizzatore.**

---

## 6. Il cancello di tolleranza

La tolleranza **non estende il limite**: restringe dinamicamente l'accesso al ruolo
sovrarappresentato. Traduce l'intenzione reale dell'organizzatore di marathon, che non è
"massimo 60 leader" ma "non voglio ritrovarmi con venti leader in più dei follower".

```
funzione supera_cancello_tolleranza(evento, iscrizioni_ordine) → booleano

  t ← tolleranza_sbilancio dell'ambito EVENTO
  se t è nullo → ritorna vero                       # nessun cancello configurato

  L ← consumato(quota EVENTO, LEADER)   + leader richiesti nell'ordine
  F ← consumato(quota EVENTO, FOLLOWER) + follower richiesti nell'ordine

  ritorna |L − F| ≤ t
```

La valutazione è **sull'ordine intero**, non riga per riga: è ciò che consente a una coppia di
passare anche quando il singolo verrebbe fermato.

Esempio con limiti 60/60 e tolleranza 5:

| Stato attuale | Un leader singolo | Un follower singolo | Una coppia |
|---|---|---|---|
| 40 L, 38 F | ammesso (sbilancio 3) | ammesso | ammessa |
| 40 L, 35 F | **rifiutato**: sbilancio già a 5 | ammesso | ammessa |
| 58 L, 58 F | ammesso | ammesso | ammessa |
| 60 L, 55 F | rifiutato: **limite assoluto** | ammesso | rifiutata: limite leader saturo |

**Proprietà notevole**: una coppia aggiunge un'unità per parte, lo sbilancio resta invariato,
quindi supera sempre il cancello. È esattamente il comportamento degli encuentros reali, che
aprono prima le iscrizioni a coppie e poi, se resta spazio, quelle singole. Il modello lo
riproduce senza codice dedicato.

**I due rifiuti vanno distinti nell'interfaccia**, perché hanno significati opposti:

| Motivo | Significato | Messaggio proposto |
|---|---|---|
| `ESAURITO` | Limite assoluto raggiunto, situazione definitiva | «Posti follower esauriti» |
| `RUOLO_IN_ATTESA` | Blocco temporaneo per sbilancio, può sbloccarsi | «Iscrizioni leader momentaneamente sospese, in attesa di follower. Puoi iscriverti subito in coppia, oppure cercare un partner nella bacheca» |

Il secondo messaggio è anche il miglior richiamo alla bacheca cerco-partner e all'iscrizione a
coppia: il vincolo diventa un suggerimento utile invece di un muro.

---

## 7. Il ruolo flessibile

```
funzione risolvi_flessibile(evento, iscrizioni_ordine) → ruolo

  se le quote di ruolo non esistono → ritorna null

  residuo_L ← limite(LEADER) − consumato(LEADER)
  residuo_F ← limite(FOLLOWER) − consumato(FOLLOWER)

  se residuo_L ≠ residuo_F      → ritorna il ruolo con residuo maggiore
  se consumato_L ≠ consumato_F  → ritorna il ruolo con consumato minore
  ritorna LEADER                                  # convenzione, per determinismo nei test
```

L'assegnazione avviene **alla conferma del pagamento**, non nel carrello, perché lo stato può
cambiare nel frattempo. L'utente viene informato del ruolo che gli è stato assegnato nella
conferma d'ordine e sul biglietto.

L'organizzatore può riassegnare manualmente un flessibile da un ruolo all'altro: l'operazione
rilascia i consumi del vecchio ruolo e ne impegna quelli del nuovo, con le stesse verifiche di
un acquisto.

---

## 8. Rilascio

Ogni operazione che libera un posto passa dallo stesso meccanismo: si leggono i `ConsumoQuota`
dell'iscrizione, si decrementano esattamente quei contatori, si cancellano le righe.

| Operazione | Effetto sui consumi |
|---|---|
| Rimborso di un'iscrizione | Rilascio integrale, servizi accessori compresi |
| Rimborso di un solo componente della coppia | Rilascio dei soli consumi di quell'iscrizione; l'altra resta intatta |
| Annullamento dell'evento | Rilascio di tutto; i contatori tornano a zero |
| Trasferimento del biglietto, stesso ruolo | Nessun movimento: cambia il titolare dell'iscrizione, non l'occupazione |
| Trasferimento con ruolo diverso | Rilascio del vecchio ruolo e impegno del nuovo, **nella stessa transazione**: se il nuovo ruolo è saturo il trasferimento è rifiutato e nulla cambia |
| Pagamento fallito o scaduto | Rilascio dell'impegno tecnico |
| Scioglimento della coppia senza rinuncia | Nessun movimento: le persone restano, cambia solo il legame |

La regola implicita ma essenziale: **il rilascio non è mai un decremento "a occhio"**. Si
rilascia ciò che risulta impegnato, riga per riga. È l'unico modo per non accumulare deriva
tra contatori e realtà su un evento che vive mesi tra vendite, rimborsi e trasferimenti.

---

## 9. Modifica dei limiti da parte dell'organizzatore

| Operazione | Regola |
|---|---|
| Aumento del limite | Sempre consentito |
| Riduzione a un valore ≥ `consumato` | Consentita |
| Riduzione a un valore < `consumato` | **Ammessa**, con avviso. La disponibilità online va a zero e la vendita si chiude; nessun biglietto già emesso viene invalidato e nessuno viene espulso |
| Spostamento di posti tra i ruoli | È una coppia di modifiche di limite, valutata con le stesse regole |
| Modifica della tolleranza | Sempre consentita; non produce effetti retroattivi sugli iscritti già ammessi |
| Passaggio di una quota da non limitante a limitante con `consumato > limite` | Rifiutato, con la stessa proposta di chiusura |
| Eliminazione di una quota con `consumato > 0` | Rifiutata: si può solo chiudere |

Nessuna modifica di configurazione può espellere qualcuno che è già dentro. È l'invariante che
protegge la fiducia dei partecipanti e va imposta a livello di dati, non di interfaccia.

---

## 10. Interazioni con il resto del sistema

| Ambito | Comportamento |
|---|---|
| **Vendita alla porta** | Attinge esattamente agli stessi contatori della vendita online. La cassa può quindi trovarsi davanti un esaurito in tempo reale, e riceve lo stesso messaggio dell'utente |
| **Accrediti e omaggi** | Consumano la quota riservata, la capienza della sala e le quote di ruolo; non consumano le quote di titolo |
| **Check-in** | **Non consuma quota.** Le quote governano l'ammissione, il contatore presenze di RF-CHK-13 governa la sicurezza. Sono due assi distinti e confonderli produce numeri incoerenti |
| **Indicatore di scarsità** | Calcolato su `limite − consumato` della quota più stretta tra quelle applicabili al ruolo dell'utente, ed esposto solo se `visibile_al_pubblico` |
| **Cruscotto organizzatore** | Lo sbilancio corrente si legge direttamente dai due contatori di ruolo: non serve alcun calcolo aggregato |
| **Assenza di liste d'attesa** | Coerente con il modello: quando `consumato = limite` non esiste alcuna coda da promuovere |
| **Canali esterni** | La piattaforma affianca la biglietteria dell'organizzatore. Le vendite fuori piattaforma consumano il **contingente riservato** (`riservata_a = CANALE_ESTERNO`) tramite registrazione manuale delle quantità, e consumano comunque la capienza della sala. Senza questo meccanismo i contatori descrivono solo metà della realtà, e la disponibilità mostrata al pubblico è sistematicamente sovrastimata |

---

## 11. Disponibilità parziale in checkout

Recepisce la seconda decisione approvata: **non si fa fallire un'iscrizione da 90 euro per una
cena da 25.**

```
alla richiesta di pagamento:
  verifica preliminare (senza impegno) di tutte le quote applicabili

  se sono sature soltanto quote di ambito SERVIZIO:
      → non rifiutare l'ordine
      → segnalare le righe indisponibili con il motivo
      → proporre la rimozione di quelle righe e il ricalcolo del totale
      → richiedere una conferma esplicita dell'utente
      → procedere con l'ordine ridotto

  se è satura una quota di ambito EVENTO, TITOLO o SESSIONE limitante:
      → rifiutare l'ordine con l'indicazione precisa di cosa manca
      → nel caso della sessione, nominare la sessione e il ruolo
```

La conferma esplicita è obbligatoria: un ordine che si riduce da solo dopo il pagamento è un
addebito non corrispondente a ciò che l'utente ha visto.

Messaggi proposti:

| Caso | Messaggio |
|---|---|
| Servizio esaurito | «La cena di gala è appena andata esaurita. Puoi completare l'iscrizione senza la cena: il totale scende a €90. Confermi?» |
| Sessione limitante satura | «Il workshop avanzato di domenica è completo per il ruolo follower, e fa parte del Full Pass. Puoi acquistare il Milonga Pass oppure iscriverti come leader se balli entrambi i ruoli» |
| Titolo esaurito | «Il Full Pass è esaurito. Sono ancora disponibili: Milonga Pass, ingresso singolo di sabato» |

---

## 12. Invarianti da verificare in continuo

| # | Invariante |
|---|---|
| I1 | La **quota parte di consumo proveniente dalla vendita online** non supera mai `limite + sforamento_ammesso`, e non supera mai `limite` sulla capienza della sala. Il consumo totale, che comprende emissioni manuali e canali esterni, può eccedere: è informativo e sotto la responsabilità dell'organizzatore |
| I2 | `consumato` coincide con la somma delle `quantita` dei `ConsumoQuota` collegati |
| I3 | Ogni iscrizione attiva ha un consumo su tutte le quote a lei applicabili, e su nessun'altra |
| I4 | Nessuna iscrizione attiva senza `ruolo_assegnato` su eventi con quote di ruolo |
| I5 | Su eventi con tolleranza configurata, `|L − F| ≤ tolleranza` — con la sola eccezione documentata delle riallocazioni manuali di limite decise dall'organizzatore |
| I6 | Nessun `ConsumoQuota` collegato a iscrizioni rimborsate o annullate |
| I7 | La somma dei consumi sulle quote di ruolo dell'evento non supera il consumo della quota totale dell'evento |

Le invarianti I2 e I7 sono le candidate naturali a un controllo periodico automatico con
allarme: una divergenza è il primo sintomo di una condizione di corsa sfuggita ai test.

---

## 13. Casistica di test

| # | Scenario | Esito atteso |
|---|---|---|
| T1 | Milonga senza quote di ruolo, 119 su 120, acquisto di 1 posto | Ammesso, contatore a 120 |
| T2 | Stessa milonga a 120 su 120 | Rifiutato, motivo `ESAURITO` |
| T3 | Un residuo, ordine da 2 posti | Rifiutato interamente: nessun consumo parziale |
| T4 | 110/110 tolleranza 5, stato 40 L e 35 F, un leader singolo | Rifiutato, motivo `RUOLO_IN_ATTESA` |
| T5 | Stesso stato, un follower singolo | Ammesso |
| T6 | Stesso stato, una coppia | Ammessa: lo sbilancio non cambia |
| T7 | Limite leader 60, stato 60 L e 55 F, un leader | Rifiutato con motivo `ESAURITO`, non `RUOLO_IN_ATTESA` |
| T8 | Ruolo flessibile con 40 L e 35 F | Assegnato follower |
| T9 | Ruolo flessibile con quote e consumi identici | Assegnato leader per convenzione, in modo deterministico |
| T10 | Full Pass con sessione **limitante** satura per il ruolo | Rifiutato, con nome della sessione e del ruolo nel messaggio |
| T11 | Full Pass con sessione **non limitante** satura | Ammesso; il contatore della sessione supera il limite ed è segnalato al cruscotto |
| T12 | Cena esaurita, titolo disponibile | Ordine non rifiutato: segnalazione, proposta di rimozione, conferma, ordine ridotto |
| T13 | Rimborso di un'iscrizione con pass, 4 sessioni e cena | Sei contatori decrementati esattamente, righe di consumo cancellate |
| T14 | Trasferimento a titolare con ruolo diverso, nuovo ruolo saturo | Rifiutato, nessun contatore modificato |
| T15 | Trasferimento a titolare con lo stesso ruolo | Contatori invariati, titolare aggiornato |
| T16 | Riduzione del limite leader da 110 a 100 con 105 consumati | Rifiutata, con proposta di chiusura a 105 |
| T17 | Due pagamenti concorrenti sull'ultimo posto | Un solo impegno riesce; l'altro è rifiutato all'avvio del pagamento, prima di qualunque addebito |
| T17b | Quota commerciale al limite con `sforamento_ammesso = 2`, due acquisti successivi | Entrambi ammessi, contatore a `limite + 2`; il terzo è rifiutato |
| T17c | Quota di capienza della sala al limite, `sforamento_ammesso` forzato a 0 | Rifiutato, e il campo non è modificabile dall'organizzatore |
| T17d | Ordine avviato e mai completato | Capienza rilasciata alla scadenza della prenotazione, posto di nuovo acquistabile |
| T17e | Prenotazione scaduta mentre l'utente è sulla pagina del prestatore di pagamento | Il riarmo all'avvio del pagamento deve averlo impedito; se accade comunque e il pagamento riesce, si applica la tolleranza di sforamento o, oltre quella, il rimborso integrale |
| T17f | Stesso utente che avvia due ordini in parallelo sullo stesso evento | Il secondo è rifiutato: una sola prenotazione attiva per utente e per evento |
| T17g | Processo di recupero delle prenotazioni scadute non rilasciate | I contatori tornano coerenti con l'invariante I2 senza intervento manuale |
| T18 | Doppia notifica del PSP sullo stesso ordine | Contatori invariati al secondo tentativo |
| T19 | Accredito staff su evento con quote di ruolo | Consuma quota accrediti, capienza sala e quota di ruolo; non consuma la quota di titolo |
| T20 | Vendita alla porta a evento esaurito online | Rifiutata, con lo stesso messaggio mostrato al pubblico |
| T21 | Scioglimento di una coppia su evento che ammette iscrizioni individuali | Nessun movimento sui contatori |
| T22 | Evento senza alcuna quota configurata | Vendita senza limiti, nessun errore |
| T23 | Cinquanta acquisti simultanei su dieci posti residui | Esattamente dieci ammessi, quaranta rifiutati, nessun contatore oltre il limite |

Il caso T23 è quello da automatizzare come test di carico: la finestra di apertura delle
vendite di un evento atteso è precisamente questo scenario.


---

<!-- ============================================================ -->
<!-- SORGENTE: 06-audit-analisi.md -->
<!-- ============================================================ -->

# Mirada Tango — Audit critico dell'analisi

**Data** 30 luglio 2026 · Revisione dei documenti da `01` a `05`

Autoverifica dell'analisi: contraddizioni tra documenti, temi non trattati, definizioni
ambigue. Ogni voce riporta dove si trova il problema e una proposta di risoluzione. Le voci
marcate **[DECISIONE]** non possono essere chiuse dall'analista.

Sintesi: **5 contraddizioni**, **13 buchi di analisi**, **5 punti di chiarezza formale**.

## Stato delle risoluzioni — aggiornato al 31 luglio 2026

> **L'audit è chiuso integralmente.** I punti da **B3 a C5** sono chiusi in
> `11-chiusura-audit.md`, che ne riporta la risoluzione punto per punto e i 34 requisiti che ne
> discendono. Le tre scelte di merito del committente — ammissione dei minori (D10), adozione
> della classificazione automatica delle immagini (D11), regime delle contestazioni di addebito
> (D12) — sono state **confermate il 31 luglio 2026**, tutte secondo la raccomandazione
> dell'analista.
>
> Il testo che segue è la versione originale dell'audit del 30 luglio, conservata perché
> documenta il problema così come è stato rilevato. Le proposte in esso contenute sono state in
> parte superate dalle risoluzioni: fa fede `11`.


| # | Esito |
|---|---|
| **A1** impegno di capienza | **Chiuso.** La capienza si impegna **all'avvio del pagamento**, con rilascio su fallimento o scadenza tecnica. Uno **sforamento di pochi posti sulle quote commerciali è accettato** in fase 1 e non genera rimborsi automatici. Recepito in `04` RB2, RB4, RF-PAY-8/9/11 e in `05` §5.1. *Con una sola eccezione introdotta dall'analista: la capienza della sala non ammette sforamento, essendo un limite di sicurezza e non commerciale* |
| **A2** natura della fee | **Chiuso nel merito.** I diritti di prevendita sono **ricavo della piattaforma, pagati dal partecipante**, e non transitano mai dall'organizzatore. L'ipotesi di maturarli come credito verso l'organizzatore è scartata. Resta un vincolo tecnico: la ripartizione in un pagamento unico dipende da cosa supporta ciascun prestatore (`04` §6.5) |
| **A3** doppio cancello di approvazione | **Chiuso.** Eliminata la moderazione del primo evento: il controllo della piattaforma avviene una volta sola, all'approvazione dell'organizzazione |
| **A4** stato `utilizzato` del biglietto | **Rinviato** alla sessione dedicata a titoli e pass. Applicata nel frattempo la sola correzione neutra: l'utilizzo è un check-in sulla coppia biglietto-sessione, con sessione implicita per gli eventi semplici. Non pregiudica nessuna scelta futura sui titoli |
| **A5** cardinalità Biglietto ↔ Iscrizione | **Chiuso.** Una iscrizione per persona per evento, con più biglietti collegati. Consumi di capienza, requisiti, ruolo e presenze sull'iscrizione; valore economico e trasferibilità sul biglietto |
| **B1** tesseramento | **Chiuso per esclusione dallo scopo.** Il tesseramento avviene interamente fuori dalla piattaforma: nessuna entità da modellare, nessuna vendita di quota associativa, nessuna verifica automatica. Dove un organizzatore deve accertarlo, usa una dichiarazione |
| **B2** modello fiscale | **Semplificato**: tutti i titoli sono biglietti commerciali, con prezzo dell'organizzatore più diritti di prevendita della piattaforma. Cade la doppia natura del titolo. **Resta aperto il regime del titolo di accesso** (`08` §3.2 bis), che questa scelta rende attuale anziché eventuale |
| **B3** chargeback | **Chiuso** (`11` §3). Ciclo della contestazione preso in carico dalla piattaforma per conto dell'organizzatore: fascicolo di prova automatico, esito applicato come un rimborso, monitoraggio del tasso. RF-PAY-27→32 e RF-PAY-38, RF-ORG-13, RB22. **D12** confermata: penale al prestatore a carico dell'organizzatore, doppia soglia di attenzione e sospensione |
| **B4** moderazione immagini e nickname | **Chiuso** (`11` §3). Classificazione automatica preventiva delle sole immagini, con trattenimento selettivo; filtro sul nickname e facoltà di oscurarlo. RF-WALL-43/44/45, RF-ACC-9, RB23. **D11** confermata: la classificazione è adottata |
| **B5** consenso dei terzi | **Chiuso** (`11` §3). Stato `da_confermare` che non blocca l'ingresso, facoltà di rifiuto che restituisce il biglietto all'acquirente, minimizzazione dei dati raccolti. RF-PAY-33, RF-CPL-13→16, RB24 |
| **B6** abilitazione all'incasso | **Chiuso** (`11` §3). Si verifica lo stato di abilitazione e non il collegamento; la decadenza sospende la vendita, mai i biglietti emessi. RF-ORG-10→12, RB13 modificata |
| **B7** annullamento di una sessione | **Chiuso** (`11` §3). Peso di ripartizione per sessione, rimborso proporzionale senza scaglioni, soglia oltre la quale scatta il rimborso integrale. RF-EVT-35/36/37, RF-RMB-12/13 |
| **B8** carnet | **Chiuso per conseguenza**: il carnet serve alle milonghe ricorrenti, uscite dal segmento con la decisione sul tesseramento. Dipendenza dichiarata in `11` §3 |
| **B9** minori | **Chiuso** (`11` §3). Tre soglie: account da 14 anni, sotto i 14 iscrizione da parte di un adulto senza account, chat riservata ai maggiorenni. RF-ACC-10/11/12, RF-EVT-38. **D10** confermata: i minori sono ammessi |
| **B10** prova e presidio della wall | **Chiuso** (`11` §3). Modalità prova con carta di calibrazione, rotazione di sicurezza sui soli contenuti già approvati, contenuti di servizio programmabili. RF-WALL-46→49 |
| **B11** chat senza check-in | **Chiuso** (`11` §3). Sblocco di sala tramite il QR della schermata di cortesia, con codice a rotazione; avviso in configurazione. RF-CHK-16/17, RF-EVT-39, RB11 modificata |
| **B12** archivio e conservazione | **Chiuso** (`11` §3). Consenso che dichiara il riutilizzo, esportazione ristretta ai soli contenuti proiettati, registro delle esportazioni. RF-WALL-50→53, RF-WALL-24 modificata |
| **B13** carrello multi-organizzatore | **Chiuso** (`11` §3). Suddivisione in un ordine per organizzatore; i diritti di prevendita calcolati **per biglietto** eliminano la questione «fee per ordine o per riga». RF-PAY-34→37, RF-PAY-1 modificata |
| **C1 → C5** forma e chiarezza | **Chiusi** (`11` §3). C1 come regola, con esecuzione pianificata alla revisione 1.2; C2, C3, C4 e C5 recepiti in `04` |

### Nuovo elemento emerso da questa decisione

Escludere il tesseramento chiude un debito di analisi e **ne apre uno più grande**: era la
natura associativa a tenere la maggior parte degli eventi di ballo fuori dal regime del titolo
di accesso fiscale. Senza quella, la verifica fiscale sullo strato 3 di `08` passa da
raccomandazione a **precondizione per aprire le vendite del primo evento reale**.

---

## Parte A — Contraddizioni da risolvere prima dello sviluppo

### A1. Quando esattamente si impegna la capienza — **[DECISIONE]**

**Dove**: `04` RB2, RF-PAY-8, RF-PAY-11 · `05` §5, nota finale

I documenti dicono due cose diverse. `04` afferma che la capienza si impegna «alla conferma
dell'incasso, mai prima» e che gli ordini scaduti non hanno «mai impegnato capienza».
L'allegato `05` afferma che «l'impegno avviene prima dell'incasso definitivo e si rilascia se
il pagamento fallisce». Sono due progetti diversi, non due formulazioni dello stesso.

**Aggravante non considerata**: ho descritto la finestra di impegno come «di millisecondi».
È vero solo per la carta con addebito immediato. PayPal e Satispay portano l'utente fuori
dall'applicazione: Satispay richiede di aprire l'app e confermare, e la finestra reale è di
**minuti**. Le due varianti hanno quindi conseguenze molto diverse:

| Variante | Vantaggio | Costo |
|---|---|---|
| Impegno alla conferma d'incasso (come in `04`) | Nessun posto bloccato da checkout abbandonati | Doppia vendita possibile per l'intera durata del redirect: con Satispay, minuti. Il rimborso automatico di RB4 diventa un evento frequente, non un caso limite |
| Impegno all'avvio del pagamento, rilascio su fallimento o scadenza (come in `05`) | Doppia vendita praticamente azzerata | È un hold tecnico di alcuni minuti. Contraddice formalmente la decisione «niente prenotazione temporanea», anche se non è un hold di carrello |

**Proposta**: adottare la seconda variante con scadenza tecnica breve ed esplicita (proposta:
10 minuti, e comunque la durata della sessione di pagamento del PSP, che va configurata in
minuti e non lasciata al default), riscrivere RB2 come «la capienza non è mai impegnata dal
carrello: si impegna all'avvio del pagamento e si rilascia in caso di fallimento o
scadenza», e mantenere RB4 come rete di sicurezza per il caso residuo. Serve la conferma del
committente, perché ridefinisce una decisione già presa.

### A2. La fee «pagata dal partecipante» non lo è su PayPal e Satispay — **[DECISIONE]**

**Dove**: `04` AS1, RB1, RF-PAY-6, nota §6.5 opzione (c) · `01` tabella monetizzazione

La decisione è che la fee sia pagata dal partecipante, esposta come voce separata. La
soluzione proposta per PayPal e Satispay — maturare la fee come credito e addebitarla
all'organizzatore con rendiconto periodico — **capovolge la natura della fee**: il
partecipante paga un importo unico all'organizzatore, e la piattaforma incassa dall'organizzatore.
Fiscalmente e contrattualmente diventa una commissione a carico dell'organizzatore, non del
partecipante, e la voce «fee di piattaforma» esposta in checkout diventa una
rappresentazione non corrispondente al flusso reale del denaro.

Non è un dettaglio contabile: cambia chi è il cliente della piattaforma, chi emette quale
documento e chi ha diritto a cosa in caso di rimborso.

**Proposta**: unificare il modello anziché differenziarlo per PSP. Due strade coerenti:
*(i)* la fee è **sempre** una commissione dell'organizzatore, e il prezzo esposto la include
già — l'organizzatore alza il prezzo di listino se vuole scaricarla sul partecipante,
esattamente come fa oggi con le commissioni bancarie; *(ii)* si accettano solo PSP che
supportano nativamente la commissione di marketplace, e Satispay entra solo quando e se lo
supporta. La strada (i) è più semplice e più onesta verso il partecipante; la (ii) preserva
la decisione originale ma riduce i metodi di pagamento.

**Da chiudere anche**: la reversibilità della fee maturata in caso di rimborso integrale
(RF-RMB-8 impone la restituzione della fee: se la fee è già stata fatturata
all'organizzatore, serve una nota di credito).

### A3. Due cancelli di approvazione, uno dei quali non deciso — **[DECISIONE]**

**Dove**: `04` RF-ORG-2, RF-ORG-3, RF-EVT-15 · `01` onboarding

La decisione presa è che l'**organizzazione** sia approvata dal super admin. Ma RF-EVT-15
prevede anche uno stato `in_approvazione` per il **primo evento** dell'organizzazione: è un
residuo della mia proposta iniziale, che il committente non ha né confermato né respinto,
perché la domanda riguardava l'onboarding e non gli eventi.

**Proposta**: eliminare la moderazione del primo evento. Se l'organizzazione è già stata
verificata da una persona, un secondo cancello aggiunge attrito e un compito ricorrente al
super admin senza aggiungere garanzie. Se invece si vuole tenerlo, va detto con quale
criterio si approva un evento e in quanto tempo, perché un organizzatore che non può
pubblicare è un organizzatore che se ne va.

### A4. Lo stato `utilizzato` del biglietto è incompatibile con i pass multi-sessione

**Dove**: `04` RF-TCK-4, RF-CHK-4, RF-CHK-8, RB7

RF-TCK-4 mette `utilizzato` tra gli stati del **biglietto**. Ma RF-CHK-8 prevede il check-in
per singola sessione: un Full Pass viene scansionato dodici volte in tre giorni. Con lo stato
sul biglietto, il secondo ingresso risulterebbe «già utilizzato».

**Proposta** (risolvibile dall'analista): togliere `utilizzato` dagli stati del biglietto e
tenere gli stati `valido`, `trasferito`, `annullato`, `rimborsato`. L'utilizzo è un attributo
della coppia *(biglietto, sessione)*, non del biglietto: esiste un CheckIn per sessione, e
l'esito «già utilizzato» di RF-CHK-4 va inteso come «già utilizzato **per questa sessione**».
Per gli eventi senza sessioni si usa una sessione implicita, così il modello resta unico.

### A5. La relazione Biglietto ↔ Iscrizione non è definita

**Dove**: `04` §5.1 diagramma, §5.2 «Iscrizione» · `05` §2.2

Il diagramma collega RigaOrdine a Biglietto ma non collega mai Biglietto a Iscrizione, e il
testo dice che l'iscrizione è «una per persona nell'evento». Se una persona compra un Milonga
Pass **e** un workshop singolo ha due biglietti: una iscrizione o due? La domanda non è
teorica, perché l'allegato registra i consumi di capienza per `iscrizione_id`.

**Proposta** (risolvibile dall'analista): **una Iscrizione per persona per evento**, con
relazione uno-a-molti verso i Biglietti. I consumi restano ancorati all'iscrizione, e le
quote di titolo vengono consumate una per ciascun titolo posseduto. Va aggiunto al diagramma
il collegamento mancante e va dichiarata la cardinalità.

---

## Parte B — Buchi di analisi

### B1. L'entità Tesseramento non esiste nel modello dati

**Dove**: `04` RF-REQ-2, §5 · decisione confermata su tesseramento associativo

RF-REQ-2 verifica «la tessera registrata a sistema», ma nel modello concettuale non esiste
alcuna entità che rappresenti una tessera. Manca tutto: associazione emittente, numero,
data di emissione e scadenza, quota versata, stato.

C'è anche una conseguenza multi-tenant non considerata: **una tessera è emessa da una
specifica associazione e non vale per un'altra.** Se l'organizzatore A richiede il
tesseramento, non può accettare la tessera dell'associazione B. Il requisito va quindi
parametrizzato con l'ente emittente ammesso, e il partecipante può avere più tessere attive.

Manca inoltre la **vendita della tessera come riga d'ordine**: RF-REQ-2 la menziona, ma
`RigaOrdine` prevede solo titoli e servizi, e la quota associativa ha una natura fiscale
diversa da un biglietto — non è un corrispettivo per una prestazione, è un versamento
associativo.

### B2. Il modello fiscale è completamente assente

**Dove**: `04` AS6, RF-PAY-6, RF-PAY-12, Q5

L'analisi dice che i prezzi sono netti dell'organizzatore e che la fee è esposta a parte, ma
non dice mai se i prezzi sono comprensivi di imposta, quale aliquota si applichi, né come si
comporta il sistema con organizzatori che hanno regimi diversi. È un buco rilevante proprio
per il pubblico atteso: molti organizzatori di tango sono associazioni in regime agevolato o
con attività decommercializzata verso i soci, altri sono società con IVA ordinaria, altri
sono persone fisiche senza partita IVA.

Serve almeno: il regime fiscale come attributo dell'organizzazione, l'imposta come attributo
della riga d'ordine, la distinzione tra corrispettivo e quota associativa, e la scelta se il
prezzo inserito dall'organizzatore sia lordo o netto d'imposta. La fee di piattaforma è in
ogni caso una prestazione di servizi soggetta a IVA ordinaria.

### B3. Chargeback e contestazioni non sono trattati

**Dove**: nessun documento

Non esiste un requisito sulle contestazioni di addebito. In un modello con incasso diretto
sull'account dell'organizzatore, il chargeback colpisce l'organizzatore, ma la richiesta di
prova arriva alla piattaforma, che è l'unica a possedere la traccia dell'acquisto e del
check-in. Serve: notifica della contestazione, raccolta automatica delle prove (ordine,
biglietto, orario di check-in, indirizzo di rete, accettazione delle condizioni),
invalidazione del biglietto in caso di esito negativo, e una politica sulla sospensione degli
organizzatori con un tasso di contestazioni anomalo.

### B4. La chat libera non ha moderazione automatica delle immagini

**Dove**: `04` RF-WALL-7, RF-WALL-9, R4

La decisione «chat libera, wall curata» è stata analizzata solo per la wall. Ma senza
pre-moderazione **una foto esplicita è immediatamente visibile a tutti i partecipanti**, anche
se non raggiungerà mai il maxischermo. RF-WALL-9 prevede un filtro automatico sul solo
linguaggio. La mitigazione R4 protegge la proiezione, non la chat.

**Proposta**: classificazione automatica delle immagini prima della pubblicazione in chat,
con sospensione del solo contenuto sospetto in attesa del moderatore — una pre-moderazione
selettiva che non rallenta il flusso normale. In alternativa, dichiarare esplicitamente il
rischio accettato.

Correlato: **il nickname non è moderato.** È l'unico dato dell'autore proiettato su un
maxischermo, ed è scelto liberamente dall'utente. Serve un filtro e la possibilità per il
moderatore di sostituirlo o oscurarlo.

### B5. Manca il consenso della persona iscritta da altri

**Dove**: `04` RF-PAY-3, RF-CPL-6, RF-CPL-8, §9

Chi acquista inserisce nome, cognome, email e ruolo di ballo di altre persone: il partner di
coppia e gli amici per cui compra. L'analisi prevede una notifica, non un'accettazione. Ma i
dati di un terzo vengono trattati senza che quel terzo abbia fatto nulla, e alla persona
vengono attribuiti un ruolo di ballo e una partecipazione a un evento.

**Proposta**: il partner o l'ospite riceve una richiesta di conferma; fino alla conferma il
biglietto è valido ma l'iscrizione è in stato `da_confermare`, e i dati trattati sono i soli
minimi necessari all'emissione del titolo. Va inoltre esplicitata nell'informativa la base
giuridica del trattamento dei dati inseriti da terzi.

### B6. Non è previsto il caso dell'account di incasso non abilitato

**Dove**: `04` RF-ORG-5

Collegare un account non significa poter incassare: la verifica di identità del PSP può
restare incompleta, o essere revocata dopo, con il risultato che i fondi si accumulano senza
poter essere trasferiti. Serve: verifica dello stato di abilitazione prima della
pubblicazione, controllo periodico, blocco della pubblicazione di nuovi eventi se
l'abilitazione decade, e avviso all'organizzatore con l'indicazione di cosa manca.

### B7. Manca l'annullamento di una singola sessione

**Dove**: `04` RF-EVT-19, RF-RMB-8

È previsto l'annullamento dell'evento intero, non quello di una sessione: il maestro che si
ammala e salta un workshop dentro un festival che si svolge regolarmente. Serve poter
annullare una sessione, calcolare la quota di rimborso proporzionale per chi l'aveva nel
proprio pass, e comunicare ai soli interessati. È il caso più frequente in assoluto tra
quelli non coperti.

### B8. Manca il carnet di ingressi

**Dove**: `04` RF-EVT-7, RF-EVT-17

Per le milonghe e le pratiche ricorrenti, l'abbonamento a ingressi multipli — «dieci serate
da usare quando vuoi» — è la forma di vendita più diffusa dopo il biglietto singolo, ed è la
principale leva di fidelizzazione delle scuole. Il modello attuale non lo prevede: un titolo
è legato a un evento e a sessioni specifiche. Serve un titolo a consumo, con numero di
ingressi residui, validità temporale e decremento al check-in.

### B9. I minori non sono considerati

**Dove**: `04` §9

Le scuole di tango hanno corsi e stage per adolescenti, e alcune milonghe hanno fasce
pomeridiane aperte ai minori. Manca: la registrazione di un minore, il consenso di chi
esercita la responsabilità genitoriale, l'età minima per l'account, e l'esclusione dei minori
dalla chat. Anche solo la scelta di non ammettere minori va dichiarata, perché è comunque una
scelta di prodotto.

### B10. La wall non ha modalità di prova né comportamento senza moderatore

**Dove**: `04` §6.11

Due assenze pratiche che si scoprono in sala, cioè troppo tardi:

- **Prova tecnica**: serve una modalità che proietti contenuti campione per verificare
  proiettore, risoluzione, leggibilità e colori durante l'allestimento, prima che arrivi
  chiunque.
- **Moderatore assente**: se nessuno presidia la console — perché è mezzanotte e il
  moderatore sta ballando — la coda si svuota e lo schermo resta sulla cortesia per ore. Va
  deciso se esiste una rotazione automatica dei contenuti già approvati, se i contenuti di
  servizio possono essere programmati in anticipo, e cosa si mostra in assenza di presidio.

### B11. La chat è irraggiungibile negli eventi senza check-in

**Dove**: `04` RF-CHK-14, RF-WALL-2

L'accesso alla chat è subordinato al check-in. Ma molti organizzatori non scansionano nulla:
milonga a ingresso libero, serata con lista alla porta, evento gratuito. In quegli eventi la
chat non si sblocca per nessuno e il modulo è inerte, senza che il sistema lo segnali.

**Proposta**: prevedere uno sblocco alternativo — il **QR di sala** già previsto sulla
schermata di cortesia (RF-WALL-34) può valere come check-in leggero per la sola chat, con
verifica del possesso di un titolo valido. E in fase di configurazione, se il modulo chat è
attivo su un evento senza check-in previsto, il sistema deve avvisare.

### B12. L'archivio della wall contraddice la politica di conservazione

**Dove**: `04` RF-WALL-24, RF-WALL-12, §9

RF-WALL-24 consente all'organizzatore di scaricare in blocco tutti i contenuti approvati.
RF-WALL-12 e la sezione privacy prevedono la cancellazione automatica dei contenuti dopo un
periodo. Le due cose insieme significano che la cancellazione è puramente nominale: le copie
sono già fuori dal sistema.

**Proposta**: dichiararlo nel consenso al primo invio — «le foto proiettate possono essere
conservate e riutilizzate dall'organizzatore» — e limitare l'esportazione ai soli contenuti
effettivamente proiettati, che sono già stati resi pubblici in sala. Un contenuto approvato ma
mai proiettato non deve finire nell'archivio.

### B13. Il carrello multi-organizzatore non è risolto

**Dove**: `04` RF-PAY-1

Il requisito consente più eventi «dello stesso organizzatore», ma non dice cosa accade quando
l'utente aggiunge un evento di un secondo organizzatore. Con incassi diretti su account
distinti, un pagamento unico non è possibile.

**Proposta**: il carrello si suddivide automaticamente in un ordine per organizzatore, con
pagamenti separati e sequenziali, e l'interfaccia lo dichiara prima del pagamento. Va deciso
se la fee si applica per ordine o per riga, perché con una fee a importo fisso la differenza
è percepibile.

---

## Parte C — Chiarezza e forma

### C1. La numerazione dei requisiti è fuori sequenza

Le integrazioni della revisione 1.1 hanno prodotto sequenze come RF-EVT-9 → RF-EVT-20 →
RF-EVT-10, e RF-PAY-13 → RF-PAY-15 → RF-PAY-14. Funziona come riferimento univoco, ma in un
documento destinato al cliente sembra trascuratezza. Da rinumerare in modo continuo alla
prossima revisione, con una tabella di corrispondenza se gli identificativi sono già stati
citati altrove.

### C2. «Posto letto» e «gestione alloggi» sembrano in contraddizione

`04` §5.2 elenca il posto letto tra i servizi accessori del primo rilascio; la roadmap mette
la «gestione alloggi con matching di ospitalità» in fase 3. Sono due cose diverse — vendere
un letto in convenzione non è organizzare l'ospitalità tra ballerini — ma il documento non lo
dice e la contraddizione è apparente. Da distinguere esplicitamente.

### C3. Le lezioni private del primo rilascio non sono quelle della fase 2

Nel primo rilascio la lezione privata è un servizio accessorio con uno slot orario scelto tra
quelli predisposti dall'organizzatore. In fase 2 diventa una prenotazione sul calendario del
maestro, con disponibilità reali. Da dichiarare, altrimenti sembra una funzione ripetuta o
già presente.

### C4. La traduzione riguarda solo la scheda evento

RF-PUB-9 prevede una seconda lingua per i contenuti dell'organizzatore, ma i testi che il
partecipante straniero deve capire per forza sono altri: le dichiarazioni da accettare, i
nomi dei requisiti, le descrizioni dei servizi, la policy di rimborso. Da estendere a tutti i
testi redatti dall'organizzatore, o da limitare dichiaratamente.

### C5. Non è definito cosa fa scattare `vendita_chiusa`

RF-EVT-15 prevede lo stato ma non il criterio: data e ora di chiusura, esaurimento,
decisione manuale, o inizio dell'evento. Sono quattro comportamenti diversi e vanno tutti
previsti come alternative configurabili.

---

## Priorità di risoluzione

| Prima di scrivere codice | Prima del primo evento reale | Alla prossima revisione |
|---|---|---|
| A1 impegno di capienza · A2 natura della fee · A3 doppia approvazione · A4 stato del biglietto · A5 cardinalità · B1 tesseramento · B2 modello fiscale | B3 chargeback · B4 moderazione immagini e nickname · B5 consenso dei terzi · B6 abilitazione all'incasso · B10 prova della wall · B11 chat senza check-in · B12 archivio e conservazione | B7 sessione annullata · B8 carnet · B9 minori · B13 carrello multi-organizzatore · tutta la parte C |

Le tre voci **[DECISIONE]** — A1, A2, A3 — sono quelle che non posso chiudere: ridefiniscono
scelte già prese dal committente.

---

## Esito finale

Tutte e ventuno le voci di questo audit sono chiuse. La tabella dello stato in testa al
documento indica per ciascuna dove è stata risolta:

| Blocco | Dove è stato chiuso |
|---|---|
| A1, A2, A3, A5 | Quinto giro di decisioni (`01`) |
| A4 | Settimo giro e `09-titoli-e-pass.md` §7 |
| B1, B2 | Sesto e ottavo giro (`01`), con `08` §3.2 bis |
| B3 → C5 | `11-chiusura-audit.md` |

Le tre scelte di merito del committente — **D10** minori, **D11** classificazione delle
immagini, **D12** regime delle contestazioni — sono state confermate il 31 luglio 2026, tutte
secondo la raccomandazione dell'analista. **Nessuna voce di questo audit resta aperta.**


---

<!-- ============================================================ -->
<!-- SORGENTE: 07-piano-premium.md -->
<!-- ============================================================ -->

# Mirada Tango — Il piano Premium per i ballerini

**Data** 30 luglio 2026 · Allegato a `04-analisi-funzionale.md` §6.16 · Chiude la questione aperta Q3

---

## 1. Il modello

L'applicazione di base resta **gratuita**: registrarsi, consultare il calendario e il
programma, acquistare biglietti, ricevere i propri titoli e fare il check-in non costano nulla
e non costeranno nulla. È la scelta corretta anche dal punto di vista commerciale: un
marketplace che mette un pedaggio davanti all'acquisto riduce le vendite su cui guadagna la
fee.

Il Premium è un **secondo motore di ricavo**, indipendente dal primo, con una caratteristica
che lo rende interessante: non è pagato dagli organizzatori, non riduce il loro margine e non
richiede la loro adesione — con **una sola eccezione**, l'accesso prioritario, di cui al §5.

Le due linee di ricavo si comportano in modo complementare: la fee sui biglietti è
stagionale e legata agli eventi, l'abbonamento è ricorrente e prevedibile.

---

## 2. Il catalogo dei diritti

Ogni funzionalità Premium è un **diritto** verificato dall'unico servizio di controllo già
previsto in RF-PRM-2. Aggiungerne uno è configurazione, non sviluppo.

| Diritto | Cosa sblocca | Valore percepito | Costo di realizzazione |
|---|---|---|---|
| `ricerca_partner_avanzata` | Ricerca e contatto di partner per ruolo, livello, città ed evento (§4) | **Alto** — è il bisogno più sentito dai ballerini singoli | Alto: è una funzione nuova, con implicazioni di sicurezza |
| `accesso_anticipato` | Apertura delle iscrizioni in anticipo sul pubblico, sugli eventi e sugli slot che l'organizzatore include (§5) | **Alto** su eventi e maestri richiesti, nullo sugli altri | Medio: estende le finestre di vendita già previste |
| `chat_evento` | Scrittura nella chat di sala | Medio, e solo durante l'evento | Nullo: già previsto |
| `profilo_verificato` | Livello attestato da un maestro presente in piattaforma, con badge | Medio-alto: risolve il problema dell'autodichiarazione | Medio |
| `annuncio_in_evidenza` | Annuncio cerco-partner in cima ai risultati | Medio | Basso |
| `avvisi_anticipati` | Notifica sull'apertura delle iscrizioni degli eventi seguiti, prima dell'annuncio pubblico | Medio-alto: nel tango gli eventi ambiti si esauriscono in minuti | Basso |
| `archivio_personale` | Download delle proprie foto proiettate sulla wall e dei contenuti dell'evento | Basso-medio | Basso |
| `storico_personale` | Statistiche di partecipazione: eventi, maestri, DJ, città, andamento nel tempo | Basso, ma alto in affezione | Basso |
| `fee_ridotta` | Fee di piattaforma azzerata o dimezzata sui biglietti | Alto e misurabile in euro | Nullo tecnicamente, ma erode la prima linea di ricavo |

## 2.1 La composizione decisa

**Un solo piano, 4,99 € all'anno**, che sblocca tutti i diritti del catalogo tranne
`fee_ridotta`. Nessuna opzione mensile: la stagionalità del tango — attività ferma a luglio e
agosto, ripresa a settembre — rende l'abbonamento annuale la forma naturale, e ne elimina il
problema delle disdette estive.

`fee_ridotta` è **escluso**, come deciso. A una fee del 5% si ripagherebbe con 100 € di
biglietti, cioè un solo festival, e cannibalizzerebbe la linea di ricavo principale proprio
sugli utenti più attivi.

## 2.2 Che cosa significa davvero 4,99 € all'anno

A questo prezzo il Premium **non è un motore di ricavo, ed è importante saperlo in partenza**
perché cambia i criteri con cui va giudicato. I conti, per abbonato e per anno:

| Voce | Importo |
|---|---|
| Prezzo al pubblico, IVA inclusa | 4,99 € |
| IVA ordinaria da versare | −0,90 € |
| Commissione del prestatore di pagamento (ordine di grandezza su un importo così piccolo) | −0,32 € |
| **Netto per la piattaforma** | **≈ 3,77 €** |

Tremila abbonati producono circa 11.000 € l'anno; diecimila ne producono circa 38.000. Sono
cifre che non finanziano lo sviluppo della ricerca partner né, soprattutto, il presidio umano
di moderazione che quella funzione richiede in permanenza. **L'incidenza della commissione di
pagamento è del 6-8%**, molto più alta che su un biglietto da 40 €: su importi minimi la
componente fissa pesa in modo sproporzionato.

Questo non rende la scelta sbagliata: la rende **una scelta diversa da quella che sembra**. A
4,99 € all'anno il Premium svolge bene tre funzioni che valgono più del ricavo:

1. **Qualifica le persone.** Un pagamento, anche minimo, filtra chi ha intenzioni serie. Su una
   funzione di contatto tra sconosciuti in una community sensibile alle molestie, avere una
   transazione tracciata e un'identità verificata dietro ogni richiesta è una misura di
   sicurezza che vale più di 4,99 €. È l'argomento migliore per giustificare il paywall.
2. **Massimizza l'adozione.** A questo prezzo la conversione sarà alta, e la ricerca partner ha
   bisogno esattamente di questo: densità. Una funzione di matching a 60 € l'anno resterebbe
   vuota e inutile.
3. **Apre un rapporto diretto e ricorrente** con il ballerino, indipendente dagli organizzatori.

**Raccomandazione**: presentare il Premium come qualificazione e appartenenza, non come
pacchetto di funzioni a valore. E considerare i 4,99 € un prezzo di lancio, con una revisione
programmata dopo il primo anno di dati sulla conversione: alzare il prezzo a rinnovo su una
base già acquisita è molto più facile che partire alti su una funzione vuota.

**Conseguenza operativa dell'annuale**: il rinnovo avviene una sola volta l'anno, quindi la
carta registrata sarà scaduta in una quota fisiologica di casi. Servono un preavviso di rinnovo
obbligatorio, tentativi ripetuti con recupero dello strumento di pagamento, e un periodo di
tolleranza prima della decadenza dei diritti.

---

## 3. Il livello di ballo, che è il prerequisito di tutto

La ricerca partner «dello stesso livello» richiede un dato che oggi non esiste nel modello:
il **livello del ballerino**. Il livello è attualmente un attributo delle sessioni, non delle
persone.

Il problema non è tecnico. Nel tango l'autodichiarazione del livello è notoriamente
inaffidabile — quasi tutti si collocano al centro — e il livello è anche un segnale di status
usato per selezionare con chi si balla. Una funzione a pagamento costruita su un dato
autodichiarato produce incontri sbagliati e delusione verso la piattaforma, cioè esattamente
il contrario di ciò che si vende.

**Proposta: tre fonti, mostrate insieme e mai fuse in un'etichetta unica.**

| Fonte | Come si ottiene | Attendibilità |
|---|---|---|
| **Dichiarato** | L'utente scelge tra principiante, intermedio, avanzato, e indica gli anni di pratica | Bassa, ma è il punto di partenza |
| **Desunto** | Calcolato dallo storico in piattaforma: quali sessioni ha frequentato e con quale livello, quanti eventi, in quanto tempo | **Alta**, e la piattaforma è l'unica a possederlo |
| **Attestato** | Un maestro presente in piattaforma conferma il livello di un allievo, su richiesta | Massima, ma disponibile per pochi |

Il livello desunto è l'elemento distintivo: nessun gruppo social o bacheca esistente può
calcolarlo, perché nessuno possiede lo storico delle partecipazioni. Diventa credibile dopo
qualche mese di dati reali, e questo ha una conseguenza sulla tempistica di lancio (§8).

Nell'interfaccia il confronto va sempre motivato — «ha frequentato quattro workshop di livello
avanzato negli ultimi dodici mesi» — anziché ridotto a un'etichetta. Una motivazione visibile
è verificabile dall'utente, un'etichetta no.

---

## 4. La ricerca partner avanzata

### 4.1 Che cosa è, e che cosa non deve diventare

È uno **strumento di ricerca con richiesta di contatto**, non una chat aperta e non un feed.
La distinzione è il cuore del progetto di questa funzione: una piattaforma di tango che
introduce messaggistica libera tra sconosciuti, con filtri per livello e città e a pagamento,
si avvicina involontariamente a un'app di incontri. La community del tango è particolarmente
sensibile al tema — le molestie nelle sale da ballo sono un problema reale e discusso — e la
reputazione si perde una volta sola.

| Previsto | Escluso deliberatamente |
|---|---|
| Ricerca per ruolo, livello, città, lingua, evento a cui si partecipa | Ricerca per genere o per età |
| Richiesta di contatto con messaggio di presentazione | Messaggistica libera senza consenso |
| Messaggistica **solo dopo accettazione reciproca** | Chi è online adesso, chi è nei paraggi |
| Città di riferimento | Posizione precisa o distanza in chilometri |
| Foto di profilo opzionale, moderata | Galleria di foto personali |
| Visibilità del profilo su adesione esplicita | Profili indicizzati o visibili a chi non è registrato |

### 4.2 L'asimmetria che rende il paywall sostenibile

Il diritto Premium sblocca **l'iniziativa, non la conversazione**: chi ha il Premium può
cercare e inviare richieste di contatto; chi non lo ha **riceve le richieste e può rispondere
liberamente**.

È la sola configurazione che funziona. Se anche la risposta fosse a pagamento, gli abbonati
scriverebbero a un muro e il valore del Premium sarebbe nullo il primo giorno. Così invece
ogni nuovo abbonato trova immediatamente un bacino di interlocutori raggiungibili, e chi
riceve una richiesta ha un motivo concreto per abbonarsi a sua volta.

### 4.3 Tutele, che non sono mai a pagamento

**Principio non negoziabile: nessuna funzione di tutela può essere Premium.** Blocco,
segnalazione, controllo della propria visibilità, cancellazione dei dati e limiti alle
richieste ricevute sono gratuiti per tutti, sempre. Un paywall sulla sicurezza è indifendibile
e sarebbe il primo appunto di qualunque osservatore.

| Tutela | Comportamento |
|---|---|
| Consenso reciproco | Nessun messaggio oltre la richiesta iniziale prima dell'accettazione |
| Limite alle richieste | Massimo configurabile di richieste inviate al giorno, anche per gli abbonati |
| Limite alle richieste ricevute | L'utente può sospendere la ricezione o restringerla a chi partecipa ai suoi stessi eventi |
| Blocco | Immediato, silenzioso, definitivo, e impedisce anche la comparsa nei risultati di ricerca |
| Segnalazione | Con presa in carico dalla moderazione di piattaforma e tempi dichiarati |
| Codice di condotta | Accettazione obbligatoria all'attivazione della funzione, con conseguenze dichiarate |
| Provvedimenti | Sospensione della sola funzione senza perdita dei biglietti acquistati, e rimborso proporzionale dell'abbonamento in caso di sospensione non dovuta a violazione |
| Nessuna reciprocità obbligata | Ignorare una richiesta non produce alcun segnale visibile a chi l'ha inviata |

L'ultima riga conta più di quanto sembri: l'assenza di conferme di lettura e di indicatori di
rifiuto elimina la pressione sociale che, nelle app di messaggistica, genera l'insistenza.

### 4.4 Rapporto con le funzioni già previste

Oggi l'analisi prevede già una **bacheca cerco-partner** gratuita, legata a un singolo evento
(`04` §6.9). La ricerca avanzata non la sostituisce: la bacheca resta gratuita e ancorata
all'evento, la ricerca è trasversale, continuativa e filtrata. Vanno però presentate come una
sola funzione con due livelli di profondità, non come due strumenti diversi, altrimenti
l'utente non capisce dove cercare.

---

## 5. L'accesso prioritario

### 5.1 Come funziona

Tecnicamente è un'estensione di una funzione già prevista: RF-EVT-7 assegna a ogni titolo una
**finestra di vendita**. Basta aggiungere che una finestra possa essere riservata a un piano
per un periodo definito.

```
Titolo "Lezione privata con Maestro X — slot domenica 15:00"
  apertura riservata Premium : 1 marzo, 10:00
  apertura pubblica          : 3 marzo, 10:00
```

Vale sia per gli slot delle lezioni private, sia per i titoli d'ingresso degli eventi ambiti,
sia per i servizi accessori a capienza ridotta.

### 5.2 Il problema che non è tecnico — **[DECISIONE]**

L'accesso prioritario ha una particolarità che lo distingue da ogni altro diritto del
catalogo: **la piattaforma venderebbe un vantaggio su inventario che non è suo.** I posti
sono dell'organizzatore, gli slot sono del tempo del maestro. Non si può disporne
unilateralmente, né contrattualmente né come rapporto di fiducia.

Serve quindi che l'inclusione sia **una scelta dell'organizzatore, evento per evento**, e va
deciso cosa l'organizzatore riceve in cambio:

| Ipotesi | Cosa ottiene l'organizzatore | Nota |
|---|---|---|
| Adesione gratuita con vantaggio reciproco | Visibilità in evidenza verso gli abbonati, che sono il pubblico più attivo e più propenso a comprare | La più semplice, e probabilmente sufficiente: l'apertura anticipata riempie l'evento prima e riduce l'invenduto |
| Quota di ricavo | Una percentuale dell'abbonamento redistribuita | Complessa da calcolare e da spiegare, con un'attribuzione arbitraria |
| Contropartita in fee | Fee ridotta sugli eventi che aderiscono | Erode la prima linea di ricavo |

**Proposta**: adesione gratuita e volontaria, con misurazione del beneficio (percentuale di
riempimento nella finestra anticipata) da mostrare all'organizzatore. Se il beneficio è reale
l'adesione si sostiene da sé; se non lo è, nessuna quota di ricavo la renderà accettabile.

### 5.3 Tre vincoli di equità

Senza questi, l'accesso prioritario danneggia il prodotto più di quanto lo monetizzi.

1. **Trasparenza**: le date di apertura anticipata e pubblica sono dichiarate sulla pagina
   dell'evento fin dalla pubblicazione. Nessuna scarsità nascosta.
2. **Tetto sull'inventario riservato**: una percentuale massima configurabile — proposta 30% —
   di posti allocabili nella finestra anticipata. Se il Premium può esaurire tutto, la
   disponibilità pubblica diventa una finzione e la reazione della community è garantita.
3. **Nessuna coda a pagamento**: il vantaggio è una finestra temporale anticipata, non una
   priorità all'interno della stessa finestra. Due abbonati che comprano nello stesso momento
   competono ad armi pari, come previsto dal motore di capienza.

---

## 6. Conflitti con decisioni già prese

| # | Conflitto | Proposta |
|---|---|---|
| P1 | La chat di evento richiede il Premium (`04` RF-WALL-2, RB11) | **Risolto: la chat resta Premium**, come deciso. L'obiezione era calibrata su un abbonamento mensile; a 4,99 € **all'anno** perde quasi tutta la sua forza, perché l'accesso alla chat di sala costa al partecipante circa quaranta centesimi al mese. Resta un solo accorgimento necessario: la scheda dell'evento e la conferma d'ordine devono dire **prima dell'acquisto** che la chat di sala richiede il Premium, così nessuno lo scopre in sala a evento iniziato |
| P2 | Il perimetro è «solo ticketing, community bassa»: nessun profilo pubblico, nessuna messaggistica. La ricerca partner introduce entrambi | La decisione va aggiornata: il prodotto ha ora una componente relazionale a pagamento. Non è un cambio di rotta accidentale, ma va reso esplicito perché sposta il profilo di rischio e i requisiti di moderazione |
| P3 | «Nessuna lista d'attesa, nessuna prenotazione temporanea, primo che paga»: l'accesso anticipato non le contraddice, perché agisce sulla finestra di apertura e non sulla coda | Nessuna modifica. Va però chiarito nei testi pubblici, perché al ballerino sembrerà una corsia preferenziale |
| P4 | Le lezioni private sono in fase 2 come prenotazione sul calendario del maestro; in primo rilascio sono slot venduti come servizio accessorio | L'accesso anticipato funziona su entrambe le forme, perché agisce sulla finestra di vendita. Nessun blocco |
| P5 | Il livello di ballo non esiste come attributo della persona | Va aggiunto al profilo, con le tre fonti del §3. Il livello desunto richiede storico, quindi tempo |

---

## 7. Fatturazione, adempimenti, recesso

L'abbonamento è la **prima vendita diretta della piattaforma al consumatore finale**, e non
passa dagli account degli organizzatori. Conseguenze concrete:

| Tema | Requisito |
|---|---|
| Incasso | Account di pagamento proprio della piattaforma, distinto dall'infrastruttura marketplace usata per i biglietti |
| Imposta | Prestazione di servizi con IVA ordinaria. Il prezzo di 4,99 € va dichiarato come comprensivo d'imposta |
| Documento | Ricevuta o fattura elettronica al consumatore, emessa dalla piattaforma, con numerazione propria |
| Addebito ricorrente | Autenticazione forte al primo addebito, mandato per i successivi, gestione dei tentativi falliti con periodo di tolleranza e sospensione graduata |
| Rinnovo | Comunicazione prima del rinnovo, disdetta con lo stesso numero di clic della sottoscrizione |
| Cessazione | I diritti restano attivi fino alla fine del periodo pagato, poi decadono senza cancellare dati o biglietti |
| **Diritto di recesso** | **Si applica.** L'esclusione di quattordici giorni valida per i biglietti di eventi con data certa **non copre i servizi digitali in abbonamento**: serve la richiesta esplicita di esecuzione immediata con informativa sulla perdita del recesso, oppure va concesso il recesso. Da validare con il legale |
| Prezzi e comunicazione | Variazione di prezzo comunicata in anticipo, con facoltà di disdetta prima dell'applicazione |

L'ultima riga della tabella è quella che viene dimenticata più spesso: un abbonamento a
4,99 € ha obblighi informativi che un biglietto per una milonga non ha.

---

## 8. Quando lanciarlo

**Decisione: attivazione in fase 2, a data fissa**, indipendentemente dai numeri raggiunti. Il
Premium resta interamente progettato e presente nel modello dati con il suo interruttore già
dal primo rilascio.

La data fissa rinuncia alla garanzia che le soglie di massa critica sarebbero servita, e va
quindi compensata con misure di riempimento del bacino. La buona notizia è che **il prezzo
scelto lavora nella stessa direzione**: a 4,99 € all'anno la conversione è alta, quindi la
densità di profili si costruisce in fretta. Le due decisioni — data fissa e prezzo minimo — si
sostengono a vicenda; sarebbero state incompatibili con un prezzo mensile.

Restano tre condizioni da preparare **prima** della data di attivazione, altrimenti la funzione
apre vuota:

1. **Lancio per densità, non per copertura.** La ricerca partner va aperta prima sugli eventi e
   sulle città dove esiste massa — un festival con quattrocento iscritti, una scuola con
   duecento allievi — e solo dopo estesa a tutto il calendario. Una ricerca nazionale su un
   bacino sottile restituisce risultati vuoti; la stessa ricerca circoscritta a un evento reale
   funziona dal primo giorno.
2. **Bacino precostituito.** La bacheca cerco-partner per evento, gratuita già nel primo
   rilascio, è il primo mattone: alla data di attivazione la piattaforma deve già sapere chi
   cerca un partner, con quale ruolo e per quale evento. Va previsto un invito diretto a queste
   persone.
3. **Livello desunto già alimentato.** Richiede storico di partecipazioni, che si accumula solo
   con il tempo: se la data di attivazione cade prima che esistano mesi di dati reali, il
   matching si baserà sulla sola autodichiarazione. In quel caso è meglio **non presentare il
   livello come garanzia** ma come indicazione, e attivare l'attestazione da parte dei maestri,
   che non dipende dall'anzianità della piattaforma.

Va inoltre deciso se la data di attivazione coincide con l'inizio della fase 2 o cade più
avanti dentro di essa: la fase 2 contiene anche corsi e lezioni private, e la ricerca partner
non ha alcuna dipendenza da quelle.

---

## 9. Rischi propri del Premium

| # | Rischio | Impatto | Mitigazione |
|---|---|---|---|
| RP1 | **Attivazione a data fissa su una base ancora sottile**: la ricerca partner apre con pochi profili e non mantiene la promessa | Alto, e brucia la fiducia una volta sola | Lancio per densità e non per copertura, bacino precostituito dalla bacheca, invito diretto a chi cerca partner (§8). Il prezzo minimo aiuta: la conversione alta riempie il bacino in fretta |
| RP1b | **Il ricavo non copre il costo di presidio**: a ≈3,77 € netti per abbonato l'anno, la moderazione umana della ricerca partner costa più di quanto la funzione incassi ai volumi iniziali | Medio-alto sulla sostenibilità | Riconoscere il Premium come strumento di qualificazione e non come linea di ricavo (§2.2), dimensionare la moderazione sul volume reale di richieste, prevedere una revisione del prezzo dopo il primo anno di dati |
| RP2 | La ricerca partner diventa un canale di molestie, con effetti sulla reputazione dell'intera piattaforma | **Il più alto del prodotto** | Consenso reciproco, tutele gratuite, moderazione presidiata, codice di condotta, nessuna funzione di prossimità |
| RP3 | Il livello autodichiarato produce incontri mal assortiti e delusione | Medio-alto | Livello desunto e attestato, motivazione del confronto sempre visibile |
| RP4 | Gli organizzatori percepiscono l'accesso anticipato come una disposizione arbitraria del loro inventario | Alto sul rapporto con i clienti principali | Adesione volontaria, evento per evento, con beneficio misurato |
| RP5 | La community percepisce il prodotto come un'app di incontri travestita | Alto e difficilmente reversibile | Esclusioni deliberate del §4.1, linguaggio dei testi, nessuna funzione di scoperta casuale |
| RP6 | ~~`fee_ridotta` cannibalizza la linea di ricavo principale~~ | — | **Chiuso**: il diritto è escluso dal piano |
| RP7 | ~~Disdette stagionali estive concentrate~~ | — | **Chiuso**: il piano è solo annuale |
| RP7b | **Rinnovi annuali falliti**: con un solo addebito l'anno, una quota fisiologica di carte è scaduta al rinnovo | Medio sul tasso di rinnovo | Preavviso obbligatorio, tentativi ripetuti, recupero dello strumento di pagamento, periodo di tolleranza prima della decadenza dei diritti |
| RP7c | **Incidenza della commissione di pagamento del 6-8%** su un importo così piccolo, contro l'1-2% di un biglietto | Basso in valore assoluto, rilevante in percentuale | Verificare le condizioni per micropagamenti col prestatore scelto; nessun costo aggiuntivo da introdurre a carico dell'utente |
| RP8 | Doppia natura fiscale della piattaforma: intermediaria sui biglietti, venditrice diretta sugli abbonamenti | Medio | Separare i flussi contabili dall'inizio, non dopo |

---

## 10. Decisioni da prendere

### Chiuse

| # | Decisione | Esito |
|---|---|---|
| D1 | Struttura del prezzo | **Un solo piano, 4,99 € all'anno**, che sblocca tutti i diritti. Nessuna opzione mensile |
| D2 | Chat di evento gratuita o Premium | **Resta Premium**, con l'obbligo di dichiararlo prima dell'acquisto del biglietto |
| D4 | `fee_ridotta` nel piano | **No**, escluso |
| D5 | Momento di attivazione | **Fase 2, a data fissa**, con le tre condizioni preparatorie del §8 |
| D6 | Piano annuale | **Sì, ed è l'unica forma prevista** |

### Ancora aperte

| # | Decisione |
|---|---|
| D3 | Contropartita per l'organizzatore che aderisce all'accesso anticipato (proposta: nessuna, con beneficio misurato e mostrato) |
| D7 | La data di attivazione coincide con l'inizio della fase 2 o cade più avanti dentro di essa? La ricerca partner non ha dipendenze da corsi e lezioni private |
| D8 | Se alla data di attivazione lo storico di partecipazioni è ancora sottile, il livello viene presentato come indicazione anziché come garanzia e si punta sull'attestazione dei maestri: si accetta? |
| D9 | Revisione del prezzo dopo il primo anno di dati sulla conversione: si programma da subito nelle condizioni contrattuali? |


---

<!-- ============================================================ -->
<!-- SORGENTE: 08-modello-ticketone.md -->
<!-- ============================================================ -->

# Mirada Tango — Adottare un modello "alla TicketOne": fattibilità e impegno

**Data** 30 luglio 2026 · Allegato a `04-analisi-funzionale.md` §6.5

> **Avvertenza.** Le valutazioni fiscali e normative di questo documento vanno verificate con un
> commercialista specializzato in spettacolo e intrattenimento e, per la parte SIAE, con un
> operatore autorizzato. Sono materia specialistica in cui l'errore ha un costo, e le regole
> cambiano. Quanto segue serve a impostare le domande giuste, non a sostituire il parere.

---

## 1. "Come TicketOne" sono tre sistemi, non uno

Quando si dice «facciamo come TicketOne» si mettono insieme tre strati che hanno costi e
rischi completamente diversi. Separarli è la parte più utile di questa analisi.

| Strato | Che cos'è | Serve a Mirada? | Costo |
|---|---|---|---|
| **1. Modello commerciale** | Prezzo dell'organizzatore + diritti di prevendita della piattaforma, esposti separatamente | **Sì, già deciso e già progettato** | Nullo: è quanto c'è nell'analisi |
| **2. Modello di incasso** | La piattaforma incassa tutto e riversa all'organizzatore, trattenendo le proprie spettanze | **Da decidere.** Oggi l'analisi prevede l'incasso diretto dell'organizzatore | Basso-medio tecnicamente, medio-alto su piano legale e amministrativo |
| **3. Emissione fiscale del titolo di accesso** | Biglietto certificato con sigillo fiscale, numerazione progressiva e rendicontazione all'Agenzia delle Entrate tramite SIAE | **Dipende dal tipo di organizzatore**, ed è la domanda che conta | **Alto**, e in gran parte non è sviluppo |

Lo strato 1 è fatto. Lo strato 2 è una scelta reversibile a basso costo se la si prepara ora.
Lo strato 3 è un progetto a sé.

---

## 2. Strato 2 — La piattaforma incassa e riversa

### Cosa cambia rispetto a oggi

L'analisi attuale prevede l'incasso diretto sull'account dell'organizzatore, con i diritti di
prevendita trattenuti dalla piattaforma. Il modello TicketOne è l'opposto: **incassa la
piattaforma**, che poi riversa all'organizzatore secondo una cadenza concordata — spesso dopo
l'evento.

| Aspetto | Incasso diretto (attuale) | Incasso della piattaforma (TicketOne) |
|---|---|---|
| Ripartizione dei diritti di prevendita | Dipende da cosa supporta il prestatore: **è il problema aperto su Satispay** | Risolto per costruzione: la piattaforma ha già tutto in mano |
| Rimborsi | Attingono al saldo dell'organizzatore, che può essere insufficiente | Attingono ai fondi trattenuti: molto più semplice e sicuro |
| Annullamento evento | Se l'organizzatore ha già speso l'incasso, i rimborsi sono un problema suo e diventano un problema di reputazione della piattaforma | La piattaforma può trattenere fino a evento concluso e garantire i rimborsi |
| Cassa dell'organizzatore | Incassa subito, ed è ciò che gli piace | Incassa dopo, e va negoziato |
| Onere amministrativo | Basso | **Alto**: fondi di terzi, riconciliazione, rendiconti, riversamenti, contenzioso |
| Inquadramento | La piattaforma è un intermediario tecnologico | La piattaforma **maneggia denaro di terzi**: va verificato l'inquadramento rispetto alla normativa sui servizi di pagamento, tipicamente appoggiandosi a un'esenzione o a un prestatore autorizzato |

### La conseguenza pratica più utile

Il modello di regolamento va **astratto adesso**. Se il sistema tratta il "chi incassa" come
una configurazione dell'organizzazione — incasso diretto oppure incasso della piattaforma con
riversamento — la scelta resta aperta e reversibile, anche organizzatore per organizzatore.
Prepararlo ora costa poco; rifarlo dopo significa riscrivere checkout, rimborsi, riconciliazione
e reportistica.

**Stima**: circa **3-5 settimane** di sviluppo per il modello di incasso alternativo, più
**3-4 settimane** per riversamenti, riconciliazione e rendiconti verso gli organizzatori. Il
lavoro legale e amministrativo è parallelo e non tecnico.

---

## 3. Strato 3 — L'emissione fiscale del titolo di accesso

### 3.1 Di cosa si tratta

È la parte che rende TicketOne "un sistema" e non un carrello. In Italia gli eventi soggetti a
imposta sugli intrattenimenti o al regime IVA dello spettacolo richiedono che il biglietto sia
emesso attraverso un **sistema di emissione certificato**: numerazione progressiva, sigillo
fiscale generato da un dispositivo approvato, dati dell'organizzatore e dell'evento sul titolo,
e trasmissione periodica dei dati all'Agenzia delle Entrate tramite SIAE come concessionaria.

Un PDF con QR code, che è quanto prevede l'analisi attuale, **non è un titolo di accesso
fiscale**. Va benissimo come titolo per attività associativa o per eventi non soggetti; non
sostituisce il titolo certificato dove questo è richiesto.

### 3.2 La domanda che decide tutto

**I tuoi organizzatori sono soggetti a quel regime?**

| Tipo di organizzatore | Situazione tipica | Titolo fiscale richiesto? |
|---|---|---|
| Associazione (ASD, APS) che apre la serata ai **soci**, con quota associativa e tesseramento | La forma con cui è organizzata la maggioranza delle milonghe italiane | **Verosimilmente no**: non è vendita al pubblico ma attività verso i propri associati |
| Associazione che vende ingressi al **pubblico** | Frequente nei festival | **Probabilmente sì** |
| Soggetto commerciale con ingresso a pagamento, serata danzante | Festival e marathon organizzati in forma d'impresa | **Sì** |
| Evento gratuito, con o senza registrazione | Pratiche, presentazioni | No |

Il trattenimento danzante ricade storicamente tra gli intrattenimenti soggetti a imposta, ed è
proprio questo che porta con sé l'obbligo del titolo di accesso. La porta d'uscita esisteva ed
è quella che la scena italiana usa da sempre: **l'attività verso i soci**.

### 3.2 bis — Aggiornamento dopo la decisione sul tesseramento

**Quella porta è stata chiusa per scelta.** Il committente ha deciso che la piattaforma vende
**solo biglietti commerciali** e che il tesseramento resta interamente fuori. La conseguenza è
diretta e va messa in chiaro:

- Non esiste più la strada «i nostri organizzatori non rientrano nel regime perché operano
  verso i soci». Ogni titolo venduto è un corrispettivo commerciale.
- Per gli eventi soggetti al regime degli intrattenimenti, **l'obbligo del titolo di accesso
  fiscale diventa attuale**, non più eventuale.
- Il perimetro di mercato del primo rilascio si sposta di conseguenza su **festival, marathon,
  encuentro e stage** — che sono anche gli eventi con il biglietto più alto e il maggior
  bisogno di quote per ruolo e iscrizione a coppia. Le milonghe settimanali associative
  restano fuori.

La domanda «serve o non serve la parte più costosa del progetto» non si chiude quindi con il
tesseramento, ma con una verifica fiscale: **quali eventi di ballo con ingresso a pagamento
rientrano oggi nel regime del titolo di accesso.** È una consulenza breve con conseguenze molto
grandi, ed è ora il primo punto da chiudere.

### 3.3 Le tre strade, se serve

| Strada | Cosa comporta | Tempi | Valutazione |
|---|---|---|---|
| **Certificarsi come sistema di emissione** | Conformità del software, dispositivi per il sigillo fiscale, procedura di approvazione, obblighi di conservazione e di rendicontazione, verifiche | **6-12 mesi**, in gran parte non sviluppo | Da escludere per una fase 1. Non è un problema di codice, è un percorso amministrativo |
| **Integrare un emittente autorizzato** in modalità white label | La piattaforma resta il punto di vendita, il titolo fiscale lo emette un operatore già autorizzato che risponde della conformità | **3-6 mesi** di cui gran parte contrattuale; sviluppo dell'integrazione **4-8 settimane** | **La strada raccomandata** se e quando serve. Costo per titolo emesso, dipendenza da un terzo, ma rischio normativo trasferito |
| **Non servire, per ora, gli organizzatori che ne hanno bisogno** | Il primo rilascio si rivolge ad associazioni con attività verso i soci e a eventi non soggetti | Nessun tempo aggiuntivo | Sostenibile, e coerente con il mercato di partenza. Va però dichiarato: è una scelta di segmento, non una dimenticanza |

---

## 4. Quello che a TicketOne serve e a Mirada no

Vale la pena dirlo, perché evita di ereditare una complessità che non serve. Buona parte del
costo di un ticketing generalista sta in funzioni che nel tango sono irrilevanti:

| Funzione di TicketOne | Perché non serve |
|---|---|
| **Mappa dei posti e inventario per singolo posto** | Nelle milonghe non esistono posti numerati. È la componente più costosa di un ticketing per spettacoli, e qui si azzera |
| Coda virtuale per aperture con decine di migliaia di utenti | Gli ordini di grandezza sono altri: centinaia, non decine di migliaia |
| Distribuzione fisica su rete di punti vendita | Il canale è solo online, più la vendita alla porta già prevista |
| Integrazione con circuiti di rivendita secondaria | Il trasferimento del nominativo già previsto copre il bisogno reale |
| Gestione di abbonamenti a stagione teatrale con posto fisso | Non applicabile |

In compenso Mirada ha bisogno di tre cose che TicketOne non fa: **quote per ruolo di ballo**,
**iscrizione a coppia** e **check-in offline in sala**. È il motivo per cui il prodotto ha senso
di esistere.

---

## 5. Risposta sintetica

**È fattibile?** Sì, interamente. Nessuno dei tre strati presenta ostacoli tecnici.

**Impegna tante risorse?** Dipende dallo strato:

| Strato | Impegno |
|---|---|
| Modello commerciale dei diritti di prevendita | **Già previsto**, nessun costo aggiuntivo |
| Incasso della piattaforma con riversamento | **6-9 settimane** di sviluppo, più lavoro legale e amministrativo parallelo. Se il modello di regolamento viene astratto ora, il costo di tenere aperte entrambe le opzioni è di circa **1 settimana** |
| Emissione fiscale del titolo di accesso | **3-6 mesi**, in prevalenza contrattuali e non di sviluppo, e con un costo ricorrente per titolo. **Da non mettere in fase 1** |

Le stime sono indicative: non essendo stato definito lo stack né la dimensione del team, sono
espresse in settimane di lavoro e non in date.

---

## 6. Raccomandazione

1. **Lo strato 3 esce dallo scopo per posizionamento.** Gli adempimenti fiscali restano
   dell'organizzatore e si svolgono fuori dalla piattaforma, come già avviene oggi: Mirada è un
   canale di vendita ed emette una conferma d'ordine con QR, non un titolo fiscale. Restano da
   presidiare le tre condizioni che tengono in piedi questa impostazione — dichiarazione
   dell'organizzatore, natura non fiscale del documento, esportazioni complete — e un residuo
   consapevole: quando la piattaforma è l'unico canale di vendita di un evento, la
   qualificazione di semplice prevendita è più esposta.
2. **Astrarre subito il modello di incasso** come configurazione dell'organizzazione: costa una
   settimana ora e tiene aperta la strada TicketOne senza riscritture.
3. **Astrarre l'emissione del titolo** dietro un'interfaccia con due implementazioni previste:
   titolo interno con QR firmato, e titolo fiscale delegato a un emittente autorizzato. La
   seconda resta non implementata finché non serve.
4. **Anticipare la sessione sul tesseramento**, perché è quella che dice se lo strato 3 serve o
   no. È la decisione con il maggiore effetto leva su costi e tempi dell'intero progetto.
5. **Far verificare a un commercialista dello spettacolo** quali categorie di organizzatori
   rientrano nel regime del titolo di accesso, prima di aprire le iscrizioni del primo evento
   reale. È una domanda da poche ore di consulenza e da conseguenze molto grandi.


---

<!-- ============================================================ -->
<!-- SORGENTE: 09-titoli-e-pass.md -->
<!-- ============================================================ -->

# Mirada Tango — Titoli d'ingresso e pass

**Data** 31 luglio 2026 · Allegato a `04-analisi-funzionale.md` §6.3 · Chiude la sessione rinviata su RF-EVT-7 e RF-EVT-8, e la correzione provvisoria A4

---

## 1. Il problema

Un evento di tango non vende "il biglietto". Vende una combinazione di accessi che cambia
completamente da una tipologia all'altra, e che l'organizzatore compone da sé — coerentemente
con il principio che regge tutta l'analisi.

| Tipologia | Cosa vende in pratica |
|---|---|
| **Marathon / Encuentro** | Un **pass unico** per tutto l'evento, prezzo unico, quote per ruolo strette. Non si vende a serata: la selezione dei partecipanti è il prodotto |
| **Festival** | Pass completo, pass solo workshop, pass solo milonghe, ingresso alla singola serata, singolo seminario, talvolta lo spettacolo separato |
| **Stage / workshop** | Il singolo seminario, oppure un pacchetto di più seminari a prezzo ridotto, spesso con prezzo diverso per chi si iscrive in coppia |
| **Milonga** | Ingresso singolo, eventualmente ridotto per chi ha fatto la lezione che precede |

Il modello deve reggere tutti e quattro senza casi particolari nel codice. La chiave è che il
titolo non è una categoria: è **un insieme di sessioni più un prezzo più delle regole**.

---

## 2. Anatomia di un titolo d'ingresso

| Attributo | Significato |
|---|---|
| `nome`, `descrizione` | Ciò che il partecipante legge. "Full Pass", "Pass Milonghe", "Solo sabato" |
| `sessioni_incluse` | **Elenco esplicito** delle sessioni a cui dà accesso |
| `prezzo` | Con gli scaglioni del §4 |
| `unita_di_vendita` | `per_persona` oppure `per_coppia`: un titolo a coppia è un prezzo unico che vale due posti |
| `vincolo_ruolo` | Nessuno, oppure riservato a leader o a follower |
| `richiede_ruolo` | Se falso, il titolo non consuma quote di ruolo: è il caso dell'accompagnatore non ballerino e dello spettatore dello spettacolo |
| `finestra_di_vendita` | Da quando a quando è acquistabile, con l'eventuale apertura anticipata riservata al piano Premium |
| `visibilita` | Pubblico, oppure riservato e accessibile solo con un codice |
| `quantita_min_max` | Quanti se ne possono comprare in un solo ordine |
| `livello_indicato` | Il livello a cui il titolo si rivolge: **indicazione, non verifica** |
| `ordine_di_esposizione` | Come si presentano nella scheda evento, con l'eventuale evidenza sul titolo consigliato |

Le quote di capienza **non** sono un attributo del titolo: sono entità autonome che possono
riferirsi al titolo, come descritto in `05`. È ciò che consente di limitare 150 Full Pass e
contemporaneamente 30 posti nel workshop avanzato, senza che le due regole si intralcino.

---

## 3. Come si compone: l'elenco esplicito, con aiuti nella composizione

Il titolo conserva **un elenco esplicito** delle sessioni incluse, non una regola. Una regola —
«tutte le sessioni di tipo workshop» — sembra più elegante ma diventa insidiosa: se
l'organizzatore aggiunge un workshop a evento pubblicato, tutti i pass già venduti cambiano
silenziosamente contenuto, e chi ha comprato si trova un diritto diverso da quello acquistato.

La potenza sta quindi **nell'editor, non nel modello**: in fase di composizione l'organizzatore
dispone di selettori rapidi — *tutti i workshop*, *tutto il sabato*, *tutte le milonghe* — che
producono comunque un elenco esplicito e modificabile.

**Regola conseguente**: aggiungere una sessione a un evento pubblicato **non** la aggiunge
automaticamente ai titoli già venduti. Il sistema segnala la sessione orfana e chiede
all'organizzatore cosa farne, distinguendo i titoli non ancora venduti da quelli già acquistati.
Su questi ultimi l'aggiunta è possibile solo come miglioria — dare di più non lede nessuno —
mai come sottrazione.

---

## 4. Prezzi a scaglioni

**Gli scaglioni sono facoltativi.** Il comportamento predefinito di ogni titolo è il **prezzo
unico**, che non cambia mai da solo. Se l'organizzatore vuole farlo salire, definisce lui stesso
in fase di creazione **come e quando**: nessuna regola è imposta dalla piattaforma, e chi non
vuole occuparsene non incontra la funzione.

Quando l'organizzatore la attiva, dispone di queste forme:

| Tipo di scaglione | Come funziona | Uso tipico |
|---|---|---|
| **A data** | Fino al 31 gennaio 120 €, poi 140 €, dal 1 marzo 160 € | Early bird classico dei festival |
| **A quantità** | I primi 50 pass a 120 €, i successivi a 140 € | Spinge la decisione immediata, e riempie in fretta |
| **Combinato** | I primi 50 pass, e comunque non oltre il 31 gennaio | Il più usato in pratica: mette un tetto a entrambe le dimensioni |

Requisiti che ne discendono:

- Lo scaglione attivo e **quando o come scade** sono sempre visibili al partecipante: «120 € —
  restano 8 posti a questo prezzo» oppure «120 € fino al 31 gennaio». La scarsità dichiarata è
  onesta solo se è quella reale.
- Il prezzo si blocca **alla creazione dell'ordine**, non al pagamento: chi entra in checkout con
  l'early bird disponibile non se lo vede cambiare sotto durante i quindici minuti di
  prenotazione.
- Se lo scaglione a quantità si esaurisce mentre l'ordine è in corso, il prezzo bloccato resta
  valido fino alla scadenza della prenotazione. È il rovescio coerente della prenotazione
  temporanea.
- Il passaggio di scaglione è un evento tracciato, perché è la spiegazione dei picchi di vendita
  nel cruscotto.

---

## 5. Titoli venduti a coppia

Attributo `unita_di_vendita = per_coppia`: un prezzo, due posti, due iscrizioni con ruoli
complementari, un unico ordine. È la forma normale degli stage a coppie e di parte degli
encuentros.

Conseguenze già coperte dal resto dell'analisi: consuma un posto per ciascuna quota di ruolo,
supera sempre il cancello di tolleranza perché non altera lo sbilancio, e chi acquista inserisce
i dati del partner. Resta da fissare una sola regola nuova: il titolo a coppia **non è
acquistabile da solo**. Se una persona vuole partecipare senza partner, l'organizzatore deve
aver previsto anche un titolo per persona; altrimenti la bacheca cerco-partner è l'unica strada,
ed è bene che la scheda evento lo dica esplicitamente.

---

## 6. Sovrapposizioni tra titoli

Se un partecipante ha già il Full Pass e prova a comprare il singolo workshop del sabato, sta
pagando due volte lo stesso accesso.

**Proposta: avvisare, non bloccare.** Il sistema segnala la sovrapposizione con precisione — «il
workshop di sabato alle 15 è già incluso nel tuo Full Pass» — e lascia decidere. Bloccare
sarebbe presuntuoso: capita di comprare un secondo accesso per un amico, o di volerlo comunque.
Il doppio consumo della quota di sessione va però evitato, perché falserebbe i numeri: una
persona occupa un posto in una sessione, non due.

---

## 7. Titolo, iscrizione, biglietto e check-in

Qui si chiude la correzione provvisoria dell'audit A4.

```
Ordine ──► RigaOrdine ──► Biglietto ──┐
                                       ├──► Iscrizione  (una per persona per evento)
Ordine ──► RigaOrdine ──► Biglietto ──┘
                                       └──► CheckIn  (uno per sessione)
```

- Il **titolo** è il prodotto in vendita.
- Il **biglietto** è l'esemplare acquistato, nominale, trasferibile, con il suo QR.
- L'**iscrizione** è la persona nell'evento: ruolo di ballo, requisiti, consumi di capienza.
  Una sola per persona, anche con più biglietti.
- Il **check-in** è l'accesso a una singola sessione, e si registra sulla coppia
  biglietto-sessione.

Ne consegue, in via definitiva, che **l'utilizzo non è uno stato del biglietto**: un Full Pass
viene scansionato dodici volte in tre giorni e resta valido. Per gli eventi senza sessioni si usa
una sessione implicita, così il modello resta unico e il check-in di una milonga singola funziona
con lo stesso codice di quello di un festival.

Il QR è **uno solo per biglietto**, non uno per sessione: all'ingresso di ogni sessione
l'operatore scansiona lo stesso codice e il sistema determina se quella sessione è inclusa, se
è già stata usata e se il titolo è ancora valido. È anche l'unica soluzione praticabile in sala,
dove nessuno cerca il QR giusto tra dodici.

---

## 8. Catalogo di riferimento

Non è una configurazione obbligata, ma la base dei modelli precompilati che l'organizzatore
trova quando crea l'evento, così da non partire da un foglio bianco.

| Evento | Titoli proposti dal modello |
|---|---|
| **Marathon / Encuentro** | Pass unico per persona · Pass unico a coppia · Pass parziale per chi arriva il sabato |
| **Festival** | Full Pass · Pass Workshop · Pass Milonghe · Day Pass per ciascuna giornata · Ingresso singola milonga · Singolo workshop · Ingresso spettacolo senza ruolo |
| **Stage** | Singolo seminario per persona · Singolo seminario a coppia · Pacchetto di tutti i seminari con sconto |
| **Milonga** | Ingresso · Ingresso ridotto per chi frequenta il corso · Ingresso con lezione inclusa |

---

## 9. Fuori dal primo rilascio

| Funzione | Perché rinviarla |
|---|---|
| **Upgrade di titolo** (dal Pass Milonghe al Full Pass pagando la differenza) | È molto richiesta nei festival, ma tocca ordini già chiusi, documenti già emessi, quote di due titoli e rimborsi parziali. Merita di essere fatta bene, non in fretta |
| **Titolo a composizione libera** ("scegli 4 workshop tra 12") | Richiede un passaggio di scelta dentro il checkout, con le quote di sessione verificate su una selezione che l'utente sta ancora componendo. È la funzione più costosa dell'intero capitolo |
| **Titoli con prerequisito di livello verificato** | Il livello diventa un dato affidabile solo con lo storico, cioè con il Premium di fase 2. Fino ad allora il livello è un'indicazione e l'organizzatore rifiuta in sala, come fa oggi |
| **Abbonamento a ingressi multipli** (carnet) | Legato alle milonghe ricorrenti, che sono fuori dal segmento del primo rilascio dopo la decisione sul tesseramento |

---

## 10. Decisioni da prendere

Tutte chiuse.

| # | Decisione | Esito |
|---|---|---|
| T1 | Scaglioni di prezzo | **A data e a quantità, combinabili, e interamente facoltativi.** L'organizzatore definisce in fase di creazione come e quando il prezzo sale, se lo vuole; il default è prezzo unico che non cambia mai |
| T2 | Titolo a composizione libera nel primo rilascio | **No, fase 2**: è la funzione più costosa del capitolo |
| T3 | Upgrade di titolo nel primo rilascio | **No, fase 2** |
| T4 | Sovrapposizione tra titoli | **Avvisare senza bloccare**, ma senza doppio consumo delle quote di sessione |
| T5 | Titolo a coppia non acquistabile da solo | **Sì**, con avviso esplicito sulla scheda evento |


---

<!-- ============================================================ -->
<!-- SORGENTE: 10-briefing-verifica-fiscale.md -->
<!-- ============================================================ -->

# Briefing per la verifica fiscale — emissione dei titoli d'ingresso

**Destinatario**: commercialista specializzato in spettacolo e intrattenimento, e/o operatore di biglietteria autorizzato
**Oggetto**: obblighi di emissione dei titoli d'ingresso per eventi di tango argentino venduti tramite piattaforma online
**Data**: 31 luglio 2026

> **Stato: non più bloccante.** Il committente ha stabilito che gli adempimenti fiscali restano
> in capo all'organizzatore e si svolgono fuori dalla piattaforma, come già avviene oggi. La
> piattaforma è un canale di vendita: emette una conferma d'ordine con QR di accesso, non un
> titolo fiscale. Questo briefing resta valido e utile — per una consulenza di conferma, o da
> girare a un organizzatore che ponga la domanda — ma **non è una precondizione allo sviluppo**.
> Restano rilevanti in particolare le domande 5 e 8 e le ipotesi H4 e H5.

---

## 1. Contesto

Stiamo progettando una piattaforma di vendita online di ingressi a eventi di tango argentino
in Italia: festival, marathon, encuentro, stage didattici e serate danzanti (milonghe). Gli
eventi sono organizzati da soggetti terzi che si registrano sulla piattaforma.

Elementi rilevanti dell'impianto:

- **Tutti i titoli sono venduti come biglietti commerciali.** Non è prevista la vendita come
  quota di partecipazione riservata ai soci, e il tesseramento associativo resta fuori dalla
  piattaforma.
- Il prezzo del titolo è stabilito dall'organizzatore; la piattaforma aggiunge **diritti di
  prevendita** a proprio favore, pagati dal partecipante ed esposti come voce separata.
- **L'incasso avviene direttamente sull'account di pagamento dell'organizzatore**, con i diritti
  di prevendita ripartiti a favore della piattaforma sulla stessa transazione.
- Il titolo è oggi previsto come **PDF nominale con QR firmato**, verificato all'ingresso.
  Non è un titolo emesso da un sistema certificato.
- Gli organizzatori attesi sono eterogenei: società commerciali, associazioni con partita IVA,
  associazioni senza, persone fisiche che organizzano occasionalmente.
- Un singolo evento può vendere insieme **accessi didattici** (workshop e seminari) e **accessi
  a serate danzanti**, spesso dentro un unico pass a prezzo unico.

---

## 2. Le domande

### Inquadramento dell'attività

1. Un evento di tango con ingresso a pagamento rientra tra gli **intrattenimenti** o tra gli
   **spettacoli**? Il trattamento cambia a seconda che si tratti di sola serata danzante, di
   soli seminari didattici, o di un evento che comprende entrambi?
2. Il trattamento cambia in funzione della natura dell'organizzatore (società, associazione con
   o senza partita IVA, persona fisica occasionale)?
3. Esistono **soglie, esenzioni o regimi semplificati** applicabili per dimensione dell'evento,
   importo degli incassi, occasionalità o numero di eventi annui?

### Obbligo del titolo di accesso

4. Per gli eventi che rientrano nel regime, è obbligatorio che il titolo sia emesso attraverso
   un **sistema di emissione certificato** — con numerazione progressiva, sigillo fiscale e
   trasmissione dei dati — oppure sono ammesse forme alternative per la vendita esclusivamente
   online?
5. **Chi è il soggetto obbligato all'emissione**: l'organizzatore dell'evento o chi vende il
   titolo per suo conto? Quale ruolo assume una piattaforma online che raccoglie l'ordine ma non
   incassa direttamente il prezzo del titolo, che va sull'account dell'organizzatore?
6. È ammissibile che la piattaforma si appoggi a un **emittente già autorizzato**, in modalità
   white label, restando il punto di vendita verso il pubblico? Quali obblighi resterebbero in
   capo alla piattaforma e quali all'emittente?
7. Un **PDF nominale con QR verificato all'ingresso** può essere sufficiente per gli eventi non
   soggetti al regime? Ci sono requisiti minimi di contenuto o di conservazione anche in quel
   caso?

### Composizione del prezzo

8. Un pass unico che comprende **workshop didattici e serate danzanti** va scomposto ai fini
   fiscali tra le due componenti, o è trattato unitariamente? Se va scomposto, con quale
   criterio? *(È la domanda con il maggiore impatto sul nostro modello dati: determina se il
   titolo debba portare una ripartizione del prezzo per componente.)*
9. I **diritti di prevendita** della piattaforma costituiscono una prestazione autonoma soggetta
   a IVA ordinaria? Vanno esposti separatamente sul titolo, oltre che in fase di acquisto? Chi
   emette il documento verso il partecipante per questa componente?
10. Se sullo stesso ordine coesistono il titolo d'ingresso e **servizi accessori** (pasti,
    pernottamento, transfer, lezioni private), il trattamento di questi ultimi è autonomo?

### Gestione del ciclo di vita

11. Come si trattano **rimborsi e annullamenti** su titoli già emessi: annullamento del titolo,
    documenti da produrre, tempistiche?
12. È ammesso il **cambio di nominativo** su un titolo già emesso, e con quali formalità?
13. La **vendita alla porta** il giorno dell'evento, con incasso in contanti o POS, segue lo
    stesso regime della vendita online o ha obblighi propri?
14. Gli **accrediti e gli omaggi** a staff, artisti e ospiti vanno documentati con un titolo, e
    con quale forma?

### Adempimenti connessi

15. Quali obblighi verso **SIAE** ricadono sull'organizzatore e quali eventualmente sulla
    piattaforma, per la parte di diritti d'autore e per la parte di rendicontazione degli
    ingressi?
16. Esistono obblighi di **conservazione** dei dati di vendita, e per quanto tempo?

---

## 3. Cosa ci serve come risposta

Una risposta scritta, anche sintetica, che permetta di stabilire:

- **quali categorie di eventi** tra quelli descritti richiedono l'emissione certificata e quali no;
- **su chi ricade l'obbligo** nella configurazione descritta;
- **se il prezzo di un pass misto** vada scomposto, e come;
- se esistono **percorsi alternativi** praticabili per la vendita esclusivamente online.

Le prime tre determinano requisiti di sistema e vanno chiuse **prima di sviluppare il checkout
e l'emissione del biglietto**. La quarta determina tempi e costi di un'eventuale integrazione
con un emittente autorizzato, che stimiamo in 3-6 mesi in prevalenza contrattuali.

---

## 4. Le nostre ipotesi di lavoro, da confermare o smentire

Riportiamo le leve che riteniamo determinino la risposta, così che possiate confermarle o
correggerle punto per punto. Sono ipotesi formulate senza competenza specialistica.

| # | Ipotesi | Effetto se confermata |
|---|---|---|
| H1 | Le **serate danzanti con musica riprodotta da DJ** rientrano tra gli intrattenimenti, e quindi nel regime del titolo di accesso quando l'ingresso è a pagamento | È il caso della maggior parte dei nostri eventi |
| H2 | I **seminari e i corsi di ballo** sono prestazione didattica e non intrattenimento, quindi fuori dal regime | Uno stage di soli workshop non richiederebbe titolo di accesso |
| H3 | Un **evento gratuito** non genera obbligo, restando fermi gli adempimenti sui diritti d'autore | Pratiche e presentazioni restano fuori |
| H4 | L'obbligo di emissione ricade sull'**organizzatore**, non su chi vende per suo conto | La piattaforma resta canale di prevendita e il documento che emette è una conferma d'ordine con QR di accesso, non un titolo fiscale |
| H5 | Per organizzatori occasionali o di piccole dimensioni esistono **forme semplificate** — storicamente titoli a tagliando vidimati anziché sistema automatizzato | Cambierebbero i costi e i tempi di conformità per una parte degli organizzatori |
| H6 | I **diritti di prevendita** della piattaforma sono prestazione autonoma soggetta a IVA ordinaria, documentata dalla piattaforma verso il partecipante | Nessun impatto sul titolo dell'organizzatore |

Le due questioni che questa impostazione **non risolve**, e su cui chiediamo in particolare il
vostro parere:

1. Se la piattaforma è **l'unico canale di vendita** di un evento, la qualificazione di
   H4 regge, o la piattaforma entra comunque nella catena di emissione?
2. La scomposizione del **pass misto** della domanda 8: è la sola questione che, se risolta in
   un certo modo, ci obbliga a modificare la struttura dei dati.

## 5. Nota

Le considerazioni contenute in questo documento riflettono l'impostazione data al progetto e
non costituiscono un inquadramento fiscale: sono formulate proprio per essere confermate o
corrette. In particolare non diamo per acquisito che gli eventi descritti rientrino nel regime
degli intrattenimenti: è la prima cosa che chiediamo di verificare.


---

<!-- ============================================================ -->
<!-- SORGENTE: 11-chiusura-audit.md -->
<!-- ============================================================ -->

# Mirada Tango — Chiusura dei punti aperti dell'audit

**Data** 31 luglio 2026 · Allegato a `06-audit-analisi.md` · Chiude i sedici punti da **B3** a **C5**

I punti da A1 ad A5 e da B1 a B2 sono stati chiusi nei giri di decisione precedenti. Restavano
aperti undici buchi di analisi e cinque punti di forma, che l'audit collocava «prima del primo
evento reale» o «alla prossima revisione». Questo documento li chiude tutti: per ciascuno
riporta cosa manca, la risoluzione adottata e i requisiti che ne discendono.

Tre punti contenevano una scelta che non spettava all'analista — ammissione dei minori,
adozione della classificazione automatica delle immagini, regime delle contestazioni di
addebito. Sono stati **confermati dal committente il 31 luglio 2026**, tutti e tre secondo la
raccomandazione: il dettaglio è al §4. **L'audit non ha più alcuna voce aperta.**

---

## 1. Quadro sintetico

| # | Punto | Esito |
|---|---|---|
| **B3** | Chargeback e contestazioni | Risolto — sei requisiti nuovi, una regola trasversale. Penale all'organizzatore e doppia soglia (**D12**) |
| **B4** | Moderazione automatica di immagini e nickname | Risolto — classificazione preventiva delle immagini adottata (**D11**), filtro sul nickname |
| **B5** | Consenso della persona iscritta da altri | Risolto — stato `da_confermare`, facoltà di rifiuto, minimizzazione dei dati |
| **B6** | Account di incasso collegato ma non abilitato | Risolto — verifica dello stato, non del collegamento |
| **B7** | Annullamento di una singola sessione | Risolto — peso di ripartizione per sessione e rimborso proporzionale |
| **B8** | Carnet di ingressi | **Chiuso per conseguenza** dalla decisione sul tesseramento, con dipendenza dichiarata |
| **B9** | Minori | Risolto — minori ammessi alle tre soglie di età, con dichiarazione sull'evento (**D10**) |
| **B10** | Wall senza prova tecnica e senza moderatore | Risolto — modalità prova e rotazione di sicurezza |
| **B11** | Chat irraggiungibile negli eventi senza check-in | Risolto — sblocco di sala con codice a rotazione |
| **B12** | Archivio della wall contro politica di conservazione | Risolto — consenso onesto ed esportazione ristretta al proiettato |
| **B13** | Carrello multi-organizzatore | Risolto — suddivisione per organizzatore, diritti di prevendita per biglietto |
| **C1** | Numerazione dei requisiti fuori sequenza | Risolto come regola; esecuzione rinviata alla revisione 1.2 |
| **C2** | «Posto letto» contro «gestione alloggi» | Risolto — sono due funzioni distinte, ora dichiarate tali |
| **C3** | Lezioni private del primo rilascio contro quelle di fase 2 | Risolto — due forme distinte, ora dichiarate |
| **C4** | La traduzione riguarda solo la scheda evento | Risolto — regola estesa a tutti i testi del percorso d'acquisto |
| **C5** | Cosa fa scattare `vendita_chiusa` | Risolto — quattro criteri configurabili, il primo che si verifica |

**Bilancio**: 34 requisiti nuovi, 3 regole di business nuove, 4 requisiti modificati,
3 rischi nuovi. Nessuna decisione già presa viene rimessa in discussione.

---

## 2. Cosa è cambiato dal 30 luglio, e come incide

L'audit è stato scritto prima dei giri sesto, settimo e ottavo. Tre effetti vanno registrati
prima di entrare nel merito:

- **B8 si chiude da sé.** Il carnet serve alle milonghe e alle pratiche ricorrenti, che con la
  decisione sul tesseramento sono uscite dal segmento del primo rilascio. `09-titoli-e-pass.md`
  §9 lo registra già.
- **B5 si allarga.** L'iscrizione di terzi non riguarda più solo la coppia: con i pass emessi
  manualmente e le vendite su canali esterni, le persone presenti in piattaforma senza averlo
  chiesto sono di più.
- **B3 diventa più concreto.** Con i diritti di prevendita incassati direttamente dalla
  piattaforma sulla stessa transazione, una contestazione accolta non colpisce solo
  l'organizzatore: storna anche il ricavo della piattaforma.

---

## 3. Risoluzione punto per punto

### B3 — Chargeback e contestazioni

**Dove**: nessun documento · **Priorità**: prima del primo evento reale

Il modello di incasso diretto crea un'asimmetria: la contestazione colpisce il conto
dell'organizzatore, ma **le prove sono tutte in piattaforma** — l'ordine, l'accettazione delle
condizioni, il biglietto emesso, l'orario di check-in. Un organizzatore lasciato solo davanti a
una richiesta di prova la perde per omessa risposta, non perché avesse torto.

Va aggiunto un elemento che l'audit non considerava: **la maggior parte delle contestazioni
nasce da chi non ha trovato il percorso di rimborso.** Il presidio più efficace non è il
fascicolo di prova, è rendere ovvio come si chiede indietro il proprio denaro.

**Risoluzione.** La piattaforma prende in carico l'intero ciclo della contestazione per conto
dell'organizzatore: raccolta automatica delle prove, trasmissione entro il termine,
applicazione dell'esito. Una contestazione accolta produce esattamente gli effetti di un
rimborso — non un caso a parte, lo stesso percorso.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAY-27 | Registrazione delle **contestazioni di addebito** notificate dal prestatore, con stato, importo conteso, motivo dichiarato e termine di risposta, visibili all'organizzatore e all'amministrazione di piattaforma | M |
| RF-PAY-28 | **Costituzione automatica del fascicolo di prova** alla ricezione: ordine e righe, biglietto emesso, momento e indirizzo di rete dell'accettazione delle condizioni, versione della policy di rimborso vigente all'acquisto, storico dei trasferimenti, orario e postazione di check-in, comunicazioni recapitate. Trasmissione al prestatore entro il termine, con sollecito all'organizzatore se è richiesto un suo contributo | M |
| RF-PAY-29 | **Esito**: se la contestazione è accolta, il biglietto è invalidato, l'iscrizione decade e le quote sono rilasciate con lo stesso meccanismo del rimborso; se è respinta, nulla cambia. In entrambi i casi le parti sono notificate | M |
| RF-PAY-30 | I **diritti di prevendita seguono la sorte della transazione**: una contestazione accolta ne produce lo storno a carico della piattaforma, coerentemente con il funzionamento dell'incasso diretto | M |
| RF-PAY-31 | Monitoraggio del **tasso di contestazione per organizzazione**, su due soglie: **attenzione**, con avviso all'Owner, e **sospensione**, allineata a quella del prestatore, con presa in carico del Super Admin | M |
| RF-PAY-32 | La conferma d'ordine e l'area personale espongono in evidenza **come chiedere un rimborso e come raggiungere l'organizzatore**: è la misura che riduce le contestazioni alla radice | M |

**RB22** — Una contestazione di addebito accolta produce gli stessi effetti di un rimborso:
biglietto invalidato, iscrizione decaduta, quote rilasciate. Nessun ingresso avviene con un
titolo il cui incasso è stato revocato.

**Chiuso da D12**: penale del prestatore a carico dell'organizzatore, dichiarata nelle
condizioni di servizio (RF-ORG-13); doppia soglia, di attenzione e di sospensione (RF-PAY-38).
Motivazioni al §4.

---

### B4 — La chat libera non ha moderazione automatica delle immagini

**Dove**: `04` RF-WALL-7, RF-WALL-9, R4 · **Priorità**: prima del primo evento reale

La decisione «chat libera, wall curata» è stata progettata per la wall. Ma senza
pre-moderazione una foto esplicita **è immediatamente visibile a tutti i partecipanti**, anche
se non raggiungerà mai il maxischermo. RF-WALL-9 filtra il solo linguaggio, e la mitigazione R4
protegge la proiezione.

Il punto correlato è altrettanto serio: **il nickname non è moderato**, ed è l'unico dato
dell'autore che finisce proiettato in sala.

**Risoluzione.** Due soglie distinte e cumulative. Le immagini passano una classificazione
automatica prima di comparire in chat; solo ciò che risulta sospetto viene trattenuto in attesa
di un moderatore. È una pre-moderazione selettiva: non rallenta il flusso normale, che resta
libero, e non contraddice la decisione presa — la chat resta libera per il testo e per tutto
ciò che supera il controllo. Il nickname è filtrato alla creazione e a ogni modifica, e il
moderatore può oscurarlo per un singolo contenuto.

La regola che governa il silenzio è la più importante: **un contenuto trattenuto e mai
esaminato resta trattenuto.** Un sistema che pubblica per scadenza di un timer è un sistema che
pubblica proprio quando nessuno guarda.

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-43 | **Classificazione automatica di ogni immagine prima della pubblicazione in chat.** L'immagine sospetta è trattenuta e non compare a nessuno in attesa della decisione di un moderatore; il flusso normale non subisce ritardi percepibili | M |
| RF-WALL-44 | L'esito della classificazione è registrato e la coda dei contenuti trattenuti compare in console **con priorità su tutto il resto**. Se nessun moderatore decide, il contenuto **resta trattenuto**: il silenzio non pubblica | M |
| RF-WALL-45 | Il moderatore può **oscurare o sostituire il nickname** mostrato sulla wall per un singolo contenuto, e segnalare l'utente perché il nickname sia cambiato d'ufficio dalla moderazione di piattaforma | M |
| RF-ACC-9 | Il **nickname è soggetto a filtro automatico** alla creazione e a ogni modifica, ed è modificabile un numero limitato di volte nell'arco di un periodo | M |

**RB23** — Nessuna immagine raggiunge la chat senza aver superato la classificazione
automatica; nessun contenuto raggiunge la wall senza approvazione umana. Le due soglie sono
distinte e cumulative.

**Chiuso da D11**: la classificazione automatica è **adottata**. È un servizio esterno a
consumo, con costo ricorrente e latenza: entra nei costi di esercizio, nell'elenco dei
trasferimenti dell'informativa e tra le dipendenze da monitorare. Se il servizio non risponde,
RB23 non si allenta — l'immagine resta trattenuta finché non è stata classificata o approvata da
un moderatore.

---

### B5 — Manca il consenso della persona iscritta da altri

**Dove**: `04` RF-PAY-3, RF-CPL-6, RF-CPL-8, §9 · **Priorità**: prima del primo evento reale

Chi acquista inserisce nome, cognome, email e ruolo di ballo di altre persone. L'analisi
prevede una notifica, non un'accettazione: a un terzo vengono attribuiti un ruolo di ballo e
una partecipazione a un evento senza che abbia fatto nulla.

**Risoluzione.** L'iscrizione creata da altri nasce in stato `da_confermare`. Il biglietto è
valido e **l'ingresso non è mai bloccato** — un vincolo sul controllo accessi punirebbe la
persona sbagliata, e in sala nessuno vuole discutere di consensi. Ciò che resta sospeso è tutto
il resto: profilo, comunicazioni non essenziali, chat. La persona può anche rifiutare, e il
rifiuto restituisce il biglietto alla disponibilità di chi l'ha comprato.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAY-33 | Chi acquista per altri fornisce i **soli dati necessari all'emissione del titolo**: nome, cognome, email e ruolo di ballo. Nessun altro attributo del terzo è raccolto dall'acquirente, compresi quelli dei servizi accessori, che sono richiesti direttamente all'interessato | M |
| RF-CPL-13 | La persona iscritta da altri riceve una **richiesta di conferma**. Fino alla conferma l'iscrizione è `da_confermare`: il biglietto è valido e **l'ingresso è consentito**, ma restano inattivi il profilo, le comunicazioni non essenziali e l'accesso alla chat | M |
| RF-CPL-14 | La persona iscritta da altri può **rifiutare**. Il rifiuto rende il biglietto privo di titolare e lo restituisce alla disponibilità dell'acquirente, che può trasferirlo o chiederne il rimborso secondo la policy dell'evento; i dati del terzo sono cancellati, con la sola traccia contabile obbligatoria | M |
| RF-CPL-15 | L'acquirente **attesta di essere autorizzato** a comunicare i dati delle persone che iscrive, e l'informativa dichiara la base giuridica del trattamento dei dati inseriti da terzi | M |
| RF-CPL-16 | Sollecito automatico della conferma a intervalli configurabili, e comunque prima dell'evento: un biglietto senza titolare scoperto la sera stessa non è più trasferibile | M |

**RB24** — Nessuno risulta iscritto a un evento senza esserne informato e senza poter rifiutare.
Il rifiuto non lede chi ha pagato: restituisce il biglietto alla sua disponibilità.

---

### B6 — Non è previsto il caso dell'account di incasso non abilitato

**Dove**: `04` RF-ORG-5 · **Priorità**: prima del primo evento reale

Collegare un account non significa poter incassare. La verifica di identità presso il prestatore
può restare incompleta, o essere revocata dopo, e i fondi si accumulano senza poter essere
trasferiti. RF-ORG-5 verifica il collegamento, che è la cosa sbagliata da verificare.

**Risoluzione.** Si verifica lo **stato di abilitazione**, in modo continuativo. La decadenza
sospende la vendita, non i biglietti già emessi: chi ha pagato entra comunque, e i rimborsi
restano eseguibili, perché il problema è dell'organizzatore verso il prestatore e non del
partecipante.

| ID | Requisito | Pr. |
|---|---|---|
| RF-ORG-10 | La piattaforma verifica presso il prestatore lo **stato di abilitazione all'incasso**, non il solo collegamento. La prima pubblicazione richiede l'abilitazione piena | M |
| RF-ORG-11 | **Controllo periodico** dello stato. Alla decadenza: sospensione della pubblicazione di nuovi eventi e della vendita su quelli già pubblicati, con avviso all'Owner che indica quale adempimento manca presso il prestatore. I biglietti emessi restano validi e i rimborsi restano eseguibili | M |
| RF-ORG-12 | **Cruscotto dello stato di incasso** in evidenza nell'area dell'organizzazione, con gli eventuali fondi in attesa di trasferimento presso il prestatore e le azioni richieste | M |

**RB13 modificata** — Un evento non è pubblicabile se l'organizzazione non è approvata e non ha
un account di incasso collegato **e abilitato**.

---

### B7 — Manca l'annullamento di una singola sessione

**Dove**: `04` RF-EVT-19, RF-RMB-8 · **Priorità**: alla prossima revisione

È il caso non coperto più frequente in assoluto: il maestro che si ammala e salta un workshop
dentro un festival che si svolge regolarmente. Annullare l'evento intero sarebbe assurdo,
non annullare nulla sarebbe scorretto verso chi aveva quel workshop nel proprio pass.

Il nodo è **quanto vale una sessione dentro un pass a prezzo unico**. Ripartire in parti uguali
è semplice ma iniquo: un seminario di tre ore e una milonga di cinque non valgono lo stesso, e
in un Full Pass con dodici sessioni la differenza è percepibile.

**Risoluzione.** Ogni sessione porta un **peso di ripartizione**, con default uniforme e
facoltà per l'organizzatore di assegnarne di diversi. Il rimborso è proporzionale al peso e non
applica gli scaglioni, perché la causa non è imputabile al partecipante. Oltre una soglia di
peso complessivo annullato, l'annullamento parziale diventa una modifica sostanziale e apre il
diritto al rimborso integrale del titolo.

| ID | Requisito | Pr. |
|---|---|---|
| RF-EVT-35 | **Annullamento di una singola sessione** su evento che si svolge regolarmente, con motivazione, comunicazione ai soli titolari di titoli che la includono, e rilascio delle quote della sessione | M |
| RF-EVT-36 | Ogni sessione porta un **peso di ripartizione** che determina la quota di prezzo a essa attribuibile dentro un titolo multi-sessione. Default uniforme sul numero di sessioni incluse; pesi diversi assegnabili dall'organizzatore in fase di creazione | M |
| RF-EVT-37 | I **servizi accessori legati alla sessione annullata** — la lezione privata in quello slot, il pasto di quella giornata — seguono la sessione e sono rimborsati integralmente | M |
| RF-RMB-12 | L'annullamento di una sessione dà diritto al **rimborso della quota attribuibile** su ogni titolo che la include, comprensiva della corrispondente parte di diritti di prevendita, **senza applicazione degli scaglioni** | M |
| RF-RMB-13 | Se le sessioni annullate superano una **soglia di peso** configurabile sul titolo — default 30% — o se la sessione annullata è l'unica inclusa, il partecipante ha diritto al **rimborso integrale del titolo**, esercitabile entro 14 giorni dalla comunicazione secondo RB14 | M |

Nota: il peso di ripartizione ha un secondo uso, già richiesto altrove. `10` domanda 8 chiede se
un pass misto vada scomposto tra componente didattica e componente danzante ai fini fiscali. Se
la risposta fosse affermativa, **il peso di ripartizione è già la struttura dati che serve**, e
RF-BKO-9 può esporla nell'esportazione. Un requisito nato per i rimborsi copre gratuitamente il
rischio fiscale che restava aperto.

---

### B8 — Manca il carnet di ingressi

**Dove**: `04` RF-EVT-7, RF-EVT-17 · **Priorità**: alla prossima revisione

**Chiuso per conseguenza.** Il carnet — «dieci serate da usare quando vuoi» — è la forma di
vendita delle milonghe e delle pratiche ricorrenti, che con la decisione sul tesseramento sono
uscite dal segmento del primo rilascio. `09-titoli-e-pass.md` §9 lo registra già tra le funzioni
rinviate.

**Dipendenza da dichiarare**: se in futuro le milonghe settimanali rientrassero nel perimetro —
cosa che accadrebbe se la vendita come quota associativa venisse riaperta — il carnet è **il
primo requisito da riaprire**, prima ancora della ricorrenza degli eventi. È un titolo a consumo
con ingressi residui, validità temporale e decremento al check-in: non è una variante di quelli
esistenti, è un'entità nuova.

---

### B9 — I minori non sono considerati

**Dove**: `04` §9 · **Priorità**: alla prossima revisione

Le scuole di tango hanno stage per adolescenti e alcune milonghe hanno fasce pomeridiane aperte
ai minori. Manca tutto: età minima per l'account, consenso di chi esercita la responsabilità
genitoriale, esclusione dalla chat. Anche la scelta di **non** ammettere minori è una scelta di
prodotto e va dichiarata.

**Risoluzione proposta**, su tre soglie distinte che vanno tenute separate perché rispondono a
esigenze diverse:

| Soglia | Regola | Perché |
|---|---|---|
| **Account autonomo** | 14 anni compiuti | È l'età fissata in Italia per il consenso autonomo ai servizi della società dell'informazione |
| **Partecipazione sotto i 14 anni** | Nessun account: il minore è iscritto da un adulto che dichiara di esercitare la responsabilità genitoriale. Biglietto nominale gestito dall'adulto | Coincide con il percorso di B5, senza costruire un secondo meccanismo |
| **Chat di evento** | 18 anni | La chat alimenta una proiezione pubblica e non ha moderazione preventiva sul testo. È la soglia prudente, ed è la stessa che servirà alla ricerca partner in fase 2 |

| ID | Requisito | Pr. |
|---|---|---|
| RF-ACC-10 | **Età minima per l'account: 14 anni compiuti**, con dichiarazione dell'età alla registrazione e conseguenze dichiarate in caso di dichiarazione mendace | M |
| RF-ACC-11 | Sotto i 14 anni **non esiste account**: il minore partecipa come iscritto senza account, inserito nell'ordine da un adulto che **dichiara di esercitare la responsabilità genitoriale** o di esserne delegato. Il biglietto è nominale ed è gestito dall'adulto, che ne esercita anche i diritti | M |
| RF-ACC-12 | L'accesso in scrittura alla chat di evento è **riservato ai maggiorenni**; lo stesso vincolo si applicherà alla ricerca partner di fase 2 | M |
| RF-EVT-38 | L'organizzatore **dichiara sull'evento** se ammette minori e a quali condizioni: accompagnamento obbligatorio, fasce orarie, sessioni consentite. Il default è che l'evento non ammette minori non accompagnati, e la scheda evento lo espone | M |

**Chiuso da D10**: i minori sono **ammessi** alle tre soglie sopra. Escluderli del tutto sarebbe
stato più semplice da scrivere, ma taglia fuori gli stage giovanili e soprattutto non è
verificabile: senza un controllo dell'età reale l'esclusione è una dichiarazione, non un
presidio. Le tre soglie costano poco e reggono a un'ispezione.

---

### B10 — La wall non ha modalità di prova né comportamento senza moderatore

**Dove**: `04` §6.11 · **Priorità**: prima del primo evento reale

Due assenze che si scoprono in sala, cioè troppo tardi. Non esiste un modo di verificare
proiettore, risoluzione e leggibilità durante l'allestimento; e se a mezzanotte il moderatore
sta ballando — cosa che accadrà tutte le volte — la coda si svuota e il maxischermo resta sulla
schermata di cortesia per ore.

**Risoluzione.** Una modalità prova con contenuti campione e carta di calibrazione, e una
rotazione di sicurezza che ripropone i **contenuti già approvati** quando la coda si esaurisce.
Il vincolo di RB9 non si tocca: in rotazione entra solo ciò che un moderatore ha già approvato
una volta, mai contenuto nuovo.

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-46 | **Modalità prova**, attivabile prima dell'apertura porte: proietta contenuti campione — testo lungo, testo breve, foto verticale, foto orizzontale, schermata di cortesia — e una **carta di calibrazione** con area di sicurezza, riferimenti tipografici e scala dei grigi, per verificare proiettore, risoluzione, colori e leggibilità a distanza durante l'allestimento | M |
| RF-WALL-47 | **Rotazione di sicurezza in assenza di presidio**: esaurita la coda, la wall ripropone i contenuti **già approvati** dell'evento e i contenuti di servizio programmati, con un tetto configurabile alle ripetizioni. Nessun contenuto non approvato entra mai in rotazione; se non esiste materiale approvato si torna alla schermata di cortesia | M |
| RF-WALL-48 | **Contenuti di servizio programmabili in anticipo**, con orario o ricorrenza: annunci, ringraziamenti agli sponsor, avvisi logistici, chiusura della serata | M |
| RF-WALL-49 | **Segnalazione di assenza di presidio**: se la coda dei contenuti in attesa cresce e nessuna azione di moderazione avviene entro un tempo configurato, il sistema avvisa i moderatori designati sui loro dispositivi | M |

---

### B11 — La chat è irraggiungibile negli eventi senza check-in

**Dove**: `04` RF-CHK-14, RF-WALL-2 · **Priorità**: prima del primo evento reale

L'accesso alla chat è subordinato al check-in, ma molti organizzatori non scansionano nulla. In
quegli eventi il modulo è inerte e nessuno se ne accorge finché non è la sera stessa.

**Risoluzione.** Il QR già previsto sulla schermata di cortesia (RF-WALL-34) vale come **sblocco
di sala** ai soli fini della chat, previa verifica del possesso di un titolo valido. Il codice
**ruota a intervalli brevi**: è la differenza tra un presidio e un teatro, perché una fotografia
dello schermo condivisa su una chat di gruppo aprirebbe altrimenti la sala a chiunque.

| ID | Requisito | Pr. |
|---|---|---|
| RF-CHK-16 | **Sblocco di sala**: il QR della schermata di cortesia vale come check-in leggero ai soli fini dell'accesso alla chat. Registra un check-in di tipo `AUTO_SALA` previa verifica del possesso di un titolo valido per l'evento. **Non sostituisce il controllo accessi** e non entra nelle liste di presenza operative, che restano quelle degli operatori | M |
| RF-CHK-17 | Il codice contenuto nel QR di sala **ruota a intervalli brevi** e vale solo per l'intervallo corrente | M |
| RF-EVT-39 | Se il modulo chat è attivo su un evento **per cui non è previsto il check-in**, la configurazione lo segnala e propone l'attivazione dello sblocco di sala. Un modulo che non si sbloccherà mai non si pubblica in silenzio | M |

**RB11 modificata** — La chat richiede biglietto valido, **presenza accertata** — per check-in
all'ingresso o per sblocco di sala — e diritto premium: tre condizioni congiunte.

---

### B12 — L'archivio della wall contraddice la politica di conservazione

**Dove**: `04` RF-WALL-24, RF-WALL-12, §9 · **Priorità**: prima del primo evento reale

RF-WALL-24 consente all'organizzatore di scaricare in blocco tutti i contenuti approvati;
RF-WALL-12 e la sezione privacy ne prevedono la cancellazione automatica. Insieme, significano
che la cancellazione è nominale: le copie sono già fuori.

**Risoluzione.** Si dice la verità nel consenso e si restringe l'esportazione. Un contenuto
approvato ma **mai proiettato** non è mai stato reso pubblico e non deve finire nell'archivio:
è la distinzione che rende la restrizione difendibile senza togliere all'organizzatore ciò che
gli serve davvero, cioè le foto della sua serata.

| ID | Requisito | Pr. |
|---|---|---|
| RF-WALL-50 | Il **consenso al primo invio** dichiara che i contenuti proiettati sono resi pubblici in sala e **possono essere conservati e riutilizzati dall'organizzatore**, che ne diventa titolare autonomo. Senza il consenso l'invio non è possibile | M |
| RF-WALL-51 | L'esportazione di fine serata comprende i **soli contenuti effettivamente proiettati**. Un contenuto approvato e mai andato in onda non entra nell'archivio | M |
| RF-WALL-52 | Ogni esportazione è **registrata** con autore, momento e numero di contenuti, ed è consultabile dal partecipante nella sezione dei propri contenuti | M |
| RF-WALL-53 | La cancellazione automatica è **dichiarata per ciò che è**: la piattaforma cancella quanto detiene e non può revocare le copie già esportate. L'accordo con l'organizzatore ne disciplina la conservazione | M |

**RF-WALL-24 modificata** — Archivio dell'evento: i contenuti **proiettati**, scaricabili in
blocco dall'organizzatore a fine serata.

---

### B13 — Il carrello multi-organizzatore non è risolto

**Dove**: `04` RF-PAY-1 · **Priorità**: alla prossima revisione

Con incassi diretti su account distinti un pagamento unico non è possibile, e il requisito
attuale si limita a dire «dello stesso organizzatore» senza dire cosa accade altrimenti.

**Risoluzione.** Suddivisione automatica in un ordine per organizzatore, con pagamenti separati
e sequenziali, dichiarata prima del pagamento. La questione lasciata aperta dall'audit — fee per
ordine o per riga — **si risolve da sé calcolando i diritti di prevendita per biglietto**: la
suddivisione non cambia il totale, e non nasce l'incentivo perverso a manipolare il carrello per
pagare meno.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAY-34 | Il carrello con eventi di **organizzatori diversi si suddivide in un ordine per organizzatore**, con pagamenti separati e sequenziali. La suddivisione è dichiarata prima del pagamento, con l'importo di ciascun ordine | M |
| RF-PAY-35 | I **diritti di prevendita si calcolano per biglietto**, non per ordine: la suddivisione non modifica il totale complessivo pagato | M |
| RF-PAY-36 | Ogni sotto-ordine ha la **propria prenotazione temporanea**, avviata contestualmente; il conto alla rovescia mostrato è il più stringente. L'abbandono dopo il primo pagamento rilascia le prenotazioni residue e **non annulla ciò che è già stato pagato** | M |
| RF-PAY-37 | Riepilogo finale e area personale presentano i sotto-ordini come **un solo acquisto**, con il dettaglio per organizzatore e ricevute distinte | M |

**RF-PAY-1 modificata** — Carrello con più titoli, più servizi accessori e più partecipanti,
anche su eventi di organizzatori diversi, con la suddivisione di RF-PAY-34.

---

### C1 — La numerazione dei requisiti è fuori sequenza

Le integrazioni successive hanno prodotto sequenze come RF-EVT-9 → RF-EVT-20 → RF-EVT-10, e
questo documento ne aggiunge altre. In un documento di lavoro non è un problema; nella versione
destinata al cliente sembra trascuratezza.

**Risoluzione — regola adottata:**

1. La rinumerazione continua avviene **una sola volta, alla revisione 1.2** di `04`, contestuale
   alla produzione della versione presentabile al cliente. Rinumerare a ogni integrazione
   invaliderebbe i riferimenti in corso d'opera.
2. La revisione 1.2 porta in allegato una **tabella di corrispondenza** vecchio → nuovo.
3. Da quel momento gli identificativi sono **stabili e mai riusati**: un requisito eliminato
   lascia il proprio numero vuoto, con la dicitura *soppresso*. È l'unico modo perché un
   riferimento citato in una email di sei mesi prima significhi ancora qualcosa.

L'esecuzione è lavoro meccanico e va pianificata con la revisione 1.2, non con questo documento.

---

### C2 — «Posto letto» e «gestione alloggi» sembrano in contraddizione

Non lo sono, ma il documento non lo dice. **Risoluzione — distinzione dichiarata:**

| Funzione | Che cos'è | Fase |
|---|---|---|
| **Posto letto** | Servizio accessorio a inventario noto: l'organizzatore ha una convenzione con una struttura, vende N posti a un prezzo, con quota di capienza e cut-off di rimborso propri. È identico a una cena | **Primo rilascio** |
| **Gestione dell'ospitalità** | Matching tra ballerini: chi offre un divano e chi cerca un posto dove dormire, con abbinamento, contatto e responsabilità del tutto diverse | **Fase 3** |

La prima vende un prodotto, la seconda mette in contatto due persone perché una dorma a casa
dell'altra. Che la seconda stia in fase 3 non è un caso: ha lo stesso profilo di rischio della
ricerca partner e richiede gli stessi presidi.

---

### C3 — Le lezioni private del primo rilascio non sono quelle della fase 2

**Risoluzione — distinzione dichiarata:**

| Fase | Forma | Cosa richiede |
|---|---|---|
| **Primo rilascio** | Servizio accessorio con **slot predisposti dall'organizzatore**: un elenco di orari a capienza, venduti come qualunque altro accessorio | Nulla di nuovo: è già coperto dal catalogo dei servizi |
| **Fase 2** | **Prenotazione sul calendario del maestro**, con disponibilità reali, conferma, politica di cancellazione | Il ruolo Maestro con login, il calendario, la disponibilità |

Non è la stessa funzione due volte: nella prima forma il maestro non ha accesso alla
piattaforma, e chi garantisce che sia libero alle 15 di domenica è l'organizzatore.

---

### C4 — La traduzione riguarda solo la scheda evento

RF-PUB-9 prevede una seconda lingua per «i contenuti dell'organizzatore», ma i testi che un
partecipante straniero deve capire per forza sono altri: le dichiarazioni da accettare, i nomi
dei requisiti, la policy di rimborso. Un encuentro internazionale con la descrizione tradotta e
la dichiarazione di responsabilità in solo italiano ha un problema, non un'imperfezione.

**Risoluzione — regola:** se un testo redatto dall'organizzatore compare in un **percorso di
acquisto o di adempimento**, è traducibile.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PUB-10 | La seconda lingua opzionale copre **tutti i testi redatti dall'organizzatore che compaiono in un percorso di acquisto o di adempimento**: nomi e descrizioni dei titoli e delle sessioni, nomi e testi dei requisiti e delle dichiarazioni da accettare, descrizioni dei servizi accessori, testo della policy di rimborso, contenuti di servizio della wall. In assenza della traduzione si mostra il testo originale **con l'indicazione della lingua**, mai una stringa vuota | M |
| RF-PUB-11 | Il back-office segnala all'organizzatore **quali testi obbligatori non sono ancora tradotti** quando l'evento dichiara una seconda lingua, prima della pubblicazione | M |

---

### C5 — Non è definito cosa fa scattare `vendita_chiusa`

**Risoluzione — quattro criteri configurabili, non alternativi:**

| Criterio | Comportamento |
|---|---|
| **Data e ora dichiarate** | Chiusura programmata, tipica dei festival che chiudono le iscrizioni una settimana prima per organizzare le liste |
| **Esaurimento** | Tutte le quote limitanti della vendita online sono sature |
| **Decisione manuale** | L'organizzatore chiude quando vuole, senza motivazione |
| **Inizio dell'evento** | Criterio **sempre attivo**, come ultimo in ordine di tempo |

Chiude **il primo che si verifica**. La riapertura manuale resta possibile finché l'evento non è
iniziato e la capienza lo consente — serve per il caso concreto della rinuncia che libera posti
tre giorni prima.

| ID | Requisito | Pr. |
|---|---|---|
| RF-EVT-40 | Il passaggio a `vendita_chiusa` avviene per il **primo dei criteri configurati che si verifica**: data e ora dichiarate, esaurimento di tutte le quote limitanti, decisione manuale, inizio dell'evento — quest'ultimo sempre attivo. La riapertura manuale è possibile finché l'evento non è iniziato e la capienza lo consente | M |
| RF-EVT-41 | `vendita_chiusa` chiude la **sola vendita online**: vendita alla porta ed emissione manuale di pass restano possibili, coerentemente con RB20 | M |

---

## 4. Decisioni del committente — chiuse

Le tre scelte di merito sono state **confermate il 31 luglio 2026**, tutte secondo la
raccomandazione dell'analista.

| # | Decisione | Esito |
|---|---|---|
| **D10** | **Minori** (B9) | **Ammessi** alle tre soglie: account dai 14 anni compiuti · sotto i 14 nessun account, con iscrizione da parte di un adulto · chat riservata ai maggiorenni. L'organizzatore dichiara sull'evento se li ammette e a quali condizioni. RF-ACC-10/11/12, RF-EVT-38 |
| **D11** | **Classificazione automatica delle immagini** (B4) | **Adottata.** Ogni immagine è classificata prima di comparire in chat; ciò che risulta sospetto è trattenuto e non è visibile a nessuno. RF-WALL-43/44, RB23 |
| **D12** | **Contestazioni di addebito** (B3) | **Penale del prestatore a carico dell'organizzatore**, dichiarata nelle condizioni di servizio. **Soglia di sospensione allineata a quella del prestatore**, preceduta da una soglia di attenzione più bassa che genera un avviso all'Owner. RF-PAY-31, RF-ORG-13 |

### Requisiti che ne discendono

| ID | Requisito | Pr. |
|---|---|---|
| RF-ORG-13 | Le **condizioni di servizio per l'organizzatore** dichiarano che la penale applicata dal prestatore su ogni contestazione di addebito è a suo carico, e la addebitano sul primo regolamento utile. La dichiarazione è versionata come tutte le altre | M |
| RF-PAY-38 | Il monitoraggio del tasso di contestazione opera su **due soglie**: una di **attenzione**, più bassa, che genera un avviso all'Owner con l'indicazione delle cause ricorrenti; una di **sospensione**, allineata a quella del prestatore, che porta la questione al Super Admin | M |
| RF-ADM-10 | Il **catalogo dei diritti dei piani** e le **soglie di contestazione** sono parametri di configurazione della piattaforma, modificabili dal Super Admin senza rilascio: le soglie dei prestatori cambiano nel tempo | M |

### Le ragioni delle due scelte non ovvie

**Perché la penale all'organizzatore.** La contestazione nasce nel rapporto tra organizzatore e
partecipante — evento diverso da quello promesso, rimborso non concesso, comunicazione assente —
e la piattaforma non ha leva su nessuna di queste cause. Farla ricadere su chi può prevenirla è
anche l'unico incentivo che funziona. La piattaforma non ne esce indenne: subisce comunque lo
storno dei propri diritti di prevendita (RF-PAY-30). Entrambe le parti perdono qualcosa, ed
entrambe hanno motivo di evitare che accada.

**Perché la soglia allineata al prestatore.** Fissarne una più severa sarebbe arbitrario, una
più permissiva sarebbe inutile: oltre la propria soglia il prestatore sospende comunque
l'account, e un organizzatore che non può incassare non può operare (RF-ORG-11). Il valore che
la piattaforma può aggiungere non è una soglia propria, è **avvisare prima** — con una soglia di
attenzione più bassa e con l'indicazione di quali ordini stanno generando contestazioni, mentre
c'è ancora tempo per correggere.

**Conseguenza operativa di D11 da mettere in piano.** La classificazione è un servizio esterno a
consumo: entra nei costi ricorrenti, nell'elenco dei trasferimenti dell'informativa (§9 di `04`)
e tra le dipendenze da monitorare. Se il servizio non risponde, la regola di RB23 non si allenta:
l'immagine resta trattenuta finché non è stata classificata o approvata da un moderatore.

---

## 5. Rischi nuovi

| # | Rischio | Impatto | Mitigazione |
|---|---|---|---|
| **R18** | **Falsi positivi della classificazione automatica**: una foto innocua trattenuta durante una serata in cui il tempo è tutto, e un partecipante che non capisce perché il suo contenuto non appare | Medio sull'esperienza | Coda prioritaria in console, notifica al moderatore, indicazione all'autore che il contenuto è in verifica e non perduto, soglia di sensibilità tarabile |
| **R19** | **Sblocco di sala usato fuori dalla sala**: il QR fotografato e condiviso allarga la chat a chi non è presente | Medio sulla tenuta del vincolo | Codice a rotazione breve, verifica del possesso di un titolo valido, limitazione di frequenza, possibilità per il moderatore di rigenerare il codice |
| **R20** | **Biglietto senza titolare a ridosso dell'evento**: il terzo iscritto da altri rifiuta tardi, e non c'è più tempo per trasferire o rimborsare | Basso-medio | Richiesta di conferma inviata immediatamente, solleciti automatici, e proposta del trasferimento come prima opzione all'acquirente |

---

## 6. Stato dell'audit dopo questo documento

| Parte | Stato |
|---|---|
| **A1 – A5** contraddizioni | Chiuse nei giri quinto e settimo |
| **B1 – B2** tesseramento e modello fiscale | Chiusi nei giri sesto e ottavo |
| **B3 – B13** buchi di analisi | **Chiusi in questo documento**, decisioni del committente comprese |
| **C1 – C5** chiarezza e forma | **Chiusi in questo documento**; l'esecuzione di C1 è pianificata con la revisione 1.2 |
| **D10, D11, D12** scelte di merito | **Confermate dal committente il 31 luglio 2026**, tutte secondo la raccomandazione dell'analista (§4) |

**L'audit è chiuso integralmente.** Restano fuori da questo documento, e per ragioni diverse:
la **verifica sulla ripartizione dei diritti di prevendita** presso PayPal e Satispay (Q19), che
è una precondizione allo sviluppo del checkout e non un punto di analisi; le **quattro decisioni
sulla matrice dei ruoli** (Q1), che appartengono a `02`; e la **versione presentabile al
cliente**, che è un deliverable e non una lacuna.


---

<!-- ============================================================ -->
<!-- SORGENTE: 12-app-tanghero.md -->
<!-- ============================================================ -->

# Mirada Tango — L'app del tanghero

**Data** 31 luglio 2026 · **Milestone di progetto, fase 2** · Allegato a `04-analisi-funzionale.md` §10

Cinque funzioni indicate dal committente come traguardo del prodotto: l'app che il ballerino
usa per sentirsi protagonista, e che lo rende promotore della piattaforma presso i propri
organizzatori.

**Collocazione confermata: fase 2.** Il primo taglio serve gli organizzatori clienti sulle
prenotazioni del prossimo evento (`13-primo-taglio.md`); il resto della fase 1 completa
biglietteria, chat e Live Wall; questa milestone viene dopo. Il documento serve a due cose:
fissare il traguardo perché non si perda, e **segnalare fin da ora le poche scelte di fase 1
che, se prese male, renderebbero costose queste funzioni.**

---

## 1. Quadro delle cinque funzioni

| # | Funzione | Che cosa esiste già | Che cosa è nuovo | Costo |
|---|---|---|---|---|
| **1** | Social Matcher per workshop | Bacheca cerco-partner (RF-PRT-1→6, fase 1) e ricerca partner avanzata (RF-PRM-8, fase 2) | **Stile di ballo** come attributo · ancoraggio al singolo workshop anziché all'evento | Basso: estende funzioni già progettate |
| **2** | Tanda & DJ Live Tracker | Nulla. Tanda e cortina esistono solo nel glossario | **Tutto**: è un sottosistema nuovo | **Il più alto dei cinque**, ma non per il software |
| **3** | Passaporto Tanghero Go | Apple/Google Wallet (RF-TCK-10, fase 2) · notifiche push (RF-COM-7, fase 3) | Push **geolocalizzata** all'arrivo in location · lo storico come oggetto curato | Medio |
| **4** | Mappa della community | Nulla: «chi partecipa» era stato escluso da «solo ticketing» | Provenienze dei partecipanti, in forma aggregata e in opt-in | Basso in sé, medio con lo scambio di contatti |
| **5** | Bacheca dei nomadi | Il posto letto in convenzione è un servizio accessorio di fase 1, cosa diversa | Passaggi in auto e alloggi condivisi tra pari | Basso a costruirlo, **non banale a inquadrarlo** |

Tre delle cinque estendono cose già progettate. La seconda è l'unica davvero nuova, ed è anche
quella con la resa emotiva più alta.

---

## 2. Social Matcher per workshop

### Che cosa aggiunge davvero

La bacheca di fase 1 è già questa funzione, in forma grezza: annuncio per evento, ruolo
proprio, ruolo cercato, livello, contatto interno. Tre aggiunte la trasformano.

**Lo stile di ballo.** È l'aggiunta migliore delle cinque, e non è ovvia: *milonguero*, *salon*,
*nuevo*, *fantasía* discriminano la compatibilità tra due persone **più del livello**. Due
avanzati di scuole diverse ballano peggio insieme di due intermedi dello stesso stile. Nessuna
bacheca esistente lo chiede, e il vocabolario è esattamente ciò che dà credibilità nella
community.

**L'ancoraggio al singolo workshop.** Oggi l'annuncio è per evento. Cercare un partner «per il
seminario di sabato alle 15 sulla milonga con traspié» è un'altra cosa: la domanda è precisa,
la risposta è verificabile, e l'abbinamento serve a due persone che dopo due ore si salutano.
È anche ciò che tiene la funzione lontana dall'appuntamento.

**La reciprocità dell'iscrizione.** Se due utenti si trovano tramite un annuncio, il passo
successivo è un'iscrizione a coppia su un unico ordine (RF-CPL-6). Chiudere quel cerchio —
dall'annuncio al biglietto in due — è ciò che distingue lo strumento da un gruppo Facebook.

| ID | Requisito | Pr. |
|---|---|---|
| RF-ACC-13 | **Stile di ballo prediletto** nel profilo, a scelta multipla dal catalogo (milonguero, salon, nuevo, fantasía, altro), con la stessa natura di indicazione del livello dichiarato | 2 |
| RF-PRT-7 | L'annuncio può essere ancorato a **una o più sessioni specifiche** dell'evento, non al solo evento: il partner si cerca per quel workshop, non in generale | 2 |
| RF-PRT-8 | Filtri della bacheca estesi a **stile** e **sessione**, oltre a ruolo e livello | 2 |
| RF-PRT-9 | Dall'annoncio abbinato si passa direttamente all'**iscrizione a coppia** sulle sessioni concordate, con l'ordine unico già previsto da RF-CPL-6 | 2 |
| RF-PRT-10 | L'annuncio dichiara sempre **per che cosa** si cerca il partner: workshop, lezione privata, o partecipazione all'evento. Non esiste un annuncio senza finalità | 2 |

### Il nodo, che non è tecnico

Il committente lo chiama «il Tinder del Tango». Come descrizione interna è efficace e centra il
meccanismo; **come posizionamento pubblico sarebbe l'errore più costoso del progetto.** L'analisi
lo registra già come il rischio più alto del prodotto (R11) e come rischio difficilmente
reversibile (R12): nella community del tango le molestie in sala sono un tema discusso e
sensibile, e una piattaforma percepita come app di incontri travestita perde la fiducia una
volta sola.

La distanza tra le due cose non è nel codice, è in tre scelte già prese in `07` §4.1 e da
mantenere: **si cerca per una sessione, non una persona**; **nessun filtro di genere, età,
distanza o presenza online**; **nessuna scoperta casuale di profili**. Con quelle in piedi il
meccanismo resta lo stesso e il significato è opposto.

RF-PRT-10 è la traduzione operativa del principio: ogni annuncio dichiara la finalità, e non
esiste un annuncio generico.

---

## 3. Tanda & DJ Live Tracker

È la funzione con la resa più alta e l'unica veramente nuova. Coglie una cosa vera: il tanghero
è ossessionato dalle orchestre, e sapere che sta suonando Di Sarli del '44 con Rufino non è
un'informazione, è appartenenza.

| ID | Requisito | Pr. |
|---|---|---|
| RF-MUS-1 | **Anagrafica delle tande**: orchestra, cantante, anni, stile (tango, vals, milonga), brani. Riutilizzabile tra eventi e alimentata dal catalogo di piattaforma | 2 |
| RF-MUS-2 | Il DJ dispone di una **console essenziale**: la scaletta preparata in anticipo e un solo gesto per dichiarare l'inizio della tanda successiva. Nessuna digitazione durante la serata | 2 |
| RF-MUS-3 | La schermata dell'app mostra in tempo reale **tanda in corso** — orchestra, cantante, anno, stile — e **che cosa segue**, se il DJ ha reso pubblica la scaletta | 2 |
| RF-MUS-4 | Il ballerino può **salvare una tanda** nel proprio archivio personale, con orchestra, anno e serata in cui l'ha ballata. L'esportazione verso servizi di ascolto è **a tentativo migliore**, non una promessa | 2 |
| RF-MUS-5 | **Voto della serata** e voto per tanda, aggregati e restituiti al DJ e all'organizzatore a fine evento | 2 |
| RF-MUS-6 | Lo storico musicale confluisce nel passaporto: orchestre più ballate, DJ seguiti, andamento nel tempo | 2 |

### I due nodi da guardare in faccia

**Chi inserisce il dato.** Il DJ sta lavorando, al buio, e non digiterà mai. Le tre strade
possibili non si equivalgono:

| Strada | Valutazione |
|---|---|
| **Scaletta preparata più un tocco per avanzare** | **La sola praticabile.** Un tocco ogni dodici minuti circa, all'inizio della tanda. I DJ di tango preparano già le tande in anticipo: si chiede loro di caricare ciò che hanno già |
| Riconoscimento audio dal microfono | Da escludere. Il repertorio è fatto di incisioni anteriori al 1960 in rimasterizzazioni specifiche, mal coperte dai servizi di riconoscimento. Fallirebbe proprio sui brani che contano |
| Integrazione con il software del DJ | Frammentata su troppi programmi diversi. Eventualmente dopo, mai come strada principale |

**Il salvataggio su Spotify e Apple Music.** Va promesso con prudenza: le tande di tango
provengono spesso da edizioni rimasterizzate specifiche che sui servizi di ascolto non esistono,
o esistono in versioni diverse. Cercare «Di Sarli — Bahía Blanca» restituirà qualcosa, ma non
necessariamente l'incisione ballata. La forma onesta è **l'archivio personale dentro l'app** —
orchestra, anno, cantante, serata — con il collegamento allo streaming offerto quando esiste. Un
tanghero che si vede proporre la versione sbagliata se ne accorge, e la credibilità costruita
sul vocabolario si perde su un dettaglio come questo.

### La sinergia che rende la funzione più economica di quanto sembri

Il glossario di `04` §3 lo dice già senza averne tratto la conseguenza: **la cortina è il
momento naturale per la rotazione dei contenuti sulla wall.** Se il DJ segna l'inizio della
tanda, il sistema sa quando cade la cortina — e la Live Wall può sincronizzare la propria
rotazione sulla musica invece che su un timer cieco.

Un solo gesto del DJ serve quindi due funzioni: alimenta il tracker per i ballerini e dà il
ritmo alla wall. È anche il momento in cui le persone smettono di ballare e alzano gli occhi
sullo schermo: la proiezione dei contenuti in cortina è **il momento di massima attenzione della
serata**. Nessuna delle due funzioni, presa da sola, giustificherebbe da sé lo sforzo di far
partecipare il DJ; insieme sì.

> **Conseguenza per la fase 1**: la console della wall va costruita in modo che la rotazione
> possa ricevere un segnale esterno di avanzamento, oltre al proprio timer. È una previsione
> architetturale che costa poco ora e molto dopo.

---

## 4. Passaporto Tanghero Go

Due cose distinte sotto lo stesso nome, ed è bene tenerle separate perché hanno costi diversi.

**Il pass digitale.** Apple e Google Wallet erano già in fase 2 (RF-TCK-10). L'aggiunta è la
**notifica geolocalizzata all'arrivo**: «Benvenuto alla Milonga sul Molo, il tuo pass è pronto».
È un tocco di scenografia che costa poco e si nota molto — e ha un effetto pratico reale, perché
il pass compare senza che nessuno cerchi l'email di conferma nella coda all'ingresso.

**Il passaporto vero e proprio.** Lo storico personale: quante serate, in quante città, con
quali DJ e maestri, la progressione nel tempo. È la funzione più sottovalutata delle cinque, per
tre ragioni che si rinforzano a vicenda:

1. È **l'unica cosa che nessun concorrente può copiare**, perché richiede lo storico delle
   presenze — che solo la piattaforma possiede. `07` §3 lo aveva già identificato come
   fondamento del livello desunto.
2. È **condivisibile**: un tanghero che pubblica il proprio anno di tango è promozione che cita
   il prodotto, e costa zero.
3. Alimenta il livello desunto, che alimenta il Social Matcher. Le due funzioni si nutrono a
   vicenda.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAS-1 | **Pass digitale** in Apple Wallet e Google Wallet, con aggiornamento in tempo reale di orario, sala e stato del biglietto | 2 |
| RF-PAS-2 | **Notifica geolocalizzata all'arrivo in location**, con il pass pronto per la scansione. Attivabile dall'utente e disattivabile in ogni momento; nessuna posizione conservata dalla piattaforma | 2 |
| RF-PAS-3 | **Passaporto personale**: serate, città, eventi, maestri, DJ, orchestre ballate, andamento nel tempo, con presentazione curata e condivisibile come immagine | 2 |
| RF-PAS-4 | Il passaporto raccoglie anche le presenze a eventi **non venduti dalla piattaforma**, se il ballerino vi ha fatto check-in o le registra a mano: uno storico con dei buchi non è uno storico | 2 |
| RF-PAS-5 | Il passaporto è **privato per default**; la condivisione è un gesto esplicito e granulare | 2 |

RF-PAS-4 è la meno appariscente e la più importante: è la condizione perché il passaporto sia
credibile, ed è anche il punto in cui si vede che la presenza vale indipendentemente dalla
vendita.

---

## 5. Mappa della community

Riapre una funzione che era stata esclusa: «vedere chi partecipa prima dell'acquisto» era la
domanda 64 del questionario, indicata come *fortissima leva di conversione nel tango*, ed era
caduta con la scelta «solo ticketing, community bassa».

La forma proposta dal committente è però più intelligente della domanda originale: **non i
profili, ma le provenienze.** Vedere che nella stessa sala ci sono ballerini da Parigi, Buenos
Aires e Berlino produce quasi tutto l'effetto emotivo con una frazione del rischio, perché il
dato è aggregato e nessuno è esposto individualmente.

| ID | Requisito | Pr. |
|---|---|---|
| RF-CMU-1 | **Provenienze dei partecipanti** in forma aggregata — città, paese, numero — mostrate sulla scheda evento e nell'app durante l'evento. Nessun profilo individuale è esposto da questa vista | 2 |
| RF-CMU-2 | La comparsa nell'elenco nominativo dei partecipanti è **in adesione esplicita**, disattivata per default e revocabile in ogni momento | 2 |
| RF-CMU-3 | Lo scambio di contatti tra partecipanti segue le stesse tutele della ricerca partner: **accettazione reciproca**, nessun segnale di lettura o di rifiuto, blocco e segnalazione sempre gratuiti | 2 |
| RF-CMU-4 | Chi ha partecipato allo stesso evento può ritrovarsi negli eventi futuri, **se entrambi hanno aderito**: è il meccanismo che tiene insieme la community internazionale tra un festival e l'altro | 2 |

La linea da non superare è quella già fissata: il numero aggregato è di tutti, il nome è di chi
sceglie di mostrarlo, il contatto richiede il consenso di entrambi.

---

## 6. Bacheca dei nomadi

Passaggi in auto e alloggi condivisi. È una funzione a costo di sviluppo basso e valore
percepito alto, che risolve un problema reale: la community del tango viaggia, e oggi lo
organizza in gruppi Facebook e WhatsApp dispersivi.

Va distinta dalle due funzioni vicine che l'analisi già contiene, perché la confusione tra loro
ha già prodotto una contraddizione apparente una volta (`06` C2):

| Funzione | Che cos'è | Fase |
|---|---|---|
| **Posto letto** | Inventario in convenzione con una struttura, venduto come una cena | Fase 1 |
| **Bacheca dei nomadi** | Annunci tra pari: passaggi in auto, stanze da dividere | **Fase 2, questa** |
| **Gestione dell'ospitalità** | Abbinamento gestito tra chi offre un divano e chi cerca | Fase 3 |

| ID | Requisito | Pr. |
|---|---|---|
| RF-NOM-1 | Annunci legati a un evento di due tipi: **viaggio** (partenza, data, posti disponibili o cercati) e **alloggio condiviso** (zona, tipo di sistemazione, posti, periodo) | 2 |
| RF-NOM-2 | Contatto attraverso messaggistica interna, con le stesse tutele della bacheca cerco-partner: nessuna email esposta, segnalazione, blocco | 2 |
| RF-NOM-3 | Gli annunci si chiudono all'inizio dell'evento o su decisione dell'autore | 2 |
| RF-NOM-4 | La piattaforma è **bacheca e non intermediario**: non verifica i conducenti, non risponde delle sistemazioni, non gestisce denaro tra le parti. La condizione è dichiarata su ogni annuncio, non solo nelle condizioni di servizio | 2 |

RF-NOM-4 non è una formalità. Mettere in contatto sconosciuti che viaggeranno in auto insieme o
divideranno una stanza è un'attività con un'esposizione diversa da una bacheca cerco-partner, e
va inquadrata prima di pubblicarla, non dopo il primo problema. Il **nessun denaro tra le parti
dentro la piattaforma** è la scelta che tiene la funzione semplice: chi divide la benzina lo fa
tra sé, come oggi.

---

## 7. Direzione estetica

L'indicazione del committente — toni caldi e scuri, nero, oro, bordeaux, transizioni fluide,
niente aria da gestionale — è un requisito di prodotto e va trattata come tale. Due osservazioni
utili.

**È già metà specificata, e non per caso.** RF-WALL-31 prescrive per la wall un fondo molto
scuro e testo avorio anziché bianco pieno, per non abbagliare chi balla in sala. Non è una scelta
grafica ma funzionale, e l'app può ereditarla: il prodotto guadagna una coerenza reale — la
stessa palette in mano e sul maxischermo — senza inventare nulla.

**Il vincolo che va rispettato con disciplina.** L'accessibilità WCAG 2.1 AA è già un requisito
non funzionale. Su fondo nero, l'oro ha contrasto sufficiente per il testo; **il bordeaux no**,
o solo al limite. La regola operativa: bordeaux per superfici, bordi e accenti, oro e avorio per
il testo. È una limitazione che non toglie nulla all'eleganza — anzi, un bordeaux usato come
superficie e non come inchiostro è più elegante.

| ID | Requisito | Pr. |
|---|---|---|
| RF-PAS-6 | Sistema visivo unico tra app, scheda evento e wall: palette scura calda — nero, bordeaux come superficie, oro e avorio come testo — tipografia curata, transizioni in dissolvenza. Il rispetto di WCAG 2.1 AA è verificato sulla palette prima che sulle singole schermate | 2 |

---

## 8. Che cosa questa milestone cambia nelle decisioni prese

| Decisione | Effetto |
|---|---|
| «Solo ticketing, community bassa» | **Cade definitivamente.** Era già stata incrinata dal Premium (`07` P2); con mappa della community, nomadi e passaporto il prodotto ha una componente relazionale piena. Va dichiarato, non subito |
| Notifiche push in fase 3 (RF-COM-7) | **Anticipate alla fase 2**: la notifica geolocalizzata è parte del passaporto |
| Il livello di ballo come dato del profilo | Si arricchisce dello **stile**, che per l'abbinamento conta più del livello |
| Chat riservata al Premium (D2, RB11) | **Da riesaminare prima della fase 2.** Se il ballerino è il promotore, la funzione più condivisibile del prodotto — la propria foto sul maxischermo — è dietro il paywall meno redditizio (`07` §2.2: circa 3,77 € netti l'anno). La linea difendibile resta *presenza e visibilità gratis, iniziativa di contatto a pagamento* |
| Perimetro del primo rilascio | Nessun effetto: questa milestone è interamente fase 2 |

---

## 9. Le tre previsioni da fare in fase 1

Costano poco ora, molto dopo. Sono l'unica ragione per cui questo documento va scritto prima e
non al momento di realizzarlo.

1. **La rotazione della wall accetta un segnale esterno di avanzamento**, oltre al proprio timer.
   È ciò che permetterà al tracker delle tande di dare il ritmo alla proiezione senza riscrivere
   la console.
2. **Il check-in registra la presenza anche dove non c'è vendita.** Il passaporto e il livello
   desunto valgono in proporzione a quante presenze conoscono; se la presenza esiste solo dove
   c'è un biglietto venduto dalla piattaforma, lo storico nasce con i buchi (RF-PAS-4).
3. **Il profilo ha spazio per attributi di ballo estensibili** — livello, stile, e ciò che verrà.
   Aggiungere una colonna a un profilo con diecimila righe è un fastidio; averla prevista non
   costa niente.

---

## 10. Decisioni da prendere

| # | Decisione | Serve entro |
|---|---|---|
| D13 | **Nativa o web?** Notifica geolocalizzata, wallet e icona sul telefono implicano un'app nativa o quantomeno una PWA installabile con push. Cambia stima, competenze e distribuzione | Prima della pianificazione della fase 2 |
| D14 | **La chat di sala resta Premium?** Vedi §8. Raccomandazione dell'analista: renderla gratuita e tenere il Premium sull'iniziativa di contatto | Prima dell'attivazione del Premium |
| D15 | Il **catalogo degli stili** è chiuso e governato dal Super Admin, o estensibile dagli utenti? Raccomandazione: chiuso, altrimenti i filtri non funzionano | Alla progettazione del Matcher |
| D16 | Il tracker delle tande richiede la collaborazione del DJ: si prevede una **contropartita** — visibilità, statistiche della serata, profilo pubblico — o si conta sull'adesione spontanea? | Prima della fase 2 |


---

<!-- ============================================================ -->
<!-- SORGENTE: 13-primo-taglio.md -->
<!-- ============================================================ -->

# Mirada Tango — Il primo taglio

**Data** 31 luglio 2026 · **Proposta di perimetro** · Allegato a `04-analisi-funzionale.md` §10

**Obiettivo**: mettere due o tre organizzatori già clienti in condizione di **aprire le
prenotazioni del prossimo evento**, con incasso reale sul proprio account.

La fase 1 conta trecento requisiti. Non è «subito». Questo documento definisce il sottoinsieme
minimo che porta un evento vero in vendita, e — più importante — dichiara che cosa resta fuori e
**che cosa lo sostituisce nel frattempo**, perché un taglio senza sostituto non è un taglio, è
un buco.

---

## 1. Il principio del taglio

Con **due o tre clienti noti**, molte funzioni possono essere presidio umano invece che
software. Non tutte: la regola che distingue è una sola.

> Resta software ciò che accade **mentre nessuno guarda** — di notte, sotto contesa, in sala
> senza rete. Diventa presidio umano ciò che accade **poche volte e in orario di lavoro**.

Un rimborso è un'email e un clic su Stripe: si può fare a mano dieci volte. Due persone che
comprano l'ultimo posto follower alle 21:04 di un martedì non si possono gestire a mano
nemmeno una volta.

---

## 2. La scoperta che sblocca i tempi

**Un solo prestatore di pagamento nel primo taglio: Stripe.**

Q19 — la ripartizione dei diritti di prevendita su PayPal e Satispay — era registrata come
**l'unica precondizione allo sviluppo del checkout**. Con Stripe Connect la ripartizione è
nativa: la quota di piattaforma è trattenuta sulla transazione, senza accordi da negoziare.

**Q19 esce quindi dal percorso critico.** L'accordo di partner PayPal, che ha tempi di
approvazione non governabili, si avvia adesso e corre in parallelo allo sviluppo; Satispay si
verifica con calma. Nessuno dei due blocca più la partenza.

È l'unica cosa in questo documento che cambia una data anziché un perimetro.

---

## 3. Che cosa non è tagliabile

Prima dei tagli, il nocciolo. Sono le funzioni che, se assenti, rendono il prodotto
indistinguibile da un modulo di prenotazione qualsiasi — o che espongono a un danno.

| Che cosa | Perché |
|---|---|
| **Motore di capienza** (`05` per intero) | Quote per ruolo, tolleranza di sbilancio, iscrizione a coppia, impegno atomico. È il prodotto: senza, si vende un form |
| **Prenotazione di 15 minuti** | Senza, si vende lo stesso posto due volte durante il pagamento |
| **QR firmato verificabile offline** | Un QR non firmato è un QR falsificabile con uno screenshot |
| **Check-in senza connessione** | Le sale da ballo senza rete sono la norma, non l'eccezione. È la funzione che si scopre mancante nel momento peggiore |
| **Diritti di prevendita esposti a parte** | È il modello di ricavo, ed è ciò che rende la piattaforma un canale di prevendita |
| **RF-ORG-8, RF-TCK-11, RF-BKO-9** | Le tre condizioni che reggono il posizionamento fiscale. Toglierne una espone il committente. Costano poco: una dichiarazione, dei testi corretti, un'esportazione |

---

## 4. Dentro il primo taglio

| Area | Contenuto | Requisiti |
|---|---|---|
| **Account** | Registrazione, profilo con ruolo di ballo, ruolo sovrascrivibile per iscrizione, cancellazione dei dati | RF-ACC-1, 3, 4, 7 |
| **Organizzazione** | Creata **a mano** dal Super Admin. Account di incasso collegato e verificato abilitato. Dichiarazione di inquadramento fiscale | RF-ORG-5, 8, 9, 10 |
| **Evento** | Percorso di creazione, dati base, locandina, location, **sessioni**, cast, ciclo di vita, anteprima, chiusura vendita | RF-EVT-1→6, 14, 15, 40, 41 |
| **Titoli** | Definizione, sessioni incluse come elenco esplicito, scaglioni di prezzo, unità per persona o per coppia, titoli senza ruolo, modelli precompilati | RF-EVT-7, 23, 25, 26, 27, 28, 29, 30 |
| **Quote** | Su qualunque dimensione, flag limitante, contingente per canali esterni, aggiornamento dei totali | RF-EVT-9, 20, 21, 22, 32, 33 |
| **Requisiti** | Solo **dichiarazione** e **campo custom**. Nessun upload, nessun dato sanitario | RF-REQ-1, 4, 5, 6 |
| **Scheda evento** | Pagina pubblica con disponibilità per ruolo, URL stabile, immagine di condivisione, dati strutturati | RF-PUB-5, 6 |
| **Checkout** | Carrello, prenotazione 15 minuti con conto alla rovescia e riarmo, dati dei partecipanti, riepilogo con diritti di prevendita, **Stripe**, impegno atomico, idempotenza, disponibilità parziale | RF-PAY-1→4, 6, 7 (solo Stripe), 8→13, 15→17, 20→26, 33 |
| **Biglietto** | QR firmato, PDF via email e in area personale, **trasferimento del nominativo**, emissione manuale di pass | RF-TCK-1→9, 11, 12, 14→18 |
| **Ruolo e coppia** | Quote per ruolo, disponibilità distinta, ruolo flessibile, cancello di tolleranza, iscrizione a coppia, vista di controllo | RF-CPL-1→8, 11, 12 |
| **Check-in** | App web, lista scaricata, funzionamento offline, esiti distinti, più operatori, ricerca manuale, per sessione, annullamento, contatore presenze | RF-CHK-1→9, 13 |
| **Back-office** | Cruscotto con iscritti per ruolo e sbilancio, elenco iscritti, **export CSV**, liste operative, riepilogo economico, esportazione con dettaglio per sessione | RF-BKO-1→4, 6, 9 |
| **Comunicazioni** | Email transazionali, modelli in italiano e inglese | RF-COM-1, 6 |
| **Piattaforma** | Cataloghi (tipi evento, requisiti, servizi), elenco organizzazioni ed eventi, registro delle azioni sensibili | RF-ADM-2, 4, 9 |

Il **motore di capienza** di `05` è dentro per intero, invarianti e casistica di test compresi.
Il caso T23 — cinquanta acquisti simultanei su dieci posti — va automatizzato prima
dell'apertura vendite del primo evento, non dopo.

**Servizi accessori**: dentro se il primo evento li vende (pasti, t-shirt, transfer). Sono
RF-EVT-11 e le quote di ambito servizio, già coperte dal motore. È una domanda da fare ai
clienti, non una scelta di architettura.

---

## 5. Che cosa resta fuori, e che cosa lo sostituisce

| Fuori | Sostituto nel primo taglio |
|---|---|
| **Chat e Live Wall** | Nulla. Completano la fase 1 subito dopo. Sono la funzione che vende il prodotto, non quella che apre le vendite |
| **Bacheca cerco-partner** | Nulla. Resto della fase 1 |
| **PayPal e Satispay** | Solo Stripe, che copre carta, Apple Pay e Google Pay. L'accordo PayPal si avvia in parallelo |
| **Motore di rimborso a scaglioni** (RF-RMB-1→8) | **Rimborso manuale registrato a sistema**, che rilascia le quote e invalida il QR (RF-RMB-9 resta). La policy è scritta sulla scheda evento e applicata a mano. Il trasferimento del nominativo, che è dentro, ne assorbe buona parte |
| **Contestazioni di addebito** (RF-PAY-27→32) | Gestione manuale con i dati esportati. Con tre clienti sono pochi casi l'anno |
| **Onboarding self-service degli organizzatori** (RF-ORG-1→4, 7) | Creazione a mano dal Super Admin. Sono clienti già noti: la coda di approvazione serve quando arrivano sconosciuti |
| **Calendario pubblico, ricerca, mappa** (RF-PUB-1→4, 7, 8) | Collegamento diretto alla scheda evento, diffuso dall'organizzatore sui propri canali. Vedi il rischio al §6 |
| **Codici promozionali** (RF-PAY-5) | **Titolo riservato con codice**, che RF-EVT-7 già prevede come attributo di visibilità: copre lo sconto per soci, allievi e ospiti senza costruire un motore di promozioni |
| **Vendita alla porta** (RF-CHK-10→12) | Da valutare evento per evento: se il primo evento vende in cassa la sera stessa, rientra. Altrimenti resta fuori |
| **Annullamento di singola sessione, minori, classificazione delle immagini, sblocco di sala** | Chiusi in analisi, realizzati con i moduli a cui appartengono. La classificazione e lo sblocco servono solo con la chat |
| **Wallet, notifiche push, passaporto, tracker delle tande, mappa community, nomadi** | Fase 2 (`12-app-tanghero.md`) |
| **Premium** | Progettato e spento, come già deciso. L'interruttore concede tutto a tutti |

---

## 6. I rischi del taglio, dichiarati

| # | Rischio | Come si presidia |
|---|---|---|
| **T1** | **Il rimborso manuale non scala.** Funziona con tre organizzatori, diventa un problema al quinto | Misurare quante richieste arrivano sul primo evento reale. Il motore a scaglioni rientra prima del quarto cliente, non quando fa male |
| **T2** | **Senza calendario pubblico non c'è marketplace.** Il primo taglio è una biglietteria, non un canale: nessun effetto di rete, nessuna scoperta | Dirlo ai clienti con chiarezza. Stanno adottando uno strumento di gestione; il canale arriva con il calendario e con l'app. Prometterlo ora sarebbe una promessa non mantenuta al primo evento |
| **T3** | **Un solo metodo di pagamento.** Una parte del pubblico italiano di eventi paga volentieri con PayPal | Misurare l'abbandono in checkout sul primo evento. È anche il dato che dirà quanto vale davvero l'accordo PayPal |
| **T4** | **La prima vendita vera è un collaudo.** Apertura iscrizioni di un festival atteso significa centinaia di accessi in pochi minuti sul componente più delicato | T23 automatizzato prima, e presidio umano in diretta durante la prima apertura vendite |

---

## 7. Precondizioni non tecniche

Nessuna di queste è sviluppo, e tutte possono bloccare la partenza.

1. **Account Stripe Connect della piattaforma**, e onboarding dei clienti con verifica di
   identità completata. Non è immediato: va avviato per primo.
2. **Condizioni di servizio e informativa privacy**, nella versione minima ma reale — comprese
   la dichiarazione dell'organizzatore (RF-ORG-8) e l'accordo sul trattamento dei dati dei
   partecipanti.
3. **Testi del documento emesso** conformi a RF-TCK-11: conferma d'ordine, nessuna numerazione
   progressiva, nessuna dicitura che lo faccia sembrare un titolo fiscale.
4. **La data del primo evento reale.** È la vera scadenza del progetto e non è ancora nota
   (Q7). Tutto il resto si pianifica a ritroso da lì.

---

## 8. Sequenza proposta

| Passo | Contenuto |
|---|---|
| **1** | Motore di capienza con la sua casistica di test, e modello dati dell'evento. È il fondamento: si costruisce per primo e si collauda prima di avere un'interfaccia |
| **2** | Creazione evento, titoli, quote, scheda pubblica |
| **3** | Checkout Stripe con prenotazione, emissione del biglietto, email |
| **4** | Check-in offline e back-office con esportazioni |
| **5** | **Primo evento reale**, con presidio in diretta all'apertura vendite |
| **6** | Chat e Live Wall, bacheca, rimborsi automatici, PayPal — completamento della fase 1 |
| **7** | L'app del tanghero (`12`) |

Il passo 5 non è una consegna, è un collaudo: il primo evento vero va scelto tra i clienti
**piccolo abbastanza da poterlo seguire di persona** e abbastanza vero da mettere sotto sforzo
le quote per ruolo. Un festival da ottocento persone come primo evento è un rischio inutile.

---

## 9. Che cosa serve sapere dai clienti

Cinque domande, e le risposte cambiano il perimetro sopra:

1. **Quando apre le vendite il prossimo evento?** È la scadenza reale.
2. Che tipo di evento è: festival con sessioni multiple, marathon con pass unico, stage?
   Determina quanto del modello serve subito.
3. **Usa quote per ruolo e iscrizione a coppia?** Se sì, il nocciolo è confermato; se no,
   il primo evento non collauda ciò che distingue il prodotto — e ne serve un altro che lo faccia.
4. Vende **servizi accessori** (pasti, alloggio, t-shirt, lezioni private)?
5. Vende **alla porta** la sera dell'evento, e su **altri canali** oltre alla piattaforma?


---

