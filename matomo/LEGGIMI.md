# Matomo, il contatore visite europeo

Dal 28/11/2026 le visite si contano con Matomo installato sullo stesso hosting
IONOS del sito, all'indirizzo `statistiche.segnaturni.it` (cartella
`statistiche` dello spazio web). I dati non escono dal server: è il motivo per
cui è stato scelto al posto di Cloudflare Web Analytics (USA) e di Pirsch
(fornitore esterno).

Il programma NON sta nel repository: lo scarica dal sito ufficiale e lo carica
`installa-matomo.yml`, che parte quando cambia questo file o a mano. Il
caricamento non cancella mai niente sul server: `config/` (con la password del
database) e i dati restano dove sono.

L'installazione guidata e gli aggiornamenti si fanno dal pannello di Matomo,
con l'utenza di chi mantiene il progetto. Le password non passano mai da qui.

Ultima richiesta di caricamento: 28/11/2026, prima installazione.
