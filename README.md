# Agenda de implementación MIND

App interactiva para planear y dar seguimiento al rollout de MIND por unidad de
negocio (UDN). Cada sesión de capacitación tiene: UDN, **Fase general** (Fase 1,
2 o 3 — la ola del programa de implementación), **Día** (1 a 5, la etapa dentro
de la capacitación: del "enseñar y capacitar" al "cierre"), fecha/hora, duración,
modalidad (**Virtual por Teams** o **Presencial**, con su sala o link), módulos,
roles requeridos, áreas involucradas, implementador(es) asignados y hallazgos
registrados durante la sesión.

Los catálogos de **UDN**, **Roles**, **Áreas**, **Módulos** e
**Implementadores** vienen precargados (los implementadores por defecto son
Byron Hidalgo, Ivan Olaya, Sergio Díaz y Tomás Cruz) y son editables desde el
botón **Catálogos**: puedes agregar o quitar elementos en cualquier momento sin
tocar código.

Tiene una sola pantalla principal, el **Cronograma**: una línea de tiempo
(Gantt) con una fila por UDN, ordenadas cronológicamente (la que empieza más
pronto va arriba), sobre un eje horizontal de meses con una línea vertical
"HOY". Cada UDN programada muestra una sola barra con el rango de fechas de
principio a fin (ej. "17 ago – 21 ago"), coloreada según modalidad (morado =
Virtual/Teams, verde azulado = Presencial; si mezcla ambas, la barra se ve en
degradado). Si una UDN aún no tiene fecha, aparece un botón "+ Programar".

Haz clic en el nombre de una UDN para entrar a su **detalle**: ahí ves, en una
sola pantalla, la agenda completa de esa UDN (tarjetas por fecha) con todo lo
necesario — agregar una sesión nueva, editarla o eliminarla — sin pantallas
intermedias. Haz clic en la barra del Cronograma (no en el nombre) para editar
directamente las fechas de inicio y fin de esa UDN: mueve o ajusta
proporcionalmente todas sus sesiones ya programadas.

Cuando abres "+ Nueva sesión" desde el detalle de una UDN o desde el botón
"+ Programar", el campo UDN ya viene fijo (no se puede — ni hace falta —
volver a elegirlo, porque ya se sabe de qué UDN se trata).

Dentro del detalle de cada UDN hay un interruptor **Vista completa / Vista
compacta**. La vista completa muestra la tarjeta de cada sesión con todo el
detalle (objetivo, módulos, roles, implementadores, hallazgos, etc.). La vista
compacta muestra solo una línea por sesión agrupada por día (hora, día, nombre,
fase y modalidad), ideal para ver de un vistazo todo el calendario de esa UDN;
desde ahí también puedes editar o eliminar cada sesión con los íconos de la
derecha.

Funciona en dos modos:

- **Modo demo local** (por defecto): puedes abrir `index.html` directamente en
  tu navegador y probar todo, pero los cambios solo viven en tu pestaña — no se
  comparten con nadie más ni se guardan al recargar.
- **Modo nube (recomendado)**: varias personas, incluso fuera de tu
  organización, pueden entrar al mismo link, ver el cronograma y editar fechas
  en tiempo real. Para esto necesitas conectar una base de datos gratuita
  (Supabase) y publicar la página en un link público (GitHub Pages). Son ~15
  minutos, sin tarjeta de crédito.

Esta app es un sitio 100% estático (HTML/CSS/JS sin build ni servidor propio):
por eso se puede publicar tal cual en GitHub Pages, y el "backend" es
Supabase, al que el navegador de cada persona se conecta directamente.

---

## Paso 1 — Crear tu proyecto gratuito en Supabase

1. Ve a https://supabase.com y crea una cuenta gratuita (puede ser con GitHub
   o con correo; no tiene que ser una cuenta de tu organización).
2. Clic en **"New project"**, dale un nombre (ej. `agenda-mind`), define una
   contraseña de base de datos (guárdala, aunque no la usarás desde la app) y
   elige la región más cercana a ti. Espera 1-2 minutos a que se aprovisione.
3. En el menú izquierdo entra a **SQL Editor → New query**. Abre el archivo
   **`supabase/schema.sql`** de esta carpeta, copia **todo** su contenido,
   pégalo ahí y dale **Run**. Esto crea las dos tablas que la app necesita
   (`capacitaciones` y `catalog_items`), activa Row Level Security con
   políticas específicas, y agrega ambas tablas a la publicación de tiempo
   real (para que los cambios se vean en vivo entre personas conectadas).
4. Ve a **Project Settings → API**. Ahí vas a ver **"Project URL"** y, más
   abajo, la llave **"anon public"**. Copia esos dos valores y pégalos en el
   archivo **`supabase-config.js`** de esta carpeta, reemplazando los que
   dicen `"TU_..."`. (El archivo `.env.example` documenta los mismos dos
   valores por si prefieres tenerlos anotados aparte; como este sitio no
   tiene proceso de build, el navegador no lee `.env` — el lugar que sí
   importa es `supabase-config.js`.)

La primera vez que la app se conecta a un proyecto vacío, siembra
automáticamente la tabla `catalog_items` con las UDN, roles, áreas, módulos e
implementadores que ya vienen precargados — no tienes que capturarlos de
nuevo.

### Seguridad — políticas de acceso (léelo antes de compartir el link)

`supabase/schema.sql` ya deja Row Level Security **activada** en ambas tablas,
con políticas explícitas por operación (no una regla genérica "permitir
todo a cualquiera en toda la base", que es lo que pasaría si dejaras las
tablas sin RLS). Concretamente: solo `capacitaciones` y `catalog_items`
son accesibles desde el navegador, y solo con las operaciones que la app
realmente usa (`catalog_items` ni siquiera tiene política de "update", por
ejemplo, porque la app nunca la necesita).

Dicho eso, sigue siendo cierto que **cualquier persona con el link puede
agregar, editar o borrar sesiones y catálogos** — no hay usuarios ni
contraseñas, tal como pediste (acceso único por enlace compartido, sin
autenticación). Antes de repartir el link ampliamente, te recomendamos
revisar y, si te hace sentido más cómodo, ajustar estas políticas a tu
propio criterio de riesgo. Algunas opciones si más adelante quieres algo
menos abierto, de menor a mayor esfuerzo:

- **Compartir el link solo con quien lo necesite** (no publicarlo en un canal
  abierto ni indexable): la llave "anon" es pública por diseño, pero sin el
  link nadie sabe a qué proyecto apuntar.
- **Agregar una política adicional más estricta**, por ejemplo limitar
  `delete` a sesiones de los últimos N días, o exigir que ciertos campos no
  vengan vacíos, editando las políticas en **Database → Policies** del
  dashboard de Supabase.
- **Rotar el "anon key"** desde Project Settings → API si alguna vez
  sospechas que se compartió de más (esto invalida el anterior).
- **Subir el nivel a autenticación real** (login por correo, Google, etc.)
  si en algún momento se vuelve necesario controlar quién edita qué —
  esto es un cambio más grande que sí requeriría tocar el código de la app;
  dínoslo si llegas a ese punto y lo agregamos.

---

## Paso 2 — Publicar la página con un link público (GitHub Pages)

1. Crea una cuenta gratuita en https://github.com si no tienes una.
2. Crea un repositorio nuevo (botón verde **"New"**), por ejemplo llamado
   `agenda-mind`. Puede ser público.
3. Sube los archivos de esta carpeta (`index.html`, `app.js`,
   `supabase-config.js` ya editado con tus datos reales, `README.md`; también
   puedes subir `.env.example` y la carpeta `supabase/` de una vez, no
   estorban) — puedes arrastrarlos directo en la página de GitHub con
   **"Add file → Upload files"**.
4. Ve a **Settings → Pages** del repositorio. En "Source" elige la rama `main`
   y la carpeta `/ (root)`, y guarda.
5. En 1–2 minutos GitHub te dará un link público como:
   `https://tu-usuario.github.io/agenda-mind/`
   Ese es el link que compartes con quien quieras, dentro o fuera de tu
   organización. No depende de ningún servidor local tuyo: corre por
   completo en el navegador de quien lo abra, conectándose directo a tu
   proyecto de Supabase.

**Alternativa aún más rápida (sin cuenta):** puedes arrastrar esta misma carpeta
a https://app.netlify.com/drop y te da un link público al instante. Es ideal
para probar rápido; para algo permanente, GitHub Pages es más estable.

---

## Cómo actualizar la agenda después

- Si usas el modo nube: cualquier cambio hecho desde la página (por cualquier
  persona) se guarda automáticamente en Supabase y se refleja para todos en
  segundos (vía Realtime). No necesitas volver a subir archivos.
- Si quieres cambiar el diseño o agregar campos nuevos, edita `index.html` /
  `app.js` y vuelve a subir esos archivos a GitHub (Supabase y los datos no se
  tocan). Si agregas un campo nuevo a las sesiones, también necesitarás una
  migración de esquema en Supabase (`ALTER TABLE ...`); pídenoslo y te
  ayudamos con el script.

## Estructura de cada sesión (capacitación)

| Campo | Descripción |
|---|---|
| UDN | Unidad de negocio que se capacita (del catálogo editable) |
| Fase general | Fase 1, 2 o 3 — la ola del programa de implementación |
| Día | Una de las 5 etapas fijas de la capacitación (Día 1 a Día 5) |
| Fecha / Hora de inicio / Duración | Cuándo y cuánto dura |
| Modalidad | Virtual (Teams) o Presencial — define el color en el Cronograma |
| Sala o Link | Sala física si es presencial; link de Teams si es virtual |
| Objetivo | Se autocompleta según el día elegido, editable |
| Módulos | Módulos de MIND que se cubren (catálogo editable) |
| Roles requeridos | Roles que deben asistir (catálogo editable) |
| Áreas involucradas | Opcional (catálogo editable) |
| Implementadores | Quién imparte la sesión (catálogo editable) |
| Hallazgos | Lista de hallazgos (fecha + texto) registrados durante/después de la sesión |
| Notas | Texto libre opcional |

La app avisa si dos sesiones presenciales chocan en la misma sala y horario.

## Catálogos precargados

Ya vienen cargadas las 28 UDN, 19 roles, 18 áreas, 11 módulos y 4
implementadores (Byron Hidalgo, Ivan Olaya, Sergio Díaz, Tomás Cruz) que
compartiste. Puedes agregar o quitar elementos en cualquier momento desde el
botón **Catálogos**, sin tocar el código.

## ¿Para qué sirve "Exportar .ics"?

Un archivo `.ics` es el formato estándar de calendario que entienden Outlook,
Google Calendar, Apple Calendar, etc. Al hacer clic en **Exportar .ics** se
descarga un archivo con **todas** las sesiones programadas como eventos, listo
para importarse a un calendario (Outlook → Agregar calendario → Importar
archivo .ics). Es útil si alguien quiere ver las sesiones en su calendario
personal además de en esta app, o para mandar invitaciones formales por
correo. Si nadie va a importar las sesiones a su calendario personal, no es
indispensable — la app funciona igual sin usarlo; es solo una exportación de
cortesía sin costo. Igual queda disponible el botón por si más adelante lo
necesitas.
