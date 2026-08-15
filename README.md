<p align="center">
  <a href="https://archipielagovivo.org/">
    <img src="https://archipielagovivo.org/logo.webp" alt="Archipiélago Vivo" width="180">
  </a>
</p>

<h1 align="center">Archipiélago Vivo TV</h1>

<p align="center">
  Frontend de <a href="https://tv.archipielagovivo.org/">tv.archipielagovivo.org</a><br>
  Parte del proyecto <a href="https://archipielagovivo.org/">Archipiélago Vivo</a>
</p>

## Estado actual

La portada `index.html` ya no reproduce una única playlist aleatoria. Consume el feed público TV schema v2 de Archipiélago Vivo.

El frontend debe leer el feed estático publicado en:

```text
https://data.archipielagovivo.org/tv/feed.json
```

La fuente de verdad continúa estando en Google Sheets y Apps Script, pero los navegadores no deben consultar directamente esa API. El repositorio público de datos actúa como capa estática intermedia:

```text
Google Sheets
    ↓
Apps Script
    ↓
GitHub Action
    ↓
data.archipielagovivo.org/tv/feed.json
    ↓
Archipiélago Vivo TV
```

La sincronización del repositorio de datos se ejecuta periódicamente mediante GitHub Actions y puede forzarse manualmente cuando sea necesario.

El archivo público sólo se actualiza cuando cambian datos significativos.

El endpoint Apps Script de origen es:

```text
https://script.google.com/macros/s/AKfycbxcmJ4_kBZKJe9Npa7lQ4kcQzRdEN_j6Xc11zq2T6ak628dgi4VYcGZv3VNVyGr8KLc/exec?export=tv
```

Ese endpoint queda reservado como **origen de sincronización**, no como fuente que deba consultar cada visitante.

La emisión es **multicanal virtual**: cada visitante reproduce la posición que corresponde por hora canaria (`Atlantic/Canary`) a su canal, usando la misma parrilla y el mismo algoritmo determinista.

## Canales

El frontend no tiene los canales codificados de forma rígida. Lee del JSON:

- `channel_id`
- `channel_number`
- `slug`
- `name`
- `description`
- `status`

El canal inicial se toma de `tv_config.default_channel_id`.

Puede seleccionarse por URL:

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

Los perfiles se agrupan por `entity_id`; si excepcionalmente una entidad tuviera varios media, se reproducen consecutivamente como una unidad editorial.

La producción recomendada sigue siendo unir previamente los miniclips con FFmpeg y publicar una sola cápsula final.

## Rotación de entidades

La periodicidad completa se lee de:

```text
policy.entity_rotation.current_full_cycle_hours
```

Este valor se calcula en origen en función de la duración total de los perfiles reproducibles.

La selección es determinista para que distintos navegadores sintonicen la misma emisión.

No requiere escrituras de historial desde el navegador.

`entity_deadline` funciona como bloque de seguridad ante un hipotético overflow de capacidad.

## Novedades

`entity_new` considera nuevas las fichas durante las horas indicadas por:

```text
policy.entity_new.new_for_hours
```

Las ventanas premium se distribuyen según el volumen de novedades.

Para grandes volúmenes se aplica el máximo editorial diario definido en el frontend.

## Continuidad entre programas

La presentación se lee de:

```text
presentation.program_change_teasers
```

Antes de un **cambio real de `program_id`**, el frontend muestra una tarjeta de continuidad en el margen derecho con información del siguiente programa.

Cada tarjeta contiene:

- thumbnail del primer vídeo que entrará;
- número y nombre del canal;
- nombre del siguiente programa;
- cuenta atrás;
- enlace para cambiar directamente a ese canal.

### Estado actual del teaser

Actualmente el aviso puede permanecer activo durante aproximadamente 30 segundos.

La implementación actual hace que la tarjeta aparezca y desaparezca durante ese intervalo de una forma visualmente demasiado activa, lo que puede dificultar la lectura y distraer de la emisión principal.

Esto debe mejorarse.

### Comportamiento objetivo

El teaser debe comportarse como un elemento estable de continuidad, no como una alerta intermitente.

La evolución prevista es:

- aparición suave una sola vez;
- permanencia estable durante la ventana de aviso;
- actualización únicamente de la cuenta atrás;
- ausencia de parpadeos, entradas y salidas repetidas o reconstrucciones visibles de la tarjeta;
- desaparición suave al llegar el cambio de programa;
- conservación de una jerarquía visual secundaria respecto al vídeo principal.

La tarjeta no debe competir visualmente con la emisión ni dificultar la lectura de sus propios contenidos.

Idealmente, una vez mostrado, el mismo teaser debe reutilizar el mismo nodo de interfaz y actualizar sólo los datos que cambien.

### Condiciones de aparición

No se muestran teasers durante bloques globales:

```text
entity_rotation
entity_new
entity_deadline
```

Tampoco se anuncia un cambio de programa si en el instante de ese cambio entra primero un bloque global de entidades.

Las tarjetas son clicables y permiten cambiar de canal.

## Entidades y QR

Cuando se emite un `media` de tipo `entity` y existe `map_url` en el registro legacy `entities`, se muestra la ficha correspondiente con QR.

El QR se genera visualmente mediante `api.qrserver.com`.

El destino siempre es el `map_url` recibido del JSON.

## Header

El header replica la navegación actual de Archipiélago Vivo:

- Qué es
- Mapa
- Agenda
- Inscripción
- TV
- Comunidad
- Contacto

`Comunidad` abre WhatsApp en una pestaña nueva.

El selector de canal se mantiene como control propio de TV.

## Analítica de navegación

`analytics.js` comparte la sesión efímera de Archipiélago Vivo entre el dominio principal y sus subdominios, sin cookies ni almacenamiento persistente para analítica.

TV se registra como:

```text
/@tv/
```

para distinguirla de la portada principal y de Inscripción.

Los enlaces internos de Archipiélago Vivo heredan:

```text
av_session
av_entry
```

y la atribución UTM/AV.

Los enlaces externos, incluida la Comunidad de WhatsApp, no reciben esos parámetros.

## Reproductor

Se usa YouTube IFrame API.

El motor corrige la deriva de reloj periódicamente.

Si el navegador bloquea el autoplay con sonido, la emisión continúa silenciada y se muestra el botón **Activar sonido**.

## Capa pública de datos

TV no debe depender de una consulta directa a Google Sheets o Apps Script por cada visitante.

El feed público está disponible en:

```text
https://data.archipielagovivo.org/tv/feed.json
```

Esto permite:

- reducir la latencia;
- reducir las llamadas a Apps Script;
- soportar mejor accesos simultáneos;
- mantener disponible la última versión válida aunque el origen falle temporalmente;
- desacoplar el frontend de TV de la infraestructura interna de datos.

La actualización de esta capa estática se realiza desde el repositorio:

```text
ArchipielagoVivo/data
```

## Archivos

```text
AJUSTES_UI_CONTINUIDAD.md   notas y ajustes de continuidad e interfaz
CAMBIOS_IMPLEMENTADOS.md    registro de cambios ya implementados
CNAME                       dominio tv.archipielagovivo.org
README.md                   documentación del proyecto
analytics.js                analítica de navegación
android-chrome-192x192.png  icono para Android/Chrome
android-chrome-512x512.png  icono para Android/Chrome
app.js                      datos, reproductor, UI y continuidad
apple-touch-icon.png        icono para dispositivos Apple
favicon-16x16.png           favicon 16×16
favicon-32x32.png           favicon 32×32
favicon.ico                 favicon principal
index.html                  interfaz
logo.svg                    identidad
site.webmanifest            manifiesto web/PWA
styles.css                  diseño responsive
tv-engine.js                motor determinista de parrilla

## Contrato de datos

El feed publicado en:

```text
https://data.archipielagovivo.org/tv/feed.json
```

debe mantener:

```text
schema_version: 2
```

y, como mínimo:

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

Si el feed no cumple el contrato esperado, la portada debe mostrar un error explícito en lugar de inventar una parrilla.

La última versión válida permanece publicada aunque falle temporalmente la sincronización con Apps Script.

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

## Mejoras pendientes

Entre las mejoras prioritarias del frontend:

- estabilizar visualmente los teasers de cambio de programa;
- evitar repeticiones excesivas de programas o vídeos;
- incorporar la agenda semanal a la programación;
- añadir botón de compartir;
- añadir información contextual sobre el vídeo o programa en emisión;
- completar la analítica específica de TV.

## Proyecto

Más información, mapa, agenda y vías de participación en:

**[archipielagovivo.org](https://archipielagovivo.org/)**
