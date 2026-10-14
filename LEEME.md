# Aula · puesta en marcha

App de estudio para los concursos CNSC (OPEC 241258 y OPEC 247478). Es una app web instalable (PWA), igual que Nido:
se publica gratis en GitHub Pages y guarda los datos en Firebase (plan gratuito).

## Archivos

| Archivo | Para qué sirve |
|---|---|
| index.html, app.css, app.js | Pantallas de la app |
| data.js | Conexión con Firebase. El contenido y tu avance se guardan por separado |
| firebase-config.js | Configuración pública de tu proyecto Firebase (hay que llenarla) |
| sw.js | Permite abrir la app sin conexión. Cambia `V` en cada actualización |
| manifest.webmanifest e íconos | Instalación en el celular |
| firestore.rules | Reglas de acceso: solo daniel.rojas9727@gmail.com |

**No subas `aula-datos.json` a GitHub.** El repositorio es público. Ese archivo se carga desde la app y queda privado en Firebase.

## 1. Firebase (una sola vez)

1. Entra a https://console.firebase.google.com con daniel.rojas9727@gmail.com y crea el proyecto `aula-rojas` (sin Google Analytics).
2. **Authentication** > Comenzar > Método de acceso > activa **Google**.
3. **Authentication** > Configuración > Dominios autorizados > agrega `danielrojas9727.github.io`.
4. **Firestore Database** > Crear base de datos > modo producción > ubicación `southamerica-east1` (o la más cercana).
5. **Firestore** > Reglas > reemplaza todo por el contenido de `firestore.rules` > Publicar.
6. Configuración del proyecto (engranaje) > Tus apps > ícono web `</>` > registra la app "Aula". Copia el bloque `firebaseConfig` y pégalo en `firebase-config.js` (o envíaselo a Claude).

## 2. GitHub Pages

1. Crea el repositorio público `DanielRojas9727/aula`.
2. Sube todos los archivos de esta carpeta, excepto este LEEME si no quieres.
3. Settings > Pages > Source: *Deploy from a branch* > rama `main`, carpeta `/ (root)` > Save.
4. En uno o dos minutos la app queda en https://danielrojas9727.github.io/aula/

## 3. Primer uso

1. Abre el enlace en el celular y entra con Google.
2. La app pedirá el archivo **aula-datos.json** (está en la carpeta Simo\App). Cárgalo una vez.
3. En Chrome: menú ⋮ > *Agregar a la pantalla principal* para instalarla.

## Actualizar

- **Contenido nuevo** (preguntas, videos, cambios del plan): Claude genera un aula-datos.json nuevo y tú lo cargas en *Más > Actualizar contenido*. Tu avance no se borra.
- **Cambios de la app**: sube los archivos modificados a GitHub y cambia `V` en `sw.js` (por ejemplo, `aula-v2`).

## Probar sin Firebase

Con `?demo` al final del enlace, la app funciona en modo demo. Lee `aula-datos.json` de la misma carpeta y guarda el avance solo en ese navegador.
