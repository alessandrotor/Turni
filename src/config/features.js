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

// ENABLE_STATS mostra la pagina Statistiche. Il default è SPENTO: la produzione si costruisce a
// mano, e una variabile dimenticata deve portare allo stato voluto. In sviluppo:
// `VITE_BETA_STATS=true` in `.env.local`; il sito di prova la accende dal workflow
// (.github/workflows/deploy-test.yml).
export const ENABLE_STATS = import.meta.env.VITE_BETA_STATS === 'true';

// ENABLE_DEBUG mostra il riquadro con la ripartizione dei token dopo un import
// da immagine. È materiale da sviluppo: in una build pubblicata sullo Store non
// deve comparire, quindi il default è OFF e si accende solo di proposito
// (`VITE_DEBUG=true`, tipicamente in .env.local durante `npm run dev`).
export const ENABLE_DEBUG = import.meta.env.VITE_DEBUG === 'true';

// ENABLE_MESE_PAGA mostra il selettore fra «mese di calendario» e «mese di paga» (settimane
// intere). SPENTO: la busta di agosto 2026 ha stabilito che la finestra giusta è il CALENDARIO
// (check-busta-agosto-2026.mjs). Il codice del mese di paga resta, per un contratto che tagli a
// settimane intere. Con il flag spento il periodo è sempre «calendario» (App.jsx lo normalizza).
export const ENABLE_MESE_PAGA = import.meta.env.VITE_MESE_PAGA === 'true';
