// I CONTRATTI che il motore conosce: uno per file, una riga qui sotto.
//
// Per AGGIUNGERNE uno: copia un file di questa cartella, cambia codice e
// regole, aggiungi la sua riga qui. Per TOGLIERLO: cancella la riga e il file.
// Il `codice` è quello che le impostazioni scrivono in `ccnl`.
//
// Un contratto che non è qui — o un campo che il suo file non scrive — vale
// la regola di legge, `LEGGE` qui sotto. Il nome di tutti gli altri contratti
// italiani sta nell'archivio CNEL dell'app, che il motore non legge.

import turismo from './turismo.js';
import commercio from './commercio.js';
import commercioConfesercenti from './commercio-confesercenti.js';
import vigilanza from './vigilanza.js';
import domestico from './domestico.js';

export const CONTRATTI = Object.fromEntries(
  [turismo, commercio, commercioConfesercenti, vigilanza, domestico].map((c) => [c.codice, c]),
);

// La regola di legge, campo per campo, per chi non ne dichiara una sua.
export const LEGGE = {
  codice: '',
  nome: '',
  verificato: false,
  // 52 settimane spalmate su 12 mesi.
  monthlyHoursFactor: 52 / 12,
  // Retribuzione a ore lavorate, non un importo fisso al mese.
  mensilizzato: false,
  contributiExtra: [],
  enteBilaterale: null,
  // A quale fondo per gli ammortizzatori sociali è iscritto il settore ('fis',
  // oppure null se non lo sappiamo). Le ALIQUOTE dipendono dalla dimensione
  // dell'azienda, non dal contratto: vedi contributi-legge.js.
  ammortizzatori: null,
  // `null` = la fascia di legge (22:00–06:00, D.Lgs. 66/2003). La PERCENTUALE
  // non sta qui: dipende dal lavoratore ed è un'impostazione.
  fasciaNotturna: null,
  // `null` = lo straordinario di notte vale come di giorno.
  straordinarioNotturno: null,
};
