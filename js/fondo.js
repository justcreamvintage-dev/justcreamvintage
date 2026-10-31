/* Fondo vivo del hero: cuadros de banderin deformados en granate y rojo (WebGL).
   Responde al raton y al scroll. Si no hay WebGL se queda el fondo de cuadros en CSS. */
(function () {
  'use strict';
  var lienzo = document.querySelector('.hero__lienzo');
  if (!lienzo) return;
  var gl = lienzo.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) { lienzo.remove(); return; }
  var reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
    'precision mediump float;',
    'uniform vec2 uRes;uniform float uT;uniform vec2 uM;uniform float uS;',
    'const vec3 GRANATE=vec3(.420,.063,.082);const vec3 ROJO=vec3(.824,.200,.169);',
    'const vec3 TINTA=vec3(.122,.031,.035);const vec3 CREMA=vec3(.945,.902,.812);',
    'void main(){',
    '  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    '  vec2 m=(uM-.5)*vec2(uRes.x/uRes.y,1.);',
    '  vec2 d=uv-m*.7; float r=length(d);',
    '  uv+=d*.35*exp(-r*3.);',                                   /* lupa que sigue al raton */
    '  vec2 k=abs(uv); float t=uT*.12;',                         /* caleidoscopio en espejo */
    '  float rad=length(k); float an=atan(k.y,k.x)+.4*sin(t+rad*2.2);',
    '  vec2 p=vec2(cos(an),sin(an))*rad*9.;',
    '  p+=vec2(sin(p.y*.6+t*2.),cos(p.x*.55-t*1.6))*.9;',
    '  p+=vec2(sin(p.y*1.7-t),cos(p.x*1.5+t*.7))*.25;',
    '  p.y-=uS*3.;',
    '  vec2 c=sin(p*1.5708); float v=c.x*c.y;',
    '  float ch=smoothstep(-.1,.1,v);',
    '  vec3 col=mix(GRANATE,ROJO,ch);',
    '  float aro=sin(rad*8.-uT*.9+uS*4.);',
    '  col=mix(col,TINTA,smoothstep(.96,.995,aro)*.6);',
    '  col=mix(col,CREMA,smoothstep(.975,1.,v)*.35);',
    '  col*=1.-.35*smoothstep(.55,1.25,length((gl_FragCoord.xy/uRes-.5)*vec2(1.6,1.)));',
    '  gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function sombreador(tipo, src) {
    var s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sombreador(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sombreador(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { lienzo.remove(); return; }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uRes = gl.getUniformLocation(prog, 'uRes'), uT = gl.getUniformLocation(prog, 'uT'),
      uM = gl.getUniformLocation(prog, 'uM'), uS = gl.getUniformLocation(prog, 'uS');

  var escala = Math.min(window.devicePixelRatio || 1, 2) * 0.6;
  function medir() {
    var w = Math.max(1, Math.round(lienzo.clientWidth * escala)), h = Math.max(1, Math.round(lienzo.clientHeight * escala));
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; gl.viewport(0, 0, w, h); }
  }
  var raton = [0.5, 0.5], suave = [0.5, 0.5];
  window.addEventListener('pointermove', function (e) { raton[0] = e.clientX / innerWidth; raton[1] = 1 - e.clientY / innerHeight; }, { passive: true });
  window.addEventListener('resize', medir);

  var visible = true, enMarcha = false, t0 = performance.now();
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible && !reducido && !enMarcha) { enMarcha = true; requestAnimationFrame(pintar); } }).observe(lienzo);

  function pintar(ahora) {
    medir();
    suave[0] += (raton[0] - suave[0]) * 0.05; suave[1] += (raton[1] - suave[1]) * 0.05;
    gl.uniform2f(uRes, lienzo.width, lienzo.height);
    gl.uniform1f(uT, reducido ? 8 : ((ahora || t0) - t0) / 1000);
    gl.uniform2f(uM, suave[0], suave[1]);
    gl.uniform1f(uS, Math.min(window.scrollY / Math.max(1, innerHeight), 1.5));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    enMarcha = visible && !reducido;
    if (enMarcha) requestAnimationFrame(pintar);
  }
  enMarcha = true;
  requestAnimationFrame(pintar);
})();
