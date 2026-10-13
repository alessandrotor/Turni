// Contratto «Commercio / Terziario (Confesercenti)»: le regole che il motore legge. Nome e codice
// servono a chi usa il motore da solo; firmatari e vigenza stanno
// nell'archivio CNEL dell'app (src/data/ccnl.json). Un campo che manca vale
// la regola di legge (`LEGGE` in contratti/index.js).

export default {
  codice: "commercio-confesercenti",
  nome: "Commercio / Terziario (Confesercenti)",
  verificato: false,
  monthlyHoursFactor: 4.2,
  ammortizzatori: "fis"
};
