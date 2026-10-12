// Contratto «Commercio / Terziario, distribuzione e servizi (Confcommercio)»: le regole che il motore legge. Nome e codice
// servono a chi usa il motore da solo; firmatari e vigenza stanno
// nell'archivio CNEL dell'app (src/data/ccnl.json). Un campo che manca vale
// la regola di legge (`LEGGE` in contratti/index.js).

export default {
  codice: "commercio",
  nome: "Commercio / Terziario, distribuzione e servizi (Confcommercio)",
  verificato: false,
  monthlyHoursFactor: 4.2,
  ammortizzatori: "fis"
};
