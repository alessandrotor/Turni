import { useState, useEffect, useRef } from 'react';

// Stato che vive nel localStorage del browser, che per quest'app NON è una cache: è l'archivio.
//
// L'errore di scrittura non si ingoia: un `catch` vuoto faceva comparire il turno nel calendario
// per poi perderlo al ricaricamento. Il fallimento sale a chi chiama, che deve dirlo a schermo.
// La scrittura è in un effetto e non dentro l'updater (React può rieseguirlo): segue il valore
// invece di precederlo.

// I browser non concordano sul nome dell'errore di quota (Chrome e Safari QuotaExceededError,
// Firefox NS_ERROR_DOM_QUOTA_REACHED): il rimedio è diverso dal riabilitare lo storage.
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

// Se il JSON salvato non si legge, i byte NON si buttano: si copiano in una chiave a parte, una
// sola volta (la prima copia è la più vicina all'originale). Niente domande.
export const SUFFISSO_ILLEGGIBILE = '__illeggibile';

export function leggiSalvato(storage, key, initialValue) {
  let item = null;
  try {
    item = storage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  } catch {
    if (item) {
      try {
        if (storage.getItem(key + SUFFISSO_ILLEGGIBILE) == null) storage.setItem(key + SUFFISSO_ILLEGGIBILE, item);
      } catch { /* storage pieno o bloccato: qui non c'è altro da fare */ }
    }
    return initialValue;
  }
}

export const NESSUN_CAMBIO = Symbol('nessun cambio');

/**
 * Il valore che un evento `storage` porta per `key`: quello scritto dall'altra scheda,
 * `initialValue` se l'ha cancellato, `NESSUN_CAMBIO` se l'evento è di un'altra chiave o non
 * si legge (un JSON rotto non sostituisce dati buoni).
 */
export function valoreDaAltraScheda(evento, key, initialValue) {
  if (evento?.key === null) return initialValue; // localStorage.clear()
  if (evento?.key !== key) return NESSUN_CAMBIO;
  if (evento.newValue == null) return initialValue;
  try {
    return JSON.parse(evento.newValue);
  } catch {
    return NESSUN_CAMBIO;
  }
}

/**
 * @returns {[any, Function, object|null]} valore, setter, errore di salvataggio
 *   (`null` finché tutto va bene). Il terzo elemento è nuovo: i chiamanti che
 *   ne prendono due continuano a funzionare, ma chi tiene dati dell'utente
 *   DEVE mostrarlo — vedi il banner in `App.jsx`.
 */
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => leggiSalvato(localStorage, key, initialValue));

  const [erroreSalvataggio, setErroreSalvataggio] = useState(null);

  // Il primo giro non scrive: il valore appena letto è già quello sul disco.
  const primoGiro = useRef(true);

  // Un'altra scheda ha scritto la stessa chiave: si prende il suo valore. Senza, ogni scheda
  // riscriveva la sua copia e cancellava i turni segnati nell'altra. → check-due-schede.mjs
  useEffect(() => {
    const ascolta = (e) => {
      const nuovo = valoreDaAltraScheda(e, key, initialValue);
      if (nuovo !== NESSUN_CAMBIO) setValue(nuovo);
    };
    window.addEventListener('storage', ascolta);
    return () => window.removeEventListener('storage', ascolta);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- `initialValue` è un letterale nuovo a ogni render

  useEffect(() => {
    if (primoGiro.current) {
      primoGiro.current = false;
      return;
    }
    try {
      const testo = JSON.stringify(value);
      // Già sul disco (arriva dall'altra scheda): riscriverlo non serve.
      if (localStorage.getItem(key) !== testo) localStorage.setItem(key, testo);
      // Si azzera solo dopo una scrittura riuscita: un errore resta a schermo
      // finché il salvataggio non torna a funzionare davvero.
      setErroreSalvataggio(prev => (prev ? null : prev));
    } catch (err) {
      setErroreSalvataggio(descriviErroreScrittura(err));
    }
  }, [key, value]);

  return [value, setValue, erroreSalvataggio];
}
