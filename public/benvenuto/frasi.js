// La prima riga del titolo gira da sola: un turno vero alla volta, per far
// vedere tutto quello che l'app sa segnare. Ordine mescolato a ogni apertura,
// nessuna ripetizione finché non sono passate tutte. Ferma quando la scheda non
// si vede; con «meno animazioni» del sistema cambia senza movimento e più
// piano. Non salva niente e non manda niente. Senza JavaScript resta la frase
// scritta nella pagina.
(function () {
  var FRASI = [
    'Sei ore di domenica.',
    'Otto ore a Ferragosto.',
    'Un turno fino all’una di notte.',
    'Tre ore oltre l’orario.',
    'Il turno di Natale.',
    'Una settimana di ferie.',
    'Quattro ore in più sabato.',
    'Un giorno di malattia.',
    'Un permesso di tre ore.',
    'Due turni nello stesso giorno.',
    'Il primo maggio al lavoro.',
  ];
  var VISIBILE = 4000;   // quanto resta ferma una frase
  var USCITA = 450;      // deve coincidere con la transizione di .esce nel CSS

  document.documentElement.classList.add('js');

  function mescola(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var el = document.querySelector('[data-frase]');
    if (!el) return;
    var calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var giro = mescola(FRASI.slice());
    var i = 0;

    function entra() {
      el.textContent = giro[i];
      el.classList.remove('esce');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { el.classList.add('entra'); });
      });
    }

    function prossima() {
      i += 1;
      if (i >= giro.length) {
        var ultima = giro[giro.length - 1];
        giro = mescola(FRASI.slice());
        if (giro[0] === ultima) giro.push(giro.shift());
        i = 0;
      }
      if (calmo) { el.textContent = giro[i]; return; }
      el.classList.remove('entra');
      el.classList.add('esce');
      setTimeout(entra, USCITA);
    }

    entra();
    var timer = setInterval(function () { if (!document.hidden) prossima(); }, calmo ? VISIBILE * 2 : VISIBILE + USCITA);
    window.addEventListener('pagehide', function () { clearInterval(timer); });
  });
})();
