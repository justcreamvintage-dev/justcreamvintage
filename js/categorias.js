/* Clasificacion de prendas por palabras del titulo. La usan la web y la pagina de sincronizar. */
(function (raiz) {
  var REGLAS = [
    ['Chaquetas y abrigos', /chaquet|cazador|abrigo|blazer|americana|chaleco|bomber|parka|gabardina|anorak|plum[ií]fero|trench|jacket|coat/i],
    ['Jerséis y sudaderas', /jers[eé]|jersei|sudadera|c[aá]rdigan|rebeca|punto|hoodie|polar|sweat|knit/i],
    ['Camisas y camisetas', /camis|blusa|\btop\b|polo|t-?shirt|body|shirt/i],
    ['Pantalones', /pantal|vaquer|jeans?\b|chino|short|bermuda|legging|mallas|peto|cargo/i],
    ['Vestidos y faldas', /vestido|falda|\bmono\b|dress|skirt/i],
    ['Calzado', /zapat|bota|bot[ií]n|sandalia|deportiva|mocas[ií]n|sneaker|shoes?\b/i],
    ['Accesorios', /bolso|gorr|bufanda|cintur[oó]n|gafas|cartera|mochila|pa[nñ]uelo|sombrero|bag\b|cap\b/i]
  ];
  function categoria(titulo) {
    for (var i = 0; i < REGLAS.length; i++) if (REGLAS[i][1].test(titulo || '')) return REGLAS[i][0];
    return 'Otras prendas';
  }
  raiz.JCVcategoria = categoria;
})(window);
