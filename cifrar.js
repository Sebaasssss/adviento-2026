#!/usr/bin/env node
/*
 * cifrar.js — genera el contenido cifrado a partir de contenido-plano.js
 *
 * Uso:   node cifrar.js
 *        (en Git Bash, si no aparece la petición de contraseña: winpty node cifrar.js)
 *
 * Qué genera (todo PÚBLICO y cifrado):
 *   - contenido.enc.js   textos, títulos, juegos y referencias a los medios
 *   - medios/*.bin       cada foto y canción cifrada por separado, con
 *                        nombres aleatorios que no revelan nada
 *
 * Seguridad:
 * - Pide la contraseña por consola SIN mostrarla (dos veces).
 * - La contraseña nunca se escribe en archivos, argumentos ni mensajes.
 * - PBKDF2-SHA256 (600.000 iteraciones, salt aleatorio de 16 bytes) -> AES-256-GCM.
 * - IV aleatorio de 12 bytes para el contenido y otro distinto para cada medio.
 * - Compatible con la Web Crypto API del navegador.
 * - Escribe primero en temporales, verifica que todo se descifra y solo entonces
 *   reemplaza la versión anterior. Si algo falla, lo anterior queda intacto.
 * - Sin dependencias: solo módulos de Node.js (v16 o superior).
 *
 * PRIVADO (no publicar): contenido-plano.js, la carpeta privado/ y cualquier foto o
 * canción original.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const RAIZ = __dirname;
const ENTRADA = path.join(RAIZ, "contenido-plano.js");
const ITERACIONES = 600000;
const PRESENCIALES = [5, 6, 12, 13, 19, 20];
const DIAS = 25;
const TIPOS = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".m4a": "audio/mp4", ".aac": "audio/aac", ".wav": "audio/wav", ".ogg": "audio/ogg"
};

/* =========================================================
   Cifrado
   ========================================================= */
function normalizar(contrasena) {
  return String(contrasena).normalize("NFC").trim();
}

function derivar(contrasena, salt, iter) {
  return crypto.pbkdf2Sync(Buffer.from(normalizar(contrasena), "utf8"), salt, iter || ITERACIONES, 32, "sha256");
}

/** Devuelve IV(12) + cifrado + etiqueta(16) */
function cifrarBytes(clave, datos) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", clave, iv);
  return Buffer.concat([iv, c.update(datos), c.final(), c.getAuthTag()]);
}

function descifrarBytes(clave, buf) {
  const d = crypto.createDecipheriv("aes-256-gcm", clave, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(buf.length - 16));
  return Buffer.concat([d.update(buf.subarray(12, buf.length - 16)), d.final()]);
}

function esMarcador(v) { return typeof v === "string" && /^\s*\[/.test(v); }

/**
 * Recorre el contenido y sustituye cada foto/canción real por una referencia
 * cifrada { m: "medios/xxxx.bin", t: "image/jpeg" }.
 *  - { archivo: "privado/fotos/dia-04.jpg" }  -> se lee el archivo
 *  - { src: "data:image/jpeg;base64,..." }    -> se extrae del texto
 * Los marcadores ([FOTO ...], archivo vacío) se dejan tal cual.
 */
function extraerMedios(objeto, clave, base) {
  const medios = [];
  const errores = [];
  const copia = JSON.parse(JSON.stringify(objeto));

  function procesar(nodo, donde) {
    if (Array.isArray(nodo)) { nodo.forEach((n, i) => procesar(n, donde)); return; }
    if (!nodo || typeof nodo !== "object") return;

    let bytes = null, tipo = null;
    if (typeof nodo.archivo === "string" && nodo.archivo.trim() && !esMarcador(nodo.archivo)) {
      const ruta = path.resolve(base, nodo.archivo.trim());
      if (!fs.existsSync(ruta)) { errores.push(`${donde}: no existe el archivo indicado en «archivo».`); return; }
      tipo = TIPOS[path.extname(ruta).toLowerCase()];
      if (!tipo) { errores.push(`${donde}: formato no admitido (usa .jpg, .png, .webp, .mp3, .m4a, .mp4...).`); return; }
      bytes = fs.readFileSync(ruta);
    } else if (typeof nodo.src === "string" && nodo.src.startsWith("data:")) {
      const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(nodo.src);
      if (!m) { errores.push(`${donde}: «src» no es un data:...;base64 válido.`); return; }
      tipo = m[1].toLowerCase(); bytes = Buffer.from(m[2], "base64");
    }
    if (bytes) {
      const nombre = "medios/" + crypto.randomBytes(9).toString("hex") + ".bin";
      medios.push({ nombre, datos: cifrarBytes(clave, bytes), tamano: bytes.length });
      nodo.medio = { m: nombre, t: tipo };
      delete nodo.archivo; delete nodo.src;
      return;
    }
    for (const k of Object.keys(nodo)) {
      const sub = nodo[k];
      if (sub && typeof sub === "object") procesar(sub, nodo.dia ? `Día ${nodo.dia}` : donde);
    }
  }
  procesar(copia, "General");
  return { copia, medios, errores };
}

/** Cifra todo. Devuelve { paquete, medios, errores }. */
function cifrarTodo(objeto, contrasena, base) {
  const salt = crypto.randomBytes(16);
  const clave = derivar(contrasena, salt);
  try {
    const { copia, medios, errores } = extraerMedios(objeto, clave, base || RAIZ);
    if (errores.length) return { errores };
    const cuerpo = cifrarBytes(clave, Buffer.from(JSON.stringify(copia), "utf8"));
    const paquete = {
      v: 1, alg: "AES-256-GCM", kdf: "PBKDF2", hash: "SHA-256", iter: ITERACIONES,
      salt: salt.toString("base64"),
      iv: cuerpo.subarray(0, 12).toString("base64"),
      data: cuerpo.subarray(12).toString("base64")
    };
    return { paquete, medios, errores: [], copia };
  } finally {
    clave.fill(0);
  }
}

function descifrarPaquete(paquete, contrasena) {
  const clave = derivar(contrasena, Buffer.from(paquete.salt, "base64"), paquete.iter);
  const buf = Buffer.concat([Buffer.from(paquete.iv, "base64"), Buffer.from(paquete.data, "base64")]);
  return { datos: JSON.parse(descifrarBytes(clave, buf).toString("utf8")), clave };
}

function generarArchivo(paquete) {
  return "/* Contenido cifrado (AES-256-GCM + PBKDF2-SHA256). Generado por cifrar.js. No editar a mano. */\n" +
    "self.ADVIENTO_CIFRADO = " + JSON.stringify(paquete) + ";\n";
}

/**
 * Escribe contenido.enc.js y medios/ en `destino` de forma segura:
 * temporales -> verificación -> reemplazo. Si falla, deja lo anterior intacto.
 */
function escribirSalida(destino, resultado, contrasena) {
  const salida = path.join(destino, "contenido.enc.js");
  const tmpArchivo = salida + ".tmp";
  const dirMedios = path.join(destino, "medios");
  const tmpMedios = path.join(destino, "medios.tmp");
  const viejos = path.join(destino, "medios.old");
  fs.rmSync(tmpMedios, { recursive: true, force: true });
  fs.rmSync(viejos, { recursive: true, force: true });
  try {
    fs.mkdirSync(tmpMedios, { recursive: true });
    for (const m of resultado.medios) fs.writeFileSync(path.join(tmpMedios, path.basename(m.nombre)), m.datos);
    fs.writeFileSync(tmpArchivo, generarArchivo(resultado.paquete), "utf8");

    // Verificación completa
    const { datos, clave } = descifrarPaquete(resultado.paquete, contrasena);
    try {
      if (JSON.stringify(datos) !== JSON.stringify(resultado.copia)) throw new Error("el contenido no coincide");
      for (const m of resultado.medios) {
        const claro = descifrarBytes(clave, fs.readFileSync(path.join(tmpMedios, path.basename(m.nombre))));
        if (claro.length !== m.tamano) throw new Error("un medio no coincide");
      }
    } finally { clave.fill(0); }

    // Reemplazo
    if (fs.existsSync(dirMedios)) fs.renameSync(dirMedios, viejos);
    try {
      fs.renameSync(tmpMedios, dirMedios);
      fs.renameSync(tmpArchivo, salida);
    } catch (e) {
      fs.rmSync(dirMedios, { recursive: true, force: true });
      if (fs.existsSync(viejos)) fs.renameSync(viejos, dirMedios);
      throw e;
    }
    fs.rmSync(viejos, { recursive: true, force: true });
  } catch (e) {
    try { fs.unlinkSync(tmpArchivo); } catch (_) {}
    fs.rmSync(tmpMedios, { recursive: true, force: true });
    throw e;
  }
}

/* =========================================================
   Validación
   ========================================================= */
function validar(c) {
  const errores = [], avisos = [];
  if (!c || typeof c !== "object") return { errores: ["contenido-plano.js no exporta un objeto (falta module.exports = { ... })."], avisos };
  if (!c.general || typeof c.general !== "object") errores.push("Falta la sección «general».");
  if (!Array.isArray(c.dias)) { errores.push("Falta la lista «dias»."); return { errores, avisos }; }

  const vistos = new Set();
  const pendTexto = [], pendFoto = [], pendCancion = [], pendTrivia = [];
  for (const d of c.dias) {
    if (!d || !Number.isInteger(d.dia) || d.dia < 1 || d.dia > DIAS) { errores.push("Hay un día con número inválido."); continue; }
    if (vistos.has(d.dia)) errores.push(`El día ${d.dia} está repetido.`);
    vistos.add(d.dia);
    const juegos = Array.isArray(d.juegos) ? d.juegos : [];
    if (!PRESENCIALES.includes(d.dia) && juegos.length) errores.push(`Día ${d.dia}: los juegos solo pueden ir en días presenciales (${PRESENCIALES.join(", ")}).`);
    for (const j of juegos) {
      if (!["trivia", "memorama", "sopa", "adivinanzas", "mimica", "pelicula"].includes(j.tipo)) errores.push(`Día ${d.dia}: tipo de juego desconocido «${j.tipo}».`);
      if (j.tipo === "trivia") (j.preguntas || []).forEach((p, i) => {
        if (!Array.isArray(p.opciones) || p.opciones.length < 2) errores.push(`Día ${d.dia}: la pregunta ${i + 1} necesita al menos 2 opciones.`);
        else if (!(p.correcta >= 0 && p.correcta < p.opciones.length)) errores.push(`Día ${d.dia}: la pregunta ${i + 1} tiene «correcta» inválida.`);
      });
    }
    if (esMarcador(d.carta || "")) pendTexto.push(d.dia);
    if ((d.fotos || []).some((f) => f.estado !== "opcional" && !f.archivo && !(f.src || "").startsWith("data:") || esMarcador(f.archivo))) pendFoto.push(d.dia);
    if (d.cancion && (!d.cancion.archivo || esMarcador(d.cancion.archivo))) pendCancion.push(d.dia);
    if ((d.videos || []).some((v) => !v.archivo)) pendFoto.push(d.dia);
    if (d.playlist && (d.playlist.canciones || []).some((c) => !c.archivo)) pendCancion.push(d.dia);
    if (juegos.some((j) => j.tipo === "trivia" && JSON.stringify(j.preguntas || []).includes("[PREGUNTA"))) pendTrivia.push(d.dia);
  }
  for (let n = 1; n <= DIAS; n++) if (!vistos.has(n)) avisos.push(`Falta el día ${n}.`);

  const g = c.general || {};
  if (/\[(DEDICATORIA|MENSAJE|FIRMA)/.test(JSON.stringify([g.dedicatoria, g.bienvenida, g.mensajeFinal, g.firma]))) avisos.push("Quedan marcadores pendientes en «general».");
  const fondoPend = (g.musicaFondo || []).filter((s) => !s.archivo || esMarcador(s.archivo)).length;
  if (fondoPend) avisos.push(`Música de fondo: faltan ${fondoPend} canción(es).`);
  if (pendTexto.length) avisos.push(`Cartas con marcador en los días: ${pendTexto.join(", ")}.`);
  if (pendFoto.length) avisos.push(`Fotos pendientes en los días: ${pendFoto.join(", ")}.`);
  if (pendCancion.length) avisos.push(`Canciones pendientes en los días: ${pendCancion.join(", ")}.`);
  if (pendTrivia.length) avisos.push(`Trivias con preguntas de marcador en los días: ${pendTrivia.join(", ")}.`);
  return { errores, avisos };
}

/* =========================================================
   Contraseña oculta
   ========================================================= */
function pedirOculto(pregunta) {
  return new Promise((resolver, rechazar) => {
    const entrada = process.stdin;
    if (!entrada.isTTY || typeof entrada.setRawMode !== "function") {
      rechazar(new Error(
        "No hay una consola interactiva para escribir la contraseña de forma oculta.\n" +
        "  · En Git Bash ejecuta:  winpty node cifrar.js\n" +
        "  · O usa PowerShell / CMD / Terminal:  node cifrar.js"
      ));
      return;
    }
    process.stdout.write(pregunta);
    let valor = "";
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");
    const alDato = (trozo) => {
      for (const ch of trozo) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") { terminar(); process.stdout.write("\n"); resolver(valor); return; }
        else if (ch === "\u0003") { terminar(); process.stdout.write("\n"); rechazar(new Error("Cancelado.")); return; }
        else if (ch === "\u007f" || ch === "\b") { if (valor.length) { valor = valor.slice(0, -1); process.stdout.write("\b \b"); } }
        else if (ch >= " ") { valor += ch; process.stdout.write("*"); }
      }
    };
    function terminar() { entrada.removeListener("data", alDato); entrada.setRawMode(false); entrada.pause(); }
    entrada.on("data", alDato);
  });
}

/* =========================================================
   Programa
   ========================================================= */
async function main() {
  console.log("\nCifrado del contenido de Adviento\n");

  if (!fs.existsSync(ENTRADA)) {
    console.error("✖ No encuentro contenido-plano.js en esta carpeta.\n  Debe estar junto a cifrar.js. No se ha modificado nada.");
    process.exit(1);
  }
  let contenido;
  try {
    delete require.cache[require.resolve(ENTRADA)];
    contenido = require(ENTRADA);
  } catch (e) {
    console.error("✖ contenido-plano.js tiene un error y no se puede leer.");
    console.error("  Detalle: " + String(e && e.message || e).split("\n")[0]);
    console.error("  Revisa comillas, comas y llaves cerca de esa línea. No se ha modificado nada.");
    process.exit(1);
  }

  const { errores, avisos } = validar(contenido);
  if (avisos.length) { console.log("Pendiente (se puede cifrar igual):"); avisos.forEach((a) => console.log("  • " + a)); console.log(""); }
  if (errores.length) {
    console.error("✖ No se puede cifrar hasta corregir:");
    errores.forEach((e) => console.error("  • " + e));
    console.error("No se ha modificado nada.");
    process.exit(1);
  }

  let c1, c2;
  try {
    c1 = await pedirOculto("Contraseña: ");
    if (!normalizar(c1)) { console.error("✖ Contraseña vacía. Cancelado; no se ha modificado nada."); process.exit(1); }
    if (normalizar(c1).length < 8) console.log("⚠  Es una contraseña corta. Se recomiendan 10 caracteres o más (una frase funciona muy bien).");
    c2 = await pedirOculto("Repite la contraseña: ");
  } catch (e) {
    console.error("✖ " + e.message);
    process.exit(1);
  }
  if (normalizar(c1) !== normalizar(c2)) {
    console.error("✖ Las contraseñas no coinciden. Cancelado; no se ha modificado nada.");
    process.exit(1);
  }

  console.log("Cifrando (600.000 iteraciones, puede tardar unos segundos)…");
  try {
    const r = cifrarTodo(contenido, c1, RAIZ);
    if (r.errores.length) {
      console.error("✖ No se puede cifrar hasta corregir:");
      r.errores.forEach((e) => console.error("  • " + e));
      console.error("No se ha modificado nada.");
      process.exit(1);
    }
    escribirSalida(RAIZ, r, c1);
    const kbTexto = (fs.statSync(path.join(RAIZ, "contenido.enc.js")).size / 1024).toFixed(0);
    const kbMedios = (r.medios.reduce((s, m) => s + m.datos.length, 0) / 1024 / 1024).toFixed(1);
    console.log(`\n✔ Listo: contenido.enc.js (${kbTexto} KB) y ${r.medios.length} medio(s) en medios/ (${kbMedios} MB)\n`);
  } catch (e) {
    console.error("✖ Falló el cifrado; la versión anterior NO se ha modificado.");
    console.error("  Detalle: " + (e && e.message));
    process.exit(1);
  } finally {
    c1 = c2 = null;
  }

  console.log("Siguientes pasos:");
  console.log("  1. Sube CACHE_VERSION en sw.js (por ejemplo v1 → v2).");
  console.log("  2. Comprueba que lo privado no está en Git:  git status --ignored");
  console.log("  3. git add -A contenido.enc.js medios sw.js && git commit -m \"Actualizar contenido\" && git push\n");
  console.log("Recuerda: contenido-plano.js y la carpeta privado/ son PRIVADOS. No los subas.");
  console.log("Guarda la contraseña en un lugar seguro: sin ella no se puede abrir el calendario.\n");
}

module.exports = { cifrarTodo, escribirSalida, descifrarPaquete, generarArchivo, validar, normalizar, ITERACIONES };

if (require.main === module) {
  main().catch(() => {
    console.error("✖ Error inesperado. No se ha modificado el contenido anterior.");
    process.exit(1);
  });
}
