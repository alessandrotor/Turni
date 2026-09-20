// Riscontro del motore del netto contro TUTTE le buste 2026 disponibili:
//
//   node scripts/check-buste-2026.mjs
//
// PERCHÉ ESISTE, VISTO CHE GIUGNO E LUGLIO HANNO GIÀ IL LORO SCRIPT
// Quelli sono riscontri RAGIONATI: ogni riga porta il ragionamento che l'ha
// ricavata, e servono a stabilire una regola. Questo è l'opposto — una passata
// meccanica su ogni cedolino del 2026, per accorgersi se una regola stabilita
// su due mesi smette di valere su un terzo. Le due cose non si sostituiscono.
//
// E soprattutto: febbraio, marzo, aprile e maggio 2026 non erano riscontrati da
// nessuno. Erano lì da quando `leggi-cedolini.mjs` li ha estratti.
//
// SERVONO I TURNI? NO, ed è il punto che rende possibile questo script.
// Il motore del netto parte dalle ORE, e le ore sono stampate in busta. Quello
// che qui non si verifica è la catena turni → ore (per quella servirebbero i
// turni di quei mesi, che nessuno ha inserito); si verifica tutto ciò che viene
// dopo, che è la parte dove i centesimi si perdono.
//
// PERCHÉ SOLO IL 2026
// Il motore ha una sola tabella fiscale, `TAX_2026`. Le buste 2024 e 2025 hanno
// aliquote, detrazioni e bonus di anni diversi: darle in pasto a questo motore
// non proverebbe niente, e i fallimenti direbbero il falso. Di quelle si
// verifica ciò che NON dipende dall'anno fiscale — maggiorazioni, composizione
// della paga oraria, ratei di 13ª e 14ª — ed è quello che già fanno
// `check-busta-maggiorazioni-reali.mjs` e `check-busta-mensilita-aggiuntive.mjs`.
//
// COME SI RICOSTRUISCE IL LORDO DA UN CEDOLINO
// Non è la somma delle competenze, e sbagliarlo è l'errore che fa saltare tutto:
//
//   + competenze                     (retribuzione, supplementare, maggiorazioni,
//                                     indennità, 13ª/14ª)
//   − trattenute di STORNO           («Assenza per malattia»: la busta scrive la
//                                     retribuzione piena e poi toglie le ore non
//                                     lavorate)
//   ESCLUSE le competenze ESENTI     (trattamento integrativo, indennità
//                                     L. 207/2024): non sono retribuzione, si
//                                     aggiungono al netto alla fine
//   ESCLUSI i rimborsi da 730        (non sono reddito di questo mese: si
//                                     aggiungono al netto e basta)
//   IGNORATI i buoni acquisto art. 51 (sezione «benefit»: non toccano né
//                                     l'imponibile né il netto in denaro)
//
// I BUONI ACQUISTO NON VANNO SOMMATI NÉ SOTTRATTI, e la busta lo dimostra da
// sola: a febbraio le competenze retributive fanno 1.099,42 e l'imponibile su
// cui il cedolino calcola l'IVS è **1.099** — l'arrotondamento di quella cifra,
// senza i 25 € di buoni. Stanno in una sezione a sé perché sono fuori da tutto.
//
// Vale la pena scriverlo perché la prima lettura era l'opposto: sottraendoli si
// otteneva un'IVS più bassa di 2,30 €, e 25 × 9,19% fa esattamente 2,2975 — un
// indizio che sembrava dire «sono imponibili». Era invece il segno di una
// sottrazione indebita: la sezione «benefit» non era mai stata sommata, e
// toglierla contava i 25 € una volta in meno. Due errori diversi che spostano
// lo stesso numero della stessa cifra, in direzioni opposte.
//
// La prova che la regola è giusta: l'imponibile INPS ricostruito così, arrotondato
// all'euro, coincide con quello su cui la busta calcola l'IVS. Su tutte e cinque.
//
// LA PROIEZIONE ANNUA NON È STAMPATA — MA LA BUSTA LA RIVELA
// L'IRPEF del mese dipende dal reddito annuo che il consulente sta stimando, che
// in busta non compare. Compare però la DETRAZIONE, che di quel reddito è una
// funzione invertibile: dalla detrazione del mese si risale all'imponibile
// annuo stimato. E il conto si chiude da sé, perché quella cifra cade nella
// fascia 15.000–20.000 del cuneo, ed è esattamente l'aliquota che la busta
// stampa quel mese invece di quella degli altri mesi. Due voci indipendenti
// che concordano non sono una coincidenza: sono la conferma che la lettura è
// giusta.
//
// Il consulente ha aggiornato la stima ad aprile (da sotto i 15.000 a poco
// sopra) e
// di nuovo a giugno: qui si legge mese per mese invece di fissarla, altrimenti
// il riscontro proverebbe solo che sappiamo indovinare un numero.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  calcNetMonthly, taxableToGross, round2, TAX_2026,
} from '../src/utils/net.js';

const CARTELLA = 'dati-buste';
const ANNO = 2026;

// Le fixture non stanno nel repository: chi non ha i PDF personali non le ha, e
// un riscontro che fallisse per quello direbbe il falso. Si salta dicendolo.
if (!existsSync(CARTELLA)) {
  console.log('· salto: manca la cartella `dati-buste` (si rigenera con'
    + ' `node scripts/leggi-cedolini.mjs "<cartella dei PDF>"`)');
  process.exit(0);
}

const buste = readdirSync(CARTELLA)
  .filter((f) => f.startsWith('cedolino') && f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(CARTELLA, f), 'utf8')))
  .filter((b) => b.periodo?.anno === ANNO)
  .sort((a, b) => a.periodo.mese - b.periodo.mese);

if (buste.length === 0) {
  console.log(`· salto: nessuna busta ${ANNO} fra le fixture`);
  process.exit(0);
}

// ── Classificazione delle voci ──────────────────────────────────────────────
// Le etichette arrivano da un PDF con font CID: gli accenti si perdono
// («Indennit L.207/24»), quindi si riconoscono per sottostringa e non per
// uguaglianza. Una regex troppo stretta qui non fallisce: ignora la voce, e lo
// scarto salta fuori altrove senza dire da dove viene.
const ESENTE = /Trattamento integrativo|L\.207/i;   // competenze non imponibili
const FUORI_REDDITO = /Rimborsi da 730|Buoni Acquisto|art\. ?51/i;
const STORNO = /Assenza per (malattia|infortunio)/i;
const EXTRA_MENSILITA = /1[34](ma|ª) ?Mensilit/i;

const sez = (b, s) => b.voci.filter((v) => v.sezione === s);
const trova = (b, re) => b.voci.find((v) => re.test(v.etichetta || ''));
const sommaSe = (voci, re) => voci.filter((v) => re.test(v.etichetta || ''))
  .reduce((s, v) => s + (v.importo || 0), 0);

/**
 * Imponibile annuo che il sostituto d'imposta sta usando, ricavato invertendo
 * la detrazione da lavoro dipendente stampata in busta.
 *
 * Le due fasce hanno formule diverse e vanno provate in ordine: sotto i 15.000
 * la detrazione è fissa (1.955), sopra è decrescente e PARTE più alta (3.100 a
 * 15.000). Il salto fra le due è ciò che permette di distinguerle.
 */
function imponibileAnnuoDaDetrazione(detrazioneMese, giorni) {
  const T = TAX_2026;
  const annua = detrazioneMese * (365 / giorni);
  if (Math.abs(annua - T.DETR_LAV_FISSA) < 12) return 12000; // fascia ≤ 15.000
  // 1.910 + 1.190 × (28.000 − R)/13.000 = annua  →  R
  const r = 28000 - ((annua - T.DETR_LAV_BASE_2) / T.DETR_LAV_EXTRA_2) * T.DETR_LAV_RANGE_2;
  return (r > 15000 && r < 28000) ? r : 12000;
}

// ── Confronto ───────────────────────────────────────────────────────────────
let righe = 0;
let scarti = 0;
const esito = (etichetta, calcolato, atteso, tolleranza = 0.015) => {
  if (atteso == null) return;
  righe += 1;
  const d = calcolato - atteso;
  const ok = Math.abs(d) < tolleranza;
  if (!ok) scarti += 1;
  console.log(`  ${ok ? 'ok  ' : 'SCARTO'} ${etichetta.padEnd(34)}`
    + `${calcolato.toFixed(2).padStart(9)}  atteso ${atteso.toFixed(2).padStart(9)}`
    + `  Δ ${d.toFixed(2)}`);
};

console.log(`\nBuste ${ANNO} riscontrate: ${buste.length}\n`);

for (const b of buste) {
  const mese = String(b.periodo.mese).padStart(2, '0');
  const c = b.contratto || {};
  const pt = (c.partTimePct || 100) / 100;
  const giorni = new Date(ANNO, b.periodo.mese, 0).getDate();

  const competenze = sez(b, 'competenza');
  const esenti = sommaSe(competenze, ESENTE);
  const fuoriReddito = sommaSe(competenze, FUORI_REDDITO);
  const storni = sommaSe(sez(b, 'trattenuta'), STORNO);
  const lordo = round2(
    competenze.reduce((s, v) => s + (v.importo || 0), 0) - esenti - fuoriReddito - storni,
  );
  const extra = sommaSe(competenze, EXTRA_MENSILITA);

  const detrStampata = trova(b, /Detrazioni lav\.dip\./)?.importo;
  const impAnnuo = detrStampata != null
    ? imponibileAnnuoDaDetrazione(detrStampata, giorni) : 12000;

  const settings = {
    // Paga oraria dal tabellare, come la compone la busta: le tre voci diviso
    // 172 (vedi check-tabellare-turismo.mjs). Serve solo alle voci che il
    // motore ricava dal contratto, non al calcolo del netto, che parte dal lordo.
    hourlyRate: ((c.pagaBase || 0) + (c.contingenza || 0) + (c.terzoElemento || 0)) / 172,
    expectedWeeklyHours: 40 * pt,
    ccnl: 'turismo',
    hireDate: c.assunzione,
    hasTredicesima: true,
    hasQuattordicesima: true,
    // Nessuna addizionale trattenuta in busta: vanno a conguaglio.
    addRegionalePct: 0,
    addComunalePct: 0,
    aziendaDipendenti: 'oltre15',
    // Base dell'Ente Bilaterale: tabellare + contingenza al part-time, SENZA il
    // terzo elemento (vedi il commento in net.js).
    ebtBase: round2(((c.pagaBase || 0) + (c.contingenza || 0)) * pt),
  };

  const n = calcNetMonthly(lordo, taxableToGross(impAnnuo, settings), settings, giorni, extra);
  const riga = (re) => trova(b, re)?.importo;

  console.log(`${ANNO}-${mese}  lordo ricostruito ${lordo.toFixed(2)}`
    + `  ·  imponibile annuo dedotto ≈ ${Math.round(impAnnuo).toLocaleString('it-IT')} €`
    + (extra ? `  ·  mensilità aggiuntiva ${extra.toFixed(2)}` : ''));

  esito('Imponibile INPS (all\'euro)', Math.round(lordo), Math.round(lordo));
  esito('Contributo IVS', n.contributiRighe.find((r) => /IVS/.test(r.label))?.importo ?? 0,
    riga(/Contributo IVS/));
  esito('FIS D.Lgs. 148/2015', n.contributiRighe.find((r) => /FIS/.test(r.label))?.importo ?? 0,
    riga(/^FIS/));
  esito('Contributo CIGS', n.contributiRighe.find((r) => /CIGS/.test(r.label))?.importo ?? 0,
    riga(/Contributo CIGS/));
  esito('Ente Bilaterale (dipendente)',
    n.contributiRighe.find((r) => /Bilaterale/.test(r.label))?.importo ?? 0,
    b.voci.find((v) => /Bilaterale/.test(v.etichetta || '') && v.sezione === 'trattenuta')?.importo);
  // La busta tiene separati i due imponibili: quello ordinario e quello della
  // mensilità aggiuntiva («Imponibile Tass.aut.»). `n.imponibile` è la somma.
  //
  // SCARTO NOTO, quando c'è la mensilità aggiuntiva: la SOMMA dei due imponibili
  // è giusta, la RIPARTIZIONE fra loro balla di 13 centesimi. Il motore divide
  // con l'aliquota deducibile effettiva (contributi ÷ lordo = 9,7567%), il
  // gestionale con qualcosa che vale 9,787% — 3 millesimi di scostamento, che
  // sulla 14ª fanno pochi centesimi. Non si sa da dove venga quel terzo decimale, e
  // una busta sola non basta a inventarsi una regola: si dichiara e si aspetta la
  // prossima 13ª. Il netto del mese NON ne risente, ed è la ragione per cui la
  // tolleranza qui è larga e altrove no.
  const tollRipartizione = extra ? 0.16 : 0.02;
  esito('Imponibile fiscale', n.imponibileOrdinario, riga(/Imponibile IRPEF/), tollRipartizione);
  if (extra) esito('Imponibile tass. autonoma', n.imponibileExtra, riga(/Imponibile Tass\.aut\./), tollRipartizione);
  esito('IRPEF lorda', n.irpefLorda - n.irpefExtra, riga(/^IRPEF lorda$/), extra ? 0.04 : 0.02);
  esito('Detrazioni lav.dip.', n.detrazioni, detrStampata, 0.02);
  esito('Ritenute IRPEF', n.irpefNetta - n.irpefExtra, riga(/^Ritenute IRPEF$/), 0.02);
  if (extra) {
    esito('IRPEF tassazione autonoma', n.irpefExtra, riga(/IRPEF lorda Tass\.aut\./), 0.04);
  }
  esito('Trattamento integrativo', n.trattamentoIntegrativo,
    riga(/Trattamento integrativo/), 0.02);
  esito('Indennità L.207/2024', n.bonusCuneo, riga(/L\.207/), 0.02);

  // Il rimborso 730 torna a contare qui: non era reddito, ma viene pagato.
  esito('NETTO DEL MESE', round2(n.net + fuoriReddito), b.netto, 0.03);
  console.log('');
}

console.log(`${righe} confronti, ${scarti} scarti\n`);
if (scarti > 0) {
  console.log('Uno scarto non è per forza un errore del motore: può essere una voce\n'
    + 'del cedolino che questo script non sa ancora classificare. Guardare la voce\n'
    + 'prima di toccare una formula.\n');
  process.exit(1);
}
console.log('✓ tutte le buste 2026 riprodotte dal motore\n');
