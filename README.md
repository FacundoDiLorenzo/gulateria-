# Gulateria

Web de Gulateria, heladería artesanal y cafetería en Málaga (C. Realenga de San Luis, 12, Carretera de Cádiz).

Secciones: presentación, reservas, ubicación (mapa y horario) y contacto.

HTML, CSS y JavaScript sin dependencias ni compilación: abre `index.html` en el navegador o publícalo con GitHub Pages (Settings → Pages → deploy from branch, carpeta raíz).

## Conectar las reservas

Por defecto el formulario funciona como vista previa y **no envía nada**: muestra el ticket con un aviso. Para que las reservas lleguen al local, edita el bloque `CONFIG` al principio de `script.js`:

- `whatsapp`: número con prefijo, solo dígitos (ej. `34600000000`). Cada reserva abre WhatsApp con el mensaje ya escrito para el local.
- `formEndpoint`: URL de un servicio de formularios (Formspree, Getform…). Las reservas llegan por email.
- `phone` / `email`: si los rellenas, aparecen en la sección de contacto.

Se pueden usar los dos a la vez. El horario de reservas sale de `HOURS` en `script.js` (la última hora reservable es una hora antes del cierre); si cambia el horario, actualízalo ahí, en la tabla de `index.html` y en el bloque `application/ld+json`.
