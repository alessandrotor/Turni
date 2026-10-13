// Contratto «Lavoro domestico (colf, badanti, baby sitter)»: le regole che il motore legge. Nome e codice
// servono a chi usa il motore da solo; firmatari e vigenza stanno
// nell'archivio CNEL dell'app (src/data/ccnl.json). Un campo che manca vale
// la regola di legge (`LEGGE` in contratti/index.js).

export default {
  codice: "domestico",
  nome: "Lavoro domestico (colf, badanti, baby sitter)",
  verificato: false,
  monthlyHoursFactor: 4.333333333333333,
  note: "Contributi INPS con regole proprie del lavoro domestico: la stima del netto è indicativa.",
};
