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

  // Despiece de la bomba en "Quiénes somos": la bomba espera armada y grande; al llegar a la
  // sección la página se frena un momento, se reproduce el video del desarmado (Higgsfield),
  // la bomba se achica a su lugar, aparece el texto y se puede seguir bajando.
  // Una vez visto queda desarmada (aunque se vuelva al inicio); al refrescar la página se repite.
  var despiece = document.getElementById('despiece');
  var sinMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (despiece && !sinMovimiento) {
    var pin = despiece.querySelector('.despiece__pin');
    var texto = despiece.querySelector('.about__text');
    var figura = despiece.querySelector('.about__media');
    var video = despiece.querySelector('.despiece__video');
    var saltar = despiece.querySelector('.despiece__saltar');
    var celu = window.matchMedia('(max-width: 900px)');
    var cajaCelu = document.createElement('div');
    cajaCelu.className = 'container despiece-texto-celu';
    var parrafos = [].slice.call(texto.querySelectorAll('p:not(.eyebrow)'));
    var CLAVE = 'rm-despiece-visto';
    var estado = 'espera'; // espera → reproduciendo → listo
    var posicion = 0;      // dónde queda frenada la página mientras corre el video
    var ultimoY = window.scrollY;
    var saltoAncla = 0;

    // ¿Ya se vio en esta pestaña? Si la página se refrescó, se vuelve a mostrar.
    var visto = false;
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav && nav.type === 'reload') sessionStorage.removeItem(CLAVE);
      visto = sessionStorage.getItem(CLAVE) === '1';
    } catch (e) {}

    var cabecera = function () {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    };

    // En celular los párrafos van debajo (no entran en la pantalla); el título queda arriba de la foto
    var ubicarTexto = function () {
      if (celu.matches && !cajaCelu.parentNode) {
        parrafos.forEach(function (p) { cajaCelu.appendChild(p); });
        despiece.parentNode.insertBefore(cajaCelu, despiece.nextSibling);
      } else if (!celu.matches && cajaCelu.parentNode) {
        parrafos.forEach(function (p) { texto.appendChild(p); });
        cajaCelu.parentNode.removeChild(cajaCelu);
      }
    };

    // Agranda la bomba y la centra en la pantalla, tal como se va a ver cuando la página se frene
    var medir = function () {
      ubicarTexto();
      if (estado === 'listo') { figura.style.transform = ''; return; }
      var h = cabecera();
      var libre = window.innerHeight - h;
      figura.style.transform = 'none';
      var rp = pin.getBoundingClientRect();
      var rf = figura.getBoundingClientRect();
      posicion = Math.round(window.scrollY + rp.top - h);
      var centroY = h + (rf.top - rp.top) + rf.height / 2;
      var escala = celu.matches
        ? Math.min(window.innerWidth * 1.35 / rf.width, libre * .7 / rf.height)
        : Math.min(rp.width * .86 / rf.width, libre * .8 / rf.height, 2.6);
      escala = Math.max(1, escala);
      var dx = window.innerWidth / 2 - (rf.left + rf.width / 2);
      var dy = h + libre / 2 - centroY;
      figura.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + escala + ')';
    };

    // Mientras corre el video la página no se mueve
    var frenar = function (e) { if (estado === 'reproduciendo') e.preventDefault(); };
    var teclas = { 32: 1, 33: 1, 34: 1, 35: 1, 36: 1, 38: 1, 40: 1 };
    var frenarTeclas = function (e) { if (estado === 'reproduciendo' && teclas[e.keyCode]) e.preventDefault(); };
    window.addEventListener('wheel', frenar, { passive: false });
    window.addEventListener('touchmove', frenar, { passive: false });
    window.addEventListener('keydown', frenarTeclas);

    var terminar = function (animado) {
      if (estado === 'listo') return;
      estado = 'listo';
      try { sessionStorage.setItem(CLAVE, '1'); } catch (e) {}
      saltar.hidden = true;
      if (!animado) despiece.classList.add('despiece--listo');
      despiece.classList.add('despiece--fin');
      void figura.offsetWidth; // aplica la transición antes de soltar el tamaño grande
      figura.style.transform = '';
      if (!video.paused) video.pause();
    };

    var iniciar = function () {
      estado = 'reproduciendo';
      medir(); // se mide justo ahora: la página ya terminó de acomodarse (letras, fotos)
      window.scrollTo({ top: posicion, behavior: 'instant' });
      saltar.hidden = false;
      var arranco = false;
      video.addEventListener('playing', function () { arranco = true; }, { once: true });
      video.addEventListener('ended', function () { setTimeout(function () { terminar(true); }, 200); }, { once: true });
      video.preload = 'auto';
      try { video.currentTime = 0; } catch (e) {}
      var intento = video.play();
      if (intento && intento.catch) intento.catch(function () { terminar(true); });
      // si el video no arranca (conexión lenta, ahorro de batería), no se deja a nadie esperando
      setTimeout(function () { if (!arranco) terminar(true); }, 2500);
      setTimeout(function () { terminar(true); }, 9000);
    };

    var revisar = function () {
      var y = window.scrollY;
      var bajando = y > ultimoY;
      ultimoY = y;
      if (estado === 'reproduciendo') {
        if (Math.abs(y - posicion) > 2) window.scrollTo({ top: posicion, behavior: 'instant' });
        return;
      }
      if (estado !== 'espera') return;
      var r = pin.getBoundingClientRect();
      var h = cabecera();
      if (Date.now() - saltoAncla < 1500 || r.bottom < h) { terminar(false); return; } // se la saltó con un enlace
      if (bajando && r.top <= h + 2) iniciar();
    };
    window.addEventListener('scroll', revisar, { passive: true });
    window.addEventListener('resize', medir);
    saltar.addEventListener('click', function () { terminar(true); });
    // Los enlaces del menú ("Productos", "Envíos"…) pasan de largo sin frenar la página
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a && estado === 'espera') saltoAncla = Date.now();
    });

    // El video se descarga cuando la sección está por aparecer o al terminar de cargar la página
    var precargar = function () { if (video.preload !== 'auto') { video.preload = 'auto'; video.load(); } };
    if ('IntersectionObserver' in window) {
      var vigia = new IntersectionObserver(function (e) {
        if (e[0].isIntersecting) { precargar(); vigia.disconnect(); }
      }, { rootMargin: '1500px 0px' });
      vigia.observe(despiece);
    }
    if (document.readyState === 'complete') precargar();
    else window.addEventListener('load', function () { setTimeout(precargar, 300); });

    despiece.classList.add('despiece--on');
    medir();
    // Las letras y las fotos pueden mover la página al terminar de cargar: se vuelve a medir
    window.addEventListener('load', function () { if (estado === 'espera') medir(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (estado === 'espera') medir(); });
    // Ya visto en esta pestaña, o la página abrió más abajo de la sección: queda desarmada
    if (visto || pin.getBoundingClientRect().bottom < cabecera()) terminar(false);
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
