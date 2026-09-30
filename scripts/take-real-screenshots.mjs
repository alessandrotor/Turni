import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('Avvio Chrome headless con porta di debug...');
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\gasri\\AppData\\Local\\Temp\\chrome-turni-ss'
  ]);

  await sleep(1500);

  try {
    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const targets = await listRes.json();
    let pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) {
      const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?http://localhost:5173/`);
      pageTarget = await newRes.json();
    }

    console.log('Target trovato:', pageTarget.webSocketDebuggerUrl);
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((res) => (ws.onopen = res));

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        pending.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    console.log('Navigazione a http://localhost:5173/...');
    await send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(1500);

    // Dati realistici per settembre 2026
    const mockShifts = {
      "s1": { id: "s1", date: "2026-09-01", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "Turno M" },
      "s2": { id: "s2", date: "2026-09-02", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "Turno M" },
      "s3": { id: "s3", date: "2026-09-03", startTime: "14:00", endTime: "21:00", breakMinutes: 0, type: "lavoro", note: "Turno P" },
      "s4": { id: "s4", date: "2026-09-04", startTime: "14:00", endTime: "21:00", breakMinutes: 0, type: "lavoro", note: "Turno P" },
      "s5": { id: "s5", date: "2026-09-05", startTime: "21:00", endTime: "07:00", breakMinutes: 30, type: "lavoro", note: "Turno N" },
      "s7": { id: "s7", date: "2026-09-07", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "" },
      "s8": { id: "s8", date: "2026-09-08", startTime: "14:00", endTime: "21:00", breakMinutes: 0, type: "lavoro", note: "" },
      "s9": { id: "s9", date: "2026-09-09", startTime: "21:00", endTime: "07:00", breakMinutes: 30, type: "lavoro", note: "Notte" },
      "s11": { id: "s11", date: "2026-09-11", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "" },
      "s12": { id: "s12", date: "2026-09-12", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "Sabato" },
      "s13": { id: "s13", date: "2026-09-13", startTime: "14:00", endTime: "21:00", breakMinutes: 0, type: "lavoro", note: "Domenica" },
      "s15": { id: "s15", date: "2026-09-15", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "" },
      "s16": { id: "s16", date: "2026-09-16", startTime: "14:00", endTime: "21:00", breakMinutes: 0, type: "lavoro", note: "" },
      "s17": { id: "s17", date: "2026-09-17", startTime: "21:00", endTime: "07:00", breakMinutes: 30, type: "lavoro", note: "Notte" },
      "s19": { id: "s19", date: "2026-09-19", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "" },
      "s20": { id: "s20", date: "2026-09-20", startTime: "14:00", endTime: "21:00", breakMinutes: 0, type: "lavoro", note: "Domenica" },
      "s21": { id: "s21", date: "2026-09-21", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "Oggi" },
      "s22": { id: "s22", date: "2026-09-22", startTime: "14:00", endTime: "21:00", breakMinutes: 0, type: "lavoro", note: "Pomeriggio" },
      "s23": { id: "s23", date: "2026-09-23", startTime: "21:00", endTime: "07:00", breakMinutes: 30, type: "lavoro", note: "Notte" },
      "s25": { id: "s25", date: "2026-09-25", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "" },
      "s26": { id: "s26", date: "2026-09-26", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "" },
      "s27": { id: "s27", date: "2026-09-27", startTime: "14:00", endTime: "21:00", breakMinutes: 0, type: "lavoro", note: "Domenica" },
      "s29": { id: "s29", date: "2026-09-29", startTime: "07:00", endTime: "14:00", breakMinutes: 0, type: "lavoro", note: "" },
      "s30": { id: "s30", date: "2026-09-30", startTime: "14:00", endTime: "21:00", breakMinutes: 0, type: "lavoro", note: "" },
    };

    const mockSettings = {
      hourlyRate: 11.50,
      expectedWeeklyHours: 36,
      fullTimeWeeklyHours: 36,
      sundaySurchargePct: 30,
      overtimeSurchargePct: 20,
      straordinarioSurchargePct: 30,
      holidaySurchargePct: 50,
      holidaySundayMode: 'max',
      nightSurchargePct: 35,
      nightStart: '22:00',
      nightEnd: '06:00',
      nightCumuloMode: 'somma',
      workingDaysPerWeek: 6,
      ccnl: 'sanita-privata',
      aziendaDipendenti: 'oltre15',
      mostraEuroPerTurno: true,
      tiModo: 'auto',
      tiProjectionMode: 'stimato',
      periodoConteggio: 'calendario'
    };

    console.log('Inietto dati reali in localStorage...');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('turni_shifts', JSON.stringify(${JSON.stringify(mockShifts)}));
        localStorage.setItem('turni_settings', JSON.stringify(${JSON.stringify(mockSettings)}));
        localStorage.setItem('turni_install_prompt_dismissed', '1');
        localStorage.setItem('turni_setup_prompt_dismissed', '1');
        localStorage.setItem('turni_cal_layout', 'grid');
        window.location.reload();
      `
    });

    await sleep(2000);

    // 1. Mobile Grid View
    console.log('Catturo Mobile Grid View...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 412,
      height: 915,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(800);

    const ssMobileGrid = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('docs/mockups/real-app-mobile-grid.png', Buffer.from(ssMobileGrid.data, 'base64'));

    // 2. Mobile Timeline View
    console.log('Passo alla vista Timeline...');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('turni_cal_layout', 'timeline');
        window.location.reload();
      `
    });
    await sleep(1500);

    const ssMobileTimeline = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('docs/mockups/real-app-mobile-timeline.png', Buffer.from(ssMobileTimeline.data, 'base64'));

    // 3. Modale Condividi Settimana
    console.log('Apro il modale Condividi Settimana...');
    await send('Runtime.evaluate', {
      expression: `
        const shareBtn = document.querySelector('.cal-header-share-btn') || document.querySelector('.export-btn');
        if (shareBtn) shareBtn.click();
      `
    });
    await sleep(800);

    const ssShareModal = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('docs/mockups/real-app-share-modal.png', Buffer.from(ssShareModal.data, 'base64'));

    // Chiudi modale
    await send('Runtime.evaluate', {
      expression: `
        const closeBtn = document.querySelector('.share-modal-close');
        if (closeBtn) closeBtn.click();
      `
    });
    await sleep(500);

    // 4. Desktop View
    console.log('Catturo Desktop View...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 2,
      mobile: false
    });
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('turni_cal_layout', 'grid');
        window.location.reload();
      `
    });
    await sleep(1500);

    const ssDesktop = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('docs/mockups/real-app-desktop.png', Buffer.from(ssDesktop.data, 'base64'));

    console.log('Screenshot catturati con successo in docs/mockups/!');
    ws.close();
  } finally {
    chrome.kill();
  }
}

run().catch(err => {
  console.error('Errore:', err);
  process.exit(1);
});
