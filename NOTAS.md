# Notas del proyecto — Web de Refri Mundo

Contexto para retomar el trabajo en una conversación nueva con Claude.
**Este repositorio es público: no escribir acá datos confidenciales** (costos, márgenes,
datos personales, vínculos comerciales privados). El dueño los explica en el chat si hacen falta.

## El negocio
- **Refri Mundo**: emprendimiento familiar argentino, 100% online (Mercado Libre + WhatsApp).
- Vende herramientas para técnicos de refrigeración y aire acondicionado, principalmente la línea **Dosivac**
  (bombas de vacío, manifolds, vacuómetros, mangueras, aceite), con garantía de fábrica. Envíos a todo el país.
- WhatsApp: **+54 9 11 2529-1029** (`wa.me/5491125291029`). Mensaje base: "Hola Refri Mundo, me contacto para..."
- Horarios: lunes a viernes 8 a 19, sábados 8 a 14, domingos cerrado. **Sin local** (no mostrar dirección).
- Tienda de Mercado Libre: https://www.mercadolibre.com.ar/pagina/refrimundo — MercadoLíder, +1000 ventas.
- En la web **solo se muestra WhatsApp** como contacto (más el botón a Mercado Libre).
- Sobre Dosivac, la web solo dice "trabajamos principalmente con la línea Dosivac, con garantía de fábrica".
  No agregar nada más sobre esa relación.

## Cómo se trabaja
- El dueño **no es técnico**: explicarle todo paso a paso, en español rioplatense (voseo), sin jerga.
- Rama de trabajo: **`claude/startup-website-design-tg0cnu`**. Claude hace commit + push ahí; el dueño hace el
  merge desde GitHub (Compare & pull request → Create → Merge → Confirm). Después de cada merge, rehacer la rama
  desde `main` (`git checkout -B claude/startup-website-design-tg0cnu origin/main`).
- **Nunca pedir merge de algo que el dueño no aprobó.** Antes de pedir merge, revisar en compu y celular
  (Playwright + Chromium están disponibles; capturas a 1440 px y 390 px).
- Vistas previas privadas (Artifacts de claude.ai) para que el dueño revise antes de publicar:
  - Página principal: https://claude.ai/artifact/HRAKZSqwsyhs3BakwwG5Wn
  - Armá tu combo: https://claude.ai/artifact/J7iU2BCpHg7n3iFKkMhoHG
- Imágenes: las originales van en `material/` (las sube el dueño). Claude las optimiza con Pillow a WebP en `img/`.
- En el entorno en la nube la red está muy restringida: no se puede abrir refrimundo.com.ar, el Worker,
  OneDrive ni las URLs de imágenes de Higgsfield/Drive. Pedirle capturas al dueño cuando haga falta verificar algo.

## Publicación y dominio
- Hosting: **GitHub Pages** desde `main` (raíz). Archivo `CNAME` = `refrimundo.com.ar`. HTTPS activo.
- Dominio `.com.ar` registrado en NIC Argentina, **delegado a Cloudflare** (plan gratis).
  DNS en Cloudflare (todos en "DNS only", nube gris): 4 registros A → 185.199.108.153 / 109.153 / 110.153 / 111.153,
  CNAME `www` → `prolagonzalo1-spec.github.io`, más un TXT de verificación de Google.
- `refrimundo.ar` también está registrado pero **sin configurar** (pendiente: que redirija a .com.ar).

## Página principal (`index.html`, `css/styles.css`, `js/main.js`)
- Secciones: portada, franja de confianza (MercadoLíder, +1000 ventas, garantía, envíos), quiénes somos,
  productos (tarjetas con link a WhatsApp: bomba → catálogo "Ver modelos", vacuómetro y manifold → publicación),
  envíos, postventa, contacto, pie. Botón flotante de WhatsApp.
- Paleta: azul marino del logo `#12326f`, azul Dosivac `#1d4fbf`, celeste `#eef3fb`, verde WhatsApp `#1fae57`,
  amarillo Mercado Libre `#ffe600`. Fuentes: Montserrat (títulos) e Inter (texto).
- **Google Analytics / Ads**: etiqueta `G-2M7QLMY64X`. Eventos: `contacto_whatsapp`, `visita_mercadolibre`,
  `pedido_combo` (en la página del combo, con el monto).
- **Search Console** verificado (dominio), `sitemap.xml` y `robots.txt` enviados.
- **Perfil de Empresa en Google** creado (dirección oculta, horarios cargados).

## Armá tu combo (EN PRUEBA — NO PUBLICAR hasta el OK del dueño)
- Archivos: `combo.html` (con `noindex`, **no enlazada** desde la principal), `js/combo.js`, `css/combo.css`,
  `data/productos.json` (respaldo).
- Flujo: el cliente recorre categorías (Bombas de vacío → Manifolds → Vacuómetros → Mangueras → Aceites →
  Finalizar compra), elige cantidades, elige forma de pago (Transferencia bancaria, Mercado Pago, Tarjeta;
  **sin efectivo**) y completa datos de envío: nombre y apellido, provincia, localidad, calle, altura, piso (opc.),
  departamento (opc.), observaciones (opc.), código postal, código de área, celular, correo. Se abre WhatsApp con
  "Hola Refri Mundo, quiero comprar este combo:" + lista + total + pago + datos.
- La categoría se deduce del **nombre** del producto (reglas en `REGLAS_CATEGORIA`). Se excluyen las
  recuperadoras de gas y los combos armados (nombres con "+"). Fotos por palabras del nombre en `FOTOS`
  (sin foto → ícono "Foto próximamente").
- **Precios en vivo**: la web es un espejo de lo que se vende por WhatsApp. `PRECIOS_URL` apunta al Worker
  https://refrimundo-precios.prolagonzalo1.workers.dev/ — si falla, usa `data/productos.json`.
  Los precios se muestran redondeados a entero (como los muestra el Excel), **sin otro redondeo**.
- **Worker de Cloudflare** (`worker/precios.js`, ya desplegado por el dueño como `refrimundo-precios`):
  descarga el Excel de OneDrive (secreto `ONEDRIVE_URL`), lee **solo la hoja `WHATSAPP`**: nombre (columna
  "Productos"), precio (columna "VENTA WP") y la columna cuyo título dice "web" (sí/no) para decidir qué se
  muestra. Nunca expone costos ni otras hojas. Cache de 5 minutos. Diagnóstico con `?debug=1`.
  Para actualizar el código, el dueño lo pega en Cloudflare (Workers → refrimundo-precios → Edit code → Deploy).

## Pendientes (en orden)
1. ✅ **Nota en bombas DVR** (hecho): misma foto (`img/bomba-vacio.webp`) para DVR 1A, 2A, 3A y 4A, con la nota
   "Imagen ilustrativa de la línea DVR. Cambia la capacidad." En el Excel la 4A está mal escrita como "DVP 4A":
   el dueño la corrige a "DVR 4A" (la web acepta las dos).
2. ✅ **Fotos del combo** (hecho, falta el OK del dueño): todos los productos del combo tienen foto. Fuente: Google
   Drive, carpeta "Refri Mundo Productos". Originales en `material/`, optimizadas a 800×840 en `img/`.
   - Elegidas por Claude (el dueño se lo delegó): VP1/VP2 = capturas limpias sobre fondo blanco; aluminio = `14.png`;
     manifold sin app = `MOTOCOMPRESORES (54).png`; manguera = `8.png`; aceite = `Diseño_sin_título_(4).png`.
   - **Lección Higgsfield**: `upscale_image` (bytedance 2K) **inventa letras** en textos chicos de etiquetas
     (ej. "ACEITE" → "ACEIT2"). Solo se usó la mejorada del manifold digital sin app (no tiene texto chico).
     VP1, VP2 y aceite van con la original. Siempre comparar con zoom antes de usar una foto mejorada.
   - Pendiente opcional: una foto mejor del aceite (la botella original mide ~107×227 px y se ve algo suave),
     y el producto es "x 2u" pero la foto muestra una botella.
   - **Estilo de fotos** (pedido del dueño): todas como `img/bomba-vacio.webp`, `vacuometro.webp` y
     `manifold-digital.webp` → producto sobre pared gris celeste clara con sombra suave, 900×945. Se hacen así:
     `remove_background` de Higgsfield (1 crédito) solo como máscara + píxeles de la foto original encima, sobre un
     fondo generado por código. Los kits (manifold de aluminio y digital sin app) imitan `manifold-digital.webp`:
     valija abierta y valija/caja atrás, manifold adelante. Nada redibujado por IA.
   - Claude **sí puede** ver las fotos: las baja de Drive (`uc?export=download&id=ID`) y las mira localmente.
3. **Publicar el combo** cuando el dueño dé el OK: botón "Armá tu combo" en la página principal, quitar el
   `noindex` de `combo.html`, agregarla a `sitemap.xml`, actualizar `data/productos.json` y pedir merge.
4. Opcionales conversados: redirigir `refrimundo.ar`; contador de ventas de Mercado Libre vía API;
   marcar `contacto_whatsapp` / `pedido_combo` como conversiones en Google Ads.
