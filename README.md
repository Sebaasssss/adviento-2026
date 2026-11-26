# Adviento

Calendario de Adviento como aplicación web progresiva (PWA): 25 puertas
(1–25 de diciembre), instalable en iPhone y en ordenador,
que funciona sin conexión después de la primera carga.

Cada día puede tener fotos de recuerdo, una mini carta, una canción y, en
algunos días, un mini juego. Al abrir la app suena música de fondo (con botón
para silenciarla).

Todo el contenido personal está **cifrado** (AES‑256‑GCM, clave derivada con
PBKDF2‑SHA256 y 600 000 iteraciones) y solo se descifra en el dispositivo,
con la Web Crypto API del navegador. La contraseña nunca se envía a ningún
servidor. No hay dependencias externas, CDN, fuentes remotas ni APIs.

---

## Estructura

| Archivo | Público | Qué hace |
|---|---|---|
| `index.html` | ✅ | Estructura de la app (sin textos personales). |
| `css/estilos.css` | ✅ | Estilos, animaciones, responsive y safe areas de iOS. |
| `js/arte.js` | ✅ | Ilustraciones planas (SVG) de las puertas y el memorama. |
| `js/cripto.js` | ✅ | Descifrado con Web Crypto, medios cifrados y recuerdo del desbloqueo (IndexedDB). |
| `js/musica.js` | ✅ | Música de fondo y reproductor de la canción de cada día. |
| `js/juegos.js` | ✅ | Trivia, memorama, sopa de letras y adivinanzas. |
| `js/app.js` | ✅ | Calendario, fechas, vista de cada día, progreso, modo de prueba y Service Worker. |
| `manifest.json` | ✅ | Manifiesto PWA (rutas relativas). |
| `sw.js` | ✅ | Service Worker: caché offline con `CACHE_VERSION`. |
| `contenido.enc.js` | ✅ | Textos **cifrados**. Se genera con `cifrar.js`. |
| `medios/*.bin` | ✅ | Fotos y canciones **cifradas**, con nombres aleatorios. Se generan con `cifrar.js`. |
| `icons/` | ✅ | Iconos 192, 512 y apple-touch-icon. |
| `cifrar.js` | ✅ | Script de Node.js que cifra el contenido. |
| `contenido-plano.js` | ❌ **PRIVADO** | Todo el contenido en claro. Está en `.gitignore`. |
| `privado/` | ❌ **PRIVADO** | Fotos (`privado/fotos/`) y canciones (`privado/canciones/`) originales. `.gitignore` también excluye `*.jpg`, `*.mp3`, `*.m4a`, etc. |

---

## Probar localmente

El Service Worker y Web Crypto necesitan `http://localhost` (no funciona
abriendo el archivo con doble clic). Desde la carpeta del proyecto:

```bash
python -m http.server 8080
```

y abre <http://localhost:8080/>. Para simular GitHub Pages en un subdirectorio,
sirve la carpeta **padre** y abre `http://localhost:8080/adviento-2026/`.

### Modo de prueba

Después de desbloquear, toca **5 veces seguidas** (en menos de 2,5 s) el
título. Se abren todas las puertas sin importar la fecha y aparece un
indicador «Modo de prueba». Nada de lo que hagas en este modo se guarda.
Pulsa «Salir» o recarga para desactivarlo.

---

## Cifrar el contenido

1. Pon las fotos en `privado/fotos/` y las canciones en `privado/canciones/`
   y edita `contenido-plano.js` (textos, rutas en `archivo: "privado/..."`, juegos).
2. Ejecuta:

   ```bash
   node cifrar.js
   ```

   En **Git Bash**, si no aparece la petición de contraseña, usa
   `winpty node cifrar.js` (o ejecútalo desde PowerShell/CMD).
3. Escribe la contraseña dos veces (no se muestra). Se recomienda una frase
   de 10 caracteres o más.
4. El script valida el contenido (por ejemplo, impide masajes o juegos en
   días no presenciales), cifra los textos en `contenido.enc.js` y cada foto
   y canción en `medios/`, **comprueba que todo se descifra** y solo entonces
   reemplaza la versión anterior. Si algo falla, lo anterior queda intacto.

Notas:

- Cada ejecución usa un *salt* y un IV nuevos, así que puedes repetir el
  proceso tantas veces como quieras.
- Los espacios al principio y al final de la contraseña se ignoran, tanto al
  cifrar como al abrir.
- Si cambias el contenido, los dispositivos que tenían el desbloqueo
  recordado pedirán la contraseña una vez más (la llave guardada ya no
  corresponde). El progreso (puertas abiertas) se conserva.
- El `contenido.enc.js` inicial del repositorio está cifrado con una clave
  aleatoria descartada: **hay que generarlo con `node cifrar.js`** antes de
  publicar.

### Fotos y canciones

- Fotos: JPEG, máximo 1080 px de ancho, calidad 0,70–0,78 (≈150–300 KB).
- Canciones: MP3 o M4A (≈3–5 MB cada una).
- Se cifran como archivos separados para que la app abra rápido; tras el
  desbloqueo se descargan en segundo plano y quedan disponibles sin conexión.
- En iPhone la música necesita un toque del usuario para empezar: suena al
  pulsar «Abrir», o con el primer toque si el desbloqueo estaba recordado.

---

## Publicar en GitHub Pages

1. Crea un repositorio (por ejemplo `adviento-2026`).
2. Comprueba que el archivo privado **no** se va a subir:

   ```bash
   git check-ignore -v contenido-plano.js   # debe mostrar la regla de .gitignore
   git status --ignored
   ```
3. Sube los archivos públicos (incluida la carpeta `medios/`) y haz push a `main`.
4. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a
   branch → Branch: `main` / `(root)` → Save**.
5. A los pocos minutos estará en `https://USUARIO.github.io/adviento-2026/`.

Todas las rutas son relativas, así que funciona en cualquier subdirectorio.

### Instalar como app

- **iPhone (Safari):** abrir la URL → botón Compartir → «Añadir a pantalla de
  inicio».
- **Laptop (Chrome/Edge):** icono de instalar en la barra de direcciones.

La primera apertura necesita conexión; después funciona sin internet.

---

## Actualizar (y `CACHE_VERSION`)

Cada vez que modifiques **cualquier** archivo publicado (HTML, CSS, JS,
iconos, manifest, `contenido.enc.js` o `medios/`):

1. Abre `sw.js` y sube la versión:

   ```js
   const CACHE_VERSION = "v2";   // antes "v1"
   ```
2. Commit y push.

Al abrir la app, el navegador detecta el nuevo `sw.js`, descarga todo de
nuevo, borra las cachés anteriores y muestra un aviso «Hay una versión nueva
· Actualizar». Aunque olvides subir la versión, los recursos se revalidan en
segundo plano y la siguiente apertura usa lo nuevo, pero subirla garantiza
una actualización limpia.

---

## Seguridad y privacidad: lo que conviene saber

- **Antes de la contraseña** solo se ve «Adviento», el campo y el botón.
  El HTML, el manifest y los metadatos son genéricos (`noindex, nofollow`).
- Una contraseña incorrecta no revela nada: AES‑GCM autentica el contenido y
  falla por completo; no existe descifrado parcial.
- La seguridad depende de la **fortaleza de la contraseña**: el archivo
  cifrado es público y alguien podría intentar adivinarla sin límite de
  intentos. PBKDF2 con 600 000 iteraciones lo hace lento, pero una
  contraseña corta o fácil sigue siendo vulnerable.
- **Recordar el desbloqueo** (casilla «Recordar en este dispositivo»):
  - No se guarda la contraseña. Se guarda en IndexedDB la **clave AES
    derivada**, como `CryptoKey` **no extraíble** (el JavaScript de la página
    no puede leer sus bytes).
  - Aun así, **no equivale a no haber guardado nada**: cualquiera con acceso
    al dispositivo desbloqueado y a ese navegador puede abrir el calendario,
    y alguien con acceso al perfil del navegador podría usar esa llave.
    Es la misma protección que tiene una sesión iniciada.
  - El botón **«Bloquear»** borra la llave guardada; se vuelve a pedir la
    contraseña. Desmarcar la casilla al entrar hace que no se guarde.
  - En iPhone, Safari y la app instalada en la pantalla de inicio tienen
    almacenamientos separados: se pide la contraseña una vez en cada uno.
- El contenido descifrado vive solo en memoria. En `localStorage` se guarda
  únicamente el progreso (números de puertas abiertas) y si la música está
  activada, nunca textos, fotos ni canciones.
- El icono de la app (`icons/`) es público: lo ve cualquiera que abra la
  URL, antes de la contraseña.
- `contenido-plano.js` y la carpeta `privado/` **nunca** deben subirse. Si se
  subieran por error, cambiar el archivo no basta: el historial de Git los
  conserva. Habría que borrar el repositorio (o reescribir el historial) y
  cambiar la contraseña.

---

## Fechas

Cada puerta se abre según la **fecha local del dispositivo**: la puerta *n*
está disponible desde las 00:00 del *n* de diciembre de 2026. Las puertas futuras muestran un candado y un mensaje, sin revelar su
contenido. Cambiar la hora del dispositivo permitiría adelantarse: es un
regalo, no una caja fuerte temporal.
