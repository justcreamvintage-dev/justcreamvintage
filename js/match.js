/* "Encuentra tu match": baraja de prendas para deslizar como en una app de citas */
(function () {
  'use strict';
  var J = window.JCV;
  if (!J) return;
  var $ = function (s, c) { return (c || document).querySelector(s); };

  var baraja = $('#baraja'), btnSi = $('#btn-si'), btnNo = $('#btn-no');
  var cajaMatches = $('#matches'), listaMatches = $('#matches-lista');
  var aviso = $('#es-match');
  var cola = [], ocupado = false, yaCelebrado = false;
  var UMBRAL = 110;

  var vistos = (function () {
    var s = [];
    try { s = JSON.parse(sessionStorage.getItem('jcv-vistos') || '[]'); } catch (e) { /* nada */ }
    var set = new Set(Array.isArray(s) ? s : []);
    return {
      tiene: function (id) { return set.has(id); },
      poner: function (id) { set.add(id); try { sessionStorage.setItem('jcv-vistos', JSON.stringify(Array.from(set))); } catch (e) { /* nada */ } },
      vaciar: function () { set.clear(); try { sessionStorage.removeItem('jcv-vistos'); } catch (e) { /* nada */ } }
    };
  })();

  function preparar() {
    cola = J.productos.filter(function (p) {
      return p.estado_venta !== 'vendida' && !vistos.tiene(p.id) && !J.matches.tiene(p.id);
    });
    pintar();
    pintarMatches();
  }

  function carta(p, pos) {
    var f = J.fotos(p)[0] || '';
    return '<article class="carta" data-pos="' + pos + '" data-id="' + J.esc(p.id) + '"' + (pos === 0 ? ' tabindex="0" aria-label="' + J.esc(p.titulo + ', ' + J.euros(p.precio, p.moneda) + '. Pulsa para ver la ficha') + '"' : ' aria-hidden="true"') + '>' +
      '<div class="carta__foto">' + (f ? '<img src="' + J.esc(f) + '" alt="" draggable="false">' : '') + '</div>' +
      '<div class="carta__pie"><p class="carta__titulo">' + J.esc(p.titulo) + '</p><p class="carta__meta">' + J.esc('Talla ' + (p.talla || 'única') + ', ' + (p.estado || 'buen estado').toLowerCase()) + '</p><p class="carta__precio">' + J.esc(J.euros(p.precio, p.moneda)) + '</p></div>' +
      '<span class="voto voto--si" aria-hidden="true">Me gusta</span><span class="voto voto--no" aria-hidden="true">Paso</span>' +
    '</article>';
  }

  function pintar() {
    var tres = cola.slice(0, 3);
    if (!tres.length) {
      var hay = J.productos.some(function (p) { return p.estado_venta !== 'vendida'; });
      baraja.innerHTML = '<div class="baraja__fin"><p>' + (hay ? 'Ya las has visto todas' : 'Pronto habrá más prendas') + '</p>' +
        (hay ? '<button type="button" class="boton boton--crema" id="baraja-reiniciar"><span>Volver a empezar</span></button>' : '') +
        '<a class="boton" href="#coleccion"><span>Ver la colección</span></a></div>';
      btnSi.disabled = btnNo.disabled = true;
      var r = $('#baraja-reiniciar');
      if (r) r.addEventListener('click', function () { vistos.vaciar(); preparar(); });
      return;
    }
    btnSi.disabled = btnNo.disabled = false;
    baraja.innerHTML = tres.map(function (p, i) { return carta(p, i); }).reverse().join('');
    activarArrastre(baraja.querySelector('.carta[data-pos="0"]'));
  }

  function activarArrastre(el) {
    if (!el) return;
    var inicio = null, dx = 0, dy = 0, t0 = 0;
    var si = el.querySelector('.voto--si'), no = el.querySelector('.voto--no');
    function mover(x, y) {
      dx = x; dy = y;
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx * 0.07).toFixed(2) + 'deg)';
      si.style.opacity = Math.max(0, Math.min(1, dx / UMBRAL));
      no.style.opacity = Math.max(0, Math.min(1, -dx / UMBRAL));
    }
    el.addEventListener('pointerdown', function (e) {
      if (ocupado || e.button > 0) return;
      inicio = { x: e.clientX, y: e.clientY }; t0 = performance.now(); dx = dy = 0;
      el.setPointerCapture(e.pointerId);
      el.classList.add('arrastrando');
    });
    el.addEventListener('pointermove', function (e) {
      if (!inicio) return;
      mover(e.clientX - inicio.x, (e.clientY - inicio.y) * 0.4);
    });
    function soltar(e) {
      if (!inicio) return;
      inicio = null;
      el.classList.remove('arrastrando');
      var dt = Math.max(1, performance.now() - t0), vel = dx / dt;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && e.type === 'pointerup') { el.style.transform = ''; abrir(el); return; }
      if (Math.abs(dx) > UMBRAL || Math.abs(vel) > 0.6) { lanzar(dx > 0 ? 1 : -1); return; }
      el.style.transform = ''; si.style.opacity = 0; no.style.opacity = 0;
    }
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(el); } });
  }

  function abrir(el) {
    var p = J.productos.find(function (x) { return x.id === el.getAttribute('data-id'); });
    if (p) J.abrirFicha(p);
  }

  function lanzar(dir) {
    var el = baraja.querySelector('.carta[data-pos="0"]');
    if (!el || ocupado) return;
    ocupado = true;
    var id = el.getAttribute('data-id');
    var p = J.productos.find(function (x) { return x.id === id; });
    el.querySelector(dir > 0 ? '.voto--si' : '.voto--no').style.opacity = 1;
    el.style.transition = J.reducido ? 'none' : 'transform .55s cubic-bezier(.5,0,.75,0), opacity .55s';
    el.style.transform = 'translate(' + (dir * (innerWidth * 0.7 + 200)) + 'px,-60px) rotate(' + (dir * 38) + 'deg)';
    el.style.opacity = '0';
    setTimeout(function () {
      vistos.poner(id);
      if (dir > 0) J.matches.poner(id, true);
      cola = cola.filter(function (x) { return x.id !== id; });
      ocupado = false;
      pintar();
      var nueva = baraja.querySelector('.carta[data-pos="0"]');
      if (nueva && baraja.contains(document.activeElement) === false && document.activeElement === document.body) nueva.focus({ preventScroll: true });
      if (dir > 0 && p) { if (!yaCelebrado) { yaCelebrado = true; celebrar(p); } else { confeti(btnSi, 8); } }
    }, J.reducido ? 0 : 380);
  }

  btnSi.addEventListener('click', function () { lanzar(1); });
  btnNo.addEventListener('click', function () { lanzar(-1); });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (document.querySelector('dialog[open]') || !aviso.hidden) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    var r = $('#match').getBoundingClientRect();
    if (r.top > innerHeight * 0.6 || r.bottom < innerHeight * 0.4) return;
    e.preventDefault();
    lanzar(e.key === 'ArrowRight' ? 1 : -1);
  });

  /* Lista de matches guardados */
  function pintarMatches() {
    var ids = J.matches.lista();
    var prods = ids.map(function (id) { return J.productos.find(function (p) { return p.id === id; }); }).filter(Boolean);
    cajaMatches.hidden = prods.length === 0;
    listaMatches.innerHTML = prods.map(function (p) {
      var f = J.fotos(p)[0] || '';
      return '<li><button type="button" data-id="' + J.esc(p.id) + '" aria-label="' + J.esc(p.titulo + (p.estado_venta === 'vendida' ? ', vendida' : '')) + '" data-cursor="Ver">' + (f ? '<img src="' + J.esc(f) + '" alt=""' + (p.estado_venta === 'vendida' ? ' style="filter:grayscale(1)"' : '') + '>' : '') + '</button></li>';
    }).join('');
  }
  listaMatches.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var p = J.productos.find(function (x) { return x.id === b.getAttribute('data-id'); });
    if (p) J.abrirFicha(p);
  });

  /* Celebracion de match */
  var focoPrevio = null;
  function celebrar(p) {
    focoPrevio = document.activeElement;
    $('#es-match-img').src = J.fotos(p)[0] || '';
    $('#es-match-texto').textContent = p.titulo + ' por ' + J.euros(p.precio, p.moneda) + '. Te la guardamos en tus matches.';
    $('#es-match-comprar').href = J.urlSegura(p.url);
    aviso.hidden = false;
    aviso.classList.remove('entra'); void aviso.offsetWidth; aviso.classList.add('entra');
    if (J.lenis) J.lenis.stop();
    confeti(aviso.querySelector('.es-match__titulo'), 18);
    $('#es-match-comprar').focus({ preventScroll: true });
  }
  function cerrarAviso() {
    if (aviso.hidden) return;
    aviso.hidden = true;
    if (J.lenis) J.lenis.start();
    (focoPrevio && focoPrevio.focus ? focoPrevio : btnSi).focus({ preventScroll: true });
  }
  $('#es-match-seguir').addEventListener('click', cerrarAviso);
  $('#es-match-comprar').addEventListener('click', function () { setTimeout(cerrarAviso, 300); });
  aviso.addEventListener('click', function (e) { if (e.target === aviso) cerrarAviso(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarAviso(); });

  function confeti(origen, n) {
    if (J.reducido || !origen || !Element.prototype.animate) return;
    var r = origen.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var i = 0; i < n; i++) {
      var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '-60 -60 120 120'); s.setAttribute('class', 'confeti'); s.setAttribute('aria-hidden', 'true');
      s.innerHTML = '<use href="#chispa"/>';
      if (i % 3 === 0) s.style.fill = '#d2332b';
      document.body.appendChild(s);
      var a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 220;
      var anim = s.animate([
        { transform: 'translate(' + cx + 'px,' + cy + 'px) scale(0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + (cx + Math.cos(a) * d) + 'px,' + (cy + Math.sin(a) * d) + 'px) scale(' + (0.6 + Math.random()) + ') rotate(' + (Math.random() * 360) + 'deg)', opacity: 1, offset: 0.7 },
        { transform: 'translate(' + (cx + Math.cos(a) * d * 1.1) + 'px,' + (cy + Math.sin(a) * d * 1.1 + 80) + 'px) scale(0) rotate(360deg)', opacity: 0 }
      ], { duration: 1100 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.2,1)' });
      anim.onfinish = (function (el) { return function () { el.remove(); }; })(s);
    }
  }

  J.alCambiar(function (tipo) { if (tipo === 'productos') preparar(); else if (tipo === 'matches') { pintarMatches(); } });
})();
