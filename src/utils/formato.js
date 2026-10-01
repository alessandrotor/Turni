// Come si scrivono gli euro nei riquadri e nei popup del calendario.
//
// `useGrouping: 'always'` non è un vezzo: in italiano il punto delle migliaia
// parte da cinque cifre (16.600 sì, 1200 no), e in un riquadro che spiega un
// conto «1200» accanto a «16.600» sembrano scritti da due mani diverse.
// Fallback per le WebView vecchie, dove l'opzione non esiste.
//
// Stava dentro CalendarView; ora la usano anche i popup fiscali, che ne sono
// usciti (vedi check-dimensioni.mjs).

export function numeroIt(n) {
  const v = Math.round(n);
  try {
    return new Intl.NumberFormat('it-IT', { useGrouping: 'always', maximumFractionDigits: 0 }).format(v);
  } catch {
    return v.toLocaleString('it-IT');
  }
}

export const euroCella = (n) => `${numeroIt(n)} €`;

// Le forchette si arrotondano verso l'esterno, alla decina.
export const giù10 = (n) => Math.floor(n / 10) * 10;
export const su10 = (n) => Math.ceil(n / 10) * 10;

/** La forchetta del conguaglio in parole: «ti riprendono 40 €–90 €». */
export function scriviForchetta(c) {
  if (!c) return '';
  if (c.direzione === 'pari') return 'circa in pari';
  if (c.direzione === 'debito') return `ti riprendono ${euroCella(giù10(c.min))}–${euroCella(su10(c.max))}`;
  if (c.direzione === 'credito') return `ti ridanno ${euroCella(giù10(-c.max))}–${euroCella(su10(-c.min))}`;
  return `da ${euroCella(su10(-c.min))} a credito a ${euroCella(su10(c.max))} a debito`;
}
