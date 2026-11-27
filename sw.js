/*
 * Service Worker de Adviento.
 *
 * - Precachea todos los recursos locales (rutas RELATIVAS a este archivo,
 *   así funciona en https://USUARIO.github.io/NOMBRE-REPO/).
 * - HTML (navegación): red primero, con respaldo en caché si no hay conexión.
 * - Resto de recursos: caché primero y actualización en segundo plano
 *   (stale-while-revalidate), así la siguiente apertura recibe lo nuevo.
 * - Al cambiar CACHE_VERSION se instala una versión nueva, se activa sola
 *   y se borran las cachés anteriores.
 * - medios/*.bin (fotos, videos y canciones cifradas): caché primero, en una
 *   caché PROPIA ("adviento-medios") que NO se borra al cambiar CACHE_VERSION,
 *   así actualizar la app no obliga a volver a descargar ~60 MB. cifrar.js les
 *   da nombres nuevos cada vez y la app borra los que ya no se usan.
 * - contenido-plano.js y privado/ NUNCA se cachean.
 */

const CACHE_VERSION = "v8";                 // ← súbelo (v2, v3...) en cada publicación
const CACHE = "adviento-" + CACHE_VERSION;
const CACHE_MEDIOS = "adviento-medios";   // no depende de la versión

const RECURSOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/estilos.css",
  "./js/arte.js",
  "./js/cripto.js",
  "./js/musica.js",
  "./js/juegos.js",
  "./js/app.js",
  "./contenido.enc.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-maskable-512.png"
];

const PROHIBIDOS = /contenido-plano|\/privado\/|\.bak$|\.tmp$/i;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache: "reload" evita la caché HTTP para no guardar una versión vieja
    await cache.addAll(RECURSOS.map((url) => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(
      nombres.filter((n) => n.startsWith("adviento-") && n !== CACHE && n !== CACHE_MEDIOS).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // nada externo
  if (PROHIBIDOS.test(url.pathname)) return;                // nunca cachear contenido plano

  if (req.mode === "navigate") {
    event.respondWith(redPrimero(req));
  } else if (/\/medios\/[^/]+\.bin$/.test(url.pathname)) {
    event.respondWith(soloCache(req));
  } else {
    event.respondWith(cachePrimero(req, event));
  }
});

async function redPrimero(req) {
  const cache = await caches.open(CACHE);
  try {
    const resp = await conTiempo(fetch(req, { cache: "no-cache" }), 4000);
    if (resp && resp.ok) {
      cache.put("./index.html", resp.clone());
      return resp;
    }
    throw new Error("respuesta no válida");
  } catch (e) {
    return (await cache.match("./index.html")) ||
           (await cache.match("./")) ||
           new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function cachePrimero(req, event) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(req, { ignoreSearch: true });
  const deRed = fetch(req, { cache: "no-cache" }).then((resp) => {
    if (resp && resp.ok && resp.type === "basic") cache.put(req, resp.clone());
    return resp;
  }).catch(() => null);

  if (guardada) {
    event.waitUntil(deRed);   // actualizar en segundo plano
    return guardada;
  }
  const resp = await deRed;
  return resp || new Response("", { status: 504 });
}

async function soloCache(req) {
  const cache = await caches.open(CACHE_MEDIOS);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const resp = await fetch(req);
  if (resp.ok && resp.type === "basic") await cache.put(req, resp.clone());
  return resp;
}

function conTiempo(promesa, ms) {
  return new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error("tiempo agotado")), ms);
    promesa.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); mal(e); });
  });
}
