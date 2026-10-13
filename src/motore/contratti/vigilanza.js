// Contratto «Vigilanza privata / Servizi fiduciari»: le regole che il motore legge. Nome e codice
// servono a chi usa il motore da solo; firmatari e vigenza stanno
// nell'archivio CNEL dell'app (src/data/ccnl.json). Un campo che manca vale
// la regola di legge (`LEGGE` in contratti/index.js).

export default {
  codice: "vigilanza",
  nome: "Vigilanza privata / Servizi fiduciari",
  verificato: true,
  monthlyHoursFactor: 4.325,
  enteBilaterale: {
    label: "EPAR (ente bilaterale)",
    pct: 0.1,
    quotaDitta: 0
  },
  ammortizzatori: "fis",
  note: "Divisore orario 173 letto dall'intestazione di una busta reale (CCNL/DIVIS 173,00 / 26,00). FIS e CIGS non sono più scritti qui: sono contributi di legge, calcolati sulla dimensione dell'azienda (vedi utils/contributi-legge.js). Il contributo EPAR è allo 0,10% sulla paga tabellare, l'unico valore su cui le fonti concordano; la quota a carico azienda varia fra 0,10% e 0,15% secondo il firmatario ed è lasciata a zero. NON coperte le maggiorazioni festivo 40% / domenicale 15%, che sono impostazioni dell'utente e non dati del contratto.",
};
