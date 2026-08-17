import { supabaseConfig, SESSIONS_TABLE, CATALOG_TABLE, TEMPLATE_TABLE } from "./supabase-config.js";

/* ============================================================
   DÍAS DE CAPACITACIÓN FIJOS (Día 1 a Día 5)
   Nota: esto es la etapa dentro de cada sesión de capacitación.
   La "Fase" (Fase 1 / 2 / 3) es un concepto distinto: la ola/etapa
   general del programa de implementación, y vive en cada sesión
   como el campo `fase`.
   ============================================================ */
const DIAS = [
  { id: "dia1", dia: 1, nombre: "Enseñar y capacitar", objetivo: "Todos los roles convocados conocen MIND y tienen acceso configurado.", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  { id: "dia2", dia: 2, nombre: "Práctica guiada (STG)", objetivo: "Cada rol ejecuta sus tareas principales en MIND con acompañamiento; se capacitan los módulos MMS y creación de tickets de soporte.", color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" },
  { id: "dia3", dia: 3, nombre: "Práctica con datos reales (PROD)", objetivo: "El sistema refleja la operación real de la UDN sin datos ficticios, incluyendo los flujos MMS.", color: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  { id: "dia4", dia: 4, nombre: "Ellos hacen y preguntan", objetivo: "Los roles operan MIND de forma autónoma.", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  { id: "dia5", dia: 5, nombre: "Cierre", objetivo: "100% de roles capacitados en ambas fases, con acceso, agentes activos y modelos entendidos.", color: "#5b6a0e", bg: "#fcfce9", border: "#e6ee9c" },
];
const diaById = id => DIAS.find(f => f.id === id);
const FASES_GENERAL = ["Fase 1", "Fase 2", "Fase 3"];

/* ============================================================
   PLANTILLA DE AGENDA (roles/módulos/duración por día)
   Se usa como valor por default al crear una semana nueva con
   "Asignar semana", para no tener que capturar cada rol/módulo a
   mano. Arranca con los valores reales de la agenda general que
   nos compartieron (agrupando por día todos los roles y módulos
   que aparecen, y sumando la duración de cada bloque); se puede
   reemplazar en cualquier momento desde "Importar agenda".
   ============================================================ */
const BUILTIN_TEMPLATE = {
  dia1: {
    duracion: 360, // 6 h
    roles: ["Gerentes y directivos de UDN", "Gerente de logística", "Gerente de Operaciones", "Logística Operativa (MAE)",
      "Jefe de coordinadores", "Coordinador de Operaciones", "Seguridad Vial", "RP", "Administración", "Facturación",
      "Técnico de Rutas", "Operador de monitoreo", "Jefe de Cabina", "Ajustador", "Jefe de logística",
      "Gerente General de UDN", "Jefe de monitoreo", "Gerente de Administración", "Gerente de RP"],
    modulos: ["Landing Page / Agenda", "Clientes, Unidades y Operadores", "Supervisores", "Agente compañero de viaje",
      "Rutas", "Programación maestra", "Incidencias", "Agente clasificador de incidencias", "Aprobaciones"],
  },
  dia2: {
    duracion: 360, // 6 h
    roles: ["Logística Operativa (MAE)", "Jefe de coordinadores", "Coordinador de Operaciones", "Técnico de Rutas",
      "Gerente de logística", "Gerente de Operaciones", "Jefe de logística", "Gerente General de UDN",
      "Jefe de monitoreo", "Gerente de Administración", "Gerente de RP"],
    modulos: ["Clientes, Unidades y Operadores", "Supervisores", "Agente compañero de viaje", "Rutas",
      "Programación maestra", "Incidencias", "Agente clasificador de incidencias", "Aprobaciones"],
  },
  dia3: {
    duracion: 300, // 5 h
    roles: ["Jefe de coordinadores", "Coordinador de Operaciones", "Logística Operativa (MAE)", "Técnico de Rutas",
      "Gerente de logística", "Gerente de Operaciones", "Jefe de logística", "Gerente General de UDN",
      "Jefe de monitoreo", "Gerente de Administración", "Gerente de RP"],
    modulos: ["Supervisores", "Agente compañero de viaje", "Incidencias", "Agente clasificador de incidencias",
      "Rutas", "Programación maestra", "Aprobaciones"],
  },
  dia4: {
    duracion: 300, // 5 h
    roles: ["Jefe de coordinadores", "Coordinador de Operaciones", "Logística Operativa (MAE)", "Técnico de Rutas",
      "Gerente de logística", "Gerente de Operaciones", "Jefe de logística", "Gerente General de UDN",
      "Jefe de monitoreo", "Gerente de Administración", "Gerente de RP"],
    modulos: ["Incidencias", "Agente clasificador de incidencias", "Rutas", "Programación maestra", "Aprobaciones"],
  },
  dia5: {
    duracion: 225, // 3 h 45 min
    roles: ["Jefe de coordinadores", "Coordinador de Operaciones", "Logística Operativa (MAE)", "Técnico de Rutas",
      "Gerentes y directivos de UDN"],
    modulos: ["Agente compañero de viaje", "Incidencias", "Agente clasificador de incidencias", "Rutas",
      "Programación maestra", "Sesión de cierre"],
  },
};
// `agendaTemplate` es el que realmente se usa en la app: arranca igual al
// default de arriba, pero se puede reemplazar con "Importar agenda" (y esa
// versión importada es la que se guarda en la nube para que la vean todos).
let agendaTemplate = JSON.parse(JSON.stringify(BUILTIN_TEMPLATE));

/* ============================================================
   ESTADO Y MODO DE CONEXIÓN
   ============================================================ */
let sessions = [];
let catalogs = { udn: [], roles: [], modulos: [], implementadores: [] };
let mode = "demo";
let supabase = null;

const isConfigured =
  supabaseConfig.url && !supabaseConfig.url.startsWith("TU_") &&
  supabaseConfig.anonKey && !supabaseConfig.anonKey.startsWith("TU_");

function seedCatalogs() {
  catalogs.udn = [
    "LIPU Aguascalientes", "LIPU Cancún", "LIPU Colima", "LIPU Guadalajara", "LIPU Lázaro Cárdenas",
    "LIPU Mérida", "LIPU Monterrey", "LIPU Querétaro", "LIPU Saltillo", "LIPU San Luis", "LIPU VDM",
    "MEZA México", "STP Cd. Juárez", "STP García", "STP Hermosillo", "STP Los Cabos", "STP Mexicali",
    "STP Monterrey", "STP Puebla", "STP Saltillo", "STP San Quintín", "STP Silao", "STP Tijuana 1",
    "STP Tijuana 2", "UTEP Celaya", "UTEP México", "UTEP Querétaro", "UTEP San Luis",
  ];
  catalogs.roles = [
    "Analista Comercial", "Analista de Logística", "Analista de Mantenimiento", "Coordinador de Operaciones",
    "Ejecutivo de Cuenta", "Gerente Comercial", "Gerente de Mantenimiento", "Gerente de Operaciones",
    "Gerente General UDN", "Gerente Logística", "Gerente RP y RE", "Implant (RP)", "Jefe de Mantenimiento",
    "Jefe de Operaciones", "Logística Operativa (MAE)", "Monitoreo (Cabina)", "Operador", "Técnico de Rutas",
    "Tecnología a Bordo",
  ];
  catalogs.modulos = [
    "Landing Page / Agenda", "Clientes, Unidades y Operadores", "Supervisores", "Agente compañero de viaje",
    "Rutas", "Programación maestra", "Incidencias", "Agente clasificador de incidencias", "Aprobaciones",
    "Monitoreo", "Sesión de cierre",
  ];
  catalogs.implementadores = ["Byron Hidalgo", "Ivan Olaya", "Sergio Díaz", "Tomas Cruz"];
}

function seedDemoSessions() {
  if (sessions.length) return;
  const today = new Date();
  const d = (offset) => { const x = new Date(today); x.setDate(x.getDate() + offset); return x.toISOString().slice(0, 10); };
  let n = 0;
  const mk = (udn, diaId, fase, offset, modalidad, lugar, modulos, roles, implementadores) => ({
    id: "demo-" + (++n), udn, diaId, fase, date: d(offset), start: "09:00", duration: 90,
    modalidad, lugar, modulos, roles, implementadores: implementadores || [],
    objetivo: diaById(diaId).objetivo, notas: "", hallazgos: [],
  });
  sessions = [
    mk("LIPU Monterrey", "dia1", "Fase 1", 1, "Virtual (Teams)", "https://teams.microsoft.com/l/meetup/demo1", ["Landing Page / Agenda"], ["Gerentes y directivos de UDN"], ["Byron Hidalgo"]),
    mk("LIPU Monterrey", "dia2", "Fase 1", 8, "Presencial", "Sala de capacitación 1", ["Rutas", "Programación maestra"], ["Gerente Logística", "Gerente de Operaciones"], ["Ivan Olaya"]),
    mk("STP Monterrey", "dia1", "Fase 2", 3, "Virtual (Teams)", "https://teams.microsoft.com/l/meetup/demo2", ["Landing Page / Agenda"], ["Gerentes y directivos de UDN"], ["Sergio Díaz"]),
  ];
}

/* ============================================================
   MAPEO DE CAMPOS — objeto de sesión (camelCase, usado en toda la
   app) <-> fila de la tabla "capacitaciones" en Supabase (snake_case)
   ============================================================ */
function rowToSession(row) {
  return {
    id: row.id,
    udn: row.udn,
    fase: row.fase,
    diaId: row.dia_id,
    date: row.date,
    start: row.start_time,
    duration: row.duration,
    modalidad: row.modalidad,
    lugar: row.lugar,
    objetivo: row.objetivo,
    notas: row.notas,
    modulos: row.modulos || [],
    roles: row.roles || [],
    implementadores: row.implementadores || [],
    hallazgos: row.hallazgos || [],
  };
}
function sessionToRow(data) {
  return {
    udn: data.udn,
    fase: data.fase || null,
    dia_id: data.diaId,
    date: data.date,
    start_time: data.start,
    duration: data.duration,
    modalidad: data.modalidad,
    lugar: data.lugar || null,
    objetivo: data.objetivo || null,
    notas: data.notas || null,
    modulos: data.modulos || [],
    roles: data.roles || [],
    implementadores: data.implementadores || [],
    hallazgos: data.hallazgos || [],
  };
}

async function fetchSessions() {
  const { data, error } = await supabase.from(SESSIONS_TABLE).select("*");
  if (error) { console.error("[Agenda MIND] Error leyendo sesiones:", error); return; }
  sessions = (data || []).map(rowToSession);
  renderAll();
}
async function fetchCatalogs() {
  const { data, error } = await supabase.from(CATALOG_TABLE).select("*").order("id", { ascending: true });
  if (error) { console.error("[Agenda MIND] Error leyendo catálogos:", error); return; }
  const grouped = { udn: [], roles: [], modulos: [], implementadores: [] };
  (data || []).forEach(row => { (grouped[row.kind] ??= []).push(row.value); });
  catalogs = grouped;
  populateStaticSelects();
  renderAll();
}
async function seedCatalogsInSupabase() {
  seedCatalogs(); // llena `catalogs` en memoria con los valores por defecto
  const rows = [];
  Object.entries(catalogs).forEach(([kind, values]) => values.forEach(value => rows.push({ kind, value })));
  const { error } = await supabase.from(CATALOG_TABLE).insert(rows);
  if (error) console.error("[Agenda MIND] No se pudo sembrar el catálogo inicial:", error);
}

/* ============================================================
   PERSISTENCIA — PLANTILLA DE AGENDA (roles/módulos/duración por día)
   ============================================================ */
async function fetchTemplate() {
  const { data, error } = await supabase.from(TEMPLATE_TABLE).select("*");
  if (error) { console.error("[Agenda MIND] Error leyendo la plantilla de agenda:", error); return; }
  const grouped = {};
  (data || []).forEach(row => {
    grouped[row.dia_id] = { roles: row.roles || [], modulos: row.modulos || [], duracion: row.duracion || 0 };
  });
  if (Object.keys(grouped).length) agendaTemplate = grouped;
}
async function seedTemplateInSupabase() {
  const rows = Object.entries(BUILTIN_TEMPLATE).map(([dia_id, t]) => ({ dia_id, roles: t.roles, modulos: t.modulos, duracion: t.duracion }));
  const { error } = await supabase.from(TEMPLATE_TABLE).insert(rows);
  if (error) console.error("[Agenda MIND] No se pudo sembrar la plantilla inicial:", error);
}
async function saveTemplateToSupabase(partialTemplate) {
  const rows = Object.entries(partialTemplate).map(([dia_id, t]) => ({ dia_id, roles: t.roles, modulos: t.modulos, duracion: t.duracion }));
  const { error } = await supabase.from(TEMPLATE_TABLE).upsert(rows, { onConflict: "dia_id" });
  if (error) console.error("[Agenda MIND] Error guardando la plantilla de agenda:", error);
}

async function initBackend() {
  if (!isConfigured) {
    seedCatalogs();
    seedDemoSessions();
    setConnBadge(false);
    showBanner("Estás en modo demo local: los cambios no se comparten con otras personas hasta que conectes Supabase (ver README.md).");
    populateStaticSelects();
    renderAll();
    return;
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

    const { count, error: countErr } = await supabase
      .from(CATALOG_TABLE)
      .select("*", { count: "exact", head: true });
    if (countErr) throw countErr;
    if (!count) await seedCatalogsInSupabase();

    const { count: tplCount, error: tplCountErr } = await supabase
      .from(TEMPLATE_TABLE)
      .select("*", { count: "exact", head: true });
    if (tplCountErr) throw tplCountErr;
    if (!tplCount) await seedTemplateInSupabase();

    await fetchCatalogs();
    await fetchSessions();
    await fetchTemplate();

    const onRealtimeIssue = (label) => (status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        console.warn(`[Agenda MIND] No se pudo suscribir en tiempo real a "${label}" (status: ${status}). ` +
          `Revisa que la tabla esté agregada a la publicación "supabase_realtime" (ver supabase/schema.sql). ` +
          `Tus propios cambios seguirán funcionando; solo no verás en vivo los cambios de otras personas hasta recargar.`);
      }
    };
    supabase
      .channel("capacitaciones-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: SESSIONS_TABLE }, () => fetchSessions())
      .subscribe(onRealtimeIssue(SESSIONS_TABLE));
    supabase
      .channel("catalogos-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: CATALOG_TABLE }, () => fetchCatalogs())
      .subscribe(onRealtimeIssue(CATALOG_TABLE));
    supabase
      .channel("plantilla-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: TEMPLATE_TABLE }, () => fetchTemplate())
      .subscribe(onRealtimeIssue(TEMPLATE_TABLE));

    mode = "cloud";
    setConnBadge(true);
  } catch (err) {
    console.error(err);
    mode = "demo";
    setConnBadge(false);
    seedCatalogs(); seedDemoSessions();
    showBanner("Hubo un problema conectando a Supabase (revisa supabase-config.js y las políticas de la base de datos, ver README.md). Estás en modo demo local.");
    populateStaticSelects();
    renderAll();
  }
}

function setConnBadge(live) {
  document.getElementById("connDot").classList.toggle("live", live);
  document.getElementById("connText").textContent = live ? "Conectado en la nube — cambios en vivo" : "Modo demo local";
}
function showBanner(msg) {
  // La barra de aviso visual se quitó de la interfaz a pedido; se deja constancia en consola.
  console.info("[Agenda MIND]", msg);
}

/* ============================================================
   PERSISTENCIA — SESIONES
   ============================================================ */
async function saveSession(data) {
  if (mode === "cloud") {
    if (data.id) {
      const { id, ...rest } = data;
      const { data: updated, error } = await supabase
        .from(SESSIONS_TABLE).update(sessionToRow(rest)).eq("id", id).select().single();
      if (error) { console.error("[Agenda MIND] Error guardando sesión:", error); return; }
      const idx = sessions.findIndex(s => s.id === id);
      if (idx >= 0) sessions[idx] = rowToSession(updated); else sessions.push(rowToSession(updated));
    } else {
      const { data: inserted, error } = await supabase
        .from(SESSIONS_TABLE).insert(sessionToRow(data)).select().single();
      if (error) { console.error("[Agenda MIND] Error creando sesión:", error); return; }
      sessions.push(rowToSession(inserted));
    }
    // La suscripción en tiempo real refresca a las demás personas conectadas;
    // aquí además actualizamos de una vez la vista local para que se sienta
    // instantáneo incluso si el tiempo real tarda un poco.
    renderAll();
  } else {
    if (data.id) {
      const idx = sessions.findIndex(s => s.id === data.id);
      if (idx >= 0) sessions[idx] = { ...data };
    } else {
      sessions.push({ ...data, id: "local-" + Date.now() });
    }
    renderAll();
  }
}
async function deleteSession(id) {
  if (mode === "cloud") {
    const { error } = await supabase.from(SESSIONS_TABLE).delete().eq("id", id);
    if (error) { console.error("[Agenda MIND] Error eliminando sesión:", error); return; }
    sessions = sessions.filter(s => s.id !== id);
    renderAll();
  } else {
    sessions = sessions.filter(s => s.id !== id);
    renderAll();
  }
}

/* ============================================================
   PERSISTENCIA — CATÁLOGOS
   ============================================================ */
async function addCatalogItem(kind, rawValue) {
  const value = (rawValue || "").trim();
  if (!value) return;
  if (catalogs[kind].some(v => v.toLowerCase() === value.toLowerCase())) return;
  if (mode === "cloud") {
    const { error } = await supabase.from(CATALOG_TABLE).insert({ kind, value });
    // 23505 = violación de índice único: alguien más ya agregó el mismo
    // valor justo antes; no es un error real, seguimos y lo reflejamos.
    if (error && error.code !== "23505") { console.error("[Agenda MIND] Error agregando al catálogo:", error); return; }
    catalogs[kind] = [...catalogs[kind], value];
    populateStaticSelects();
    renderCatalogLists();
    renderAll();
  } else {
    catalogs[kind] = [...catalogs[kind], value];
    populateStaticSelects();
    renderCatalogLists();
    renderAll();
  }
}
async function removeCatalogItem(kind, value) {
  if (mode === "cloud") {
    const { error } = await supabase.from(CATALOG_TABLE).delete().eq("kind", kind).eq("value", value);
    if (error) { console.error("[Agenda MIND] Error quitando del catálogo:", error); return; }
    catalogs[kind] = catalogs[kind].filter(v => v !== value);
    populateStaticSelects();
    renderCatalogLists();
    renderAll();
  } else {
    catalogs[kind] = catalogs[kind].filter(v => v !== value);
    populateStaticSelects();
    renderCatalogLists();
    renderAll();
  }
}

/* ============================================================
   UTILIDADES
   ============================================================ */
function timeToMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToLabel(mins) { const h = Math.floor(mins / 60), m = mins % 60; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; }
function fmtDuration(mins) { const h = Math.floor(mins / 60), m = mins % 60; if (h && m) return `${h}h ${m}min`; if (h) return `${h}h`; return `${m}min`; }
function fmtDateHeading(dateStr) { const dt = new Date(dateStr + "T00:00:00"); return dt.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function fmtDateShort(dateStr) { const dt = new Date(dateStr + "T00:00:00"); return dt.toLocaleDateString("es-MX", { day: "numeric", month: "short" }); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function sessionsOverlap(a, b) {
  if (a.modalidad !== "Presencial" || b.modalidad !== "Presencial") return false;
  if (!a.lugar || !b.lugar || a.lugar !== b.lugar || a.date !== b.date) return false;
  const aStart = timeToMinutes(a.start), aEnd = aStart + Number(a.duration);
  const bStart = timeToMinutes(b.start), bEnd = bStart + Number(b.duration);
  return aStart < bEnd && bStart < aEnd;
}
function findConflicts(target) { return sessions.filter(s => s.id !== target.id && sessionsOverlap(s, target)); }

/* ============================================================
   FILTROS / VISTA / DRILL-DOWN
   ============================================================ */
let filters = { udn: "", faseGeneral: "", modalidad: "", search: "" };
let drill = { level: "timeline", udn: null, diaId: null, date: null };
function resetDrill() { drill = { level: "timeline", udn: null, diaId: null, date: null }; }

function populateStaticSelects() {
  fillSelect("filterUDN", catalogs.udn, "Todas las UDN", true);
  fillSelect("f_udn", catalogs.udn, "Seleccionar UDN...", false);
  fillSelect("filterFaseGeneral", FASES_GENERAL, "Todas las fases", true);
  fillSelectObjects("f_dia", DIAS, "Seleccionar día...", false);
  fillDatalist("modulosList", catalogs.modulos);
  fillDatalist("rolesList", catalogs.roles);
  fillDatalist("implementadoresList", catalogs.implementadores);
  renderCatalogLists();
}
function fillSelect(id, arr, placeholder, keepValue) {
  const el = document.getElementById(id);
  const current = el.value;
  el.innerHTML = `<option value="">${placeholder}</option>` + arr.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  if (keepValue && arr.includes(current)) el.value = current;
}
function fillSelectObjects(id, arr, placeholder, keepValue) {
  const el = document.getElementById(id);
  const current = el.value;
  el.innerHTML = `<option value="">${placeholder}</option>` + arr.map(f => `<option value="${f.id}">Día ${f.dia} · ${escapeHtml(f.nombre)}</option>`).join("");
  if (keepValue && arr.some(f => f.id === current)) el.value = current;
}
function fillDatalist(id, arr) {
  document.getElementById(id).innerHTML = arr.map(v => `<option value="${escapeHtml(v)}">`).join("");
}

function sessionMatchesFilters(s, { ignoreUdn = false } = {}) {
  if (!ignoreUdn && filters.udn && s.udn !== filters.udn) return false;
  if (filters.faseGeneral && s.fase !== filters.faseGeneral) return false;
  if (filters.modalidad && s.modalidad !== filters.modalidad) return false;
  const q = filters.search.trim().toLowerCase();
  if (q) {
    const dia = diaById(s.diaId);
    const hay = [
      s.udn, s.fase, dia ? dia.nombre : "", s.objetivo, s.lugar,
      ...(s.modulos || []), ...(s.roles || []), ...(s.implementadores || []),
      ...(s.hallazgos || []).map(h => h.texto),
    ].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}
function getFilteredSessions() {
  return sessions.filter(s => sessionMatchesFilters(s));
}

/* ============================================================
   RENDER
   ============================================================ */
function renderAll() {
  const content = document.getElementById("content");
  const list = getFilteredSessions();
  content.innerHTML = "";
  renderTimeline(list, content);
}

/* ---------- Cronograma: timeline (Gantt de rangos) + detalle de UDN ---------- */
function renderTimeline(list, content) {
  if (!catalogs.udn.length) {
    content.innerHTML = `<div class="empty">Aún no hay UDN en el catálogo. Ábrelo con el botón <b>Catálogos</b> para agregar la primera.</div>`;
    return;
  }
  if (drill.level === "udn") return renderUdnDetail(content);
  return renderTimelineMain(list, content);
}

function computeTimelineRange() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dates = sessions.filter(s => s.date).map(s => new Date(s.date + "T00:00:00"));
  let minD = new Date(today), maxD = new Date(today);
  dates.forEach(d => { if (d < minD) minD = new Date(d); if (d > maxD) maxD = new Date(d); });
  minD.setDate(minD.getDate() - 14);
  maxD.setDate(maxD.getDate() + 30);
  minD = new Date(minD.getFullYear(), minD.getMonth(), 1);
  maxD = new Date(maxD.getFullYear(), maxD.getMonth() + 1, 0);
  return { minD, maxD, today };
}

function renderTimelineMain(list, content) {
  const { minD, maxD, today } = computeTimelineRange();
  const totalDays = Math.max(1, Math.round((maxD - minD) / 86400000));
  const months = [];
  let cursor = new Date(minD);
  while (cursor <= maxD) {
    const mStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const visStart = mStart < minD ? minD : mStart;
    const visEnd = mEnd > maxD ? maxD : mEnd;
    const days = Math.round((visEnd - visStart) / 86400000) + 1;
    months.push({ label: capitalize(mStart.toLocaleDateString("es-MX", { month: "long", year: "numeric" })), days });
    cursor = new Date(mEnd); cursor.setDate(cursor.getDate() + 1);
  }
  const todayPct = ((today - minD) / 86400000) / totalDays * 100;
  const pctOf = (dateStr) => Math.min(100, Math.max(0, ((new Date(dateStr + "T00:00:00") - minD) / 86400000) / totalDays * 100));

  // Una fila por UDN, con el rango (fecha mínima a máxima) de sus sesiones ya programadas.
  const udnPool = filters.udn ? [filters.udn] : catalogs.udn;
  const rows = udnPool.map(udn => {
    const sessUdn = list.filter(s => s.udn === udn && s.date).sort((a, b) => a.date.localeCompare(b.date));
    if (!sessUdn.length) return { udn, sessions: [], start: null, end: null };
    return { udn, sessions: sessUdn, start: sessUdn[0].date, end: sessUdn[sessUdn.length - 1].date };
  });
  rows.sort((a, b) => {
    if (a.start && b.start) return a.start.localeCompare(b.start);
    if (a.start && !b.start) return -1;
    if (!a.start && b.start) return 1;
    return a.udn.localeCompare(b.udn);
  });

  let html = `<div class="tl-legend">
    <span><span class="legend-dot" style="background:#5b5fc7"></span>Virtual (Teams)</span>
    <span><span class="legend-dot" style="background:#0e7490"></span>Presencial</span>
    <span style="color:var(--gray-400)">Clic en el nombre de la UDN para ver su agenda · clic en la barra para editar sus fechas</span>
  </div>`;
  html += `<div class="tl-scroll"><div class="timeline" style="min-width:${Math.max(900, totalDays * 7)}px">`;
  html += `<div class="tl-months"><div class="tl-udn-label">UDN</div>`;
  months.forEach(m => { html += `<div class="tl-month" style="flex:${m.days} 0 0">${m.label}</div>`; });
  html += `</div>`;
  html += `<div class="tl-body">`;
  html += `<div class="tl-today" style="left:${todayPct}%"><span class="tl-today-label">HOY</span></div>`;
  rows.forEach(row => {
    html += `<div class="tl-row">
      <div class="tl-udn-label" data-udn="${escapeHtml(row.udn)}" title="Ver la agenda de ${escapeHtml(row.udn)}">${escapeHtml(row.udn)} ›</div>
      <div class="tl-track">`;
    if (row.start) {
      const modalidades = new Set(row.sessions.map(s => s.modalidad));
      const cls = modalidades.size === 1 ? (row.sessions[0].modalidad === "Presencial" ? "presencial" : "virtual") : "mixed";
      const startPct = pctOf(row.start);
      const endPct = pctOf(row.end);
      const left = Math.min(startPct, endPct);
      const width = Math.max(1.4, endPct - startPct);
      const rangeLabel = row.start === row.end ? fmtDateShort(row.start) : `${fmtDateShort(row.start)} – ${fmtDateShort(row.end)}`;
      const title = `${escapeHtml(row.udn)}: ${rangeLabel} (clic para editar fechas)`;
      html += `<div class="tl-bar ${cls}" style="left:${left}%;width:${width}%" data-udn="${escapeHtml(row.udn)}" title="${title}"></div>`;
      html += `<span class="tl-bar-label" data-udn="${escapeHtml(row.udn)}" style="left:calc(${left + width}% + 8px)" title="${title}">${rangeLabel}</span>`;
    } else {
      html += `<button type="button" class="tl-plus" data-udn="${escapeHtml(row.udn)}">+ Programar</button>`;
    }
    html += `</div></div>`;
  });
  html += `</div></div></div>`;
  content.innerHTML = html;

  content.querySelectorAll(".tl-udn-label[data-udn]").forEach(el => {
    el.onclick = () => { drill = { level: "udn", udn: el.dataset.udn, diaId: null, date: null }; renderAll(); };
  });
  content.querySelectorAll(".tl-bar[data-udn], .tl-bar-label[data-udn]").forEach(bar => {
    bar.onclick = (e) => { e.stopPropagation(); openRangeModal(bar.dataset.udn); };
  });
  content.querySelectorAll(".tl-plus[data-udn]").forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); openWeekModal(btn.dataset.udn); };
  });
}

/* ---------- Detalle de UDN: agenda completa de esa UDN en una sola hoja ---------- */
let udnCompactView = false;

function renderUdnDetail(content) {
  const udn = drill.udn;
  const scoped = sessions.filter(s => s.udn === udn && sessionMatchesFilters(s, { ignoreUdn: true }));
  const hasAgenda = sessions.some(s => s.udn === udn);

  let html = `<div class="breadcrumb">
    <button type="button" class="lb lb-sm lb-ghost" id="bcTimeline">← Cronograma</button><span class="bc-sep">/</span>
    <b>${escapeHtml(udn)}</b>
  </div>`;
  html += `<div class="dayhead">
    <div style="font-size:13px;color:var(--gray-500)">${scoped.length} ${scoped.length === 1 ? "sesión" : "sesiones"} programada${scoped.length === 1 ? "" : "s"}</div>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="seg" id="udnViewSeg">
        <button type="button" class="segbtn${udnCompactView ? "" : " active"}" data-compact="0">Vista completa</button>
        <button type="button" class="segbtn${udnCompactView ? " active" : ""}" data-compact="1">Vista compacta</button>
      </div>
      ${hasAgenda ? `<button type="button" class="lb lb-sm lb-secondary" id="replicateAgendaBtn">Replicar a otras UDN</button>` : ""}
      <button type="button" class="lb lb-sm lb-secondary" id="assignWeekUdnBtn">Asignar semana</button>
      <button type="button" class="lb lb-sm lb-primary" id="addSessionUdnBtn">+ Nueva sesión</button>
    </div>
  </div>`;

  if (!scoped.length) {
    html += `<div class="empty">Aún no hay sesiones para <b>${escapeHtml(udn)}</b>${filters.faseGeneral || filters.modalidad || filters.search ? " que coincidan con los filtros actuales" : ""}. Haz clic en <b>+ Nueva sesión</b> para programar la primera.</div>`;
  } else {
    const byDate = {};
    scoped.forEach(s => { (byDate[s.date] ??= []).push(s); });
    html += Object.keys(byDate).sort().map(date => {
      const daySessions = byDate[date].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
      const cardsHtml = udnCompactView
        ? daySessions.map(s => sessionCompactRowHtml(s)).join("")
        : daySessions.map(s => sessionCardHtml(s)).join("");
      return `<div class="day-group">
        <div class="day-title">${capitalize(fmtDateHeading(date))}<span class="line"></span></div>
        <div class="cards${udnCompactView ? " compact-list" : ""}">${cardsHtml}</div>
      </div>`;
    }).join("");
  }
  content.innerHTML = html;
  document.getElementById("bcTimeline").onclick = () => { resetDrill(); renderAll(); };
  document.getElementById("addSessionUdnBtn").onclick = () => openModal(null, { udn });
  document.getElementById("assignWeekUdnBtn").onclick = () => openWeekModal(udn);
  const replicateBtn = document.getElementById("replicateAgendaBtn");
  if (replicateBtn) replicateBtn.onclick = () => openReplicateModal(udn);
  document.querySelectorAll("#udnViewSeg button[data-compact]").forEach(btn => {
    btn.onclick = () => { udnCompactView = btn.dataset.compact === "1"; renderAll(); };
  });
  // Los botones Editar/Eliminar de cada tarjeta ya se manejan con el listener delegado en #content.
}

/* ---------- Modal: editar el rango de fechas de una UDN ---------- */
const rangeModal = document.getElementById("rangeModal");
function openRangeModal(udn) {
  const sessUdn = sessions.filter(s => s.udn === udn && s.date).sort((a, b) => a.date.localeCompare(b.date));
  if (!sessUdn.length) return;
  document.getElementById("rangeModalTitle").textContent = `Editar fechas — ${udn}`;
  document.getElementById("range_udn").value = udn;
  document.getElementById("range_start").value = sessUdn[0].date;
  document.getElementById("range_end").value = sessUdn[sessUdn.length - 1].date;
  rangeModal.classList.add("show");
}
function closeRangeModal() { rangeModal.classList.remove("show"); }
document.getElementById("rangeCloseTop").onclick = closeRangeModal;
document.getElementById("rangeCancelBtn").onclick = closeRangeModal;
rangeModal.onclick = (e) => { if (e.target === rangeModal) closeRangeModal(); };
document.getElementById("rangeSaveBtn").onclick = async () => {
  const udn = document.getElementById("range_udn").value;
  const newStart = document.getElementById("range_start").value;
  const newEnd = document.getElementById("range_end").value;
  if (!udn || !newStart || !newEnd) return;
  await applyUdnRange(udn, newStart, newEnd);
  closeRangeModal();
};

async function applyUdnRange(udn, newStart, newEnd) {
  const sessUdn = sessions.filter(s => s.udn === udn && s.date).sort((a, b) => a.date.localeCompare(b.date));
  if (!sessUdn.length) return;
  const oldStart = new Date(sessUdn[0].date + "T00:00:00");
  const oldEnd = new Date(sessUdn[sessUdn.length - 1].date + "T00:00:00");
  const oldSpan = oldEnd.getTime() - oldStart.getTime();
  const nStart = new Date(newStart + "T00:00:00");
  const nEnd = new Date(newEnd + "T00:00:00");
  const newSpan = nEnd.getTime() - nStart.getTime();
  for (const s of sessUdn) {
    const orig = new Date(s.date + "T00:00:00");
    const relative = oldSpan > 0 ? (orig.getTime() - oldStart.getTime()) / oldSpan : 0;
    const newDate = new Date(nStart.getTime() + relative * newSpan).toISOString().slice(0, 10);
    await saveSession({ ...s, date: newDate });
  }
}

/* ---------- Modal: asignar semana de implementación (crea las 5 sesiones de un jalón) ---------- */
const weekModal = document.getElementById("weekModal");
let weekModalidad = "Virtual (Teams)";

function setWeekModalidad(value) {
  weekModalidad = value;
  document.querySelectorAll("#weekModSeg button").forEach(b => b.classList.toggle("active", b.dataset.mod === value));
  const presencial = value === "Presencial";
  document.getElementById("weekLugarLabel").innerHTML = presencial
    ? "Sala"
    : `Link de Teams <span style="font-weight:400;color:var(--gray-400)">(opcional)</span>`;
  document.getElementById("week_lugar").placeholder = presencial ? "Ej. Sala de capacitación 1" : "https://teams.microsoft.com/...";
}
document.querySelectorAll("#weekModSeg button").forEach(btn => btn.addEventListener("click", () => setWeekModalidad(btn.dataset.mod)));

// Avanza una fecha al siguiente día hábil (lunes a viernes), sin tocarla si ya lo es.
function nextWeekday(d) {
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}
// Calcula `count` fechas en días hábiles consecutivos a partir de startDateStr (inclusive).
function computeWeekdayDates(startDateStr, count) {
  const dates = [];
  let d = nextWeekday(new Date(startDateStr + "T00:00:00"));
  for (let i = 0; i < count; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d = nextWeekday(new Date(d.getTime() + 24 * 60 * 60 * 1000));
  }
  return dates;
}

function updateWeekPreview() {
  const startVal = document.getElementById("week_start").value;
  const preview = document.getElementById("weekPreview");
  if (!startVal) { preview.textContent = ""; return; }
  const dates = computeWeekdayDates(startVal, DIAS.length);
  const durTxt = DIAS.map(dia => agendaTemplate[dia.id]?.duracion ? fmtDuration(agendaTemplate[dia.id].duracion) : "sin plantilla").join(", ");
  preview.textContent = `Se programarán del ${fmtDateShort(dates[0])} al ${fmtDateShort(dates[dates.length - 1])} (Día 1 a Día ${DIAS.length}, en días hábiles consecutivos). Duración por día según tu plantilla: ${durTxt}.`;
}
document.getElementById("week_start").addEventListener("input", updateWeekPreview);

function updateWeekSkipNote(udn) {
  const note = document.getElementById("weekSkipNote");
  const existentes = DIAS.filter(dia => sessions.some(s => s.udn === udn && s.diaId === dia.id));
  note.textContent = existentes.length
    ? `Ya existe sesión para: ${existentes.map(d => "Día " + d.dia).join(", ")} — esas no se van a duplicar, solo se crean los días que falten.`
    : "";
}

function openWeekModal(udn) {
  document.getElementById("weekModalTitle").textContent = `Asignar semana de implementación — ${udn}`;
  document.getElementById("week_udn").value = udn;
  document.getElementById("week_start").value = "";
  document.getElementById("week_fase").value = "";
  document.getElementById("week_start_time").value = "09:00";
  document.getElementById("week_duration").value = 90;
  document.getElementById("week_lugar").value = "";
  setWeekModalidad("Virtual (Teams)");
  updateWeekPreview();
  updateWeekSkipNote(udn);
  weekModal.classList.add("show");
}
function closeWeekModal() { weekModal.classList.remove("show"); }
document.getElementById("weekCloseTop").onclick = closeWeekModal;
document.getElementById("weekCancelBtn").onclick = closeWeekModal;
weekModal.onclick = (e) => { if (e.target === weekModal) closeWeekModal(); };

async function createWeekForUdn(udn, opts) {
  const { startDate, fase, modalidad, lugar, startTime, duration } = opts;
  const dates = computeWeekdayDates(startDate, DIAS.length);
  const existingDiaIds = new Set(sessions.filter(s => s.udn === udn).map(s => s.diaId));
  for (let i = 0; i < DIAS.length; i++) {
    const dia = DIAS[i];
    if (existingDiaIds.has(dia.id)) continue; // no duplicar días ya programados
    const tpl = agendaTemplate[dia.id];
    await saveSession({
      udn,
      fase,
      diaId: dia.id,
      date: dates[i],
      start: startTime,
      duration: tpl?.duracion ? Number(tpl.duracion) : Number(duration),
      modalidad,
      lugar: lugar || "",
      objetivo: dia.objetivo,
      notas: "",
      modulos: tpl?.modulos ? [...tpl.modulos] : [],
      roles: tpl?.roles ? [...tpl.roles] : [],
      implementadores: [],
      hallazgos: [],
    });
  }
}

document.getElementById("weekSaveBtn").onclick = async () => {
  const udn = document.getElementById("week_udn").value;
  const startDate = document.getElementById("week_start").value;
  const fase = document.getElementById("week_fase").value;
  const startTime = document.getElementById("week_start_time").value;
  const duration = document.getElementById("week_duration").value;
  const lugar = document.getElementById("week_lugar").value.trim();
  if (!udn || !startDate || !fase) {
    alert("Completa la fecha de inicio y la fase general antes de crear la semana.");
    return;
  }
  await createWeekForUdn(udn, { startDate, fase, modalidad: weekModalidad, lugar, startTime, duration });
  closeWeekModal();
  drill = { level: "udn", udn, diaId: null, date: null };
  renderAll();
};

/* ---------- Modal: replicar la agenda de una UDN a otras (misma estructura, cada una con su propia fecha) ---------- */
const replicateModal = document.getElementById("replicateModal");
let replicateSelections = {}; // { "UDN destino": "YYYY-MM-DD" | "" }

function getUdnAgenda(udn) {
  return sessions.filter(s => s.udn === udn).slice().sort((a, b) => {
    const da = diaById(a.diaId)?.dia ?? 999, db = diaById(b.diaId)?.dia ?? 999;
    if (da !== db) return da - db;
    return (a.date || "").localeCompare(b.date || "");
  });
}

function getReplicateTargets(sourceUdn, filterText) {
  const q = (filterText || "").trim().toLowerCase();
  return catalogs.udn.filter(u => u !== sourceUdn && (!q || u.toLowerCase().includes(q)));
}

function renderReplicateList(sourceUdn, filterText) {
  const list = document.getElementById("replicateList");
  const targets = getReplicateTargets(sourceUdn, filterText);
  if (!targets.length) {
    list.innerHTML = `<div class="catempty">No hay otras UDN que coincidan.</div>`;
    return;
  }
  list.innerHTML = targets.map(u => {
    const checked = Object.prototype.hasOwnProperty.call(replicateSelections, u);
    const dateVal = replicateSelections[u] || "";
    return `<div class="replrow${checked ? " checked" : ""}" data-udn="${escapeHtml(u)}">
      <label>
        <input type="checkbox" class="repl-check" ${checked ? "checked" : ""}>
        <span title="${escapeHtml(u)}">${escapeHtml(u)}</span>
      </label>
      <input type="date" class="repl-date" value="${dateVal}" ${checked ? "" : "disabled"}>
    </div>`;
  }).join("");
  list.querySelectorAll(".replrow").forEach(row => {
    const u = row.dataset.udn;
    const chk = row.querySelector(".repl-check");
    const dateInput = row.querySelector(".repl-date");
    chk.onchange = () => {
      row.classList.toggle("checked", chk.checked);
      dateInput.disabled = !chk.checked;
      if (chk.checked) { replicateSelections[u] = dateInput.value || ""; dateInput.focus(); }
      else { delete replicateSelections[u]; }
    };
    dateInput.onchange = () => { if (chk.checked) replicateSelections[u] = dateInput.value; };
  });
}
document.getElementById("replicateSearch").addEventListener("input", (e) => {
  renderReplicateList(document.getElementById("replicate_source_udn").value, e.target.value);
});
document.getElementById("replicateSelectAllBtn").onclick = () => {
  const sourceUdn = document.getElementById("replicate_source_udn").value;
  getReplicateTargets(sourceUdn, document.getElementById("replicateSearch").value).forEach(u => {
    if (!(u in replicateSelections)) replicateSelections[u] = "";
  });
  renderReplicateList(sourceUdn, document.getElementById("replicateSearch").value);
};
document.getElementById("replicateClearAllBtn").onclick = () => {
  replicateSelections = {};
  renderReplicateList(document.getElementById("replicate_source_udn").value, document.getElementById("replicateSearch").value);
};

function openReplicateModal(sourceUdn) {
  const agenda = getUdnAgenda(sourceUdn);
  if (!agenda.length) return;
  replicateSelections = {};
  document.getElementById("replicate_source_udn").value = sourceUdn;
  document.getElementById("replicateModalTitle").textContent = `Replicar agenda de ${sourceUdn}`;
  const diasTxt = agenda.map(s => "Día " + (diaById(s.diaId)?.dia ?? "?")).join(", ");
  document.getElementById("replicateExplain").textContent =
    `Se copian las mismas ${agenda.length} ${agenda.length === 1 ? "sesión" : "sesiones"} (${diasTxt}) — fase, modalidad, objetivo, módulos, roles e implementadores — a cada UDN que marques abajo. Cada una usa su propia fecha de inicio (Día 1); los demás días se acomodan en los siguientes días hábiles, igual que "Asignar semana". No se copian fechas ni hallazgos.`;
  document.getElementById("replicateSearch").value = "";
  document.getElementById("replicateResultNote").textContent = "";
  const saveBtn = document.getElementById("replicateSaveBtn");
  saveBtn.disabled = false;
  saveBtn.textContent = "Replicar a seleccionadas";
  document.getElementById("replicateCancelBtn").textContent = "Cancelar";
  renderReplicateList(sourceUdn, "");
  replicateModal.classList.add("show");
}
function closeReplicateModal() { replicateModal.classList.remove("show"); }
document.getElementById("replicateCloseTop").onclick = closeReplicateModal;
document.getElementById("replicateCancelBtn").onclick = closeReplicateModal;
replicateModal.onclick = (e) => { if (e.target === replicateModal) closeReplicateModal(); };

async function replicateAgendaToUdn(sourceAgenda, targetUdn, startDate) {
  const dates = computeWeekdayDates(startDate, sourceAgenda.length);
  const existingDiaIds = new Set(sessions.filter(s => s.udn === targetUdn).map(s => s.diaId));
  let created = 0;
  const skipped = [];
  for (let i = 0; i < sourceAgenda.length; i++) {
    const src = sourceAgenda[i];
    if (existingDiaIds.has(src.diaId)) { skipped.push(diaById(src.diaId)?.dia ?? "?"); continue; } // no duplicar días ya programados en el destino
    await saveSession({
      udn: targetUdn,
      fase: src.fase,
      diaId: src.diaId,
      date: dates[i],
      start: src.start,
      duration: src.duration,
      modalidad: src.modalidad,
      lugar: src.lugar || "",
      objetivo: src.objetivo,
      notas: "",
      modulos: [...(src.modulos || [])],
      roles: [...(src.roles || [])],
      implementadores: [...(src.implementadores || [])],
      hallazgos: [], // los hallazgos son de cada sesión real; no tiene sentido copiarlos
    });
    created++;
  }
  return { created, skipped };
}

document.getElementById("replicateSaveBtn").onclick = async () => {
  const sourceUdn = document.getElementById("replicate_source_udn").value;
  const agenda = getUdnAgenda(sourceUdn);
  const withDate = Object.entries(replicateSelections).filter(([, date]) => date);
  const withoutDate = Object.entries(replicateSelections).filter(([, date]) => !date);
  if (!withDate.length) {
    alert(withoutDate.length
      ? "Ponle una fecha de inicio a cada UDN que marcaste."
      : "Marca al menos una UDN para replicar la agenda.");
    return;
  }
  const saveBtn = document.getElementById("replicateSaveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Replicando...";
  const results = [];
  for (const [targetUdn, startDate] of withDate) {
    const { created, skipped } = await replicateAgendaToUdn(agenda, targetUdn, startDate);
    const skipTxt = skipped.length ? ` (Día ${skipped.join(", ")} ya existía${skipped.length === 1 ? "" : "n"}, no se duplicó)` : "";
    results.push(`${targetUdn}: ${created} ${created === 1 ? "sesión creada" : "sesiones creadas"}${skipTxt}`);
  }
  document.getElementById("replicateResultNote").innerHTML = results.map(r => escapeHtml(r)).join("<br>");
  saveBtn.textContent = "Listo";
  document.getElementById("replicateCancelBtn").textContent = "Cerrar";
  replicateSelections = {};
  renderAll();
};

function sessionCardHtml(s) {
  const dia = diaById(s.diaId) || { nombre: "Sin día", dia: "", color: "#737373", bg: "#f5f5f5", border: "#e5e5e5" };
  const conflicts = findConflicts(s);
  const endLabel = minutesToLabel(timeToMinutes(s.start) + Number(s.duration));
  const modClass = s.modalidad === "Presencial" ? "presencial" : "virtual";
  const barColor = s.modalidad === "Presencial" ? "#0e7490" : "#5b5fc7";
  return `
    <div class="scard" data-id="${s.id}" style="border-left-color:${barColor}">
      ${conflicts.length ? `<div class="tchip" style="background:#fef2f2;border-color:#fca5a5;color:#dc2626;align-self:flex-start">Choque de sala con otra sesión</div>` : ""}
      <div class="time">${s.start}–${endLabel} · ${fmtDuration(s.duration)}</div>
      <h3>${escapeHtml(dia.nombre)}</h3>
      <div class="badges">
        <span class="tchip t-udn">${escapeHtml(s.udn)}</span>
        ${s.fase ? `<span class="tchip" style="background:var(--gray-100);border-color:var(--gray-200);color:var(--gray-700)">${escapeHtml(s.fase)}</span>` : ""}
        <span class="tchip" style="background:${dia.bg};border-color:${dia.border};color:${dia.color}">Día ${dia.dia || ""}</span>
        <span class="tchip t-modal ${modClass}">${escapeHtml(s.modalidad)}</span>
      </div>
      ${s.lugar ? `<div class="field-label-mini">${s.modalidad === "Presencial" ? "Sala" : "Link"}</div><div style="font-size:12.5px;color:var(--gray-700);word-break:break-all">${escapeHtml(s.lugar)}</div>` : ""}
      ${s.objetivo ? `<div style="font-size:12.5px;color:var(--gray-600)">${escapeHtml(s.objetivo)}</div>` : ""}
      ${(s.modulos || []).length ? `<div><div class="field-label-mini">Módulos</div><div class="taglist">${s.modulos.map(m => `<span>${escapeHtml(m)}</span>`).join("")}</div></div>` : ""}
      ${(s.roles || []).length ? `<div><div class="field-label-mini">Roles</div><div class="taglist roles">${s.roles.map(r => `<span>${escapeHtml(r)}</span>`).join("")}</div></div>` : ""}
      ${(s.implementadores || []).length ? `<div><div class="field-label-mini">Implementador(es)</div><div class="taglist impl">${s.implementadores.map(i => `<span>${escapeHtml(i)}</span>`).join("")}</div></div>` : ""}
      ${(s.hallazgos || []).length ? `<div class="tchip" style="background:#fff7ed;border-color:#fed7aa;color:#9a3412;align-self:flex-start">${s.hallazgos.length} hallazgo${s.hallazgos.length > 1 ? "s" : ""}</div>` : ""}
      <div class="card-actions">
        <button class="lb lb-sm lb-secondary edit-btn">Editar</button>
        <button class="lb lb-sm lb-quitar delete-btn">Eliminar</button>
      </div>
    </div>`;
}

function sessionCompactRowHtml(s) {
  const dia = diaById(s.diaId) || { nombre: "Sin día", dia: "", color: "#737373", bg: "#f5f5f5", border: "#e5e5e5" };
  const conflicts = findConflicts(s);
  const endLabel = minutesToLabel(timeToMinutes(s.start) + Number(s.duration));
  const modClass = s.modalidad === "Presencial" ? "presencial" : "virtual";
  const barColor = s.modalidad === "Presencial" ? "#0e7490" : "#5b5fc7";
  return `
    <div class="scard compact-row" data-id="${s.id}" style="border-left-color:${barColor}">
      <span class="compact-time">${s.start}–${endLabel}</span>
      <span class="compact-badge" style="background:${dia.bg};border-color:${dia.border};color:${dia.color}">Día ${dia.dia || ""}</span>
      <span class="compact-name" title="${escapeHtml(dia.nombre)}">${escapeHtml(dia.nombre)}</span>
      ${s.modulos && s.modulos.length ? `<span class="compact-modulos" title="${escapeHtml(s.modulos.join(", "))}">${escapeHtml(s.modulos.join(", "))}</span>` : ""}
      ${s.fase ? `<span class="tchip" style="background:var(--gray-100);border-color:var(--gray-200);color:var(--gray-700)">${escapeHtml(s.fase)}</span>` : ""}
      <span class="tchip t-modal ${modClass}">${escapeHtml(s.modalidad)}</span>
      ${conflicts.length ? `<span class="tchip" style="background:#fef2f2;border-color:#fca5a5;color:#dc2626" title="Choque de sala con otra sesión">Choque</span>` : ""}
      <span class="compact-spacer"></span>
      <button class="lb lb-sm lb-ghost edit-btn" title="Editar" aria-label="Editar">Editar</button>
      <button class="lb lb-sm lb-ghost delete-btn" title="Eliminar" aria-label="Eliminar" style="color:var(--red-600)">Eliminar</button>
    </div>`;
}

function renderCatalogLists() {
  ["udn", "roles", "modulos", "implementadores"].forEach(kind => {
    const list = document.getElementById("list-" + kind);
    document.getElementById("cnt-" + kind).textContent = catalogs[kind].length;
    list.innerHTML = catalogs[kind].length
      ? catalogs[kind].map(v => `<div class="catitem"><span>${escapeHtml(v)}</span><button type="button" data-kind="${kind}" data-val="${escapeHtml(v)}" aria-label="Quitar">✕</button></div>`).join("")
      : `<div class="catempty">Sin elementos todavía.</div>`;
  });
  document.querySelectorAll("#catalogModal .catitem button").forEach(btn => {
    btn.onclick = () => removeCatalogItem(btn.dataset.kind, btn.dataset.val);
  });
}

/* ============================================================
   MODAL: SESIÓN
   ============================================================ */
const backdrop = document.getElementById("modalBackdrop");
const form = document.getElementById("sessionForm");
let formTags = { modulos: [], roles: [], implementadores: [] };
let formHallazgos = [];
let currentModalidad = "Virtual (Teams)";

function setModalidad(value) {
  currentModalidad = value;
  document.querySelectorAll("#modSeg button").forEach(b => b.classList.toggle("active", b.dataset.mod === value));
  const presencial = value === "Presencial";
  document.getElementById("lugarLabel").textContent = presencial ? "Sala" : "Link de Teams";
  document.getElementById("f_lugar").placeholder = presencial ? "Ej. Sala de capacitación 1" : "https://teams.microsoft.com/...";
  checkConflictPreview();
}
document.querySelectorAll("#modSeg button").forEach(btn => btn.addEventListener("click", () => setModalidad(btn.dataset.mod)));

function renderTagChips(kind) {
  const containers = { modulos: "modulosTags", roles: "rolesTags", implementadores: "implementadoresTags" };
  const el = document.getElementById(containers[kind]);
  el.innerHTML = formTags[kind].map(v => `<span class="tagchip">${escapeHtml(v)}<button type="button" data-kind="${kind}" data-val="${escapeHtml(v)}">✕</button></span>`).join("");
  el.querySelectorAll("button").forEach(b => b.onclick = () => {
    formTags[b.dataset.kind] = formTags[b.dataset.kind].filter(v => v !== b.dataset.val);
    renderTagChips(b.dataset.kind);
  });
}
function addTag(kind, inputId) {
  const input = document.getElementById(inputId);
  const value = input.value.trim();
  if (!value) return;
  if (!formTags[kind].some(v => v.toLowerCase() === value.toLowerCase())) formTags[kind].push(value);
  input.value = "";
  renderTagChips(kind);
}
document.getElementById("addModuloBtn").onclick = () => addTag("modulos", "modulosInput");
document.getElementById("addRolBtn").onclick = () => addTag("roles", "rolesInput");
document.getElementById("addImplementadorBtn").onclick = () => addTag("implementadores", "implementadoresInput");
[["modulosInput", "modulos"], ["rolesInput", "roles"], ["implementadoresInput", "implementadores"]].forEach(([inputId, kind]) => {
  document.getElementById(inputId).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addTag(kind, inputId); } });
});

function renderHallazgos() {
  const el = document.getElementById("hallazgosList");
  el.innerHTML = formHallazgos.length
    ? formHallazgos.map((h, i) => `
      <div class="hallazgo-item">
        <span class="hallazgo-fecha">${h.fecha ? fmtDateShort(h.fecha) : "Sin fecha"}</span>
        <span class="hallazgo-texto">${escapeHtml(h.texto)}</span>
        <button type="button" data-idx="${i}" aria-label="Quitar">✕</button>
      </div>`).join("")
    : `<div class="catempty">Sin hallazgos registrados todavía.</div>`;
  el.querySelectorAll("button[data-idx]").forEach(btn => {
    btn.onclick = () => { formHallazgos.splice(Number(btn.dataset.idx), 1); renderHallazgos(); };
  });
}
document.getElementById("addHallazgoBtn").onclick = () => {
  const fecha = document.getElementById("hallazgoFecha").value;
  const texto = document.getElementById("hallazgoTexto").value.trim();
  if (!texto) return;
  formHallazgos.push({ fecha: fecha || new Date().toISOString().slice(0, 10), texto });
  document.getElementById("hallazgoTexto").value = "";
  document.getElementById("hallazgoFecha").value = "";
  renderHallazgos();
};
document.getElementById("hallazgoTexto").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); document.getElementById("addHallazgoBtn").click(); } });

function openModal(session = null, prefill = {}) {
  form.reset();
  formTags = { modulos: [], roles: [], implementadores: [] };
  formHallazgos = [];
  document.getElementById("conflictWarning").textContent = "";
  document.getElementById("sessionId").value = session?.id || "";
  document.getElementById("modalTitle").textContent = session ? "Editar sesión" : "Nueva sesión";
  document.getElementById("deleteBtn").style.display = session ? "inline-flex" : "none";

  const udnSelect = document.getElementById("f_udn");
  const udnHint = document.getElementById("f_udn_hint");
  udnSelect.disabled = false;
  udnHint.style.display = "none";

  if (session) {
    document.getElementById("f_udn").value = session.udn || "";
    document.getElementById("f_faseGeneral").value = session.fase || "";
    document.getElementById("f_dia").value = session.diaId || "";
    document.getElementById("f_date").value = session.date || "";
    document.getElementById("f_start").value = session.start || "";
    document.getElementById("f_duration").value = session.duration || 60;
    document.getElementById("f_lugar").value = session.lugar || "";
    document.getElementById("f_objetivo").value = session.objetivo || "";
    document.getElementById("f_notas").value = session.notas || "";
    formTags.modulos = [...(session.modulos || [])];
    formTags.roles = [...(session.roles || [])];
    formTags.implementadores = [...(session.implementadores || [])];
    formHallazgos = (session.hallazgos || []).map(h => ({ ...h }));
    setModalidad(session.modalidad || "Virtual (Teams)");
    // Si esta sesión se guardó sin módulos/roles (ej. de una versión anterior
    // o capturada a mano), se sugieren los de la plantilla de ese día — sin
    // pisar lo que la sesión ya traiga.
    const existingTpl = agendaTemplate[session.diaId];
    if (existingTpl) {
      if (!formTags.modulos.length) formTags.modulos = [...existingTpl.modulos];
      if (!formTags.roles.length) formTags.roles = [...existingTpl.roles];
    }
  } else {
    document.getElementById("f_date").value = prefill.date || new Date().toISOString().slice(0, 10);
    document.getElementById("f_udn").value = prefill.udn || "";
    if (prefill.udn) {
      udnSelect.disabled = true;
      udnHint.style.display = "";
    }
    if (prefill.start) document.getElementById("f_start").value = prefill.start;
    if (prefill.diaId) {
      document.getElementById("f_dia").value = prefill.diaId;
      document.getElementById("f_objetivo").value = diaById(prefill.diaId)?.objetivo || "";
      const tpl = agendaTemplate[prefill.diaId];
      if (tpl) {
        formTags.modulos = [...tpl.modulos];
        formTags.roles = [...tpl.roles];
        if (tpl.duracion) document.getElementById("f_duration").value = tpl.duracion;
      }
    }
    setModalidad("Virtual (Teams)");
  }
  renderTagChips("modulos"); renderTagChips("roles"); renderTagChips("implementadores");
  renderHallazgos();
  checkConflictPreview();
  backdrop.classList.add("show");
}
function closeModal() { backdrop.classList.remove("show"); }

document.getElementById("newSessionBtn").onclick = () => openModal();
document.getElementById("cancelBtn").onclick = closeModal;
document.getElementById("cancelBtnTop").onclick = closeModal;
backdrop.onclick = (e) => { if (e.target === backdrop) closeModal(); };

document.getElementById("f_dia").addEventListener("change", (e) => {
  const dia = diaById(e.target.value);
  if (dia) document.getElementById("f_objetivo").value = dia.objetivo;
  // Igual que el objetivo, se sugieren módulos y roles según la plantilla de
  // ese día — pero sin pisar lo que ya hayas agregado a mano en el formulario.
  const tpl = agendaTemplate[e.target.value];
  if (tpl) {
    if (!formTags.modulos.length) { formTags.modulos = [...tpl.modulos]; renderTagChips("modulos"); }
    if (!formTags.roles.length) { formTags.roles = [...tpl.roles]; renderTagChips("roles"); }
    const isNewSession = !document.getElementById("sessionId").value;
    if (isNewSession && tpl.duracion) document.getElementById("f_duration").value = tpl.duracion;
  }
});

document.getElementById("deleteBtn").onclick = async () => {
  const id = document.getElementById("sessionId").value;
  if (!id) return;
  if (confirm("¿Eliminar esta sesión? Esta acción no se puede deshacer.")) {
    await deleteSession(id);
    closeModal();
  }
};

["f_date", "f_start", "f_duration", "f_lugar"].forEach(id => {
  document.getElementById(id).addEventListener("input", checkConflictPreview);
});
function checkConflictPreview() {
  const draft = {
    id: document.getElementById("sessionId").value,
    date: document.getElementById("f_date").value,
    start: document.getElementById("f_start").value,
    duration: Number(document.getElementById("f_duration").value || 0),
    modalidad: currentModalidad,
    lugar: document.getElementById("f_lugar").value,
  };
  const warn = document.getElementById("conflictWarning");
  if (currentModalidad !== "Presencial" || !draft.date || !draft.start || !draft.lugar) { warn.textContent = ""; return; }
  const conflicts = findConflicts(draft);
  warn.textContent = conflicts.length ? `Esa sala ya está ocupada en ese horario (otra sesión el mismo día).` : "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    udn: document.getElementById("f_udn").value,
    fase: document.getElementById("f_faseGeneral").value,
    diaId: document.getElementById("f_dia").value,
    date: document.getElementById("f_date").value,
    start: document.getElementById("f_start").value,
    duration: Number(document.getElementById("f_duration").value),
    modalidad: currentModalidad,
    lugar: document.getElementById("f_lugar").value.trim(),
    objetivo: document.getElementById("f_objetivo").value.trim(),
    notas: document.getElementById("f_notas").value.trim(),
    modulos: [...formTags.modulos],
    roles: [...formTags.roles],
    implementadores: [...formTags.implementadores],
    hallazgos: [...formHallazgos],
  };
  if (!data.udn || !data.diaId) return;
  const id = document.getElementById("sessionId").value;
  if (id) data.id = id;
  await saveSession(data);
  closeModal();
});

document.getElementById("content").addEventListener("click", (e) => {
  const card = e.target.closest(".scard");
  if (!card) return;
  const id = card.dataset.id;
  const session = sessions.find(s => s.id === id);
  if (e.target.classList.contains("edit-btn")) openModal(session);
  if (e.target.classList.contains("delete-btn")) {
    if (confirm(`¿Eliminar esta sesión?`)) deleteSession(id);
  }
});

/* ============================================================
   MODAL: CATÁLOGOS
   ============================================================ */
const catModal = document.getElementById("catalogModal");
document.getElementById("catalogosBtn").onclick = () => { renderCatalogLists(); catModal.classList.add("show"); };
document.getElementById("catCloseTop").onclick = () => catModal.classList.remove("show");
document.getElementById("catCloseBtn").onclick = () => catModal.classList.remove("show");
catModal.onclick = (e) => { if (e.target === catModal) catModal.classList.remove("show"); };
document.querySelectorAll("#catalogModal [data-cat]").forEach(btn => {
  btn.onclick = () => {
    const kind = btn.dataset.cat;
    const input = document.getElementById("input-" + kind);
    addCatalogItem(kind, input.value);
    input.value = "";
  };
});
["udn", "roles", "modulos", "implementadores"].forEach(kind => {
  document.getElementById("input-" + kind).addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); addCatalogItem(kind, e.target.value); e.target.value = ""; }
  });
});

/* ============================================================
   FILTROS UI
   ============================================================ */
document.getElementById("filterUDN").addEventListener("change", (e) => { filters.udn = e.target.value; resetDrill(); renderAll(); });
document.getElementById("filterFaseGeneral").addEventListener("change", (e) => { filters.faseGeneral = e.target.value; renderAll(); });
document.getElementById("filterModalidad").addEventListener("change", (e) => { filters.modalidad = e.target.value; renderAll(); });
document.getElementById("filterSearch").addEventListener("input", (e) => { filters.search = e.target.value; renderAll(); });

/* ============================================================
   EXPORTAR (.ics / .csv)
   ============================================================ */
document.getElementById("exportIcsBtn").onclick = () => {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Agenda de implementación MIND//ES"];
  sessions.forEach(s => {
    const dia = diaById(s.diaId) || { nombre: "Sesión" };
    const startDt = s.date.replace(/-/g, "") + "T" + s.start.replace(":", "") + "00";
    const endMin = timeToMinutes(s.start) + Number(s.duration);
    const endDt = s.date.replace(/-/g, "") + "T" + minutesToLabel(endMin).replace(":", "") + "00";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@agenda-mind`,
      `SUMMARY:${dia.nombre} — ${s.udn}`,
      `DTSTART:${startDt}`,
      `DTEND:${endDt}`,
      `LOCATION:${(s.lugar || "")}`,
      `DESCRIPTION:${[
        s.fase ? "Fase: " + s.fase : "",
        "Modalidad: " + s.modalidad,
        s.objetivo ? "Objetivo: " + s.objetivo : "",
        (s.roles || []).length ? "Roles: " + s.roles.join(", ") : "",
        (s.modulos || []).length ? "Módulos: " + s.modulos.join(", ") : "",
        (s.implementadores || []).length ? "Implementadores: " + s.implementadores.join(", ") : "",
      ].filter(Boolean).join("\\n")}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  downloadFile("agenda-mind.ics", lines.join("\r\n"), "text/calendar");
};

document.getElementById("exportCsvBtn").onclick = () => {
  const header = ["UDN", "Fase", "Día", "Fecha", "Inicio", "Duración (min)", "Modalidad", "Sala/Link", "Objetivo", "Módulos", "Roles", "Implementadores", "Hallazgos"];
  const rows = sessions.map(s => {
    const dia = diaById(s.diaId) || { nombre: "" };
    return [s.udn, s.fase || "", dia.nombre, s.date, s.start, s.duration, s.modalidad, s.lugar, s.objetivo,
      (s.modulos || []).join("; "), (s.roles || []).join("; "),
      (s.implementadores || []).join("; "), (s.hallazgos || []).map(h => `${h.fecha}: ${h.texto}`).join("; ")];
  });
  const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\r\n");
  downloadFile("agenda-mind.csv", csv, "text/csv");
};
function csvEscape(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   MODAL: EXPORTAR HALLAZGOS (todas las UDN o las que se elijan)
   ============================================================ */
const hallazgosExportModal = document.getElementById("hallazgosExportModal");
let hallazgosExportSelected = new Set();

function getUdnsConHallazgos() {
  const set = new Set();
  sessions.forEach(s => { if ((s.hallazgos || []).length) set.add(s.udn); });
  return catalogs.udn.filter(u => set.has(u));
}

function renderHallazgosExportList(filterText) {
  const list = document.getElementById("hallazgosExportList");
  const q = (filterText || "").trim().toLowerCase();
  const udns = getUdnsConHallazgos().filter(u => !q || u.toLowerCase().includes(q));
  if (!udns.length) {
    list.innerHTML = `<div class="catempty">Ninguna UDN tiene hallazgos registrados todavía.</div>`;
    return;
  }
  list.innerHTML = udns.map(u => {
    const checked = hallazgosExportSelected.has(u);
    const n = sessions.filter(s => s.udn === u).reduce((acc, s) => acc + (s.hallazgos || []).length, 0);
    return `<div class="replrow${checked ? " checked" : ""}" data-udn="${escapeHtml(u)}">
      <label>
        <input type="checkbox" class="hexp-check" ${checked ? "checked" : ""}>
        <span title="${escapeHtml(u)}">${escapeHtml(u)}</span>
      </label>
      <span class="replnote">${n} hallazgo${n === 1 ? "" : "s"}</span>
    </div>`;
  }).join("");
  list.querySelectorAll(".replrow").forEach(row => {
    const u = row.dataset.udn;
    const chk = row.querySelector(".hexp-check");
    chk.onchange = () => {
      row.classList.toggle("checked", chk.checked);
      if (chk.checked) hallazgosExportSelected.add(u); else hallazgosExportSelected.delete(u);
    };
  });
}
document.getElementById("hallazgosExportSearch").addEventListener("input", (e) => renderHallazgosExportList(e.target.value));
document.getElementById("hallazgosExportSelectAllBtn").onclick = () => {
  getUdnsConHallazgos().forEach(u => hallazgosExportSelected.add(u));
  renderHallazgosExportList(document.getElementById("hallazgosExportSearch").value);
};
document.getElementById("hallazgosExportClearAllBtn").onclick = () => {
  hallazgosExportSelected = new Set();
  renderHallazgosExportList(document.getElementById("hallazgosExportSearch").value);
};
document.getElementById("exportHallazgosBtn").onclick = () => {
  hallazgosExportSelected = new Set(getUdnsConHallazgos()); // por default, todas marcadas
  document.getElementById("hallazgosExportSearch").value = "";
  document.getElementById("hallazgosExportNote").textContent = "";
  renderHallazgosExportList("");
  hallazgosExportModal.classList.add("show");
};
function closeHallazgosExportModal() { hallazgosExportModal.classList.remove("show"); }
document.getElementById("hallazgosExportCloseTop").onclick = closeHallazgosExportModal;
document.getElementById("hallazgosExportCancelBtn").onclick = closeHallazgosExportModal;
hallazgosExportModal.onclick = (e) => { if (e.target === hallazgosExportModal) closeHallazgosExportModal(); };
document.getElementById("hallazgosExportSaveBtn").onclick = () => {
  if (!hallazgosExportSelected.size) {
    document.getElementById("hallazgosExportNote").textContent = "Marca al menos una UDN.";
    return;
  }
  const header = ["UDN", "Día", "Fecha de sesión", "Fecha de hallazgo", "Hallazgo"];
  const rows = [];
  sessions
    .filter(s => hallazgosExportSelected.has(s.udn))
    .forEach(s => {
      const dia = diaById(s.diaId) || { nombre: "" };
      (s.hallazgos || []).forEach(h => rows.push([s.udn, dia.nombre, s.date, h.fecha || "", h.texto]));
    });
  if (!rows.length) {
    document.getElementById("hallazgosExportNote").textContent = "Las UDN marcadas no tienen hallazgos registrados.";
    return;
  }
  const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\r\n");
  downloadFile("hallazgos-mind.csv", csv, "text/csv");
  closeHallazgosExportModal();
};

/* ============================================================
   MODAL: IMPORTAR AGENDA (plantilla por día desde Excel/CSV)
   ============================================================ */
const templateModal = document.getElementById("templateModal");
let pendingTemplate = null;

function parseDiaNumber(text) {
  const m = String(text || "").match(/(\d)/);
  return m ? Number(m[1]) : null;
}
function parseDurationToMinutes(text) {
  if (text === "" || text === null || text === undefined) return 0;
  const s = String(text).toLowerCase();
  const hMatch = s.match(/(\d+(?:[.,]\d+)?)\s*h/);
  const mMatch = s.match(/(\d+)\s*m(?:in)?/);
  let mins = 0;
  if (hMatch) mins += Math.round(parseFloat(hMatch[1].replace(",", ".")) * 60);
  if (mMatch) mins += parseInt(mMatch[1], 10);
  if (!hMatch && !mMatch) {
    const num = parseFloat(s.replace(",", "."));
    if (!isNaN(num)) mins = Math.round(num);
  }
  return mins;
}
function splitRoles(cell) {
  // Los roles en la hoja de origen vienen separados por ";" o por ",".
  return String(cell || "").split(/[;,\n]/).map(v => v.trim()).filter(Boolean);
}
function splitModulos(cell) {
  // Los módulos NO se separan por coma: algunos nombres de módulo tienen una
  // coma dentro (ej. "Clientes, Unidades y Operadores"), así que solo se
  // separan por ";" o salto de línea (como cuando una celda combina dos
  // módulos en dos líneas, ej. "Rutas" + "Programación maestra").
  return String(cell || "").split(/[;\n]/).map(v => v.trim()).filter(Boolean);
}
function addUnique(arr, values) {
  values.forEach(v => { if (!arr.some(x => x.toLowerCase() === v.toLowerCase())) arr.push(v); });
}

async function parseTemplateWorkbook(file) {
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rows.length) throw new Error("El archivo no tiene filas de datos.");

  const headerKeys = Object.keys(rows[0]);
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const findKey = (...patterns) => headerKeys.find(k => patterns.some(p => norm(k).includes(p)));
  const kDia = findKey("dia");
  const kRoles = findKey("rol");
  const kModulos = findKey("modulo");
  const kDuracion = findKey("duracion total") || findKey("duracion");
  if (!kDia || !kRoles || !kModulos) {
    throw new Error('No se encontraron columnas de "Día", "Rol(es)" y "Módulos" en el archivo. Revisa los encabezados de tu hoja.');
  }

  const result = {};
  let lastDiaNum = null;
  rows.forEach(row => {
    const diaRaw = String(row[kDia] || "").trim();
    const diaNum = diaRaw ? parseDiaNumber(diaRaw) : null;
    if (diaNum) lastDiaNum = diaNum;
    const effectiveDia = diaNum || lastDiaNum;
    if (!effectiveDia || effectiveDia < 1 || effectiveDia > DIAS.length) return;
    const diaId = "dia" + effectiveDia;
    result[diaId] ??= { roles: [], modulos: [], duracion: 0 };
    addUnique(result[diaId].roles, splitRoles(row[kRoles]));
    addUnique(result[diaId].modulos, splitModulos(row[kModulos]));
    if (kDuracion) result[diaId].duracion += parseDurationToMinutes(row[kDuracion]);
  });
  return result;
}

function renderTemplatePreview(tpl) {
  const el = document.getElementById("templatePreview");
  el.innerHTML = DIAS.map(dia => {
    const t = tpl[dia.id];
    if (!t) {
      return `<div class="tplday"><h4>Día ${dia.dia} · ${escapeHtml(dia.nombre)}</h4><div class="catempty">No se encontró información para este día en el archivo — se deja la plantilla actual sin cambios.</div></div>`;
    }
    return `<div class="tplday">
      <h4>Día ${dia.dia} · ${escapeHtml(dia.nombre)} — ${t.duracion ? fmtDuration(t.duracion) : "sin duración detectada"}</h4>
      <div class="field-label-mini">Roles (${t.roles.length})</div>
      <div class="taglist roles">${t.roles.map(r => `<span>${escapeHtml(r)}</span>`).join("") || "—"}</div>
      <div class="field-label-mini">Módulos (${t.modulos.length})</div>
      <div class="taglist">${t.modulos.map(m => `<span>${escapeHtml(m)}</span>`).join("") || "—"}</div>
    </div>`;
  }).join("");
}

document.getElementById("importTemplateBtn").onclick = () => {
  document.getElementById("templateFile").value = "";
  document.getElementById("templateStatus").textContent = "";
  document.getElementById("templatePreview").innerHTML = "";
  document.getElementById("templateSaveBtn").disabled = true;
  pendingTemplate = null;
  templateModal.classList.add("show");
};
function closeTemplateModal() { templateModal.classList.remove("show"); }
document.getElementById("templateCloseTop").onclick = closeTemplateModal;
document.getElementById("templateCancelBtn").onclick = closeTemplateModal;
templateModal.onclick = (e) => { if (e.target === templateModal) closeTemplateModal(); };

document.getElementById("templateAnalyzeBtn").onclick = async () => {
  const file = document.getElementById("templateFile").files[0];
  const status = document.getElementById("templateStatus");
  const saveBtn = document.getElementById("templateSaveBtn");
  if (!file) { status.textContent = "Primero elige un archivo .xlsx o .csv."; return; }
  status.textContent = "Analizando...";
  saveBtn.disabled = true;
  document.getElementById("templatePreview").innerHTML = "";
  try {
    pendingTemplate = await parseTemplateWorkbook(file);
    if (!Object.keys(pendingTemplate).length) throw new Error("No se pudo identificar ningún día en el archivo.");
    renderTemplatePreview(pendingTemplate);
    status.textContent = 'Revisa el resultado abajo y dale "Guardar plantilla" si se ve bien.';
    saveBtn.disabled = false;
  } catch (err) {
    console.error("[Agenda MIND] Error leyendo la plantilla:", err);
    status.textContent = "No se pudo leer el archivo (" + (err?.message || err) + "). Revisa que tenga columnas de Día, Rol(es) Requeridos y Módulos, y que tu conexión a internet esté activa (esta función descarga una librería para leer Excel).";
  }
};

document.getElementById("templateSaveBtn").onclick = async () => {
  if (!pendingTemplate || !Object.keys(pendingTemplate).length) return;
  Object.entries(pendingTemplate).forEach(([diaId, t]) => { agendaTemplate[diaId] = t; });
  if (mode === "cloud") await saveTemplateToSupabase(pendingTemplate);
  document.getElementById("templateStatus").textContent = 'Plantilla guardada — se usará la próxima vez que uses "Asignar semana".';
  document.getElementById("templateSaveBtn").disabled = true;
};

/* ============================================================
   ARRANQUE
   ============================================================ */
// El día de capacitación (Día 1-5) y la fase general son catálogos fijos que
// no dependen de la conexión a Supabase: se llenan de inmediato para que el
// formulario nunca se vea vacío mientras se resuelve la conexión a la nube.
fillSelectObjects("f_dia", DIAS, "Seleccionar día...", false);
initBackend();
