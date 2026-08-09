# Archipiélago Vivo TV

**Archipiélago Vivo TV** es un reproductor web de emisión continua basado en una playlist pública de YouTube.

La aplicación mantiene una programación audiovisual dinámica, incorpora automáticamente los nuevos vídeos añadidos a la playlist y permite reproducirlos en orden o de forma aleatoria, con bucle continuo.

**Web:** `https://tv.archipielagovivo.org`

---

## Objetivo

Archipiélago Vivo TV forma parte del proyecto **Archipiélago Vivo** y está pensado como una ventana audiovisual continua para contenidos relacionados con Canarias, sus territorios, comunidades, iniciativas, cultura, memoria, medio ambiente y movimientos sociales.

La programación se gestiona desde una playlist pública de YouTube.

Esto permite actualizar los contenidos sin modificar ni volver a desplegar la página web.

```text
Playlist de YouTube
        │
        │ añadir / quitar vídeos
        ▼
Archipiélago Vivo TV
        │
        ├── actualiza la lista
        ├── incorpora nuevos vídeos
        ├── mantiene el vídeo actual
        └── continúa la reproducción
```

---

# Características

## Reproducción continua

Los vídeos se reproducen consecutivamente.

Cuando termina un vídeo, el reproductor recibe el evento real `ENDED` de la YouTube IFrame API y pasa automáticamente al siguiente.

No se utilizan temporizadores para estimar cuándo termina un vídeo.

---

## Bucle infinito

El modo:

```text
∞ Bucle: ON
```

mantiene la programación funcionando continuamente.

Al terminar el último vídeo:

```text
último vídeo
      ↓
ENDED
      ↓
refrescar playlist
      ↓
comprobar cambios
      ↓
crear nueva vuelta
      ↓
primer vídeo
      ↓
∞
```

Antes de comenzar una nueva vuelta se vuelve a consultar la playlist original.

---

## Shuffle

El modo:

```text
🔀 Shuffle: ON
```

genera un orden aleatorio para la reproducción.

No selecciona simplemente un vídeo al azar cada vez.

Se genera una permutación completa de los contenidos para evitar repeticiones dentro de una misma vuelta.

Ejemplo:

```text
Playlist

1
2
3
4
5
6
```

puede reproducirse como:

```text
4
1
6
3
2
5
```

Cuando termina la vuelta se genera un nuevo orden.

---

## Playlist dinámica

La programación se sincroniza automáticamente con la playlist de origen.

La aplicación vuelve a consultar la lista aproximadamente cada:

```text
5 minutos
```

También realiza una comprobación adicional antes de comenzar cada nueva vuelta.

---

## Incorporación de nuevos vídeos

Si se añade un nuevo contenido mientras Archipiélago Vivo TV está funcionando, no es necesario recargar la página.

Por ejemplo:

```text
1 ✓
2 ✓
3 ← reproduciendo
4
5
```

Si posteriormente aparecen:

```text
6 NUEVO
7 NUEVO
```

la cola pasa a contener:

```text
1 ✓
2 ✓
3 ← reproduciendo
4
5
6
7
```

El vídeo que está reproduciéndose no se interrumpe.

Con `Shuffle` activo, los nuevos vídeos se incorporan a la parte pendiente de la vuelta.

---

# Arquitectura

La aplicación separa la obtención de la programación de la reproducción audiovisual.

```text
┌──────────────────────────────┐
│   Playlist pública YouTube   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│        Invidious API         │
│                              │
│ IDs                          │
│ títulos                      │
│ autores                      │
│ duración                     │
│ orden                        │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│          JavaScript          │
│                              │
│ cola                         │
│ actualización                │
│ shuffle                      │
│ bucle                        │
│ nuevos contenidos            │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│    YouTube IFrame API        │
│                              │
│ reproducción                 │
│ pausa                        │
│ seek                         │
│ buffering                    │
│ evento ENDED                 │
└──────────────────────────────┘
```

---

# Tecnologías

El proyecto utiliza únicamente tecnologías web del lado del cliente:

* HTML
* CSS
* JavaScript
* YouTube IFrame Player API
* API pública de Invidious

No necesita:

* PHP;
* Node.js;
* Python;
* base de datos;
* servidor de aplicaciones;
* procesos ejecutándose en un ordenador local.

Puede alojarse como una web completamente estática.

---

# Estructura

La estructura mínima del proyecto es:

```text
tv.archipielagovivo.org/
│
├── index.html
├── README.md
└── LICENSE
```

Si se utiliza GitHub Pages con dominio personalizado:

```text
tv.archipielagovivo.org/
│
├── index.html
├── README.md
├── LICENSE
└── CNAME
```

El contenido de `CNAME` sería:

```text
tv.archipielagovivo.org
```

---

# Dominio

La aplicación está diseñada para publicarse en:

```text
https://tv.archipielagovivo.org
```

Es recomendable utilizar HTTPS.

La YouTube IFrame API recibe automáticamente el origen de la instalación:

```javascript
origin: location.origin
```

En producción:

```text
https://tv.archipielagovivo.org
```

---

# Playlist

La playlist actual está configurada mediante:

```text
PLHnCLhOECJFA
```

o mediante su URL completa:

```text
https://www.youtube.com/playlist?list=PLHnCLhOECJFA
```

La interfaz también permite introducir otra playlist pública.

---

# Gestión de contenidos

La programación de Archipiélago Vivo TV se administra desde la playlist de YouTube.

Por tanto, para añadir contenido no es necesario modificar el código.

El flujo editorial es:

```text
Encontrar / publicar vídeo
          ↓
añadirlo a la playlist
          ↓
Archipiélago Vivo TV detecta el cambio
          ↓
el vídeo entra en programación
```

De la misma manera, retirar un vídeo de la playlist permite retirarlo de futuras reproducciones.

---

# Controles

La interfaz incluye:

```text
⏮ Anterior

Siguiente ⏭

🔀 Shuffle: ON / OFF

∞ Bucle: ON / OFF

↻ Refrescar lista
```

También están disponibles los controles propios del reproductor oficial de YouTube.

---

# Autoplay

Los navegadores modernos pueden impedir la reproducción automática con sonido hasta que exista una interacción de la persona usuaria.

Por este motivo, al abrir Archipiélago Vivo TV aparece inicialmente:

```text
▶ Iniciar reproducción
```

Después de esa interacción, la programación puede continuar automáticamente.

---

# Vídeos no disponibles

Algunos vídeos pueden:

* haber sido eliminados;
* convertirse en privados;
* estar restringidos geográficamente;
* impedir la reproducción embebida.

La aplicación intenta detectar estos errores y continuar con el siguiente contenido cuando es posible.

---

# Publicidad

La reproducción se realiza mediante el reproductor oficial de YouTube.

Por tanto, YouTube puede mostrar publicidad.

Archipiélago Vivo TV no modifica ni intenta bloquear los anuncios del reproductor oficial.

---

# Privacidad

La consulta de la composición de la playlist se realiza mediante Invidious.

La reproducción audiovisual se realiza mediante infraestructura de YouTube.

Por tanto, durante la reproducción pueden producirse conexiones con servicios pertenecientes a Google/YouTube y aplicarse sus correspondientes políticas técnicas y de privacidad.

---

# Dependencia de Invidious

Invidious se utiliza únicamente para obtener los metadatos necesarios para mantener sincronizada la programación.

No se utiliza para servir los vídeos.

La disponibilidad de las instancias públicas de Invidious puede variar.

Por este motivo, la aplicación incorpora varias instancias y utiliza mecanismos de fallback cuando una de ellas no responde.

---

# Uso previsto

Archipiélago Vivo TV puede utilizarse como:

* televisión web continua;
* canal audiovisual curatorial;
* pantalla para exposiciones;
* instalación audiovisual;
* pantalla informativa;
* reproducción en centros culturales;
* espacios comunitarios;
* encuentros y eventos;
* escaparates;
* televisores o pantallas dedicadas.

El objetivo principal es mantener una programación audiovisual que pueda evolucionar desde la playlist de origen sin necesidad de administrar manualmente la aplicación web.

---

# Proyecto

**Archipiélago Vivo**

Un proyecto orientado a visibilizar, conectar y documentar iniciativas, territorios, comunidades y procesos vinculados con Canarias.

```text
Archipiélago Vivo
        │
        └── Archipiélago Vivo TV
              │
              └── tv.archipielagovivo.org
```

---

# Estado

Versión actual del reproductor:

```text
v6
```

Arquitectura actual:

```text
Invidious API
      ↓
programación y sincronización

JavaScript
      ↓
cola + shuffle + loop

YouTube IFrame API
      ↓
reproducción
```

---

# Licencia

La licencia del código debe definirse en el archivo:

```text
LICENSE
```

Si se desea permitir reutilización, modificación y redistribución del código con pocas restricciones, una posible opción es la licencia MIT.

Los contenidos audiovisuales reproducidos por Archipiélago Vivo TV mantienen sus respectivas autorías, licencias y derechos y no quedan cubiertos por la licencia del código de este proyecto.
