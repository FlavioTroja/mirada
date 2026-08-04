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
