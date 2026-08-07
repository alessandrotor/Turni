# Pubblicare Turni su Google Play (beta chiusa)

Promemoria operativo. La parte lenta non è il codice: sono gli adempimenti.

## Tempi

| Fase | Durata |
|---|---|
| Account Play Console (25 $) + verifica identità | da 1 a diversi giorni |
| Scheda: privacy policy, Data Safety, grafiche | mezza giornata |
| Revisione del primo upload su traccia chiusa | da poche ore a ~3 giorni |
| **Test chiuso: ≥12 tester per 14 giorni consecutivi** | **14 giorni, non comprimibili** |
| Richiesta accesso alla produzione + revisione | fino a ~7 giorni |

**Beta utilizzabile dai tester: circa una settimana.**
**Produzione: quattro settimane come pavimento**, per la regola dei 12 tester che
si applica agli account personali nuovi.

Restare in beta a tempo indeterminato è lecito: la traccia di test chiuso non
scade. Se la produzione non serve, il pavimento delle 4 settimane sparisce.

> ⚠️ Le regole di Play cambiano spesso. Verifica in Console i requisiti correnti
> per l'accesso alla produzione prima di fissare aspettative su queste date.

## Prima di ogni upload

```bash
# 1. Il proxy deve essere in rete e il suo URL nel .env.local
cd worker && npx wrangler deploy && cd ..

# 2. Build + controlli
npm run build
grep -rl "AIza" dist/ && echo "FERMATI: c'è una chiave nel bundle" || echo "bundle pulito"
node scripts/check-busta-giugno-2026.mjs

# 3. AAB firmato
npm run android:release
# → android/app/build/outputs/bundle/release/app-release.aab
```

Controlli da fare a mano sul telefono (traccia **interna**, disponibile in
minuti e senza revisione completa) prima di promuovere alla traccia chiusa:

- [ ] import da immagine funzionante (parla col proxy, non con Gemini)
- [ ] **nessun riquadro giallo "DEBUG token"** dopo l'import
- [ ] export Excel e PDF: producono un file e aprono la condivisione
- [ ] netto del mese coerente con `scripts/check-busta-giugno-2026.mjs`
- [ ] interruttore statistiche in Impostazioni → Import turni da foto

## Impostazioni una tantum

**Keystore di upload** — si crea una volta e non si perde:

```bash
keytool -genkey -v -keystore turni-upload.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias turni
cp android/keystore.properties.esempio android/keystore.properties   # poi compila
```

Il `.jks` e `keystore.properties` sono gitignorati. Tieni una copia **fuori da
questo computer**: senza, non puoi più aggiornare l'app (si può chiedere il reset
a Google, ma sono giorni persi).

**Play App Signing**: lascialo attivo. Google custodisce la chiave di
distribuzione; tu firmi solo l'upload.

## Scheda dello Store

- Informativa privacy pubblicata a un URL raggiungibile — c'è già pronta in
  `docs/privacy.md`, basta attivare GitHub Pages sul repository.
- Modulo **Data Safety** coerente con quel testo. In sintesi da dichiarare:
  - *Foto e video* → raccolte, **non** conservate, per funzionalità dell'app;
  - *ID dispositivo o altri ID* → identificativo casuale di installazione, per
    analisi, **facoltativo** (c'è l'interruttore);
  - nessun dato personale, nessuna condivisione con terzi a fini pubblicitari;
  - dati in transito cifrati (HTTPS): sì.
- Icona 512×512, immagine in evidenza 1024×500, almeno 2 screenshot telefono.
- Questionario classificazione contenuti e pubblico di destinazione.
- Descrizione breve e lunga.

## Traccia di test chiuso

Servono **almeno 12 account Google reali** iscritti per 14 giorni **consecutivi**:
se il numero scende sotto 12, il conteggio riparte da capo. Conviene invitarne
qualcuno in più e verificare che accettino davvero l'invito — un invito non
accettato non conta.

Il test **interno** non conta ai fini dei 14 giorni: serve solo a collaudare.

## Da fare dopo la prima pubblicazione

- Regole `-keep` per i plugin Capacitor in `android/app/proguard-rules.pro`, poi
  riattivare `minifyEnabled` (oggi è spento di proposito, vedi il commento in
  `android/app/build.gradle`).
- Legare il proxy a **Play Integrity**: oggi l'URL è ricavabile decompilando
  l'APK e la difesa è il solo rate limiting.
