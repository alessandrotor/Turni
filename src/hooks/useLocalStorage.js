import { useState, useEffect, useRef } from 'react';

// Stato che vive nel localStorage del browser — che per quest'app NON è una
// cache: è l'archivio. Non c'è server, non c'è account, e quello che non entra
// qui dentro non esiste da nessun'altra parte.
//
// PERCHÉ L'ERRORE NON SI PUÒ PIÙ INGOIARE
// Fino al 31 agosto 2026 questo file conteneva `catch { /* ignore quota errors */ }`
// e restituiva comunque il valore nuovo. Lo stato React si aggiornava, quindi il
// turno appena inserito COMPARIVA nel calendario, i totali si muovevano, tutto
// sembrava a posto — e al ricaricamento non c'era più. Con un mese di
// inserimenti la perdita era totale, e la si scopriva solo dopo.
//
// Un'app che promette di ricordare non può fallire in silenzio proprio in quello.
// Ora il fallimento sale a chi chiama, che deve dirlo a schermo.
//
// PERCHÉ LA SCRITTURA È IN UN EFFETTO E NON DENTRO L'UPDATER
// Stava dentro la funzione passata a `setValueState`, cioè un effetto collaterale
// dentro un updater — che React può rieseguire (StrictMode, rendering
// concorrente). Significa poter scrivere su disco un valore che React poi scarta.
// Qui la scrittura segue il valore invece di precederlo: parte dopo il render,
// una volta sola per ogni cambio.

// I browser non concordano sul nome dell'errore di quota: Chrome e Safari usano
// QuotaExceededError (codice 22), Firefox NS_ERROR_DOM_QUOTA_REACHED (1014).
// Distinguerlo conta perché il rimedio è diverso: fare spazio, oppure
// riabilitare lo storage.
function descriviErroreScrittura(err) {
  const nome = err?.name || '';
  const codice = err?.code;
  const quota = nome === 'QuotaExceededError'
    || nome === 'NS_ERROR_DOM_QUOTA_REACHED'
    || codice === 22
    || codice === 1014;

  return quota
    ? {
      tipo: 'quota',
      testo: 'La memoria del browser è piena: gli ultimi dati NON sono stati salvati.',
      rimedio: 'Fai un backup adesso, poi libera spazio (in Impostazioni puoi esportare tutto).',
    }
    : {
      tipo: 'bloccato',
      testo: 'Il browser ha rifiutato il salvataggio: gli ultimi dati NON sono stati salvati.',
      rimedio: 'Succede in navigazione privata o con i cookie bloccati per questo sito. Fai un backup e riapri l\'app in una finestra normale.',
    };
}

/**
 * @returns {[any, Function, object|null]} valore, setter, errore di salvataggio
 *   (`null` finché tutto va bene). Il terzo elemento è nuovo: i chiamanti che
 *   ne prendono due continuano a funzionare, ma chi tiene dati dell'utente
 *   DEVE mostrarlo — vedi il banner in `App.jsx`.
 */
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const [erroreSalvataggio, setErroreSalvataggio] = useState(null);

  // Il primo giro non scrive: il valore appena letto è già quello sul disco, e
  // riscriverlo significherebbe soltanto poter fallire senza motivo.
  const primoGiro = useRef(true);

  useEffect(() => {
    if (primoGiro.current) {
      primoGiro.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // Si azzera solo dopo una scrittura riuscita: un errore resta a schermo
      // finché il salvataggio non torna a funzionare davvero.
      setErroreSalvataggio(prev => (prev ? null : prev));
    } catch (err) {
      setErroreSalvataggio(descriviErroreScrittura(err));
    }
  }, [key, value]);

  return [value, setValue, erroreSalvataggio];
}
