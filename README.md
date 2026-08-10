# Archipiélago Vivo TV

Frontend de `tv.archipielagovivo.org`.

## Estado actual

La portada `index.html` ya no reproduce una única playlist aleatoria. Consume el export TV schema v2 de Archipiélago Vivo:

```text
https://script.google.com/macros/s/AKfycbxcmJ4_kBZKJe9Npa7lQ4kcQzRdEN_j6Xc11zq2T6ak628dgi4VYcGZv3VNVyGr8KLc/exec?export=tv
```

La emisión es **multicanal virtual**: cada visitante reproduce la posición que corresponde por hora canaria (`Atlantic/Canary`) a su canal, usando la misma parrilla y el mismo algoritmo determinista.

## Canales

El frontend no tiene los canales codificados de forma rígida. Lee del JSON:

- `channel_id`
- `channel_number`
- `slug`
- `name`
- `description`
- `status`

El canal inicial se toma de `tv_config.default_channel_id`. Puede seleccionarse por URL:

```text
?channel=general
?channel=fuerteventura
?channel=territorio
?channel=memoria
```

El último canal elegido se conserva en `localStorage`.

## Parrilla

`tv-engine.js` resuelve:

- `program_rotation`
- `entity_rotation`
- `entity_new`
- `entity_deadline`

Los bloques `entity_*` son globales: cuando contienen material reproducible, todos los canales emiten exactamente la misma cápsula.

Los máximos `max_duration_minutes` son máximos, no relleno. Cuando termina el material elegido para el bloque global, el canal vuelve a su programación temática.

Los perfiles se agrupan por `entity_id`; si excepcionalmente una entidad tuviera varios media, se reproducen consecutivamente como una unidad editorial. La producción recomendada sigue siendo unir previamente los miniclips con FFmpeg y publicar una sola cápsula final.

## Rotación de entidades

La periodicidad completa se lee de `policy.entity_rotation.current_full_cycle_hours`, calculada por Apps Script en función de la duración total de los perfiles reproducibles.

La selección es determinista para que distintos navegadores sintonicen la misma emisión. No requiere escrituras de historial desde el navegador.

`entity_deadline` funciona como bloque de seguridad ante un hipotético overflow de capacidad.

## Novedades

`entity_new` considera nuevas las fichas durante las horas indicadas por `policy.entity_new.new_for_hours` (actualmente 72 h).

Las ventanas premium se distribuyen según el volumen de novedades. Para grandes volúmenes se aplica el máximo editorial diario de 80 minutos definido en el frontend.

## Continuidad entre programas

La presentación se lee de:

```text
presentation.program_change_teasers
```

30 segundos antes de un **cambio real de `program_id`**, aparece una columna en el margen derecho. Cada tarjeta contiene:

- thumbnail del primer vídeo que entrará;
- número y nombre del canal;
- nombre del siguiente programa;
- cuenta atrás.

Las tarjetas se apilan por arriba y desaparecen al llegar a cero.

No se muestran durante bloques globales `entity_rotation`, `entity_new` o `entity_deadline`. Tampoco se anuncia un cambio de programa si en el instante de ese cambio entra primero un bloque global de entidades.

Las tarjetas son clicables y permiten cambiar de canal.

## Entidades y QR

Cuando se emite un `media` de tipo `entity` y existe `map_url` en el registro legacy `entities`, se muestra la ficha correspondiente con QR.

El QR se genera visualmente mediante `api.qrserver.com`; el destino siempre es el `map_url` recibido del JSON.

## Header

El header incorpora enlaces a:

- Qué es
- Ver mapa
- Agenda
- Participa
- Contacto

y el selector de canal.

## Reproductor

Se usa YouTube IFrame API.

El motor corrige la deriva de reloj periódicamente. Si el navegador bloquea el autoplay con sonido, la emisión continúa silenciada y se muestra el botón **Activar sonido**.

## Archivos

```text
index.html          interfaz
styles.css          diseño responsive
tv-engine.js        motor determinista de parrilla
app.js              datos, reproductor, UI y continuidad
logo*.svg           identidad
tv v1.html          versiones históricas
tv v2.html
tv v3.html
tv v4.html
CNAME               tv.archipielagovivo.org
```

## Requisito del Apps Script

Antes de publicar este frontend, el Web App debe estar desplegado con `schema_version: 2` y, como mínimo:

```text
channels
programs
media
schedule
policy
presentation
entities
tv_config
```

Si el endpoint sigue en schema v1, la portada muestra un error explícito en lugar de inventar una parrilla.

## Diagnóstico

Añadir:

```text
?debug=1
```

a la URL para mostrar el registro interno del frontend.

Ejemplo:

```text
https://tv.archipielagovivo.org/?channel=fuerteventura&debug=1
```
