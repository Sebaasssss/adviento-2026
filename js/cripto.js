/*
 * Cripto: descifrado local con Web Crypto API y recuerdo del desbloqueo.
 *
 * Formato (lo genera cifrar.js):
 *   self.ADVIENTO_CIFRADO = { v, kdf, hash, iter, salt, iv, data }
 *   - PBKDF2-SHA256 (iter = 600000) -> clave AES-256
 *   - AES-GCM con IV de 12 bytes; `data` = texto cifrado + etiqueta (16 bytes)
 *   - salt, iv y data en base64
 *
 * Recordar el desbloqueo: se guarda en IndexedDB la CryptoKey AES DERIVADA,
 * marcada como NO extraíble (el código JavaScript no puede leer sus bytes),
 * nunca la contraseña. Quien tenga acceso al dispositivo y al perfil del
 * navegador sí podría usarla para descifrar. Ver README.
 */
(function () {
  "use strict";

  var DB_NOMBRE = "adviento";
  var DB_ALMACEN = "llaves";
  var DB_CLAVE = "principal";

  function b64ABytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function normalizar(contrasena) {
    return String(contrasena).normalize("NFC").trim();
  }

  function paquete() {
    var p = self.ADVIENTO_CIFRADO;
    if (!p || p.v !== 1 || !p.salt || !p.iv || !p.data || !p.iter) return null;
    return p;
  }

  function disponible() {
    return !!(self.crypto && self.crypto.subtle && self.isSecureContext !== false);
  }

  async function derivarClave(contrasena, p) {
    var base = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(normalizar(contrasena)), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64ABytes(p.salt), iterations: p.iter, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false, // no extraíble
      ["decrypt"]
    );
  }

  async function descifrarConClave(clave, p) {
    var claro = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ABytes(p.iv), tagLength: 128 }, clave, b64ABytes(p.data)
    );
    var datos = JSON.parse(new TextDecoder().decode(claro));
    if (!datos || !datos.general || !Array.isArray(datos.dias)) throw new Error("formato");
    return datos;
  }

  /* ---------- IndexedDB ---------- */
  function abrirDB() {
    return new Promise(function (ok, mal) {
      if (!self.indexedDB) return mal(new Error("sin-idb"));
      var req = indexedDB.open(DB_NOMBRE, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(DB_ALMACEN); };
      req.onsuccess = function () { ok(req.result); };
      req.onerror = function () { mal(req.error); };
    });
  }
  async function operar(modo, fn) {
    var db = await abrirDB();
    return new Promise(function (ok, mal) {
      var tx = db.transaction(DB_ALMACEN, modo);
      var st = tx.objectStore(DB_ALMACEN);
      var req = fn(st);
      tx.oncomplete = function () { db.close(); ok(req && req.result); };
      tx.onerror = tx.onabort = function () { db.close(); mal(tx.error); };
    });
  }
  function guardarLlave(clave, salt) {
    return operar("readwrite", function (st) { return st.put({ clave: clave, salt: salt }, DB_CLAVE); });
  }
  function leerLlave() {
    return operar("readonly", function (st) { return st.get(DB_CLAVE); });
  }
  function borrarLlave() {
    return operar("readwrite", function (st) { return st.delete(DB_CLAVE); }).catch(function () {});
  }

  /* ---------- Medios cifrados (fotos y canciones en medios/*.bin) ----------
     Cada archivo: IV (12 bytes) + texto cifrado + etiqueta, con la misma clave. */
  var claveActual = null;
  var urls = {};
  var enCurso = {};

  async function medio(ref) {
    if (!ref || !ref.m) throw new Error("sin-medio");
    if (urls[ref.m]) return urls[ref.m];
    if (enCurso[ref.m]) return enCurso[ref.m];
    enCurso[ref.m] = (async function () {
      if (!claveActual) throw new Error("bloqueado");
      var resp = await fetch(ref.m);
      if (!resp.ok) throw new Error("no-disponible");
      var bytes = new Uint8Array(await resp.arrayBuffer());
      var claro = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: bytes.subarray(0, 12), tagLength: 128 }, claveActual, bytes.subarray(12)
      );
      var url = URL.createObjectURL(new Blob([claro], { type: ref.t || "application/octet-stream" }));
      urls[ref.m] = url;
      return url;
    })();
    try { return await enCurso[ref.m]; }
    finally { delete enCurso[ref.m]; }
  }

  /** Descarga (sin descifrar) los medios para que queden en la caché offline. */
  async function precargar(refs) {
    for (var i = 0; i < refs.length; i++) {
      try { await fetch(refs[i].m); } catch (e) { return; } // sin conexión: se reintenta otro día
    }
  }

  /** Borra de la caché los medios que ya no usa el contenido actual. */
  async function limpiarMedios(refs) {
    try {
      if (!self.caches || !(await caches.has("adviento-medios"))) return;
      var vigentes = {};
      refs.forEach(function (r) { vigentes[r.m.split("/").pop()] = true; });
      var cache = await caches.open("adviento-medios");
      var claves = await cache.keys();
      for (var i = 0; i < claves.length; i++) {
        var nombre = new URL(claves[i].url).pathname.split("/").pop();
        if (!vigentes[nombre]) await cache.delete(claves[i]);
      }
    } catch (e) { /* no es importante */ }
  }

  /* ---------- API pública ---------- */
  self.Cripto = {
    disponible: disponible,
    hayContenido: function () { return !!paquete(); },
    medio: medio,
    precargar: precargar,
    limpiarMedios: limpiarMedios,

    /** Descifra con contraseña. Lanza Error genérico si falla. */
    abrirConContrasena: async function (contrasena, recordar) {
      var p = paquete();
      if (!p) throw new Error("sin-contenido");
      var clave = await derivarClave(contrasena, p);
      var datos = await descifrarConClave(clave, p);
      claveActual = clave;
      if (recordar) {
        try { await guardarLlave(clave, p.salt); } catch (e) { /* almacenamiento no disponible: se pedirá otra vez */ }
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
      } else {
        await borrarLlave();
      }
      return datos;
    },

    /** Intenta descifrar con la llave recordada. Devuelve null si no hay o no sirve. */
    abrirRecordado: async function () {
      var p = paquete();
      if (!p) return null;
      var guardada;
      try { guardada = await leerLlave(); } catch (e) { return null; }
      if (!guardada || !guardada.clave) return null;
      if (guardada.salt !== p.salt) { await borrarLlave(); return null; } // contenido re-cifrado
      try {
        var datos = await descifrarConClave(guardada.clave, p);
        claveActual = guardada.clave;
        return datos;
      } catch (e) { await borrarLlave(); return null; }
    },

    olvidar: borrarLlave
  };
})();
