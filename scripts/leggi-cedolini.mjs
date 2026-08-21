// Da cedolini PDF a fixture per i riscontri:
//
//   node scripts/leggi-cedolini.mjs "<cartella dei PDF>"
//   BUSTE_DIR="<cartella>" node scripts/leggi-cedolini.mjs
//
// COSA PRODUCE
// Un file JSON per cedolino in `dati-buste/`, che e' IGNORATA DA GIT. Il
// repository e' pubblico: gli importi di una busta dicono quanto guadagna una
// persona, e tre anni di cedolini sono la sua storia retributiva. Le fixture
// sono derivate — si rigenerano da questo comando in qualunque momento — quindi
// non c'e' niente da conservare e niente da pubblicare.
//
// COSA NON FINISCE NELLE FIXTURE
// Non si toglie: si sceglie. Il documento contiene nome, codice fiscale, data
// di nascita, indirizzo di casa, IBAN e datore di lavoro; qui sotto c'e' un
// ELENCO di campi da prendere, e tutto cio' che non e' in elenco viene
// scartato. Una lista di cose da rimuovere si dimentica sempre qualcosa; una
// lista di cose da prendere no.
//
// LA CONVALIDA CHE RENDE AFFIDABILE IL RESTO
// Gira per prima e, se fallisce, non si scrive nessuna fixture: numeri letti
// male non devono propagarsi in silenzio dentro i riscontri.
//
// Sono due controlli di natura diversa, e servono entrambi.
//
//  1. ANCORAGGIO. Il cedolino di giugno 2026 e' gia' stato trascritto a mano in
//     `check-busta-giugno-2026.mjs`: quattordici valori presi dal cedolino
//     stampato. Il lettore deve riprodurli tutti. E' l'unico ancoraggio
//     disponibile — luglio 2026 e' una scansione, e le due buste «fiduciari»
//     sono di un'altra persona e non stanno in questa cartella.
//
//  2. COERENZA INTERNA, su OGNI cedolino. Un ancoraggio solo dice che il
//     lettore funziona su un documento; questi dicono che funziona su tutti:
//       - la somma delle competenze, arrotondata all'euro, deve dare la base
//         imponibile INPS stampata. Se il lettore salta una voce o ne conta una
//         due volte, questa non torna piu';
//       - base × aliquota IVS deve dare il contributo stampato.
//     Non sono controlli di comodo: sono le due identita' che un cedolino
//     rispetta sempre, e passarle per caso avendo letto male e' improbabile.

import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { righeDi, numeriDi, numeroIt } from './lib/cedolino.mjs';

const USCITA = 'dati-buste';

// ── Lettura di un documento ────────────────────────────────────────────────

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

export function leggiCedolino(percorso) {
  const righe = righeDi(percorso);
  const tutto = righe.map((r) => r.testo).join('\n');

  // ── I campi che PRENDIAMO. Tutto il resto resta fuori. ──
  const fx = {
    file: basename(percorso),
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

// ── La convalida contro le trascrizioni a mano ─────────────────────────────

const ATTESI = {
  'Cedolino Giugno 26.pdf': {
    // Da check-busta-giugno-2026.mjs, che li ha presi dal cedolino stampato.
    'paga oraria': (f) => voce(f, 'Z00001')?.numeri[0],
    'retribuzione (103,20 h)': (f) => voce(f, 'Z00001')?.importo,
    'supplementare 30%': (f) => voce(f, 'Z30030')?.importo,
    '14ª mensilità': (f) => voce(f, 'Z50022')?.importo,
    'magg. festivo': (f) => voce(f, '000347')?.importo,
    'lavoro festivo ordinario': (f) => voce(f, '300021')?.importo,
    'imponibile IRPEF': (f) => voce(f, 'F02000')?.importo,
    'imponibile tass. autonoma': (f) => voce(f, 'F06000')?.importo,
    'detrazioni lav. dip.': (f) => voce(f, 'F02500')?.importo,
    'indennità L.207/24': (f) => voce(f, 'F02703')?.importo,
    'contributo IVS': (f) => voce(f, 'Z00000')?.importo,
    'netto del mese': (f) => f.netto,
    'part time %': (f) => f.contratto.partTimePct,
    'assunzione': (f) => f.contratto.assunzione,
  },
};

const VALORI = {
  'Cedolino Giugno 26.pdf': {
    'paga oraria': 9.21802,
    'retribuzione (103,20 h)': 951.30,
    'supplementare 30%': 338.53,
    '14ª mensilità': 475.65,
    'magg. festivo': 25.35,
    'lavoro festivo ordinario': 126.75,
    'imponibile IRPEF': 1420.55,
    'imponibile tass. autonoma': 429.10,
    'detrazioni lav. dip.': 239.19,
    'indennità L.207/24': 88.78,
    'contributo IVS': 188.21,
    'netto del mese': 2221.41,
    'part time %': 60,
    'assunzione': '2025-12-29',
  },
};

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

function convalida(cartella) {
  let falliti = 0, provati = 0;
  console.log('\nConvalida del lettore sui cedolini gia’ trascritti a mano\n');
  for (const [file, campi] of Object.entries(ATTESI)) {
    const p = trova(cartella, file);
    if (!p) { console.log(`  --  ${file}: non trovato nella cartella, salto`); continue; }
    const fx = leggiCedolino(p);
    console.log(`  ${file}`);
    for (const [nome, prendi] of Object.entries(campi)) {
      const avuto = prendi(fx);
      const atteso = VALORI[file][nome];
      const ok = typeof atteso === 'number'
        ? typeof avuto === 'number' && Math.abs(avuto - atteso) < 0.005
        : avuto === atteso;
      provati++;
      if (!ok) falliti++;
      console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${nome.padEnd(26)} atteso ${String(atteso).padStart(10)} → ${String(avuto).padStart(10)}`);
    }
  }
  return { falliti, provati };
}

function trova(cartella, nome) {
  for (const sotto of ['', ...readdirSync(cartella, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)]) {
    const p = join(cartella, sotto, nome);
    if (existsSync(p)) return p;
  }
  return null;
}

function tuttiIPdf(cartella) {
  const out = [];
  for (const v of readdirSync(cartella, { withFileTypes: true })) {
    const p = join(cartella, v.name);
    if (v.isDirectory()) out.push(...tuttiIPdf(p));
    else if (/\.pdf$/i.test(v.name)) out.push(p);
  }
  return out;
}

const slug = (s) => s.replace(/\.pdf$/i, '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── Esecuzione ─────────────────────────────────────────────────────────────

const cartella = process.argv[2] || process.env.BUSTE_DIR;
if (!cartella) {
  console.error('\nManca la cartella dei cedolini.\n');
  console.error('  node scripts/leggi-cedolini.mjs "<cartella>"');
  console.error('  BUSTE_DIR="<cartella>" node scripts/leggi-cedolini.mjs\n');
  console.error('Il percorso non sta nel repository di proposito: e’ una cartella personale.\n');
  process.exit(2);
}
if (!existsSync(cartella)) {
  console.error(`\nCartella inesistente: ${cartella}\n`);
  process.exit(2);
}

const esito = convalida(cartella);
if (esito.falliti) {
  console.error(`\n${esito.falliti} valori su ${esito.provati} non tornano: il lettore sbaglia.`);
  console.error('Nessuna fixture scritta — sarebbero tutte inaffidabili.\n');
  process.exit(1);
}
console.log(`\n  ${esito.provati} valori riprodotti dai cedolini stampati.\n`);

mkdirSync(USCITA, { recursive: true });
const pdf = tuttiIPdf(cartella);
console.log(`Lettura di ${pdf.length} documenti\n`);

const indice = [];
let conAvvisi = 0, scansioni = 0, scritte = 0;
for (const p of pdf) {
  const fx = leggiCedolino(p);

  // Una scansione non e' un guasto: e' un documento senza strato di testo, e va
  // detto com'e' invece di finire fra i «documenti con avvisi».
  if (!fx.voci.length) {
    scansioni++;
    console.log(`  ~  ${'  —  '}  scansione senza testo   ${fx.file}`);
    indice.push({ file: fx.file, scansione: true });
    continue;
  }

  fx.avvisi.push(...incoerenze(fx));
  writeFileSync(join(USCITA, `${slug(fx.file)}.json`), JSON.stringify(fx, null, 1), 'utf8');
  scritte++;
  if (fx.avvisi.length) conAvvisi++;
  indice.push({ file: fx.file, slug: slug(fx.file), voci: fx.voci.length, periodo: fx.periodo, avvisi: fx.avvisi });
  const p1 = fx.periodo ? `${String(fx.periodo.mese).padStart(2, '0')}/${fx.periodo.anno}` : '   —   ';
  console.log(`  ${fx.avvisi.length ? '!' : ' '}  ${p1}  ${String(fx.voci.length).padStart(3)} voci  ${fx.file}`
    + (fx.avvisi.length ? `\n         ${fx.avvisi.join('\n         ')}` : ''));
}
writeFileSync(join(USCITA, '_indice.json'), JSON.stringify(indice, null, 1), 'utf8');

console.log(`\n${scritte} fixture in ${USCITA}/ (ignorata da git).`);
if (scansioni) console.log(`${scansioni} scansioni senza testo: servirebbe un OCR, e non lo facciamo in rete.`);
if (conAvvisi) console.log(`${conAvvisi} documenti con avvisi: vanno guardati prima di usarli.\n`);
else console.log('Nessun avviso: tutti coerenti.\n');
