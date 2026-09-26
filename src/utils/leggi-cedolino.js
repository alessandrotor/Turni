// Dalle righe di un cedolino ai soli campi che servono.
//
// Condiviso fra `scripts/leggi-cedolini.mjs` (fixture per i riscontri) e la
// pagina «Confronta con la busta» dell'app. Qui non si legge nessun file: si
// ricevono le righe già ricostruite da `cedolino.js`.
//
// COSA NON SI PRENDE
// Non si toglie: si sceglie. Il documento contiene nome, codice fiscale, data
// di nascita, indirizzo di casa, IBAN e datore di lavoro; qui sotto c'e' un
// ELENCO di campi da prendere, e tutto cio' che non e' in elenco viene
// scartato. Una lista di cose da rimuovere si dimentica sempre qualcosa; una
// lista di cose da prendere no. Nemmeno il nome del file entra: sui PDF veri
// contiene spesso nome e codice fiscale, e lo aggiunge solo lo script Node.

import { numeriDi, numeroIt } from './cedolino.js';

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// SI LEGGE PER COLONNE, NON PER RIGA DI TESTO.
//
// Sui cedolini del datore 2024–2025 la GRIGLIA DELLE PRESENZE — giorno per
// giorno, con le ore — e' stampata nella colonna di sinistra, alla stessa
// altezza delle voci di paga. Unendo la riga in una stringa sola i due blocchi
// si mescolano, e «Contributo IVS» finisce per avere quattro numeri invece di
// tre: il primo sono le ore di quel giorno. E' cosi' che il primo tentativo
// leggeva «3 × 1118% = 33,54».
//
// I campi numerici di una voce stanno tutti oltre x=250; la griglia sta sotto.
// Le coordinate sono identiche sui cedolini di ENTRAMBI i datori — e' lo stesso
// software di paghe — quindi la soglia non e' tarata su un caso solo.
const X_CODICE = [30, 55];
const X_VALORI = 250;

// LE TRE COLONNE DEGLI IMPORTI, ed e' la colonna a dire che cos'e' una voce —
// non la sua posizione verticale. Ci sono voci di TRATTENUTA stampate in mezzo
// alle competenze: «Ore non in forza» e «Assenza Assunti/Dimessi» tolgono
// quello che non e' stato lavorato, e leggerle come competenze faceva sballare
// la base imponibile di ottocento euro.
//
//   x ≈ 285  informativa — imponibili, IRPEF lorda, detrazioni: non sono soldi
//            che si muovono, sono numeri di appoggio
//   x ≈ 470  trattenuta  — contributi, ritenute, addizionali, arrotondamento
//   x ≈ 545  competenza  — retribuzione, maggiorazioni, e anche trattamento
//            integrativo e indennita' L.207/24, che si RICEVONO
//
// Conta la posizione dell'ULTIMO numero della riga: gli altri sono base,
// aliquota e quantita', e cadono dove capita.
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
    // Nella fascia dell'etichetta cade anche la griglia: ore del giorno e il
    // marcatore «SU» del supplementare. Sono numeri o sigle di due lettere.
    .filter((t) => t && numeroDiPezzo(t) === null && !/^(SU|DO|LU|MA|ME|GI|VE|SA|R|P)$/.test(t))
    .join(' ').replace(/\s+/g, ' ').trim();

  if (!etichetta) return null;
  const ultimo = valori.filter((p) => numeroDiPezzo(p.t) !== null).pop();

  // Due eccezioni alla colonna, e nessuna delle due e' un'ipotesi: il cedolino
  // le dichiara nell'etichetta.
  //  - «C/Ditta» e' la quota a carico del DATORE. Sta fra le competenze ma non
  //    la riceve il lavoratore: e' li' per trasparenza.
  //  - i benefit in natura (ticket, buoni acquisto ex art. 51 TUIR) sono
  //    competenze che non arrivano in contanti, quindi non entrano nel netto.
  // Si guarda la RIGA INTERA e non l'etichetta ripulita: «C/Ditta» e' stampato
  // nella fascia dei valori, quindi dall'etichetta e' gia' sparito.
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
 * La griglia delle presenze, quando c'e': un giorno per riga, con le ore
 * lavorate e le eventuali supplementari. Solo i cedolini del datore 2024–2025
 * la stampano, ed e' la cosa piu' preziosa del documento — sono le ore VERE,
 * giorno per giorno, contro cui si puo' riscontrare il motore dei turni e non
 * soltanto quello del netto.
 */
// «5,30» nella griglia vale 5 ore e 30 MINUTI, non 5,30 decimale: e' la
// notazione «hm» che il cedolino dichiara in fondo («122,00hm»). Leggerla come
// decimale sbaglia di poco su un giorno e di parecchio su un mese.
const daHm = (s) => {
  const [h, mm] = s.split(',');
  return Number(h) + Number(mm || 0) / 60;
};
const ORE_HM = /^\d{1,2},\d{2}$/;

// Le colonne della griglia: giorno della settimana, numero, ore, poi «SU» e le
// supplementari. Le ore stanno in una fascia stretta, e leggerle per posizione
// evita di raccogliere numeri di altre colonne che capitano alla stessa altezza.
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
 * Il cedolino stampa i totali del mese: «Ore ordinarie 122,00hm SU Ore
 * supplementare 16,00hm». La griglia si tiene SOLO se li riproduce — dati
 * giornalieri sbagliati sarebbero peggio che assenti, perche' un riscontro
 * futuro si fiderebbe.
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
  // Le SUPPLEMENTARI no: il marcatore «SU» non sta sempre nella stessa colonna,
  // e su otto cedolini il totale non torna. Si tiene comunque la griglia — le
  // ore ordinarie giorno per giorno valgono da sole — ma le supplementari
  // vengono azzerate e dichiarate inattendibili, cosi' nessun riscontro
  // costruito dopo puo' fidarsene per sbaglio.
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

  // Assunzione: sulla riga del livello o subito sotto ci sono DUE date, la
  // prima e' la nascita (dato personale, non la prendiamo) e la seconda
  // l'assunzione. Si accetta solo se le date sono esattamente due: se il
  // formato cambia, meglio nessun valore che uno sbagliato.
  for (const r of righe) {
    const date = r.testo.match(/\b(\d{2})-(\d{2})-(\d{4})\b/g) || [];
    if (date.length === 2 && !fx.contratto.assunzione) {
      const [g, m, a] = date[1].split('-');
      fx.contratto.assunzione = `${a}-${m}-${g}`;
    }
  }

  // Paga base, contingenza, terzo elemento: stanno nella riga SOTTO
  // l'intestazione «PAGA BASE CONTING. 3ELEMEN.».
  // I due datori hanno intestazioni diverse: «PAGA BASE CONTING. 3ELEMEN.» e
  // «PAGA BASE 3ELEM.». Si legge quante colonne dichiara l'intestazione invece
  // di dare per scontato che siano tre.
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

  // Le voci: ogni riga con un numero, dalla prima voce di competenza in giu'.
  // Si parte dopo l'intestazione contrattuale per non raccogliere matricole e
  // numeri di autorizzazione.
  //
  // La SEZIONE si deduce dalla posizione, non dal codice: `Z00001` e'
  // retribuzione e `Z00000` e' contributo IVS, quindi il prefisso non separa
  // niente. Il confine e' la riga del contributo IVS — sopra si guadagna,
  // sotto si trattiene — e poi il primo codice fiscale «F…».
  // La prima voce vera: ha un codice di sei caratteri E dei valori nella
  // colonna di destra. Senza la seconda condizione si prenderebbe
  // l'intestazione — «000124 FB RETAIL SRL» ha un codice ma nessun importo.
  const iInizio = righe.findIndex((r) => voceDa(r)
    && r.pezzi.some((p) => p.x >= X_CODICE[0] && p.x < X_CODICE[1] && /^[A-Z0-9]{6}$/.test(p.t.trim())));
  if (iInizio >= 0) {
    for (const r of righe.slice(iInizio)) {
      const v = voceDa(r);
      if (v) fx.voci.push(v);
    }
  }

  // La griglia delle presenze, dove il cedolino la stampa — e solo se i suoi
  // totali coincidono con quelli stampati.
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

  // Il netto non ha etichetta: e' la riga isolata piu' in basso composta da un
  // solo numero. Regola fragile di per se', ma la convalida sui due cedolini
  // gia' trascritti la mette alla prova a ogni esecuzione.
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
 * Le due identita' che ogni cedolino rispetta. Restituisce le violazioni.
 *
 * La prima e' la piu' utile: se il lettore salta una competenza o ne conta una
 * due volte, la somma non da' piu' la base imponibile stampata. E' un controllo
 * di COMPLETEZZA, che nessun confronto su singoli valori puo' dare.
 *
 * L'imponibile INPS e' arrotondato all'EURO, non ai centesimi: e' la regola
 * gia' riscontrata su tre buste diverse e annotata in check-busta-giugno-2026.
 */
export const totaleCompetenze = (fx) => somma(fx.voci.filter((v) => v.sezione === 'competenza'));
export const totaleTrattenute = (fx) => somma(fx.voci.filter((v) => v.sezione === 'trattenuta'));

export function incoerenze(fx) {
  const problemi = [];

  // L'IDENTITA' DEL CEDOLINO: competenze meno trattenute fa il netto, che
  // questi datori pagano all'EURO TONDO — il resto torna il mese dopo come
  // «Arrotond. mese pr.». Verificata su marzo 2025: 1.273,81 − 239,02 =
  // 1.034,79, e in fondo al cedolino c'e' scritto 1.035,00.
  //
  // E' il controllo di COMPLETEZZA che serviva: una voce saltata o contata due
  // volte rompe l'uguaglianza. Non richiede di sapere che cosa significhi
  // nessun codice — solo in quale colonna e' stampato.
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

// ── Il lordo del mese, come lo ricostruisce il motore ──────────────────────
//
// Non è la somma delle competenze, e sbagliarlo è l'errore che fa saltare tutto
// (il ragionamento per esteso sta in `check-buste-2026.mjs`):
//   + competenze − trattenute di STORNO («Assenza per malattia»)
//   ESCLUSE le competenze ESENTI (trattamento integrativo, L. 207/2024)
//   ESCLUSI i rimborsi da 730 e i buoni acquisto art. 51
// Le etichette arrivano da un font CID che perde gli accenti («Indennit
// L.207/24»): si riconoscono per sottostringa.
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
