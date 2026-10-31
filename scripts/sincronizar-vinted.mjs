/* Sincroniza data/productos.json con el armario de Vinted. Se ejecuta en GitHub Actions, sin sesion de usuario.
   Uso: node scripts/sincronizar-vinted.mjs            (sincroniza y escribe el archivo)
        node scripts/sincronizar-vinted.mjs --dry-run  (no escribe, solo informa) */

import { readFile, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ID = '3190974402';
const PERFIL = 'https://www.vinted.es/member/' + ID;
const BASE = 'https://www.vinted.es';
const ARCHIVO = new URL('../data/productos.json', import.meta.url);
const DIAS_VENDIDAS = 45;          /* una prenda vendida se sigue viendo este tiempo */
const MAX_DESCRIPCIONES = +(process.env.JCV_MAX_DESCRIPCIONES || 12);      /* descripciones nuevas que se leen por ejecucion */
const ESPERA_MS = 2000;            /* pausa entre lecturas de ficha, para no agobiar a Vinted */
const SECO = process.argv.includes('--dry-run');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Categorias (mismas reglas que js/categorias.js) ---------- */
const REGLAS = [
  ['Chaquetas y abrigos', /chaquet|cazador|abrigo|blazer|americana|chaleco|bomber|parka|gabardina|anorak|plum[ií]fero|trench|jacket|coat/i],
  ['Jerséis y sudaderas', /jers[eé]|jersei|sudadera|c[aá]rdigan|rebeca|punto|hoodie|polar|sweat|knit/i],
  ['Camisas y camisetas', /camis|blusa|\btop\b|polo|t-?shirt|body|shirt/i],
  ['Pantalones', /pantal|vaquer|jeans?\b|chino|short|bermuda|legging|mallas|peto|cargo/i],
  ['Vestidos y faldas', /vestido|falda|\bmono\b|dress|skirt/i],
  ['Calzado', /zapat|bota|bot[ií]n|sandalia|deportiva|mocas[ií]n|sneaker|shoes?\b/i],
  ['Accesorios', /bolso|gorr|bufanda|cintur[oó]n|gafas|cartera|mochila|pa[nñ]uelo|sombrero|bag\b|cap\b/i]
];
const categoria = (t) => (REGLAS.find((r) => r[1].test(t || '')) || ['Otras prendas'])[0];

/* ---------- Peticiones con curl (fetch de Node lo bloquea Cloudflare) ---------- */
const TARRO = join(tmpdir(), 'jcv-vinted-cookies.txt');

function curl(url, { json = true, intentos = 4 } = {}) {
  const args = [
    '-sS', '--compressed', '--max-time', '60',
    '-c', TARRO, '-b', TARRO,
    '-A', UA,
    '-H', 'accept-language: es-ES,es;q=0.9',
    '-H', 'accept: ' + (json ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml'),
    '-H', 'referer: ' + BASE + '/member/' + ID,
    '-w', '\n@@HTTP@@%{http_code}',
    url
  ];
  return new Promise((resolve, reject) => {
    execFile('curl', args, { maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }, async (err, salida) => {
      if (err && !salida) {
        if (intentos > 1) { await dormir(3000); return curl(url, { json, intentos: intentos - 1 }).then(resolve, reject); }
        return reject(new Error('curl ha fallado: ' + err.message));
      }
      const corte = salida.lastIndexOf('\n@@HTTP@@');
      const codigo = corte === -1 ? 0 : parseInt(salida.slice(corte + 9), 10);
      const cuerpo = corte === -1 ? salida : salida.slice(0, corte);
      if ((codigo === 429 || codigo >= 500 || codigo === 403) && intentos > 1) {
        await dormir(15000 * (4 - intentos));
        return curl(url, { json, intentos: intentos - 1 }).then(resolve, reject);
      }
      resolve({ codigo, cuerpo });
    });
  });
}

/* ---------- Sesion anonima en Vinted ---------- */
async function sesion() {
  await rm(TARRO, { force: true });
  const { codigo } = await curl(BASE + '/', { json: false, intentos: 5 });
  if (codigo !== 200) throw new Error('Vinted no deja abrir la portada (HTTP ' + codigo + ')');
}

/* ---------- Leer el armario ---------- */
async function armario() {
  const todas = [];
  for (let n = 1; n <= 30; n++) {
    const url = BASE + '/api/v2/wardrobe/' + ID + '/items?page=' + n + '&per_page=96&order=newest_first';
    const { codigo, cuerpo } = await curl(url);
    if (codigo !== 200) throw new Error('Vinted ha respondido ' + codigo + ' al leer el armario (página ' + n + ')');
    let j;
    try { j = JSON.parse(cuerpo); } catch { throw new Error('Vinted no ha devuelto JSON al leer el armario'); }
    const items = j.items || [];
    todas.push(...items);
    const total = (j.pagination && j.pagination.total_pages) || 1;
    if (n >= total || !items.length) break;
    await dormir(800);
  }
  return todas;
}

/* ---------- Descripcion desde la ficha publica ---------- */
async function descripcion(url) {
  const { codigo, cuerpo } = await curl(url, { json: false, intentos: 2 });
  if (codigo !== 200) return '';
  for (const m of cuerpo.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      if (d && d['@type'] === 'Product' && d.description) return String(d.description).trim();
    } catch { /* siguiente */ }
  }
  return '';
}

/* ---------- Normalizar ---------- */
function normalizar(it) {
  const p = it.price || {};
  const precio = parseFloat(p.amount != null ? p.amount : p) || 0;
  let url = it.url || it.path || '/items/' + it.id;
  if (!/^https?:/.test(url)) url = BASE + url;
  const vendida = !!(it.is_closed || it.is_sold || it.item_closing_action === 'sold');
  const fotos = (it.photos && it.photos.length ? it.photos : it.photo ? [it.photo] : [])
    .map((f) => f.full_size_url || f.url)
    .filter((u) => typeof u === 'string' && /^https:\/\//.test(u))
    .slice(0, 8);
  return {
    id: String(it.id),
    titulo: String(it.title || '').trim(),
    marca: it.brand_title || (it.brand && it.brand.title) || (typeof it.brand === 'string' ? it.brand : '') || '',
    talla: it.size_title || (typeof it.size === 'string' ? it.size : '') || '',
    estado: it.status || '',
    precio,
    moneda: p.currency_code || it.currency || 'EUR',
    fotos,
    url: /^https:\/\/([a-z0-9-]+\.)*vinted\.[a-z.]+\//i.test(url) ? url : PERFIL,
    estado_venta: vendida ? 'vendida' : it.is_reserved ? 'reservada' : 'disponible',
    oculta: !!(it.is_hidden || it.is_draft),
    publicado: it.created_at_ts || null
  };
}

const fecha = (v) => {
  if (v == null || v === '') return null;
  const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return isNaN(d) ? null : d.toISOString();
};

/* ---------- Fusionar con lo publicado (misma logica que la pagina de sincronizar) ---------- */
function fusionar(previo, leidos, ahora) {
  const antes = new Map();
  if (previo && previo.fuente !== 'demo') for (const p of previo.productos || []) antes.set(String(p.id), p);
  const vistos = new Set();
  const lista = [];
  const r = { nuevas: 0, vendidas: 0, cambios: 0 };

  for (const it of leidos) {
    if (!it || !it.id || !it.titulo) continue;
    vistos.add(it.id);
    if (it.oculta) continue;
    const a = antes.get(it.id);
    const p = {
      id: it.id, titulo: it.titulo, marca: it.marca, talla: it.talla, estado: it.estado,
      precio: it.precio, moneda: it.moneda,
      descripcion: it.descripcion != null ? it.descripcion : (a && a.descripcion) || '',
      fotos: it.fotos.length ? it.fotos : (a && a.fotos) || [],
      url: it.url,
      estado_venta: it.estado_venta,
      categoria: categoria(it.titulo),
      publicado: fecha(it.publicado) || (a && a.publicado) || ahora,
      vendido_en: null
    };
    if (p.estado_venta === 'vendida') {
      p.vendido_en = (a && a.vendido_en) || ahora;
      if (!a || a.estado_venta !== 'vendida') r.vendidas++;
    }
    if (!a) { if (p.estado_venta !== 'vendida') r.nuevas++; }
    else if (a.precio !== p.precio || (a.estado_venta !== p.estado_venta && p.estado_venta !== 'vendida')) r.cambios++;
    lista.push(p);
  }

  /* lo que estaba publicado y ya no aparece en Vinted se da por vendido */
  for (const [id, a] of antes) {
    if (vistos.has(id)) continue;
    if (a.estado_venta !== 'vendida') { lista.push({ ...a, estado_venta: 'vendida', vendido_en: ahora }); r.vendidas++; }
    else lista.push(a);
  }

  const limite = Date.now() - DIAS_VENDIDAS * 864e5;
  const final = lista.filter((p) => p.estado_venta !== 'vendida' || !p.vendido_en || new Date(p.vendido_en).getTime() > limite);
  const disponibles = final.filter((p) => p.estado_venta !== 'vendida').length;
  return { datos: { version: 1, fuente: 'vinted', actualizado: ahora, perfil: PERFIL, productos: final }, resumen: { ...r, disponibles, total: final.length } };
}

/* ---------- Principal ---------- */
try {
  let previo = null;
  try { previo = JSON.parse(await readFile(ARCHIVO, 'utf8')); } catch { /* primera vez */ }

  await sesion();
  const crudo = await armario();
  if (!crudo.length) throw new Error('El armario ha venido vacío; no se toca la web por si acaso');
  console.log('Armario leído: ' + crudo.length + ' prendas');

  const leidos = crudo.map(normalizar);

  /* descripciones solo de las prendas que aun no tienen una guardada */
  const guardadas = new Map(((previo && previo.productos) || []).map((p) => [String(p.id), p.descripcion || '']));
  const faltan = leidos.filter((it) => !it.oculta && !guardadas.get(it.id));
  let leidasDesc = 0;
  for (const it of faltan.slice(0, MAX_DESCRIPCIONES)) {
    try {
      const d = await descripcion(it.url);
      if (d) { it.descripcion = d; leidasDesc++; }
    } catch { /* se queda sin descripcion hasta la proxima */ }
    await dormir(ESPERA_MS);
  }
  if (faltan.length) console.log('Descripciones nuevas: ' + leidasDesc + ' de ' + faltan.length + ' pendientes');

  const ahora = new Date().toISOString();
  const { datos, resumen } = fusionar(previo, leidos, ahora);
  console.log('Disponibles: ' + resumen.disponibles + ' | nuevas: ' + resumen.nuevas + ' | pasan a vendidas: ' + resumen.vendidas + ' | con cambios: ' + resumen.cambios);

  if (SECO) { console.log('--dry-run: no se escribe nada'); process.exit(0); }

  /* se escribe con 'actualizado' del archivo anterior para comparar solo el contenido real */
  const nuevoTexto = JSON.stringify(datos, null, 1) + '\n';
  const comparable = (o) => o && JSON.stringify({ ...o, actualizado: '' });
  if (previo && comparable(previo) === comparable(datos)) {
    console.log('Sin cambios respecto a la web: no se escribe');
    process.exit(0);
  }
  await writeFile(ARCHIVO, nuevoTexto);
  console.log('data/productos.json actualizado');
} catch (e) {
  console.error('Error: ' + (e && e.message ? e.message : e));
  process.exit(1);
}
