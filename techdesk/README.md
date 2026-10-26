# PCB TechDesk 2.2.3

Rediseño completo del sistema de boletas de servicio técnico de la Escuela Superior Ocupacional Pablo Colón Berdecia / COMPUTEC.

## Qué cambia

El sistema anterior mezclaba Supabase y `localStorage`, incluía autenticación/contraseñas en JavaScript y tenía páginas que no compartían una sola fuente de verdad. Esta versión usa una arquitectura única:

- **Frontend:** HTML5 + CSS3 + JavaScript ES Modules, sin proceso de compilación. Ideal para GitHub Pages.
- **Backend:** Supabase PostgreSQL.
- **Autenticación:** Supabase Auth.
- **Autorización:** perfiles `admin` / `technician` y Row Level Security (RLS).
- **Archivos:** Supabase Storage privado para evidencia.
- **Tiempo real:** preparado para Supabase Realtime.
- **Reportes:** métricas por periodo, técnico y estado; CSV, impresión/PDF y snapshot diario.
- **Automatización:** plantilla de Edge Function para informe semanal por correo.
- **PWA:** manifest + service worker para una experiencia más parecida a una app.

## Directorio rápido de personal escolar

La pantalla pública incluye un dropdown con el personal docente/profesional suministrado por la escuela. Al seleccionar una persona, el sistema completa automáticamente su nombre y área. La opción **Otro personal escolar** abre campos mínimos para asistentes administrativos, secretaría, asistentes de Educación Especial, comedor, custodia, seguridad, administración u otro personal.

Por privacidad, los correos institucionales suministrados no se incluyen en el JavaScript público. Si posteriormente se desean notificaciones automáticas por correo, se recomienda guardar esos correos en una tabla protegida de Supabase y consultarlos desde una función segura.

## Flujo de una boleta

1. Maestro/personal crea la boleta desde `index.html`.
2. PostgreSQL genera `PCB-AAAA-00001`, un token privado de seguimiento y el SLA.
3. Administración ve la boleta en `app.html` y la asigna.
4. El técnico inicia trabajo y puede cambiar estados intermedios.
5. Para resolver debe documentar **diagnóstico + solución + tiempo**.
6. Una boleta resuelta puede cerrarse.
7. El solicitante usa su enlace privado para revisar el estado y evaluar el servicio.
8. Administración consulta `reports.html` y exporta datos.

## Archivos principales

- `index.html` — portal público: crear y seguir boletas.
- `login.html` — acceso de administrador/técnico.
- `app.html` — centro de operaciones.
- `reports.html` — analítica y exportación.
- `assets/config.js` — URL y publishable key de TU proyecto Supabase.
- `supabase/schema.sql` — base de datos, funciones, RLS, Storage y métricas.
- `supabase/functions/weekly-report/index.ts` — reporte semanal por email (opcional).

## Instalación recomendada

### 1. Crea un proyecto Supabase NUEVO

Hazlo desde una cuenta institucional/personal que tú controles. No reutilices una base de datos cuyo ownership o acceso administrativo dependa de otra persona.

### 2. Ejecuta el esquema

En Supabase > SQL Editor, pega y ejecuta `supabase/schema.sql` una sola vez sobre el proyecto nuevo.

### 3. Crea el primer administrador

En Supabase > Authentication > Users crea tu usuario. Después ejecuta:

```sql
update public.profiles p
set role='admin'
from auth.users u
where p.id=u.id and u.email='TU-CORREO@ESCUELA.PR';
```

Para técnicos, crea usuarios adicionales desde Authentication > Users. El trigger los crea como `technician` de forma predeterminada.

### 4. Configura el frontend

Edita `assets/config.js`:

```js
export const CONFIG = {
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU_PUBLISHABLE_KEY',
  schoolName: 'Escuela Superior Ocupacional Pablo Colón Berdecia',
  departmentName: 'COMPUTEC · Servicio Técnico Escolar',
  supportEmail: '',
  demoMode: false
};
```

La **publishable key** sí puede estar en el frontend; la seguridad real la controlan RLS y las políticas. Nunca pongas una `secret key`/service role en HTML o JavaScript público.

### 5. Supabase Auth

- Deshabilita registro público si solo la administración creará cuentas.
- Añade la URL de GitHub Pages/Vercel a las URLs permitidas de Auth.
- No vuelvas a implementar usuarios/contraseñas con `localStorage`.

### 6. Publica

Puedes subir toda esta carpeta a GitHub y usar GitHub Pages, o desplegarla en Vercel. No hace falta compilar.

## Reporte semanal automático (opcional)

La Edge Function incluida espera estos secretos:

- `SUPABASE_SECRET_KEY` (o service role legado, solo backend)
- `RESEND_API_KEY`
- `REPORT_TO`
- `REPORT_FROM`

Después de desplegar la función `weekly-report`, programa su ejecución con Supabase Cron. Guarda secretos únicamente en el backend/Vault; nunca en el repositorio público.

## Email automático al crear una boleta

La Edge Function `new-ticket-email` envía una notificación interna después de guardar cada boleta. Configura estos secretos en **Supabase Dashboard → Edge Functions → Secrets**:

- `RESEND_API_KEY`: clave privada de Resend.
- `NEW_TICKET_TO`: uno o varios destinatarios separados por comas.
- `NEW_TICKET_FROM`: remitente de un dominio verificado, por ejemplo `PCB TechDesk <boletas@tudominio.com>`.

Despliega la función con `supabase functions deploy new-ticket-email`. El archivo `supabase/config.toml` permite invocarla con la clave pública moderna de Supabase; dentro de la función se validan esa clave y el token privado de la boleta antes del envío. Para pruebas, Resend permite usar `onboarding@resend.dev` como remitente con las restricciones propias de su modo de prueba. La clave de Resend nunca debe colocarse en `assets/config.js`.

## Cuentas y asignación de técnicos

El login separa las credenciales de administrador y técnico. Solo administración puede crear cuentas técnicas, ver todas las boletas y asignarlas desde el menú desplegable. Cada técnico ve únicamente las boletas asignadas a su cuenta y puede documentarlas y resolverlas.

Para habilitar el botón **Añadir técnico**, despliega la función protegida:

```bash
supabase functions deploy create-technician
```

La función valida que quien hace la solicitud tenga un perfil `admin` activo antes de crear el usuario de Supabase Auth. La clave administrativa se usa solamente dentro de la función y nunca se expone en el navegador.

## Migración del sistema anterior

No recomiendo copiar el sistema anterior completo. Migra **datos**, no la arquitectura.

1. Exporta `solicitudes_servicio` del proyecto viejo a CSV si logras acceso.
2. Conserva como mínimo: maestro, departamento, tipo de problema, urgencia, descripción, estado, técnico, código, fecha.
3. Importa esos registros a una tabla temporal.
4. Convierte estados antiguos a los nuevos (`Pendiente -> new`, `En Proceso -> in_progress`, `Completada/Resuelto -> resolved`).
5. Mantén el CSV original archivado como respaldo.

Si nunca recuperas el control de la base antigua, empieza el año con el sistema nuevo y conserva los HTML viejos solo como referencia histórica.

## Mejoras siguientes que encajan con esta arquitectura

- Inventario de equipos y QR por activo.
- Notificaciones de nueva boleta por email/Teams/WhatsApp institucional.
- Firma digital del solicitante al cerrar.
- Adjuntos “antes/después”.
- Dashboard para estudiantes técnicos con horas de práctica.
- Calificación académica separada de la satisfacción del maestro.
- IA para sugerir categoría, prioridad y posibles pasos de diagnóstico, sin cerrar boletas automáticamente.


## Actualización visual 2.1 — Dashboard escolar y formulario rápido

La interfaz fue rediseñada con un estilo claro tipo centro de operaciones: fondo blanco/gris, barra lateral azul marino, tarjetas compactas, indicadores por estado, alertas críticas, carga por técnico y paneles similares a un dashboard moderno de IT.

El formulario público fue simplificado para uso rápido desde smartphones. Solamente el nombre y un detalle opcional requieren escritura libre; departamento, ubicación, tipo de problema, síntoma, impacto, urgencia y equipo se seleccionan mediante menús desplegables. Los datos avanzados del equipo y las fotografías están dentro de una sección opcional para no atrasar al personal escolar.

En pantallas pequeñas, el formulario cambia a una sola columna con controles grandes de 16 px y botón de envío accesible; el panel técnico cambia a tarjetas y una navegación inferior pensada para uso con el pulgar.

## Corrección 2.2.3 — directorio de personal

El directorio de personal está ahora incluido directamente dentro de `index.html`, por lo que los nombres se muestran sin depender de Supabase ni de la carga de JavaScript. Supabase solo es necesario cuando se desea guardar las boletas, usuarios y reportes de forma centralizada entre dispositivos.

Si publicas una versión nueva en GitHub Pages y ves una versión anterior, actualiza la página con `Ctrl+F5` o elimina los datos del sitio una vez; el service worker usa un caché versionado nuevo en esta revisión.


## Cambios 2.2.3
- El selector de personal vuelve a ser un dropdown nativo y siempre visible.
- Los 52 registros reales del personal están incrustados en el HTML para que aparezcan aunque falle Supabase o un módulo JavaScript.
- Al escoger un nombre se completan automáticamente correo, asignatura/función, horario de capacitación, grado/grupo y departamento.
- La opción **Otro personal escolar** cambia el control a modo de escritura libre y permite regresar a la lista.
