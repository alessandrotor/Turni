# Note su motore/pay.js

## Perché una sola strada per la paga

Fino al 1° settembre 2026 accanto a `computePayByShift` vivevano altre quattro
funzioni esportate e mai chiamate: una che moltiplicava ore per paga, una che
calcolava un turno ignorando la soglia mensile (e lo ammetteva nel proprio
commento), più due resti di quando l'app ragionava a settimane. Erano una
trappola: nomi autorevoli, export pubblico e un numero diverso da quello
riscontrato per chiunque le avesse chiamate credendole il motore.

## Le assenze riempiono la soglia

Ad agosto 2026 la busta ha quindici giorni di ferie che cominciano il 31, dopo
che la soglia mensile è già stata superata. In ordine puramente cronologico il
motore incontrava quelle 4 ore a soglia piena e le scartava dai supplementari
(giustamente: un'assenza non si paga in più), ma così non riempivano più la
soglia e altrettante ore di lavoro restavano ordinarie: 13,55 ore
supplementari contro le 17,50 stampate.

La busta fa l'opposto, e lo dichiara nella propria aritmetica: 4,00 ferie +
99,20 retribuzione = 103,20 (il monte ore fisso), più 17,50 di supplementare.
Le ferie stanno dentro le ore fisse. Vale in generale: chi va in ferie a fine
mese si vedeva sottrarre ore supplementari già maturate.

Fra assenze, e fra turni di lavoro, l'ordine resta cronologico: cambia solo
quale dei due gruppi viene prima.

## Il supplementare nel mensilizzato

Due regole insieme, e servono tutte e due. Le ore ordinarie sono il monte ore
del mese (24 × 4,3 = 103,20), comunque si distribuiscano: luglio 2026 ne ha
109,5 lavorate e la busta ne paga 103,20, settembre 100,5 con le ferie e ne
paga 103,20. Il supplementare si conta invece a settimana, oltre le ore da
contratto, nel giorno in cui lo si fa. Contarlo sul mese dava 11,55 ore a
settembre contro le 14,25 stampate.

Il mese in corso sale coi turni: a ottobre 2026, 133 ore segnate di cui 39
supplementari davano il monte già pieno a metà mese, e i turni aggiunti dopo non
muovevano il lordo di un euro. Il raggruppamento segue `periodoConteggio`:
prima, «mese di calendario» dava un ibrido (turni dell'1-31 ma supplementare
calcolato su settimane intere) che non corrispondeva a nessuna busta.

## Le ore festive fuori dalle eccedenze

In busta un giorno festivo lavorato ha una riga sua, «Lavoro festivo ordinario»
al 100% più «Magg. festivo», e quelle ore non compaiono fra le supplementari.
Contarle in entrambi i posti le pagava al 130% + 20% invece che al 120%.

Si mettono da parte prima della soglia, non solo dopo: la busta di giugno 2026
decide fra le due letture. 145,20 ore lavorate, 13,75 festive, soglia 103,20 →
131,45 − 103,20 = 28,25 supplementari, esattamente quanto stampato. Lasciandole
nel monte ore, le 6,75 ore del 2 giugno riempirebbero parte della soglia e ne
uscirebbero 35,00. → `scripts/check-festivo-supplementare.mjs`
