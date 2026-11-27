import { useEffect } from 'react';
import { proteggiArchivio } from '../utils/archivio-persistente';

/** Dopo il primo turno salvato chiede al browser di non svuotare l'archivio. */
export default function useArchivioPersistente(haTurni) {
  useEffect(() => { if (haTurni) proteggiArchivio(true); }, [haTurni]);
}
