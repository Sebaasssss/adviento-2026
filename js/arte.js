/*
 * Arte: ilustraciones planas (SVG) para las puertas, el memorama y la
 * pantalla de inicio. Todo se dibuja aquí; no hay imágenes ni emojis.
 * Las cadenas son fijas (no contienen datos del usuario).
 */
(function () {
  "use strict";

  var R = "#c8102e", D = "#9b0d22", P = "#f3b5c3", L = "#f9d5dd", G = "#c99a5b", C = "#fff7ec";
  var NS = "http://www.w3.org/2000/svg";

  function f(n) { return Math.round(n * 100) / 100; }

  function rect(c) { return '<rect width="100" height="100" fill="' + c + '"/>'; }

  function destello(x, y, s, c) {
    return '<path fill="' + c + '" d="M' + f(x) + ' ' + f(y - s) + 'Q' + f(x) + ' ' + f(y) + ' ' + f(x + s) + ' ' + f(y) +
      'Q' + f(x) + ' ' + f(y) + ' ' + f(x) + ' ' + f(y + s) + 'Q' + f(x) + ' ' + f(y) + ' ' + f(x - s) + ' ' + f(y) +
      'Q' + f(x) + ' ' + f(y) + ' ' + f(x) + ' ' + f(y - s) + 'Z"/>';
  }

  function estrella(x, y, r, c) {
    var p = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      p.push(f(x + rr * Math.cos(a)) + "," + f(y + rr * Math.sin(a)));
    }
    return '<polygon fill="' + c + '" points="' + p.join(" ") + '"/>';
  }

  function copo(x, y, s, c) {
    var out = '<g stroke="' + c + '" stroke-width="' + f(s * 0.16) + '" stroke-linecap="round">';
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3, ex = x + s * Math.cos(a), ey = y + s * Math.sin(a);
      var mx = x + s * 0.6 * Math.cos(a), my = y + s * 0.6 * Math.sin(a);
      out += '<line x1="' + f(x) + '" y1="' + f(y) + '" x2="' + f(ex) + '" y2="' + f(ey) + '"/>';
      [-1, 1].forEach(function (k) {
        var b = a + k * 0.7;
        out += '<line x1="' + f(mx) + '" y1="' + f(my) + '" x2="' + f(mx + s * 0.32 * Math.cos(b)) + '" y2="' + f(my + s * 0.32 * Math.sin(b)) + '"/>';
      });
    }
    return out + '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(s * 0.16) + '" fill="' + c + '"/></g>';
  }

  function pino(cx, base, w, h, c, adorno) {
    var out = "", niveles = 3;
    for (var i = 0; i < niveles; i++) {
      var top = base - h + i * h * 0.26, bot = top + h * 0.48, ww = w * (0.55 + i * 0.22);
      out += '<polygon fill="' + c + '" points="' + f(cx) + "," + f(top) + " " + f(cx + ww / 2) + "," + f(bot) + " " + f(cx - ww / 2) + "," + f(bot) + '"/>';
    }
    out += '<rect fill="' + D + '" x="' + f(cx - w * 0.07) + '" y="' + f(base - h * 0.02) + '" width="' + f(w * 0.14) + '" height="' + f(h * 0.12) + '"/>';
    if (adorno) out += estrella(cx, base - h, w * 0.16, adorno);
    return out;
  }

  function campana(x, y, s, c) {
    // cúpula + borde acampanado + badajo + argolla
    return '<path fill="' + c + '" d="M' + f(x - s * 0.62) + ' ' + f(y + s * 0.55) +
      'C' + f(x - s * 0.62) + ' ' + f(y - s * 0.2) + ' ' + f(x - s * 0.5) + ' ' + f(y - s * 0.85) + ' ' + f(x) + ' ' + f(y - s * 0.85) +
      'C' + f(x + s * 0.5) + ' ' + f(y - s * 0.85) + ' ' + f(x + s * 0.62) + ' ' + f(y - s * 0.2) + ' ' + f(x + s * 0.62) + ' ' + f(y + s * 0.55) + 'Z"/>' +
      '<rect fill="' + c + '" x="' + f(x - s) + '" y="' + f(y + s * 0.5) + '" width="' + f(s * 2) + '" height="' + f(s * 0.3) + '" rx="' + f(s * 0.15) + '"/>' +
      '<circle cx="' + f(x) + '" cy="' + f(y + s * 1.02) + '" r="' + f(s * 0.2) + '" fill="' + G + '"/>' +
      '<circle cx="' + f(x) + '" cy="' + f(y - s * 1.0) + '" r="' + f(s * 0.17) + '" fill="none" stroke="' + c + '" stroke-width="' + f(s * 0.1) + '"/>';
  }

  var MOTIVOS = {
    copos: function () {
      return rect(P) + copo(20, 20, 15, R) + copo(82, 82, 13, R) + destello(82, 20, 11, G) + destello(18, 82, 10, G) +
        '<circle cx="50" cy="10" r="2.5" fill="' + C + '"/><circle cx="90" cy="50" r="2.5" fill="' + C + '"/><circle cx="10" cy="50" r="2.5" fill="' + C + '"/>';
    },
    pinos: function () {
      return rect(G) + pino(26, 98, 44, 80, R, C) + pino(76, 104, 50, 92, R) + '<polygon fill="' + P + '" points="60,0 100,0 100,30"/>';
    },
    estrella: function () {
      var rayos = "";
      for (var i = 0; i < 7; i++) {
        var x = i * 16 - 6;
        rayos += '<polygon fill="' + (i % 2 ? P : C) + '" points="50,58 ' + x + ',100 ' + (x + 12) + ',100"/>';
      }
      return rect(R) + rayos + estrella(50, 15, 11, C) + destello(14, 22, 7, C) + destello(86, 26, 6, C);
    },
    abeto: function () {
      return rect(L) + '<polygon fill="' + R + '" points="50,6 94,96 6,96"/>' +
        '<g stroke="' + C + '" stroke-width="4">' +
        '<line x1="26" y1="62" x2="62" y2="44"/><line x1="18" y1="80" x2="74" y2="60"/><line x1="12" y1="96" x2="86" y2="78"/></g>' +
        estrella(50, 8, 9, G) + destello(12, 18, 6, R) + destello(88, 30, 5, R);
    },
    regalo: function () {
      return rect(G) + '<rect x="9" y="12" width="82" height="80" fill="' + R + '"/>' +
        '<rect x="44" y="12" width="12" height="80" fill="' + P + '"/><rect x="9" y="46" width="82" height="12" fill="' + P + '"/>' +
        '<ellipse cx="38" cy="10" rx="13" ry="7" fill="' + P + '" transform="rotate(-20 38 10)"/>' +
        '<ellipse cx="62" cy="10" rx="13" ry="7" fill="' + P + '" transform="rotate(20 62 10)"/>';
    },
    corona: function () {
      var hojas = "";
      for (var i = 0; i < 14; i++) {
        var a = i / 14 * Math.PI * 2;
        hojas += '<circle cx="' + f(50 + 33 * Math.cos(a)) + '" cy="' + f(50 + 33 * Math.sin(a)) + '" r="11" fill="' + R + '"/>';
      }
      for (i = 0; i < 7; i++) {
        var b = (i + 0.5) / 7 * Math.PI * 2;
        hojas += '<circle cx="' + f(50 + 40 * Math.cos(b)) + '" cy="' + f(50 + 40 * Math.sin(b)) + '" r="2.6" fill="' + C + '"/>';
      }
      return rect(G) + hojas + '<path fill="' + P + '" d="M50 86 L36 98 L38 82 Z M50 86 L64 98 L62 82 Z"/>' + destello(88, 12, 6, C) + destello(12, 90, 5, C);
    },
    baston: function () {
      function b(x, flip) {
        var d = flip ? "M" + x + " 96 L" + x + " 34 A10 10 0 0 0 " + (x - 20) + " 34" : "M" + x + " 96 L" + x + " 34 A10 10 0 0 1 " + (x + 20) + " 34";
        return '<path d="' + d + '" fill="none" stroke="' + C + '" stroke-width="9" stroke-linecap="round"/>' +
          '<path d="' + d + '" fill="none" stroke="' + P + '" stroke-width="9" stroke-linecap="butt" stroke-dasharray="6 6"/>';
      }
      return rect(R) + b(18, false) + b(82, true) + destello(50, 12, 8, C) + destello(50, 90, 6, P);
    },
    esfera: function () {
      return rect(G) + '<circle cx="50" cy="58" r="36" fill="' + R + '"/>' +
        '<g fill="' + P + '"><rect x="26" y="28" width="48" height="7" rx="3.5"/><rect x="27" y="82" width="46" height="7" rx="3.5"/></g>' +
        '<rect x="42" y="14" width="16" height="10" rx="2" fill="' + C + '"/><path d="M45 14 Q50 2 55 14" fill="none" stroke="' + C + '" stroke-width="2.5"/>' +
        destello(14, 16, 7, C) + destello(88, 88, 6, C);
    },
    paloma: function () {
      return rect(R) + '<g fill="' + P + '">' +
        '<ellipse cx="58" cy="40" rx="28" ry="15"/><circle cx="84" cy="30" r="9"/>' +
        '<polygon points="34,40 8,26 14,52"/><polygon points="48,36 76,4 72,40" fill="' + L + '"/></g>' +
        '<polygon fill="' + G + '" points="92,29 99,31 92,33"/>' +
        destello(18, 82, 8, C) + destello(84, 78, 6, C) + '<circle cx="40" cy="88" r="2.5" fill="' + C + '"/>';
    },
    banderines: function () {
      var arriba = "", abajo = "";
      for (var i = 0; i < 5; i++) {
        arriba += '<polygon fill="' + P + '" points="' + (i * 20) + ',0 ' + (i * 20 + 20) + ',0 ' + (i * 20 + 10) + ',24"/>';
        abajo += '<polygon fill="' + G + '" points="' + (i * 20) + ',100 ' + (i * 20 + 20) + ',100 ' + (i * 20 + 10) + ',74"/>';
      }
      return rect(R) + arriba + abajo + '<circle cx="12" cy="50" r="3" fill="' + C + '"/><circle cx="88" cy="50" r="3" fill="' + C + '"/>';
    },
    rayos: function () {
      var l = "";
      for (var i = 0; i < 16; i++) {
        var a = i / 16 * Math.PI * 2;
        l += '<line x1="' + f(50 + 27 * Math.cos(a)) + '" y1="' + f(50 + 27 * Math.sin(a)) + '" x2="' + f(50 + 47 * Math.cos(a)) + '" y2="' + f(50 + 47 * Math.sin(a)) + '"/>';
      }
      return rect(R) + '<g stroke="' + C + '" stroke-width="3.2" stroke-linecap="round">' + l + "</g>" +
        '<circle cx="8" cy="8" r="3" fill="' + P + '"/><circle cx="92" cy="92" r="3" fill="' + P + '"/>';
    },
    dulce: function () {
      return rect(L) + '<circle cx="50" cy="50" r="36" fill="none" stroke="' + C + '" stroke-width="20"/>' +
        '<circle cx="50" cy="50" r="36" fill="none" stroke="' + R + '" stroke-width="20" stroke-dasharray="14.1 14.1"/>' +
        destello(10, 12, 6, R) + destello(90, 90, 6, R);
    },
    velas: function () {
      function v(x, y) {
        return '<rect x="' + (x - 7) + '" y="' + y + '" width="14" height="' + (100 - y) + '" fill="' + R + '"/>' +
          '<rect x="' + (x - 7) + '" y="' + (y + 10) + '" width="14" height="4" fill="' + C + '"/>' +
          '<path fill="' + G + '" d="M' + x + ' ' + (y - 16) + 'Q' + (x + 7) + ' ' + (y - 5) + ' ' + x + ' ' + (y - 2) + 'Q' + (x - 7) + ' ' + (y - 5) + ' ' + x + ' ' + (y - 16) + 'Z"/>';
      }
      return rect(P) + v(16, 50) + v(84, 38) + destello(50, 12, 7, R) + '<circle cx="34" cy="92" r="3" fill="' + C + '"/>';
    },
    campanas: function () {
      return rect(G) + campana(24, 26, 15, R) + campana(76, 72, 15, R) +
        destello(80, 20, 8, C) + destello(20, 80, 7, C) + '<circle cx="50" cy="8" r="2.5" fill="' + C + '"/>';
    }
  };

  var ORDEN = ["copos", "pinos", "estrella", "abeto", "regalo", "corona", "baston", "esfera", "paloma", "banderines",
    "rayos", "dulce", "velas", "campanas"];

  /* Motivo asignado a cada día (variado, sin repetir vecinos). */
  var POR_DIA = [null,
    "copos", "pinos", "estrella", "abeto", "regalo",
    "corona", "baston", "esfera", "paloma", "banderines",
    "rayos", "dulce", "velas", "campanas", "estrella",
    "esfera", "regalo", "pinos", "paloma", "dulce",
    "regalo", "abeto", "estrella", "corona", "baston",
    "copos", "rayos"];

  function svg(nombre, clase) {
    var gen = MOTIVOS[nombre] || MOTIVOS.copos;
    var cont = document.createElement("div");
    cont.innerHTML = '<svg xmlns="' + NS + '" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' + gen() + "</svg>";
    var el = cont.firstChild;
    if (clase) el.setAttribute("class", clase);
    return el;
  }

  /* Iconos de interfaz (trazo simple) */
  var ICONOS = {
    candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none"/>',
    atras: '<path d="M15 5l-7 7 7 7" fill="none"/>',
    play: '<path d="M8 5.5v13l11-6.5z" stroke="none"/>',
    pausa: '<rect x="7" y="5" width="3.5" height="14" rx="1" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" stroke="none"/>',
    nota: '<path d="M9 18V6l10-2v12" fill="none"/><circle cx="6.5" cy="18" r="2.5" stroke="none"/><circle cx="16.5" cy="16" r="2.5" stroke="none"/>',
    silencio: '<path d="M9 18V6l10-2v12" fill="none"/><circle cx="6.5" cy="18" r="2.5" stroke="none"/><circle cx="16.5" cy="16" r="2.5" stroke="none"/><path d="M3 3l18 18" fill="none"/>',
    destello: '<path d="M12 3Q12 12 21 12Q12 12 12 21Q12 12 3 12Q12 12 12 3Z" stroke="none"/>'
  };
  function icono(nombre, clase) {
    var cont = document.createElement("div");
    cont.innerHTML = '<svg xmlns="' + NS + '" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONOS[nombre] || "") + "</svg>";
    var el = cont.firstChild;
    el.setAttribute("class", "icono" + (clase ? " " + clase : ""));
    return el;
  }

  self.Arte = {
    svg: svg,
    icono: icono,
    deDia: function (n) { return POR_DIA[n] || ORDEN[n % ORDEN.length]; },
    lista: ORDEN.slice()
  };
})();
