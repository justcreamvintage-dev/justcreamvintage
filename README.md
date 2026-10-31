# Just Cream Vintage

Web de [justcreamvintage.es](https://justcreamvintage.es): ropa vintage de segunda mano que se vende en [Vinted](https://www.vinted.es/member/3190974402).

Web estática (HTML, CSS y JavaScript, sin compilar), alojada en GitHub Pages con el dominio de Hostalia.

## Cómo funciona la venta

- La web enseña las prendas del armario de Vinted. El botón "Comprar en Vinted" lleva a la ficha de la prenda, donde se paga con su protección al comprador.
- Así nunca se vende dos veces lo mismo: la venta siempre ocurre en Vinted, y la web solo refleja lo que hay allí.
- Las prendas vendidas se ven 45 días con el sello "Vendida" y luego desaparecen solas.

## Sincronización automática

No hay que hacer nada: `.github/workflows/sincronizar.yml` lee el armario de Vinted **cada 10 minutos** y actualiza `data/productos.json` solo si algo ha cambiado. Cuando lo actualiza, GitHub Pages republica la web en uno o dos minutos.

GitHub no garantiza la puntualidad de las tareas programadas: cuando sus servidores van cargados, una ejecución puede salir con retraso o saltarse. En la práctica eso significa que un cambio en Vinted suele estar en la web en 10-15 minutos, y en un mal momento puede irse a media hora.

- Lee el armario público (`/api/v2/wardrobe/3190974402/items`) con una sesión anónima, sin necesidad de tu usuario ni tu contraseña.
- Las descripciones se leen de la ficha pública de cada prenda y se guardan, así que cada prenda se lee una sola vez. Por ir despacio con Vinted, trae como máximo 5 descripciones nuevas por ejecución: si subes 30 prendas de golpe, todas aparecen al momento y las descripciones se completan en la hora siguiente.
- Lo que estaba en la web y ya no aparece en Vinted se marca como vendido.
- Si el armario viene vacío o Vinted responde mal, la ejecución falla y **no toca la web**: se queda como estaba y lo reintenta en la siguiente vuelta.

Para lanzarla a mano: pestaña **Actions**, "Sincronizar con Vinted", **Run workflow**.

Para probarla en local sin escribir nada:

```bash
node scripts/sincronizar-vinted.mjs --dry-run
```

> Ojo: GitHub desactiva las tareas programadas de un repositorio sin actividad durante 60 días. Mientras haya altas y bajas en el armario hay commits, así que no debería pasar; si alguna vez se desactiva, GitHub avisa por correo y se reactiva con un clic.

### Sincronizar a mano (respaldo)

Si Vinted cambia su web y la automática deja de funcionar, sigue estando el marcador manual, que lee el armario desde tu propio navegador con tu sesión:

1. Abre `https://justcreamvintage.es/sincronizar.html` y arrastra el botón "Sincronizar JCV" a la barra de marcadores.
2. Rellena allí la conexión con GitHub (usuario, repositorio, rama `main` y un token fine-grained con permiso "Contents: Read and write" solo sobre este repositorio).
3. Entra en vinted.es con tu sesión, pulsa el marcador y luego "Publicar en la web".

## Estructura

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | La web |
| `css/estilo.css` | Estilos (colores del logo, rayas de uniforme, cromos) |
| `js/fondo.js` | Fondo animado del inicio (WebGL) |
| `js/app.js` | Cursor, animaciones de scroll, colección y ficha |
| `js/match.js` | "Encuentra tu match": prendas para deslizar |
| `js/categorias.js` | Clasifica las prendas por el título |
| `data/productos.json` | Las prendas. Lo reescribe la sincronización |
| `scripts/sincronizar-vinted.mjs` | Sincronización automática (la que corre en GitHub Actions) |
| `.github/workflows/sincronizar.yml` | Cuándo y cómo se ejecuta esa sincronización |
| `sincronizar.html`, `js/sincronizar.js` | Página privada y marcador de la sincronización manual |
| `CNAME` | Dominio para GitHub Pages |

## Dominio y publicación

- GitHub: Settings, Pages, "Deploy from a branch", rama `main`, carpeta `/ (root)`, dominio personalizado `justcreamvintage.es` y "Enforce HTTPS" cuando GitHub lo verifique.
- Hostalia, zona DNS de `justcreamvintage.es`:
  - Cuatro registros A para `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
  - Un CNAME para `www` que apunte a `TU_USUARIO.github.io`.

## Probar en local

```bash
python3 -m http.server 8000
```

Y abre http://localhost:8000.
