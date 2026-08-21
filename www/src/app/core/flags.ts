/**
 * Interruttori temporanei del sito pubblico.
 *
 * Non è un sistema di feature flag e non deve diventarlo: è il posto dove
 * mettere le poche cose accese o spente **a mano**, con scritto accanto perché.
 * Una costante sparsa in un componente, il giorno in cui la si vuole riaccendere,
 * la si cerca; qui la si trova.
 */

/**
 * La vetrina degli eventi — il collegamento «Eventi» nella testata e i richiami
 * al catalogo dalla home.
 *
 * **Spenta per il momento**: finché non c'è un catalogo da mostrare, un menu che
 * porta a «0 eventi trovati» racconta al primo visitatore che la piattaforma è
 * deserta.
 *
 * ── Che cosa NON spegne ─────────────────────────────────────────────────────
 * **La pagina `/eventi` resta esattamente com'era**, e con lei le schede dei
 * singoli eventi e il percorso d'iscrizione: chi ha il link ci arriva, la ricerca
 * funziona, l'acquisto si conclude. Si spegne l'insegna, non il negozio — un
 * organizzatore che ha già mandato in giro l'indirizzo del proprio evento non
 * deve trovarlo rotto perché la vetrina è chiusa.
 *
 * ── Come si riaccende ───────────────────────────────────────────────────────
 * Questa costante a `true`.
 */
export const MOSTRA_VETRINA_EVENTI = false;
