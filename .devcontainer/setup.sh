#!/usr/bin/env bash
# Preparazione del Codespace. Gira UNA volta, alla creazione del container
# (postCreateCommand). Deve poter girare due volte senza fare danni: chi
# ricostruisce il container non deve ritrovarsi un ambiente diverso.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▸ Dipendenze dell'app"
npm ci

echo "▸ Dipendenze del proxy AI (worker/)"
# Il worker ha un package.json suo: senza queste, `wrangler dev` non parte e
# l'import da immagine non si può provare in locale.
if [ -f worker/package.json ]; then
  (cd worker && npm ci)
fi

echo "▸ Claude Code CLI"
# Installazione globale nella home dell'utente `node`: non serve sudo e
# sopravvive ai riavvii del Codespace.
npm install -g @anthropic-ai/claude-code

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

# ── Promemoria, non automatismi ─────────────────────────────────────────────
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
