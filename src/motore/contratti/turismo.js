// Contratto «Turismo / Pubblici esercizi»: le regole che il motore legge. Nome e codice
// servono a chi usa il motore da solo; firmatari e vigenza stanno
// nell'archivio CNEL dell'app (src/data/ccnl.json). Un campo che manca vale
// la regola di legge (`LEGGE` in contratti/index.js).

export default {
  codice: "turismo",
  nome: "Turismo / Pubblici esercizi",
  verificato: true,
  monthlyHoursFactor: 4.3,
  mensilizzato: true,
  enteBilaterale: {
    label: "Ente Bilaterale Turismo",
    pct: 0.2,
    quotaDitta: 0.2
  },
  ammortizzatori: "fis",
  fasciaNotturna: {
    inizio: "23:00",
    fine: "06:00"
  },
  straordinarioNotturno: {
    pct: 60,
    inizio: "00:00",
    fine: "06:00"
  },
  note: "Divisore orario 4,3 e mensilizzazione riscontrati sulle buste di giugno e luglio 2026. MAGGIORAZIONI riscontrate su 17 cedolini 2024-2025 (pubblici esercizi, part-time 60%, livello 6S): notturno 25%, domenicale 10%, supplementare 30%, festivo 20%. Attenzione a come il cedolino le SCRIVE: domenicale e notturno riportano la sola maggiorazione («Magg. dom. 10%» = base x 0,10), mentre il festivo riporta il TOTALE («Magg. fest. 120%» = base x 1,20, cioe' +20%). Nell'app va sempre il «quanto in piu'», quindi 20 e non 120. La FASCIA notturna non e' nota: le buste non riportano le timbrature, e l'art. 13 CCNL prevede orari diversi per settore (24:00-06:00 ordinario, 23:00-06:00 pubblici esercizi, 23:30-06:30 alberghiero). Questi valori dipendono da livello e firmatario: vanno confermati sul proprio cedolino. La PAGA ORARIA si ricava dalla tabella: minimo tabellare + contingenza + terzo elemento, diviso 172 (che e' 40 h x 4,3) e riproporzionato al part-time. Sono le tre voci stampate in testa al cedolino: sulla busta di riferimento 1.057,72 + 522,37 + 5,41 = 1.585,50, cioe' 9,21802 EUR/h a tempo pieno. Se il conto non torna, la paga oraria inserita non e' quella del proprio livello. Il terzo elemento fa parte della retribuzione ma NON della base dell'Ente Bilaterale.",
};
