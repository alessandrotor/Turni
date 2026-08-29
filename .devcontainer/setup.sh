#!/usr/bin/env bash
# Preparazione del Codespace. Gira UNA volta, alla creazione del container
# (postCreateCommand). Deve poter girare due volte senza fare danni: chi
# ricostruisce il container non deve ritrovarsi un ambiente diverso.
set -uo pipefail

cd "$(dirname "$0")/.."

# NIENTE `set -e` in questo script, ed è una scelta.
#
# Con l'uscita al primo errore, un `npm ci` che fallisce — una dipendenza
# irraggiungibile, un registry lento — si porta dietro tutto il resto: il
# Codespace si apre senza la CLI, e `claude` risponde «command not found»
# lasciando credere che manchi l'installazione invece di un passo precedente.
# Ogni passo qui è indipendente dagli altri: quello che fallisce lo dice e non
# blocca i successivi, e alla fine si stampa il riepilogo di cosa manca.
problemi=()
passo() {
  local nome="$1"; shift
  echo "▸ ${nome}"
  if ! "$@"; then
    echo "  ✗ ${nome}: fallito"
    problemi+=("${nome}")
  fi
}

# PRIMA la CLI, poi il resto: è la ragione per cui questo Codespace esiste, e
# deve esserci anche se una dipendenza del progetto non si scarica.
passo "Claude Code CLI" npm install -g @anthropic-ai/claude-code

passo "Dipendenze dell'app" npm ci

# Il worker ha un package.json suo: senza queste, `wrangler dev` non parte e
# l'import da immagine non si può provare in locale.
if [ -f worker/package.json ]; then
  passo "Dipendenze del proxy AI (worker/)" bash -c 'cd worker && npm ci'
fi

# ── .env.local ──────────────────────────────────────────────────────────────
# Vite legge i valori da `.env.local`, che è gitignorato e quindi NON arriva
# con il clone. Lo si ricostruisce dai Codespaces secrets, quando ci sono.
#
# Non si sovrascrive un file già presente: dopo un rebuild del container chi
# aveva scritto valori a mano se li ritrova.
if [ ! -f .env.local ]; then
  echo "▸ Creo .env.local dai secrets del Codespace"
  cat > .env.local <<EOF
# Generato da .devcontainer/setup.sh alla creazione del Codespace.
# Valori presi dai Codespaces secrets; vuoti se non impostati.
# Documentazione dei campi: .env.esempio
VITE_AI_PROXY_URL=${VITE_AI_PROXY_URL:-}
VITE_TELEMETRY_URL=${VITE_TELEMETRY_URL:-}
VITE_TURNSTILE_SITEKEY=${VITE_TURNSTILE_SITEKEY:-}
VITE_DEBUG=
VITE_BETA_NET=
EOF
else
  echo "▸ .env.local già presente: lasciato com'è"
fi

# ── La CLI risponde davvero? ────────────────────────────────────────────────
# Installata non basta: se il bin globale di npm non è nel PATH, `claude` dà
# «command not found» e sembra che l'installazione non sia mai avvenuta. Meglio
# dirlo qui, con il rimedio accanto, che lasciarlo scoprire al primo comando.
if ! command -v claude >/dev/null 2>&1; then
  bin_globale="$(npm prefix -g 2>/dev/null)/bin"
  echo "  ✗ 'claude' non è nel PATH. Il bin globale di npm è: ${bin_globale}"
  echo "    Rimedio:  export PATH=\"${bin_globale}:\$PATH\""
  problemi+=("Claude Code CLI non raggiungibile nel PATH")
fi

# ── Promemoria, non automatismi ─────────────────────────────────────────────
if [ ${#problemi[@]} -gt 0 ]; then
  echo
  echo "⚠ Passi non riusciti — l'ambiente parte lo stesso, ma questi vanno rifatti a mano:"
  for p in "${problemi[@]}"; do echo "   · ${p}"; done
fi

cat <<'FINE'

─────────────────────────────────────────────────────────────────────
 Codespace pronto.

   npm run dev            app su :5173 (la porta si apre da sola)
   cd worker && npm run dev   proxy AI su :8787
   claude                 la CLI — al primo avvio chiede il login

 DA SAPERE
 · Un push su `experimental` fa partire il deploy TEST su Cloudflare
   Pages (.github/workflows/deploy-test.yml). La produzione resta manuale.
 · I dati dell'app vivono nel localStorage del BROWSER: un Codespace
   nuovo parte senza turni. Per portarseli: Impostazioni → backup JSON.
 · `dati-buste/` e `tests/` sono gitignorati (contengono cedolini
   personali) e quindi qui non ci sono. I riscontri che dipendono da
   quelle fixture si saltano da soli dicendolo, con uscita zero
   (check-busta-maggiorazioni-reali, check-busta-mensilita-aggiuntive):
   tutti gli altri girano, numeri delle buste inclusi — quelli sono
   scritti dentro gli script.
─────────────────────────────────────────────────────────────────────

FINE
