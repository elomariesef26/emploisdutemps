/* ============================================================
   APP.JS — Navigation, modales, câblage des événements
   ============================================================ */

let editingSeanceId = null;
let selectedSemester = null;

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  initSidebarNav();
  initSessionSelector();
  initConfigView();
  initResourcesView();
  initPlanningView();
  initSemesterPlanningView();
  initTeacherView();
  initRoomView();
  initDataView();
  initSeanceModal();
  initAffectationsView();
  initAvailabilityModal();
  initRoomAvailabilityModal();
  initTeacherModulesModal();
  initConflictsView();
  initExcelBars();
  initHistoryView();

  renderAll();
});

/* ================= NAVIGATION ================= */
function initSidebarNav() {
  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const viewId = btn.dataset.view;
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById("view-" + viewId).classList.add("active");
      renderCurrentView(viewId);
    });
  });

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabsRoot = btn.closest(".view");
      tabsRoot.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      tabsRoot.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      tabsRoot.querySelector("#tab-" + btn.dataset.tab).classList.add("active");
    });
  });
}

function renderCurrentView(viewId) {
  switch (viewId) {
    case "dashboard": renderDashboard(); break;
    case "config": renderConfigView(); break;
    case "resources": renderResourcesView(); break;
    case "affectations": renderAffectationsView(); break;
    case "planning": refreshPlanningSelectorAndGrid(); break;
    case "semesterPlanning": refreshSemesterPlanningView(); break;
    case "teacherView": refreshTeacherSelectorAndGrid(); break;
    case "roomView": refreshRoomSelectorAndGrid(); break;
    case "conflicts": renderConflictsView(); break;
    case "data": break;
    case "history": renderHistoryView(); break;
  }
}

function renderAll() {
  renderSessionSelector();
  renderDashboard();
  renderConfigView();
  renderResourcesView();
  renderAffectationsView();
  refreshPlanningSelectorAndGrid();
  refreshSemesterPlanningView();
  refreshTeacherSelectorAndGrid();
  refreshRoomSelectorAndGrid();
  renderConflictsView();
}

function refreshAllSelectorsAndGrids() {
  renderDashboard();
  renderAffectationsView();
  refreshPlanningSelectorAndGrid();
  refreshSemesterPlanningView();
  refreshTeacherSelectorAndGrid();
  refreshRoomSelectorAndGrid();
  renderConflictsView();
}

/* ================= SESSION SELECTOR ================= */
function cloneSessionResources(source, values) {
  const copy = JSON.parse(JSON.stringify(source));
  const roomMap = new Map((copy.rooms || []).map(r => [r.id, uid("r")]));
  const teacherMap = new Map((copy.teachers || []).map(t => [t.id, uid("t")]));
  const moduleMap = new Map((copy.modules || []).map(m => [m.id, uid("m")]));
  const groupMap = new Map((copy.groups || []).map(g => [g.id, uid("g")]));

  copy.rooms = (copy.rooms || []).map(room => ({ ...room, id: roomMap.get(room.id) }));
  copy.teachers = (copy.teachers || []).map(teacher => ({
    ...teacher,
    id: teacherMap.get(teacher.id),
    moduleIds: (teacher.moduleIds || []).map(id => moduleMap.get(id)).filter(Boolean),
    moduleGroupCounts: Object.fromEntries(Object.entries(teacher.moduleGroupCounts || {})
      .map(([id, count]) => [moduleMap.get(id), count]).filter(([id]) => Boolean(id))),
  }));
  copy.modules = (copy.modules || []).map(module => ({
    ...module,
    id: moduleMap.get(module.id),
    groupIds: (module.groupIds || []).map(id => groupMap.get(id)).filter(Boolean),
    roomPoolIds: (module.roomPoolIds || []).map(id => roomMap.get(id)).filter(Boolean),
  }));
  copy.groups = (copy.groups || []).map(group => ({
    ...group,
    id: groupMap.get(group.id),
    defaultRoomId: roomMap.get(group.defaultRoomId) || "",
  }));

  // Une nouvelle session reprend les ressources et la configuration, mais pas le planning
  // ni les affectations de la session source : ils peuvent être construits indépendamment.
  return {
    id: uid("sess"),
    label: values.label || `Copie de ${source.label || "la session précédente"}`,
    annee: values.annee || source.annee || STATE.annee || "2025-2026",
    statut: source.statut || "provisoire",
    typeSession: source.typeSession || "Printemps",
    filiere: source.filiere || "",
    option: source.option || "",
    logo: copy.logo || null,
    seal: copy.seal || null,
    documentFormat: normalizeDocumentFormat(source.documentFormat),
    documentTheme: normalizeDocumentTheme(source.documentTheme),
    documentVisibility: normalizeDocumentVisibility(source.documentVisibility),
    startDate: source.startDate || "",
    config: copy.config || { days: [], slots: [] },
    rooms: copy.rooms,
    teachers: copy.teachers,
    modules: copy.modules,
    groups: copy.groups,
    seances: [],
    affectations: [],
  };
}

function initSessionSelector() {
  document.getElementById("sessionSelect").addEventListener("change", (e) => {
    STATE.currentSessionId = e.target.value;
    saveState();
    renderAll();
  });

  const addSession = () => {
    openPromptModal({
      title: "Nouvelle session",
      fields: [
        { id: "label", label: "Libellé (ex: Semestre 4 — Automne)", type: "text", value: "" },
        { id: "annee", label: "Année universitaire", type: "text", value: STATE.annee || "2025-2026" },
      ],
      onSave: (values) => {
        const source = getCurrentSession();
        const newSession = cloneSessionResources(source, values);
        STATE.sessions.push(newSession);
        STATE.currentSessionId = newSession.id;
        saveState(`➕ Session créée : « ${newSession.label} »`);
        renderAll();
        showToast("Session créée");
      },
    });
  };
  document.getElementById("addSessionBtn").addEventListener("click", addSession);
  document.getElementById("addSessionConfigBtn")?.addEventListener("click", addSession);

  document.getElementById("deleteSessionBtn").addEventListener("click", () => deleteSessionById(STATE.currentSessionId));
}

function renameSessionById(sessionId, label) {
  const session = STATE.sessions.find(s => s.id === sessionId);
  const nextLabel = String(label || "").trim();
  if (!session || !nextLabel) return false;
  session.label = nextLabel;
  saveState();
  renderSessionSelector();
  document.getElementById("anneeLabel").textContent = getCurrentSession().annee || STATE.annee;
  return true;
}

function deleteSessionById(sessionId) {
  if (STATE.sessions.length <= 1) {
    alert("La dernière session ne peut pas être supprimée.");
    return false;
  }
  const session = STATE.sessions.find(s => s.id === sessionId);
  if (!session) return false;
  if (!confirm(`Supprimer définitivement la session « ${session.label} » et son planning ?`)) return false;
  const index = STATE.sessions.findIndex(s => s.id === session.id);
  STATE.sessions = STATE.sessions.filter(s => s.id !== session.id);
  const next = STATE.sessions[Math.max(0, Math.min(index, STATE.sessions.length - 1))];
  STATE.currentSessionId = next.id;
  saveState(`🗑️ Session supprimée : « ${session.label} »`);
  renderAll();
  showToast("Session supprimée");
  return true;
}

function renderSessionSelector() {
  const select = document.getElementById("sessionSelect");
  select.innerHTML = "";
  STATE.sessions.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    if (s.id === STATE.currentSessionId) opt.selected = true;
    select.appendChild(opt);
  });
  document.getElementById("anneeLabel").textContent = getCurrentSession().annee || STATE.annee;
}

/* ================= CONFIG VIEW WIRING ================= */
function initConfigView() {
  const bind = (id, field, isNumber) => {
    document.getElementById(id).addEventListener("change", (e) => {
      const session = getCurrentSession();
      session[field] = isNumber ? Number(e.target.value) : e.target.value;
      saveState();
      refreshAllSelectorsAndGrids();
    });
  };
  bind("cfgTypeSession", "typeSession");
  bind("cfgStatut", "statut");
  bind("cfgAnnee", "annee");
  bind("cfgFiliere", "filiere");
  bind("cfgOption", "option");
  bind("cfgStartDate", "startDate");

  // Boutons "+" : ajouter un choix personnalisé (y compris vide) aux listes déroulantes
  // Type de session et Statut. Les choix ajoutés sont partagés par toutes les sessions.
  function addCustomOption({ listKey, field, selectId, title, hint }) {
    openPromptModal({
      title,
      intro: hint,
      fields: [{ id: "value", label: "Nouveau choix (laisser vide pour un choix vide)", value: "" }],
      okLabel: "Ajouter",
      onSave: (values) => {
        const value = (values.value || "").trim();
        if (!STATE[listKey].includes(value)) STATE[listKey].push(value);
        const session = getCurrentSession();
        session[field] = value;
        saveState();
        renderConfigView();
        refreshAllSelectorsAndGrids();
      },
    });
  }
  document.getElementById("cfgTypeSessionAddBtn").addEventListener("click", () => addCustomOption({
    listKey: "customTypeSessionOptions", field: "typeSession", selectId: "cfgTypeSession",
    title: "Ajouter un type de session", hint: "S'ajoute aux choix Automne / Printemps déjà existants.",
  }));
  document.getElementById("cfgStatutAddBtn").addEventListener("click", () => addCustomOption({
    listKey: "customStatutOptions", field: "statut", selectId: "cfgStatut",
    title: "Ajouter un statut", hint: "S'ajoute aux choix Provisoire / Final déjà existants.",
  }));

  document.getElementById("addSlotBtn").addEventListener("click", () => {
    const session = getCurrentSession();
    session.config.slots.push({ id: uid("slot"), label: "Nouveau créneau", start: "09:00", end: "10:30" });
    saveState();
    renderConfigView();
  });

  document.getElementById("generateSlotsBtn").addEventListener("click", () => {
    const session = getCurrentSession();
    const start = document.getElementById("genStart").value;
    const end = document.getElementById("genEnd").value;
    const duration = Number(document.getElementById("genDuration").value) || 90;
    const breakStart = document.getElementById("genBreakStart").value;
    const breakDuration = Number(document.getElementById("genBreakDuration").value) || 0;

    if (!confirm("Cela va remplacer tous les créneaux existants. Continuer ?")) return;

    const slots = generateSlots(start, end, duration, breakStart, breakDuration);
    session.config.slots = slots;
    saveState();
    renderConfigView();
    refreshAllSelectorsAndGrids();
    showToast(`${slots.length} créneaux générés`);
  });

  // --- Logo de l'établissement ---
  const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 Mo : au-delà, risque de saturer le stockage local du navigateur
  const logoInput = document.getElementById("logoFileInput");
  document.getElementById("logoImportBtn").addEventListener("click", () => logoInput.click());
  logoInput.addEventListener("change", () => {
    const file = logoInput.files && logoInput.files[0];
    logoInput.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|svg)$/i.test(file.name)) {
      alert("Format non pris en charge : choisissez une image PNG, JPG ou SVG.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      alert(`Ce fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Choisissez une image plus légère (2 Mo max), au format PNG ou JPG de préférence.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const session = getCurrentSession();
      session.logo = { dataUrl: reader.result, name: file.name };
      const ok = saveState();
      renderConfigView();
      refreshAllSelectorsAndGrids();
      if (ok) showToast(`Logo « ${file.name} » importé.`);
      else { session.logo = null; alert("Le logo n'a pas pu être enregistré (stockage local saturé). Essayez une image plus légère."); renderConfigView(); }
    };
    reader.onerror = () => alert("Impossible de lire ce fichier.");
    reader.readAsDataURL(file);
  });
  document.getElementById("logoRemoveBtn").addEventListener("click", () => {
    const session = getCurrentSession();
    if (!session.logo) return;
    if (!confirm("Retirer le logo de l'en-tête des documents ?")) return;
    session.logo = null;
    saveState();
    renderConfigView();
    refreshAllSelectorsAndGrids();
  });

  // --- Sceau / cachet institutionnel (même logique que le logo, affiché en haut à droite) ---
  const sealInput = document.getElementById("sealFileInput");
  document.getElementById("sealImportBtn").addEventListener("click", () => sealInput.click());
  sealInput.addEventListener("change", () => {
    const file = sealInput.files && sealInput.files[0];
    sealInput.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type) && !/\.(png|jpe?g|svg)$/i.test(file.name)) {
      alert("Format non pris en charge : choisissez une image PNG, JPG ou SVG.");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      alert(`Ce fichier est trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Choisissez une image plus légère (2 Mo max).`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const session = getCurrentSession();
      session.seal = { dataUrl: reader.result, name: file.name };
      const ok = saveState();
      renderConfigView();
      refreshAllSelectorsAndGrids();
      if (ok) showToast(`Sceau « ${file.name} » importé.`);
      else { session.seal = null; alert("Le sceau n'a pas pu être enregistré (stockage local saturé). Essayez une image plus légère."); renderConfigView(); }
    };
    reader.onerror = () => alert("Impossible de lire ce fichier.");
    reader.readAsDataURL(file);
  });
  document.getElementById("sealRemoveBtn").addEventListener("click", () => {
    const session = getCurrentSession();
    if (!session.seal) return;
    if (!confirm("Retirer le sceau de l'en-tête des documents ?")) return;
    session.seal = null;
    saveState();
    renderConfigView();
    refreshAllSelectorsAndGrids();
  });
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function generateSlots(start, end, duration, breakStart, breakDuration) {
  const slots = [];
  let cursor = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const breakStartMin = breakStart ? timeToMinutes(breakStart) : null;
  const breakEndMin = breakStartMin !== null ? breakStartMin + breakDuration : null;

  while (cursor + duration <= endMin) {
    // Skip over lunch break window
    if (breakStartMin !== null && cursor < breakEndMin && cursor + duration > breakStartMin) {
      cursor = breakEndMin;
      continue;
    }
    const slotEnd = cursor + duration;
    slots.push({
      id: uid("slot"),
      label: `${minutesToTime(cursor)} - ${minutesToTime(slotEnd)}`,
      start: minutesToTime(cursor),
      end: minutesToTime(slotEnd),
    });
    cursor = slotEnd;
  }
  return slots;
}

/* ================= RESOURCES VIEW WIRING ================= */
function initResourcesView() {
  document.getElementById("addGroupBtn").addEventListener("click", () => {
    const session = getCurrentSession();
    session.groups.push({
      id: uid("g"), name: "Nouveau groupe", semestre: "", effectif: 30,
      defaultRoomId: session.rooms[0] ? session.rooms[0].id : "",
      educationalActionDay: "", educationalActionLabel: DEFAULT_EDUCATIONAL_ACTION_LABEL,
    });
    saveState();
    renderResourcesView();
    refreshAllSelectorsAndGrids();
  });

  document.getElementById("autoEducationalActionsBtn").addEventListener("click", () => {
    const session = getCurrentSession();
    const manualCount = session.groups.filter(g => g.educationalActionDay).length;
    const message = manualCount
      ? `${manualCount} choix manuel(s) seront conservés. Attribuer automatiquement les groupes restants ?`
      : "Attribuer automatiquement une journée extérieure à chaque groupe ?";
    if (!confirm(message)) return;
    autoAssignEducationalActionDays(session, { overwrite: false });
    renderResourcesView();
    refreshAllSelectorsAndGrids();
  });

  document.getElementById("addRoomBtn").addEventListener("click", () => {
    const session = getCurrentSession();
    session.rooms.push({ id: uid("r"), name: "Nouvelle salle", capacity: 40, type: "salle" });
    saveState();
    renderResourcesView();
    refreshAllSelectorsAndGrids();
  });

  document.getElementById("addTeacherBtn").addEventListener("click", () => {
    const session = getCurrentSession();
    const teacher = { id: uid("t"), name: "Nouvel enseignant", unavailable: [], availabilityInitialized: false };
    ensureTeacherAvailability(session, teacher);
    session.teachers.push(teacher);
    saveState();
    renderResourcesView();
    refreshAllSelectorsAndGrids();
  });

  document.getElementById("addModuleBtn").addEventListener("click", () => {
    const session = getCurrentSession();
    session.modules.push({ id: uid("m"), name: "Nouveau module", semestre: "", volumeHoraire: 1.5, nature: "metier", fullDay: false, roomPoolIds: [], groupIds: [] });
    saveState();
    renderResourcesView();
    refreshAllSelectorsAndGrids();
  });
}

/* ================= PLANNING VIEW WIRING ================= */
function initPlanningView() {
  document.getElementById("planningGroupSelect").addEventListener("change", (e) => {
    renderPlanningGrid(e.target.value);
  });
  document.getElementById("printPlanningBtn").addEventListener("click", () => printView("planning"));
}

function refreshPlanningSelectorAndGrid() {
  const session = getCurrentSession();
  const select = document.getElementById("planningGroupSelect");
  const prev = select.value;
  select.innerHTML = "";
  session.groups.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id; opt.textContent = `${g.name} (${g.semestre || "-"})`;
    select.appendChild(opt);
  });
  const toSelect = session.groups.find(g => g.id === prev) ? prev : (session.groups[0] ? session.groups[0].id : "");
  select.value = toSelect;
  renderPlanningGrid(toSelect);
}

/* ================= SEMESTER PLANNING VIEW WIRING ================= */
function initSemesterPlanningView() {
  document.getElementById("printSemesterBtn").addEventListener("click", () => printView("semesterPlanning"));
}

function refreshSemesterPlanningView() {
  const session = getCurrentSession();
  const semesters = getDistinctSemesters(session);

  if (!selectedSemester || !semesters.includes(selectedSemester)) {
    selectedSemester = semesters[0] || null;
  }

  renderSemesterButtons(document.getElementById("semesterButtons"), semesters, selectedSemester, (sem) => {
    selectedSemester = sem;
    refreshSemesterPlanningView();
  });

  renderSemesterDocs(selectedSemester);
}

/* ================= TEACHER VIEW WIRING ================= */
function initTeacherView() {
  document.getElementById("teacherViewSelect").addEventListener("change", (e) => {
    renderTeacherGrid(e.target.value);
  });
  document.getElementById("printTeacherBtn").addEventListener("click", () => printView("teacherView"));
}

function refreshTeacherSelectorAndGrid() {
  const session = getCurrentSession();
  const select = document.getElementById("teacherViewSelect");
  const prev = select.value;
  select.innerHTML = "";
  session.teachers.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id; opt.textContent = t.name;
    select.appendChild(opt);
  });
  const toSelect = session.teachers.find(t => t.id === prev) ? prev : (session.teachers[0] ? session.teachers[0].id : "");
  select.value = toSelect;
  renderTeacherGrid(toSelect);
}

/* ================= ROOM VIEW WIRING ================= */
function initRoomView() {
  document.getElementById("roomViewSelect").addEventListener("change", (e) => {
    renderRoomGrid(e.target.value);
  });
  document.getElementById("printRoomBtn").addEventListener("click", () => printView("roomView"));
}

function refreshRoomSelectorAndGrid() {
  const session = getCurrentSession();
  const select = document.getElementById("roomViewSelect");
  const prev = select.value;
  select.innerHTML = "";
  session.rooms.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id; opt.textContent = r.name;
    select.appendChild(opt);
  });
  const toSelect = session.rooms.find(r => r.id === prev) ? prev : (session.rooms[0] ? session.rooms[0].id : "");
  select.value = toSelect;
  renderRoomGrid(toSelect);
}

/* ================= CONFLICTS VIEW WIRING ================= */
function initConflictsView() {
  document.getElementById("regenerateConflictsBtn").addEventListener("click", regenerateOnConflicts);
}

/* ================= PRINT / EXPORT PDF ================= */
/**
 * Chaque vue est imprimée sous forme de "documents" A4 paysage (une page par groupe / enseignant / salle),
 * avec l'en-tête officiel (titre, année, filière, méta) — et non plus la simple grille de l'écran.
 */
function printView(viewId) {
  const session = getCurrentSession();
  const val = id => document.getElementById(id).value;
  let pages = [], name = "";

  if (viewId === "planning") {
    const g = session.groups.find(x => x.id === val("planningGroupSelect"));
    if (!g) { alert("Sélectionnez d'abord un groupe."); return; }
    pages = [buildGroupDocSection(session, g)];
    name = `EDT ${g.name}`;
  } else if (viewId === "semesterPlanning") {
    const groups = session.groups.filter(g => g.semestre === selectedSemester);
    if (!selectedSemester || !groups.length) { alert("Sélectionnez d'abord un semestre contenant des groupes."); return; }
    pages = groups.map(g => buildGroupDocSection(session, g));
    name = `EDT Semestre ${selectedSemester}`;
  } else if (viewId === "teacherView") {
    const t = session.teachers.find(x => x.id === val("teacherViewSelect"));
    if (!t) { alert("Sélectionnez d'abord un enseignant."); return; }
    pages = [buildDocSection(session, teacherDocSpec(session, t))];
    name = `EDT ${t.name}`;
  } else if (viewId === "roomView") {
    const r = session.rooms.find(x => x.id === val("roomViewSelect"));
    if (!r) { alert("Sélectionnez d'abord une salle."); return; }
    pages = [buildDocSection(session, roomDocSpec(session, r))];
    name = `EDT ${r.name}`;
  } else {
    return;
  }
  printDocuments(pages, `${name} - ${session.annee || ""}`.trim());
}

let printTitleBackup = null;
function printDocuments(pages, title) {
  const previous = document.getElementById("printRoot");
  if (previous) previous.remove();

  const root = el("div", { id: "printRoot" }, pages);
  document.body.appendChild(root);

  // Ajustement : chaque page est mesurée à sa taille A4 paysage réelle (hors écran) ;
  // si le contenu déborde (7 jours, noms très longs…), il est réduit proportionnellement.
  root.classList.add("measuring");
  pages.forEach(page => {
    let fit = 1;
    page.style.setProperty("--fit", "1");
    while (page.scrollHeight > page.clientHeight + 1 && fit > 0.5) {
      fit = Math.round((fit - 0.03) * 100) / 100;
      page.style.setProperty("--fit", String(fit));
    }
  });
  root.classList.remove("measuring");
  document.body.classList.add("print-mode");

  // Le titre de la page devient le nom de fichier proposé par "Enregistrer en PDF"
  if (printTitleBackup === null) printTitleBackup = document.title;
  document.title = title;

  const cleanup = () => {
    window.removeEventListener("afterprint", cleanup);
    document.body.classList.remove("print-mode");
    root.remove();
    document.title = printTitleBackup;
    printTitleBackup = null;
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

/* ================= DATA VIEW (import/export) ================= */
function initDataView() {
  document.getElementById("exportJsonBtn").addEventListener("click", () => {
    const blob = new Blob([exportStateJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edt_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById("importJsonInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importStateJSON(reader.result);
        renderAll();
        showToast("Import réussi");
      } catch (err) {
        alert("Erreur d'import : " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  document.getElementById("resetDataBtn").addEventListener("click", () => {
    if (!confirm("Cela va effacer toutes les données actuelles et charger la démonstration. Continuer ?")) return;
    resetToDemo();
    renderAll();
    showToast("Données réinitialisées");
  });
}

/* ================= SEANCE MODAL ================= */
function initSeanceModal() {
  document.getElementById("seanceModalClose").addEventListener("click", closeSeanceModal);
  document.getElementById("seanceCancelBtn").addEventListener("click", closeSeanceModal);
  document.getElementById("seanceSaveBtn").addEventListener("click", saveSeanceFromModal);
  document.getElementById("seanceDeleteBtn").addEventListener("click", deleteSeanceFromModal);

  ["seanceModule", "seanceTeacher", "seanceRoom", "seanceDay", "seanceStartSlot", "seanceDuration"]
    .forEach(id => document.getElementById(id).addEventListener("change", updateModalWarnings));

  document.getElementById("seanceModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "seanceModalOverlay") closeSeanceModal();
  });
}

/** Semestre de contexte d'une séance : groupe ciblé, puis groupe de la séance existante. */
function seanceContextSemester(session, existingSeance, prefill) {
  const groupIds = existingSeance?.groupIds || prefill?.groupIds || [];
  const semesters = Array.from(new Set(groupIds
    .map(id => session.groups.find(g => g.id === id)?.semestre)
    .filter(Boolean)));
  return semesters.length === 1 ? semesters[0] : "";
}

/** Modules proposés selon le semestre du groupe et, si choisi, l'enseignant. */
function eligibleSeanceModules(session, semester, teacherId = "") {
  return session.modules.filter(m =>
    (!semester || m.semestre === semester) &&
    (!teacherId || teacherCanTeachModule(session.teachers.find(t => t.id === teacherId), m.id))
  );
}

/** Un jour est proposé si l'enseignant a au moins une plage continue libre assez longue. */
function isTeacherAvailableOnDay(session, teacher, day, duration = 1) {
  if (!teacher) return false;
  const slots = session.config.slots || [];
  const needed = Math.max(1, Math.floor(Number(duration) || 1));
  if (slots.length < needed) return false;
  for (let start = 0; start <= slots.length - needed; start++) {
    let available = true;
    for (let offset = 0; offset < needed; offset++) {
      if (isTeacherUnavailable(teacher, day, start + offset)) { available = false; break; }
    }
    if (available) return true;
  }
  return false;
}

function eligibleSeanceDays(session, teacherId, duration = 1) {
  const teacher = session.teachers.find(t => t.id === teacherId);
  if (!teacher) return [];
  return (session.config.days || []).filter(day => isTeacherAvailableOnDay(session, teacher, day, duration));
}

/** Groupes proposés pour un module : même semestre, et association explicite si elle existe. */
function eligibleSeanceGroups(session, moduleId, semester) {
  const module = session.modules.find(m => m.id === moduleId);
  if (!module) return [];
  const sameSemester = session.groups.filter(g => !semester || g.semestre === semester);
  const associated = new Set(module.groupIds || []);
  return associated.size
    ? sameSemester.filter(g => associated.has(g.id))
    : sameSemester;
}

function renderSeanceGroupCheckboxes(session, wrap, moduleId, semester, selectedIds = []) {
  wrap.innerHTML = "";
  const allowed = eligibleSeanceGroups(session, moduleId, semester);
  allowed.forEach(g => {
    const id = "grpchk_" + g.id;
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = g.id;
    cb.id = id;
    cb.checked = selectedIds.includes(g.id);
    cb.addEventListener("change", () => {
      updateSeanceRoomDefaultForGroups(session);
      updateModalWarnings();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + g.name));
    wrap.appendChild(label);
  });
  if (!allowed.length) {
    wrap.appendChild(el("span", { class: "hint" }, "Aucun groupe compatible avec le semestre de ce module."));
  }
}

/** Une séance multi-groupes est mutualisée et propose l'amphi ; une séance isolée
 * reprend la salle par défaut du groupe, tout en laissant l'utilisateur la modifier.
 * Un module transversal propose toujours l'amphi par défaut, quel que soit le nombre
 * de groupes cochés (il se déroule par nature en amphi, cf. affectations.js). */
function updateSeanceRoomDefaultForGroups(session) {
  const ids = Array.from(document.querySelectorAll("#seanceGroupsCheckboxes input:checked")).map(cb => cb.value);
  const roomSelect = document.getElementById("seanceRoom");
  if (!roomSelect) return;
  const moduleSelect = document.getElementById("seanceModule");
  const mod = moduleSelect ? session.modules.find(m => m.id === moduleSelect.value) : null;
  let preferred = "";
  if (mod && typeof isTransversal === "function" && isTransversal(mod)) preferred = defaultAmphiRoomId(session);
  else if (ids.length > 1) preferred = defaultAmphiRoomId(session);
  else if (ids.length === 1) preferred = (session.groups.find(g => g.id === ids[0]) || {}).defaultRoomId || "";
  if (preferred && Array.from(roomSelect.options).some(o => o.value === preferred)) roomSelect.value = preferred;
}

/** Durée par défaut d'une nouvelle séance selon la nature du module : 2 créneaux pour
 * un module métier (valeur courante d'un cours classique), 1 créneau pour un module
 * transversal (séance de 1h30 en amphi, cf. affectations.js). Sans module choisi, 1. */
function defaultDurationForModule(mod) {
  if (!mod) return 1;
  return (typeof isTransversal === "function" && isTransversal(mod)) ? 1 : 2;
}

function openSeanceModal(existingSeance, prefill) {
  const session = getCurrentSession();
  editingSeanceId = existingSeance ? existingSeance.id : null;
  const contextSemester = seanceContextSemester(session, existingSeance, prefill);

  document.getElementById("seanceModalTitle").textContent = existingSeance ? "Modifier la séance" : "Nouvelle séance";
  document.getElementById("seanceDeleteBtn").style.display = existingSeance ? "inline-block" : "none";

  const data = existingSeance || {
    id: null,
    moduleId: prefill?.moduleId || "",
    teacherId: prefill?.teacherId || "",
    groupIds: prefill?.groupIds || [],
    roomId: prefill?.roomId || "",
    day: prefill?.day || "",
    startSlotIndex: prefill?.startSlotIndex !== undefined ? prefill.startSlotIndex : 0,
    duration: 1,
    color: prefill?.color || randomColor(),
  };
  const groupsWrap = document.getElementById("seanceGroupsCheckboxes");
  const moduleSelect = document.getElementById("seanceModule");
  const teacherSelect = document.getElementById("seanceTeacher");
  const roomSelect = document.getElementById("seanceRoom");
  const daySelect = document.getElementById("seanceDay");
  const slotSelect = document.getElementById("seanceStartSlot");
  const durationInput = document.getElementById("seanceDuration");

  // Salle : groupe unique → salle par défaut du groupe ; plusieurs groupes → amphi.
  roomSelect.innerHTML = "";
  session.rooms.forEach(r => roomSelect.appendChild(new Option(`${r.name} (cap. ${r.capacity})`, r.id)));
  const initialModuleForDefaults = session.modules.find(m => m.id === data.moduleId);
  const initialIsTransversal = initialModuleForDefaults && typeof isTransversal === "function" && isTransversal(initialModuleForDefaults);
  const groupDefaultRoom = initialIsTransversal
    ? defaultAmphiRoomId(session)
    : data.groupIds.length === 1
      ? (session.groups.find(g => g.id === data.groupIds[0]) || {}).defaultRoomId
      : data.groupIds.length > 1 ? defaultAmphiRoomId(session) : "";
  const initialRoomId = (!existingSeance && groupDefaultRoom) || data.roomId || groupDefaultRoom || "";
  roomSelect.value = Array.from(roomSelect.options).some(option => option.value === initialRoomId)
    ? initialRoomId
    : ((roomSelect.options[0] || {}).value || "");

  // Les jours seront reconstruits après sélection de l'enseignant.
  daySelect.innerHTML = "";
  const rebuildAvailableDays = (preferredDay = daySelect.value) => {
    const teacher = session.teachers.find(t => t.id === teacherSelect.value);
    const available = teacher ? eligibleSeanceDays(session, teacher.id, durationInput.value) : [];
    daySelect.innerHTML = "";
    daySelect.appendChild(new Option(!teacher
      ? "— Choisir d’abord un enseignant —"
      : available.length ? "— Choisir un jour disponible —" : "— Aucun jour disponible —", ""));
    available.forEach(day => daySelect.appendChild(new Option(day, day)));

    // En modification, conserver visible le jour historique même s'il est devenu indisponible,
    // afin que l'utilisateur puisse corriger la séance sans perdre sa valeur actuelle.
    const editingDay = existingSeance?.day;
    if (editingDay && teacher?.id === existingSeance?.teacherId && !available.includes(editingDay)) {
      daySelect.appendChild(new Option(`${editingDay} — indisponible pour cet enseignant`, editingDay));
    }
    const desired = preferredDay || data.day;
    if (Array.from(daySelect.options).some(option => option.value === desired)) daySelect.value = desired;
    else daySelect.value = available[0] || "";
  };

  const setModuleOptions = (teacherId, preferredModuleId) => {
    const modules = eligibleSeanceModules(session, contextSemester, teacherId || "");
    moduleSelect.innerHTML = "";
    moduleSelect.appendChild(new Option("— Choisir un module —", ""));
    modules.forEach(m => moduleSelect.appendChild(new Option(m.name, m.id)));
    const current = modules.some(m => m.id === preferredModuleId) ? preferredModuleId : "";
    moduleSelect.value = current;
    return modules;
  };

  const populateTeacherSelect = (moduleId, preferredTeacherId) => {
    const eligible = moduleId ? eligibleTeachersForModule(session, moduleId) : session.teachers;
    const current = existingSeance && moduleId === existingSeance.moduleId && preferredTeacherId === existingSeance.teacherId
      ? session.teachers.find(t => t.id === preferredTeacherId)
      : null;
    const options = current && !eligible.some(t => t.id === current.id) ? [current, ...eligible] : eligible;
    teacherSelect.innerHTML = "";
    teacherSelect.appendChild(new Option(moduleId && !eligible.length
      ? "— Aucun enseignant n’assure ce module —"
      : "— Choisir un enseignant —", ""));
    options.forEach(t => teacherSelect.appendChild(new Option(t.name, t.id)));
    teacherSelect.value = options.some(t => t.id === preferredTeacherId) ? preferredTeacherId : "";
  };

  // Start slot select
  slotSelect.innerHTML = "";
  session.config.slots.forEach((s, idx) => slotSelect.appendChild(new Option(s.label, idx)));

  // Conserver un enseignant prérempli seulement s'il assure bien le module choisi.
  let preferredTeacherId = data.teacherId || "";
  const teacherCanKeepModule = teacherCanTeachModule(session.teachers.find(t => t.id === preferredTeacherId), data.moduleId);
  if (!existingSeance && data.moduleId && !teacherCanKeepModule) {
    preferredTeacherId = "";
  }
  const initialModules = setModuleOptions(teacherCanKeepModule ? preferredTeacherId : "", data.moduleId || "");
  if (!initialModules.some(m => m.id === moduleSelect.value)) {
    preferredTeacherId = "";
    moduleSelect.value = initialModules[0]?.id || "";
  }
  populateTeacherSelect(moduleSelect.value, preferredTeacherId);

  moduleSelect.onchange = () => {
    populateTeacherSelect(moduleSelect.value, teacherSelect.value);
    const selectedGroups = Array.from(groupsWrap.querySelectorAll("input:checked")).map(cb => cb.value);
    renderSeanceGroupCheckboxes(session, groupsWrap, moduleSelect.value, contextSemester, selectedGroups);
    if (!editingSeanceId && !teacherSelect.value) applyAffectationDefaults();
    if (!editingSeanceId) {
      const mod = session.modules.find(m => m.id === moduleSelect.value);
      durationInput.value = defaultDurationForModule(mod);
    }
    updateSeanceRoomDefaultForGroups(session);
    rebuildAvailableDays("");
    updateModalWarnings();
  };

  teacherSelect.onchange = () => {
    const selectedGroups = Array.from(groupsWrap.querySelectorAll("input:checked")).map(cb => cb.value);
    const previousModuleId = moduleSelect.value;
    setModuleOptions(teacherSelect.value, previousModuleId);
    if (moduleSelect.value !== previousModuleId) {
      renderSeanceGroupCheckboxes(session, groupsWrap, moduleSelect.value, contextSemester, selectedGroups);
      populateTeacherSelect(moduleSelect.value, teacherSelect.value);
      updateSeanceRoomDefaultForGroups(session);
    }
    rebuildAvailableDays("");
    updateModalWarnings();
  };
  durationInput.onchange = () => {
    rebuildAvailableDays(daySelect.value);
    updateModalWarnings();
  };

  document.getElementById("seanceId").value = data.id || "";
  if (existingSeance) {
    durationInput.value = data.duration || 1;
  } else {
    const initialMod = session.modules.find(m => m.id === moduleSelect.value);
    durationInput.value = defaultDurationForModule(initialMod);
  }
  slotSelect.value = String(data.startSlotIndex);
  document.getElementById("seanceColor").value = data.color || "#4f8cf7";

  renderSeanceGroupCheckboxes(session, groupsWrap, moduleSelect.value, contextSemester, data.groupIds);
  if (!existingSeance && moduleSelect.value && !teacherSelect.value) applyAffectationDefaults();
  rebuildAvailableDays(data.day || "");

  updateModalWarnings();
  document.getElementById("seanceModalOverlay").classList.remove("hidden");
}

function closeSeanceModal() {
  document.getElementById("seanceModalOverlay").classList.add("hidden");
  editingSeanceId = null;
}

function readSeanceFormAsCandidate() {
  const groupIds = Array.from(document.querySelectorAll("#seanceGroupsCheckboxes input:checked")).map(cb => cb.value);
  return {
    id: editingSeanceId,
    moduleId: document.getElementById("seanceModule").value,
    teacherId: document.getElementById("seanceTeacher").value,
    groupIds,
    roomId: document.getElementById("seanceRoom").value,
    day: document.getElementById("seanceDay").value,
    startSlotIndex: Number(document.getElementById("seanceStartSlot").value),
    duration: Math.max(1, Number(document.getElementById("seanceDuration").value) || 1),
    color: document.getElementById("seanceColor").value,
  };
}

function updateModalWarnings() {
  const session = getCurrentSession();
  const candidate = readSeanceFormAsCandidate();
  const warningsBox = document.getElementById("seanceModalWarnings");
  warningsBox.innerHTML = "";

  if (candidate.groupIds.length === 0) {
    warningsBox.appendChild(el("div", { class: "warning-item error" }, "⚠️ Sélectionnez au moins un groupe."));
  }

  const warnings = checkCandidateSeance(session, { ...candidate, id: candidate.id || "___new___" });
  warnings.forEach(w => {
    warningsBox.appendChild(el("div", { class: "warning-item" + (w.level === "error" ? " error" : "") }, w.text));
  });
  checkCandidateAffectation(session, candidate).forEach(w => {
    warningsBox.appendChild(el("div", { class: "warning-item" }, w.text));
  });
}

/**
 * Sur une nouvelle séance : quand on choisit un module qui a des affectations, on propose
 * l'enseignant + ses groupes (en priorité une affectation pas encore planifiée) + l'amphi.
 */
function applyAffectationDefaults() {
  const session = getCurrentSession();
  const moduleId = document.getElementById("seanceModule").value;
  const affs = getModuleAffectations(session, moduleId).filter(a => a.groupIds.length);
  if (affs.length) {
    const selectedGroups = Array.from(document.querySelectorAll("#seanceGroupsCheckboxes input:checked")).map(cb => cb.value);
    const groupAff = selectedGroups.length ? affs.find(a => selectedGroups.some(id => a.groupIds.includes(id))) : null;
    const aff = groupAff || affs.find(a => affectationSeanceCount(session, a) === 0) || affs[0];
    document.getElementById("seanceTeacher").value = aff.teacherId;
    const groupsToSelect = selectedGroups.length ? selectedGroups : aff.groupIds;
    document.querySelectorAll("#seanceGroupsCheckboxes input").forEach(cb => { cb.checked = groupsToSelect.includes(cb.value); });
    updateSeanceRoomDefaultForGroups(session);
    const existing = session.seances.find(s => s.moduleId === moduleId && s.color);
    if (existing) document.getElementById("seanceColor").value = existing.color;
  }
  updateModalWarnings();
}

function saveSeanceFromModal() {
  const session = getCurrentSession();
  const candidate = readSeanceFormAsCandidate();
  // Une séance créée ou modifiée à la main via cette fenêtre devient "manuelle" :
  // elle ne sera plus jamais écrasée par la répartition/planification automatique.
  candidate.auto = false;

  if (candidate.groupIds.length === 0) {
    alert("Veuillez sélectionner au moins un groupe.");
    return;
  }

  if (editingSeanceId) {
    const idx = session.seances.findIndex(s => s.id === editingSeanceId);
    if (idx >= 0) session.seances[idx] = { ...session.seances[idx], ...candidate, id: editingSeanceId };
  } else {
    candidate.id = uid("se");
    session.seances.push(candidate);
  }

  // La configuration manuelle (Planning par groupe/semestre, Vue enseignant, Vue salle) fait foi :
  // elle met à jour l'affectation module ↔ enseignant correspondante (onglet Affectations).
  const savedSeance = session.seances.find(s => s.id === candidate.id);
  if (typeof syncAffectationFromSeance === "function") syncAffectationFromSeance(session, savedSeance);

  saveState(editingSeanceId ? "🖊️ Séance modifiée manuellement" : "🖊️ Séance créée manuellement");
  closeSeanceModal();
  refreshAllSelectorsAndGrids();
  showToast("Séance enregistrée");
}

function deleteSeanceFromModal() {
  if (!editingSeanceId) return;
  if (!confirm("Supprimer cette séance ?")) return;
  const session = getCurrentSession();
  session.seances = session.seances.filter(s => s.id !== editingSeanceId);
  saveState("🗑️ Séance supprimée");
  closeSeanceModal();
  refreshAllSelectorsAndGrids();
  showToast("Séance supprimée");
}

function randomColor() {
  const palette = ["#fcebc0", "#f6c9c9", "#d7ecc8", "#c7e3f7", "#e6d7f7", "#f7d7ec", "#d7f7ec"];
  return palette[Math.floor(Math.random() * palette.length)];
}

/* ================= AVAILABILITY MODAL ================= */
function initAvailabilityModal() {
  document.getElementById("availabilityModalClose").addEventListener("click", closeAvailabilityModal);
  document.getElementById("availabilityCloseBtn").addEventListener("click", closeAvailabilityModal);
  document.getElementById("availabilityModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "availabilityModalOverlay") closeAvailabilityModal();
  });
}

function openAvailabilityModal(teacherId) {
  renderAvailabilityGrid(teacherId);
  document.getElementById("availabilityModalOverlay").classList.remove("hidden");
}

function closeAvailabilityModal() {
  document.getElementById("availabilityModalOverlay").classList.add("hidden");
}

/* ================= ROOM AVAILABILITY MODAL ================= */
function initRoomAvailabilityModal() {
  document.getElementById("roomAvailabilityModalClose").addEventListener("click", closeRoomAvailabilityModal);
  document.getElementById("roomAvailabilityCloseBtn").addEventListener("click", closeRoomAvailabilityModal);
  document.getElementById("roomAvailabilityModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "roomAvailabilityModalOverlay") closeRoomAvailabilityModal();
  });
}

function openRoomAvailabilityModal(roomId) {
  renderRoomAvailabilityGrid(roomId);
  document.getElementById("roomAvailabilityModalOverlay").classList.remove("hidden");
}

function closeRoomAvailabilityModal() {
  document.getElementById("roomAvailabilityModalOverlay").classList.add("hidden");
}

/* ================= TEACHER MODULES MODAL ================= */
function initTeacherModulesModal() {
  document.getElementById("teacherModulesModalClose").addEventListener("click", closeTeacherModulesModal);
  document.getElementById("teacherModulesCloseBtn").addEventListener("click", closeTeacherModulesModal);
  document.getElementById("teacherModulesModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "teacherModulesModalOverlay") closeTeacherModulesModal();
  });
}

function openTeacherModulesModal(teacherId) {
  renderTeacherModulesModal(teacherId);
  document.getElementById("teacherModulesModalOverlay").classList.remove("hidden");
}

function closeTeacherModulesModal() {
  document.getElementById("teacherModulesModalOverlay").classList.add("hidden");
}

/* ================= GENERIC PROMPT MODAL ================= */
let promptOnSave = null;

function openPromptModal({ title, fields, onSave, intro, okLabel }) {
  document.getElementById("promptModalTitle").textContent = title;
  document.getElementById("promptSaveBtn").textContent = okLabel || "OK";
  const body = document.getElementById("promptModalBody");
  body.innerHTML = "";
  if (intro) {
    const p = document.createElement("p");
    p.className = "hint";
    p.style.margin = "0";
    p.textContent = intro;
    body.appendChild(p);
  }
  fields.forEach(f => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.flexDirection = "column";
    label.style.gap = "5px";
    label.style.fontSize = "12.5px";
    label.style.fontWeight = "600";
    label.style.color = "#6b7285";
    label.textContent = f.label;
    let input;
    if (f.type === "select") {
      input = document.createElement("select");
      (f.options || []).forEach(([value, text]) => input.appendChild(new Option(text, value)));
      input.value = f.value !== undefined ? f.value : (f.options && f.options[0] ? f.options[0][0] : "");
    } else {
      input = document.createElement("input");
      input.type = f.type || "text";
      input.value = f.value || "";
    }
    input.id = "promptField_" + f.id;
    input.style.marginTop = "4px";
    input.style.padding = "8px 10px";
    input.style.border = "1px solid #e3e7f1";
    input.style.borderRadius = "8px";
    input.style.fontWeight = "400";
    label.appendChild(input);
    body.appendChild(label);
  });
  promptOnSave = () => {
    const values = {};
    fields.forEach(f => { values[f.id] = document.getElementById("promptField_" + f.id).value; });
    onSave(values);
  };
  document.getElementById("promptModalOverlay").classList.remove("hidden");
}

function closePromptModal() {
  document.getElementById("promptModalOverlay").classList.add("hidden");
  promptOnSave = null;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("promptModalClose").addEventListener("click", closePromptModal);
  document.getElementById("promptCancelBtn").addEventListener("click", closePromptModal);
  document.getElementById("promptSaveBtn").addEventListener("click", () => {
    if (promptOnSave) promptOnSave();
    closePromptModal();
  });
  document.getElementById("promptModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "promptModalOverlay") closePromptModal();
  });
});

/* ================= TOAST ================= */
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 250);
  }, 2200);
}
