/* Genera las paginas estaticas de cada prenda, el sitemap y los datos estructurados del inicio.
   Lo llama scripts/sincronizar-vinted.mjs despues de leer el armario. */

import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const SITIO = 'https://justcreamvintage.es';
const MARCA = 'Just Cream Vintage';
const PERFIL = 'https://www.vinted.es/member/3190974402';

export const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* El mismo slug lo guarda productos.json, asi la web y estas paginas apuntan al mismo sitio */
export function slug(titulo, id) {
  const base = String(titulo || 'prenda')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
  return (base || 'prenda') + '-' + id;
}


/* Los titulos vienen de Vinted en ingles. Para que la pagina diga en espanol lo que es, se deduce
   el tipo de prenda del titulo y se arma un resumen propio: eso es lo que busca la gente aqui. */
const TIPOS = [
  [/hoodie|sudadera con capucha/i, 'Sudadera con capucha'],
  [/sweatshirt|crewneck|sudadera/i, 'Sudadera'],
  [/cardigan|c[aá]rdigan|rebeca/i, 'Cárdigan'],
  [/fleece|polar/i, 'Forro polar'],
  [/jumper|sweater|knit|jers[eé]/i, 'Jersey'],
  [/track ?jacket|windbreaker|bomber|parka|puffer|coat|abrigo/i, 'Chaqueta'],
  [/denim jacket|cazadora vaquera/i, 'Cazadora vaquera'],
  [/blazer|americana/i, 'Blazer'],
  [/jacket|chaqueta/i, 'Chaqueta'],
  [/gilet|vest\b|chaleco/i, 'Chaleco'],
  [/polo shirt|\bpolo\b/i, 'Polo'],
  [/t-?shirt|tee\b|camiseta/i, 'Camiseta'],
  [/shirt|camisa|blusa/i, 'Camisa'],
  [/track ?pants|joggers|jogger|sweatpants|chandal|ch[aá]ndal/i, 'Pantalón de chándal'],
  [/jeans|denim pants|vaquer/i, 'Vaqueros'],
  [/shorts|bermuda/i, 'Pantalón corto'],
  [/trousers|pants|chino|pantal/i, 'Pantalón'],
  [/dress|vestido/i, 'Vestido'],
  [/skirt|falda/i, 'Falda'],
  [/sneakers|trainers|shoes|zapat|bota/i, 'Zapatillas'],
  [/\bbag\b|backpack|bolso|mochila/i, 'Bolso'],
  [/\bcap\b|\bhat\b|beanie|gorr/i, 'Gorra'],
  [/scarf|bufanda/i, 'Bufanda'],
  [/belt|cintur[oó]n/i, 'Cinturón']
];
const POR_CATEGORIA = {
  'Chaquetas y abrigos': 'Chaqueta', 'Jerséis y sudaderas': 'Sudadera', 'Camisas y camisetas': 'Camiseta',
  'Pantalones': 'Pantalón', 'Vestidos y faldas': 'Vestido', 'Calzado': 'Calzado', 'Accesorios': 'Accesorio'
};
export function tipoEs(p) {
  const t = p.titulo || '';
  for (const [re, nombre] of TIPOS) if (re.test(t)) return nombre;
  return POR_CATEGORIA[p.categoria] || 'Prenda';
}
/* "Sudadera Puma vintage, talla M" */
export function nombreEs(p) {
  const marca = p.marca && !/^sin marca$/i.test(p.marca) ? ' ' + p.marca : '';
  const talla = p.talla ? ', talla ' + p.talla : '';
  return tipoEs(p) + marca + ' vintage' + talla;
}
const ESTADOS = {
  'muy bueno': 'muy buen estado', 'bueno': 'buen estado', 'satisfactorio': 'estado satisfactorio',
  'nuevo con etiquetas': 'estado nuevo, con etiquetas', 'nuevo sin etiquetas': 'estado nuevo, sin etiquetas'
};
export function resumenEs(p) {
  const bruto = String(p.estado || '').trim().toLowerCase();
  const estado = ESTADOS[bruto] || (bruto ? 'estado ' + bruto : 'buen estado');
  const vendida = p.estado_venta === 'vendida';
  return nombreEs(p) + ', en ' + estado + '. Prenda de segunda mano elegida a mano y revisada una a una. '
    + (vendida ? 'Esta pieza ya está vendida; hay más en la colección.' : 'Compra en Vinted con envío a toda España y protección al comprador.');
}

const euros = (n, m) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: m || 'EUR' }).format(n || 0);

const recorta = (t, n) => {
  const limpio = String(t || '').replace(/\s+/g, ' ').trim();
  return limpio.length <= n ? limpio : limpio.slice(0, n - 1).replace(/\s\S*$/, '') + '…';
};

const CABEZA = (p) => {
  const titulo = recorta(nombreEs(p), 60);
  const desc = recorta(resumenEs(p) + ' ' + euros(p.precio, p.moneda) + '.', 158);
  const url = SITIO + '/prenda/' + p.slug + '.html';
  const foto = (p.fotos && p.fotos[0]) || SITIO + '/img/og.png';
  const vendida = p.estado_venta === 'vendida';

  const datos = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.titulo,
    description: recorta(p.descripcion || titulo, 900),
    image: (p.fotos || []).slice(0, 6),
    sku: String(p.id),
    url,
    itemCondition: 'https://schema.org/UsedCondition',
    category: p.categoria || 'Ropa vintage',
    brand: { '@type': 'Brand', name: p.marca || 'Sin marca' },
    offers: {
      '@type': 'Offer',
      url: p.url,
      priceCurrency: p.moneda || 'EUR',
      price: Number(p.precio || 0).toFixed(2),
      availability: vendida ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      seller: { '@type': 'Organization', name: MARCA, url: SITIO }
    }
  };
  if (p.talla) datos.size = p.talla;

  const miga = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: 'Colección', item: SITIO + '/#coleccion' },
      { '@type': 'ListItem', position: 3, name: p.titulo }
    ]
  };

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)} de segunda mano | ${MARCA}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="#1f0809">
<meta property="og:type" content="product">
<meta property="og:site_name" content="${MARCA}">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="${esc(titulo)} de segunda mano | ${MARCA}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(foto)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titulo)} de segunda mano | ${MARCA}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(foto)}">
<link rel="icon" href="../img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yellowtail&family=Graduate&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&display=swap">
<link rel="stylesheet" href="../css/prenda.css">
<script type="application/ld+json">${JSON.stringify(datos)}</script>
<script type="application/ld+json">${JSON.stringify(miga)}</script>
</head>`;
};

function paginaPrenda(p, relacionadas) {
  const vendida = p.estado_venta === 'vendida';
  const reservada = p.estado_venta === 'reservada';
  const fotos = (p.fotos || []).slice(0, 8);
  const principal = fotos[0] || '';

  const galeria = fotos.length
    ? `<figure class="p-foto"><img src="${esc(principal)}" alt="${esc(p.titulo)}" width="800" height="1000" fetchpriority="high"></figure>` +
      (fotos.length > 1
        ? `<ul class="p-minis">${fotos.slice(1).map((f, i) =>
            `<li><img src="${esc(f)}" alt="${esc(p.titulo)}, detalle ${i + 2}" width="400" height="500" loading="lazy"></li>`).join('')}</ul>`
        : '')
    : '';

  const otras = relacionadas.length
    ? `<section class="p-mas">
      <h2>Más prendas de la colección</h2>
      <ul class="p-rejilla">${relacionadas.map((o) => `<li>
        <a href="${esc(o.slug)}.html">
          ${o.fotos && o.fotos[0] ? `<img src="${esc(o.fotos[0])}" alt="${esc(o.titulo)}" width="300" height="375" loading="lazy">` : ''}
          <span class="p-rejilla__t">${esc(recorta(o.titulo, 60))}</span>
          <span class="p-rejilla__p">${esc(euros(o.precio, o.moneda))}</span>
        </a></li>`).join('')}</ul>
    </section>`
    : '';

  return `${CABEZA(p)}
<body>
<header class="p-cabecera">
  <a class="p-logo" href="../">${MARCA}</a>
  <nav><a href="../#coleccion">La colección</a> <a href="../#match">Tu match</a></nav>
</header>

<main class="p-ficha">
  <nav class="p-miga" aria-label="Dónde estás"><a href="../">Inicio</a> <span>›</span> <a href="../#coleccion">Colección</a> <span>›</span> <span>${esc(recorta(p.titulo, 45))}</span></nav>

  <div class="p-galeria">${galeria}</div>

  <div class="p-info">
    ${p.marca ? `<p class="p-marca">${esc(p.marca)}</p>` : ''}
    <h1>${esc(p.titulo)}</h1>
    <p class="p-resumen">${esc(resumenEs(p))}</p>
    <p class="p-precio">${esc(euros(p.precio, p.moneda))}${vendida ? ' <span class="p-sello">Vendida</span>' : reservada ? ' <span class="p-sello p-sello--res">Reservada</span>' : ''}</p>

    <table class="p-datos">
      <tbody>
        <tr><th scope="row">Marca</th><td>${esc(p.marca || 'Sin marca')}</td></tr>
        <tr><th scope="row">Talla</th><td>${esc(p.talla || 'Única')}</td></tr>
        <tr><th scope="row">Estado</th><td>${esc(p.estado || 'Buen estado')}</td></tr>
        <tr><th scope="row">Tipo</th><td>${esc(p.categoria || 'Ropa vintage')}</td></tr>
      </tbody>
    </table>

    ${p.descripcion ? `<div class="p-desc"><h2>Descripción</h2><p>${esc(p.descripcion)}</p></div>` : ''}

    ${vendida
      ? `<p class="p-nota">Esta prenda ya tiene nueva dueña o dueño. <a href="../#coleccion">Mira el resto de la colección</a>.</p>`
      : `<p><a class="p-boton" href="${esc(p.url)}" target="_blank" rel="noopener">Comprar en Vinted</a></p>
         <p class="p-nota">El pago y el envío se hacen en Vinted, con su protección al comprador.</p>`}

    <div class="p-sobre">
      <h2>Cómo elegimos esta prenda</h2>
      <p>En ${MARCA} cada prenda vintage se elige una a una y se revisa antes de publicarla: costuras, cremalleras, botones y tejido. Las fotos son reales y cualquier detalle de uso está escrito en la descripción. Piezas únicas de segunda mano, con envío a toda España desde Vinted.</p>
    </div>
  </div>
</main>

${otras}

<footer class="p-pie">
  <p><a href="${PERFIL}" target="_blank" rel="noopener">Nos vemos en Vinted</a></p>
  <p>${MARCA}. Ropa vintage y de segunda mano en España. <a href="../">Volver al inicio</a></p>
</footer>
</body>
</html>
`;
}

/* ---------- Sitemap ---------- */
function sitemap(datos) {
  const dia = (v) => (v ? new Date(v) : new Date()).toISOString().slice(0, 10);
  const urls = [
    `<url><loc>${SITIO}/</loc><lastmod>${dia(datos.actualizado)}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`
  ].concat(datos.productos.map((p) =>
    `<url><loc>${SITIO}/prenda/${p.slug}.html</loc><lastmod>${dia(p.vendido_en || p.publicado || datos.actualizado)}</lastmod><changefreq>weekly</changefreq><priority>${p.estado_venta === 'vendida' ? '0.3' : '0.8'}</priority></url>`
  ));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
}

/* ---------- Datos estructurados del inicio ---------- */
function listaInicio(datos) {
  const vivas = datos.productos.filter((p) => p.estado_venta !== 'vendida');
  const tienda = {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: MARCA,
    url: SITIO + '/',
    description: 'Tienda de ropa vintage y de segunda mano: prendas únicas elegidas a mano y revisadas una a una, con envío a toda España y compra protegida a través de Vinted.',
    logo: SITIO + '/img/favicon.svg',
    image: SITIO + '/img/og.png',
    areaServed: 'ES',
    currenciesAccepted: 'EUR',
    sameAs: [PERFIL]
  };
  const lista = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Colección de ropa vintage de ' + MARCA,
    numberOfItems: vivas.length,
    itemListElement: vivas.slice(0, 100).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: SITIO + '/prenda/' + p.slug + '.html',
      name: p.titulo
    }))
  };
  return '<script type="application/ld+json">' + JSON.stringify(tienda) + '</script>\n  '
       + '<script type="application/ld+json">' + JSON.stringify(lista) + '</script>';
}

/* ---------- Principal ---------- */
export async function generar(datos, raiz) {
  const dirPrendas = join(raiz, 'prenda');
  await mkdir(dirPrendas, { recursive: true });

  const vivas = datos.productos.filter((p) => p.estado_venta !== 'vendida');
  const quedan = new Set();

  for (const p of datos.productos) {
    quedan.add(p.slug + '.html');
    const relacionadas = vivas.filter((o) => o.id !== p.id)
      .sort((a, b) => (a.categoria === p.categoria ? -1 : 1))
      .slice(0, 6);
    await writeFile(join(dirPrendas, p.slug + '.html'), paginaPrenda(p, relacionadas));
  }

  /* fuera las paginas de prendas que ya no estan */
  for (const f of await readdir(dirPrendas)) {
    if (f.endsWith('.html') && !quedan.has(f)) await rm(join(dirPrendas, f), { force: true });
  }

  await writeFile(join(raiz, 'sitemap.xml'), sitemap(datos));

  /* los datos estructurados del inicio van entre marcas dentro de index.html */
  const rutaIndex = join(raiz, 'index.html');
  let html = await readFile(rutaIndex, 'utf8');
  const ini = '<!-- datos:inicio -->', fin = '<!-- /datos:inicio -->';
  if (html.includes(ini) && html.includes(fin)) {
    const a = html.indexOf(ini) + ini.length, b = html.indexOf(fin);
    const nuevo = '\n  ' + listaInicio(datos) + '\n  ';
    if (html.slice(a, b) !== nuevo) await writeFile(rutaIndex, html.slice(0, a) + nuevo + html.slice(b));
  }

  return { paginas: datos.productos.length };
}
