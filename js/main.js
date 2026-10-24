// Refri Mundo — interacciones mínimas

(function () {
  var header = document.getElementById('header');
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');

  // Sombra del encabezado al hacer scroll
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Menú móvil
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  toggle.addEventListener('click', function () {
    setMenu(!nav.classList.contains('is-open'));
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  // Medir los clics en WhatsApp (Google Analytics / Google Ads)
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href*="wa.me"]');
    if (!link || typeof window.gtag !== 'function') return;
    var section = link.closest('section, header, footer');
    window.gtag('event', 'contacto_whatsapp', {
      link_url: link.href,
      ubicacion: link.classList.contains('wa-float') ? 'boton-flotante' : (section && section.id) || 'encabezado'
    });
  });

  // Medir los clics hacia la tienda de Mercado Libre
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href*="mercadolibre.com"]');
    if (!link || typeof window.gtag !== 'function') return;
    window.gtag('event', 'visita_mercadolibre', { link_url: link.href });
  });

  // Año actual en el pie
  document.getElementById('year').textContent = new Date().getFullYear();

  // Despiece de la bomba en "Quiénes somos": la sección se frena mientras se baja,
  // la bomba armada (grande) se desarma, se achica hasta su lugar y aparece el texto.
  var despiece = document.getElementById('despiece');
  var sinMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (despiece && !sinMovimiento && window.requestAnimationFrame) {
    var pin = despiece.querySelector('.despiece__pin');
    var grilla = despiece.querySelector('.about');
    var texto = despiece.querySelector('.about__text');
    var figura = despiece.querySelector('.about__media');
    var armada = despiece.querySelector('.despiece__armada');
    var desarmada = despiece.querySelector('.despiece__desarmada');
    var aviso = despiece.querySelector('.despiece__hint');
    var celu = window.matchMedia('(max-width: 900px)');
    var cajaCelu = document.createElement('div');
    cajaCelu.className = 'container despiece-texto-celu';
    var medida = {};
    var pendiente = false;

    var tramo = function (p, desde, hasta) { return Math.min(1, Math.max(0, (p - desde) / (hasta - desde))); };
    var suave = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

    var pintar = function () {
      pendiente = false;
      var recorrido = despiece.offsetHeight - medida.alto;
      var bajado = pin.getBoundingClientRect().top - despiece.getBoundingClientRect().top;
      var p = recorrido > 0 ? Math.min(1, Math.max(0, bajado / recorrido)) : 1;
      var esCelu = celu.matches;
      // 1) se desarma: la armada se va y aparece la desarmada
      var d = suave(tramo(p, .1, esCelu ? .5 : .48));
      armada.style.opacity = 1 - d;
      armada.style.transform = 'scale(' + (1 - .1 * d) + ')';
      desarmada.style.opacity = d;
      desarmada.style.transform = 'scale(' + (1.08 - .08 * d) + ')';
      // 2) se achica y vuelve a su lugar
      var a = suave(tramo(p, esCelu ? .55 : .52, esCelu ? 1 : .82));
      var s = medida.escala + (1 - medida.escala) * a;
      figura.style.transform = 'translate(' + medida.dx * (1 - a) + 'px,' + medida.dy * (1 - a) + 'px) scale(' + s + ')';
      // 3) aparece el texto (en celular, el título arriba de la foto)
      var t = suave(tramo(p, esCelu ? .7 : .68, esCelu ? 1 : .94));
      texto.style.opacity = t;
      texto.style.transform = esCelu ? 'translateY(' + (16 * (1 - t)) + 'px)' : 'translateX(' + (-40 * (1 - t)) + 'px)';
      aviso.style.opacity = 1 - tramo(p, 0, .08);
    };

    // En celular los párrafos van debajo de la parte que se frena (no entran en la pantalla);
    // el título queda arriba de la foto. En compu todo el texto va al lado de la bomba.
    var parrafos = [].slice.call(texto.querySelectorAll('p:not(.eyebrow)'));
    var ubicarTexto = function () {
      if (celu.matches && !cajaCelu.parentNode) {
        parrafos.forEach(function (p) { cajaCelu.appendChild(p); });
        despiece.parentNode.insertBefore(cajaCelu, despiece.nextSibling);
      } else if (!celu.matches && cajaCelu.parentNode) {
        parrafos.forEach(function (p) { texto.appendChild(p); });
        cajaCelu.parentNode.removeChild(cajaCelu);
      }
    };

    var medir = function () {
      ubicarTexto();
      var cabecera = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
      var libre = window.innerHeight - cabecera;
      figura.style.transform = 'none';
      var alto = pin.offsetHeight;
      // En celular la parte que se frena queda centrada en la pantalla
      pin.style.top = celu.matches ? cabecera + Math.max(0, (libre - alto) / 2) + 'px' : '';
      // Cuánto hay que bajar para ver la animación completa (en celular, más corta)
      despiece.style.height = alto + window.innerHeight * (celu.matches ? 1.3 : 2) + 'px';
      // Posición final de la foto (sin transformar) y cuánto hay que agrandarla al comienzo
      var rp = pin.getBoundingClientRect();
      var rf = figura.getBoundingClientRect();
      var topeFijo = celu.matches ? parseFloat(pin.style.top) : cabecera;
      var centroFinalY = topeFijo + (rf.top - rp.top) + rf.height / 2;
      var escala = celu.matches
        ? Math.min(window.innerWidth * 1.35 / rf.width, libre * .7 / rf.height)
        : Math.min(rp.width * .86 / rf.width, libre * .78 / rf.height, 2.6);
      medida = {
        alto: alto,
        escala: Math.max(1, escala),
        dx: window.innerWidth / 2 - (rf.left + rf.width / 2),
        dy: cabecera + libre / 2 - centroFinalY
      };
      pintar();
    };

    var alBajar = function () {
      if (!pendiente) { pendiente = true; window.requestAnimationFrame(pintar); }
    };

    despiece.classList.add('despiece--on');
    medir();
    window.addEventListener('scroll', alBajar, { passive: true });
    window.addEventListener('resize', medir);
    if (!desarmada.complete) desarmada.addEventListener('load', medir);
  }

  // Aparición suave de secciones
  if ('IntersectionObserver' in window) {
    var items = [].filter.call(document.querySelectorAll('.section__head, .about__text, .about__media, .value, .product, .shipping__text, .shipping__gallery, .step, .contact'), function (el) {
      return !el.closest('.despiece--on'); // la bomba y su texto ya tienen su propia animación
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) {
      el.classList.add('reveal');
      io.observe(el);
    });
  }
})();
