# Plan de migración — PCB TechDesk 2.2

## Objetivo

Separar el nuevo sistema de cualquier cuenta, contraseña, proyecto Supabase o control administrativo que pertenezca al estudiante que construyó la versión anterior.

## Fase 1 — Congelar el sistema actual

- Guardar copia local de todos los HTML actuales.
- Documentar la URL actual, proyecto Supabase conocido y tablas utilizadas.
- No eliminar nada todavía.
- Cambiar/retirar credenciales administrativas codificadas en páginas públicas cuando el nuevo sistema entre en producción.

## Fase 2 — Crear propiedad institucional

- Proyecto Supabase nuevo bajo una cuenta controlada por Roberto/administración.
- Repositorio GitHub nuevo o rama `techdesk-v2` con al menos dos administradores de confianza.
- Registrar en un documento interno quién tiene acceso a Supabase, GitHub y dominio.

## Fase 3 — Configurar y probar

- Ejecutar `schema.sql`.
- Crear un administrador y 2–3 técnicos de prueba.
- Crear boletas desde móvil y PC.
- Probar asignación, cambio de estado, resolución, cierre, seguimiento y evaluación.
- Probar RLS: un técnico no debe poder modificar una boleta asignada a otro.
- Verificar evidencia fotográfica y límites de archivo.

## Fase 4 — Migrar datos históricos

Si se recupera acceso a la base anterior:

- Exportar tablas relevantes a CSV.
- Limpiar duplicados.
- Mapear estados y nombres de técnicos.
- Importar en lote.
- Comparar conteos antes/después.

Si NO se recupera acceso:

- Comenzar con una base nueva.
- Conservar cualquier CSV/email/documento viejo como archivo histórico.
- No depender del sistema viejo para operaciones nuevas.

## Fase 5 — Producción

- `demoMode: false`.
- Deshabilitar registro público de usuarios.
- Configurar RLS y Storage.
- Publicar GitHub Pages/Vercel.
- Añadir enlace desde PCB System.
- Mantener el sistema viejo solo en modo lectura durante una transición corta.

## Fase 6 — Automatización

- Snapshot diario de métricas.
- Informe semanal por email.
- Alertas de SLA crítico.
- Reporte mensual para administración.
