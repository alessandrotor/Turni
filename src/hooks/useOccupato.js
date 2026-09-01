import { useEffect } from 'react';
import { segnaOccupato } from '../utils/occupato';

/**
 * Dichiara che questo pezzo di app ha del lavoro in sospeso, e quindi che non è
 * il momento di ricaricare la pagina per mettere in servizio una versione nuova.
 *
 * Lo smontaggio pulisce sempre: un componente che sparisce mentre la condizione
 * era vera lascerebbe l'app «occupata» per sempre, e l'aggiornamento non
 * arriverebbe mai più. È il modo silenzioso in cui questa cosa si rompe, quindi
 * la pulizia sta qui dentro e non nei chiamanti.
 *
 * @param {string} chiave una per componente: 'modale', 'impostazioni', 'import'
 * @param {boolean} occupato
 */
export default function useOccupato(chiave, occupato) {
  useEffect(() => {
    segnaOccupato(chiave, !!occupato);
    return () => segnaOccupato(chiave, false);
  }, [chiave, occupato]);
}
