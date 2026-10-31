/* Pagina de sincronizacion: recibe el armario leido en vinted.es, lo fusiona con lo publicado y lo sube a GitHub */
(function () {
  'use strict';

  var CONFIG_POR_DEFECTO = { usuario: '', repo: 'justcreamvintage', rama: 'main' };
  var PERFIL = 'https://www.vinted.es/member/3190974402';
  var DIAS_VENDIDAS = 45; /* tiempo que una prenda vendida se sigue viendo marcada en la web */

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- El marcador: este codigo se ejecuta dentro de vinted.es ---------- */
  function jcvMarcador() {
    var ID = '3190974402';
    var DESTINO = 'https://justcreamvintage.es/sincronizar.html';
    if (!/(^|\.)vinted\.[a-z.]+$/.test(location.hostname)) { alert('Abre www.vinted.es en esta pestaña, con tu sesión iniciada, y vuelve a pulsar el marcador.'); return; }
    var viejo = document.getElementById('jcv-caja'); if (viejo) viejo.remove();
    var caja = document.createElement('div');
    caja.id = 'jcv-caja';
    caja.style.cssText = 'position:fixed;z-index:2147483647;right:20px;bottom:20px;width:min(360px,calc(100vw - 40px));padding:20px;border-radius:14px;background:#6b1015;color:#f1e6cf;font:15px/1.5 Georgia,serif;box-shadow:6px 6px 0 #1f0809;border:2px solid #1f0809';
    caja.textContent = 'Leyendo tu armario de Vinted…';
    document.body.appendChild(caja);
    var boton = function (texto, fondo, color) {
      var b = document.createElement('a');
      b.textContent = texto;
      b.style.cssText = 'display:inline-block;margin:12px 10px 0 0;padding:10px 16px;border-radius:8px;background:' + fondo + ';color:' + color + ';text-decoration:none;font-weight:bold;cursor:pointer;border:2px solid #1f0809';
      return b;
    };
    var precio = function (it) {
      var p = it.price;
      if (p && typeof p === 'object') return { n: parseFloat(p.amount), m: p.currency_code || 'EUR' };
      return { n: parseFloat(p || it.price_numeric || 0), m: it.currency || 'EUR' };
    };
    var todas = [];
    var pagina = function (n) {
      return fetch('/api/v2/wardrobe/' + ID + '/items?page=' + n + '&per_page=96&order=newest_first', { credentials: 'include', headers: { accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('Vinted ha respondido con el código ' + r.status + '. Inicia sesión en Vinted, recarga la página y vuelve a pulsar el marcador.'); return r.json(); })
        .then(function (j) {
          todas = todas.concat(j.items || []);
          caja.textContent = 'Leídas ' + todas.length + ' prendas…';
          var tp = (j.pagination && j.pagination.total_pages) || 1;
          if (n < tp && n < 30) return pagina(n + 1);
        });
    };
    pagina(1).then(function () {
      var items = todas.map(function (it) {
        var pr = precio(it);
        var url = it.url || ('/items/' + it.id);
        if (url.indexOf('http') !== 0) url = location.origin + url;
        var vendida = !!(it.is_closed || it.is_sold || it.item_closing_action === 'sold');
        var fotos = (it.photos && it.photos.length ? it.photos : (it.photo ? [it.photo] : []));
        return {
          id: String(it.id), titulo: it.title || '', marca: it.brand_title || (it.brand && it.brand.title) || '',
          talla: it.size_title || it.size || '', estado: it.status || '', precio: pr.n, moneda: pr.m,
          descripcion: it.description || '',
          fotos: fotos.map(function (f) { return f.full_size_url || f.url; }).filter(Boolean).slice(0, 8),
          url: url, estado_venta: vendida ? 'vendida' : (it.is_reserved ? 'reservada' : 'disponible'),
          oculta: !!(it.is_hidden || it.is_draft), publicado: it.created_at_ts || it.created_at || null
        };
      });
      var json = JSON.stringify({ v: 1, usuario: ID, leido: new Date().toISOString(), items: items });
      var aBase64 = function (bytes) {
        var s = '';
        for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };
      var crudo = new TextEncoder().encode(json);
      var empaquetar = typeof CompressionStream === 'function'
        ? new Response(new Blob([crudo]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then(function (b) { return 'z=' + aBase64(new Uint8Array(b)); })
        : Promise.resolve('j=' + aBase64(crudo));
      return empaquetar.then(function (datos) {
        var vendidas = items.filter(function (x) { return x.estado_venta === 'vendida'; }).length;
        caja.innerHTML = '';
        var t = document.createElement('p');
        t.style.margin = '0';
        t.textContent = 'Listo: ' + items.length + ' prendas leídas' + (vendidas ? ', ' + vendidas + ' vendidas' : '') + '. Ahora publícalas en la web.';
        caja.appendChild(t);
        var ir = boton('Publicar en la web', '#f1e6cf', '#6b1015');
        ir.href = DESTINO + '#' + datos; ir.target = '_blank'; ir.rel = 'noopener';
        caja.appendChild(ir);
        var copiar = boton('Copiar datos', 'transparent', '#f1e6cf');
        copiar.addEventListener('click', function () {
          navigator.clipboard.writeText(datos).then(function () { copiar.textContent = 'Copiado'; }, function () { prompt('Copia este texto:', datos); });
        });
        caja.appendChild(copiar);
        var cerrar = boton('Cerrar', 'transparent', '#f1e6cf');
        cerrar.addEventListener('click', function () { caja.remove(); });
        caja.appendChild(cerrar);
      });
    }).catch(function (e) {
      caja.textContent = 'No se ha podido leer el armario. ' + (e && e.message ? e.message : '');
      var cerrar = boton('Cerrar', '#f1e6cf', '#6b1015');
      cerrar.addEventListener('click', function () { caja.remove(); });
      caja.appendChild(cerrar);
    });
  }
  $('#marcador').href = 'javascript:' + encodeURIComponent('(' + jcvMarcador.toString() + ')();void 0');
  $('#marcador').addEventListener('click', function (e) {
    e.preventDefault();
    mensaje('Este botón no se pulsa aquí: arrástralo a la barra de marcadores y úsalo cuando estés en vinted.es.', 'info', $('#resultado'));
    $('#paso-recibido').hidden = false;
    $('#resumen').innerHTML = ''; $('#cambios').innerHTML = '';
    $('#publicar').hidden = $('#descargar').hidden = true;
  });

  /* ---------- Configuracion de GitHub ---------- */
  var cfg = Object.assign({}, CONFIG_POR_DEFECTO);
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('jcv-github') || '{}')); } catch (e) { /* nada */ }
  if (!cfg.usuario && /\.github\.io$/.test(location.hostname)) cfg.usuario = location.hostname.split('.')[0];
  $('#gh-usuario').value = cfg.usuario || '';
  $('#gh-repo').value = cfg.repo || '';
  $('#gh-rama').value = cfg.rama || 'main';
  $('#gh-token').value = cfg.token || '';
  function leerCfg() {
    cfg = { usuario: $('#gh-usuario').value.trim(), repo: $('#gh-repo').value.trim(), rama: $('#gh-rama').value.trim() || 'main', token: $('#gh-token').value.trim() };
    return cfg;
  }
  $('#guardar-cfg').addEventListener('click', function () {
    leerCfg();
    try { localStorage.setItem('jcv-github', JSON.stringify(cfg)); mensaje('Conexión guardada en este navegador.', 'ok', $('#guardar-cfg').parentNode.nextElementSibling); }
    catch (e) { mensaje('Este navegador no deja guardar datos. Tendrás que escribir el token cada vez.', 'error'); }
  });
  $('#borrar-cfg').addEventListener('click', function () {
    $('#gh-token').value = '';
    leerCfg();
    try { localStorage.setItem('jcv-github', JSON.stringify({ usuario: cfg.usuario, repo: cfg.repo, rama: cfg.rama })); } catch (e) { /* nada */ }
  });

  function mensaje(texto, tipo, donde) {
    var caja = donde || $('#resultado');
    var p = document.createElement('p');
    p.className = 'mensaje mensaje--' + tipo;
    p.textContent = texto;
    if (caja.id === 'resultado') caja.innerHTML = '';
    else { var prev = caja.querySelector && caja.querySelector('.mensaje'); if (prev) prev.remove(); }
    if (caja.id === 'resultado') caja.appendChild(p); else caja.parentNode.insertBefore(p, caja);
  }

  /* ---------- Recibir datos ---------- */
  function deBase64(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  function decodificar(texto) {
    texto = (texto || '').trim().replace(/^.*#/, '');
    var tipo = texto.slice(0, 2), cuerpo = texto.slice(2);
    if (tipo === 'j=') return Promise.resolve(JSON.parse(new TextDecoder().decode(deBase64(cuerpo))));
    if (tipo === 'z=') {
      if (typeof DecompressionStream !== 'function') return Promise.reject(new Error('Este navegador es antiguo. Prueba con Chrome, Edge, Firefox o Safari actualizados.'));
      return new Response(new Blob([deBase64(cuerpo)]).stream().pipeThrough(new DecompressionStream('gzip'))).text().then(JSON.parse);
    }
    return Promise.reject(new Error('Los datos no tienen el formato esperado. Vuelve a pulsar el marcador en vinted.es.'));
  }

  function fecha(v) {
    if (v == null || v === '') return null;
    var d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
    return isNaN(d) ? null : d.toISOString();
  }

  function fusionar(previo, leido) {
    var ahora = new Date().toISOString();
    var antes = {};
    ((previo && previo.fuente !== 'demo' && previo.productos) || []).forEach(function (p) { antes[String(p.id)] = p; });
    var r = { total: 0, nuevas: [], vendidas: [], cambios: [] };
    var vistos = {};
    var lista = [];
    (leido.items || []).forEach(function (it) {
      if (!it || !it.id || !it.titulo) return;
      vistos[it.id] = true;
      if (it.oculta) return;
      var a = antes[it.id];
      var p = {
        id: String(it.id), titulo: String(it.titulo), marca: it.marca || '', talla: it.talla || '', estado: it.estado || '',
        precio: +it.precio || 0, moneda: it.moneda || 'EUR', descripcion: it.descripcion || '',
        fotos: (it.fotos || []).filter(function (u) { return /^https:\/\//.test(u); }),
        url: /^https:\/\/([a-z0-9-]+\.)*vinted\.[a-z.]+\//i.test(it.url || '') ? it.url : PERFIL,
        estado_venta: ['vendida', 'reservada'].indexOf(it.estado_venta) !== -1 ? it.estado_venta : 'disponible',
        categoria: window.JCVcategoria(it.titulo),
        publicado: fecha(it.publicado) || (a && a.publicado) || ahora,
        vendido_en: null
      };
      if (p.estado_venta === 'vendida') {
        p.vendido_en = (a && a.vendido_en) || ahora;
        if (!a || a.estado_venta !== 'vendida') r.vendidas.push(p);
      }
      if (!a) { if (p.estado_venta !== 'vendida') r.nuevas.push(p); }
      else if (a.precio !== p.precio || (a.estado_venta !== p.estado_venta && p.estado_venta !== 'vendida')) r.cambios.push(p);
      lista.push(p);
    });
    /* Lo que estaba en la web y ya no aparece en Vinted se da por vendido */
    Object.keys(antes).forEach(function (id) {
      if (vistos[id]) return;
      var a = antes[id];
      if (a.estado_venta !== 'vendida') { var v = Object.assign({}, a, { estado_venta: 'vendida', vendido_en: ahora }); r.vendidas.push(v); lista.push(v); }
      else lista.push(a);
    });
    var limite = Date.now() - DIAS_VENDIDAS * 864e5;
    lista = lista.filter(function (p) { return p.estado_venta !== 'vendida' || !p.vendido_en || new Date(p.vendido_en).getTime() > limite; });
    r.total = lista.filter(function (p) { return p.estado_venta !== 'vendida'; }).length;
    return { datos: { version: 1, fuente: 'vinted', actualizado: ahora, perfil: PERFIL, productos: lista }, resumen: r };
  }

  var preparado = null;
  function procesar(texto) {
    $('#paso-recibido').hidden = false;
    $('#publicar').hidden = $('#descargar').hidden = false;
    $('#resultado').innerHTML = '';
    $('#resumen').innerHTML = '<div><b>…</b>Comparando con la web</div>';
    $('#cambios').innerHTML = '';
    return Promise.all([
      decodificar(texto),
      fetch('data/productos.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (res) {
      var leido = res[0], previo = res[1];
      if (!leido || !Array.isArray(leido.items)) throw new Error('Los datos están vacíos. Vuelve a pulsar el marcador en vinted.es.');
      preparado = fusionar(previo, leido);
      var r = preparado.resumen;
      $('#resumen').innerHTML =
        '<div><b>' + r.total + '</b>Disponibles</div>' +
        '<div><b>' + r.nuevas.length + '</b>Nuevas en la web</div>' +
        '<div><b>' + r.vendidas.length + '</b>Pasan a vendidas</div>' +
        '<div><b>' + r.cambios.length + '</b>Con cambios</div>';
      var filas = r.nuevas.map(function (p) { return [p, 'Nueva', '']; })
        .concat(r.vendidas.map(function (p) { return [p, 'Vendida', 'v']; }))
        .concat(r.cambios.map(function (p) { return [p, 'Cambia', '']; }));
      $('#cambios').innerHTML = filas.length ? filas.map(function (f) {
        var p = f[0];
        return '<li>' + (p.fotos && p.fotos[0] ? '<img src="' + esc(p.fotos[0]) + '" alt="">' : '<span></span>') + '<span>' + esc(p.titulo) + '</span><em class="' + f[2] + '">' + f[1] + '</em></li>';
      }).join('') : '<li><span></span><span>No hay cambios respecto a lo que ya está publicado.</span><span></span></li>';
      if (previo && previo.fuente === 'demo') mensaje('Es la primera sincronización: al publicar, las prendas de muestra se sustituyen por tus prendas reales.', 'info');
    }).catch(function (e) {
      preparado = null;
      $('#resumen').innerHTML = '';
      mensaje(e.message || 'No se han podido leer los datos.', 'error');
    });
  }

  if (/^#[zj]=/.test(location.hash)) {
    var datosHash = location.hash.slice(1);
    history.replaceState(null, '', location.pathname);
    procesar(datosHash);
  }
  $('#usar-pegado').addEventListener('click', function () { procesar($('#pegado').value); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---------- Publicar ---------- */
  function utf8Base64(texto) {
    var b = new TextEncoder().encode(texto), s = '';
    for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }

  $('#publicar').addEventListener('click', function () {
    if (!preparado) return;
    leerCfg();
    if (!cfg.usuario || !cfg.repo || !cfg.token) { mensaje('Falta la conexión con GitHub. Rellena usuario, repositorio y token en el paso 3 y vuelve a pulsar "Publicar en la web".', 'error'); $('#gh-token').focus(); return; }
    var boton = $('#publicar');
    boton.disabled = true; boton.querySelector('span').textContent = 'Publicando…';
    var api = 'https://api.github.com/repos/' + encodeURIComponent(cfg.usuario) + '/' + encodeURIComponent(cfg.repo) + '/contents/data/productos.json';
    var cab = { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    var r = preparado.resumen;
    var texto = JSON.stringify(preparado.datos, null, 1) + '\n';
    function intentar(n) {
      return fetch(api + '?ref=' + encodeURIComponent(cfg.rama), { headers: cab, cache: 'no-store' })
        .then(function (res) {
          if (res.status === 404) return null;
          if (res.status === 401) throw new Error('GitHub no acepta el token. Puede haber caducado: crea uno nuevo (paso 3).');
          if (!res.ok) throw new Error('GitHub ha respondido con el código ' + res.status + ' al leer la web.');
          return res.json().then(function (j) { return j.sha; });
        })
        .then(function (sha) {
          var cuerpo = { message: 'Sincronizar con Vinted: ' + r.nuevas.length + ' nuevas, ' + r.vendidas.length + ' vendidas', content: utf8Base64(texto), branch: cfg.rama };
          if (sha) cuerpo.sha = sha;
          return fetch(api, { method: 'PUT', headers: cab, body: JSON.stringify(cuerpo) });
        })
        .then(function (res) {
          if (res.ok) return;
          if ((res.status === 409 || res.status === 422) && n < 2) return intentar(n + 1);
          if (res.status === 404) throw new Error('No encuentro el repositorio "' + cfg.usuario + '/' + cfg.repo + '". Revisa el usuario y el nombre, y que el token tenga acceso a él.');
          if (res.status === 403) throw new Error('El token no tiene permiso para escribir. Dale "Contents: Read and write" sobre este repositorio.');
          throw new Error('GitHub ha respondido con el código ' + res.status + ' al publicar.');
        });
    }
    intentar(0).then(function () {
      mensaje('Publicado. La web mostrará los cambios en uno o dos minutos.', 'ok');
      boton.querySelector('span').textContent = 'Publicado';
    }).catch(function (e) {
      mensaje(e.message || 'No se ha podido publicar. Comprueba la conexión a internet y vuelve a intentarlo.', 'error');
      boton.disabled = false; boton.querySelector('span').textContent = 'Publicar en la web';
    });
  });

  $('#descargar').addEventListener('click', function () {
    if (!preparado) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(preparado.datos, null, 1) + '\n'], { type: 'application/json' }));
    a.download = 'productos.json';
    document.body.appendChild(a); a.click(); a.remove();
    mensaje('Descargado. Súbelo a la carpeta "data" de la web para publicarlo a mano.', 'info');
  });
})();
