# AGENTS.md — Refri Mundo

Guía rápida para agentes (Claude Code, Codex) y personas que trabajen en este repo.
Para el contexto completo del proyecto, ver también **`NOTAS.md`**.

> ⚠️ **Este repositorio es PÚBLICO.** No escribir acá datos confidenciales
> (costos, márgenes, datos personales, vínculos comerciales privados).
> Sobre Dosivac, la web solo dice *"trabajamos principalmente con la línea Dosivac,
> con garantía de fábrica"*. No agregar nada más sobre esa relación.

## El proyecto

- Sitio institucional de **Refri Mundo** (herramientas para refrigeración y aire, línea Dosivac).
- **HTML + CSS + JavaScript vanilla. Sin framework ni build**: se edita y se sube tal cual.
- Hosting: **GitHub Pages** desde `main` (raíz). Dominio `refrimundo.com.ar` (archivo `CNAME`), detrás de Cloudflare.
- Repo: `prolagonzalo1-spec/web-refri-mundo`.

## Estructura

```
index.html        Página principal (todas las secciones)
combo.html        "Armá tu combo"
css/styles.css    Estilos y paleta
css/combo.css     Estilos del combo
js/main.js        Menú móvil + animación de la bomba ("despiece") en Quiénes somos
js/combo.js       Toda la lógica del combo
data/productos.json  Respaldo de precios/stock del combo (si el Worker falla)
worker/precios.js    Código del Worker de Cloudflare (se despliega aparte, en el panel de Cloudflare)
img/              Imágenes WebP optimizadas
material/         Originales (no se publican directo)
CNAME             Dominio propio para GitHub Pages
```

Secciones de `index.html`: hero (`#inicio`), franja de confianza, quiénes somos (`#nosotros`),
productos (`#productos`), envíos (`#envios`), postventa (`#postventa`), contacto (`#contacto`).

## Cómo trabajar acá

- El dueño **no es técnico**: explicar todo en español rioplatense (voseo), sin jerga.
- Rama de trabajo: **`claude/startup-website-design-tg0cnu`**. El dueño hace el merge desde GitHub
  (Compare & pull request → Create → Merge). **Nunca pedir merge de algo que el dueño no aprobó.**
  Después de cada merge, rehacer la rama desde `main`.
- Antes de pedir merge: mostrar una **vista previa privada** y revisar en compu y celular.
- **No cambiar la estructura ni la navegación** sin pedido explícito.

## Decisiones de diseño (confirmadas)

- **Paleta** (`:root` en `css/styles.css`): azul marino `#12326f` (logo), azul Dosivac `#1d4fbf`,
  celeste hielo `#eef3fb`, verde WhatsApp `#1fae57`. Fuentes: **Montserrat** (títulos), **Inter** (texto).
- **Contacto**: solo WhatsApp **+54 9 11 2529-1029** (`wa.me/5491125291029`) y botón a Mercado Libre.
  Sin dirección (no hay local).
- **Analytics**: Google tag `G-2M7QLMY64X` (en `index.html`).
- **"Armá tu combo"** (`js/combo.js`):
  - Precios **en vivo** desde el Worker `https://refrimundo-precios.prolagonzalo1.workers.dev/`
    (lee el Excel de OneDrive). Si falla, usa `data/productos.json`. Carga al instante con el
    respaldo y actualiza cuando llegan los precios en vivo.
  - Los **nombres** que se muestran se definen en `NOMBRES` (el Excel no se toca). La categoría se
    deduce del nombre (`REGLAS_CATEGORIA`) y la foto por palabras del nombre (`FOTOS`).
  - **Pagos**: Transferencia bancaria, Mercado Pago, Tarjeta (sin efectivo).
  - Precios **sin IVA**; con Factura A o B se suma 21%. **Envío gratis** a todo el país.
  - **Sin stock** (`stock: false`): franja "SIN STOCK" + botón "Reservar la tuya"; la reserva
    no suma al total.
  - Finaliza abriendo WhatsApp con el pedido armado.
- **Modelo 3D de la bomba** (generado en noviembre 2026): Tripo H3.1 multivista a partir de fotos
  reales. Archivo optimizado para web ~1,09 MB / 54k triángulos (meshopt + texturas WebP), con el
  cartel "Dvr II / DOSICOOL" legible y la base maciza. **Todavía no está integrado en la página**
  (los archivos del modelo están fuera del repo por ahora).

## Pendientes

- **Integrar el modelo 3D de la bomba en el inicio**: animación "viva" (flota, respira, gira)
  reemplazando el despiece actual, con iluminación de estudio como en las fotos de referencia.
  Opcionales conversados: que el visitante la gire, hotspots de características, AR en celular.
- **Mejoras de rendimiento (commit `c1ee211`)**: combo carga al instante, header compacto en
  celular, inicio más liviano. Están en la rama de trabajo, **sin mergear** — esperan revisión del dueño.
- Opcionales: generar 3D de manifold y vacuómetro (idea "productos cayendo del cielo");
  redirigir `refrimundo.ar` a `.com.ar`; marcar conversiones en Google Ads.
- `_viewer.html` y `modelo/` aparecen sin seguimiento en git (archivos de prueba del 3D):
  **no commitearlos**.

## Cómo probar "Armá tu combo"

Es un sitio estático, pero el combo hace `fetch` (del Worker y de `data/productos.json`), así que
**no alcanza con abrir el archivo con doble clic** (`file://` bloquea el fetch). Hay que servirlo por HTTP:

1. Parado en la carpeta del repo, levantar un servidor local, por ejemplo:
   ```
   python -m http.server 8000
   ```
2. Abrir `http://localhost:8000/combo.html` en el navegador.
3. Debería cargar al instante con los precios de respaldo y, si hay internet, actualizarse con los
   precios en vivo del Worker.
4. Probar el flujo completo: elegir productos y cantidades → forma de pago → datos de envío →
   botón de WhatsApp (abre `wa.me` con el combo armado).
5. **Sin stock / reservas**: en `data/productos.json` ya hay productos con `"stock": false`
   (también podés poner uno en `false` y recargar) — debería aparecer la franja "SIN STOCK" y el
   botón "Reservar la tuya". Con `"disponible": false` el producto no se muestra.
6. El combo guarda el avance en el navegador (`localStorage`, clave `refrimundo-combo`).
