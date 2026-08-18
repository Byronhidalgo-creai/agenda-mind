// ============================================================
// CONFIGURACIÓN DE SUPABASE
// ============================================================
// Sigue la guía en README.md ("Paso 1: crear tu proyecto Supabase")
// para obtener estos valores gratis desde https://supabase.com
//
// Mientras dejes los valores tal cual están (con "TU_"), la agenda
// funciona en "modo demo local": sirve para probar la interfaz, pero
// los cambios NO se comparten con otras personas ni se guardan al
// recargar la página.
//
// En cuanto pegues tus valores reales aquí, la agenda se conecta a
// tu base de datos en la nube y cualquier persona con el link podrá
// ver y editar las sesiones en tiempo real (ver la sección "Seguridad"
// del README antes de compartir el link ampliamente).
//
// El "anon key" está pensado para vivir en el navegador (es la llave
// pública de tu proyecto, no una contraseña): lo que realmente protege
// tus datos son las políticas de Row Level Security definidas en
// supabase/schema.sql, no mantener este archivo en secreto.
// ============================================================

export const supabaseConfig = {
  url: "TU_SUPABASE_URL",         // ej. https://abcdefghijk.supabase.co
  anonKey: "TU_SUPABASE_ANON_KEY", // Project Settings → API → "anon public"
};

// Nombre de la tabla donde se guardan las sesiones de capacitación.
// Debe coincidir con la tabla creada por supabase/schema.sql.
export const SESSIONS_TABLE = "capacitaciones";

// Nombre de la tabla donde se guardan los elementos de los catálogos
// editables (UDN, Roles, Módulos, Implementadores). Cada fila es
// un elemento; la columna "kind" indica a qué catálogo pertenece.
export const CATALOG_TABLE = "catalog_items";

// Nombre de la tabla donde se guarda la plantilla de agenda (roles,
// módulos y duración por día) que se usa al crear una semana nueva con
// "Asignar semana". Se actualiza con el botón "Importar agenda".
export const TEMPLATE_TABLE = "agenda_template";
