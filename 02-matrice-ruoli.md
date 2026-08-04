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
