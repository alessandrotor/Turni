// Correzione degli orari con i minuti a :50. Sul foglio turni «16,50» vuol dire **16:30**: gli
// import da foto fatti prima della conversione in `services/gemini.js` (`toHHMM`) sono entrati
// sbagliati, e ogni turno così vale venti minuti più del dovuto.
//
// Qui c'è solo la regola, senza localStorage (`scripts/check-correzione-orari.mjs`); la parte che
// scrive sta in `services/correzioni.js`.

// Un orario 'HH:50' diventa 'HH:30'. Qualunque altro minuto resta com'è.
function correggiOrario(hhmm) {
  const m = /^(\d{1,2}):50$/.exec(String(hhmm ?? '').trim());
  return m ? `${m[1].padStart(2, '0')}:30` : hhmm;
}

/**
 * Turni con almeno un estremo a :50, con la correzione già calcolata.
 *
 * @param {object} turni mappa { id: turno }
 * @returns {Array<{id, date, startTime, endTime, nuovoStart, nuovoEnd}>} ordinati per data
 */
export function trovaOrariDaCorreggere(turni) {
  return Object.values(turni || {})
    .map(t => ({
      id: t.id,
      date: t.date,
      startTime: t.startTime,
      endTime: t.endTime,
      nuovoStart: correggiOrario(t.startTime),
      nuovoEnd: correggiOrario(t.endTime),
    }))
    .filter(t => t.nuovoStart !== t.startTime || t.nuovoEnd !== t.endTime)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}

/**
 * Applica la correzione restituendo una NUOVA mappa: l'originale non si tocca.
 *
 * @param {object} turni mappa { id: turno }
 * @param {string[]} [ids] se passato, corregge solo questi turni
 */
export function correggiOrari(turni, ids = null) {
  const soloQuesti = ids ? new Set(ids) : null;
  const out = {};
  for (const [id, t] of Object.entries(turni || {})) {
    out[id] = soloQuesti && !soloQuesti.has(id)
      ? t
      : { ...t, startTime: correggiOrario(t.startTime), endTime: correggiOrario(t.endTime) };
  }
  return out;
}
