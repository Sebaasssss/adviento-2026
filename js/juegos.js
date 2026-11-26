/*
 * Mini juegos: trivia, memorama, sopa de letras, adivinanzas, mímica y noche de película.
 * Todos se construyen con DOM (textContent), sin innerHTML con datos,
 * funcionan con tacto y ratón, y no necesitan conexión.
 */
(function () {
  "use strict";

  /* ---------- utilidades ---------- */
  function h(tag, props, hijos) {
    var e = document.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v == null || v === false) continue;
        if (k === "class") e.className = v;
        else if (k === "text") e.textContent = v;
        else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
        else if (k === "dataset") for (var d in v) e.dataset[d] = v[d];
        else if (v === true) e.setAttribute(k, "");
        else e.setAttribute(k, v);
      }
    }
    [].concat(hijos || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }
  function vaciar(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  function barajar(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function normalizar(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9ñ ]/g, " ").replace(/\s+/g, " ").trim();
  }
  function boton(texto, clase, onclick) {
    return h("button", { type: "button", class: "boton " + (clase || "boton--borde"), onclick: onclick, text: texto });
  }
  function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* =========================================================
     A) TRIVIA
     ========================================================= */
  function trivia(cfg) {
    var raiz = h("div");
    var preguntas = (cfg.preguntas || []).filter(function (p) { return p && p.pregunta && p.opciones && p.opciones.length; });
    var idx, puntos;

    function iniciar() { idx = 0; puntos = 0; pintar(); }

    function pintar() {
      vaciar(raiz);
      if (!preguntas.length) { raiz.appendChild(h("p", { class: "vacio", text: "Todavía no hay preguntas." })); return; }
      if (idx >= preguntas.length) return final();
      var p = preguntas[idx];
      var correcta = p.opciones[p.correcta || 0];
      var fb = h("p", { class: "feedback", "aria-live": "polite" });
      var sig = boton(idx + 1 < preguntas.length ? "Siguiente" : "Ver resultado", "boton--rojo", function () { idx++; pintar(); });
      sig.hidden = true;
      var opciones = h("div", { class: "juego__opciones" });
      barajar(p.opciones).forEach(function (texto) {
        opciones.appendChild(h("button", {
          type: "button", class: "opcion", text: texto,
          onclick: function (ev) {
            var botones = opciones.querySelectorAll("button");
            botones.forEach(function (b) {
              b.disabled = true;
              if (b.textContent === correcta) b.classList.add("opcion--ok");
            });
            var acierto = texto === correcta;
            if (acierto) { puntos++; fb.className = "feedback feedback--ok"; fb.textContent = "¡Correcto!"; vibrar(20); }
            else { ev.currentTarget.classList.add("opcion--mal"); fb.className = "feedback feedback--mal"; fb.textContent = "Casi… la respuesta era: " + correcta; vibrar([30, 40, 30]); }
            if (p.comentario) fb.appendChild(h("span", { text: " " + p.comentario }));
            sig.hidden = false; sig.focus({ preventScroll: true });
          }
        }));
      });
      raiz.appendChild(h("div", { class: "juego__marcador" }, [
        h("span", { text: "Pregunta " + (idx + 1) + " de " + preguntas.length }),
        h("span", { text: "Puntos: " + puntos })
      ]));
      raiz.appendChild(h("p", { class: "juego__pregunta", text: p.pregunta }));
      raiz.appendChild(opciones);
      raiz.appendChild(fb);
      raiz.appendChild(h("div", { class: "juego__botones" }, [sig]));
    }

    function final() {
      var r = puntos / preguntas.length;
      var msg = r === 1 ? "¡Perfecto! Me conoces de memoria." :
        r >= .6 ? "¡Muy bien! Casi todo." :
        r > 0 ? "Nada mal… pero esto merece una revancha." : "Ups… ¡te toca repasar nuestra historia conmigo!";
      raiz.appendChild(h("div", { class: "resultado" }, [
        h("p", { text: "Resultado" }),
        h("p", { class: "resultado__grande", text: puntos + " / " + preguntas.length }),
        h("p", { text: msg }),
        h("div", { class: "juego__botones" }, [boton("Volver a jugar", "boton--rojo", iniciar)])
      ]));
    }

    iniciar();
    return raiz;
  }

  /* =========================================================
     B) MEMORAMA
     ========================================================= */
  function memorama(cfg) {
    var simbolos = (cfg.motivos && cfg.motivos.length >= 2 ? cfg.motivos : Arte.lista.slice(0, 8)).slice(0, 8);
    var raiz = h("div");
    var intentos, pares, vistas, bloqueo;
    var mIntentos = h("span"), mPares = h("span");
    var tablero = h("div", { class: "memorama", role: "grid" });
    var fin = h("div", { class: "resultado" });

    function marcador() {
      mIntentos.textContent = "Intentos: " + intentos;
      mPares.textContent = "Parejas: " + pares + " / " + simbolos.length;
    }

    function iniciar() {
      intentos = 0; pares = 0; vistas = []; bloqueo = false;
      vaciar(tablero); vaciar(fin); fin.hidden = true;
      barajar(simbolos.concat(simbolos)).forEach(function (s, i) {
        var carta = h("button", { type: "button", class: "carta-m", "aria-label": "Carta " + (i + 1) + ", boca abajo" }, [
          h("span", { class: "carta-m__giro" }, [
            h("span", { class: "carta-m__cara carta-m__dorso", "aria-hidden": "true" }, [Arte.icono("destello")]),
            h("span", { class: "carta-m__cara carta-m__frente", "aria-hidden": "true" }, [Arte.svg(s)])
          ])
        ]);
        carta.dataset.simbolo = s;
        carta.addEventListener("click", function () { voltear(carta); });
        tablero.appendChild(carta);
      });
      marcador();
    }

    function voltear(c) {
      if (bloqueo || c.classList.contains("carta-m--vista") || c.classList.contains("carta-m--hecha")) return;
      c.classList.add("carta-m--vista");
      c.setAttribute("aria-label", "Carta: " + c.dataset.simbolo);
      vistas.push(c);
      if (vistas.length < 2) return;
      intentos++;
      var a = vistas[0], b = vistas[1];
      vistas = [];
      if (a.dataset.simbolo === b.dataset.simbolo) {
        a.classList.add("carta-m--hecha"); b.classList.add("carta-m--hecha");
        a.disabled = b.disabled = true;
        pares++; vibrar(20); marcador();
        if (pares === simbolos.length) ganar();
      } else {
        bloqueo = true; marcador();
        setTimeout(function () {
          [a, b].forEach(function (x) { x.classList.remove("carta-m--vista"); x.setAttribute("aria-label", "Carta boca abajo"); });
          bloqueo = false;
        }, 850);
      }
    }

    function ganar() {
      fin.hidden = false;
      fin.appendChild(h("p", { class: "resultado__grande", text: "¡Lo lograste!" }));
      fin.appendChild(h("p", { text: "Encontraste las " + simbolos.length + " parejas en " + intentos + " intentos." }));
    }

    raiz.appendChild(h("div", { class: "juego__marcador" }, [mIntentos, mPares]));
    raiz.appendChild(tablero);
    raiz.appendChild(fin);
    raiz.appendChild(h("div", { class: "juego__botones" }, [boton("Reiniciar", "boton--borde", iniciar)]));
    iniciar();
    return raiz;
  }

  /* =========================================================
     C) SOPA DE LETRAS
     ========================================================= */
  var LETRAS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ";
  var DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1]];

  function limpiarPalabra(p) {
    return String(p).toUpperCase().normalize("NFD").replace(/Ñ/g, "Ñ").replace(/[̀-ͯ]/g, "").replace(/[^A-ZÑ]/g, "");
  }

  function generarSopa(palabras, n) {
    for (var intento = 0; intento < 60; intento++) {
      var g = [], ok = true, colocadas = [];
      for (var r = 0; r < n; r++) { g.push([]); for (var c = 0; c < n; c++) g[r].push(""); }
      var orden = palabras.slice().sort(function (a, b) { return b.length - a.length; });
      for (var w = 0; w < orden.length && ok; w++) {
        var pal = orden[w], puesta = false;
        for (var t = 0; t < 250 && !puesta; t++) {
          var d = DIRS[Math.floor(Math.random() * DIRS.length)];
          var r0 = Math.floor(Math.random() * n), c0 = Math.floor(Math.random() * n);
          var r1 = r0 + d[0] * (pal.length - 1), c1 = c0 + d[1] * (pal.length - 1);
          if (r1 < 0 || r1 >= n || c1 < 0 || c1 >= n) continue;
          var cabe = true;
          for (var i = 0; i < pal.length; i++) {
            var x = g[r0 + d[0] * i][c0 + d[1] * i];
            if (x && x !== pal[i]) { cabe = false; break; }
          }
          if (!cabe) continue;
          for (i = 0; i < pal.length; i++) g[r0 + d[0] * i][c0 + d[1] * i] = pal[i];
          colocadas.push(pal); puesta = true;
        }
        if (!puesta) ok = false;
      }
      if (!ok) continue;
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (!g[r][c]) g[r][c] = LETRAS[Math.floor(Math.random() * LETRAS.length)];
      return g;
    }
    return null;
  }

  function sopa(cfg) {
    var n = Math.max(6, Math.min(12, cfg.tamano || 10));
    var palabras = (cfg.palabras || []).map(limpiarPalabra).filter(function (p, i, a) { return p.length >= 2 && p.length <= n && a.indexOf(p) === i; });
    var raiz = h("div");
    var tablero = h("div", { class: "sopa", "aria-label": "Tablero de sopa de letras" });
    tablero.style.gridTemplateColumns = "repeat(" + n + ", minmax(0, 1fr))";
    var lista = h("ul", { class: "palabras" });
    var progreso = h("span"), fin = h("div", { class: "resultado" });
    var celdas, halladas, inicio, actual, pendiente, arrastrando;

    function celdaEn(x, y) {
      var e = document.elementFromPoint(x, y);
      return e && e.classList && e.classList.contains("celda") && tablero.contains(e) ? e : null;
    }
    function rc(e) { return [+e.dataset.r, +e.dataset.c]; }
    function linea(a, b) {
      var p = rc(a), q = rc(b), dr = q[0] - p[0], dc = q[1] - p[1];
      if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
      var len = Math.max(Math.abs(dr), Math.abs(dc)), sr = Math.sign(dr), sc = Math.sign(dc), out = [];
      for (var i = 0; i <= len; i++) out.push(celdas[p[0] + sr * i][p[1] + sc * i]);
      return out;
    }
    function quitarSel() { tablero.querySelectorAll(".celda--sel").forEach(function (e) { e.classList.remove("celda--sel"); }); }
    function marcarSel(sel) { quitarSel(); (sel || []).forEach(function (e) { e.classList.add("celda--sel"); }); }
    function actualizar() {
      progreso.textContent = "Encontradas: " + halladas.length + " / " + palabras.length;
      lista.querySelectorAll("li").forEach(function (li) { li.classList.toggle("hallada", halladas.indexOf(li.dataset.p) >= 0); });
    }
    function comprobar(sel) {
      if (!sel || sel.length < 2) return false;
      var s = sel.map(function (e) { return e.textContent; }).join("");
      var inv = s.split("").reverse().join("");
      var p = palabras.indexOf(s) >= 0 ? s : palabras.indexOf(inv) >= 0 ? inv : null;
      if (!p || halladas.indexOf(p) >= 0) return false;
      halladas.push(p);
      sel.forEach(function (e) { e.classList.add("celda--hallada"); });
      vibrar(25); actualizar();
      if (halladas.length === palabras.length) {
        fin.hidden = false; vaciar(fin);
        fin.appendChild(h("p", { class: "resultado__grande", text: "¡Todas!" }));
        fin.appendChild(h("p", { text: "Encontraste las " + palabras.length + " palabras." }));
      }
      return true;
    }
    function limpiarPendiente() { if (pendiente) pendiente.classList.remove("celda--inicio"); pendiente = null; }

    tablero.addEventListener("pointerdown", function (ev) {
      var c = celdaEn(ev.clientX, ev.clientY);
      if (!c) return;
      ev.preventDefault();
      arrastrando = true; inicio = c; actual = c;
      try { tablero.setPointerCapture(ev.pointerId); } catch (e) {}
      marcarSel([c]);
    });
    tablero.addEventListener("pointermove", function (ev) {
      if (!arrastrando) return;
      var c = celdaEn(ev.clientX, ev.clientY);
      if (!c || c === actual) return;
      var l = linea(inicio, c);
      if (l) { actual = c; marcarSel(l); }
    });
    function soltar(ev) {
      if (!arrastrando) return;
      arrastrando = false;
      if (ev.type === "pointercancel") { quitarSel(); return; }
      if (actual === inicio) {
        // modo toque: primera letra y luego última
        if (pendiente && pendiente !== inicio) {
          var l = linea(pendiente, inicio);
          limpiarPendiente();
          if (l) { marcarSel(l); comprobar(l); setTimeout(quitarSel, 250); }
          else quitarSel();
        } else if (pendiente === inicio) { limpiarPendiente(); quitarSel(); }
        else { quitarSel(); pendiente = inicio; pendiente.classList.add("celda--inicio"); }
        return;
      }
      limpiarPendiente();
      comprobar(linea(inicio, actual));
      setTimeout(quitarSel, 250);
    }
    tablero.addEventListener("pointerup", soltar);
    tablero.addEventListener("pointercancel", soltar);
    tablero.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    function iniciar() {
      var g = generarSopa(palabras, n);
      vaciar(tablero); vaciar(lista); vaciar(fin); fin.hidden = true;
      halladas = []; pendiente = null; celdas = [];
      if (!g) { tablero.appendChild(h("p", { text: "No se pudo crear el tablero con estas palabras." })); return; }
      for (var r = 0; r < n; r++) {
        celdas.push([]);
        for (var c = 0; c < n; c++) {
          var e = h("div", { class: "celda", text: g[r][c] });
          e.dataset.r = r; e.dataset.c = c;
          celdas[r].push(e); tablero.appendChild(e);
        }
      }
      palabras.forEach(function (p) { var li = h("li", { text: p }); li.dataset.p = p; lista.appendChild(li); });
      actualizar();
    }

    raiz.appendChild(h("div", { class: "juego__marcador" }, [progreso]));
    raiz.appendChild(tablero);
    raiz.appendChild(lista);
    raiz.appendChild(fin);
    raiz.appendChild(h("div", { class: "juego__botones" }, [boton("Reiniciar", "boton--borde", iniciar)]));
    iniciar();
    return raiz;
  }

  /* =========================================================
     D) ADIVINANZAS
     ========================================================= */
  function adivinanzas(cfg) {
    var lista = (cfg.adivinanzas || []).filter(function (a) { return a && a.pregunta; });
    var raiz = h("div");
    var idx, aciertos;

    function iniciar() { idx = 0; aciertos = 0; pintar(); }

    function pintar() {
      vaciar(raiz);
      if (!lista.length) { raiz.appendChild(h("p", { class: "vacio", text: "Todavía no hay adivinanzas." })); return; }
      if (idx >= lista.length) {
        raiz.appendChild(h("div", { class: "resultado" }, [
          h("p", { text: "Adivinaste" }),
          h("p", { class: "resultado__grande", text: aciertos + " / " + lista.length }),
          h("p", { text: aciertos === lista.length ? "¡Eres una experta!" : "¡Bien jugado!" }),
          h("div", { class: "juego__botones" }, [boton("Volver a empezar", "boton--rojo", iniciar)])
        ]));
        return;
      }
      var a = lista[idx], resuelta = false;
      var respuestas = [].concat(a.respuestas || a.respuesta || []).map(normalizar);
      var campo = h("input", { class: "campo", type: "text", placeholder: "Tu respuesta", autocomplete: "off", autocapitalize: "off", autocorrect: "off", spellcheck: "false", enterkeyhint: "done", "aria-label": "Tu respuesta" });
      var pista = h("p", { class: "adivinanza__pista", hidden: true, text: "Pista: " + (a.pista || "no hay pista para esta.") });
      var fb = h("p", { class: "feedback", "aria-live": "polite" });
      var bPista = boton("Pista", "boton--borde", function () { pista.hidden = false; bPista.disabled = true; });
      var bComprobar = boton("Comprobar", "boton--rojo", comprobar);
      var bRendir = boton("Me rindo", "boton--borde", function () { terminar(false, true); });
      var bSig = boton(idx + 1 < lista.length ? "Siguiente adivinanza" : "Ver resultado", "boton--rojo", function () { idx++; pintar(); });
      bSig.hidden = true;

      function terminar(acierto, rendida) {
        resuelta = true; campo.disabled = true;
        bComprobar.hidden = bPista.hidden = bRendir.hidden = true; bSig.hidden = false;
        var real = [].concat(a.respuestas || a.respuesta || [])[0] || "";
        if (acierto) { aciertos++; fb.className = "feedback feedback--ok"; fb.textContent = "¡Correcto! Era «" + real + "»."; vibrar(20); }
        else if (rendida) { fb.className = "feedback"; fb.textContent = "La respuesta era «" + real + "»."; }
        bSig.focus({ preventScroll: true });
      }
      function comprobar() {
        if (resuelta) return;
        var v = normalizar(campo.value);
        if (!v) { fb.className = "feedback"; fb.textContent = "Escribe algo primero."; return; }
        if (respuestas.indexOf(v) >= 0 || respuestas.some(function (r) { return r && v.split(" ").indexOf(r) >= 0 && r.length > 3; })) terminar(true);
        else { fb.className = "feedback feedback--mal"; fb.textContent = "Mmm… no es eso. ¡Inténtalo otra vez!"; vibrar([30, 40, 30]); }
      }
      campo.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); comprobar(); } });

      raiz.appendChild(h("div", { class: "juego__marcador" }, [
        h("span", { text: "Adivinanza " + (idx + 1) + " de " + lista.length }),
        h("span", { text: "Aciertos: " + aciertos })
      ]));
      raiz.appendChild(h("p", { class: "juego__pregunta", text: a.pregunta }));
      raiz.appendChild(campo);
      raiz.appendChild(pista);
      raiz.appendChild(fb);
      raiz.appendChild(h("div", { class: "juego__botones" }, [bComprobar, bPista, bRendir, bSig]));
    }

    iniciar();
    return raiz;
  }

  /* =========================================================
     E) MÍMICA — papelitos al azar, temporizador y marcador
     ========================================================= */
  function mimica(cfg) {
    var jugadores = (cfg.jugadores && cfg.jugadores.length >= 2 ? cfg.jugadores : ["Jugador 1", "Jugador 2"]).slice(0, 2);
    var segundos = Math.max(15, Math.min(180, cfg.segundos || 60));
    var banco = [];
    var cats = cfg.papelitos || {};
    Object.keys(cats).forEach(function (cat) { (cats[cat] || []).forEach(function (p) { banco.push({ cat: cat, texto: p }); }); });
    var raiz = h("div", { class: "mimica" });
    var tazon, puntos, turno, papel, timer, restante;
    var refrescarReloj = function () {};

    function parar() { clearInterval(timer); timer = null; }
    function reiniciar() { tazon = barajar(banco); puntos = [0, 0]; turno = 0; papel = null; parar(); pintar(); }
    function siguienteTurno() { turno = 1 - turno; papel = null; parar(); pintar(); }

    function marcador() {
      return h("div", { class: "mimica__marcador" }, jugadores.map(function (n, i) {
        return h("div", { class: "mimica__jugador" + (i === turno ? " mimica__jugador--turno" : "") }, [
          h("span", { class: "mimica__nombre", text: n }), h("span", { class: "mimica__puntos", text: String(puntos[i]) })
        ]);
      }));
    }

    function pintar(estado) {
      if (!raiz.isConnected && timer) parar();
      vaciar(raiz);
      raiz.appendChild(marcador());
      if (!banco.length) { raiz.appendChild(h("p", { class: "vacio", text: "No hay papelitos." })); return; }

      if (!papel) {
        raiz.appendChild(h("p", { class: "mimica__turno" }, ["Turno de ", h("strong", { text: jugadores[turno] }), ": saca un papelito y actúalo sin hablar."]));
        raiz.appendChild(h("div", { class: "mimica__tazon", "aria-hidden": "true" }, [h("span"), h("span"), h("span"), h("span"), h("span")]));
        raiz.appendChild(h("p", { class: "mimica__quedan", text: tazon.length ? "Quedan " + tazon.length + " papelitos" : "Se acabaron los papelitos" }));
        raiz.appendChild(h("div", { class: "juego__botones" }, [
          tazon.length ? boton("Sacar papelito", "boton--rojo", function () { papel = tazon.pop(); restante = segundos; vibrar(15); pintar("visto"); })
            : boton("Volver a llenar", "boton--rojo", function () { tazon = barajar(banco); pintar(); }),
          boton("Reiniciar", "boton--borde", reiniciar)
        ]));
        return;
      }

      raiz.appendChild(h("div", { class: "papelito" + (estado === "visto" ? " papelito--nuevo" : "") }, [
        h("span", { class: "papelito__cat", text: papel.cat }),
        h("span", { class: "papelito__texto", text: papel.texto })
      ]));

      var seg = h("span", { class: "mimica__seg" }), relleno = h("i");
      var reloj = h("div", { class: "mimica__reloj" }, [seg, h("span", { class: "mimica__barra" }, [relleno])]);
      function pintarReloj() {
        seg.textContent = String(restante);
        relleno.style.width = (restante / segundos * 100) + "%";
        reloj.classList.toggle("mimica__reloj--poco", restante <= 10);
      }
      pintarReloj();
      refrescarReloj = pintarReloj;
      raiz.appendChild(reloj);

      if (estado === "fin") {
        raiz.appendChild(h("p", { class: "feedback feedback--mal", text: "¡Se acabó el tiempo!" }));
        raiz.appendChild(h("div", { class: "juego__botones" }, [boton("Siguiente turno", "boton--rojo", siguienteTurno)]));
      } else if (estado === "acierto") {
        raiz.appendChild(h("p", { class: "feedback feedback--ok", text: "¡Adivinado! Punto para " + jugadores[turno] + "." }));
        raiz.appendChild(h("div", { class: "juego__botones" }, [boton("Siguiente turno", "boton--rojo", siguienteTurno)]));
      } else if (!timer) {
        raiz.appendChild(h("div", { class: "juego__botones" }, [
          boton("Empezar (" + segundos + " s)", "boton--rojo", function () {
            timer = setInterval(function () {
              if (!raiz.isConnected) { parar(); return; }
              restante--; refrescarReloj();
              if (restante <= 0) { parar(); vibrar([80, 60, 80]); pintar("fin"); }
            }, 1000);
            pintar("corriendo");
          }),
          boton("Otro papelito", "boton--borde", function () { if (tazon.length) { papel = tazon.pop(); pintar("visto"); } })
        ]));
      } else {
        raiz.appendChild(h("div", { class: "juego__botones" }, [
          boton("¡Adivinó!", "boton--rojo", function () { parar(); puntos[turno]++; vibrar(30); pintar("acierto"); }),
          boton("Pasar", "boton--borde", function () { parar(); siguienteTurno(); })
        ]));
      }
    }

    reiniciar();
    return raiz;
  }

  /* =========================================================
     F) NOCHE DE PELÍCULA — moneda (quién elige) y ruleta (género)
     ========================================================= */
  var COLORES_RULETA = ["#c8102e", "#f3b5c3", "#c99a5b", "#fff7ec", "#9b0d22", "#f9d5dd", "#b8864a", "#fffaf3"];
  var TINTA_RULETA = ["#fff7ec", "#9b0d22", "#fff7ec", "#c8102e", "#fff7ec", "#9b0d22", "#fff7ec", "#c8102e"];

  function pelicula(cfg) {
    var jugadores = (cfg.jugadores && cfg.jugadores.length >= 2 ? cfg.jugadores : ["Cara", "Cruz"]).slice(0, 2);
    var generos = (cfg.generos && cfg.generos.length >= 2 ? cfg.generos : ["Comedia", "Romance", "Terror", "Acción", "Animada", "Navideña", "Suspenso", "Drama"]).slice(0, 12);
    var raiz = h("div", { class: "pelicula" });
    var quien = null, genero = null, giroMoneda = 0, giroRuleta = 0, ocupadoM = false, ocupadoR = false;

    /* Moneda */
    var moneda = h("div", { class: "moneda" }, [
      h("div", { class: "moneda__cara moneda__cara--a" }, [h("span", { text: jugadores[0] })]),
      h("div", { class: "moneda__cara moneda__cara--b" }, [h("span", { text: jugadores[1] })])
    ]);
    var monedaCaja = h("div", { class: "moneda__caja" }, [moneda]);
    var resMoneda = h("p", { class: "pelicula__res", "aria-live": "polite" });
    var bMoneda = boton("Lanzar moneda", "boton--rojo", function () {
      if (ocupadoM) return;
      ocupadoM = true; bMoneda.disabled = true; resMoneda.textContent = "";
      var lado = Math.random() < 0.5 ? 0 : 1;
      giroMoneda = giroMoneda - (giroMoneda % 360) + 360 * 6 + (lado ? 180 : 0);
      monedaCaja.classList.remove("moneda__caja--salto"); void monedaCaja.offsetWidth; monedaCaja.classList.add("moneda__caja--salto");
      moneda.style.transform = "rotateY(" + giroMoneda + "deg)";
      setTimeout(function () {
        quien = jugadores[lado];
        resMoneda.textContent = "Elige la película: " + quien;
        ocupadoM = false; bMoneda.disabled = false; bMoneda.textContent = "Lanzar otra vez";
        vibrar(30); resumen();
      }, 1700);
    });

    /* Ruleta */
    var n = generos.length, paso = 360 / n;
    var svgNS = "http://www.w3.org/2000/svg";
    var rueda = document.createElementNS(svgNS, "svg");
    rueda.setAttribute("viewBox", "-100 -100 200 200");
    rueda.setAttribute("class", "ruleta__rueda");
    rueda.setAttribute("aria-hidden", "true");
    generos.forEach(function (g, i) {
      var a0 = (i * paso - 90) * Math.PI / 180, a1 = ((i + 1) * paso - 90) * Math.PI / 180;
      var path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", "M0 0 L" + (96 * Math.cos(a0)).toFixed(2) + " " + (96 * Math.sin(a0)).toFixed(2) +
        " A96 96 0 0 1 " + (96 * Math.cos(a1)).toFixed(2) + " " + (96 * Math.sin(a1)).toFixed(2) + " Z");
      path.setAttribute("fill", COLORES_RULETA[i % COLORES_RULETA.length]);
      rueda.appendChild(path);
      var t = document.createElementNS(svgNS, "text");
      t.setAttribute("x", "58"); t.setAttribute("y", "0");
      t.setAttribute("transform", "rotate(" + (i * paso + paso / 2 - 90) + ")");
      t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "middle");
      t.setAttribute("fill", TINTA_RULETA[i % TINTA_RULETA.length]);
      t.setAttribute("font-size", n > 8 ? "9" : "11");
      t.setAttribute("font-weight", "700");
      t.textContent = g;
      rueda.appendChild(t);
    });
    var centro = document.createElementNS(svgNS, "circle");
    centro.setAttribute("r", "14"); centro.setAttribute("fill", "#fff7ec"); centro.setAttribute("stroke", "#c8102e"); centro.setAttribute("stroke-width", "3");
    rueda.appendChild(centro);
    var resRuleta = h("p", { class: "pelicula__res", "aria-live": "polite" });
    var bRuleta = boton("Girar ruleta", "boton--rojo", function () {
      if (ocupadoR) return;
      ocupadoR = true; bRuleta.disabled = true; resRuleta.textContent = "";
      var i = Math.floor(Math.random() * n);
      var centroAng = i * paso + paso / 2 + (Math.random() - 0.5) * paso * 0.6;
      giroRuleta = giroRuleta - (giroRuleta % 360) + 360 * 6 + (360 - centroAng);
      rueda.style.transform = "rotate(" + giroRuleta + "deg)";
      setTimeout(function () {
        genero = generos[i];
        resRuleta.textContent = "Género: " + genero;
        ocupadoR = false; bRuleta.disabled = false; bRuleta.textContent = "Girar otra vez";
        vibrar(30); resumen();
      }, 4300);
    });

    var final = h("div", { class: "pelicula__final", hidden: true });
    function resumen() {
      if (!quien || !genero) return;
      final.hidden = false;
      final.replaceChildren(
        h("p", { class: "antetitulo", text: "Esta noche" }),
        h("p", { class: "pelicula__plan", text: "Una de " + genero.toLowerCase() + ", la elige " + quien + "." })
      );
    }

    raiz.appendChild(h("div", { class: "pelicula__paso" }, [
      h("p", { class: "pelicula__pregunta", text: "1. ¿Quién elige la película?" }),
      monedaCaja, resMoneda, h("div", { class: "juego__botones" }, [bMoneda])
    ]));
    raiz.appendChild(h("div", { class: "pelicula__paso" }, [
      h("p", { class: "pelicula__pregunta", text: "2. ¿De qué género?" }),
      h("div", { class: "ruleta" }, [h("span", { class: "ruleta__flecha", "aria-hidden": "true" }), rueda]),
      resRuleta, h("div", { class: "juego__botones" }, [bRuleta])
    ]));
    raiz.appendChild(final);
    return raiz;
  }

  var TIPOS = { trivia: trivia, memorama: memorama, sopa: sopa, adivinanzas: adivinanzas, mimica: mimica, pelicula: pelicula };

  self.UI = { h: h, vaciar: vaciar };
  self.Juegos = {
    crear: function (cfg, ctx) {
      var f = TIPOS[cfg && cfg.tipo];
      if (!f) return null;
      return h("div", { class: "juego" }, [
        cfg.titulo === "" ? null : h("h3", { class: "juego__titulo", text: cfg.titulo || "Juego" }),
        cfg.intro ? h("p", { class: "juego__intro", text: cfg.intro }) : null,
        f(cfg, ctx)
      ]);
    },
    _generarSopa: generarSopa,
    _normalizar: normalizar
  };
})();
