// Feature flag per le funzioni "private beta" (non destinate alla release pubblica).
//
// ENABLE_NET_CALC attiva la stima del netto (IRPEF, contributi, addizionali,
// trattamento integrativo, cuneo fiscale) nel calendario.
//
// Per una RELEASE PUBBLICA disattivala in uno di questi due modi:
//   1. build con la variabile d'ambiente:  VITE_BETA_NET=false
//   2. oppure cambia il default qui sotto a `false`.
// Con il flag OFF l'app è identica alla versione pubblica (nessun codice beta a video).

const env = import.meta.env.VITE_BETA_NET;
export const ENABLE_NET_CALC = env != null ? env === 'true' : true; // default ON sul branch private-beta

// ENABLE_STATS mostra la pagina Statistiche (calendarietto dell'anno, serie di
// giorni lavorati, riepilogo mensile).
//
// PERCHÉ IL DEFAULT È SPENTO, AL CONTRARIO DEL NETTO
// Non è una funzione incerta nei conti — usa la stessa aritmetica del
// Calendario — è una pagina su cui non è ancora stata presa una decisione: cosa
// mostri, e se serva davvero nella prima versione pubblica. Finché quella
// decisione non c'è, non deve arrivare a chi installa l'app.
//
// E il default deve essere quello che si vuole in PRODUZIONE, perché la
// produzione si costruisce a mano: se il default fosse acceso, basterebbe
// dimenticare una variabile per pubblicarla. Con il default spento, una
// dimenticanza porta allo stato voluto invece che a quello sbagliato.
//
// Per averla in sviluppo: `VITE_BETA_STATS=true` in `.env.local`.
// Il sito di prova la accende dal workflow (.github/workflows/deploy-test.yml),
// così i tester continuano a vederla.
export const ENABLE_STATS = import.meta.env.VITE_BETA_STATS === 'true';

// ENABLE_DEBUG mostra il riquadro con la ripartizione dei token dopo un import
// da immagine. È materiale da sviluppo: in una build pubblicata sullo Store non
// deve comparire, quindi il default è OFF e si accende solo di proposito
// (`VITE_DEBUG=true`, tipicamente in .env.local durante `npm run dev`).
export const ENABLE_DEBUG = import.meta.env.VITE_DEBUG === 'true';
