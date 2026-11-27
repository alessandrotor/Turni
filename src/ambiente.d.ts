// Ciò che Vite e la pagina aggiungono e che TypeScript non può sapere: serve solo al controllo dei tipi.
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly [chiave: string]: string | undefined;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  turnstile?: any;
  showSaveFilePicker?: (opzioni?: object) => Promise<any>;
}

declare module 'virtual:pwa-register' {
  export function registerSW(opzioni?: object): (ricarica?: boolean) => Promise<void>;
}

declare module "*.css";
