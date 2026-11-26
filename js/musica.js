/*
 * Música: lista de fondo en bucle y reproductor de la canción de cada día.
 *
 * iPhone/Safari solo deja sonar audio tras un toque del usuario. Por eso:
 * - Al pulsar «Abrir» se "despiertan" los reproductores con un silencio
 *   dentro del mismo toque (Musica.preparar), y luego ya pueden sonar.
 * - Si la app se abre sola (desbloqueo recordado), la música empieza con el
 *   primer toque en cualquier parte de la pantalla.
 * La preferencia (sonar / silenciar) se guarda en el dispositivo.
 */
(function () {
  "use strict";

  var CLAVE = "adviento:musica";
  var fondo = new Audio();
  var pista = new Audio();
  fondo.preload = pista.preload = "auto";
  fondo.setAttribute("playsinline", ""); pista.setAttribute("playsinline", "");

  var lista = [];          // [{ medio, titulo, artista }]
  var indice = 0;
  var activa = localStorage.getItem(CLAVE) !== "off";
  var despierto = false;   // ya hubo un gesto que habilitó el audio
  var pistaSonando = false;
  var ocupado = false;     // un video con sonido está reproduciéndose
  var alCambiar = function () {};

  function silencio() {
    var n = 800, b = new ArrayBuffer(44 + n), v = new DataView(b), i;
    function txt(o, s) { for (var k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); }
    txt(0, "RIFF"); v.setUint32(4, 36 + n, true); txt(8, "WAVE"); txt(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    txt(36, "data"); v.setUint32(40, n, true);
    for (i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
  }
  var SILENCIO = null;

  /** Llamar DENTRO de un toque/clic del usuario. */
  function preparar() {
    if (despierto) return;
    despierto = true;
    SILENCIO = SILENCIO || silencio();
    [fondo, pista].forEach(function (a) {
      if (a.src) return;
      a.src = SILENCIO;
      var p = a.play();
      if (p && p.then) p.then(function () { if (a.src === SILENCIO) a.pause(); }).catch(function () {});
    });
  }

  async function cargarFondo() {
    if (!lista.length) return false;
    var s = lista[indice % lista.length];
    try {
      var url = await Cripto.medio(s.medio);
      if (fondo.src !== url) fondo.src = url;
      return true;
    } catch (e) { return false; }
  }

  async function sonarFondo() {
    if (!activa || pistaSonando || ocupado || !lista.length) return notificar();
    if (!fondo.src || fondo.src === SILENCIO) { if (!(await cargarFondo())) return notificar(); }
    try { await fondo.play(); }
    catch (e) {
      // Sin gesto todavía: esperar el primer toque.
      esperarGesto();
    }
    notificar();
  }

  var esperando = false;
  function esperarGesto() {
    if (esperando) return;
    esperando = true;
    function uno() {
      document.removeEventListener("pointerdown", uno, true);
      document.removeEventListener("keydown", uno, true);
      esperando = false;
      preparar();
      sonarFondo();
    }
    document.addEventListener("pointerdown", uno, true);
    document.addEventListener("keydown", uno, true);
  }

  fondo.addEventListener("ended", async function () {
    indice = (indice + 1) % Math.max(1, lista.length);
    await cargarFondo();
    sonarFondo();
  });
  fondo.addEventListener("play", notificar);
  fondo.addEventListener("pause", notificar);

  function notificar() { alCambiar({ activa: activa, sonando: !fondo.paused && fondo.src !== SILENCIO, hayLista: lista.length > 0 }); }

  /* ---------- Reproductor de una canción del día ---------- */
  var reproductorActual = null;

  function formato(s) {
    if (!isFinite(s)) return "0:00";
    s = Math.floor(s);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function reproductor(cancion) {
    var h = UI.h;
    var boton = h("button", { type: "button", class: "cancion__play", "aria-label": "Reproducir" }, [Arte.icono("play")]);
    var barra = h("input", { type: "range", min: "0", max: "100", step: "0.1", value: "0", "aria-label": "Posición de la canción" });
    var tiempo = h("span", { text: "0:00" }), total = h("span", { text: "0:00" });
    var estado = h("p", { class: "cancion__estado", "aria-live": "polite" });
    var url = null, arrastrando = false;

    function esMia() { return reproductorActual === api; }
    function pintar() {
      var sonando = esMia() && !pista.paused;
      boton.replaceChildren(Arte.icono(sonando ? "pausa" : "play"));
      boton.setAttribute("aria-label", sonando ? "Pausar" : "Reproducir");
      if (esMia() && !arrastrando) {
        barra.value = pista.duration ? (pista.currentTime / pista.duration * 100) : 0;
        tiempo.textContent = formato(pista.currentTime);
        total.textContent = formato(pista.duration);
      }
    }

    boton.addEventListener("click", async function () {
      preparar();
      if (esMia() && !pista.paused) { pista.pause(); return; }
      try {
        estado.textContent = url ? "" : "Cargando…";
        url = url || await Cripto.medio(cancion.medio);
        estado.textContent = "";
        if (!esMia()) {
          if (reproductorActual) reproductorActual.soltar();
          reproductorActual = api;
          pista.src = url;
        }
        pistaSonando = true;
        fondo.pause();
        await pista.play();
      } catch (e) {
        pistaSonando = false;
        estado.textContent = "No se pudo reproducir. Revisa tu conexión la primera vez que la escuches.";
        sonarFondo();
      }
      pintar();
    });
    barra.addEventListener("input", function () { arrastrando = true; if (esMia() && pista.duration) tiempo.textContent = formato(barra.value / 100 * pista.duration); });
    barra.addEventListener("change", function () {
      arrastrando = false;
      if (esMia() && pista.duration) pista.currentTime = barra.value / 100 * pista.duration;
    });

    var api = {
      pintar: pintar,
      soltar: function () { pista.pause(); pintar(); },
      elemento: h("div", { class: "cancion__control" }, [
        h("div", { class: "cancion__barra" }, [tiempo, barra, total]),
        estado
      ]),
      boton: boton
    };
    return api;
  }

  ["timeupdate", "play", "pause", "loadedmetadata", "ended"].forEach(function (ev) {
    pista.addEventListener(ev, function () { if (reproductorActual) reproductorActual.pintar(); });
  });
  pista.addEventListener("pause", function () { pistaSonando = false; });
  pista.addEventListener("ended", function () {
    if (reproductorActual && reproductorActual.alTerminar && reproductorActual.alTerminar()) return; // siguiente de la lista
    pistaSonando = false; pista.currentTime = 0; sonarFondo();
  });

  /* ---------- Lista de reproducción (estilo app de música) ---------- */
  function listaReproduccion(cfg) {
    var h = UI.h;
    var canciones = (cfg.canciones || []).filter(function (c) { return c && c.medio; });
    var actual = -1, cargando = false;
    var filas = [];
    var tiempo = h("span", { text: "0:00" }), total = h("span", { text: "0:00" });
    var barra = h("input", { type: "range", min: "0", max: "100", step: "0.1", value: "0", "aria-label": "Posición de la canción" });
    var arrastrando = false;
    var control = h("div", { class: "playlist__control", hidden: true }, [
      h("p", { class: "playlist__sonando" }),
      h("div", { class: "cancion__barra" }, [tiempo, barra, total])
    ]);
    var estado = h("p", { class: "cancion__estado", "aria-live": "polite" });
    var grande = h("button", { type: "button", class: "playlist__play", "aria-label": "Reproducir la lista" }, [Arte.icono("play")]);

    function esMia() { return reproductorActual === api; }
    function sonando() { return esMia() && !pista.paused; }

    async function tocar(i) {
      preparar();
      if (cargando) return;
      if (i === actual && esMia()) { if (pista.paused) pista.play().catch(function () {}); else pista.pause(); return; }
      cargando = true; estado.textContent = "Cargando…";
      try {
        var url = await Cripto.medio(canciones[i].medio);
        if (reproductorActual && reproductorActual !== api) reproductorActual.soltar();
        reproductorActual = api; actual = i;
        pista.src = url;
        pistaSonando = true; fondo.pause();
        await pista.play();
        estado.textContent = "";
      } catch (e) {
        pistaSonando = false;
        estado.textContent = "No se pudo reproducir. Ábrela con conexión la primera vez.";
      }
      cargando = false;
      pintar();
    }

    function pintar() {
      var mia = esMia();
      filas.forEach(function (f, i) {
        var activa = mia && i === actual;
        f.classList.toggle("pista--actual", activa);
        f.classList.toggle("pista--sonando", activa && !pista.paused);
        f.setAttribute("aria-current", activa ? "true" : "false");
      });
      grande.replaceChildren(Arte.icono(sonando() ? "pausa" : "play"));
      grande.setAttribute("aria-label", sonando() ? "Pausar" : "Reproducir la lista");
      control.hidden = !(mia && actual >= 0);
      if (mia && actual >= 0) {
        var c = canciones[actual];
        control.firstChild.textContent = c.titulo + (c.artista ? " · " + c.artista : "");
        if (!arrastrando) {
          barra.value = pista.duration ? (pista.currentTime / pista.duration * 100) : 0;
          tiempo.textContent = formato(pista.currentTime);
          total.textContent = formato(pista.duration);
        }
      }
    }

    grande.addEventListener("click", function () { tocar(actual >= 0 ? actual : 0); });
    barra.addEventListener("input", function () { arrastrando = true; if (esMia() && pista.duration) tiempo.textContent = formato(barra.value / 100 * pista.duration); });
    barra.addEventListener("change", function () { arrastrando = false; if (esMia() && pista.duration) pista.currentTime = barra.value / 100 * pista.duration; });

    var lista = h("ol", { class: "playlist__lista" }, canciones.map(function (c, i) {
      var fila = h("button", { type: "button", class: "pista" }, [
        h("span", { class: "pista__num" }, [h("span", { class: "pista__n", text: String(i + 1) }), h("span", { class: "pista__eq", "aria-hidden": "true" }, [h("i"), h("i"), h("i")])]),
        h("span", { class: "pista__datos" }, [
          h("span", { class: "pista__titulo", text: c.titulo || "Canción" }),
          c.artista ? h("span", { class: "pista__artista", text: c.artista }) : null
        ])
      ]);
      fila.addEventListener("click", function () { tocar(i); });
      filas.push(fila);
      return h("li", null, [fila]);
    }));

    var portada = h("div", { class: "playlist__portada", "aria-hidden": "true" },
      ["corona", "dulce", "estrella", "regalo"].map(function (m) { return Arte.svg(m); }));

    var api = {
      pintar: pintar,
      soltar: function () { pista.pause(); pintar(); },
      alTerminar: function () {
        if (actual + 1 < canciones.length) { tocar(actual + 1); return true; }
        actual = -1; reproductorActual = null; pintar(); return false;
      },
      elemento: h("div", { class: "playlist" }, [
        h("div", { class: "playlist__cabecera" }, [
          portada,
          h("div", { class: "playlist__info" }, [
            h("p", { class: "playlist__tipo", text: "Playlist" }),
            h("p", { class: "playlist__nombre", text: cfg.titulo || "Nuestras canciones" }),
            h("p", { class: "playlist__cuenta", text: canciones.length + (canciones.length === 1 ? " canción" : " canciones") })
          ]),
          grande
        ]),
        control, estado, lista
      ])
    };
    pintar();
    return api;
  }

  self.Musica = {
    preparar: preparar,
    configurar: function (canciones, cb) {
      lista = (canciones || []).filter(function (c) { return c && c.medio; });
      alCambiar = cb || alCambiar;
      notificar();
    },
    iniciar: function () { sonarFondo(); },
    alternar: function () {
      activa = !activa;
      localStorage.setItem(CLAVE, activa ? "on" : "off");
      preparar();
      if (activa) sonarFondo(); else { fondo.pause(); notificar(); }
    },
    reproductor: reproductor,
    lista: listaReproduccion,
    /** Un video con sonido empieza: pausar la música. */
    ocupar: function () { ocupado = true; fondo.pause(); if (reproductorActual) reproductorActual.soltar(); },
    /** El video con sonido terminó o se pausó: volver al fondo. */
    liberar: function () { ocupado = false; sonarFondo(); },
    /** Al salir de un día: detener su canción y volver al fondo. */
    detenerPista: function () {
      if (reproductorActual) { pista.pause(); reproductorActual = null; }
      pistaSonando = false; ocupado = false;
      sonarFondo();
    },
    pausarTodo: function () { fondo.pause(); pista.pause(); }
  };
})();
