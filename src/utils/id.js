// ID locale univoco per turni e righe di form. Timestamp + due componenti
// casuali: i due random servono a evitare collisioni quando si generano più id
// nello stesso millisecondo (es. import di molti turni in un ciclo).
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
