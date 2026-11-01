/* Clasificacion de prendas por palabras del titulo.
   La usan la web, la pagina de sincronizar y la sincronizacion automatica: este archivo es el unico
   sitio donde estan las reglas, para que la web y las paginas de prenda nunca se contradigan.

   El orden importa: gana la primera regla que encaje, asi que van de lo mas concreto a lo mas vago.
   Los titulos vienen de Vinted casi siempre en ingles, de ahi que haya palabras en los dos idiomas. */
(function (raiz) {
  var REGLAS = [
    /* Primero los casos que confunden a todo lo demas */
    ['Camisas y camisetas', /goalkeeper|football shirt|soccer jersey|camiseta de f[uú]tbol/i],

    ['Calzado', /zapat|bota\b|botas\b|bot[ií]n|sandalia|mocas[ií]n|sneakers?\b|\btrainers\b|shoes?\b|boots?\b/i],
    ['Accesorios', /bolso|gorra|gorro|bufanda|cintur[oó]n|gafas|cartera|mochila|pa[nñ]uelo|sombrero|calcetines|\bbag\b|\bcap\b|beanie|scarf|\bbelt\b|wallet|backpack|socks\b/i],

    /* Pantalones va antes que sudaderas: "sweatpants" y "track pants" llevaban todos los joggers
       a la categoria equivocada porque "sweat" encajaba primero. Ojo con \bshorts\b: sin la \b
       final, "short sleeve" acababa en pantalones. */
    ['Pantalones', /pantal|vaquer|\bjeans?\b|chino|trouser|\bpants\b|joggers?\b|sweatpants|bottoms\b|\bshorts\b|bermuda|legging|mallas|\bpeto\b|cargo/i],

    ['Vestidos y faldas', /vestido|falda|\bmono\b|dress\b|skirt/i],

    /* Sudaderas antes que chaquetas: muchas sudaderas con cremallera dicen tambien "track jacket" */
    ['Jerséis y sudaderas', /sudadera|hoodie|sweatshirt|sweater|crewneck|jumper|c[aá]rdigan|cardigan|rebeca|jers[eé]i|jersey|\bknit|fleece|polar\b|pullover|de punto/i],

    ['Chaquetas y abrigos', /chaquet|cazador|abrigo|blazer|americana|chaleco|bomber|parka|gabardina|anorak|plum[ií]fero|trench|\bjacket\b|\bcoat\b|windbreaker|puffer|gilet|softshell|overshirt/i],

    ['Camisas y camisetas', /camis|blusa|\btop\b|\bpolo\b|t-?shirt|\btee\b|shirt|long sleeve|manga larga|\bbody\b/i]
  ];

  function categoria(titulo) {
    for (var i = 0; i < REGLAS.length; i++) if (REGLAS[i][1].test(titulo || '')) return REGLAS[i][0];
    return 'Otras prendas';
  }

  raiz.JCVcategoria = categoria;
  if (typeof module !== 'undefined' && module.exports) module.exports = { categoria: categoria, REGLAS: REGLAS };
})(typeof window !== 'undefined' ? window : globalThis);
