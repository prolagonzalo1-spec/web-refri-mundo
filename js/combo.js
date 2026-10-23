// Refri Mundo — Armá tu combo
// Lee los productos (del Excel vía Cloudflare, o del archivo de respaldo),
// los ordena por categoría y arma el pedido para enviar por WhatsApp.

(function () {
  'use strict';

  var WHATSAPP = '5491125291029';
  // URL del programa de Cloudflare que lee el Excel de OneDrive.
  // Mientras esté vacía, se usan los precios de data/productos.json.
  var PRECIOS_URL = 'https://refrimundo-precios.prolagonzalo1.workers.dev/';
  var RESPALDO_URL = 'data/productos.json';
  var STORAGE_KEY = 'refrimundo-combo';

  // Categorías en el orden en que se muestran (de más a menos esencial).
  var CATEGORIAS = [
    { id: 'bombas', nombre: 'Bombas de vacío' },
    { id: 'manifolds', nombre: 'Manifolds' },
    { id: 'vacuometros', nombre: 'Vacuómetros' },
    { id: 'mangueras', nombre: 'Mangueras' },
    { id: 'aceites', nombre: 'Aceites' },
    { id: 'otros', nombre: 'Otros productos' }
  ];

  // Cómo se deduce la categoría a partir del nombre del producto.
  // Se prueban en este orden: la primera que coincide gana.
  var REGLAS_CATEGORIA = [
    { test: /manifold/, cat: 'manifolds' },
    { test: /vacuometro/, cat: 'vacuometros' },
    { test: /aceite/, cat: 'aceites' },
    { test: /manguera/, cat: 'mangueras' },
    { test: /\b(bomba|supervac|dvr|dvp)\b/, cat: 'bombas' }
  ];

  // Productos que no se ofrecen en el armado de combos.
  var EXCLUIR = [/recuperadora/];

  // Fotos de cada producto (se buscan por palabras del nombre).
  var FOTOS = [
    { test: /manifold.*(bluetooth|pinza)/, src: 'img/manifold-digital.webp' },
    { test: /\bdvr\s*2a\b/, src: 'img/bomba-vacio.webp' },
    { test: /vacuometro/, src: 'img/vacuometro.webp' }
  ];

  var PROVINCIAS = ['Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
    'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén',
    'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
    'Tierra del Fuego', 'Tucumán'];

  var PAGOS = ['Transferencia bancaria', 'Mercado Pago', 'Tarjeta de crédito / débito'];

  var CAMPOS = [
    { id: 'nombre', label: 'Nombre y apellido', autocomplete: 'name', full: true },
    { id: 'provincia', label: 'Provincia', tipo: 'select' },
    { id: 'localidad', label: 'Localidad', autocomplete: 'address-level2' },
    { id: 'calle', label: 'Calle', autocomplete: 'address-line1' },
    { id: 'altura', label: 'Altura', inputmode: 'numeric' },
    { id: 'piso', label: 'Piso', opcional: true },
    { id: 'depto', label: 'Departamento', opcional: true },
    { id: 'cp', label: 'Código postal', autocomplete: 'postal-code' },
    { id: 'observaciones', label: 'Observaciones del domicilio', opcional: true,
      placeholder: 'Ej: casa con portón negro, tocar timbre 2' },
    { id: 'area', label: 'Código de área', inputmode: 'numeric', placeholder: 'Ej: 11' },
    { id: 'celular', label: 'Celular', inputmode: 'numeric', autocomplete: 'tel-local' },
    { id: 'email', label: 'Correo electrónico', tipo: 'email', autocomplete: 'email', full: true }
  ];

  var productos = [];      // productos visibles
  var pasos = [];          // categorías con productos + paso final
  var pasoActual = 0;
  var carrito = {};        // id -> cantidad
  var datos = { pago: '', campos: {} };

  var $ = function (id) { return document.getElementById(id); };

  // ---------- Utilidades ----------
  function normalizar(texto) {
    return String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function slug(texto) {
    return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function precio(n) {
    return '$' + Math.round(n).toLocaleString('es-AR');
  }
  function esc(texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function categoriaDe(nombre) {
    var n = normalizar(nombre);
    for (var i = 0; i < REGLAS_CATEGORIA.length; i++) {
      if (REGLAS_CATEGORIA[i].test.test(n)) return REGLAS_CATEGORIA[i].cat;
    }
    return 'otros';
  }
  function fotoDe(nombre) {
    var n = normalizar(nombre);
    for (var i = 0; i < FOTOS.length; i++) {
      if (FOTOS[i].test.test(n)) return FOTOS[i].src;
    }
    return '';
  }
  function guardar() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ carrito: carrito, datos: datos })); } catch (e) {}
  }
  function recuperar() {
    try {
      var g = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (g) { carrito = g.carrito || {}; datos = g.datos || datos; datos.campos = datos.campos || {}; }
    } catch (e) {}
  }

  // ---------- Datos ----------
  function cargar() {
    var pedir = function (url) {
      return fetch(url, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    };
    var inicio = PRECIOS_URL ? pedir(PRECIOS_URL).catch(function () { return pedir(RESPALDO_URL); }) : pedir(RESPALDO_URL);
    return inicio.then(function (json) {
      productos = (json.productos || [])
        .filter(function (p) {
          return p && p.nombre && p.disponible !== false && Number(p.precio) > 0 &&
            p.nombre.indexOf('+') === -1 && // los combos armados no van: cada cliente arma el suyo
            !EXCLUIR.some(function (re) { return re.test(normalizar(p.nombre)); });
        })
        .map(function (p) {
          return {
            id: slug(p.nombre),
            nombre: String(p.nombre).replace(/\s+/g, ' ').trim(),
            precio: Math.round(Number(p.precio)), // igual que lo muestra el Excel (sin decimales)
            cat: categoriaDe(p.nombre),
            foto: fotoDe(p.nombre)
          };
        });
    });
  }

  function armarPasos() {
    pasos = CATEGORIAS.filter(function (c) {
      return productos.some(function (p) { return p.cat === c.id; });
    }).map(function (c) { return { id: c.id, nombre: c.nombre }; });
    pasos.push({ id: 'final', nombre: 'Finalizar compra' });
    // Quitar del carrito lo que ya no existe (por ejemplo, si se quedó sin stock).
    Object.keys(carrito).forEach(function (id) {
      if (!productos.some(function (p) { return p.id === id; })) delete carrito[id];
    });
  }

  // ---------- Carrito ----------
  function ordenCategoria(cat) {
    for (var i = 0; i < CATEGORIAS.length; i++) if (CATEGORIAS[i].id === cat) return i;
    return CATEGORIAS.length;
  }
  function lineas() {
    return productos.filter(function (p) { return carrito[p.id] > 0; })
      .sort(function (a, b) { return ordenCategoria(a.cat) - ordenCategoria(b.cat); })
      .map(function (p) { return { p: p, cant: carrito[p.id], subtotal: p.precio * carrito[p.id] }; });
  }
  function total() {
    return lineas().reduce(function (s, l) { return s + l.subtotal; }, 0);
  }
  function cantidadTotal() {
    return lineas().reduce(function (s, l) { return s + l.cant; }, 0);
  }
  function setCantidad(id, cant) {
    cant = Math.max(0, Math.min(99, cant | 0));
    if (cant) carrito[id] = cant; else delete carrito[id];
    guardar();
    renderCarrito();
    renderNav();
    document.querySelectorAll('[data-qty="' + id + '"]').forEach(function (el) { el.textContent = cant; });
    document.querySelectorAll('[data-card="' + id + '"]').forEach(function (el) { el.classList.toggle('is-selected', cant > 0); });
    if (pasos[pasoActual] && pasos[pasoActual].id === 'final') renderPaso();
  }

  // ---------- Render ----------
  function renderNav() {
    $('stepsNav').innerHTML = pasos.map(function (paso, i) {
      var cuenta = paso.id === 'final' ? 0 : lineas().filter(function (l) { return l.p.cat === paso.id; })
        .reduce(function (s, l) { return s + l.cant; }, 0);
      return '<button type="button" class="step-chip' + (i === pasoActual ? ' is-active' : '') +
        (paso.id === 'final' ? ' step-chip--final' : '') + '" data-paso="' + i + '"' +
        (i === pasoActual ? ' aria-current="step"' : '') + '>' +
        '<span class="step-chip__num">' + (paso.id === 'final' ? '✓' : i + 1) + '</span>' + esc(paso.nombre) +
        (cuenta ? '<span class="step-chip__count">' + cuenta + '</span>' : '') + '</button>';
    }).join('');
  }

  function tarjeta(p) {
    var cant = carrito[p.id] || 0;
    var foto = p.foto
      ? '<img src="' + p.foto + '" alt="' + esc(p.nombre) + '" loading="lazy">'
      : '<div class="pcard__placeholder"><svg aria-hidden="true"><use href="#i-tool"/></svg><span>Foto próximamente</span></div>';
    return '<article class="pcard' + (cant ? ' is-selected' : '') + '" data-card="' + p.id + '">' +
      '<div class="pcard__img">' + foto + '</div>' +
      '<div class="pcard__body">' +
        '<h3 class="pcard__name">' + esc(p.nombre) + '</h3>' +
        '<p class="pcard__price">' + precio(p.precio) + '</p>' +
        '<div class="qty" role="group" aria-label="Cantidad de ' + esc(p.nombre) + '">' +
          '<button type="button" class="qty__btn" data-menos="' + p.id + '" aria-label="Quitar uno"><svg aria-hidden="true"><use href="#i-minus"/></svg></button>' +
          '<span class="qty__val" data-qty="' + p.id + '">' + cant + '</span>' +
          '<button type="button" class="qty__btn qty__btn--add" data-mas="' + p.id + '" aria-label="Agregar uno"><svg aria-hidden="true"><use href="#i-plus"/></svg></button>' +
        '</div>' +
      '</div></article>';
  }

  function navegacion() {
    var ant = pasoActual > 0 ? pasos[pasoActual - 1] : null;
    var sig = pasoActual < pasos.length - 1 ? pasos[pasoActual + 1] : null;
    return '<div class="step-actions">' +
      (ant ? '<button type="button" class="btn btn--outline" data-ir="' + (pasoActual - 1) + '"><svg class="icon" aria-hidden="true"><use href="#i-arrow-left"/></svg> ' + esc(ant.nombre) + '</button>' : '<span></span>') +
      (sig ? '<button type="button" class="btn btn--primary" data-ir="' + (pasoActual + 1) + '">' +
        (sig.id === 'final' ? 'Finalizar compra' : 'Siguiente: ' + esc(sig.nombre)) +
        ' <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></button>' : '') +
      '</div>';
  }

  function renderPaso() {
    var paso = pasos[pasoActual];
    var html;
    if (paso.id === 'final') {
      html = renderFinal();
    } else {
      var lista = productos.filter(function (p) { return p.cat === paso.id; });
      html = '<div class="step-head"><p class="step-head__num">Paso ' + (pasoActual + 1) + ' de ' + pasos.length + '</p>' +
        '<h2>' + esc(paso.nombre) + '</h2>' +
        '<p class="step-head__hint">Sumá los que quieras con el botón +, o pasá a la siguiente categoría.</p></div>' +
        '<div class="pgrid">' + lista.map(tarjeta).join('') + '</div>' + navegacion();
    }
    $('comboMain').innerHTML = html;
    document.body.classList.toggle('is-final', paso.id === 'final');
    if (paso.id === 'final') prepararFormulario();
  }

  function renderFinal() {
    var ls = lineas();
    var resumen = ls.length
      ? '<ul class="review">' + ls.map(function (l) {
          return '<li class="review__item">' +
            (l.p.foto ? '<img src="' + l.p.foto + '" alt="" class="review__img">' : '<span class="review__img review__img--empty"><svg aria-hidden="true"><use href="#i-tool"/></svg></span>') +
            '<div class="review__info"><strong>' + esc(l.p.nombre) + '</strong><span>' + precio(l.p.precio) + ' c/u</span></div>' +
            '<div class="qty qty--sm"><button type="button" class="qty__btn" data-menos="' + l.p.id + '" aria-label="Quitar uno"><svg aria-hidden="true"><use href="#i-minus"/></svg></button>' +
            '<span class="qty__val" data-qty="' + l.p.id + '">' + l.cant + '</span>' +
            '<button type="button" class="qty__btn qty__btn--add" data-mas="' + l.p.id + '" aria-label="Agregar uno"><svg aria-hidden="true"><use href="#i-plus"/></svg></button></div>' +
            '<strong class="review__sub">' + precio(l.subtotal) + '</strong></li>';
        }).join('') + '</ul><div class="review__total"><span>Total</span><strong>' + precio(total()) + '</strong></div>'
      : '<div class="review-empty"><p>Todavía no sumaste productos a tu combo.</p><button type="button" class="btn btn--primary" data-ir="0">Empezar a elegir</button></div>';

    var pagos = PAGOS.map(function (p) {
      return '<label class="pay"><input type="radio" name="pago" value="' + esc(p) + '" required' +
        (datos.pago === p ? ' checked' : '') + '><span>' + esc(p) + '</span></label>';
    }).join('');

    var campos = CAMPOS.map(function (c) {
      var valor = esc(datos.campos[c.id] || '');
      var label = '<label for="f-' + c.id + '">' + esc(c.label) + (c.opcional ? ' <span class="opt">(opcional)</span>' : '') + '</label>';
      var input;
      if (c.tipo === 'select') {
        input = '<select id="f-' + c.id + '" name="' + c.id + '" required><option value="">Elegí tu provincia</option>' +
          PROVINCIAS.map(function (pv) { return '<option' + (datos.campos[c.id] === pv ? ' selected' : '') + '>' + esc(pv) + '</option>'; }).join('') +
          '</select>';
      } else {
        input = '<input id="f-' + c.id + '" name="' + c.id + '" type="' + (c.tipo || 'text') + '"' +
          (c.opcional ? '' : ' required') + (c.autocomplete ? ' autocomplete="' + c.autocomplete + '"' : '') +
          (c.inputmode ? ' inputmode="' + c.inputmode + '"' : '') +
          (c.placeholder ? ' placeholder="' + esc(c.placeholder) + '"' : '') + ' value="' + valor + '">';
      }
      return '<div class="field' + (c.full ? ' field--full' : '') + '">' + label + input + '</div>';
    }).join('');

    return '<div class="step-head"><p class="step-head__num">Último paso</p><h2>Finalizá tu compra</h2>' +
      '<p class="step-head__hint">Revisá tu pedido, elegí cómo pagar y completá los datos de envío. Te llega todo armado a nuestro WhatsApp.</p></div>' +
      '<div class="final-block"><h3>1. Tu combo</h3>' + resumen + '</div>' +
      (ls.length ? '<form class="final-form" id="finalForm" novalidate>' +
        '<div class="final-block"><h3>2. Forma de pago</h3><div class="pays">' + pagos + '</div></div>' +
        '<div class="final-block"><h3>3. Datos de envío</h3><div class="fields">' + campos + '</div>' +
        '<p class="form-note">El costo del envío y la disponibilidad te los confirmamos por WhatsApp.</p></div>' +
        '<p class="form-error" id="formError" role="alert" hidden></p>' +
        '<button type="submit" class="btn btn--wa btn--lg final-submit"><svg class="icon" aria-hidden="true"><use href="#i-wa"/></svg> Comprar por WhatsApp</button>' +
        '</form>' : '') +
      '<div class="step-actions"><button type="button" class="btn btn--outline" data-ir="' + (pasoActual - 1) + '"><svg class="icon" aria-hidden="true"><use href="#i-arrow-left"/></svg> Seguir eligiendo</button><span></span></div>';
  }

  function renderCarrito() {
    var ls = lineas();
    $('cartList').innerHTML = ls.map(function (l) {
      return '<li class="cart__item"><span class="cart__qty">' + l.cant + '×</span>' +
        '<span class="cart__name">' + esc(l.p.nombre) + '</span>' +
        '<span class="cart__price">' + precio(l.subtotal) + '</span>' +
        '<button type="button" class="cart__remove" data-quitar="' + l.p.id + '" aria-label="Quitar ' + esc(l.p.nombre) + '"><svg aria-hidden="true"><use href="#i-trash"/></svg></button></li>';
    }).join('');
    $('cartEmpty').hidden = ls.length > 0;
    $('cartTotal').textContent = precio(total());
    var n = cantidadTotal();
    $('cartBarCount').textContent = n + (n === 1 ? ' producto' : ' productos');
    $('cartBarTotal').textContent = precio(total());
    document.body.classList.toggle('has-items', n > 0);
  }

  function irA(i) {
    pasoActual = Math.max(0, Math.min(pasos.length - 1, i));
    renderNav();
    renderPaso();
    var nav = $('stepsNav');
    var activo = nav.querySelector('.is-active');
    if (activo && activo.scrollIntoView) activo.scrollIntoView({ block: 'nearest', inline: 'center' });
    var top = nav.getBoundingClientRect().top + window.scrollY - 80;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
  }

  // ---------- Formulario y WhatsApp ----------
  function prepararFormulario() {
    var form = $('finalForm');
    if (!form) return;
    form.addEventListener('input', function (e) {
      if (e.target.name === 'pago') datos.pago = e.target.value;
      else if (e.target.name) datos.campos[e.target.name] = e.target.value;
      e.target.classList.remove('is-invalid');
      $('formError').hidden = true;
      guardar();
    });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'pago') { datos.pago = e.target.value; guardar(); }
      if (e.target.tagName === 'SELECT') { datos.campos[e.target.name] = e.target.value; e.target.classList.remove('is-invalid'); guardar(); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var faltan = [];
      if (!datos.pago) faltan.push('la forma de pago');
      CAMPOS.forEach(function (c) {
        var el = $('f-' + c.id);
        var v = (el.value || '').trim();
        var mal = (!c.opcional && !v) || (c.tipo === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
        el.classList.toggle('is-invalid', mal);
        if (mal) faltan.push(c.label.toLowerCase());
      });
      var err = $('formError');
      if (faltan.length) {
        err.textContent = 'Revisá estos datos: ' + faltan.join(', ') + '.';
        err.hidden = false;
        var primero = form.querySelector('.is-invalid') || form.querySelector('[name="pago"]');
        if (primero) primero.focus();
        return;
      }
      err.hidden = true;
      enviar();
    });
  }

  function mensaje() {
    var c = datos.campos;
    var t = [];
    t.push('Hola Refri Mundo, quiero comprar este combo:');
    t.push('');
    lineas().forEach(function (l) {
      t.push('• ' + l.cant + ' x ' + l.p.nombre + ' — ' + precio(l.p.precio) +
        (l.cant > 1 ? ' c/u = ' + precio(l.subtotal) : ''));
    });
    t.push('');
    t.push('*Total: ' + precio(total()) + '*');
    t.push('*Forma de pago:* ' + datos.pago);
    t.push('');
    t.push('*Datos de envío*');
    CAMPOS.forEach(function (campo) {
      var v = (c[campo.id] || '').trim();
      if (campo.opcional && !v) return;
      t.push(campo.label + ': ' + v);
    });
    return t.join('\n');
  }

  function enviar() {
    var url = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(mensaje());
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'pedido_combo', { value: total(), currency: 'ARS', items: cantidadTotal() });
    }
    var w = window.open(url, '_blank', 'noopener');
    if (!w) window.location.href = url;
  }

  // ---------- Eventos ----------
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-mas],[data-menos],[data-quitar],[data-ir],[data-paso]');
    if (!t) return;
    if (t.dataset.mas) setCantidad(t.dataset.mas, (carrito[t.dataset.mas] || 0) + 1);
    else if (t.dataset.menos) setCantidad(t.dataset.menos, (carrito[t.dataset.menos] || 0) - 1);
    else if (t.dataset.quitar) setCantidad(t.dataset.quitar, 0);
    else if (t.dataset.ir !== undefined) irA(+t.dataset.ir);
    else if (t.dataset.paso !== undefined) irA(+t.dataset.paso);
  });
  ['cartCta', 'cartBarCta'].forEach(function (id) {
    $(id).addEventListener('click', function () { irA(pasos.length - 1); });
  });

  $('year').textContent = new Date().getFullYear();

  // ---------- Inicio ----------
  recuperar();
  cargar().then(function () {
    armarPasos();
    renderNav();
    renderPaso();
    renderCarrito();
  }).catch(function () {
    $('comboMain').innerHTML = '<div class="combo-loading">No pudimos cargar los productos. ' +
      '<a href="https://wa.me/' + WHATSAPP + '" target="_blank" rel="noopener">Escribinos por WhatsApp</a> y te ayudamos.</div>';
  });
})();
