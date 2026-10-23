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
    { id: 'bombas', nombre: 'Bombas de vacío', corto: 'Bombas', icono: 'cat-bombas' },
    { id: 'manifolds', nombre: 'Manifolds', icono: 'cat-manifolds' },
    { id: 'vacuometros', nombre: 'Vacuómetros', icono: 'cat-vacuometros' },
    { id: 'mangueras', nombre: 'Mangueras', icono: 'cat-mangueras' },
    { id: 'aceites', nombre: 'Aceites', icono: 'cat-aceites' },
    { id: 'otros', nombre: 'Otros productos', corto: 'Otros', icono: 'i-tool' }
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

  // Nombre que se muestra en la web (el Excel no se toca: se busca por palabras del nombre original).
  // "$1" se reemplaza por el número del modelo. En las bombas el detalle suma la capacidad y si es apta R32.
  var NOMBRES = [
    { test: /\b(?:dvr|dvp)\s*(\d)a\b/, nombre: 'Bomba de vacío DVR $1A' },
    { test: /supervac\s*vp\s*(\d)/, nombre: 'Bomba de vacío Supervac VP$1' },
    { test: /manifold.*(bluetooth|pinza)/, nombre: 'Manifold digital Dosivac con aplicación',
      detalle: 'Con pinzas de temperatura' },
    { test: /manifold digital.*sin app/, nombre: 'Manifold digital Dosivac' },
    { test: /manifold.*(aluminio|analogico)/, nombre: 'Manifold de aluminio analógico Dosivac' },
    { test: /vacuometro.*con app/, nombre: 'Vacuómetro digital con aplicación' },
    { test: /manguera/, nombre: 'Manguera de alto vacío Dosivac' },
    { test: /aceite/, nombre: 'Aceite Dosivac x 2 L', detalle: '2 envases de 1 litro' }
  ];

  // Fotos de cada producto (se buscan por palabras del nombre).
  // "nota" es un texto opcional que se muestra debajo del nombre.
  var FOTOS = [
    { test: /manifold.*(bluetooth|pinza)/, src: 'img/manifold-digital.webp' },
    { test: /manifold digital.*sin app/, src: 'img/manifold-digital-sin-app.webp' },
    { test: /manifold.*(aluminio|analogico)/, src: 'img/manifold-aluminio.webp' },
    { test: /supervac\s*vp\s*1\b/, src: 'img/supervac-vp1.webp' },
    { test: /supervac\s*vp\s*2\b/, src: 'img/supervac-vp2.webp' },
    { test: /manguera/, src: 'img/manguera.webp' },
    { test: /aceite/, src: 'img/aceite.webp' },
    // Bombas DVR: las aptas R32 tienen su propia foto (va primero); las demás usan la DVR común.
    // ("dvp" por si la 4A vuelve a escribirse con P).
    { test: /\b(dvr|dvp)\s*[1-4]a\b.*\br32\b/, src: 'img/bomba-dvr-r32.webp',
      nota: 'Imagen ilustrativa de la línea DVR. Cambia la capacidad.' },
    { test: /\b(dvr|dvp)\s*[1-4]a\b/, src: 'img/bomba-vacio.webp',
      nota: 'Imagen ilustrativa de la línea DVR. Cambia la capacidad.' },
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
  var datos = { pago: '', campos: {}, tipoFactura: '', factura: {} };

  // Los precios del Excel son sin IVA. Si el cliente pide factura (A o B) se suma el IVA al total.
  var IVA = 0.21;
  var TIPOS_FACTURA = [
    { id: 'A', nombre: 'Factura A', detalle: 'Responsables Inscriptos · +21% IVA' },
    { id: 'B', nombre: 'Factura B', detalle: 'Consumidor final o monotributo · +21% IVA' }
  ];
  var CAMPOS_FACTURA = {
    A: [
      { id: 'razon', label: 'Razón social', autocomplete: 'organization', full: true },
      { id: 'cuit', label: 'CUIT', inputmode: 'numeric', placeholder: 'Ej: 30-12345678-9', digitos: [11] },
      { id: 'domicilio', label: 'Domicilio fiscal', autocomplete: 'street-address', full: true }
    ],
    B: [
      { id: 'razon', label: 'Nombre o razón social', autocomplete: 'name', full: true },
      { id: 'doc', label: 'DNI o CUIT', inputmode: 'numeric', placeholder: 'Sin puntos ni guiones', digitos: [7, 8, 11] },
      { id: 'condicion', label: 'Condición frente al IVA', tipo: 'select',
        opciones: ['Consumidor final', 'Monotributista', 'Exento'] },
      { id: 'domicilio', label: 'Domicilio', autocomplete: 'street-address', full: true }
    ]
  };

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
      if (FOTOS[i].test.test(n)) return FOTOS[i];
    }
    return {};
  }
  function nombreWeb(nombre) {
    var n = normalizar(nombre);
    var limpio = String(nombre).replace(/\s+/g, ' ').trim();
    var r = { nombre: limpio, detalle: '' };
    for (var i = 0; i < NOMBRES.length; i++) {
      var m = n.match(NOMBRES[i].test);
      if (m) {
        r = { nombre: NOMBRES[i].nombre.replace('$1', m[1] || ''), detalle: NOMBRES[i].detalle || '' };
        break;
      }
    }
    if (categoriaDe(nombre) === 'bombas') {
      var cap = n.match(/(\d+)\s*l\s*-?\s*min/);
      var extra = [cap ? cap[1] + ' L/min' : '', /\br32\b/.test(n) ? 'Apta para gas R32' : ''];
      r.detalle = extra.filter(Boolean).join(' · ');
    }
    // Nombre en una sola línea para el carrito y el mensaje de WhatsApp.
    var d = r.detalle.replace(/ · (\w)/g, function (x, c) { return ', ' + c.toLowerCase(); });
    r.completo = r.nombre + (d ? ' (' + d.charAt(0).toLowerCase() + d.slice(1) + ')' : '');
    return r;
  }
  function guardar() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ carrito: carrito, datos: datos })); } catch (e) {}
  }
  function recuperar() {
    try {
      var g = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (g) {
        carrito = g.carrito || {}; datos = g.datos || datos;
        datos.campos = datos.campos || {}; datos.factura = datos.factura || {};
        if (datos.facturaA) datos.tipoFactura = 'A'; // pedidos guardados con la versión anterior
        delete datos.facturaA;
        if (!CAMPOS_FACTURA[datos.tipoFactura]) datos.tipoFactura = '';
      }
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
          var foto = fotoDe(p.nombre);
          var web = nombreWeb(p.nombre);
          return {
            id: slug(p.nombre),
            nombre: web.nombre,
            detalle: web.detalle,
            completo: web.completo,
            precio: Math.round(Number(p.precio)), // igual que lo muestra el Excel (sin decimales)
            cat: categoriaDe(p.nombre),
            foto: foto.src || '',
            nota: foto.nota || ''
          };
        });
    });
  }

  function armarPasos() {
    pasos = CATEGORIAS.filter(function (c) {
      return productos.some(function (p) { return p.cat === c.id; });
    }).map(function (c) { return { id: c.id, nombre: c.nombre, corto: c.corto || c.nombre, icono: c.icono }; });
    pasos.push({ id: 'final', nombre: 'Finalizar compra', corto: 'Finalizar', icono: 'i-bag' });
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
  function iva() {
    return datos.tipoFactura ? Math.round(total() * IVA) : 0;
  }
  function totalFinal() {
    return total() + iva();
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
  // Stepper: círculos con el dibujo de cada categoría, unidos por una línea que se llena
  // hasta el paso activo. Se arma una vez y después solo se actualiza (así se animan los cambios).
  function armarNav() {
    var mitad = 50 / pasos.length; // centro del primer y último círculo, en %
    $('stepsNav').innerHTML = '<div class="stepper" style="--inset:' + mitad + '%">' +
      '<span class="stepper__track"></span><span class="stepper__fill"></span><span class="stepper__dot"></span>' +
      '<ol class="stepper__list">' + pasos.map(function (paso, i) {
        return '<li class="stepper__item' + (paso.id === 'final' ? ' stepper__item--final' : '') + '">' +
          '<button type="button" class="stepper__btn" data-paso="' + i + '" aria-label="Paso ' + (i + 1) + ': ' + esc(paso.nombre) + '">' +
          '<span class="stepper__circle"><svg class="stepper__icon" aria-hidden="true"><use href="#' + paso.icono + '"/></svg>' +
          '<span class="stepper__count" hidden></span></span>' +
          '<span class="stepper__label"><span class="stepper__largo">' + esc(paso.nombre) + '</span>' +
          '<span class="stepper__corto">' + esc(paso.corto) + '</span></span></button></li>';
      }).join('') + '</ol></div>';
  }
  function renderNav() {
    if (!$('stepsNav').querySelector('.stepper')) armarNav();
    var stepper = $('stepsNav').querySelector('.stepper');
    stepper.style.setProperty('--prog', pasos.length > 1 ? pasoActual / (pasos.length - 1) : 0);
    stepper.querySelectorAll('.stepper__item').forEach(function (li, i) {
      var paso = pasos[i];
      var cuenta = paso.id === 'final' ? 0 : lineas().filter(function (l) { return l.p.cat === paso.id; })
        .reduce(function (s, l) { return s + l.cant; }, 0);
      li.classList.toggle('is-active', i === pasoActual);
      li.classList.toggle('is-done', i < pasoActual);
      var btn = li.querySelector('.stepper__btn');
      if (i === pasoActual) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
      var badge = li.querySelector('.stepper__count');
      badge.textContent = cuenta;
      badge.hidden = !cuenta;
    });
  }

  function tarjeta(p) {
    var cant = carrito[p.id] || 0;
    var foto = p.foto
      ? '<img src="' + p.foto + '" alt="' + esc(p.completo) + '" loading="lazy">'
      : '<div class="pcard__placeholder"><svg aria-hidden="true"><use href="#i-tool"/></svg><span>Foto próximamente</span></div>';
    return '<article class="pcard' + (cant ? ' is-selected' : '') + '" data-card="' + p.id + '">' +
      '<div class="pcard__img">' + foto + '</div>' +
      '<div class="pcard__body">' +
        '<h3 class="pcard__name">' + esc(p.nombre) + '</h3>' +
        (p.detalle ? '<p class="pcard__detail">' + esc(p.detalle) + '</p>' : '') +
        (p.nota ? '<p class="pcard__note">' + esc(p.nota) + '</p>' : '') +
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
        '<p class="step-head__hint">Sumá los que quieras con el botón +, o pasá a la siguiente categoría. ' +
        '<strong class="iva-tag">Precios sin IVA.</strong></p></div>' +
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
            '<div class="review__info"><strong>' + esc(l.p.completo) + '</strong><span>' + precio(l.p.precio) + ' c/u</span></div>' +
            '<div class="qty qty--sm"><button type="button" class="qty__btn" data-menos="' + l.p.id + '" aria-label="Quitar uno"><svg aria-hidden="true"><use href="#i-minus"/></svg></button>' +
            '<span class="qty__val" data-qty="' + l.p.id + '">' + l.cant + '</span>' +
            '<button type="button" class="qty__btn qty__btn--add" data-mas="' + l.p.id + '" aria-label="Agregar uno"><svg aria-hidden="true"><use href="#i-plus"/></svg></button></div>' +
            '<strong class="review__sub">' + precio(l.subtotal) + '</strong></li>';
        }).join('') + '</ul>' +
        '<div class="review__total"><span>Productos</span><strong>' + precio(total()) + '</strong></div>' +
        '<p class="review__iva">Precios sin IVA. Si necesitás factura (A o B), elegila más abajo y te sumamos el IVA.</p>'
      : '<div class="review-empty"><p>Todavía no sumaste productos a tu combo.</p><button type="button" class="btn btn--primary" data-ir="0">Empezar a elegir</button></div>';

    var pagos = PAGOS.map(function (p) {
      return '<label class="pay"><input type="radio" name="pago" value="' + esc(p) + '" required' +
        (datos.pago === p ? ' checked' : '') + '><span>' + esc(p) + '</span></label>';
    }).join('');

    var tipo = datos.tipoFactura;
    var factura = '<p class="form-note factura-ayuda">Si no necesitás factura, dejalo sin marcar.</p>' +
      '<div class="pays pays--factura">' + TIPOS_FACTURA.map(function (f) {
        return '<label class="pay"><input type="radio" name="tipoFactura" id="tf-' + f.id + '" value="' + f.id + '"' +
          (tipo === f.id ? ' checked' : '') + '><span><strong>' + esc(f.nombre) + '</strong><small>' + esc(f.detalle) + '</small></span></label>';
      }).join('') + '</div>' +
      (tipo
        ? '<div class="fields factura-fields">' + CAMPOS_FACTURA[tipo].map(function (c) {
            var control = c.tipo === 'select'
              ? '<select id="fa-' + c.id + '" name="' + c.id + '" data-factura="1" required><option value="">Elegí una opción</option>' +
                c.opciones.map(function (o) { return '<option' + (datos.factura[c.id] === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
                '</select>'
              : '<input id="fa-' + c.id + '" name="' + c.id + '" data-factura="1" type="text" required' +
                (c.autocomplete ? ' autocomplete="' + c.autocomplete + '"' : '') +
                (c.inputmode ? ' inputmode="' + c.inputmode + '"' : '') +
                (c.placeholder ? ' placeholder="' + esc(c.placeholder) + '"' : '') +
                ' value="' + esc(datos.factura[c.id] || '') + '">';
            return '<div class="field' + (c.full ? ' field--full' : '') + '"><label for="fa-' + c.id + '">' + esc(c.label) + '</label>' + control + '</div>';
          }).join('') + '</div>'
        : '');

    // Resumen de la compra justo antes del botón de WhatsApp
    var resumenFinal = '<div class="final-block resumen-final"><h3>Resumen de tu compra</h3>' +
      '<div class="resumen-final__grupo">' +
        '<div class="review__line"><span>Productos</span><span>' + precio(total()) + '</span></div>' +
        (tipo ? '<div class="review__line"><span>IVA 21% (Factura ' + tipo + ')</span><span>' + precio(iva()) + '</span></div>' : '') +
        '<div class="review__line"><span>Envío a todo el país</span><span class="gratis">Gratis</span></div>' +
      '</div>' +
      '<div class="review__total"><span>' + (tipo ? 'Total con IVA' : 'Total') + '</span><strong>' + precio(totalFinal()) + '</strong></div>' +
      (tipo ? '' : '<p class="review__iva">Precios sin IVA.</p>') +
      '</div>';

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
        '<div class="final-block"><h3>3. Facturación <span class="opt">(opcional)</span></h3>' + factura + '</div>' +
        '<div class="final-block"><h3>4. Datos de envío</h3><div class="fields">' + campos + '</div>' +
        '<p class="form-note">El envío es gratis a todo el país. La disponibilidad te la confirmamos por WhatsApp.</p></div>' +
        resumenFinal +
        '<p class="form-error" id="formError" role="alert" hidden></p>' +
        '<button type="submit" class="btn btn--wa btn--lg final-submit"><svg class="icon" aria-hidden="true"><use href="#i-wa"/></svg> Comprar por WhatsApp</button>' +
        '</form>' : '') +
      '<div class="step-actions"><button type="button" class="btn btn--outline" data-ir="' + (pasoActual - 1) + '"><svg class="icon" aria-hidden="true"><use href="#i-arrow-left"/></svg> Seguir eligiendo</button><span></span></div>';
  }

  function renderCarrito() {
    var ls = lineas();
    $('cartList').innerHTML = ls.map(function (l) {
      return '<li class="cart__item"><span class="cart__qty">' + l.cant + '×</span>' +
        '<span class="cart__name">' + esc(l.p.completo) + '</span>' +
        '<span class="cart__price">' + precio(l.subtotal) + '</span>' +
        '<button type="button" class="cart__remove" data-quitar="' + l.p.id + '" aria-label="Quitar ' + esc(l.p.nombre) + '"><svg aria-hidden="true"><use href="#i-trash"/></svg></button></li>';
    }).join('');
    $('cartEmpty').hidden = ls.length > 0;
    $('cartTotal').textContent = precio(totalFinal());
    $('cartTotalLabel').textContent = datos.tipoFactura ? 'Total con IVA' : 'Total sin IVA';
    var n = cantidadTotal();
    $('cartBarCount').textContent = n + (n === 1 ? ' producto' : ' productos') + (datos.tipoFactura ? ' · con IVA' : ' · sin IVA');
    $('cartBarTotal').textContent = precio(totalFinal());
    document.body.classList.toggle('has-items', n > 0);
  }

  function irA(i) {
    var cambio = pasoActual !== i;
    pasoActual = Math.max(0, Math.min(pasos.length - 1, i));
    renderNav();
    renderPaso();
    if (cambio) { // el contenido del paso entra con un fundido suave
      var main = $('comboMain');
      main.classList.remove('is-entrando');
      void main.offsetWidth;
      main.classList.add('is-entrando');
    }
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
      if (e.target.name === 'tipoFactura') return;
      if (e.target.name === 'pago') datos.pago = e.target.value;
      else if (e.target.dataset.factura) datos.factura[e.target.name] = e.target.value;
      else if (e.target.name) datos.campos[e.target.name] = e.target.value;
      e.target.classList.remove('is-invalid');
      $('formError').hidden = true;
      guardar();
    });
    form.addEventListener('click', function (e) {
      if (e.target.name === 'tipoFactura' && e.target.value === datos.tipoFactura) {
        e.target.checked = false;
        datos.tipoFactura = '';
        guardar();
        renderPaso();
        renderCarrito();
        var foco = $('tf-' + e.target.value);
        if (foco) foco.focus();
      }
    });
    form.addEventListener('change', function (e) {
      if (e.target.name === 'tipoFactura') {
        datos.tipoFactura = e.target.value;
        guardar();
        renderPaso(); // muestra los datos de la factura elegida y recalcula el total
        renderCarrito();
        var foco = datos.tipoFactura ? $('fa-razon') : $('tf-' + e.target.value);
        if (foco) foco.focus();
        return;
      }
      if (e.target.name === 'pago') { datos.pago = e.target.value; guardar(); }
      if (e.target.tagName === 'SELECT') {
        if (e.target.dataset.factura) datos.factura[e.target.name] = e.target.value;
        else datos.campos[e.target.name] = e.target.value;
        e.target.classList.remove('is-invalid');
        guardar();
      }
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
      if (datos.tipoFactura) {
        CAMPOS_FACTURA[datos.tipoFactura].forEach(function (c) {
          var el = $('fa-' + c.id);
          var v = (el.value || '').trim();
          var mal = !v || (c.digitos && c.digitos.indexOf(v.replace(/\D/g, '').length) === -1);
          el.classList.toggle('is-invalid', mal);
          if (mal) faltan.push(c.id === 'cuit' ? 'CUIT (11 números)' : c.id === 'doc' ? 'DNI o CUIT' : c.label.toLowerCase());
        });
      }
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
      t.push('• ' + l.cant + ' x ' + l.p.completo + ' — ' + precio(l.p.precio) +
        (l.cant > 1 ? ' c/u = ' + precio(l.subtotal) : ''));
    });
    t.push('');
    t.push('Productos: ' + precio(total()));
    if (datos.tipoFactura) t.push('IVA 21%: ' + precio(iva()));
    t.push('Envío: gratis');
    t.push('*Total' + (datos.tipoFactura ? ' con IVA' : '') + ': ' + precio(totalFinal()) + '*' + (datos.tipoFactura ? '' : ' (sin IVA)'));
    t.push('*Forma de pago:* ' + datos.pago);
    if (datos.tipoFactura) {
      t.push('');
      t.push('*Factura ' + datos.tipoFactura + '*');
      CAMPOS_FACTURA[datos.tipoFactura].forEach(function (campo) {
        t.push(campo.label + ': ' + (datos.factura[campo.id] || '').trim());
      });
    }
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
      window.gtag('event', 'pedido_combo', { value: totalFinal(), currency: 'ARS', items: cantidadTotal(), factura: datos.tipoFactura || 'no' });
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
