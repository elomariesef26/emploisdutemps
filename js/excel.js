/* ============================================================
   EXCEL.JS — Import / Export Excel (.xlsx) pour chaque module
   Dépend de : ExcelJS (js/vendor/exceljs.min.js), data.js, conflicts.js, render.js
   ============================================================ */

const XL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XL = {
  navy: "FF16265C", yellow: "FFFFE600", blue: "FF1F4E9C", red: "FFE5484D", text: "FF1C2233",
  line: "FF555555", soft: "FFF2F4FA", okFill: "FFE7F8EE", okText: "FF1C7A44", koFill: "FFFDECEC", koText: "FFA11A1A",
};
const XL_PALETTE = ["#fcebc0", "#f6c9c9", "#d7ecc8", "#c7e3f7", "#e6d7f7", "#f7d7ec", "#d7f7ec"];
const XL_ALL_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/* ------------------------------------------------------------
   Définition des feuilles (colonnes d'export ET d'import)
   ------------------------------------------------------------ */
const XL_SHEETS = {
  sessions: { name: "Sessions", cols: [
    { key: "label", header: "Nom de session", width: 38, required: true },
    { key: "annee", header: "Année universitaire", width: 20 },
    { key: "type", header: "Type", width: 16 },
    { key: "statut", header: "Statut", width: 16 },
    { key: "active", header: "Session active", width: 16 },
  ] },
  header: { name: "En-tête", cols: [
    { key: "field", header: "Champ", width: 30, required: true },
    { key: "value", header: "Valeur", width: 52 },
  ] },
  days: { name: "Jours", cols: [
    { key: "day", header: "Jour", width: 18, required: true },
    { key: "active", header: "Actif", width: 12, aliases: ["active", "oui/non"] },
  ] },
  slots: { name: "Créneaux", cols: [
    { key: "label", header: "Libellé", width: 28, aliases: ["libelle", "label", "creneau"] },
    { key: "start", header: "Début", width: 12, required: true, aliases: ["debut", "start", "heure debut", "de"] },
    { key: "end", header: "Fin", width: 12, required: true, aliases: ["end", "heure fin", "a"] },
  ] },
  groups: { name: "Groupes", cols: [
    { key: "name", header: "Nom", width: 28, required: true, aliases: ["groupe", "name"] },
    { key: "semestre", header: "Semestre", width: 12, aliases: ["semester", "s"] },
    { key: "effectif", header: "Effectif", width: 12, aliases: ["nb etudiants", "etudiants"] },
    { key: "room", header: "Salle par défaut", width: 22, aliases: ["salle", "salle par defaut"] },
    { key: "actionday", header: "Actions éducatives — jour", width: 28, aliases: ["jour action", "actions educatives jour"] },
    { key: "actionlabel", header: "Libellé Actions éducatives", width: 34, aliases: ["libelle action", "libelle actions educatives"] },
  ] },
  rooms: { name: "Salles", cols: [
    { key: "name", header: "Nom", width: 28, required: true, aliases: ["salle", "name"] },
    { key: "capacity", header: "Capacité", width: 12, aliases: ["capacite", "places"] },
    { key: "type", header: "Type", width: 18 },
    { key: "unavailable", header: "Indisponibilités", width: 60, aliases: ["indisponibilites", "indisponible"] },
  ] },
  teachers: { name: "Enseignants", cols: [
    { key: "name", header: "Nom", width: 32, required: true, aliases: ["enseignant", "name"] },
    { key: "unavailable", header: "Indisponibilités", width: 60, aliases: ["indisponibilites", "indisponible"] },
    { key: "modules", header: "Modules assurés", width: 50, aliases: ["modules assures", "modules"] },
    { key: "allmodules", header: "Tous les modules", width: 16, aliases: ["tous modules"] },
    { key: "groupcounts", header: "Nombre de groupes par module", width: 56, aliases: ["groupes par module", "nombre groupes module"] },
  ] },
  modules: { name: "Modules", cols: [
    { key: "name", header: "Nom", width: 40, required: true, aliases: ["module", "name"] },
    { key: "semestre", header: "Semestre", width: 12, aliases: ["semester", "s"] },
    { key: "volume", header: "Volume horaire", width: 18, aliases: ["volume", "volume horaire hebdo", "vh"] },
    { key: "nature", header: "Nature", width: 16, aliases: ["type"] },
    { key: "groups", header: "Groupes concernés", width: 36, aliases: ["groupes", "groupe", "groupes amphi"] },
    { key: "nbgroups", header: "Nb groupes", width: 12 },
  ] },
  affectations: { name: "Affectations", cols: [
    { key: "module", header: "Module", width: 40, required: true },
    { key: "teacher", header: "Enseignant", width: 28, required: true, aliases: ["prof"] },
    { key: "count", header: "Nb groupes demandé", width: 16, aliases: ["nb groupes", "nombre de groupes", "groupcount"] },
    { key: "groups", header: "Groupe(s) attribué(s)", width: 36, aliases: ["groupes", "groupe", "groupe(s)"] },
  ] },
  seances: { name: "Séances", cols: [
    { key: "module", header: "Module", width: 34, required: true },
    { key: "teacher", header: "Enseignant", width: 22, aliases: ["prof"] },
    { key: "groups", header: "Groupe(s)", width: 24, required: true, aliases: ["groupes", "groupe"] },
    { key: "room", header: "Salle", width: 16 },
    { key: "day", header: "Jour", width: 14, required: true },
    { key: "start", header: "Créneau début", width: 16, required: true, aliases: ["creneau", "creneau debut", "debut", "creneau de debut"] },
    { key: "duration", header: "Nb créneaux", width: 14, aliases: ["duree", "nb creneaux", "nombre de creneaux"] },
    { key: "horaire", header: "Horaire", width: 18 },
    { key: "color", header: "Couleur", width: 12, aliases: ["couleur (#rrggbb)"] },
  ] },
};

/* ------------------------------------------------------------
   Utilitaires
   ------------------------------------------------------------ */
function xlNorm(s) {
  return String(s === null || s === undefined ? "" : s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}
function xlNormHeader(s) { return xlNorm(String(s === null || s === undefined ? "" : s).replace(/\(.*?\)/g, "")); }

function xlCellText(v) {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return isNaN(v) ? "" : v.toISOString();
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join("");
    if ("result" in v) return xlCellText(v.result);
    if ("text" in v) return xlCellText(v.text);
    if ("hyperlink" in v) return String(v.hyperlink);
    if ("error" in v) return "";
  }
  return String(v);
}

function xlNumber(v) {
  if (typeof v === "number") return v;
  const t = xlCellText(v).replace(/\s/g, "").replace(",", ".");
  if (t === "") return NaN;
  return Number(t);
}

function xlPad(n) { return String(n).padStart(2, "0"); }

/** Convertit une valeur de cellule (texte, date Excel, fraction de jour) en "HH:MM", ou null. */
function xlTime(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return xlPad(v.getUTCHours()) + ":" + xlPad(v.getUTCMinutes());
  if (typeof v === "number") {
    if (v >= 0 && v < 1) { const m = Math.round(v * 1440); return xlPad(Math.floor(m / 60)) + ":" + xlPad(m % 60); }
    return null;
  }
  const t = xlCellText(v).trim().toLowerCase().replace(/h/, ":");
  const m = /^(\d{1,2})(?::(\d{0,2}))?(?::\d{2})?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2] || 0);
  if (h > 23 || mi > 59) return null;
  return xlPad(h) + ":" + xlPad(mi);
}

function xlSplitList(text) {
  return String(text || "").split(/[;\n|]+/).map(x => x.trim()).filter(Boolean);
}

function xlParseColor(text) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(text || "").trim());
  return m ? "#" + m[1].toLowerCase() : null;
}
function xlArgb(hex, fallback = "FFE9EDFB") {
  const c = xlParseColor(hex);
  return c ? "FF" + c.slice(1).toUpperCase() : fallback;
}
function xlDarkenArgb(hex) {
  const c = xlParseColor(hex);
  if (!c) return "FF4F6DF7";
  const n = parseInt(c.slice(1), 16);
  const f = v => xlPad(Math.max(0, v - 60).toString(16)).toUpperCase();
  return "FF" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
}

function xlDay(session, text) {
  const t = xlNorm(text);
  if (!t) return null;
  const days = session.config.days;
  const exact = days.find(d => xlNorm(d) === t);
  if (exact) return exact;
  if (t.length >= 3) {
    const cands = days.filter(d => xlNorm(d).startsWith(t));
    if (cands.length === 1) return cands[0];
  }
  return null;
}

/** Résout un créneau : numéro (1 = premier), libellé ou heure de début. Retourne l'index ou -1. */
function xlSlotIndex(session, raw) {
  const slots = session.config.slots;
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 1 && raw <= slots.length ? raw - 1 : -1;
  const t = xlCellText(raw).trim();
  if (!t) return -1;
  if (/^\d+$/.test(t)) { const n = Number(t); return n >= 1 && n <= slots.length ? n - 1 : -1; }
  const nl = xlNorm(t);
  let i = slots.findIndex(s => xlNorm(s.label) === nl);
  if (i >= 0) return i;
  const tm = xlTime(t);
  if (tm) { i = slots.findIndex(s => s.start === tm); if (i >= 0) return i; }
  return -1;
}

function xlIndexByName(list) {
  const m = new Map();
  list.forEach(x => m.set(xlNorm(x.name), x));
  return m;
}

function xlSlug(s) {
  return xlNorm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "edt";
}
function xlFileName(session, part) {
  return `edt_${xlSlug(session.label)}_${xlSlug(part)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

function xlSheetName(wb, name) {
  const base = String(name).replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Feuille";
  let n = base, i = 2;
  while (wb.getWorksheet(n)) {
    const suf = ` (${i++})`;
    n = base.slice(0, 31 - suf.length) + suf;
  }
  return n;
}

function xlEnsureLib() {
  if (typeof ExcelJS === "undefined") {
    alert("La bibliothèque Excel (js/vendor/exceljs.min.js) n'est pas chargée.");
    return false;
  }
  return true;
}

function xlNewWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestion des emplois du temps";
  wb.created = new Date();
  return wb;
}

async function xlDownload(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XL_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Export Excel : " + filename);
}

/* ------------------------------------------------------------
   Styles
   ------------------------------------------------------------ */
function xlBorder(color = XL.line, style = "thin") {
  const s = { style, color: { argb: color } };
  return { top: s, left: s, bottom: s, right: s };
}

function xlStyleHeaderCell(c) {
  c.font = { bold: true, color: { argb: XL.navy }, name: "Calibri", size: 11 };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.yellow } };
  c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  c.border = xlBorder();
}

/** Feuille de données tabulaire : en-tête jaune, filtres, volets figés, bordures. */
function xlAddDataSheet(wb, def, rows, opts = {}) {
  const ws = wb.addWorksheet(xlSheetName(wb, def.name), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = def.cols.map(c => ({ header: c.header, key: c.key, width: c.width || 18 }));
  rows.forEach(r => ws.addRow(r));
  ws.getRow(1).height = 26;
  ws.getRow(1).eachCell(xlStyleHeaderCell);
  const last = Math.max(rows.length + 1, opts.minRows || 1);
  for (let r = 2; r <= last; r++) {
    def.cols.forEach((_, i) => {
      const c = ws.getCell(r, i + 1);
      c.border = xlBorder("FFBBBBBB");
      c.alignment = { vertical: "middle", wrapText: true };
    });
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: def.cols.length } };
  return ws;
}

function xlAddHelpSheet(wb, title, lines) {
  const ws = wb.addWorksheet(xlSheetName(wb, "Aide"), { views: [{ showGridLines: false }] });
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 96;
  ws.mergeCells("A1:B1");
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { bold: true, size: 14, color: { argb: XL.blue } };
  lines.forEach(([a, b], i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = a;
    r.getCell(1).font = { bold: true, color: { argb: XL.navy } };
    r.getCell(1).alignment = { vertical: "top", wrapText: true };
    r.getCell(2).value = b;
    r.getCell(2).alignment = { vertical: "top", wrapText: true };
  });
  return ws;
}

/* ------------------------------------------------------------
   Lecture d'un classeur : retrouver un tableau par ses en-têtes
   ------------------------------------------------------------ */
async function xlReadFile(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  return wb;
}

function xlReadTable(ws, cols) {
  const defs = cols.map(c => ({
    key: c.key, required: !!c.required,
    names: [c.header, ...(c.aliases || [])].map(xlNormHeader),
  }));
  let best = null;
  const maxScan = Math.min(ws.rowCount, 25);
  for (let r = 1; r <= maxScan; r++) {
    const map = {};
    let hits = 0;
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const t = xlNormHeader(xlCellText(cell.value));
      if (!t) return;
      const d = defs.find(d => map[d.key] === undefined && d.names.includes(t));
      if (d) { map[d.key] = colNumber; hits++; }
    });
    const okRequired = defs.filter(d => d.required).every(d => map[d.key] !== undefined);
    if (okRequired && hits > 0 && (!best || hits > best.hits)) best = { rowNumber: r, map, hits };
    if (best && best.hits === defs.length) break;
  }
  if (!best) return null;

  const rows = [];
  for (let r = best.rowNumber + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const raw = {};
    let any = false;
    Object.entries(best.map).forEach(([key, col]) => {
      const v = row.getCell(col).value;
      raw[key] = v;
      if (xlCellText(v).trim() !== "") any = true;
    });
    if (!any) continue;
    rows.push({ line: r, raw: k => raw[k], text: k => xlCellText(raw[k]).trim() });
  }
  return { sheetName: ws.name, rows, has: k => best.map[k] !== undefined };
}

/** Cherche un tableau : d'abord la feuille du même nom, puis (sauf strictName) n'importe quelle feuille. */
function xlFindTable(wb, def, strictName = false) {
  const target = xlNorm(def.name);
  const sheets = wb.worksheets.slice().sort((a, b) => (xlNorm(b.name) === target) - (xlNorm(a.name) === target));
  for (const ws of sheets) {
    const same = xlNorm(ws.name) === target;
    if (strictName && !same) continue;
    const t = xlReadTable(ws, def.cols);
    if (t) return t;
  }
  return null;
}

/* ------------------------------------------------------------
   Rapport d'import
   ------------------------------------------------------------ */
function xlNewReport() { return { sections: [], created: [], warnings: [], errors: [] }; }
function xlSection(rep, title) {
  const s = { title, added: 0, updated: 0, skipped: 0 };
  rep.sections.push(s);
  return s;
}
function xlHasChanges(rep) { return rep.sections.some(s => s.added || s.updated) || rep.created.length > 0; }

/* ============================================================
   EXPORTS
   ============================================================ */

/* ---------- Lignes de données ---------- */
function xlSeanceRow(session, s) {
  const slots = session.config.slots;
  const mod = session.modules.find(m => m.id === s.moduleId);
  const teacher = session.teachers.find(t => t.id === s.teacherId);
  const room = session.rooms.find(r => r.id === s.roomId);
  const groups = s.groupIds.map(id => (session.groups.find(g => g.id === id) || {}).name).filter(Boolean);
  const first = slots[s.startSlotIndex], last = slots[Math.min(s.startSlotIndex + s.duration - 1, slots.length - 1)];
  return {
    module: mod ? mod.name : "", teacher: teacher ? teacher.name : "", groups: groups.join("; "),
    room: room ? room.name : "", day: s.day, start: s.startSlotIndex + 1, duration: s.duration,
    horaire: first && last ? `${first.start} - ${last.end}` : "", color: (s.color || "").toUpperCase(),
  };
}

function xlFormatUnavailability(session, teacher) {
  const { days, slots } = session.config;
  const parts = [];
  days.forEach(day => {
    const idxs = slots.map((_, i) => i).filter(i => isTeacherUnavailable(teacher, day, i));
    if (!idxs.length) return;
    if (idxs.length === slots.length) parts.push(`${day} (toute la journée)`);
    else idxs.forEach(i => parts.push(`${day} ${i + 1}`));
  });
  return parts.join("; ");
}

function xlFormatRoomUnavailability(session, room) {
  const { days, slots } = session.config;
  const parts = [];
  days.forEach(day => {
    const idxs = slots.map((_, i) => i).filter(i => isRoomUnavailable(room, day, i));
    if (!idxs.length) return;
    if (idxs.length === slots.length) parts.push(`${day} (toute la journée)`);
    else idxs.forEach(i => parts.push(`${day} ${i + 1}`));
  });
  return parts.join("; ");
}

/* ---------- Feuille "Listes" + validations ---------- */
function xlAddListsSheet(wb, session) {
  const ws = wb.addWorksheet("Listes");
  const lists = [
    ["Modules", session.modules.map(m => m.name)],
    ["Enseignants", session.teachers.map(t => t.name)],
    ["Salles", session.rooms.map(r => r.name)],
    ["Groupes", session.groups.map(g => g.name)],
    ["Jours", session.config.days.slice()],
    ["Créneaux (n° — libellé)", session.config.slots.map((s, i) => `${i + 1} — ${s.label}`)],
  ];
  lists.forEach(([h, items], c) => {
    xlStyleHeaderCell(ws.getCell(1, c + 1));
    ws.getCell(1, c + 1).value = h;
    items.forEach((v, r) => { ws.getCell(r + 2, c + 1).value = v; });
    ws.getColumn(c + 1).width = Math.max(18, h.length + 4, ...items.map(x => String(x).length + 3));
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return lists.map(l => l[1].length);
}

function xlAddSeancesSheet(wb, session, seances) {
  const rows = seances.map(s => xlSeanceRow(session, s));
  const nRows = Math.max(rows.length + 100, 150);
  const ws = xlAddDataSheet(wb, XL_SHEETS.seances, rows, { minRows: nRows + 1 });
  const cols = XL_SHEETS.seances.cols.map(c => c.key);
  const colOf = k => cols.indexOf(k) + 1;

  rows.forEach((row, i) => {
    const cell = ws.getCell(i + 2, colOf("color"));
    const hex = xlParseColor(row.color);
    if (hex) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: xlArgb(hex) } };
    ws.getCell(i + 2, colOf("horaire")).font = { italic: true, color: { argb: "FF888888" } };
  });

  // Listes déroulantes (avertissement seulement : une valeur inconnue sera créée à l'import)
  const counts = xlAddListsSheet(wb, session);
  const listRef = (col, n) => `Listes!$${col}$2:$${col}$${n + 1}`;
  const warnList = (ref) => ({
    type: "list", allowBlank: true, formulae: [ref], showErrorMessage: true, errorStyle: "warning",
    errorTitle: "Valeur inconnue", error: "Cette valeur n'existe pas encore : elle sera créée à l'import si l'option est activée.",
  });
  const nSlots = session.config.slots.length;
  for (let r = 2; r <= nRows + 1; r++) {
    if (counts[0]) ws.getCell(r, colOf("module")).dataValidation = warnList(listRef("A", counts[0]));
    if (counts[1]) ws.getCell(r, colOf("teacher")).dataValidation = warnList(listRef("B", counts[1]));
    if (counts[2]) ws.getCell(r, colOf("room")).dataValidation = warnList(listRef("C", counts[2]));
    if (counts[4]) ws.getCell(r, colOf("day")).dataValidation = warnList(listRef("E", counts[4]));
    if (nSlots) {
      const numDv = { type: "whole", operator: "between", allowBlank: true, formulae: [1, nSlots], showErrorMessage: true, errorTitle: "Nombre invalide", error: `Entrez un nombre entre 1 et ${nSlots}.` };
      ws.getCell(r, colOf("start")).dataValidation = numDv;
      ws.getCell(r, colOf("duration")).dataValidation = numDv;
    }
  }
  return ws;
}

function xlSeancesHelp(wb, session, context) {
  xlAddHelpSheet(wb, "Mode d'emploi — feuille « Séances »", [
    ["Principe", `Une ligne = une séance. ${context}`],
    ["Module", "Nom du module (liste déroulante). Un nom inconnu est créé automatiquement si l'option est cochée à l'import."],
    ["Enseignant", "Nom de l'enseignant (facultatif)."],
    ["Groupe(s)", "Un ou plusieurs groupes séparés par un point-virgule, ex : « Groupe 1; Groupe 2 » (séance mutualisée)."],
    ["Salle", "Nom de la salle (facultatif)."],
    ["Jour", `Jours actifs : ${session.config.days.join(", ")}.`],
    ["Créneau début", "Numéro du créneau de départ (1 = premier créneau). Voir la feuille « Listes »."],
    ["Nb créneaux", "Nombre de créneaux consécutifs occupés (1 par défaut)."],
    ["Horaire", "Colonne informative, ignorée à l'import."],
    ["Couleur", "Code couleur #RRGGBB (facultatif). À défaut, la couleur du module est reprise."],
    ["Doublons", "Une séance strictement identique à une séance existante est ignorée."],
  ]);
}

/** Intègre le logo de la session en haut à gauche d'une feuille (PNG/JPG/GIF uniquement — le
 * SVG n'est pas pris en charge par le moteur d'export Excel, il reste utilisé pour le PDF/écran). */
function xlAddLogoIfAny(wb, ws, session) {
  const logo = session.logo;
  if (!logo || !logo.dataUrl) return false;
  const match = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(logo.dataUrl);
  if (!match) return false;
  const ext = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
  if (wb.__logoImgId === undefined) {
    try { wb.__logoImgId = wb.addImage({ base64: match[2], extension: ext }); }
    catch (e) { wb.__logoImgId = null; }
  }
  if (wb.__logoImgId === null || wb.__logoImgId === undefined) return false;
  ws.addImage(wb.__logoImgId, { tl: { col: 0, row: 0 }, ext: { width: 52, height: 52 } });
  return true;
}

/* ---------- Grille d'emploi du temps (mise en page fidèle au document PDF) ---------- */
function xlAddGridSheet(wb, session, spec, sheetName) {
  const ws = wb.addWorksheet(xlSheetName(wb, sheetName), { views: [{ showGridLines: false }] });
  const slots = session.config.slots;
  if (slots.length === 0) { ws.getCell("A1").value = "Aucun créneau configuré."; return ws; }
  const nCols = slots.length + 1;
  const F = (o) => Object.assign({ name: "Calibri", color: { argb: XL.text } }, o);

  xlAddLogoIfAny(wb, ws, session);

  ws.getColumn(1).width = 15;
  for (let c = 2; c <= nCols; c++) ws.getColumn(c).width = 27;

  const merged = (r, c1, c2) => { if (c2 > c1) ws.mergeCells(r, c1, r, c2); return ws.getCell(r, c1); };

  const statut = session.statut === "final" ? "final" : "provisoire";
  const title = merged(1, 1, nCols);
  title.value = { richText: [
    { text: "Emploi du temps ", font: F({ bold: true, size: 17, color: { argb: XL.blue } }) },
    { text: statut, font: F({ bold: true, size: 17, color: { argb: XL.red } }) },
    { text: ` session de ${session.typeSession || "Printemps"}`, font: F({ bold: true, size: 17, color: { argb: XL.blue } }) },
  ] };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 30;

  const annee = merged(2, 1, nCols);
  annee.value = `Année universitaire ${session.annee || ""}`;
  annee.font = F({ size: 12, color: { argb: XL.blue } });
  annee.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 20;

  const fil = merged(3, 1, nCols);
  fil.value = `${session.filiere || ""}${session.option ? " Option : " + session.option : ""}`;
  fil.font = F({ bold: true, size: 12, underline: true });
  fil.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 22;

  const mid = Math.max(1, Math.ceil(nCols / 2));
  const left = merged(4, 1, mid);
  left.value = spec.metaLeft;
  left.font = F({ bold: true, size: 12 });
  left.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  if (mid < nCols) {
    const right = merged(4, mid + 1, nCols);
    right.value = spec.metaRight;
    right.font = F({ bold: true, size: 12 });
    right.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  }
  ws.getRow(4).height = 24;

  // En-tête de grille
  const HR = 6;
  xlStyleHeaderCell(ws.getCell(HR, 1));
  slots.forEach((s, i) => { const c = ws.getCell(HR, i + 2); c.value = s.label; xlStyleHeaderCell(c); });
  ws.getRow(HR).height = 28;

  // Corps de grille
  let r = HR + 1;
  computeGridRows(session, spec.filterFn).forEach(({ day, cells }) => {
    ws.getRow(r).height = 78;
    const dc = ws.getCell(r, 1);
    dc.value = day;
    xlStyleHeaderCell(dc);
    dc.font = { bold: true, size: 12, color: { argb: XL.navy }, name: "Calibri" };

    cells.forEach(cell => {
      const col = cell.slotIdx + 2;
      const c = ws.getCell(r, col);
      if (cell.kind === "empty") {
        c.border = xlBorder();
      } else if (cell.kind === "conflict") {
        c.value = cell.seances.map(s => "⚠ " + getSeanceLines(session, s, spec.kind)[0].text).join("\n");
        c.font = F({ bold: true, size: 10, color: { argb: XL.koText } });
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.koFill } };
        c.alignment = { vertical: "top", horizontal: "left", wrapText: true };
        c.border = xlBorder(XL.red);
      } else {
        const s = cell.seances[0];
        const lines = getSeanceLines(session, s, spec.kind);
        const rich = [];
        lines.forEach((l, i) => {
          const sep = i < lines.length - 1 ? "\n" : "";
          if (l.cls === "s-module") rich.push({ text: l.text + sep, font: F({ bold: true, size: 11 }) });
          else if (l.cls === "s-room") rich.push({ text: l.text + sep, font: F({ italic: true, size: 10 }) });
          else rich.push({ text: l.text + sep, font: F({ size: 10 }) });
        });
        c.value = { richText: rich };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: xlArgb(s.color) } };
        c.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 0 };
        const thin = { style: "thin", color: { argb: XL.line } };
        c.border = { top: thin, bottom: thin, right: thin, left: { style: "thick", color: { argb: xlDarkenArgb(s.color) } } };
        if (cell.span > 1) ws.mergeCells(r, col, r, col + cell.span - 1);
      }
    });
    r++;
  });

  r++;
  const nb = merged(r, 1, nCols);
  nb.value = "NB : Une journée entière sera consacré au travail éducatif";
  nb.font = F({ size: 10 });
  const dt = merged(r + 1, 1, nCols);
  dt.value = `Date : ${formatDateFR(new Date())}`;
  dt.font = F({ size: 10 });

  ws.pageSetup = {
    orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1,
    horizontalCentered: true, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    printArea: `A1:${ws.getColumn(nCols).letter}${r + 1}`,
  };
  return ws;
}

function xlAddAvailabilitySheet(wb, session, teacher) {
  return xlAddAvailabilitySheetGeneric(wb, session, (day, i) => isTeacherUnavailable(teacher, day, i));
}

function xlAddRoomAvailabilitySheet(wb, session, room) {
  return xlAddAvailabilitySheetGeneric(wb, session, (day, i) => isRoomUnavailable(room, day, i));
}

function xlAddAvailabilitySheetGeneric(wb, session, isUnavailable) {
  const ws = wb.addWorksheet("Disponibilités", { views: [{ state: "frozen", ySplit: 1, xSplit: 1 }] });
  const slots = session.config.slots;
  ws.getColumn(1).width = 16;
  xlStyleHeaderCell(ws.getCell(1, 1));
  ws.getCell(1, 1).value = "Jour";
  slots.forEach((s, i) => {
    ws.getColumn(i + 2).width = 20;
    const c = ws.getCell(1, i + 2);
    c.value = s.label;
    xlStyleHeaderCell(c);
  });
  ws.getRow(1).height = 28;
  session.config.days.forEach((day, di) => {
    const r = di + 2;
    ws.getRow(r).height = 30;
    const dc = ws.getCell(r, 1);
    dc.value = day;
    xlStyleHeaderCell(dc);
    slots.forEach((_, i) => {
      const off = isUnavailable(day, i);
      const c = ws.getCell(r, i + 2);
      c.value = off ? "Indisponible" : "Disponible";
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: off ? XL.koFill : XL.okFill } };
      c.font = { bold: true, color: { argb: off ? XL.koText : XL.okText } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = xlBorder("FFBBBBBB");
      c.dataValidation = { type: "list", allowBlank: false, formulae: ['"Disponible,Indisponible"'], showErrorMessage: true, error: "Choisissez Disponible ou Indisponible." };
    });
  });
  ws.getCell(session.config.days.length + 3, 1).value = "Astuce : choisissez « Indisponible » dans la liste pour bloquer un créneau.";
  ws.getCell(session.config.days.length + 3, 1).font = { italic: true, color: { argb: "FF888888" } };
  return ws;
}

/* ---------- Exports par module ---------- */
function xlExportConfig() {
  const session = getCurrentSession();
  const wb = xlNewWorkbook();
  const H = XL_SHEETS.header;
  xlAddDataSheet(wb, H, [
    { field: "Nom de session", value: session.label || "" },
    { field: "Type de session", value: session.typeSession || "Printemps" },
    { field: "Statut", value: session.statut === "final" ? "Final" : "Provisoire" },
    { field: "Année universitaire", value: session.annee || "" },
    { field: "Filière", value: session.filiere || "" },
    { field: "Option", value: session.option || "" },
    { field: "Début des cours", value: session.startDate || "" },
  ]);
  xlAddDataSheet(wb, XL_SHEETS.days, XL_ALL_DAYS.map(d => ({ day: d, active: session.config.days.includes(d) ? "Oui" : "Non" })));
  const ws = xlAddDataSheet(wb, XL_SHEETS.slots, session.config.slots.map(s => ({ label: s.label, start: s.start, end: s.end })));
  ws.getColumn(2).numFmt = "@"; ws.getColumn(3).numFmt = "@";
  xlAddHelpSheet(wb, "Mode d'emploi — Configuration", [
    ["En-tête", "Nom, type de session (Automne ou Printemps), statut, année universitaire, filière, option et date de début des cours."],
    ["Jours", "Mettez « Oui » ou « Non » dans la colonne Actif."],
    ["Créneaux", "Un créneau par ligne, heures au format HH:MM (ex : 09:00). L'ordre des lignes = numéro du créneau."],
    ["Attention", "L'import remplace les créneaux existants : les séances sont repérées par le numéro du créneau."],
  ]);
  return xlDownload(wb, xlFileName(session, "configuration"));
}

function xlListRows(session, key) {
  switch (key) {
    case "groups": return session.groups.map(g => ({
      name: g.name, semestre: g.semestre, effectif: g.effectif,
      room: (session.rooms.find(r => r.id === g.defaultRoomId) || {}).name || "",
      actionday: g.educationalActionDay || "", actionlabel: g.educationalActionLabel || "ACTIONS ÉDUCATIVES",
    }));
    case "rooms": return session.rooms.map(r => ({ name: r.name, capacity: r.capacity, type: r.type === "amphi" ? "Amphithéâtre" : "Salle", unavailable: xlFormatRoomUnavailability(session, r) }));
    case "teachers": return session.teachers.map(t => ({
      name: t.name, unavailable: xlFormatUnavailability(session, t),
      modules: t.allModules ? "Tous les modules" : (t.moduleIds || []).map(id => session.modules.find(m => m.id === id)?.name).filter(Boolean).join("; "),
      allmodules: t.allModules ? "Oui" : "Non",
      groupcounts: Object.entries(t.moduleGroupCounts || {}).map(([id, count]) => {
        const module = session.modules.find(m => m.id === id);
        return module ? `${module.name}=${count}` : "";
      }).filter(Boolean).join("; "),
    }));
    case "modules": return session.modules.map(m => ({
      name: m.name, semestre: m.semestre || "", volume: m.volumeHoraire || 0, nature: isTransversal(m) ? "Transversal" : "Métier",
      groups: affGroupNames(session, m.groupIds || []).join("; "), nbgroups: (m.groupIds || []).length,
    }));
  }
  return [];
}

const XL_LIST_HELP = {
  groups: [["Nom", "Nom du groupe (clé de rapprochement : un groupe existant portant le même nom est mis à jour)."],
    ["Semestre", "Numéro ou libellé du semestre (ex : 6)."], ["Effectif", "Nombre d'étudiants."], ["Salle par défaut", "Nom d'une salle existante."],
    ["Actions éducatives — jour", "Jour extérieur du groupe, ou vide."], ["Libellé Actions éducatives", "Libellé affiché dans le planning et le PDF."]],
  rooms: [["Nom", "Nom de la salle (clé de rapprochement)."], ["Capacité", "Nombre de places."], ["Type", "« Salle » ou « Amphithéâtre »."],
    ["Indisponibilités", "Séparées par « ; ». Formats : « Vendredi 1 » (jour + n° de créneau), « Mardi (toute la journée) » ou « Lundi » seul pour la journée entière. Vide = toujours disponible."]],
  teachers: [["Nom", "Nom de l'enseignant (clé de rapprochement)."],
    ["Indisponibilités", "Séparées par « ; ». Formats : « Vendredi 1 » (jour + n° de créneau), « Mardi (toute la journée) » ou « Lundi » seul pour la journée entière."],
    ["Modules assurés", "Noms des modules séparés par « ; »."], ["Tous les modules", "Oui ou Non."],
    ["Nombre de groupes par module", "Paires « Nom du module=nombre » séparées par « ; », par exemple « Déontologie=3; Français=2 ». Utilisé par la répartition automatique."]],
  modules: [["Nom", "Nom du module (clé de rapprochement)."], ["Semestre", "Semestre du module."], ["Volume horaire", "Volume hebdomadaire indicatif, en heures (ex : 1,5)."],
    ["Nature", "« Métier » (module classique) ou « Transversal » (séance de 1h30, groupes regroupés par 2 à 3 dans un amphi ; un enseignant qui l'assure a au moins 2 groupes)."],
    ["Groupes concernés", "Groupes qui suivent le module ensemble (ex. en amphi), séparés par « ; ». Ils doivent exister (importez d'abord les groupes). La répartition entre enseignants se fait dans la feuille Affectations."],
    ["Nb groupes", "Information calculée, ignorée à l'import."]],
};
const XL_LIST_LABEL = { groups: "Groupes", rooms: "Salles", teachers: "Enseignants", modules: "Modules" };

function xlExportList(key, template = false) {
  const session = getCurrentSession();
  const wb = xlNewWorkbook();
  const def = XL_SHEETS[key];
  const ws = xlAddDataSheet(wb, def, template ? [] : xlListRows(session, key), { minRows: 60 });
  if (key === "rooms") {
    for (let r = 2; r <= 60; r++) ws.getCell(r, 3).dataValidation = { type: "list", allowBlank: true, formulae: ['"Salle,Amphithéâtre"'] };
  }
  if (key === "modules") {
    for (let r = 2; r <= 60; r++) ws.getCell(r, 4).dataValidation = { type: "list", allowBlank: true, formulae: ['"Métier,Transversal"'] };
  }
  if (key === "groups" && session.rooms.length) {
    const l = wb.addWorksheet("Listes");
    l.getCell("A1").value = "Salles";
    xlStyleHeaderCell(l.getCell("A1"));
    l.getColumn(1).width = 24;
    session.rooms.forEach((r, i) => { l.getCell(i + 2, 1).value = r.name; });
    for (let r = 2; r <= 60; r++) ws.getCell(r, 4).dataValidation = {
      type: "list", allowBlank: true, formulae: [`Listes!$A$2:$A$${session.rooms.length + 1}`],
      showErrorMessage: true, errorStyle: "warning", errorTitle: "Salle inconnue", error: "Cette salle n'existe pas : elle sera ignorée à l'import.",
    };
  }
  xlAddHelpSheet(wb, `Mode d'emploi — ${XL_LIST_LABEL[key]}`, [
    ...XL_LIST_HELP[key],
    ["Import", "Les lignes sont fusionnées avec l'existant : mise à jour si le nom existe déjà, ajout sinon. Rien n'est supprimé."],
  ]);
  return xlDownload(wb, xlFileName(session, template ? `modele-${XL_LIST_LABEL[key]}` : XL_LIST_LABEL[key]));
}

function xlExportGroupPlanning(template = false) {
  const session = getCurrentSession();
  const wb = xlNewWorkbook();
  if (template) {
    xlAddSeancesSheet(wb, session, []);
    xlSeancesHelp(wb, session, "Modèle d'import de planning.");
    return xlDownload(wb, xlFileName(session, "modele-seances"));
  }
  const group = session.groups.find(g => g.id === document.getElementById("planningGroupSelect").value);
  if (!group) { alert("Sélectionnez d'abord un groupe."); return; }
  const spec = groupDocSpec(session, group);
  xlAddGridSheet(wb, session, spec, `Planning ${group.name}`);
  xlAddSeancesSheet(wb, session, session.seances.filter(spec.filterFn));
  xlSeancesHelp(wb, session, "Les séances de la feuille « Séances » sont réimportables telles quelles.");
  return xlDownload(wb, xlFileName(session, `planning-${group.name}`));
}

function xlExportSemesterPlanning() {
  const session = getCurrentSession();
  const sem = typeof selectedSemester !== "undefined" ? selectedSemester : null;
  const groups = session.groups.filter(g => g.semestre === sem);
  if (!sem || !groups.length) { alert("Sélectionnez d'abord un semestre contenant des groupes."); return; }
  const wb = xlNewWorkbook();
  groups.forEach(g => xlAddGridSheet(wb, session, groupDocSpec(session, g), g.name));
  const ids = new Set(groups.map(g => g.id));
  xlAddSeancesSheet(wb, session, session.seances.filter(s => s.groupIds.some(id => ids.has(id))));
  xlSeancesHelp(wb, session, `Séances de tous les groupes du semestre ${sem}.`);
  return xlDownload(wb, xlFileName(session, `semestre-${sem}`));
}

function xlExportTeacherView() {
  const session = getCurrentSession();
  const teacher = session.teachers.find(t => t.id === document.getElementById("teacherViewSelect").value);
  if (!teacher) { alert("Sélectionnez d'abord un enseignant."); return; }
  const wb = xlNewWorkbook();
  const spec = teacherDocSpec(session, teacher);
  xlAddGridSheet(wb, session, spec, `Planning ${teacher.name}`);
  xlAddSeancesSheet(wb, session, session.seances.filter(spec.filterFn));
  xlAddAvailabilitySheet(wb, session, teacher);
  xlSeancesHelp(wb, session, "Séances de l'enseignant ; la feuille « Disponibilités » est aussi réimportable.");
  return xlDownload(wb, xlFileName(session, `enseignant-${teacher.name}`));
}

function xlExportRoomView() {
  const session = getCurrentSession();
  const room = session.rooms.find(r => r.id === document.getElementById("roomViewSelect").value);
  if (!room) { alert("Sélectionnez d'abord une salle."); return; }
  const wb = xlNewWorkbook();
  const spec = roomDocSpec(session, room);
  xlAddGridSheet(wb, session, spec, `Planning ${room.name}`);
  xlAddSeancesSheet(wb, session, session.seances.filter(spec.filterFn));
  xlAddRoomAvailabilitySheet(wb, session, room);
  xlSeancesHelp(wb, session, "Séances de la salle ; la feuille « Disponibilités » est aussi réimportable.");
  return xlDownload(wb, xlFileName(session, `salle-${room.name}`));
}

function xlConflictRows(session) {
  const typeLabels = { teacher: "Conflit enseignant", room: "Conflit salle", group: "Conflit groupe", capacity: "Capacité dépassée", availability: "Indisponibilité enseignant", roomAvailability: "Indisponibilité salle", educationalAction: "Actions éducatives", moduleTeacher: "Conflit d'affectation", teacherCrossSession: "Conflit enseignant entre filières", roomCrossSession: "Conflit salle entre filières", roomPool: "Salle hors pool autorisé", volumeMismatch: "Volume horaire", outOfBounds: "Hors grille horaire", defaultRoomCapacity: "Salle par défaut trop petite" };
  return computeConflicts(session).map(c => ({
    type: typeLabels[c.type] || c.type, message: c.message, detail: c.detail,
    seances: c.seanceIds.map(id => {
      const s = session.seances.find(x => x.id === id);
      if (!s) return "";
      const m = session.modules.find(x => x.id === s.moduleId);
      return `${m ? m.name : "?"} (${s.day} #${s.startSlotIndex + 1})`;
    }).filter(Boolean).join(" / "),
  }));
}

function xlExportConflicts() {
  const session = getCurrentSession();
  const wb = xlNewWorkbook();
  const rows = xlConflictRows(session);
  const ws = xlAddDataSheet(wb, { name: "Conflits", cols: [
    { key: "type", header: "Type", width: 28 }, { key: "message", header: "Problème", width: 44 },
    { key: "detail", header: "Détail", width: 80 }, { key: "seances", header: "Séances concernées", width: 60 },
  ] }, rows);
  if (!rows.length) { ws.getCell(2, 1).value = "Aucun conflit détecté ✔"; ws.getCell(2, 1).font = { bold: true, color: { argb: XL.okText } }; }
  else rows.forEach((_, i) => { ws.getCell(i + 2, 1).font = { bold: true, color: { argb: XL.koText } }; });
  return xlDownload(wb, xlFileName(session, "conflits"));
}

function xlExportDashboard() {
  const session = getCurrentSession();
  const wb = xlNewWorkbook();
  const conflicts = computeConflicts(session);
  const totalCells = session.config.days.length * session.config.slots.length;

  xlAddDataSheet(wb, { name: "Synthèse", cols: [{ key: "k", header: "Indicateur", width: 34 }, { key: "v", header: "Valeur", width: 40 }] }, [
    { k: "Session", v: session.label }, { k: "Année universitaire", v: session.annee || "" },
    { k: "Groupes", v: session.groups.length }, { k: "Enseignants", v: session.teachers.length },
    { k: "Salles", v: session.rooms.length }, { k: "Modules", v: session.modules.length },
    { k: "Séances planifiées", v: session.seances.length }, { k: "Conflits actifs", v: conflicts.length },
    { k: "Affectations incomplètes (groupes sans enseignant)", v: computeAffectationIssues(session).filter(i => i.level === "error").reduce((n, i) => n + (i.count || 1), 0) },
  ]);

  xlAddDataSheet(wb, { name: "Charge enseignants", cols: [
    { key: "name", header: "Enseignant", width: 30 }, { key: "n", header: "Nb séances", width: 14 },
    { key: "h", header: "Heures / semaine", width: 18 }, { key: "g", header: "Groupes", width: 50 },
    { key: "ag", header: "Groupes affectés (modules)", width: 26 },
  ] }, session.teachers.map(t => {
    const mine = session.seances.filter(s => s.teacherId === t.id);
    const gs = new Set();
    mine.forEach(s => s.groupIds.forEach(id => { const g = session.groups.find(x => x.id === id); if (g) gs.add(g.name); }));
    return { name: t.name, n: mine.length, h: Math.round(mine.reduce((a, s) => a + seanceMinutes(session, s), 0) / 60 * 100) / 100, g: Array.from(gs).join("; "),
      ag: (session.affectations || []).filter(a => a.teacherId === t.id).reduce((n, a) => n + a.groupIds.length, 0) };
  }));

  const wsRooms = xlAddDataSheet(wb, { name: "Occupation salles", cols: [
    { key: "name", header: "Salle", width: 26 }, { key: "cap", header: "Capacité", width: 12 }, { key: "type", header: "Type", width: 16 },
    { key: "n", header: "Nb séances", width: 14 }, { key: "occ", header: "Créneaux occupés", width: 18 }, { key: "rate", header: "Taux d'occupation", width: 18 },
  ] }, session.rooms.map(r => {
    const mine = session.seances.filter(s => s.roomId === r.id);
    const occupied = new Set();
    mine.forEach(s => { for (let i = s.startSlotIndex; i < s.startSlotIndex + s.duration; i++) occupied.add(s.day + "|" + i); });
    return { name: r.name, cap: r.capacity, type: r.type === "amphi" ? "Amphithéâtre" : "Salle", n: mine.length, occ: occupied.size, rate: totalCells ? occupied.size / totalCells : 0 };
  }));
  wsRooms.getColumn(6).numFmt = "0%";

  xlAddDataSheet(wb, { name: "Groupes", cols: [
    { key: "name", header: "Groupe", width: 26 }, { key: "sem", header: "Semestre", width: 12 }, { key: "eff", header: "Effectif", width: 12 },
    { key: "n", header: "Nb séances", width: 14 }, { key: "h", header: "Heures / semaine", width: 18 },
  ] }, session.groups.map(g => {
    const mine = session.seances.filter(s => s.groupIds.includes(g.id));
    return { name: g.name, sem: g.semestre, eff: g.effectif, n: mine.length, h: Math.round(mine.reduce((a, s) => a + seanceMinutes(session, s), 0) / 60 * 100) / 100 };
  }));

  const rows = xlConflictRows(session);
  xlAddDataSheet(wb, { name: "Conflits", cols: [
    { key: "type", header: "Type", width: 28 }, { key: "message", header: "Problème", width: 44 }, { key: "detail", header: "Détail", width: 80 },
  ] }, rows);
  return xlDownload(wb, xlFileName(session, "synthese"));
}

function xlExportAll(template = false) {
  const session = getCurrentSession();
  const wb = xlNewWorkbook();
  const empty = template ? { ...session, groups: [], rooms: [], teachers: [], modules: [], seances: [], affectations: [] } : session;

  xlAddDataSheet(wb, XL_SHEETS.header, [
    { field: "Nom de session", value: session.label || "" },
    { field: "Type de session", value: session.typeSession || "Printemps" },
    { field: "Statut", value: session.statut === "final" ? "Final" : "Provisoire" },
    { field: "Année universitaire", value: session.annee || "" },
    { field: "Filière", value: session.filiere || "" },
    { field: "Option", value: session.option || "" },
    { field: "Début des cours", value: session.startDate || "" },
  ]);
  xlAddDataSheet(wb, XL_SHEETS.sessions, template ? [] : STATE.sessions.map(s => ({
    label: s.label || "", annee: s.annee || "", type: s.typeSession || "",
    statut: s.statut === "final" ? "Final" : "Provisoire", active: s.id === STATE.currentSessionId ? "Oui" : "Non",
  })));
  xlAddDataSheet(wb, XL_SHEETS.days, XL_ALL_DAYS.map(d => ({ day: d, active: session.config.days.includes(d) ? "Oui" : "Non" })));
  const wsSlots = xlAddDataSheet(wb, XL_SHEETS.slots, session.config.slots.map(s => ({ label: s.label, start: s.start, end: s.end })));
  wsSlots.getColumn(2).numFmt = "@"; wsSlots.getColumn(3).numFmt = "@";
  ["groups", "rooms", "teachers", "modules"].forEach(k => xlAddDataSheet(wb, XL_SHEETS[k], xlListRows(empty, k), { minRows: 40 }));
  xlAddDataSheet(wb, XL_SHEETS.affectations, xlAffectationRows(empty), { minRows: 40 });
  xlAddSeancesSheet(wb, session, empty.seances);
  xlAddHelpSheet(wb, "Mode d'emploi — classeur complet de la session", [
    ["Contenu", "En-tête, Jours, Créneaux, Groupes, Salles, Enseignants, Modules, Affectations (module → enseignant → groupes) et Séances de la session."],
    ["Import", "Deux modes : « Fusionner » (mise à jour par nom + ajout) ou « Remplacer » (les feuilles présentes remplacent les données de la session)."],
    ["Feuilles optionnelles", "Une feuille absente du fichier n'est pas touchée."],
    ["Séances", "Voir la feuille « Séances » : une ligne = une séance ; groupes multiples séparés par « ; »."],
  ]);
  return xlDownload(wb, xlFileName(session, template ? "modele-complet" : "session-complete"));
}

/* ============================================================
   IMPORTS
   ============================================================ */

/* ---------- En-tête / jours / créneaux ---------- */
function xlImportSessions(session, table, rep) {
  const sec = xlSection(rep, "Sessions");
  table.rows.forEach(r => {
    const label = r.text("label").trim();
    if (!label) { sec.skipped++; return; }
    const target = (STATE.sessions || []).find(s => s.label === label) ||
      (xlNorm(r.text("active")) === "oui" ? session : null);
    if (!target) {
      rep.warnings.push(`Sessions, ligne ${r.line} : « ${label} » existe dans le fichier mais aucune session correspondante n'est ouverte.`);
      sec.skipped++;
      return;
    }
    target.label = label;
    if (table.has("annee")) target.annee = r.text("annee") || target.annee;
    if (table.has("type")) target.typeSession = r.text("type") || target.typeSession;
    if (table.has("statut")) target.statut = /final|valide/i.test(r.text("statut")) ? "final" : "provisoire";
    if (xlNorm(r.text("active")) === "oui") STATE.currentSessionId = target.id;
    sec.updated++;
  });
}

function xlImportHeader(session, table, rep) {
  const sec = xlSection(rep, "En-tête");
  table.rows.forEach(r => {
    const f = xlNorm(r.text("field")), v = r.text("value");
    if (f === "nom de session" || f === "session") {
      if (v.trim()) session.label = v.trim();
    } else if (f === "type de session") {
      const n = xlNorm(v);
      if (n === "automne") session.typeSession = "Automne";
      else if (n === "printemps") session.typeSession = "Printemps";
      else { rep.warnings.push(`En-tête : type de session « ${v} » ignoré (Automne ou Printemps attendu).`); return; }
    } else if (f === "statut") {
      session.statut = /final|valide/.test(xlNorm(v)) ? "final" : "provisoire";
    } else if (f === "annee universitaire" || f === "annee") session.annee = v;
    else if (f === "filiere") session.filiere = v;
    else if (f === "option") session.option = v;
    else if (f === "debut des cours" || f === "date de debut des cours") session.startDate = v;
    else { sec.skipped++; return; }
    sec.updated++;
  });
}

function xlImportDays(session, table, rep) {
  const sec = xlSection(rep, "Jours");
  const active = [];
  table.rows.forEach(r => {
    const day = XL_ALL_DAYS.find(d => xlNorm(d) === xlNorm(r.text("day")));
    if (!day) { rep.warnings.push(`Jours, ligne ${r.line} : « ${r.text("day")} » n'est pas un jour valide.`); sec.skipped++; return; }
    const on = table.has("active") ? ["oui", "o", "yes", "y", "true", "vrai", "1", "x", "actif"].includes(xlNorm(r.text("active"))) : true;
    if (on && !active.includes(day)) active.push(day);
  });
  if (!active.length) { rep.errors.push("Jours : aucun jour actif dans le fichier, configuration conservée."); return; }
  active.sort((a, b) => XL_ALL_DAYS.indexOf(a) - XL_ALL_DAYS.indexOf(b));
  const orphan = session.seances.filter(s => !active.includes(s.day)).length;
  if (orphan) rep.warnings.push(`${orphan} séance(s) sont placées sur un jour devenu inactif.`);
  session.config.days = active;
  sec.updated = active.length;
}

function xlImportSlots(session, table, rep) {
  const sec = xlSection(rep, "Créneaux");
  const list = [];
  table.rows.forEach(r => {
    const start = xlTime(r.raw("start")), end = xlTime(r.raw("end"));
    if (!start || !end || hhmmToMinutes(end) <= hhmmToMinutes(start)) {
      rep.errors.push(`Créneaux, ligne ${r.line} : heures invalides (début « ${r.text("start")} », fin « ${r.text("end")} »).`);
      sec.skipped++;
      return;
    }
    const old = session.config.slots[list.length];
    list.push({ id: old ? old.id : uid("slot"), label: r.text("label") || `${start} - ${end}`, start, end });
  });
  if (!list.length) { rep.errors.push("Créneaux : aucun créneau valide, configuration conservée."); return; }
  const orphan = session.seances.filter(s => s.startSlotIndex + s.duration > list.length).length;
  if (orphan) rep.warnings.push(`${orphan} séance(s) dépassent désormais le nombre de créneaux (${list.length}).`);
  session.config.slots = list;
  sec.updated = list.length;
}

/* ---------- Ressources ---------- */
function xlImportRooms(session, table, rep) {
  const sec = xlSection(rep, "Salles");
  const idx = xlIndexByName(session.rooms);
  table.rows.forEach(r => {
    const name = r.text("name");
    if (!name) { sec.skipped++; return; }
    let cap = table.has("capacity") ? xlNumber(r.raw("capacity")) : NaN;
    if (table.has("capacity") && r.text("capacity") && isNaN(cap)) rep.warnings.push(`Salles, ligne ${r.line} : capacité « ${r.text("capacity")} » invalide.`);
    const typeTxt = xlNorm(r.text("type"));
    const type = typeTxt ? (typeTxt.includes("amphi") ? "amphi" : "salle") : null;
    let room = idx.get(xlNorm(name));
    if (room) {
      if (!isNaN(cap)) room.capacity = cap;
      if (type) room.type = type;
      if (table.has("unavailable")) room.unavailable = xlParseUnavailability(session, r.text("unavailable"), rep, name, "Salles");
      sec.updated++;
    } else {
      room = { id: uid("r"), name, capacity: isNaN(cap) ? 40 : cap, type: type || "salle", unavailable: [] };
      if (table.has("unavailable")) room.unavailable = xlParseUnavailability(session, r.text("unavailable"), rep, name, "Salles");
      session.rooms.push(room);
      idx.set(xlNorm(name), room);
      sec.added++;
    }
  });
}

function xlParseUnavailability(session, text, rep, who, category = "Enseignants") {
  const { days, slots } = session.config;
  const keys = new Set();
  xlSplitList(text.replace(/,/g, ";")).forEach(tok => {
    const t = xlNorm(tok);
    const day = days.find(d => t.startsWith(xlNorm(d)));
    if (!day) { rep.warnings.push(`${category} (${who}) : « ${tok} » ignoré, jour inconnu ou non actif.`); return; }
    const rest = t.slice(xlNorm(day).length).replace(/[()]/g, " ").replace(/creneau|n°|no\b|#/g, " ").replace(/\s+/g, " ").trim();
    if (!rest || /toute|journee|jour entier|all/.test(rest)) { slots.forEach((_, i) => keys.add(availabilityKey(day, i))); return; }
    let i = -1;
    if (/^\d+$/.test(rest)) i = Number(rest) - 1;
    else {
      i = slots.findIndex(s => xlNorm(s.label) === rest);
      if (i < 0) { const tm = xlTime(rest.split(/[\s-]+/)[0]); if (tm) i = slots.findIndex(s => s.start === tm); }
    }
    if (i < 0 || i >= slots.length) rep.warnings.push(`${category} (${who}) : créneau « ${tok} » introuvable.`);
    else keys.add(availabilityKey(day, i));
  });
  return Array.from(keys);
}

function xlImportTeachers(session, table, rep) {
  const sec = xlSection(rep, "Enseignants");
  const idx = xlIndexByName(session.teachers);
  table.rows.forEach(r => {
    const name = r.text("name");
    if (!name) { sec.skipped++; return; }
    let t = idx.get(xlNorm(name));
    const isNew = !t;
    if (isNew) { t = { id: uid("t"), name, unavailable: [], moduleIds: [], allModules: true }; session.teachers.push(t); idx.set(xlNorm(name), t); }
    if (table.has("unavailable")) t.unavailable = xlParseUnavailability(session, r.text("unavailable"), rep, name);
    if (table.has("allmodules")) t.allModules = /^(oui|yes|true|1|tous)/i.test(xlNorm(r.text("allmodules")));
    if (table.has("modules") && !t.allModules) {
      t.moduleIds = xlSplitList(r.text("modules")).map(moduleName => {
        const module = session.modules.find(m => xlNorm(m.name) === xlNorm(moduleName));
        if (!module && xlNorm(moduleName) !== "tous les modules") rep.warnings.push(`Enseignants (${name}) : module « ${moduleName} » inconnu (ignoré).`);
        return module?.id;
      }).filter(Boolean);
    }
    if (table.has("groupcounts")) {
      const counts = {};
      xlSplitList(r.text("groupcounts")).forEach(entry => {
        const splitAt = entry.lastIndexOf("=");
        if (splitAt < 1) {
          rep.warnings.push(`Enseignants (${name}) : quota « ${entry} » invalide (format attendu : Module=nombre).`);
          return;
        }
        const moduleName = entry.slice(0, splitAt).trim();
        const rawCount = entry.slice(splitAt + 1).trim();
        const module = session.modules.find(m => xlNorm(m.name) === xlNorm(moduleName));
        const parsedCount = Number(rawCount);
        if (!module || !Number.isInteger(parsedCount) || parsedCount < 0) {
          rep.warnings.push(`Enseignants (${name}) : quota de groupes pour « ${moduleName} » invalide ou module inconnu (ignoré).`);
          return;
        }
        const semesterCount = session.groups.filter(g => !module.semestre || g.semestre === module.semestre).length;
        const maximum = (module.groupIds || []).length || semesterCount;
        counts[module.id] = Math.min(maximum, parsedCount);
      });
      t.moduleGroupCounts = counts;
    }
    if (isNew) sec.added++; else sec.updated++;
  });
}

function xlImportModules(session, table, rep) {
  const sec = xlSection(rep, "Modules");
  const idx = xlIndexByName(session.modules);
  const groupIdx = xlIndexByName(session.groups);
  table.rows.forEach(r => {
    const name = r.text("name");
    if (!name) { sec.skipped++; return; }
    const vol = table.has("volume") ? xlNumber(r.raw("volume")) : NaN;
    if (table.has("volume") && r.text("volume") && isNaN(vol)) rep.warnings.push(`Modules, ligne ${r.line} : volume horaire « ${r.text("volume")} » invalide.`);
    let m = idx.get(xlNorm(name));
    if (m) {
      if (table.has("semestre")) m.semestre = r.text("semestre");
      if (!isNaN(vol)) m.volumeHoraire = vol;
      if (table.has("nature")) m.nature = xlNorm(r.text("nature")).startsWith("trans") ? "transversal" : "metier";
      sec.updated++;
    } else {
      m = { id: uid("m"), name, semestre: r.text("semestre"), volumeHoraire: isNaN(vol) ? 1.5 : vol,
        nature: table.has("nature") && xlNorm(r.text("nature")).startsWith("trans") ? "transversal" : "metier", groupIds: [] };
      session.modules.push(m);
      idx.set(xlNorm(name), m);
      sec.added++;
    }
    if (table.has("groups")) {
      const ids = [];
      xlSplitList(r.text("groups")).forEach(n => {
        const g = groupIdx.get(xlNorm(n));
        if (g) ids.push(g.id);
        else rep.warnings.push(`Modules, ligne ${r.line} : groupe « ${n} » inconnu (ignoré). Importez d'abord les groupes.`);
      });
      m.groupIds = ids;
    }
  });
}

function xlImportGroups(session, table, rep) {
  const sec = xlSection(rep, "Groupes");
  const idx = xlIndexByName(session.groups);
  const rooms = xlIndexByName(session.rooms);
  table.rows.forEach(r => {
    const name = r.text("name");
    if (!name) { sec.skipped++; return; }
    const eff = table.has("effectif") ? xlNumber(r.raw("effectif")) : NaN;
    if (table.has("effectif") && r.text("effectif") && isNaN(eff)) rep.warnings.push(`Groupes, ligne ${r.line} : effectif « ${r.text("effectif")} » invalide.`);
    let roomId = null;
    const roomName = r.text("room");
    if (roomName) {
      const room = rooms.get(xlNorm(roomName));
      if (room) roomId = room.id;
      else rep.warnings.push(`Groupes, ligne ${r.line} : salle « ${roomName} » inconnue (ignorée). Importez d'abord les salles.`);
    }
    let g = idx.get(xlNorm(name));
    if (g) {
      if (table.has("semestre")) g.semestre = r.text("semestre");
      if (!isNaN(eff)) g.effectif = eff;
      if (roomId) g.defaultRoomId = roomId;
      if (table.has("actionday")) g.educationalActionDay = session.config.days.includes(r.text("actionday")) ? r.text("actionday") : "";
      if (table.has("actionlabel") && r.text("actionlabel")) g.educationalActionLabel = normalizeEducationalActionLabel(r.text("actionlabel"));
      sec.updated++;
    } else {
      g = { id: uid("g"), name, semestre: r.text("semestre"), effectif: isNaN(eff) ? 30 : eff, defaultRoomId: roomId || (session.rooms[0] ? session.rooms[0].id : ""),
        educationalActionDay: table.has("actionday") && session.config.days.includes(r.text("actionday")) ? r.text("actionday") : "",
        educationalActionLabel: table.has("actionlabel") && r.text("actionlabel") ? normalizeEducationalActionLabel(r.text("actionlabel")) : DEFAULT_EDUCATIONAL_ACTION_LABEL };
      session.groups.push(g);
      idx.set(xlNorm(name), g);
      sec.added++;
    }
  });
}

/* ---------- Disponibilités (feuille de la vue enseignant / salle) ---------- */
function xlImportAvailability(session, wb, teacher, rep) {
  return xlImportAvailabilityGeneric(session, wb, rep, `Disponibilités de ${teacher.name}`, keys => { teacher.unavailable = keys; });
}

function xlImportRoomAvailability(session, wb, room, rep) {
  return xlImportAvailabilityGeneric(session, wb, rep, `Disponibilités de ${room.name}`, keys => { room.unavailable = keys; });
}

function xlImportAvailabilityGeneric(session, wb, rep, sectionLabel, applyKeys) {
  const ws = wb.worksheets.find(w => xlNorm(w.name) === "disponibilites");
  if (!ws) return false;
  const sec = xlSection(rep, sectionLabel);
  const keys = [];
  let seen = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const day = xlDay(session, xlCellText(ws.getCell(r, 1).value));
    if (!day) continue;
    for (let i = 0; i < session.config.slots.length; i++) {
      const t = xlNorm(xlCellText(ws.getCell(r, i + 2).value));
      if (!t) continue;
      seen++;
      if (t.startsWith("indispo") || ["non", "x", "ko", "0"].includes(t)) keys.push(availabilityKey(day, i));
    }
  }
  if (!seen) { rep.warnings.push("Feuille « Disponibilités » vide ou non reconnue : disponibilités inchangées."); return false; }
  applyKeys(keys);
  sec.updated = keys.length;
  return true;
}

/* ---------- Séances ---------- */
/**
 * o = { createMissing, mode: "add"|"replace", replaceFilter(seance)->bool,
 *       defaults: { groupNames:[], teacherName, roomName } }
 */
function xlImportSeances(session, table, rep, o) {
  const sec = xlSection(rep, "Séances");
  const slots = session.config.slots;
  const idx = {
    modules: xlIndexByName(session.modules), teachers: xlIndexByName(session.teachers),
    rooms: xlIndexByName(session.rooms), groups: xlIndexByName(session.groups),
  };
  const labels = { modules: "Module", teachers: "Enseignant", rooms: "Salle", groups: "Groupe" };
  const make = {
    modules: n => ({ id: uid("m"), name: n, semestre: "", volumeHoraire: 1.5, nature: "metier", groupIds: [] }),
    teachers: n => ({ id: uid("t"), name: n, unavailable: [] }),
    rooms: n => ({ id: uid("r"), name: n, capacity: 40, type: "salle" }),
    groups: n => ({ id: uid("g"), name: n, semestre: "", effectif: 30, defaultRoomId: session.rooms[0] ? session.rooms[0].id : "" }),
  };
  const resolve = (kind, name) => {
    const key = xlNorm(name);
    let item = idx[kind].get(key);
    if (!item && o.createMissing) {
      item = make[kind](name);
      session[kind].push(item);
      idx[kind].set(key, item);
      rep.created.push(`${labels[kind]} « ${name} »`);
    }
    return item;
  };
  const colorOfModule = (moduleId) => {
    const other = session.seances.find(s => s.moduleId === moduleId && s.color);
    if (other) return other.color;
    const h = Array.from(moduleId).reduce((a, c) => a + c.charCodeAt(0), 0);
    return XL_PALETTE[h % XL_PALETTE.length];
  };

  const pending = [];
  table.rows.forEach(r => {
    const where = `Séances, ligne ${r.line}`;
    const modName = r.text("module");
    if (!modName) { rep.errors.push(`${where} : module manquant.`); sec.skipped++; return; }
    const day = xlDay(session, r.text("day"));
    if (!day) { rep.errors.push(`${where} : jour « ${r.text("day")} » inconnu ou non actif (jours actifs : ${session.config.days.join(", ")}).`); sec.skipped++; return; }
    const start = xlSlotIndex(session, r.raw("start"));
    if (start < 0) { rep.errors.push(`${where} : créneau de début « ${r.text("start")} » invalide (1 à ${slots.length}).`); sec.skipped++; return; }
    let dur = table.has("duration") ? xlNumber(r.raw("duration")) : 1;
    if (isNaN(dur) || dur < 1) dur = 1;
    dur = Math.round(dur);
    if (start + dur > slots.length) {
      rep.warnings.push(`${where} : durée réduite à ${slots.length - start} créneau(x) (dépasse la fin de journée).`);
      dur = slots.length - start;
    }
    let groupNames = xlSplitList(r.text("groups"));
    if (!groupNames.length) groupNames = (o.defaults && o.defaults.groupNames) || [];
    if (!groupNames.length) { rep.errors.push(`${where} : aucun groupe indiqué.`); sec.skipped++; return; }
    const teacherName = r.text("teacher") || (o.defaults && o.defaults.teacherName) || "";
    const roomName = r.text("room") || (o.defaults && o.defaults.roomName) || "";

    const mod = resolve("modules", modName);
    const teacher = teacherName ? resolve("teachers", teacherName) : null;
    const room = roomName ? resolve("rooms", roomName) : null;
    const groups = groupNames.map(n => resolve("groups", n));
    const missing = [];
    if (!mod) missing.push(`module « ${modName} »`);
    if (teacherName && !teacher) missing.push(`enseignant « ${teacherName} »`);
    if (roomName && !room) missing.push(`salle « ${roomName} »`);
    groups.forEach((g, i) => { if (!g) missing.push(`groupe « ${groupNames[i]} »`); });
    if (missing.length) { rep.errors.push(`${where} : ${missing.join(", ")} introuvable(s).`); sec.skipped++; return; }

    pending.push({
      id: uid("se"), moduleId: mod.id, teacherId: teacher ? teacher.id : "", groupIds: groups.map(g => g.id),
      roomId: room ? room.id : "", day, startSlotIndex: start, duration: dur,
      color: xlParseColor(r.text("color")) || colorOfModule(mod.id),
    });
  });

  if (o.mode === "replace" && o.replaceFilter) {
    const before = session.seances.length;
    session.seances = session.seances.filter(s => !o.replaceFilter(s));
    const removed = before - session.seances.length;
    if (removed) rep.warnings.push(`${removed} séance(s) existante(s) remplacée(s).`);
  }

  const sig = s => [s.moduleId, s.teacherId, s.groupIds.slice().sort().join(","), s.roomId, s.day, s.startSlotIndex, s.duration].join("|");
  const known = new Set(session.seances.map(sig));
  pending.forEach(s => {
    if (known.has(sig(s))) { sec.skipped++; return; }
    known.add(sig(s));
    session.seances.push(s);
    sec.added++;
  });
}

/** Après un remplacement de ressources : retire des séances les références orphelines. */
function xlCleanupSeances(session, rep) {
  const groupIds = new Set(session.groups.map(g => g.id));
  const before = session.seances.length;
  session.seances.forEach(s => { s.groupIds = s.groupIds.filter(id => groupIds.has(id)); });
  session.seances = session.seances.filter(s => s.groupIds.length > 0);
  cleanAffectations(session);
  if (session.seances.length < before) rep.warnings.push(`${before - session.seances.length} séance(s) supprimée(s) : leur groupe n'existe plus.`);
}

/* ---------- Affectations : module → enseignant → nombre de groupes ---------- */
function xlAffectationRows(session) {
  const modOrder = new Map(session.modules.map((m, i) => [m.id, i]));
  return (session.affectations || []).slice()
    .sort((a, b) => (modOrder.get(a.moduleId) || 0) - (modOrder.get(b.moduleId) || 0))
    .map(a => ({
      module: (session.modules.find(m => m.id === a.moduleId) || {}).name || "",
      teacher: (session.teachers.find(t => t.id === a.teacherId) || {}).name || "",
      count: a.groupCount || 0,
      groups: affGroupNames(session, a.groupIds).join("; "),
    }));
}

function xlExportAffectations(template = false) {
  const session = getCurrentSession();
  const wb = xlNewWorkbook();
  const ws = xlAddDataSheet(wb, XL_SHEETS.affectations, template ? [] : xlAffectationRows(session), { minRows: 80 });
  const counts = xlAddListsSheet(wb, session);
  const warnList = ref => ({ type: "list", allowBlank: true, formulae: [ref], showErrorMessage: true, errorStyle: "warning",
    errorTitle: "Valeur inconnue", error: "Cette valeur n'existe pas encore : elle sera créée à l'import si l'option est activée." });
  for (let r = 2; r <= 80; r++) {
    if (counts[0]) ws.getCell(r, 1).dataValidation = warnList(`Listes!$A$2:$A$${counts[0] + 1}`);
    if (counts[1]) ws.getCell(r, 2).dataValidation = warnList(`Listes!$B$2:$B$${counts[1] + 1}`);
  }
  xlAddHelpSheet(wb, "Mode d'emploi — Affectations", [
    ["Principe", "Une ligne = un couple enseignant–module. La colonne « Groupe(s) attribué(s) » permet de sélectionner précisément les groupes pris en charge par cet enseignant. Le nombre de groupes est recalculé à partir de cette liste."],
    ["Module", "Nom du module (doit exister, ou sera créé si l'option est activée)."],
    ["Enseignant", "Nom de l'enseignant."],
    ["Nb groupes demandé", "Nombre de groupes que cet enseignant doit prendre en charge pour ce module (ex : 3). Pour un module transversal, minimum 2."],
    ["Groupe(s) attribué(s)", "Indiquez les groupes pris en charge par cet enseignant, séparés par « ; » (ex : « Groupe 1; Groupe 2 »). Cette répartition est conservée telle quelle lors de l'import."],
    ["Plusieurs enseignants", "Répétez le module sur plusieurs lignes, une par enseignant."],
    ["Règle", "Si des groupes précis sont indiqués, un groupe n'a qu'un seul enseignant par module : s'il apparaît chez deux enseignants, la dernière ligne l'emporte (avertissement dans le rapport)."],
    ["Groupes du module", "Les groupes précis cités (colonne « Groupe(s) attribué(s) ») sont automatiquement ajoutés aux « groupes concernés » du module."],
  ]);
  return xlDownload(wb, xlFileName(session, template ? "modele-affectations" : "affectations"));
}

/** o = { mode: "add"|"replace", createMissing } */
function xlImportAffectations(session, table, rep, o) {
  const sec = xlSection(rep, "Affectations");
  const idx = { modules: xlIndexByName(session.modules), teachers: xlIndexByName(session.teachers), groups: xlIndexByName(session.groups) };
  const labels = { modules: "Module", teachers: "Enseignant", groups: "Groupe" };
  const make = {
    modules: n => ({ id: uid("m"), name: n, semestre: "", volumeHoraire: 1.5, nature: "metier", groupIds: [] }),
    teachers: n => ({ id: uid("t"), name: n, unavailable: [] }),
    groups: n => ({ id: uid("g"), name: n, semestre: "", effectif: 30, defaultRoomId: session.rooms[0] ? session.rooms[0].id : "" }),
  };
  const resolve = (kind, name) => {
    const key = xlNorm(name);
    let item = idx[kind].get(key);
    if (!item && o.createMissing) {
      item = make[kind](name);
      session[kind].push(item);
      idx[kind].set(key, item);
      rep.created.push(`${labels[kind]} « ${name} »`);
    }
    return item;
  };
  if (!Array.isArray(session.affectations)) session.affectations = [];
  if (o.mode === "replace") session.affectations = [];
  const touched = new Set();

  table.rows.forEach(r => {
    const where = `Affectations, ligne ${r.line}`;
    const modName = r.text("module"), teacherName = r.text("teacher");
    const groupNames = xlSplitList(r.text("groups"));
    const countRaw = r.text("count");
    const count = countRaw === "" || countRaw === undefined ? null : Number(countRaw);
    if (!modName || !teacherName) { rep.errors.push(`${where} : module ou enseignant manquant.`); sec.skipped++; return; }
    if (!groupNames.length && !(count > 0)) { rep.errors.push(`${where} : indiquez soit un nombre de groupes, soit les groupes précis.`); sec.skipped++; return; }
    const mod = resolve("modules", modName), teacher = resolve("teachers", teacherName);
    const missing = [];
    if (!mod) missing.push(`module « ${modName} »`);
    if (!teacher) missing.push(`enseignant « ${teacherName} »`);
    if (missing.length) { rep.errors.push(`${where} : ${missing.join(", ")} introuvable(s).`); sec.skipped++; return; }

    let ids = null; // null = groupes non précisés (à répartir automatiquement)
    if (groupNames.length) {
      const groups = groupNames.map(n => resolve("groups", n));
      const groupsMissing = [];
      groups.forEach((g, i) => { if (!g) groupsMissing.push(`groupe « ${groupNames[i]} »`); });
      if (groupsMissing.length) { rep.errors.push(`${where} : ${groupsMissing.join(", ")} introuvable(s).`); sec.skipped++; return; }
      mod.groupIds = mod.groupIds || [];
      ids = Array.from(new Set(groups.map(g => g.id)));
      ids.forEach(id => { if (!mod.groupIds.includes(id)) mod.groupIds.push(id); });

      session.affectations.filter(a => a.moduleId === mod.id && a.teacherId !== teacher.id).forEach(a => {
        const before = a.groupIds.length;
        a.groupIds = a.groupIds.filter(id => !ids.includes(id));
        if (a.groupIds.length < before) {
          a.groupCount = a.groupIds.length;
          const who = (session.teachers.find(t => t.id === a.teacherId) || {}).name || "?";
          rep.warnings.push(`${where} : groupe(s) retiré(s) à ${who} pour « ${mod.name} » (un groupe n'a qu'un enseignant par module).`);
        }
      });
    }

    const key = mod.id + "|" + teacher.id;
    let aff = session.affectations.find(a => a.moduleId === mod.id && a.teacherId === teacher.id);
    if (aff && touched.has(key)) {
      // 2e ligne du fichier pour le même couple : on cumule
      if (ids) aff.groupIds = Array.from(new Set([...aff.groupIds, ...ids]));
      aff.groupCount = ids ? aff.groupIds.length : (aff.groupCount || 0) + (count || 0);
    } else if (aff) {
      if (ids) { aff.groupIds = ids; aff.groupCount = ids.length; }
      else aff.groupCount = count > 0 ? count : aff.groupCount;
      sec.updated++;
    } else {
      const groupIds = ids || [];
      const groupCount = ids ? ids.length : count;
      session.affectations.push({ id: uid("af"), moduleId: mod.id, teacherId: teacher.id, groupCount, groupIds });
      sec.added++;
    }
    touched.add(key);
  });
}

/* ============================================================
   Importeurs par module : probe(wb, ctx) / options(ctx) / apply(session, wb, values, rep, ctx)
   ============================================================ */
const XL_MODE_FIELD = (label) => ({
  id: "mode", label: "Mode d'import", type: "select",
  options: [["add", "Ajouter (les doublons sont ignorés)"], ["replace", label]],
});
const XL_CREATE_FIELD = {
  id: "create", label: "Ressources inconnues (module, enseignant, salle, groupe)", type: "select",
  options: [["yes", "Les créer automatiquement"], ["no", "Refuser la ligne concernée"]],
};

function xlListImporter(key, fn) {
  return {
    probe(wb) {
      const t = xlFindTable(wb, XL_SHEETS[key]);
      return t ? { ok: true, info: `${t.rows.length} ligne(s) dans la feuille « ${t.sheetName} »` }
        : { ok: false, message: `Aucun tableau « ${XL_LIST_LABEL[key]} » reconnu : la première ligne doit contenir les en-têtes (${XL_SHEETS[key].cols.map(c => c.header).join(", ")}).` };
    },
    options: () => [],
    apply(session, wb, values, rep) { fn(session, xlFindTable(wb, XL_SHEETS[key]), rep); },
  };
}

function xlSeancesImporter(scopeKey) {
  const groupNamesOf = (session, ids) => ids.map(id => (session.groups.find(g => g.id === id) || {}).name).filter(Boolean);
  const scope = (session, ctx) => {
    switch (scopeKey) {
      case "planning": {
        const g = session.groups.find(x => x.id === ctx.groupId);
        return { label: "les séances de ce groupe", defaults: { groupNames: g ? [g.name] : [] }, filter: s => s.groupIds.includes(ctx.groupId) };
      }
      case "semester": {
        const ids = new Set(session.groups.filter(g => g.semestre === ctx.semester).map(g => g.id));
        return { label: `les séances du semestre ${ctx.semester || ""}`, defaults: {}, filter: s => s.groupIds.some(id => ids.has(id)) };
      }
      case "teacher": {
        const t = session.teachers.find(x => x.id === ctx.teacherId);
        return { label: "les séances de cet enseignant", defaults: { teacherName: t ? t.name : "" }, filter: s => s.teacherId === ctx.teacherId };
      }
      case "room": {
        const r = session.rooms.find(x => x.id === ctx.roomId);
        return { label: "les séances de cette salle", defaults: { roomName: r ? r.name : "" }, filter: s => s.roomId === ctx.roomId };
      }
      default:
        return { label: "toutes les séances de la session", defaults: {}, filter: () => true };
    }
  };
  return {
    probe(wb) {
      const t = xlFindTable(wb, XL_SHEETS.seances);
      const hasAvail = (scopeKey === "teacher" || scopeKey === "room") && wb.worksheets.some(w => xlNorm(w.name) === "disponibilites");
      if (!t && !hasAvail) return { ok: false, message: "Aucune feuille « Séances » reconnue : la première ligne doit contenir les en-têtes Module, Enseignant, Groupe(s), Salle, Jour, Créneau début, Nb créneaux." };
      return { ok: true, info: `${t ? t.rows.length : 0} séance(s) trouvée(s)` + (hasAvail ? " + disponibilités" : "") };
    },
    options(ctx) {
      const s = scope(getCurrentSession(), ctx);
      return [XL_MODE_FIELD(`Remplacer ${s.label}`), XL_CREATE_FIELD];
    },
    apply(session, wb, values, rep, ctx) {
      const sc = scope(session, ctx);
      const table = xlFindTable(wb, XL_SHEETS.seances);
      if (table) {
        xlImportSeances(session, table, rep, {
          mode: values.mode, createMissing: values.create !== "no", replaceFilter: sc.filter, defaults: sc.defaults,
        });
      }
      if (scopeKey === "teacher") {
        const teacher = session.teachers.find(t => t.id === ctx.teacherId);
        if (teacher) xlImportAvailability(session, wb, teacher, rep);
      }
      if (scopeKey === "room") {
        const room = session.rooms.find(r => r.id === ctx.roomId);
        if (room) xlImportRoomAvailability(session, wb, room, rep);
      }
    },
  };
}

const XL_IMPORTER_AFFECT = {
  probe(wb) {
    const t = xlFindTable(wb, XL_SHEETS.affectations);
    return t ? { ok: true, info: `${t.rows.length} affectation(s) dans la feuille « ${t.sheetName} »` }
      : { ok: false, message: "Aucune feuille « Affectations » reconnue : la première ligne doit contenir les en-têtes Module, Enseignant, Groupe(s)." };
  },
  options: () => [{
    id: "mode", label: "Mode d'import", type: "select",
    options: [["add", "Ajouter / mettre à jour (par module + enseignant)"], ["replace", "Remplacer toutes les affectations de la session"]],
  }, XL_CREATE_FIELD],
  apply(session, wb, values, rep) {
    xlImportAffectations(session, xlFindTable(wb, XL_SHEETS.affectations), rep, { mode: values.mode, createMissing: values.create !== "no" });
  },
};

const XL_IMPORTER_CONFIG = {
  probe(wb) {
    const found = ["header", "days", "slots"].filter(k => xlFindTable(wb, XL_SHEETS[k], true));
    return found.length
      ? { ok: true, info: "feuilles reconnues : " + found.map(k => XL_SHEETS[k].name).join(", ") }
      : { ok: false, message: "Aucune feuille « En-tête », « Jours » ou « Créneaux » reconnue." };
  },
  options: () => [],
  apply(session, wb, values, rep) {
    const th = xlFindTable(wb, XL_SHEETS.header, true), td = xlFindTable(wb, XL_SHEETS.days, true), ts = xlFindTable(wb, XL_SHEETS.slots, true);
    if (th) xlImportHeader(session, th, rep);
    if (td) xlImportDays(session, td, rep);
    if (ts) xlImportSlots(session, ts, rep);
  },
};

const XL_IMPORTER_ALL = {
  probe(wb) {
    const found = Object.keys(XL_SHEETS).filter(k => xlFindTable(wb, XL_SHEETS[k], true));
    return found.length
      ? { ok: true, info: "feuilles reconnues : " + found.map(k => XL_SHEETS[k].name).join(", ") }
      : { ok: false, message: "Aucune feuille reconnue (En-tête, Jours, Créneaux, Groupes, Salles, Enseignants, Modules, Séances). Utilisez « Exporter » ou « Modèle » pour obtenir la bonne structure." };
  },
  options: () => [{
    id: "mode", label: "Mode d'import", type: "select",
    options: [["merge", "Fusionner avec la session (mise à jour par nom + ajouts)"], ["replace", "Remplacer les données des feuilles présentes"]],
  }],
  apply(session, wb, values, rep) {
    const T = {};
    Object.keys(XL_SHEETS).forEach(k => { T[k] = xlFindTable(wb, XL_SHEETS[k], true); });
    if (values.mode === "replace") {
      if (T.rooms) session.rooms = [];
      if (T.teachers) session.teachers = [];
      if (T.modules) session.modules = [];
      if (T.groups) session.groups = [];
      if (T.seances) session.seances = [];
    }
    if (T.header) xlImportHeader(session, T.header, rep);
    if (T.sessions) xlImportSessions(session, T.sessions, rep);
    if (T.days) xlImportDays(session, T.days, rep);
    if (T.slots) xlImportSlots(session, T.slots, rep);
    if (T.rooms) xlImportRooms(session, T.rooms, rep);
    if (T.teachers) xlImportTeachers(session, T.teachers, rep);
    if (T.groups) xlImportGroups(session, T.groups, rep);
    if (T.modules) xlImportModules(session, T.modules, rep);
    // Les affectations sont importées après les ressources afin que les noms
    // du classeur soient résolus vers les nouveaux identifiants de la session.
    // Elles doivent aussi être conservées après l'import éventuel des séances.
    if (T.affectations) {
      if (values.mode === "replace") session.affectations = [];
      xlImportAffectations(session, T.affectations, rep, {
        mode: values.mode === "replace" ? "replace" : "add",
        createMissing: true,
      });
    } else {
      rep.warnings.push("Aucune feuille « Affectations » détectée dans le classeur complet : les affectations existantes ont été conservées.");
    }
    if (T.seances) xlImportSeances(session, T.seances, rep, { mode: "add", createMissing: true, defaults: {} });
    if (values.mode === "replace") xlCleanupSeances(session, rep);
    if (typeof cleanAffectations === "function") cleanAffectations(session);
  },
};

/* ============================================================
   Registre des modules + interface
   ============================================================ */
const EXCEL_MODULES = {
  dashboard: { label: "Tableau de bord", exporter: xlExportDashboard, exportLabel: "Exporter la synthèse" },
  config: { label: "Configuration", exporter: xlExportConfig, importer: XL_IMPORTER_CONFIG },
  groups: { label: "Groupes", exporter: () => xlExportList("groups"), template: () => xlExportList("groups", true), importer: xlListImporter("groups", xlImportGroups) },
  rooms: { label: "Salles", exporter: () => xlExportList("rooms"), template: () => xlExportList("rooms", true), importer: xlListImporter("rooms", xlImportRooms) },
  teachers: { label: "Enseignants", exporter: () => xlExportList("teachers"), template: () => xlExportList("teachers", true), importer: xlListImporter("teachers", xlImportTeachers) },
  modules: { label: "Modules", exporter: () => xlExportList("modules"), template: () => xlExportList("modules", true), importer: xlListImporter("modules", xlImportModules) },
  affectations: { label: "Affectations", exporter: () => xlExportAffectations(), template: () => xlExportAffectations(true), importer: XL_IMPORTER_AFFECT },
  planning: { label: "Planning par groupe", exporter: () => xlExportGroupPlanning(), template: () => xlExportGroupPlanning(true), importer: xlSeancesImporter("planning") },
  semesterPlanning: { label: "Planning par semestre", exporter: xlExportSemesterPlanning, template: () => xlExportGroupPlanning(true), importer: xlSeancesImporter("semester") },
  teacherView: { label: "Vue enseignant", exporter: xlExportTeacherView, template: () => xlExportGroupPlanning(true), importer: xlSeancesImporter("teacher") },
  roomView: { label: "Vue salle", exporter: xlExportRoomView, template: () => xlExportGroupPlanning(true), importer: xlSeancesImporter("room") },
  conflicts: { label: "Conflits", exporter: xlExportConflicts },
  data: { label: "Session complète", exporter: () => xlExportAll(), template: () => xlExportAll(true), importer: XL_IMPORTER_ALL, exportLabel: "Exporter la session complète" },
};

let xlUndoSnapshot = null;

function xlContext() {
  const v = id => { const e = document.getElementById(id); return e ? e.value : ""; };
  return {
    groupId: v("planningGroupSelect"), teacherId: v("teacherViewSelect"), roomId: v("roomViewSelect"),
    semester: typeof selectedSemester !== "undefined" ? selectedSemester : null,
  };
}

function xlPickFile() {
  return new Promise(resolve => {
    const input = document.getElementById("excelFileInput");
    input.value = "";
    input.onchange = () => resolve(input.files[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });
}

async function xlRunExport(fn) {
  if (!xlEnsureLib()) return;
  try { await fn(); }
  catch (e) { console.error(e); alert("Erreur pendant l'export Excel : " + e.message); }
}

async function xlRunImport(key) {
  if (!xlEnsureLib()) return;
  const mod = EXCEL_MODULES[key];
  const file = await xlPickFile();
  if (!file) return;
  let wb;
  try { wb = await xlReadFile(file); }
  catch (e) { alert("Impossible de lire ce fichier. Un classeur Excel moderne (.xlsx) est attendu.\n\n" + e.message); return; }

  const ctx = xlContext();
  const probe = mod.importer.probe(wb, ctx);
  if (!probe.ok) { const rep = xlNewReport(); rep.errors.push(probe.message); xlShowReport(`Import — ${mod.label}`, rep, false); return; }

  const go = (values) => {
    xlUndoSnapshot = JSON.stringify(STATE);
    const session = getCurrentSession();
    const rep = xlNewReport();
    try { mod.importer.apply(session, wb, values || {}, rep, ctx); }
    catch (e) { console.error(e); rep.errors.push("Erreur inattendue : " + e.message); }
    const nConflicts = computeConflicts(session).length;
    if (nConflicts) rep.warnings.push(`${nConflicts} conflit(s) actif(s) dans la session après l'import (voir l'onglet Conflits).`);
    saveState(`📥 Import Excel — ${mod.label}`);
    renderAll();
    xlShowReport(`Import — ${mod.label}`, rep, xlHasChanges(rep));
  };

  const fields = mod.importer.options(ctx);
  if (fields.length) {
    openPromptModal({ title: `Importer — ${mod.label}`, intro: `Fichier : ${file.name} — ${probe.info}.`, fields, okLabel: "Importer", onSave: go });
  } else {
    go({});
  }
}

function xlShowReport(title, rep, canUndo) {
  document.getElementById("reportModalTitle").textContent = title;
  const body = document.getElementById("reportModalBody");
  body.innerHTML = "";

  const list = (items, cls, max = 25) => {
    const box = el("div", { class: "report-list " + cls });
    items.slice(0, max).forEach(t => box.appendChild(el("div", { class: "report-line" }, t)));
    if (items.length > max) box.appendChild(el("div", { class: "report-line more" }, `… et ${items.length - max} autre(s)`));
    return box;
  };

  const ok = rep.errors.length === 0;
  const nothing = rep.sections.length === 0 && rep.errors.length > 0;
  body.appendChild(el("div", { class: "report-status " + (ok ? "ok" : "ko") },
    ok ? "✅ Import terminé" : (nothing ? "⚠️ Import impossible" : "⚠️ Import terminé avec des erreurs")));

  const lines = rep.sections.map(s => {
    const parts = [];
    if (s.added) parts.push(`${s.added} ajouté(s)`);
    if (s.updated) parts.push(`${s.updated} mis à jour`);
    if (s.skipped) parts.push(`${s.skipped} ignoré(s)`);
    return `${s.title} : ${parts.length ? parts.join(" · ") : "aucun changement"}`;
  });
  if (lines.length) body.appendChild(list(lines, "sections"));
  if (rep.created.length) {
    body.appendChild(el("div", { class: "report-h" }, "Créés automatiquement"));
    body.appendChild(list(rep.created, "created"));
  }
  if (rep.warnings.length) {
    body.appendChild(el("div", { class: "report-h" }, "Avertissements"));
    body.appendChild(list(rep.warnings, "warn"));
  }
  if (rep.errors.length) {
    body.appendChild(el("div", { class: "report-h" }, "Erreurs (lignes non importées)"));
    body.appendChild(list(rep.errors, "err"));
  }
  document.getElementById("reportUndoBtn").style.display = canUndo ? "inline-block" : "none";
  document.getElementById("reportModalOverlay").classList.remove("hidden");
}

function xlInitReportModal() {
  const close = () => document.getElementById("reportModalOverlay").classList.add("hidden");
  document.getElementById("reportModalClose").addEventListener("click", close);
  document.getElementById("reportOkBtn").addEventListener("click", close);
  document.getElementById("reportModalOverlay").addEventListener("click", e => { if (e.target.id === "reportModalOverlay") close(); });
  document.getElementById("reportUndoBtn").addEventListener("click", () => {
    if (!xlUndoSnapshot) return;
    STATE = JSON.parse(xlUndoSnapshot);
    xlUndoSnapshot = null;
    saveState("↩️ Annulation d'un import Excel");
    renderAll();
    close();
    showToast("Import annulé");
  });
}

/** Remplit chaque <div class="excel-bar" data-excel="..."> avec les boutons du module. */
function initExcelBars() {
  xlInitReportModal();
  document.querySelectorAll(".excel-bar[data-excel]").forEach(bar => {
    const mod = EXCEL_MODULES[bar.dataset.excel];
    if (!mod) return;
    bar.appendChild(el("span", { class: "excel-bar-label" }, "📗 Excel"));
    bar.appendChild(el("button", { class: "btn small", onclick: () => xlRunExport(mod.exporter) }, "⬇️ " + (mod.exportLabel || "Exporter")));
    if (mod.importer) {
      bar.appendChild(el("button", { class: "btn small", onclick: () => xlRunImport(bar.dataset.excel) }, "⬆️ Importer"));
    }
    if (mod.template) {
      bar.appendChild(el("button", { class: "btn small ghost", title: "Fichier vide avec en-têtes, listes déroulantes et mode d'emploi", onclick: () => xlRunExport(mod.template) }, "📄 Modèle vierge"));
    }
  });
}
