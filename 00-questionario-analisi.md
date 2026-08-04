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
