/* ============================================================
   DATA.JS — Modèle de données, état global, persistance locale
   ============================================================ */

const STORAGE_KEY = "edt_app_state_v1";

const DOCUMENT_FORMAT_DEFAULTS = {
  logo: { widthMm: 100, heightMm: 25 },
  seal: { widthMm: 30, heightMm: 30 },
  elements: {
    title: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "center", valign: "middle", textColor: "#1f4e78" },
    sessionType: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "center", valign: "middle", textColor: "#1f4e78" },
    statut: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "center", valign: "middle", textColor: "#1f4e78" },
    year: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "center", valign: "middle", textColor: "#1f4e78" },
    filiere: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "center", valign: "middle", textColor: "#1f4e78" },
    metaLeft: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "left", valign: "middle", textColor: "#000000" },
    metaRight: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "right", valign: "middle", textColor: "#000000" },
    slot: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "center", valign: "middle", textColor: "#000000" },
    day: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "center", valign: "middle", textColor: "#000000" },
    module: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "center", valign: "middle", textColor: "#000000" },
    teacher: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: false, align: "center", valign: "middle", textColor: "#000000" },
    room: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: false, align: "center", valign: "middle", textColor: "#000000" },
    groups: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: false, align: "center", valign: "middle", textColor: "#000000" },
    action: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: true, align: "center", valign: "middle", textColor: "#1e3a8a" },
    footer: { fontFamily: "Times New Roman", fontSizePt: 11.5, bold: false, align: "left", valign: "middle", textColor: "#000000" },
  },
};

const DOCUMENT_THEME_DEFAULTS = {
  pageBackground: "#ffffff",
  titleColor: "#1f4e78",
  slotBackground: "#fff900",
  slotText: "#000000",
  dayBackground: "#fff900",
  dayText: "#000000",
  sessionBackground: "#92d050",
  sessionText: "#000000",
  actionBackground: "#dbeafe",
  actionText: "#1e3a8a",
  borderColor: "#000000",
  preserveSessionColors: false,
};

const DOCUMENT_VISIBILITY_DEFAULTS = {
  logo: true,
  seal: true,
  title: true,
  sessionType: true,
  year: true,
  filiere: true,
  meta: true,
  slot: true,
  day: true,
  module: true,
  teacher: true,
  room: true,
  groups: true,
  action: true,
  footer: true,
};

function normalizeDocumentVisibility(value) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = { ...DOCUMENT_VISIBILITY_DEFAULTS };
  Object.keys(normalized).forEach(key => {
    if (typeof source[key] === "boolean") normalized[key] = source[key];
  });
  return normalized;
}

function normalizeDocumentTheme(value) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = { ...DOCUMENT_THEME_DEFAULTS };
  Object.keys(DOCUMENT_THEME_DEFAULTS).forEach(key => {
    if (key === "preserveSessionColors") {
      if (typeof source[key] === "boolean") normalized[key] = source[key];
    } else if (typeof source[key] === "string" && /^#[0-9a-f]{6}$/i.test(source[key])) {
      normalized[key] = source[key];
    }
  });
  return normalized;
}

function normalizeDocumentFormat(value) {
  const allowedFonts = ["Arial", "Calibri", "Georgia", "Times New Roman", "Verdana"];
  const allowedAlign = ["left", "center", "right"];
  const allowedValign = ["top", "middle", "bottom"];
  const format = value && typeof value === "object" ? value : {};
  const normalized = JSON.parse(JSON.stringify(DOCUMENT_FORMAT_DEFAULTS));
  ["logo", "seal"].forEach(key => {
    const dims = format[key] && typeof format[key] === "object" ? format[key] : {};
    ["widthMm", "heightMm"].forEach(axis => {
      const n = Number(dims[axis]);
      const maximum = key === "logo" && axis === "widthMm" ? 120 : 60;
      if (Number.isFinite(n)) normalized[key][axis] = Math.max(5, Math.min(maximum, n));
    });
  });
  const elements = format.elements && typeof format.elements === "object" ? format.elements : {};
  Object.keys(normalized.elements).forEach(key => {
    const source = elements[key] && typeof elements[key] === "object" ? elements[key] : {};
    const target = normalized.elements[key];
    if (allowedFonts.includes(source.fontFamily)) target.fontFamily = source.fontFamily;
    const size = Number(source.fontSizePt);
    if (Number.isFinite(size)) target.fontSizePt = Math.max(6, Math.min(36, size));
    if (typeof source.bold === "boolean") target.bold = source.bold;
    if (allowedAlign.includes(source.align)) target.align = source.align;
    if (allowedValign.includes(source.valign)) target.valign = source.valign;
    if (typeof source.textColor === "string" && /^#[0-9a-f]{6}$/i.test(source.textColor)) target.textColor = source.textColor;
  });
  return normalized;
}

function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

/* ---------- Données de démonstration (issues des emplois du temps fournis) ---------- */
function buildDemoState() {
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  const slots = [
    { id: "s1", label: "9h00 - 10h30", start: "09:00", end: "10:30" },
    { id: "s2", label: "11h00 - 12h30", start: "11:00", end: "12:30" },
    { id: "s3", label: "12h45 - 13h45", start: "12:45", end: "13:45" },
    { id: "s4", label: "14h00 - 15h30", start: "14:00", end: "15:30" },
    { id: "s5", label: "15h45 - 17h15", start: "15:45", end: "17:15" },
  ];

  const rooms = [
    { id: "r_amphi", name: "AMPHI", capacity: 250, type: "amphi" },
    { id: "r_a8", name: "Salle A8", capacity: 45, type: "salle" },
    { id: "r_a9", name: "Salle A9", capacity: 45, type: "salle" },
    { id: "r_a10", name: "Salle A10", capacity: 45, type: "salle" },
  ];

  const teachers = [
    { id: "t_faras", name: "Pr FARAS", unavailable: ["Vendredi|0", "Vendredi|1"] },
    { id: "t_arrame", name: "Pr ARRAME", unavailable: [] },
    { id: "t_hmichane", name: "Pr HMICHANE", unavailable: ["Mardi|4"] },
    { id: "t_afnakar", name: "Pr AFNAKAR", unavailable: [] },
    { id: "t_sahal", name: "Pr SAHAL", unavailable: [] },
    { id: "t_dahhou", name: "Pr DAHHOU", unavailable: [] },
  ];

  const modules = [
    { id: "m_amazigh", name: "Culture et Langue Amazigh", semestre: "6", volumeHoraire: 3, nature: "metier" },
    { id: "m_anim", name: "Techniques d'Animation", semestre: "6", volumeHoraire: 3, nature: "metier" },
    { id: "m_deonto", name: "Déontologie", semestre: "6", volumeHoraire: 1.5, nature: "transversal", groupIds: ["g1", "g2", "g3"] },
    { id: "m_approches", name: "Approches & Méthodes", semestre: "6", volumeHoraire: 1.5, nature: "transversal", groupIds: ["g1", "g2", "g3"] },
    { id: "m_plastique", name: "Éducation Plastique et DPSM", semestre: "6", volumeHoraire: 3, nature: "metier" },
  ];

  const groups = [
    { id: "g1", name: "Groupe 1", semestre: "6", effectif: 40, defaultRoomId: "r_a8" },
    { id: "g2", name: "Groupe 2", semestre: "6", effectif: 38, defaultRoomId: "r_a8" },
    { id: "g3", name: "Groupe 3", semestre: "6", effectif: 42, defaultRoomId: "r_a9" },
  ];

  const seances = [
    // Culture et langue amazigh - Groupe 1 - Lundi, 2 créneaux consécutifs
    { id: uid("se"), moduleId: "m_amazigh", teacherId: "t_faras", groupIds: ["g1"], roomId: "r_a8", day: "Lundi", startSlotIndex: 0, duration: 2, color: "#fcebc0" },
    // Techniques d'animation - Groupe 1 - Lundi après-midi
    { id: uid("se"), moduleId: "m_anim", teacherId: "t_arrame", groupIds: ["g1"], roomId: "r_a8", day: "Lundi", startSlotIndex: 3, duration: 2, color: "#f6c9c9" },
    // Éducation plastique - Groupe 1 - Mardi après-midi
    { id: uid("se"), moduleId: "m_plastique", teacherId: "t_hmichane", groupIds: ["g1"], roomId: "r_a8", day: "Mardi", startSlotIndex: 3, duration: 2, color: "#f3b8b8" },
    // Déontologie - séance MUTUALISÉE en amphi pour 3 groupes en même temps (démo de la règle "un enseignant peut enseigner plusieurs groupes à la fois")
    { id: uid("se"), moduleId: "m_deonto", teacherId: "t_afnakar", groupIds: ["g1", "g2", "g3"], roomId: "r_amphi", day: "Mercredi", startSlotIndex: 1, duration: 1, color: "#f7a8a8" },
    // Approches & méthodes - amphi - Groupe 1 uniquement
    { id: uid("se"), moduleId: "m_approches", teacherId: "t_sahal", groupIds: ["g1"], roomId: "r_amphi", day: "Mercredi", startSlotIndex: 4, duration: 1, color: "#d7ecc8" },
    // Groupe 2 : techniques d'animation (autre enseignant, autre créneau)
    { id: uid("se"), moduleId: "m_anim", teacherId: "t_dahhou", groupIds: ["g2"], roomId: "r_a8", day: "Lundi", startSlotIndex: 0, duration: 2, color: "#f6c9c9" },
  ];

  const session = {
    id: uid("sess"),
    label: "Semestre 6 — Session de Printemps",
    annee: "2025-2026",
    statut: "provisoire",
    typeSession: "Printemps",
    filiere: "Licence d'Éducation Enseignement Primaire",
    option: "Bilingue",
    logo: null,
    seal: null,
    documentFormat: normalizeDocumentFormat(),
    documentTheme: normalizeDocumentTheme(),
    documentVisibility: normalizeDocumentVisibility(),
    startDate: "2026-09-23",
    config: { days, slots },
    rooms, teachers, modules, groups, seances,
    // Affectations : qui prend en charge combien de groupes d'un module (la composition
    // précise des groupes — et leur regroupement en amphi pour les modules transversaux —
    // est calculée automatiquement selon les disponibilités, cf. autoscheduler.js)
    affectations: [
      // Déontologie (transversal) : un seul enseignant pour les 3 groupes → 1 amphi de 3
      { id: uid("af"), moduleId: "m_deonto", teacherId: "t_afnakar", groupCount: 3, groupIds: ["g1", "g2", "g3"] },
      // Approches & Méthodes (transversal) : un seul enseignant, les 3 groupes regroupés en amphi
      // (un module transversal impose un minimum de 2 groupes regroupés par enseignant : jamais 1 groupe isolé)
      { id: uid("af"), moduleId: "m_approches", teacherId: "t_sahal", groupCount: 3, groupIds: ["g1", "g2", "g3"] },
    ],
  };

  return {
    annee: "2025-2026",
    sessions: [session],
    currentSessionId: session.id,
  };
}

/* ---------- État global ---------- */
let STATE = null;

/**
 * Assure la rétrocompatibilité : complète les champs manquants
 * (ajoutés dans des versions plus récentes de l'application)
 * sur un état chargé depuis le stockage local ou un import JSON.
 */
function normalizeState(state) {
  (state.sessions || []).forEach(session => {
    if (session.typeSession === undefined) session.typeSession = "Printemps";
    if (session.filiere === undefined) session.filiere = "Licence d'Éducation Enseignement Primaire";
    if (session.option === undefined) session.option = "Bilingue";
    if (session.statut === undefined) session.statut = "provisoire";
    if (session.logo === undefined) session.logo = null; // { dataUrl, name } | null
    if (session.seal === undefined) session.seal = null; // { dataUrl, name } | null — sceau/cachet institutionnel
    session.documentFormat = normalizeDocumentFormat(session.documentFormat);
    session.documentTheme = normalizeDocumentTheme(session.documentTheme);
    session.documentVisibility = normalizeDocumentVisibility(session.documentVisibility);
    if (session.startDate === undefined) session.startDate = ""; // "YYYY-MM-DD" — affiché en bas de page ("Début des cours")
    (session.teachers || []).forEach(t => {
      if (!Array.isArray(t.unavailable)) t.unavailable = [];
      if (!Array.isArray(t.moduleIds)) t.moduleIds = [];
      if (!t.moduleGroupCounts || typeof t.moduleGroupCounts !== "object" || Array.isArray(t.moduleGroupCounts)) t.moduleGroupCounts = {};
      if (t.allModules === undefined) t.allModules = t.moduleIds.length === 0; // par défaut : assure tous les modules
      ensureTeacherAvailability(session, t);
    });
    (session.rooms || []).forEach(r => {
      if (!Array.isArray(r.unavailable)) r.unavailable = [];
      ensureRoomAvailability(session, r);
    });
    (session.groups || []).forEach(g => {
      if (g.semestre === undefined) g.semestre = "";
      if (g.educationalActionDay === undefined) g.educationalActionDay = "";
      if (g.educationalActionLabel === undefined) g.educationalActionLabel = "ACTIONS ÉDUCATIVES";
      if (g.educationalActionLabel && !String(g.educationalActionLabel).trim()) g.educationalActionLabel = "ACTIONS ÉDUCATIVES";
      if (g.educationalActionDay && !(session.config.days || []).includes(g.educationalActionDay)) g.educationalActionDay = "";
    });
    (session.modules || []).forEach(m => {
      if (!Array.isArray(m.groupIds)) m.groupIds = [];
      if (m.nature !== "transversal") m.nature = "metier";
      if (m.fullDay === undefined) m.fullDay = false;
      if (!Array.isArray(m.roomPoolIds)) m.roomPoolIds = [];
    });
    if (!Array.isArray(session.affectations)) session.affectations = [];
    session.affectations.forEach(a => {
      if (!Array.isArray(a.groupIds)) a.groupIds = [];
      if (!(Number(a.groupCount) > 0)) a.groupCount = a.groupIds.length || 1;
    });
    if (typeof cleanAffectations === "function") cleanAffectations(session);
  });
  // Choix personnalisés ajoutés via le bouton "+" des listes déroulantes Type de session
  // et Statut — partagés par toutes les sessions (comme les listes de base).
  if (!Array.isArray(state.customTypeSessionOptions)) state.customTypeSessionOptions = [];
  if (!Array.isArray(state.customStatutOptions)) state.customStatutOptions = [];
  return state;
}

function loadState() {
  loadHistory();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      STATE = normalizeState(JSON.parse(raw));
      return;
    }
  } catch (e) {
    console.warn("Erreur de lecture du stockage local", e);
  }
  STATE = buildDemoState();
  saveState("État initial (données de démonstration)");
}

/**
 * label : texte optionnel décrivant l'opération à l'origine de cet enregistrement
 * (affiché dans l'onglet « Historique »). Si omis, un libellé générique est déduit
 * automatiquement en comparant avec l'enregistrement précédent (voir autoDetectHistoryLabel).
 */
function saveState(label) {
  if (STATE && typeof cleanAffectations === "function") STATE.sessions.forEach(cleanAffectations);
  if (STATE) STATE.sessions.forEach(ensureSessionTeacherAvailability);
  if (STATE) STATE.sessions.forEach(ensureSessionRoomAvailability);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
    recordHistoryEntry(label);
    return true;
  } catch (e) {
    console.warn("Erreur d'écriture du stockage local", e);
    return false;
  }
}

/* ============================================================
   HISTORIQUE DES OPÉRATIONS
   Chaque appel à saveState() enregistre un instantané complet de l'état
   (indépendamment du "vrai" stockage principal), avec un libellé décrivant
   l'opération. Cliquer sur une entrée dans l'onglet « Historique » restaure
   l'état tel qu'il était juste après cette opération.
   ============================================================ */
const HISTORY_STORAGE_KEY = "edt_app_history_v1";
const HISTORY_MAX_ENTRIES = 40;
let OPERATION_HISTORY = [];

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    OPERATION_HISTORY = raw ? JSON.parse(raw) : [];
  } catch (e) {
    OPERATION_HISTORY = [];
  }
}

/** Sauvegarde l'historique ; si le quota du navigateur est dépassé, supprime les
 * entrées les plus anciennes jusqu'à ce que ça rentre (ne bloque jamais l'application). */
function persistHistory() {
  while (OPERATION_HISTORY.length) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(OPERATION_HISTORY));
      return;
    } catch (e) {
      OPERATION_HISTORY.shift();
    }
  }
  try { localStorage.removeItem(HISTORY_STORAGE_KEY); } catch (e) { /* ignore */ }
}

function getOperationHistory() {
  return OPERATION_HISTORY;
}

/** Déduit un libellé générique en comparant avec l'enregistrement précédent, quand
 * aucun libellé explicite n'a été fourni par l'opération elle-même. */
function autoDetectHistoryLabel(newSnapshot) {
  const prevEntry = OPERATION_HISTORY[OPERATION_HISTORY.length - 1];
  if (!prevEntry) return "État initial";
  const prev = prevEntry.snapshot;
  if ((prev.sessions || []).length !== (newSnapshot.sessions || []).length) {
    return newSnapshot.sessions.length > prev.sessions.length ? "➕ Session ajoutée" : "🗑️ Session supprimée";
  }
  const sid = newSnapshot.currentSessionId;
  const prevSession = prev.sessions.find(s => s.id === sid) || prev.sessions[0];
  const newSession = newSnapshot.sessions.find(s => s.id === sid) || newSnapshot.sessions[0];
  if (!prevSession || !newSession) return "Modification";
  const fields = [
    ["teachers", "un enseignant"], ["rooms", "une salle"], ["groups", "un groupe"],
    ["modules", "un module"], ["seances", "une séance"], ["affectations", "une affectation"],
  ];
  for (const [key, word] of fields) {
    const a = (prevSession[key] || []).length, b = (newSession[key] || []).length;
    if (a !== b) return (b > a ? "➕ Ajout : " : "🗑️ Suppression : ") + word;
  }
  return "✏️ Modification";
}

function recordHistoryEntry(label) {
  try {
    const snapshot = JSON.parse(JSON.stringify(STATE));
    const finalLabel = label || autoDetectHistoryLabel(snapshot);
    OPERATION_HISTORY.push({ id: uid("hist"), at: Date.now(), label: finalLabel, snapshot });
    if (OPERATION_HISTORY.length > HISTORY_MAX_ENTRIES) OPERATION_HISTORY.shift();
    persistHistory();
    if (typeof renderHistoryView === "function") renderHistoryView();
  } catch (e) {
    console.warn("Historique : échec de l'enregistrement de cette opération", e);
  }
}

/** Restaure l'état tel qu'il était juste après l'opération `entryId`, puis ré-affiche
 * toute l'application. Le retour lui-même est enregistré comme une nouvelle opération
 * (historique linéaire, sans branches). */
function restoreHistoryEntry(entryId) {
  const entry = OPERATION_HISTORY.find(e => e.id === entryId);
  if (!entry) return false;
  STATE = JSON.parse(JSON.stringify(entry.snapshot));
  saveState(`↩️ Retour à : « ${entry.label} »`);
  if (typeof renderAll === "function") renderAll();
  return true;
}

function clearOperationHistory() {
  OPERATION_HISTORY = [];
  try { localStorage.removeItem(HISTORY_STORAGE_KEY); } catch (e) { /* ignore */ }
  if (typeof renderHistoryView === "function") renderHistoryView();
}

function getCurrentSession() {
  return STATE.sessions.find(s => s.id === STATE.currentSessionId) || STATE.sessions[0];
}

function resetToDemo() {
  STATE = buildDemoState();
  saveState("🗑️ Réinitialisation avec les données de démonstration");
}

function exportStateJSON() {
  return JSON.stringify({
    ...STATE,
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

function importStateJSON(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  if (!parsed.sessions || !Array.isArray(parsed.sessions)) {
    throw new Error("Format de fichier invalide : propriété 'sessions' manquante.");
  }
  STATE = normalizeState(parsed);
  saveState("📥 Import JSON (fichier complet)");
}

/* ---------- Disponibilités enseignants ---------- */
/** Toutes les clés correspondant à la grille actuelle de disponibilités. */
function currentAvailabilityKeys(session) {
  const keys = [];
  (session && session.config && session.config.days || []).forEach(day => {
    (session.config.slots || []).forEach((slot, slotIndex) => keys.push(availabilityKey(day, slotIndex)));
  });
  return keys;
}

/**
 * Initialise les créneaux d'un enseignant comme indisponibles.
 * availabilityKeys mémorise les créneaux déjà vus afin que l'ajout d'un jour ou
 * d'un créneau ajoute uniquement les nouvelles cases, sans écraser les choix manuels.
 */
function ensureTeacherAvailability(session, teacher) {
  if (!session || !teacher) return;
  if (!Array.isArray(teacher.unavailable)) teacher.unavailable = [];
  const current = currentAvailabilityKeys(session);
  const known = Array.isArray(teacher.availabilityKeys) ? teacher.availabilityKeys : [];
  const knownSet = new Set(known);
  const unavailable = new Set(teacher.unavailable);

  // Migration des anciens enseignants : une grille non initialisée est bloquée par défaut.
  if (!teacher.availabilityInitialized) {
    current.forEach(key => unavailable.add(key));
    teacher.availabilityInitialized = true;
  } else {
    current.forEach(key => {
      if (!knownSet.has(key)) unavailable.add(key);
    });
  }

  teacher.unavailable = Array.from(unavailable);
  teacher.availabilityKeys = Array.from(new Set([...known, ...current]));
}

function ensureSessionTeacherAvailability(session) {
  if (!session) return;
  (session.teachers || []).forEach(teacher => ensureTeacherAvailability(session, teacher));
}

function availabilityKey(day, slotIndex) {
  return `${day}|${slotIndex}`;
}

function isTeacherUnavailable(teacher, day, slotIndex) {
  if (!teacher || !Array.isArray(teacher.unavailable)) return false;
  return teacher.unavailable.includes(availabilityKey(day, slotIndex));
}

function toggleTeacherAvailability(teacher, day, slotIndex) {
  if (!Array.isArray(teacher.unavailable)) teacher.unavailable = [];
  const key = availabilityKey(day, slotIndex);
  const idx = teacher.unavailable.indexOf(key);
  if (idx >= 0) teacher.unavailable.splice(idx, 1);
  else teacher.unavailable.push(key);
}

/** Fixe explicitement (plutôt que bascule) la disponibilité d'un créneau — utilisé par
 * les cases à cocher rapides "Matin" / "Après-midi" de la grille de disponibilités. */
function setTeacherAvailability(teacher, day, slotIndex, available) {
  if (!Array.isArray(teacher.unavailable)) teacher.unavailable = [];
  const key = availabilityKey(day, slotIndex);
  const idx = teacher.unavailable.indexOf(key);
  if (available) {
    if (idx >= 0) teacher.unavailable.splice(idx, 1);
  } else if (idx < 0) {
    teacher.unavailable.push(key);
  }
}

/* ---------- Disponibilités salles ----------
 * Même principe que pour les enseignants (clé "Jour|indexCréneau" dans un tableau
 * de créneaux indisponibles), à la différence près qu'une salle est considérée
 * disponible par défaut : une salle nouvellement créée, ou un jour/créneau
 * nouvellement ajouté à la grille, ne sont PAS marqués indisponibles automatiquement. */
function ensureRoomAvailability(session, room) {
  if (!session || !room) return;
  if (!Array.isArray(room.unavailable)) room.unavailable = [];
}

function ensureSessionRoomAvailability(session) {
  if (!session) return;
  (session.rooms || []).forEach(room => ensureRoomAvailability(session, room));
}

function isRoomUnavailable(room, day, slotIndex) {
  if (!room || !Array.isArray(room.unavailable)) return false;
  return room.unavailable.includes(availabilityKey(day, slotIndex));
}

function toggleRoomAvailability(room, day, slotIndex) {
  if (!Array.isArray(room.unavailable)) room.unavailable = [];
  const key = availabilityKey(day, slotIndex);
  const idx = room.unavailable.indexOf(key);
  if (idx >= 0) room.unavailable.splice(idx, 1);
  else room.unavailable.push(key);
}

/* ---------- Aide semestres ---------- */
function getDistinctSemesters(session) {
  const set = new Set();
  session.groups.forEach(g => { if (g.semestre) set.add(g.semestre); });
  return Array.from(set).sort((a, b) => {
    const na = parseFloat(a), nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b));
  });
}

const DEFAULT_EDUCATIONAL_ACTION_LABEL = "ACTIONS ÉDUCATIVES";

function normalizeEducationalActionLabel(label) {
  const value = String(label ?? "").trim();
  return value || DEFAULT_EDUCATIONAL_ACTION_LABEL;
}

function groupHasEducationalAction(group, day) {
  return !!(group && group.educationalActionDay && group.educationalActionDay === day);
}

function isGroupAwayForEducationalAction(session, groupId, day) {
  const group = (session.groups || []).find(g => g.id === groupId);
  return groupHasEducationalAction(group, day);
}

function setGroupEducationalAction(session, groupId, day, label, { allowConflict = false } = {}) {
  const group = (session.groups || []).find(g => g.id === groupId);
  if (!group) return { error: "group-not-found" };
  if (day && !(session.config.days || []).includes(day)) return { error: "invalid-day" };
  if (day && !allowConflict && (session.seances || []).some(s => s.groupIds.includes(groupId) && s.day === day && !s.action)) {
    return { error: "day-conflict" };
  }
  group.educationalActionDay = day || "";
  group.educationalActionLabel = normalizeEducationalActionLabel(label);
  return { group };
}

function formatDateFR(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** "Session d'Automne" / "Session de Printemps" — élision selon la voyelle initiale. */
function sessionTypeLabel(typeSession) {
  const t = (typeSession || "").trim();
  if (!t) return "";
  const startsWithVowel = /^[aeiouéèêàâîôûAEIOUÉÈÊÀÂÎÔÛ]/.test(t);
  return `Session d${startsWithVowel ? "’" : "e "}${t}`;
}

function statutLabel(session) {
  if (session.statut === "provisoire") return "provisoire";
  if (session.statut === "final") return "final";
  return session.statut || ""; // valeur personnalisée (bouton "+"), éventuellement vide
}

/** Date de début des cours affichée en bas de page (session.startDate, sinon la date du jour). */
function startCoursesDateLabel(session) {
  if (session.startDate) {
    const d = new Date(session.startDate + "T00:00:00");
    if (!isNaN(d)) return formatDateFR(d);
  }
  return formatDateFR(new Date());
}

/* ---------- Durées ---------- */
function hhmmToMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Durée réelle d'une séance en minutes (somme des créneaux qu'elle occupe). */
function seanceMinutes(session, seance) {
  let total = 0;
  for (let i = seance.startSlotIndex; i < seance.startSlotIndex + seance.duration; i++) {
    const slot = session.config.slots[i];
    if (slot) total += Math.max(0, hhmmToMinutes(slot.end) - hhmmToMinutes(slot.start));
  }
  return total;
}

/* ---------- Modules assurés par un enseignant ---------- */
/** Un enseignant peut-il assurer ce module ? (assure tous les modules, ou ce module figure dans sa liste). */
function teacherCanTeachModule(teacher, moduleId) {
  if (!teacher) return false;
  if (teacher.allModules) return true;
  return (teacher.moduleIds || []).includes(moduleId);
}

/** Enseignants pouvant assurer un module donné (pour filtrer les listes déroulantes). */
function eligibleTeachersForModule(session, moduleId) {
  return session.teachers.filter(t => teacherCanTeachModule(t, moduleId));
}
const MODULE_NATURES = [
  { value: "metier", label: "🎯 Métier" },
  { value: "transversal", label: "🧩 Transversal" },
];
const TRANSVERSAL_DURATION_MINUTES = 90; // 1h30, imposé aux modules transversaux
const TRANSVERSAL_MIN_GROUPS = 2;        // minimum de groupes regroupés par enseignant
const TRANSVERSAL_MAX_GROUPS = 3;        // maximum de groupes regroupés dans un même amphi

function isTransversal(m) { return m && m.nature === "transversal"; }

/* ---------- Modules « journée complète » (ex. Actions Éducatives) ---------- */
/** Un module « journée complète » occupe TOUT le jour, une fois par semaine, pour chaque
 * groupe individuellement (pas de mutualisation en amphi). Le jour peut être choisi à la
 * main par groupe, ou déterminé automatiquement par l'application (cf. autoscheduler.js),
 * ce qui libère par la même occasion la salle par défaut du groupe ce jour-là. */
function isFullDayModule(m) { return !!(m && m.fullDay); }
function fullDayDuration(session) { return (session.config.slots || []).length || 1; }
/** Séance « journée complète » déjà programmée pour ce module et ce groupe (s'il y en a une). */
function fullDaySeanceFor(session, moduleId, groupId) {
  const duration = fullDayDuration(session);
  return session.seances.find(s => s.moduleId === moduleId && s.fullDay
    && s.groupIds.length === 1 && s.groupIds[0] === groupId && s.duration === duration && s.startSlotIndex === 0);
}

function moduleNatureLabel(m) {
  const found = MODULE_NATURES.find(n => n.value === (m && m.nature));
  return found ? found.label : MODULE_NATURES[0].label;
}

/**
 * Nombre de créneaux consécutifs nécessaires pour couvrir au moins `minutes` minutes,
 * à partir de la durée moyenne des créneaux configurés (repris précisément lors du placement réel).
 */
function slotsNeededForMinutes(session, minutes) {
  const slots = session.config.slots || [];
  if (!slots.length) return 1;
  const avg = slots.reduce((sum, s) => sum + Math.max(1, hhmmToMinutes(s.end) - hhmmToMinutes(s.start)), 0) / slots.length;
  return Math.max(1, Math.round(minutes / avg));
}

/** Durée (en nombre de créneaux) à utiliser pour une séance générée automatiquement pour ce module. */
function seanceDurationForModule(session, m) {
  if (isTransversal(m)) return slotsNeededForMinutes(session, TRANSVERSAL_DURATION_MINUTES);
  const minutes = (Number(m.volumeHoraire) || 1.5) * 60;
  return slotsNeededForMinutes(session, minutes);
}

/**
 * Répartit `n` groupes en paquets de 2 ou 3 (règle des modules transversaux : jamais un
 * paquet isolé de 1). Retourne un tableau de tailles, ex. packSizes(5) -> [3,2].
 * packSizes(1) retourne [1] (invalide — signalé ailleurs comme anomalie à corriger).
 */
function packSizes(n) {
  n = Math.max(0, Math.round(n) || 0);
  if (n === 0) return [];
  if (n === 1) return [1];
  if (n <= TRANSVERSAL_MAX_GROUPS) return [n];
  if (n % 3 === 0) return Array(n / 3).fill(3);
  if (n % 3 === 2) return [...Array(Math.floor(n / 3)).fill(3), 2];
  // n % 3 === 1 et n >= 4 : remplace un paquet de 3 par deux paquets de 2 (évite un reliquat de 1)
  const k = (n - 4) / 3;
  return [...Array(k).fill(3), 2, 2];
}
