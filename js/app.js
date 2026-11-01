/* Just Cream Vintage: movimiento, cursor y catalogo */
(function () {
  'use strict';

  var doc = document.documentElement;
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var punteroFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hayGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var PERFIL = 'https://www.vinted.es/member/3190974402';
  var DATOS = 'data/productos.json';
  var RECARGA_MS = 5 * 60 * 1000;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ---------- Utilidades compartidas con match.js ---------- */
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var euros = function (n, moneda) {
    try { return new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda || 'EUR', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n); }
    catch (e) { return n + ' €'; }
  };
  var categoriaDe = function (p) { return p.categoria || (window.JCVcategoria ? window.JCVcategoria(p.titulo) : 'Otras prendas'); };
  var urlSegura = function (u) { return /^https:\/\/([a-z0-9-]+\.)*vinted\.[a-z.]+\//i.test(u || '') ? u : PERFIL; };
  var fotoSegura = function (u) { return /^(https:\/\/|img\/)/i.test(u || '') ? u : ''; };
  var fotos = function (p) { return (p.fotos || []).map(fotoSegura).filter(Boolean); };

  var oyentes = [];
  var matches = {
    lista: function () { try { var l = JSON.parse(localStorage.getItem('jcv-matches') || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return memoria; } },
    tiene: function (id) { return matches.lista().indexOf(String(id)) !== -1; },
    poner: function (id, si) {
      var l = matches.lista().filter(function (x) { return x !== String(id); });
      if (si) l.unshift(String(id));
      memoria = l;
      try { localStorage.setItem('jcv-matches', JSON.stringify(l.slice(0, 60))); } catch (e) { /* solo en memoria */ }
      oyentes.forEach(function (f) { f('matches'); });
    }
  };
  var memoria = [];
  window.JCV = {
    esc: esc, euros: euros, fotos: fotos, urlSegura: urlSegura, categoriaDe: categoriaDe, reducido: reducido,
    productos: [], matches: matches,
    alCambiar: function (f) { oyentes.push(f); },
    abrirFicha: function (p) { abrirFicha(p); }
  };

  /* ---------- Scroll suave ---------- */
  var lenis = null;
  if (!reducido && typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    if (hayGsap) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      (function bucle(t) { lenis.raf(t); requestAnimationFrame(bucle); })(0);
    }
  }
  window.JCV.lenis = lenis;
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    var destino = id === '#arriba' ? null : $(id);
    if (id !== '#arriba' && !destino) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(destino || 0, { offset: -60, duration: 1.4 });
    else window.scrollTo({ top: destino ? destino.getBoundingClientRect().top + window.scrollY - 60 : 0, behavior: reducido ? 'auto' : 'smooth' });
  });

  /* ---------- Cabecera: se esconde al bajar y vuelve al subir ---------- */
  var cabecera = $('.cabecera'), yPrev = window.scrollY;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    cabecera.classList.toggle('oculta', y > yPrev && y > 300 && !document.querySelector('dialog[open]'));
    yPrev = y;
  }, { passive: true });

  /* ---------- Raton: un unico bucle para cursor, paralaje y sello ---------- */
  var raton = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
  var suave = { x: raton.x, y: raton.y, nx: 0, ny: 0, vx: 0, vy: 0 };
  var cursor = $('.cursor'), gota = $('.cursor__gota'), textoCursor = $('.cursor__texto');
  var lineas = $$('.hero__titulo .linea__in');
  var sello = $('.sello');
  var chispas = $$('.chispa');

  if (punteroFino && !reducido) doc.classList.add('con-cursor');

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    raton.x = e.clientX; raton.y = e.clientY;
    raton.nx = e.clientX / innerWidth * 2 - 1;
    raton.ny = e.clientY / innerHeight * 2 - 1;
    cursor.classList.remove('fuera');
  }, { passive: true });
  document.addEventListener('pointerleave', function () { cursor.classList.add('fuera'); });

  /* Que hay debajo del raton se mira sobre el sitio, no con pointerover/pointerout: asi el cursor
     nunca se queda colgado cuando el elemento desaparece (cambio de prenda, cierre de la ficha,
     recarga de la coleccion, carta deslizada) ni cuando la pagina se mueve bajo un raton quieto. */
  var SELECTOR_ACTIVO = '[data-cursor], a, button, select, label, .carta[data-pos="0"]';
  var activoAnterior = null;
  function mirarDebajo() {
    var bajo = document.elementFromPoint(raton.x, raton.y);
    var el = bajo && bajo.closest ? bajo.closest(SELECTOR_ACTIVO) : null;
    if (el === activoAnterior) return;
    activoAnterior = el;
    var t = el ? (el.getAttribute('data-cursor') || (el.classList.contains('carta') ? 'Desliza' : '')) : '';
    textoCursor.textContent = t;
    cursor.classList.toggle('con-texto', !!t);
    cursor.classList.toggle('activo', !!el && !t);
  }

  /* Un dialogo modal se pinta en la capa superior del navegador, por encima de todo lo demas pase lo
     que pase con el z-index. Si el cursor se queda en el body, dentro de la ficha no se ve nada: ni el
     nuestro ni el del sistema, porque lo hemos ocultado. Asi que el cursor se muda al dialogo. */
  function cursorDentroDe(destino) {
    if (destino && cursor.parentNode !== destino) destino.appendChild(cursor);
  }
  window.JCV.cursorDentroDe = cursorDentroDe;

  /* El cursor se esconde al salir de la ventana. Ojo: aqui no vale pointerout, porque el navegador
     tambien lo dispara sin relatedTarget cuando desaparece el elemento que habia debajo. */
  window.addEventListener('blur', function () { cursor.classList.add('fuera'); });
  doc.addEventListener('mouseleave', function () { cursor.classList.add('fuera'); });
  doc.addEventListener('mouseenter', function () { cursor.classList.remove('fuera'); });

  /* Botones magneticos */
  if (!reducido && punteroFino) {
    $$('.magnetico').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.setProperty('--bx', ((e.clientX - (r.left + r.width / 2)) * 0.25).toFixed(1) + 'px');
        b.style.setProperty('--by', ((e.clientY - (r.top + r.height / 2)) * 0.35).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', function () { b.style.setProperty('--bx', '0px'); b.style.setProperty('--by', '0px'); });
    });
  }

  var heroVisible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; }).observe($('.hero'));

  var tiempo0 = performance.now();
  var ultimoVistazo = 0;
  function fotograma(ahora) {
    var px = suave.x, py = suave.y;
    /* 0.45: el cursor va casi pegado al raton. Con valores bajos arrastra y marea, porque el
       cursor del sistema esta oculto y la gota es la unica referencia que tiene la mano. */
    suave.x = lerp(suave.x, raton.x, 0.45);
    suave.y = lerp(suave.y, raton.y, 0.45);
    suave.vx = lerp(suave.vx, suave.x - px, 0.25);
    suave.vy = lerp(suave.vy, suave.y - py, 0.25);
    suave.nx = lerp(suave.nx, raton.nx, 0.1);
    suave.ny = lerp(suave.ny, raton.ny, 0.1);

    if (doc.classList.contains('con-cursor')) {
      if (ahora - ultimoVistazo > 80) { ultimoVistazo = ahora; mirarDebajo(); }
      /* la gota se estira en la direccion del movimiento */
      var v = Math.min(Math.hypot(suave.vx, suave.vy) / 75, 0.2);
      var ang = Math.atan2(suave.vy, suave.vx) * 180 / Math.PI;
      gota.style.transform = 'translate(' + suave.x.toFixed(1) + 'px,' + suave.y.toFixed(1) + 'px) rotate(' + ang.toFixed(1) + 'deg) scale(' + (1 + v).toFixed(3) + ',' + (1 - v * 0.5).toFixed(3) + ')';
      textoCursor.style.transform = 'translate(' + suave.x.toFixed(1) + 'px,' + suave.y.toFixed(1) + 'px)';
    }

    if (heroVisible && !reducido) {
      var nx = suave.nx, ny = suave.ny;
      if (!punteroFino) { var s = (ahora - tiempo0) / 1000; nx = Math.sin(s * 0.7) * 0.6; ny = Math.cos(s * 0.5) * 0.5; }
      lineas.forEach(function (l) {
        var p = +l.parentNode.getAttribute('data-prof');
        l.style.translate = (nx * -p * 0.5).toFixed(2) + 'px ' + (ny * -p * 0.25).toFixed(2) + 'px';
      });
      if (sello) {
        sello.style.setProperty('--ry', (nx * 10).toFixed(2) + 'deg');
        sello.style.setProperty('--rx', (ny * -10).toFixed(2) + 'deg');
        sello.style.setProperty('--bx', (50 + nx * 22).toFixed(1) + '%');
        sello.style.setProperty('--by', (50 + ny * 22).toFixed(1) + '%');
        sello.style.setProperty('--ox', (nx * -7).toFixed(1) + 'px');
        sello.style.setProperty('--oy', (ny * -5 + 4).toFixed(1) + 'px');
      }
      chispas.forEach(function (c, i) {
        var f = (i + 1) * 6;
        c.style.translate = (nx * f).toFixed(1) + 'px ' + (ny * f).toFixed(1) + 'px';
      });
    }
    requestAnimationFrame(fotograma);
  }
  requestAnimationFrame(fotograma);

  /* ---------- Cinta: velocidad segun el scroll ---------- */
  var pista = $('.cinta__pista');
  if (pista && !reducido) {
    var x = 0, ultimoY = window.scrollY, dir = 1, vel = 0;
    (function mover() {
      var y = window.scrollY, d = y - ultimoY; ultimoY = y;
      if (Math.abs(d) > 0.5) dir = d > 0 ? 1 : -1;
      vel = lerp(vel, Math.min(Math.abs(d), 60), 0.1);
      x -= (0.7 + vel * 0.4) * dir;
      var mitad = pista.scrollWidth / 2;
      if (x <= -mitad) x += mitad;
      if (x > 0) x -= mitad;
      pista.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      requestAnimationFrame(mover);
    })();
  }

  /* ---------- Diamante: estado final sin animacion ---------- */
  var camino = $('.diamante__progreso'), pelota = $('.pelota'), basesSvg = $$('.diamante__base'), basesTxt = $$('.base');
  var largo = camino ? camino.getTotalLength() : 0;
  if (camino) { camino.style.strokeDasharray = largo; camino.style.strokeDashoffset = largo; }
  function diamante(p) {
    if (!camino) return;
    camino.style.strokeDashoffset = (largo * (1 - p)).toFixed(1);
    var pt = camino.getPointAtLength(largo * Math.min(p, 0.9999));
    pelota.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ') rotate(' + (p * 720).toFixed(0) + ')');
    var n = Math.floor(p * 4 + 0.02);
    basesSvg.forEach(function (b, i) { b.classList.toggle('activa', i < n); });
    basesTxt.forEach(function (b, i) { b.classList.toggle('activa', i === Math.min(n, 3) || (p > 0.98 && i === 3)); });
  }

  /* ---------- GSAP: entrada y escenas de scroll ---------- */
  if (hayGsap && !reducido) {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);

    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .from('.hero__sello .sello', { scale: 0, rotate: -200, duration: 1.6, ease: 'back.out(1.6)' })
      .from('.chispa', { scale: 0, duration: 1, stagger: 0.12, ease: 'back.out(3)' }, 0.5)
      .from('.hero__titulo .linea__in', { yPercent: 115, duration: 1.3, stagger: 0.12 }, 0.35)
      .from('.hero__lema, .hero__botones', { y: 24, opacity: 0, duration: 1, stagger: 0.1 }, 0.8);

    gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } })
      .to('.hero__sello', { yPercent: -25, rotate: 90, scale: 0.7 }, 0)
      .to('.hero__titulo .linea:nth-child(1)', { xPercent: -18 }, 0)
      .to('.hero__titulo .linea:nth-child(2)', { xPercent: 16 }, 0)
      .to('.hero__lema, .hero__botones', { y: -40, opacity: 0 }, 0);

    var mm = gsap.matchMedia();
    mm.add('(min-width: 861px)', function () {
      var seccion = $('.proceso');
      var pasos = $$('.paso');
      seccion.classList.add('js-pin');
      var activar = function (i) { pasos.forEach(function (p, j) { p.classList.toggle('activo', j === i); }); };
      activar(0);
      gsap.set('.estampa', { scale: 3, opacity: 0 });

      var tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: seccion, pin: '.proceso__fijo', start: 'top top', end: '+=320%', scrub: 0.8,
          onUpdate: function (s) { activar(Math.min(3, Math.floor(s.progress * 4.0001))); }
        }
      });
      tl.fromTo('.prenda', { rotate: -5, y: 30 }, { rotate: 2, y: 0, duration: 1 }, 0)
        .to('.prenda__revision', { opacity: 1, duration: 0.1 }, 1)
        .fromTo('.prenda__revision', { top: '0%' }, { top: '100%', duration: 0.9 }, 1)
        .to('.prenda__revision', { opacity: 0, duration: 0.1 }, 1.9)
        .to('.prenda__flash', { opacity: 1, duration: 0.08 }, 2.3)
        .to('.prenda__flash', { opacity: 0, duration: 0.5 }, 2.38)
        .to('.estampa', { scale: 1, opacity: 1, ease: 'power4.in', duration: 0.45 }, 3.05)
        .fromTo('.prenda', { x: 0 }, { x: 7, duration: 0.04, repeat: 3, yoyo: true }, 3.5)
        .to({}, { duration: 0.45 });

      return function () { seccion.classList.remove('js-pin'); pasos.forEach(function (p) { p.classList.remove('activo'); }); gsap.set('.estampa', { clearProps: 'all' }); };
    });

    ST.create({ trigger: '.comprar', start: 'top 70%', end: 'bottom 60%', scrub: 0.6, onUpdate: function (s) { diamante(s.progress); } });
    diamante(0);
  } else {
    diamante(1);
  }

  /* ---------- Catalogo ---------- */
  var estado = { cat: 'Todas', verVendidas: true, orden: 'nuevo', firma: '' };
  var rejilla = $('#rejilla'), vacio = $('#vacio'), estadoSync = $('#estado-sync'), filtroCats = $('#filtro-cats');
  var chkVendidas = $('#ver-vendidas'), selOrden = $('#orden');

  try {
    var guardado = JSON.parse(localStorage.getItem('jcv-filtros') || '{}');
    if (typeof guardado.verVendidas === 'boolean') estado.verVendidas = guardado.verVendidas;
    if (guardado.orden) estado.orden = guardado.orden;
  } catch (e) { /* sin almacenamiento */ }
  chkVendidas.checked = estado.verVendidas;
  selOrden.value = estado.orden;
  function guardarFiltros() { try { localStorage.setItem('jcv-filtros', JSON.stringify({ verVendidas: estado.verVendidas, orden: estado.orden })); } catch (e) { /* nada */ } }

  function cuando(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var seg = (Date.now() - d.getTime()) / 1000;
    var rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    if (seg < 60) return 'hace un momento';
    if (seg < 3600) return rtf.format(-Math.round(seg / 60), 'minute');
    if (seg < 86400) return rtf.format(-Math.round(seg / 3600), 'hour');
    return rtf.format(-Math.round(seg / 86400), 'day');
  }

  function cargar(primera) {
    return fetch(DATOS + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var lista = (d.productos || []).filter(function (p) { return p && p.id && p.titulo && !p.oculta; });
        lista.forEach(function (p) { p.id = String(p.id); p.precio = +p.precio || 0; });
        var firma = JSON.stringify(lista.map(function (p) { return [p.id, p.estado_venta, p.precio]; }));
        $('#aviso-demo').hidden = d.fuente !== 'demo';
        var disp = lista.filter(function (p) { return p.estado_venta !== 'vendida'; }).length;
        /* el recuento y la hora de sincronizacion no se ensenan: la linea solo aparece si algo falla */
        estadoSync.textContent = '';
        estadoSync.hidden = true;
        if (firma === estado.firma) return;
        estado.firma = firma;
        window.JCV.productos = lista;
        pintarCategorias();
        pintar(!primera);
        oyentes.forEach(function (f) { f('productos'); });
      })
      .catch(function () {
        if (!primera) return;
        estadoSync.textContent = 'No se ha podido cargar la colección. Puedes ver todas las prendas en Vinted.';
        estadoSync.hidden = false;
        rejilla.innerHTML = '';
        vacio.hidden = false;
        vacio.querySelector('p').innerHTML = 'La colección no se ha cargado. <a href="' + PERFIL + '" target="_blank" rel="noopener">Abrir el perfil en Vinted</a>.';
        $('#limpiar').hidden = true;
      });
  }

  function pintarCategorias() {
    var cuenta = {};
    window.JCV.productos.forEach(function (p) { if (estado.verVendidas || p.estado_venta !== 'vendida') { var c = categoriaDe(p); cuenta[c] = (cuenta[c] || 0) + 1; } });
    var cats = Object.keys(cuenta).sort();
    if (estado.cat !== 'Todas' && !cuenta[estado.cat]) estado.cat = 'Todas';
    var total = cats.reduce(function (s, c) { return s + cuenta[c]; }, 0);
    filtroCats.innerHTML = ['Todas'].concat(cats).map(function (c) {
      return '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (c === estado.cat) + '">' + esc(c) + '<small>' + (c === 'Todas' ? total : cuenta[c]) + '</small></button>';
    }).join('');
  }

  function visibles() {
    var l = window.JCV.productos.filter(function (p) {
      if (!estado.verVendidas && p.estado_venta === 'vendida') return false;
      return estado.cat === 'Todas' || categoriaDe(p) === estado.cat;
    });
    var peso = function (p) { return p.estado_venta === 'vendida' ? 1 : 0; };
    l.sort(function (a, b) {
      if (peso(a) !== peso(b)) return peso(a) - peso(b);
      if (estado.orden === 'precio-asc') return a.precio - b.precio;
      if (estado.orden === 'precio-desc') return b.precio - a.precio;
      return new Date(b.publicado || 0) - new Date(a.publicado || 0);
    });
    return l;
  }

  function tarjeta(p, i) {
    var f = fotos(p);
    var vendida = p.estado_venta === 'vendida', reservada = p.estado_venta === 'reservada';
    var precio = euros(p.precio, p.moneda);
    var tampon = vendida ? '<span class="tampon">Vendida</span>' : reservada ? '<span class="tampon tampon--reservada">Reservada</span>' : '';
    return '<li style="--i:' + Math.min(i, 12) + '">' +
      /* enlace de verdad a la pagina de la prenda: asi la encuentran los buscadores y se puede abrir aparte */
      '<a class="tarjeta' + (vendida ? ' tarjeta--vendida' : '') + '" href="prenda/' + esc(p.slug || '') + '.html" data-id="' + esc(p.id) + '" data-cursor="' + (vendida ? 'Vendida' : 'Ver') + '" aria-label="' + esc(p.titulo + ', ' + precio + (vendida ? ', vendida' : reservada ? ', reservada' : '')) + '">' +
        '<span class="cromo">' +
          '<span class="cromo__foto">' +
            (f[0] ? '<img src="' + esc(f[0]) + '" alt="' + esc(p.titulo) + '" loading="lazy" decoding="async">' : '') +
            (f[1] ? '<img class="foto-2" src="' + esc(f[1]) + '" alt="" loading="lazy" decoding="async">' : '') +
            tampon +
          '</span>' +
          '<span class="cromo__precio"' + (precio.length > 6 ? ' style="font-size:.9rem"' : '') + '>' + esc(precio) + '</span>' +
          '<span class="cromo__banda"><span class="cromo__titulo">' + esc(p.titulo) + '</span><span class="cromo__meta">' + esc((p.marca || 'Sin marca') + ', talla ' + (p.talla || 'única')) + '</span></span>' +
        '</span>' +
      '</a></li>';
  }

  function pintar(animar) {
    var l = visibles();
    rejilla.classList.remove('entrando');
    rejilla.innerHTML = l.map(tarjeta).join('');
    vacio.hidden = l.length > 0;
    if (animar && !reducido) { void rejilla.offsetWidth; rejilla.classList.add('entrando'); }
    if (hayGsap) window.ScrollTrigger.refresh();
  }

  filtroCats.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    estado.cat = b.getAttribute('data-cat');
    $$('.chip', filtroCats).forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
    pintar(true);
  });
  chkVendidas.addEventListener('change', function () { estado.verVendidas = chkVendidas.checked; guardarFiltros(); pintarCategorias(); pintar(true); });
  selOrden.addEventListener('change', function () { estado.orden = selOrden.value; guardarFiltros(); pintar(true); });
  $('#limpiar').addEventListener('click', function () { estado.cat = 'Todas'; estado.verVendidas = true; chkVendidas.checked = true; guardarFiltros(); pintarCategorias(); pintar(true); });

  /* Inclinacion del cromo segun el cursor */
  rejilla.addEventListener('pointermove', function (e) {
    if (reducido || e.pointerType !== 'mouse') return;
    var c = e.target.closest('.cromo'); if (!c) return;
    var r = c.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    c.style.setProperty('--ry', ((px - 0.5) * 8).toFixed(2) + 'deg');
    c.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
    c.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
    c.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
  });
  rejilla.addEventListener('pointerout', function (e) {
    var c = e.target.closest('.cromo');
    if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }
  });

  /* Onda liquida en la foto al entrar el cursor */
  var mapaOnda = document.getElementById('onda-mapa'), ondaActiva = null, ondaT = 0;
  rejilla.addEventListener('pointerover', function (e) {
    if (reducido || !punteroFino || !mapaOnda) return;
    var t = e.target.closest('.tarjeta');
    if (!t || t === ondaActiva || (e.relatedTarget && t.contains(e.relatedTarget))) return;
    if (ondaActiva) ondaActiva.classList.remove('ondulando');
    ondaActiva = t; t.classList.add('ondulando');
    var inicio = performance.now(); ondaT = inicio;
    (function paso(ahora) {
      if (ondaT !== inicio) return;
      var k = Math.min((ahora - inicio) / 900, 1);
      mapaOnda.setAttribute('scale', (38 * Math.pow(1 - k, 2) * Math.cos(k * 9)).toFixed(2));
      if (k < 1) requestAnimationFrame(paso); else { t.classList.remove('ondulando'); if (ondaActiva === t) ondaActiva = null; }
    })(inicio);
  });

  /* ---------- Ficha ---------- */
  var ficha = $('#ficha'), fichaActual = null;
  function abrirFicha(p) {
    fichaActual = p;
    var f = fotos(p);
    var vendida = p.estado_venta === 'vendida', reservada = p.estado_venta === 'reservada';
    var img = $('#ficha-img');
    img.src = f[0] || ''; img.alt = p.titulo;
    $('#ficha-minis').innerHTML = f.length > 1 ? f.map(function (u, i) {
      return '<button type="button" data-src="' + esc(u) + '" aria-label="Foto ' + (i + 1) + ' de ' + f.length + '" aria-current="' + (i === 0) + '"><img src="' + esc(u) + '" alt="" loading="lazy"></button>';
    }).join('') : '';
    $('#ficha-marca').textContent = p.marca || 'Sin marca';
    $('#ficha-titulo').textContent = p.titulo;
    $('#ficha-precio').textContent = euros(p.precio, p.moneda);
    $('#ficha-barra-precio').textContent = euros(p.precio, p.moneda);
    $('#ficha-talla').textContent = p.talla || 'Única';
    $('#ficha-estadoprenda').textContent = p.estado || 'Buen estado';
    $('#ficha-cat').textContent = categoriaDe(p);
    $('#ficha-desc').textContent = p.descripcion || '';
    var boton = $('#ficha-comprar'), guardar = $('#ficha-guardar');
    boton.href = urlSegura(p.url);
    guardar.hidden = vendida;
    pintarGuardar();
    if (vendida) {
      boton.setAttribute('aria-disabled', 'true'); boton.tabIndex = -1;
      boton.querySelector('span').textContent = 'Vendida';
      $('#ficha-nota').textContent = 'Esta prenda ya tiene nueva dueña o dueño. Hay más en la colección.';
    } else {
      boton.removeAttribute('aria-disabled'); boton.removeAttribute('tabindex');
      boton.querySelector('span').textContent = reservada ? 'Ver en Vinted (reservada)' : 'Comprar en Vinted';
      $('#ficha-nota').textContent = reservada
        ? 'Alguien la tiene reservada ahora mismo. Si no se completa la compra, volverá a estar disponible.'
        : 'El pago y el envío se hacen en Vinted, con su protección al comprador.';
    }
    if (lenis) lenis.stop();
    ficha.scrollTop = 0;
    if (!ficha.open) {
      ficha.showModal();
      /* mientras dura la animacion de apertura el dialogo lleva un transform, y eso mueve el
         marco de referencia del cursor. Se tapa esos milisegundos y se muda al terminar. */
      cursor.classList.add('mudando');
      var mudar = function () {
        ficha.removeEventListener('animationend', mudar);
        clearTimeout(reloj);
        if (ficha.open) cursorDentroDe(ficha);
        cursor.classList.remove('mudando');
      };
      var reloj = setTimeout(mudar, 700);
      ficha.addEventListener('animationend', mudar);
    }
  }
  function pintarGuardar() {
    if (!fichaActual) return;
    var g = $('#ficha-guardar'), si = matches.tiene(fichaActual.id);
    g.setAttribute('aria-pressed', String(si));
    g.textContent = si ? 'Guardada en tus matches. Quitar' : 'Guardar como match';
  }
  $('#ficha-guardar').addEventListener('click', function () { if (fichaActual) { matches.poner(fichaActual.id, !matches.tiene(fichaActual.id)); pintarGuardar(); } });
  ficha.addEventListener('close', function () {
    if (lenis) lenis.start();
    fichaActual = null;
    cursor.classList.remove('mudando');
    cursorDentroDe(document.body);
  });
  $('#ficha-cerrar').addEventListener('click', function () { ficha.close(); });
  ficha.addEventListener('click', function (e) {
    if (e.target === ficha) { ficha.close(); return; }
    var b = e.target.closest('#ficha-minis button'); if (!b) return;
    $('#ficha-img').src = b.getAttribute('data-src');
    $$('#ficha-minis button').forEach(function (x) { x.setAttribute('aria-current', String(x === b)); });
  });
  rejilla.addEventListener('click', function (e) {
    var t = e.target.closest('.tarjeta'); if (!t) return;
    /* con ctrl, cmd, shift o el boton central se abre la pagina de la prenda como un enlace normal */
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var p = window.JCV.productos.find(function (x) { return x.id === t.getAttribute('data-id'); });
    if (!p) return;
    e.preventDefault();
    abrirFicha(p);
  });

  cargar(true);
  setInterval(function () { if (!document.hidden) cargar(false); }, RECARGA_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) cargar(false); });
})();
