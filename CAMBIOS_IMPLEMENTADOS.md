# Cambios implementados

## Frontend TV
- Sustituida la antigua emisión basada en una única playlist por el export `?export=tv` schema v2.
- Motor multicanal virtual con reloj `Atlantic/Canary`.
- Selector de canales usando `channel_id`, `channel_number`, `slug`, `name` y `description`.
- Resolución de `program_rotation`, `entity_rotation`, `entity_new` y `entity_deadline`.
- Los bloques `entity_*` son globales y sincronizan todos los canales.
- Los bloques globales terminan cuando termina el contenido seleccionado; `max_duration_minutes` es un máximo.
- Agrupación de media por `entity_id` por si una entidad contiene más de un vídeo.
- Continuidad 30 segundos antes de cambios reales de programa:
  - thumbnail del primer vídeo entrante;
  - canal;
  - programa;
  - cuenta atrás;
  - tarjetas apiladas y eliminadas al llegar a cero;
  - clic para cambiar de canal.
- Continuidad suprimida durante bloques globales de entidades.
- QR dinámico de la ficha mientras se emiten vídeos de entidades.
- Resincronización periódica del reproductor YouTube.
- Fallback de autoplay silenciado con botón para activar sonido.
- Modo de diagnóstico con `?debug=1`.

## Header
Enlaces añadidos:
- Qué es
- Ver mapa
- Agenda
- Participa
- Contacto

## Archivos nuevos/separados
- `styles.css`
- `tv-engine.js`
- `app.js`

Las versiones `tv v1.html` a `tv v4.html` se conservan como histórico.
