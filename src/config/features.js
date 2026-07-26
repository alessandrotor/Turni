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
