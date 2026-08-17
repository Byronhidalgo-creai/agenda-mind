import { supabaseConfig, SESSIONS_TABLE, CATALOG_TABLE } from "./supabase-config.js";

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
   ESTADO Y MODO DE CONEXIÓN
   ============================================================ */
let sessions = [];
let catalogs = { udn: [], roles: [], areas: [], modulos: [], implementadores: [] };
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
  catalogs.areas = [
    "Activos / Gestoría", "Administración", "Administración (Facturación)", "Administración (Finanzas)",
    "Almacén", "Calidad", "Capital Humano", "Combustibles", "Comercial", "Comunicación", "Logística",
    "Mantenimiento", "Nóminas", "Operaciones", "Proyectos", "Relaciones Públicas", "Seguridad Vial", "Sistemas",
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
    modalidad, lugar, modulos, roles, areas: [], implementadores: implementadores || [],
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
    areas: row.areas || [],
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
    areas: data.areas || [],
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
  const grouped = { udn: [], roles: [], areas: [], modulos: [], implementadores: [] };
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

    await fetchCatalogs();
    await fetchSessions();

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
  fillDatalist("areasList", catalogs.areas);
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
      ...(s.modulos || []), ...(s.roles || []), ...(s.areas || []), ...(s.implementadores || []),
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
    btn.onclick = (e) => { e.stopPropagation(); openModal(null, { udn: btn.dataset.udn }); };
  });
}

/* ---------- Detalle de UDN: agenda completa de esa UDN en una sola hoja ---------- */
let udnCompactView = false;

function renderUdnDetail(content) {
  const udn = drill.udn;
  const scoped = sessions.filter(s => s.udn === udn && sessionMatchesFilters(s, { ignoreUdn: true }));

  let html = `<div class="breadcrumb">
    <button type="button" class="lb lb-sm lb-ghost" id="bcTimeline">← Cronograma</button><span class="bc-sep">/</span>
    <b>${escapeHtml(udn)}</b>
  </div>`;
  html += `<div class="dayhead">
    <div style="font-size:13px;color:var(--gray-500)">${scoped.length} sesión${scoped.length === 1 ? "" : "es"} programada${scoped.length === 1 ? "" : "s"}</div>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="seg" id="udnViewSeg">
        <button type="button" class="segbtn${udnCompactView ? "" : " active"}" data-compact="0">Vista completa</button>
        <button type="button" class="segbtn${udnCompactView ? " active" : ""}" data-compact="1">Vista compacta</button>
      </div>
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

function sessionCardHtml(s) {
  const dia = diaById(s.diaId) || { nombre: "Sin día", dia: "", color: "#737373", bg: "#f5f5f5", border: "#e5e5e5" };
  const conflicts = findConflicts(s);
  const endLabel = minutesToLabel(timeToMinutes(s.start) + Number(s.duration));
  const modClass = s.modalidad === "Presencial" ? "presencial" : "virtual";
  const modIcon = s.modalidad === "Presencial" ? "🏢" : "💻";
  const barColor = s.modalidad === "Presencial" ? "#0e7490" : "#5b5fc7";
  return `
    <div class="scard" data-id="${s.id}" style="border-left-color:${barColor}">
      ${conflicts.length ? `<div class="tchip" style="background:#fef2f2;border-color:#fca5a5;color:#dc2626;align-self:flex-start">⚠️ Choque de sala con otra sesión</div>` : ""}
      <div class="time">${s.start}–${endLabel} · ${fmtDuration(s.duration)}</div>
      <h3>${escapeHtml(dia.nombre)}</h3>
      <div class="badges">
        <span class="tchip t-udn">🏷️ ${escapeHtml(s.udn)}</span>
        ${s.fase ? `<span class="tchip" style="background:var(--gray-100);border-color:var(--gray-200);color:var(--gray-700)">${escapeHtml(s.fase)}</span>` : ""}
        <span class="tchip" style="background:${dia.bg};border-color:${dia.border};color:${dia.color}">Día ${dia.dia || ""}</span>
        <span class="tchip t-modal ${modClass}">${modIcon} ${escapeHtml(s.modalidad)}</span>
      </div>
      ${s.lugar ? `<div class="field-label-mini">${s.modalidad === "Presencial" ? "Sala" : "Link"}</div><div style="font-size:12.5px;color:var(--gray-700);word-break:break-all">${escapeHtml(s.lugar)}</div>` : ""}
      ${s.objetivo ? `<div style="font-size:12.5px;color:var(--gray-600)">${escapeHtml(s.objetivo)}</div>` : ""}
      ${(s.modulos || []).length ? `<div><div class="field-label-mini">Módulos</div><div class="taglist">${s.modulos.map(m => `<span>${escapeHtml(m)}</span>`).join("")}</div></div>` : ""}
      ${(s.roles || []).length ? `<div><div class="field-label-mini">Roles</div><div class="taglist roles">${s.roles.map(r => `<span>${escapeHtml(r)}</span>`).join("")}</div></div>` : ""}
      ${(s.areas || []).length ? `<div><div class="field-label-mini">Áreas</div><div class="taglist areas">${s.areas.map(a => `<span>${escapeHtml(a)}</span>`).join("")}</div></div>` : ""}
      ${(s.implementadores || []).length ? `<div><div class="field-label-mini">Implementador(es)</div><div class="taglist impl">${s.implementadores.map(i => `<span>${escapeHtml(i)}</span>`).join("")}</div></div>` : ""}
      ${(s.hallazgos || []).length ? `<div class="tchip" style="background:#fff7ed;border-color:#fed7aa;color:#9a3412;align-self:flex-start">📝 ${s.hallazgos.length} hallazgo${s.hallazgos.length > 1 ? "s" : ""}</div>` : ""}
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
  const modIcon = s.modalidad === "Presencial" ? "🏢" : "💻";
  const barColor = s.modalidad === "Presencial" ? "#0e7490" : "#5b5fc7";
  return `
    <div class="scard compact-row" data-id="${s.id}" style="border-left-color:${barColor}">
      <span class="compact-time">${s.start}–${endLabel}</span>
      <span class="compact-badge" style="background:${dia.bg};border-color:${dia.border};color:${dia.color}">Día ${dia.dia || ""}</span>
      <span class="compact-name" title="${escapeHtml(dia.nombre)}">${escapeHtml(dia.nombre)}</span>
      ${s.fase ? `<span class="tchip" style="background:var(--gray-100);border-color:var(--gray-200);color:var(--gray-700)">${escapeHtml(s.fase)}</span>` : ""}
      <span class="tchip t-modal ${modClass}">${modIcon} ${escapeHtml(s.modalidad)}</span>
      ${conflicts.length ? `<span title="Choque de sala con otra sesión">⚠️</span>` : ""}
      <span class="compact-spacer"></span>
      <button class="lb lb-sm lb-ghost edit-btn" title="Editar" aria-label="Editar">✎</button>
      <button class="lb lb-sm lb-ghost delete-btn" title="Eliminar" aria-label="Eliminar" style="color:var(--red-600)">✕</button>
    </div>`;
}

function renderCatalogLists() {
  ["udn", "roles", "areas", "modulos", "implementadores"].forEach(kind => {
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
let formTags = { modulos: [], roles: [], areas: [], implementadores: [] };
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
  const containers = { modulos: "modulosTags", roles: "rolesTags", areas: "areasTags", implementadores: "implementadoresTags" };
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
document.getElementById("addAreaBtn").onclick = () => addTag("areas", "areasInput");
document.getElementById("addImplementadorBtn").onclick = () => addTag("implementadores", "implementadoresInput");
[["modulosInput", "modulos"], ["rolesInput", "roles"], ["areasInput", "areas"], ["implementadoresInput", "implementadores"]].forEach(([inputId, kind]) => {
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
  formTags = { modulos: [], roles: [], areas: [], implementadores: [] };
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
    formTags.areas = [...(session.areas || [])];
    formTags.implementadores = [...(session.implementadores || [])];
    formHallazgos = (session.hallazgos || []).map(h => ({ ...h }));
    setModalidad(session.modalidad || "Virtual (Teams)");
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
    }
    setModalidad("Virtual (Teams)");
  }
  renderTagChips("modulos"); renderTagChips("roles"); renderTagChips("areas"); renderTagChips("implementadores");
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
  warn.textContent = conflicts.length ? `⚠️ Esa sala ya está ocupada en ese horario (otra sesión el mismo día).` : "";
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
    areas: [...formTags.areas],
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
["udn", "roles", "areas", "modulos", "implementadores"].forEach(kind => {
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
        (s.areas || []).length ? "Áreas: " + s.areas.join(", ") : "",
        (s.implementadores || []).length ? "Implementadores: " + s.implementadores.join(", ") : "",
      ].filter(Boolean).join("\\n")}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  downloadFile("agenda-mind.ics", lines.join("\r\n"), "text/calendar");
};

document.getElementById("exportCsvBtn").onclick = () => {
  const header = ["UDN", "Fase", "Día", "Fecha", "Inicio", "Duración (min)", "Modalidad", "Sala/Link", "Objetivo", "Módulos", "Roles", "Áreas", "Implementadores", "Hallazgos"];
  const rows = sessions.map(s => {
    const dia = diaById(s.diaId) || { nombre: "" };
    return [s.udn, s.fase || "", dia.nombre, s.date, s.start, s.duration, s.modalidad, s.lugar, s.objetivo,
      (s.modulos || []).join("; "), (s.roles || []).join("; "), (s.areas || []).join("; "),
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
   ARRANQUE
   ============================================================ */
// El día de capacitación (Día 1-5) y la fase general son catálogos fijos que
// no dependen de la conexión a Supabase: se llenan de inmediato para que el
// formulario nunca se vea vacío mientras se resuelve la conexión a la nube.
fillSelectObjects("f_dia", DIAS, "Seleccionar día...", false);
initBackend();
