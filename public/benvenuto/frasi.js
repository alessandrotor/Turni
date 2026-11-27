// La prima riga del titolo cambia a ogni apertura: un turno vero, diverso
// ogni volta, sopra la domanda fissa. Non salva niente e non manda niente.
// Senza JavaScript resta la frase scritta nella pagina.
(function () {
  var FRASI = [
    'Sei ore di domenica.',
    'Otto ore a Ferragosto.',
    'Un turno fino all’una di notte.',
    'Tre ore oltre l’orario.',
    'Il turno di Natale.',
    'Una settimana di ferie.',
    'Quattro ore in più sabato.',
  ];
  document.documentElement.classList.add('js');
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.querySelector('[data-frase]');
    if (!el) return;
    el.textContent = FRASI[Math.floor(Math.random() * FRASI.length)];
    // Due fotogrammi: il browser disegna lo stato nascosto, poi la frase entra.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('entra'); });
    });
  });
})();
