// Festività italiane per la maggiorazione automatica dei festivi.

// Domenica di Pasqua (computus, algoritmo di Meeus/Gauss). Ritorna { month(1-12), day }.
export function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=aprile
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

// Festività nazionali a data fissa: [mese(1-12), giorno].
const FIXED = [
  [1, 1],   // Capodanno
  [1, 6],   // Epifania
  [4, 25],  // Liberazione
  [5, 1],   // Festa del Lavoro
  [6, 2],   // Festa della Repubblica
  [8, 15],  // Ferragosto
  [11, 1],  // Ognissanti
  [12, 8],  // Immacolata
  [12, 25], // Natale
  [12, 26], // Santo Stefano
];

// True se la data ISO 'YYYY-MM-DD' è una festività (nazionale, Pasqua/Pasquetta,
// o santo patrono locale se impostato in settings.patronSaintDate come 'MM-DD').
export function isHoliday(dateStr, settings = {}) {
  const s = String(dateStr || '');
  if (s.length < 10) return false;
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));

  if (FIXED.some(([mo, dd]) => mo === month && dd === day)) return true;

  // Pasqua (domenica) e Pasquetta (lunedì dell'Angelo = Pasqua + 1 giorno).
  const e = easterSunday(year);
  if (e.month === month && e.day === day) return true;
  const pasquetta = new Date(year, e.month - 1, e.day + 1); // gestisce il rollover di mese
  if (pasquetta.getMonth() + 1 === month && pasquetta.getDate() === day) return true;

  // Santo patrono locale (opzionale), formato 'MM-DD'.
  const patron = String(settings.patronSaintDate || '');
  if (patron.length === 5) {
    const pm = Number(patron.slice(0, 2));
    const pd = Number(patron.slice(3, 5));
    if (pm === month && pd === day) return true;
  }

  return false;
}
