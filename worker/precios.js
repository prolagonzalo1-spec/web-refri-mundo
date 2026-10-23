// Refri Mundo — Precios desde el Excel de OneDrive (Cloudflare Worker)
//
// Descarga el Excel compartido en OneDrive, lee SOLO la hoja WHATSAPP
// y devuelve nombre, precio (columna "VENTA WP") y disponibilidad
// (las filas con el nombre pintado de rojo se marcan como no disponibles).
// Costos, ganancias y el resto de las hojas nunca salen de acá.
//
// Configuración en Cloudflare (Settings → Variables and Secrets):
//   ONEDRIVE_URL  (Secret)  Link de OneDrive "Cualquier persona con el vínculo puede ver"
//   HOJA          (opcional) Nombre de la hoja. Por defecto: WHATSAPP

const CACHE_MS = 5 * 60 * 1000; // se vuelve a leer el Excel cada 5 minutos como máximo
let memoria = { hora: 0, cuerpo: null };

export default {
  async fetch(request, env) {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=120'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers });

    if (memoria.cuerpo && Date.now() - memoria.hora < CACHE_MS) {
      return new Response(memoria.cuerpo, { headers });
    }
    try {
      if (!env.ONEDRIVE_URL) throw new Error('Falta configurar ONEDRIVE_URL');
      const excel = await descargar(env.ONEDRIVE_URL);
      const productos = await leerHoja(excel, env.HOJA || 'WHATSAPP');
      if (!productos.length) throw new Error('La hoja no tiene productos');
      memoria = {
        hora: Date.now(),
        cuerpo: JSON.stringify({ fuente: 'excel', actualizado: new Date().toISOString(), productos })
      };
      return new Response(memoria.cuerpo, { headers });
    } catch (e) {
      // Si falla, se devuelve lo último que se pudo leer (si hay).
      if (memoria.cuerpo) return new Response(memoria.cuerpo, { headers });
      return new Response(JSON.stringify({ error: String(e && e.message || e) }), {
        status: 502,
        headers: { ...headers, 'Cache-Control': 'no-store' }
      });
    }
  }
};

// ---------- Descarga desde OneDrive ----------
async function descargar(link) {
  const b64 = btoa(link.trim()).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  const intentos = ['https://api.onedrive.com/v1.0/shares/u!' + b64 + '/root/content'];
  try {
    const u = new URL(link.trim());
    u.searchParams.set('download', '1');
    intentos.push(u.toString());
  } catch (e) {}

  for (const url of intentos) {
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 RefriMundoPrecios' } });
      if (!r.ok) continue;
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes[0] === 0x50 && bytes[1] === 0x4b) return bytes; // es un archivo .xlsx (zip)
    } catch (e) {}
  }
  throw new Error('No se pudo descargar el Excel desde OneDrive');
}

// ---------- Lectura del .xlsx (es un zip con archivos XML) ----------
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function descomprimir(bytes, quiero) {
  let fin = bytes.length - 22;
  while (fin >= 0 && u32(bytes, fin) !== 0x06054b50) fin--;
  if (fin < 0) throw new Error('El archivo no es un Excel válido');
  const total = u16(bytes, fin + 10);
  let p = u32(bytes, fin + 16);
  const dec = new TextDecoder();
  const archivos = {};
  for (let i = 0; i < total; i++) {
    const metodo = u16(bytes, p + 10);
    const tam = u32(bytes, p + 20);
    const ln = u16(bytes, p + 28), le = u16(bytes, p + 30), lc = u16(bytes, p + 32);
    const local = u32(bytes, p + 42);
    const nombre = dec.decode(bytes.subarray(p + 46, p + 46 + ln));
    p += 46 + ln + le + lc;
    if (!quiero(nombre)) continue;
    const ini = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
    const datos = bytes.subarray(ini, ini + tam);
    if (metodo === 0) archivos[nombre] = dec.decode(datos);
    else {
      const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      archivos[nombre] = await new Response(flujo).text();
    }
  }
  return archivos;
}

const entidades = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function xmlTexto(s) {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return entidades[e] || m;
  });
}
function atributos(tag) {
  const a = {};
  tag.replace(/([\w:]+)="([^"]*)"/g, (m, k, v) => { a[k] = xmlTexto(v); return m; });
  return a;
}
function normalizar(t) {
  return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}
function esRojo(color) {
  if (!color) return false;
  if (color.indexed === '10' || color.indexed === '2') return true;
  if (color.rgb) {
    const hex = color.rgb.slice(-6);
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return r >= 190 && g <= 90 && b <= 90;
  }
  return false;
}

async function leerHoja(bytes, nombreHoja) {
  const base = await descomprimir(bytes, (n) =>
    n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || n === 'xl/sharedStrings.xml' || n === 'xl/styles.xml');

  // Buscar el archivo de la hoja pedida
  let relId = null;
  for (const m of (base['xl/workbook.xml'] || '').matchAll(/<sheet\b[^>]*>/g)) {
    const a = atributos(m[0]);
    if (normalizar(a.name) === normalizar(nombreHoja)) relId = a['r:id'];
  }
  if (!relId) throw new Error('No se encontró la hoja ' + nombreHoja);
  let ruta = null;
  for (const m of (base['xl/_rels/workbook.xml.rels'] || '').matchAll(/<Relationship\b[^>]*>/g)) {
    const a = atributos(m[0]);
    if (a.Id === relId) ruta = a.Target.replace(/^\//, '').replace(/^(?!xl\/)/, 'xl/');
  }
  const hojaXml = (await descomprimir(bytes, (n) => n === ruta))[ruta];
  if (!hojaXml) throw new Error('No se pudo leer la hoja ' + nombreHoja);

  // Textos compartidos
  const textos = [];
  for (const m of (base['xl/sharedStrings.xml'] || '').matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let t = '';
    for (const x of m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) t += x[1];
    textos.push(xmlTexto(t));
  }

  // Estilos: qué formatos de celda tienen relleno rojo
  const estilos = base['xl/styles.xml'] || '';
  const rellenos = [];
  const bloqueFills = (estilos.match(/<fills\b[^>]*>([\s\S]*?)<\/fills>/) || [])[1] || '';
  for (const m of bloqueFills.matchAll(/<fill\b[^>]*?(?:\/>|>([\s\S]*?)<\/fill>)/g)) {
    const fg = (m[1] || '').match(/<fgColor\b[^>]*>/);
    rellenos.push(esRojo(fg ? atributos(fg[0]) : null));
  }
  const formatoRojo = [];
  const bloqueXfs = (estilos.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '';
  for (const m of bloqueXfs.matchAll(/<xf\b[^>]*>/g)) {
    formatoRojo.push(!!rellenos[+(atributos(m[0]).fillId || 0)]);
  }

  // Celdas de la hoja
  const filas = new Map(); // fila -> { columna: { texto, numero, rojo } }
  for (const m of hojaXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const a = atributos(m[1]);
    const ref = /^([A-Z]+)(\d+)$/.exec(a.r || '');
    if (!ref) continue;
    const interior = m[2] || '';
    const v = (interior.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    let texto = '', numero = null;
    if (a.t === 's') texto = textos[+v] || '';
    else if (a.t === 'inlineStr') texto = xmlTexto(((interior.match(/<t\b[^>]*>([\s\S]*?)<\/t>/) || [])[1]) || '');
    else if (a.t === 'str') texto = xmlTexto(v || '');
    else if (a.t !== 'e' && v !== undefined) { numero = parseFloat(v); texto = v; }
    const fila = +ref[2];
    if (!filas.has(fila)) filas.set(fila, {});
    filas.get(fila)[ref[1]] = { texto: texto.trim(), numero, rojo: !!formatoRojo[+(a.s || 0)] };
  }

  // Encabezados: "Productos" y "VENTA WP"
  let filaEnc = 0, colNombre = 'A', colPrecio = 'L';
  for (const [n, celdas] of filas) {
    for (const [col, c] of Object.entries(celdas)) {
      const t = normalizar(c.texto);
      if (t === 'productos') { filaEnc = n; colNombre = col; }
      if (t === 'venta wp') colPrecio = col;
    }
    if (filaEnc) break;
  }

  const productos = [];
  for (const n of [...filas.keys()].sort((x, y) => x - y)) {
    if (n <= filaEnc) continue;
    const celdas = filas.get(n);
    const nombre = celdas[colNombre];
    const precio = celdas[colPrecio];
    if (!nombre || !nombre.texto) continue;
    productos.push({
      nombre: nombre.texto,
      precio: precio && precio.numero !== null && isFinite(precio.numero) ? precio.numero : 0,
      disponible: !nombre.rojo
    });
  }
  return productos;
}
