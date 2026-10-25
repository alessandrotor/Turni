// Dalle righe di un cedolino ai soli campi che servono. Condiviso fra
// `scripts/leggi-cedolini.mjs` e la pagina «Confronta con la busta»; qui non si
// legge nessun file, si ricevono le righe già ricostruite da `cedolino.js`.
//
// Privacy: c'è un ELENCO di campi da prendere e tutto il resto è scartato (una lista
// da togliere si dimentica sempre qualcosa). Nemmeno il nome del file entra.

import { numeriDi, numeroIt } from './cedolino.js';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// Si legge per COLONNE, non per riga di testo: la griglia delle presenze (cedolini
// 2024–2025) sta a sinistra alla stessa altezza delle voci, e unendo la riga i due
// blocchi si mescolano. I campi numerici di una voce stanno tutti oltre x=250.
const X_CODICE = [30, 55];
const X_VALORI = 250;

// LE TRE COLONNE DEGLI IMPORTI dicono che cos'è una voce, non la posizione verticale
// (ci sono trattenute stampate in mezzo alle competenze):
//   x ≈ 285  informativa — imponibili, IRPEF lorda, detrazioni
//   x ≈ 470  trattenuta  — contributi, ritenute, addizionali, arrotondamento
//   x ≈ 545  competenza  — retribuzione, maggiorazioni, trattamento integrativo e
//            indennità L.207/24, che si RICEVONO
// Conta la posizione dell'ULTIMO numero della riga.
const X_TRATTENUTA = 400;
const X_COMPETENZA = 520;

const sezioneDa = (x) => (x >= X_COMPETENZA ? 'competenza' : (x >= X_TRATTENUTA ? 'trattenuta' : 'informativa'));

const numeroDiPezzo = (t) => numeroIt(t.replace(/\s/g, ''));

/** Una riga di voce: codice, etichetta, numeri. `codice` puo' mancare. */
function voceDa(riga) {
  const valori = riga.pezzi.filter((p) => p.x >= X_VALORI);
  const numeri = valori.map((p) => numeroDiPezzo(p.t)).filter((n) => n !== null);
  if (!numeri.length) return null;

  const cod = riga.pezzi.find((p) => p.x >= X_CODICE[0] && p.x < X_CODICE[1] && /^[A-Z0-9]{6}$/.test(p.t.trim()));
  const etichetta = riga.pezzi
    .filter((p) => p.x >= X_CODICE[1] && p.x < X_VALORI)
    .map((p) => p.t.trim())
    // Nella fascia dell'etichetta cade anche la griglia: ore del giorno e marcatore «SU».
    .filter((t) => t && numeroDiPezzo(t) === null && !/^(SU|DO|LU|MA|ME|GI|VE|SA|R|P)$/.test(t))
    .join(' ').replace(/\s+/g, ' ').trim();

  if (!etichetta) return null;
  const ultimo = valori.filter((p) => numeroDiPezzo(p.t) !== null).pop();

  // Due eccezioni alla colonna, dichiarate nell'etichetta: «C/Ditta» (quota a carico
  // del datore) e i benefit in natura (ticket, buoni acquisto): non entrano nel netto.
  // Si guarda la RIGA INTERA, perché «C/Ditta» è stampato nella fascia dei valori.
  const sezione = /C\/Ditta/i.test(riga.testo) ? 'informativa'
    : (/\b(Ticket|Buoni Acquisto)\b/i.test(etichetta) ? 'benefit' : sezioneDa(ultimo.x));

  return {
    codice: cod ? cod.t.trim() : null,
    etichetta,
    numeri,
    importo: numeri[numeri.length - 1],
    sezione,
    unita: valori.some((p) => /^ORE$/.test(p.t.trim())) ? 'ORE'
      : (valori.some((p) => /^GG$/.test(p.t.trim())) ? 'GG' : null),
  };
}

/**
 * La griglia delle presenze, quando c'è: un giorno per riga, con le ore lavorate e le
 * eventuali supplementari. Solo i cedolini 2024–2025 la stampano. «5,30» sono 5 ore
 * e 30 MINUTI (notazione «hm»), non un decimale.
 */
const daHm = (s) => {
  const [h, mm] = s.split(',');
  return Number(h) + Number(mm || 0) / 60;
};
const ORE_HM = /^\d{1,2},\d{2}$/;

// Colonne della griglia: giorno, numero, ore, poi «SU» e le supplementari. Si leggono
// per posizione per non raccogliere numeri di altre colonne alla stessa altezza.
const X_GRIGLIA_ORE = [60, 90];

function grigliaDa(righe) {
  const giorni = [];
  for (const r of righe) {
    const sx = r.pezzi.filter((p) => p.x < X_VALORI).map((p) => ({ x: p.x, t: p.t.trim() }));
    const gs = sx.find((p) => /^(LU|MA|ME|GI|VE|SA|DO)$/.test(p.t));
    if (!gs) continue;
    const giorno = sx.filter((p) => p.x > gs.x && p.x < X_GRIGLIA_ORE[0])
      .map((p) => numeroDiPezzo(p.t)).find((n) => n !== null && Number.isInteger(n) && n >= 1 && n <= 31);
    if (giorno == null) continue;
    const ore = sx.find((p) => p.x >= X_GRIGLIA_ORE[0] && p.x <= X_GRIGLIA_ORE[1] && ORE_HM.test(p.t));
    const su = sx.find((p) => p.t === 'SU');
    const supp = su ? sx.find((p) => p.x > su.x && ORE_HM.test(p.t)) : null;
    giorni.push({
      gs: gs.t,
      giorno,
      ore: ore ? daHm(ore.t) : 0,
      supplementari: supp ? daHm(supp.t) : 0,
    });
  }
  return giorni;
}

/**
 * Il cedolino stampa i totali del mese («Ore ordinarie 122,00hm…»). La griglia si
 * tiene SOLO se li riproduce: dati giornalieri sbagliati sono peggio che assenti.
 */
function grigliaAttendibile(righe, griglia) {
  const r = righe.find((x) => /Ore ordinarie/i.test(x.testo));
  if (!r) return { ok: false, perche: 'totale ore non stampato' };
  const n = (r.testo.match(/\d{1,3},\d{2}(?=hm)/g) || []).map(daHm);
  if (n.length < 2) return { ok: false, perche: 'totale ore illeggibile' };
  const [ord, sup] = n;
  const so = griglia.reduce((a, g) => a + g.ore, 0);
  const ss = griglia.reduce((a, g) => a + g.supplementari, 0);

  // Le ORDINARIE tornano su ogni cedolino: quella colonna e' letta bene.
  if (Math.abs(so - ord) > 0.02) {
    return { ok: false, perche: `ore ordinarie ${so.toFixed(2)} vs stampato ${ord.toFixed(2)}` };
  }
  // Le SUPPLEMENTARI no: il marcatore «SU» non sta sempre nella stessa colonna. Si
  // tiene la griglia ma si azzerano e si dichiarano inattendibili.
  const suOk = Math.abs(ss - sup) <= 0.02;
  return { ok: true, ordinarie: ord, supplementari: sup, suOk };
}

export function leggiCedolinoDaRighe(righe) {
  const tutto = righe.map((r) => r.testo).join('\n');

  // ── I campi che PRENDIAMO. Tutto il resto resta fuori. ──
  const fx = {
    periodo: null,
    contratto: {},
    voci: [],
    progressivi: {},
    netto: null,
    avvisi: [],
  };

  // Periodo: «Giugno 2026», «13ma Mensilita ... 2025», ecc.
  const mp = new RegExp(`\\b(${MESI.join('|')})\\s+(20\\d\\d)\\b`, 'i').exec(tutto);
  if (mp) fx.periodo = { mese: MESI.indexOf(mp[1].toLowerCase()) + 1, anno: Number(mp[2]) };

  // Livello e percentuale di part time.
  const lv = /\bLivello\s+(\S+)/i.exec(tutto);
  if (lv) fx.contratto.livello = lv[1];
  const pt = /Part\s*Time\s+([\d.,]+)/i.exec(tutto);
  if (pt) fx.contratto.partTimePct = parseFloat(pt[1].replace(',', '.'));

  // Assunzione: sulla riga del livello ci sono DUE date, nascita (dato personale, non
  // la prendiamo) e assunzione. Si accetta solo se sono esattamente due.
  for (const r of righe) {
    const date = r.testo.match(/\b(\d{2})-(\d{2})-(\d{4})\b/g) || [];
    if (date.length === 2 && !fx.contratto.assunzione) {
      const [g, m, a] = date[1].split('-');
      fx.contratto.assunzione = `${a}-${m}-${g}`;
    }
  }

  // Paga base, contingenza, terzo elemento: nella riga SOTTO l'intestazione. Si legge
  // quante colonne dichiara l'intestazione (due datori, due formati).
  const iPaga = righe.findIndex((r) => /PAGA BASE/i.test(r.testo));
  if (iPaga >= 0 && righe[iPaga + 1]) {
    const conContingenza = /CONTING/i.test(righe[iPaga].testo);
    const n = numeriDi(righe[iPaga + 1].testo);
    if (n.length >= (conContingenza ? 3 : 2)) {
      fx.contratto.pagaBase = n[0];
      if (conContingenza) { fx.contratto.contingenza = n[1]; fx.contratto.terzoElemento = n[2]; }
      else fx.contratto.terzoElemento = n[1];
    }
  }

  // Le voci: ogni riga con un numero, dalla prima voce di competenza in giù (dopo
  // l'intestazione, per non raccogliere matricole). La SEZIONE si deduce dalla
  // posizione, non dal codice: il confine è la riga del contributo IVS, poi il primo
  // codice fiscale «F…». La prima voce vera ha un codice di sei caratteri E valori
  // nella colonna di destra.
  const iInizio = righe.findIndex((r) => voceDa(r)
    && r.pezzi.some((p) => p.x >= X_CODICE[0] && p.x < X_CODICE[1] && /^[A-Z0-9]{6}$/.test(p.t.trim())));
  if (iInizio >= 0) {
    for (const r of righe.slice(iInizio)) {
      const v = voceDa(r);
      if (v) fx.voci.push(v);
    }
  }

  // La griglia delle presenze, solo se i suoi totali coincidono con quelli stampati.
  const griglia = grigliaDa(righe);
  if (griglia.length) {
    const g = grigliaAttendibile(righe, griglia);
    if (!g.ok) fx.avvisi.push(`presenze scartate: ${g.perche}`);
    else {
      if (!g.suOk) for (const d of griglia) d.supplementari = null;
      fx.presenze = {
        giorni: griglia,
        ordinarie: g.ordinarie,
        supplementari: g.suOk ? g.supplementari : null,
        supplementariAttendibili: g.suOk,
      };
    }
  }

  // Progressivi dell'anno: la riga di numeri sotto l'intestazione.
  const iProg = righe.findIndex((r) => /Imp\.\s*INPS.*Imp\.\s*INAIL/i.test(r.testo));
  if (iProg >= 0 && righe[iProg + 1]) {
    const n = numeriDi(righe[iProg + 1].testo);
    if (n.length >= 4) {
      fx.progressivi = { impInps: n[0], impInail: n[1], impIrpef: n[2], irpefPagata: n[3] };
    }
  }

  // Il netto non ha etichetta: è la riga isolata più in basso con un solo numero.
  const soli = righe.filter((r) => /^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(r.testo.trim()));
  if (soli.length) fx.netto = numeriDi(soli[soli.length - 1].testo)[0];
  else fx.avvisi.push('netto non trovato');

  if (!fx.voci.length) fx.avvisi.push('nessuna voce riconosciuta');
  if (!fx.periodo) fx.avvisi.push('periodo non riconosciuto');
  return fx;
}

// ── Piccoli aiuti che servono anche ai riscontri ───────────────────────────

export const voce = (fx, codice) => fx.voci.find((v) => v.codice === codice) || null;
export const vociCome = (fx, re) => fx.voci.filter((v) => re.test(v.etichetta || ''));
export const somma = (vs) => Math.round(vs.reduce((s, v) => s + (v?.importo || 0), 0) * 100) / 100;

/**
 * Le due identità che ogni cedolino rispetta. Restituisce le violazioni. La prima è
 * un controllo di COMPLETEZZA: se il lettore salta una competenza o ne conta una due
 * volte, la somma non dà più la base imponibile stampata. L'imponibile INPS è
 * arrotondato all'EURO.
 */
export const totaleCompetenze = (fx) => somma(fx.voci.filter((v) => v.sezione === 'competenza'));
export const totaleTrattenute = (fx) => somma(fx.voci.filter((v) => v.sezione === 'trattenuta'));

export function incoerenze(fx) {
  const problemi = [];

  // L'identità del cedolino: competenze meno trattenute fa il netto, pagato all'EURO
  // TONDO (il resto torna il mese dopo come «Arrotond. mese pr.»). Una voce saltata o
  // contata due volte rompe l'uguaglianza.
  const netto = totaleCompetenze(fx) - totaleTrattenute(fx);
  if (fx.netto == null) problemi.push('netto non trovato');
  else if (Math.abs(netto - fx.netto) > 1.01) {
    problemi.push(`competenze − trattenute = ${netto.toFixed(2)}, netto stampato ${fx.netto.toFixed(2)}`);
  }

  // Aritmetica pura su una riga sola: base × aliquota.
  const ivs = vociCome(fx, /Contributo IVS/i)[0];
  if (ivs && ivs.numeri.length >= 3) {
    const [base, aliquota, trattenuto] = ivs.numeri;
    const atteso = Math.round(base * aliquota) / 100;
    if (Math.abs(atteso - trattenuto) > 0.02) {
      problemi.push(`IVS: ${base} × ${aliquota}% = ${atteso.toFixed(2)}, stampato ${trattenuto}`);
    }
  }
  return problemi;
}

// ── Il lordo del mese, come lo ricostruisce il motore ──
//
// Non è la somma delle competenze: + competenze − trattenute di STORNO («Assenza per
// malattia»), ESCLUSE le competenze ESENTI (trattamento integrativo, L. 207/2024), i
// rimborsi da 730 e i buoni acquisto. Le etichette arrivano da un font CID che perde
// gli accenti: si riconoscono per sottostringa. Vedi `check-buste-2026.mjs`.
export const ESENTE = /Trattamento integrativo|L\.207/i;
export const FUORI_REDDITO = /Rimborsi da 730|Buoni Acquisto|art\. ?51/i;
export const STORNO = /Assenza per (malattia|infortunio)/i;
export const EXTRA_MENSILITA = /1[34](ma|ª) ?Mensilit/i;

const sezioneDi = (fx, s) => fx.voci.filter((v) => v.sezione === s);
export const sommaSe = (voci, re) => voci.filter((v) => re.test(v.etichetta || ''))
  .reduce((s, v) => s + (v.importo || 0), 0);

/** Lordo imponibile del mese, mensilità aggiuntiva e voci che non sono reddito. */
export function lordoDaBusta(fx) {
  const competenze = sezioneDi(fx, 'competenza');
  const esenti = sommaSe(competenze, ESENTE);
  const fuoriReddito = sommaSe(competenze, FUORI_REDDITO);
  const storni = sommaSe(sezioneDi(fx, 'trattenuta'), STORNO);
  const lordo = Math.round(
    (competenze.reduce((s, v) => s + (v.importo || 0), 0) - esenti - fuoriReddito - storni) * 100,
  ) / 100;
  return { lordo, extra: sommaSe(competenze, EXTRA_MENSILITA), esenti, fuoriReddito, storni };
}
