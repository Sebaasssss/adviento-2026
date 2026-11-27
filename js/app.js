/*
 * Adviento — lógica principal.
 * - Desbloqueo (Cripto) y pantalla de inicio.
 * - Calendario de 25 puertas según la fecha LOCAL del dispositivo.
 * - Vista de cada día (página propia, con scroll normal): fotos, mini carta,
 *   canción y juegos.
 * - Música de fondo y progreso local.
 * - Registro del Service Worker.
 *
 * Privacidad: el contenido descifrado vive solo en memoria. En
 * localStorage se guarda únicamente el progreso (números de día) y la
 * preferencia de música; nunca textos, fotos ni canciones.
 */
(function () {
  "use strict";

  var h = UI.h, vaciar = UI.vaciar;
  var $ = function (id) { return document.getElementById(id); };

  var ANIO = 2026, MES = 12, TOTAL = 25, NORMALES = 25;
  var CLAVE_PROGRESO = "adviento:progreso:v1";
  var reduceMov = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var contenido = null;      // datos descifrados (solo memoria)
  var diaAbierto = null;
  var scrollCalendario = 0;

  /* =========================================================
     Progreso (localStorage).
     ========================================================= */
  var Progreso = {
    real: null,
    cargar: function () {
      try { this.real = JSON.parse(localStorage.getItem(CLAVE_PROGRESO)) || {}; } catch (e) { this.real = {}; }
      this.real.abiertas = this.real.abiertas || {};
      this.real.juegos = this.real.juegos || {};
      this.real.vales = this.real.vales || {};
    },
    get d() { return this.real; },
    guardar: function () {
      try { localStorage.setItem(CLAVE_PROGRESO, JSON.stringify(this.real)); } catch (e) {}
    }
  };

  /* =========================================================
     Fechas (siempre locales, sin UTC)
     ========================================================= */
  function hoyNum() {
    var d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  function fechaNum(n) { return ANIO * 10000 + MES * 100 + n; }
  function estaDesbloqueada(n) { return hoyNum() >= fechaNum(n); }
  function diasHasta(n) {
    var d = new Date();
    var hoy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((new Date(ANIO, MES - 1, n) - hoy) / 864e5);
  }
  function fechaLarga(n) {
    try { return new Date(ANIO, MES - 1, n).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }); }
    catch (e) { return n + " de diciembre"; }
  }
  function dos(n) { return String(n).padStart(2, "0"); }
  function faltan(n) { return n === 1 ? "falta 1 día" : "faltan " + n + " días"; }

  /* =========================================================
     Avisos y confirmaciones
     ========================================================= */
  var avisoTimer;
  function avisar(texto, accion, alPulsar, ms) {
    var a = $("aviso"), b = $("aviso-accion");
    $("aviso-texto").textContent = texto;
    b.hidden = !accion;
    b.textContent = accion || "";
    b.onclick = function () { a.hidden = true; if (alPulsar) alPulsar(); };
    a.hidden = false;
    a.style.animation = "none"; void a.offsetWidth; a.style.animation = "";
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { a.hidden = true; }, ms || (accion ? 8000 : 4200));
  }

  function confirmar(texto, textoSi) {
    return new Promise(function (resolver) {
      var c = $("confirmar"), si = $("confirmar-si"), no = $("confirmar-no");
      var previo = document.activeElement;
      $("confirmar-texto").textContent = texto;
      si.textContent = textoSi || "Sí";
      c.hidden = false;
      si.focus();
      function fin(v) {
        c.hidden = true; si.onclick = no.onclick = null; document.removeEventListener("keydown", tecla, true);
        if (previo && previo.focus) previo.focus({ preventScroll: true });
        resolver(v);
      }
      function tecla(e) { if (e.key === "Escape") { e.stopPropagation(); fin(false); } }
      si.onclick = function () { fin(true); };
      no.onclick = function () { fin(false); };
      document.addEventListener("keydown", tecla, true);
    });
  }

  /* =========================================================
     Inicio de sesión
     ========================================================= */
  function pintarMosaico() {
    var m = $("login-mosaico");
    ["copos", "pinos", "estrella", "regalo", "dulce", "corona"].forEach(function (nombre) { m.appendChild(Arte.svg(nombre)); });
  }

  function mostrarError(t) {
    $("error-clave").textContent = t;
    var f = $("form-clave");
    f.classList.remove("agitar"); void f.offsetWidth; f.classList.add("agitar");
  }

  async function alEnviarClave(ev) {
    ev.preventDefault();
    Musica.preparar(); // dentro del toque: habilita el audio en iPhone
    var campo = $("clave"), btn = $("btn-abrir");
    var valor = campo.value;
    $("error-clave").textContent = "";
    if (!valor.trim()) return mostrarError("Escribe la contraseña para abrir.");
    if (!Cripto.disponible()) return mostrarError("Este navegador no permite abrir el calendario aquí.");
    if (!Cripto.hayContenido()) return mostrarError("No se pudo cargar el calendario. Revisa tu conexión e inténtalo de nuevo.");
    btn.disabled = true; btn.textContent = "Abriendo…";
    try {
      var datos = await Cripto.abrirConContrasena(valor, $("recordar").checked);
      campo.value = ""; valor = null;
      entrar(datos);
    } catch (e) {
      // Nunca se muestran detalles técnicos ni se conserva nada parcial.
      campo.select();
      mostrarError("Esa no es la contraseña. Inténtalo otra vez con calma.");
    } finally {
      btn.disabled = false; btn.textContent = "Abrir";
    }
  }

  function entrar(datos) {
    contenido = datos;
    $("pantalla-bloqueo").hidden = true;
    $("pantalla-calendario").hidden = false;
    document.querySelector('meta[name="theme-color"]').setAttribute("content", "#f7efe4");
    pintarCabecera();
    pintarPuertas();
    window.scrollTo(0, 0);
    iniciarMusica();
    Cripto.limpiarMedios(todosLosMedios()).then(function () {
      Cripto.precargar(listaMedios()); // para tenerlo todo sin conexión
    });
    var m = /^#dia-(\d+)$/.exec(location.hash);
    if (m && estaDesbloqueada(+m[1])) mostrarDia(+m[1], false);
  }

  function todosLosMedios() {
    var refs = [];
    (function recorrer(o) {
      if (!o || typeof o !== "object") return;
      if (o.medio && o.medio.m) refs.push(o.medio);
      Object.keys(o).forEach(function (k) { recorrer(o[k]); });
    })(contenido);
    return refs;
  }

  function listaMedios() {
    var refs = [];
    (contenido.general.musicaFondo || []).forEach(function (c) { if (c.medio) refs.push(c.medio); });
    var pesados = [];
    (contenido.dias || []).forEach(function (d) {
      if (!estaDesbloqueada(d.dia)) return; // solo lo ya disponible
      (d.fotos || []).forEach(function (f) { if (f.medio) refs.push(f.medio); });
      if (d.cancion && d.cancion.medio) pesados.push(d.cancion.medio);
      if (d.playlist) (d.playlist.canciones || []).forEach(function (c) { if (c.medio) pesados.push(c.medio); });
      (d.videos || []).forEach(function (v) { if (v.medio) pesados.push(v.medio); });
    });
    refs = refs.concat(pesados);
    return refs;
  }

  async function bloquear() {
    var si = await confirmar("¿Bloquear el calendario en este dispositivo? Habrá que escribir la contraseña otra vez. El progreso se conserva.", "Bloquear");
    if (!si) return;
    Musica.pausarTodo();
    await Cripto.olvidar();
    contenido = null;
    location.replace(location.pathname);
  }

  /* =========================================================
     Música
     ========================================================= */
  function iniciarMusica() {
    var btn = $("btn-musica");
    Musica.configurar(contenido.general.musicaFondo, function (e) {
      btn.hidden = !e.hayLista;
      btn.setAttribute("aria-pressed", String(e.activa));
      btn.setAttribute("aria-label", e.activa ? "Silenciar música de fondo" : "Activar música de fondo");
      btn.classList.toggle("sonando", e.sonando);
      btn.replaceChildren(Arte.icono(e.activa ? "nota" : "silencio"));
    });
    Musica.iniciar();
  }

  /* =========================================================
     Calendario
     ========================================================= */
  function esMarcador(t) { return typeof t === "string" && /^\s*\[[\s\S]*\]\s*$/.test(t); }

  function pintarCabecera() {
    var g = contenido.general || {};
    $("titulo").textContent = g.titulo || "";
    $("dedicatoria").textContent = g.dedicatoria || "";
    $("bienvenida").textContent = g.bienvenida || "";
    $("bienvenida").parentNode.hidden = !g.bienvenida;
    $("mensaje-final").textContent = g.mensajeFinal || "";
    $("firma-final").textContent = g.firma || "";
    document.title = "Adviento"; // el título personalizado nunca va al <title>
  }

  function datosDia(n) {
    return (contenido.dias || []).filter(function (d) { return d.dia === n; })[0] || null;
  }

  function pintarPuertas() {
    var ol = $("puertas");
    vaciar(ol);
    var disponibles = 0, abiertas = 0, hoy = hoyNum();
    for (var n = 1; n <= TOTAL; n++) {
      var libre = estaDesbloqueada(n), vista = !!Progreso.d.abiertas[n];
      if (libre) disponibles++;
      if (vista) abiertas++;
      var li = h("li", null, [crearPuerta(n, libre, vista, hoy === fechaNum(n))]);
      ol.appendChild(li);
    }
    $("progreso-abiertas").textContent = abiertas + (abiertas === 1 ? " abierta" : " abiertas");
    $("progreso-disponibles").textContent = disponibles + " de " + TOTAL + " disponibles";
    $("progreso-ab").style.width = (abiertas / TOTAL * 100) + "%";
    $("progreso-barra").setAttribute("aria-valuenow", abiertas);
    $("progreso-barra").setAttribute("aria-valuetext", abiertas + " puertas abiertas de " + TOTAL);

    var aviso = "", hasta = diasHasta(1);
    if (hasta > 0) aviso = "La primera puerta se abre el 1 de diciembre. " + faltan(hasta).replace(/^f/, "F") + ".";
    else if (hoy > fechaNum(TOTAL)) aviso = "Todas las puertas están abiertas. Vuelve a cualquiera cuando quieras.";
    $("aviso-fecha").textContent = aviso;

    $("final").hidden = !(contenido.general && contenido.general.mensajeFinal); // siempre visible
  }

  function crearPuerta(n, libre, vista, esHoy) {
    var clases = "puerta " + (libre ? (vista ? "puerta--abierta" : "puerta--disponible") : "puerta--bloqueada");
    if (libre && !vista && esHoy) clases += " puerta--hoy";
    var estado = libre ? (vista ? "ya abierta" : "disponible") : "todavía cerrada";
    var b = h("button", { type: "button", class: clases, "aria-label": "Día " + n + ", " + estado }, [
      Arte.svg(Arte.deDia(n), "puerta__arte"),
      h("span", { class: "puerta__num", "aria-hidden": "true", text: dos(n) }),
      !libre ? Arte.icono("candado", "puerta__candado") : null
    ]);
    b.addEventListener("click", function () { tocarPuerta(n, b); });
    return b;
  }

  function tocarPuerta(n, boton) {
    if (!estaDesbloqueada(n)) {
      boton.classList.remove("sacudir"); void boton.offsetWidth; boton.classList.add("sacudir");
      var f = diasHasta(n);
      avisar("Todavía no… paciencia, que la magia también necesita su tiempo. Se abre el " + fechaLarga(n) + (f > 0 ? " (" + faltan(f) + ")." : "."));
      return;
    }
    if (boton.classList.contains("abriendo")) return;
    boton.classList.add("abriendo");
    setTimeout(function () { boton.classList.remove("abriendo"); mostrarDia(n, true); }, reduceMov ? 0 : 380);
  }

  /* =========================================================
     Vista de un día
     ========================================================= */
  function mostrarDia(n, historial) {
    var d = datosDia(n);
    if (diaAbierto == null) scrollCalendario = window.scrollY;
    else Musica.detenerPista();
    diaAbierto = n;
    if (historial) history.pushState({ dia: n }, "", "#dia-" + n);

    var cuerpo = $("dia-cuerpo");
    vaciar(cuerpo);
    $("dia-fecha").textContent = (n > NORMALES ? "Día extra · " : "") + n + " de diciembre";

    var tira = h("div", { class: "dia__banner", "aria-hidden": "true" });
    [-2, -1, 0, 1, 2].forEach(function (k) {
      var m = ((n - 1 + k + TOTAL) % TOTAL) + 1;
      tira.appendChild(h("div", { class: "dia__mosaico" + (k ? "" : " dia__mosaico--hoy") }, [
        Arte.svg(Arte.deDia(m)), k ? null : h("span", { class: "puerta__num", text: dos(n) })
      ]));
    });
    cuerpo.appendChild(tira);
    cuerpo.appendChild(h("h1", { class: "dia__titulo", id: "dia-titulo", text: d && d.titulo ? d.titulo : "Día " + n }));

    if (!d) {
      cuerpo.appendChild(h("p", { class: "vacio", text: "Esta puerta todavía está vacía." }));
    } else {
      var fotos = pintarFotos(d.fotos);
      if (fotos) cuerpo.appendChild(h("section", { class: "bloque" }, [fotos]));
      var videos = pintarVideos(d.videos);
      if (videos) cuerpo.appendChild(h("section", { class: "bloque" }, [videos]));
      if (d.carta) cuerpo.appendChild(h("section", { class: "bloque" }, [pintarCarta(d)]));
      if (d.vale) cuerpo.appendChild(h("section", { class: "bloque" }, [
        h("h2", { class: "bloque__titulo", text: "Tu vale de hoy" }), pintarVale(d)
      ]));
      if (d.playlist) cuerpo.appendChild(h("section", { class: "bloque" }, [Musica.lista(d.playlist).elemento]));
      if (d.cancion) cuerpo.appendChild(h("section", { class: "bloque" }, [
        h("h2", { class: "bloque__titulo", text: "Una canción para ti" }), pintarCancion(d.cancion)
      ]));
      (d.juegos || []).forEach(function (cfg, i) {
        var c2 = Object.assign({}, cfg);
        if (c2.titulo === d.titulo) c2.titulo = ""; // no repetir el título del día
        var j = Juegos.crear(c2, ctxJuego("d" + n + "-" + i));
        if (j) cuerpo.appendChild(h("section", { class: "bloque" }, [j]));
      });
    }

    $("pantalla-calendario").hidden = true;
    $("pantalla-dia").hidden = false;
    var pd = $("pantalla-dia");
    pd.style.animation = "none"; void pd.offsetWidth; pd.style.animation = "";
    window.scrollTo(0, 0);
    $("btn-volver").focus({ preventScroll: true });

    if (!Progreso.d.abiertas[n]) {
      Progreso.d.abiertas[n] = new Date().toISOString();
      Progreso.guardar();
    }
  }

  function cerrarDia(desdeHistorial) {
    if (diaAbierto == null) return;
    var n = diaAbierto;
    diaAbierto = null;
    Musica.detenerPista();
    $("pantalla-dia").hidden = true;
    vaciar($("dia-cuerpo")); // no dejar contenido en el DOM oculto
    $("pantalla-calendario").hidden = false;
    pintarPuertas();
    window.scrollTo(0, scrollCalendario);
    if (!desdeHistorial && history.state && history.state.dia) history.back();
    var btn = document.querySelectorAll(".puerta")[n - 1];
    if (btn) btn.focus({ preventScroll: true });
  }

  function pintarCarta(d) {
    var larga = d.tipo === "carta";
    var papel = h("div", { class: "carta" + (larga ? " carta--larga" : "") });
    String(d.carta).split(/\n\s*\n/).forEach(function (parrafo) {
      var p = h("p");
      if (esMarcador(parrafo)) p.appendChild(h("span", { class: "marcador", text: parrafo.trim() }));
      else p.textContent = parrafo.trim();
      papel.appendChild(p);
    });
    var firma = contenido.general && contenido.general.firma;
    if (larga && firma && !esMarcador(firma)) papel.appendChild(h("p", { class: "firma", text: firma }));
    return papel;
  }

  function pintarFotos(lista) {
    if (!lista || !lista.length) return null;
    var cont = h("div", { class: "fotos" });
    lista.forEach(function (f) {
      var pie = f.pie && !esMarcador(f.pie) ? f.pie : "";
      if (f.medio) {
        var img = h("img", { alt: pie || "Fotografía del día", decoding: "async" });
        var fig = h("figure", { class: "foto foto--cargando" }, [img, pie ? h("figcaption", { text: pie }) : null]);
        Cripto.medio(f.medio).then(function (url) { img.src = url; fig.classList.remove("foto--cargando"); })
          .catch(function () { fig.replaceWith(h("figure", { class: "foto foto--pendiente" }, [h("span", { text: "No se pudo cargar la foto. Ábrela con conexión una vez." })])); });
        cont.appendChild(fig);
      } else if (f.estado !== "opcional") {
        cont.appendChild(h("figure", { class: "foto foto--pendiente" }, [h("span", { text: "[FOTO] " + (f.descripcion || "") })]));
      }
    });
    return cont.childElementCount ? cont : null;
  }

  /* ---------- Videos ----------
     sonido: false -> en bucle, sin sonido y la música de fondo sigue.
     sonido: true  -> con controles; pausa la música mientras se reproduce. */
  function pintarVideos(lista) {
    if (!lista || !lista.length) return null;
    var cont = h("div", { class: "fotos" });
    lista.forEach(function (v) {
      if (!v.medio) {
        cont.appendChild(h("figure", { class: "foto foto--pendiente" }, [h("span", { text: "[VIDEO] " + (v.descripcion || "") })]));
        return;
      }
      var pie = v.pie && !esMarcador(v.pie) ? v.pie : "";
      var video = h("video", { playsinline: true, preload: "metadata", class: "video" });
      video.setAttribute("webkit-playsinline", "");
      video.disablePictureInPicture = true;
      if (v.sonido) {
        video.controls = true;
        video.addEventListener("play", function () { Musica.ocupar(); });
        video.addEventListener("pause", function () { Musica.liberar(); });
        video.addEventListener("ended", function () { Musica.liberar(); });
      } else {
        video.muted = true; video.defaultMuted = true; video.loop = true; video.autoplay = true;
        video.setAttribute("muted", "");
        video.addEventListener("click", function () { if (video.paused) video.play().catch(function () {}); else video.pause(); });
      }
      var fig = h("figure", { class: "foto foto--video foto--cargando" }, [video, pie ? h("figcaption", { text: pie }) : null]);
      Cripto.medio(v.medio).then(function (url) {
        video.src = url; fig.classList.remove("foto--cargando");
        if (!v.sonido) video.play().catch(function () {});
      }).catch(function () {
        fig.replaceWith(h("figure", { class: "foto foto--pendiente" }, [h("span", { text: "No se pudo cargar el video. Ábrelo con conexión una vez." })]));
      });
      cont.appendChild(fig);
    });
    return cont.childElementCount ? cont : null;
  }

  /* ---------- Vales ---------- */
  function pintarVale(d) {
    var id = "dia-" + d.dia, v = d.vale;
    var usado = Progreso.d.vales[id];
    var caja = h("div", { class: "vale" + (usado ? " vale--usado" : "") }, [
      h("p", { class: "vale__tipo", text: "Vale por" }),
      h("p", { class: "vale__titulo", text: v.titulo || "Un detalle" }),
      v.descripcion ? h("p", { class: "vale__desc", text: v.descripcion }) : null,
      h("div", { class: "vale__acciones" }, usado ? [
        h("span", { class: "vale__sello", text: "Canjeado" }),
        h("button", { type: "button", class: "enlace", text: "Deshacer", onclick: async function () {
          if (!(await confirmar("¿Deshacer el canje de este vale?", "Deshacer"))) return;
          delete Progreso.d.vales[id]; Progreso.guardar(); caja.replaceWith(pintarVale(d));
        } })
      ] : [
        h("button", { type: "button", class: "boton boton--rojo", text: "Canjear", onclick: async function () {
          if (!(await confirmar("¿Canjear «" + (v.titulo || "este vale") + "»?", "Canjear"))) return;
          Progreso.d.vales[id] = { fecha: new Date().toISOString() }; Progreso.guardar(); caja.replaceWith(pintarVale(d));
        } })
      ])
    ]);
    return caja;
  }

  function pintarCancion(c) {
    if (!c.medio) {
      return h("div", { class: "cancion cancion--pendiente" }, [
        h("p", { text: "[CANCIÓN] " + (c.descripcion || "") })
      ]);
    }
    var r = Musica.reproductor(c);
    var nota = c.texto && !esMarcador(c.texto) ? c.texto : (c.texto || "");
    return h("div", { class: "cancion" }, [
      h("div", { class: "cancion__fila" }, [
        r.boton,
        h("div", { class: "cancion__datos" }, [
          h("p", { class: "cancion__titulo", text: c.titulo || "Canción" }),
          c.artista ? h("p", { class: "cancion__artista", text: c.artista }) : null
        ])
      ]),
      r.elemento,
      nota ? h("p", { class: "cancion__nota", text: nota }) : null
    ]);
  }

  /* =========================================================
     Juegos: estado guardado (solo índices, nada personal)
     ========================================================= */
  function ctxJuego(id) {
    return {
      id: id,
      leer: function (k) { return Progreso.d.juegos[k]; },
      escribir: function (k, v) { Progreso.d.juegos[k] = v; Progreso.guardar(); },
      confirmar: confirmar
    };
  }

  /* =========================================================
     Service Worker
     ========================================================= */
  function registrarSW() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    var habiaControlador = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register("sw.js", { scope: "./" }).then(function (reg) {
      var ultima = Date.now();
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible" && Date.now() - ultima > 30 * 60 * 1000) {
          ultima = Date.now(); reg.update().catch(function () {});
        }
      });
    }).catch(function () { /* sin SW: la app funciona igual con conexión */ });
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!habiaControlador) { habiaControlador = true; return; }
      avisar("Hay una versión nueva del calendario.", "Actualizar", function () { location.reload(); }, 15000);
    });
  }

  /* =========================================================
     Inicio
     ========================================================= */
  async function iniciar() {
    Progreso.cargar();
    pintarMosaico();
    $("volver-icono").appendChild(Arte.icono("atras"));
    registrarSW();

    $("form-clave").addEventListener("submit", alEnviarClave);
    $("btn-bloquear").addEventListener("click", bloquear);
    $("btn-volver").addEventListener("click", function () { cerrarDia(false); });
    $("btn-musica").addEventListener("click", function () { Musica.alternar(); });
    window.addEventListener("popstate", function () {
      if (!contenido) return;
      var m = /^#dia-(\d+)$/.exec(location.hash);
      if (m && estaDesbloqueada(+m[1])) mostrarDia(+m[1], false);
      else cerrarDia(true);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && diaAbierto != null && $("confirmar").hidden) cerrarDia(false);
    });

    // ¿Hay un desbloqueo recordado en este dispositivo?
    if (Cripto.disponible() && Cripto.hayContenido()) {
      var btn = $("btn-abrir");
      btn.disabled = true; btn.textContent = "Abriendo…";
      var datos = null;
      try { datos = await Cripto.abrirRecordado(); } catch (e) { datos = null; }
      btn.disabled = false; btn.textContent = "Abrir";
      if (datos) return entrar(datos);
    }
    if (location.hash) history.replaceState(null, "", location.pathname);
  }

  // Al volver a la app tras medianoche, refrescar el estado de las puertas
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && contenido && diaAbierto == null) pintarPuertas();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
