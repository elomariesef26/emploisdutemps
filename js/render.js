/* ============================================================
   RENDER.JS — Construction du DOM pour toutes les vues
   ============================================================ */

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

/* ================= DASHBOARD ================= */
function renderDashboard() {
  const session = getCurrentSession();
  const conflicts = computeConflicts(session);
  const affIncomplete = computeAffectationIssues(session).filter(i => i.level === "error").reduce((n, i) => n + (i.count || 1), 0);

  const stats = [
    { num: session.groups.length, label: "Groupes", cls: "" },
    { num: session.teachers.length, label: "Enseignants", cls: "" },
    { num: session.rooms.length, label: "Salles", cls: "" },
    { num: session.modules.length, label: "Modules", cls: "" },
    { num: session.seances.length, label: "Séances planifiées", cls: "" },
    { num: conflicts.length, label: "Conflits actifs", cls: conflicts.length ? "danger" : "success" },
    { num: affIncomplete, label: "Affectations incomplètes", cls: affIncomplete ? "danger" : "success" },
  ];

  const statGrid = document.getElementById("statGrid");
  statGrid.innerHTML = "";
  stats.forEach(s => {
    statGrid.appendChild(el("div", { class: "stat-card " + s.cls }, [
      el("div", { class: "num" }, String(s.num)),
      el("div", { class: "label" }, s.label),
    ]));
  });

  const dashboardConflicts = document.getElementById("dashboardConflicts");
  renderConflictList(dashboardConflicts, conflicts.slice(0, 5), session);

  updateConflictBadge(conflicts.length);
}

function updateConflictBadge(count) {
  const badge = document.getElementById("conflictBadge");
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function renderConflictList(container, conflicts, session) {
  container.innerHTML = "";
  if (conflicts.length === 0) {
    container.appendChild(el("div", { class: "empty-state" }, "✅ Aucun conflit détecté."));
    return;
  }
  const typeLabels = { teacher: "Conflit enseignant", room: "Conflit salle", group: "Conflit groupe", capacity: "Capacité dépassée", availability: "Indisponibilité enseignant", roomAvailability: "Indisponibilité salle", educationalAction: "Actions éducatives", moduleTeacher: "Conflit d'affectation", teacherCrossSession: "Conflit enseignant entre filières", roomCrossSession: "Conflit salle entre filières", roomPool: "Salle hors pool autorisé", volumeMismatch: "Volume horaire", outOfBounds: "Hors grille horaire", defaultRoomCapacity: "Salle par défaut trop petite" };
  conflicts.forEach(c => {
    const relatedSeances = (c.seanceIds || [])
      .map(id => session.seances.find(s => s.id === id))
      .filter(Boolean);
    const correctionActions = relatedSeances.length
      ? el("div", { class: "conflict-actions" }, relatedSeances.map((s, index) => {
        const module = session.modules.find(m => m.id === s.moduleId);
        const groupNames = (s.groupIds || [])
          .map(id => session.groups.find(g => g.id === id)?.name)
          .filter(Boolean)
          .join(", ");
        return el("button", {
          class: "btn small conflict-fix-btn",
          title: "Ouvrir cette séance pour la corriger",
          onclick: (event) => {
            event.stopPropagation();
            openSeanceModal(s);
          },
        }, relatedSeances.length > 1
          ? `✏️ Modifier séance ${index + 1}${module ? ` — ${module.name}` : ""}`
          : `✏️ Corriger${module ? ` — ${module.name}` : ""}${groupNames ? ` (${groupNames})` : ""}`);
      }))
      : null;
    const item = el("div", { class: "conflict-item conflict-item-clickable", title: "Cliquer pour ouvrir la première séance concernée" }, [
      el("div", { class: "ctype" }, typeLabels[c.type] || c.type),
      el("div", {}, c.message),
      el("div", { class: "cdetail" }, c.detail),
      correctionActions,
    ]);
    item.addEventListener("click", () => {
      if (relatedSeances[0]) openSeanceModal(relatedSeances[0]);
    });
    container.appendChild(item);
  });
}

/* ================= CONFIG VIEW ================= */
/** Aperçu du logo importé dans la vue Configuration (+ nom de fichier, ou message si aucun). */
function renderLogoPreview() {
  const session = getCurrentSession();
  const wrap = document.getElementById("logoPreviewWrap");
  const removeBtn = document.getElementById("logoRemoveBtn");
  wrap.innerHTML = "";
  if (session.logo && session.logo.dataUrl) {
    wrap.appendChild(el("img", { src: session.logo.dataUrl, alt: "Logo" }));
    if (session.logo.name) wrap.title = session.logo.name;
    if (removeBtn) removeBtn.disabled = false;
  } else {
    wrap.appendChild(el("span", { class: "hint" }, "Aucun logo importé"));
    if (removeBtn) removeBtn.disabled = true;
  }
}

/** Aperçu du sceau importé dans la vue Configuration (+ nom de fichier, ou message si aucun). */
function renderSealPreview() {
  const session = getCurrentSession();
  const wrap = document.getElementById("sealPreviewWrap");
  const removeBtn = document.getElementById("sealRemoveBtn");
  wrap.innerHTML = "";
  if (session.seal && session.seal.dataUrl) {
    wrap.appendChild(el("img", { src: session.seal.dataUrl, alt: "Sceau" }));
    if (session.seal.name) wrap.title = session.seal.name;
    if (removeBtn) removeBtn.disabled = false;
  } else {
    wrap.appendChild(el("span", { class: "hint" }, "Aucun sceau importé"));
    if (removeBtn) removeBtn.disabled = true;
  }
}

const DOCUMENT_FORMAT_ITEMS = [
  ["title", "Titre « Emploi du temps »"], ["sessionType", "Type de session"], ["statut", "Statut (provisoire / final)"],
  ["year", "Année universitaire"], ["filiere", "Filière et spécialité"],
  ["metaLeft", "Métadonnée gauche (semestre / enseignant / salle)"], ["metaRight", "Métadonnée droite (groupe / charge / capacité)"],
  ["slot", "En-têtes des créneaux"], ["day", "Noms des jours"], ["module", "Intitulé du module"],
  ["teacher", "Nom de l’enseignant"], ["room", "Nom de la salle"], ["groups", "Groupes mutualisés"],
  ["action", "Actions éducatives"], ["footer", "Pied de page / date"],
];
const DOCUMENT_FORMAT_FONTS = ["Arial", "Calibri", "Georgia", "Times New Roman", "Verdana"];
const DOCUMENT_THEME_ITEMS = [
  ["pageBackground", "Fond de la page", "#ffffff"], ["titleColor", "Titres et session", "#1f4e78"],
  ["slotBackground", "Fond des créneaux", "#fff900"], ["slotText", "Texte des créneaux", "#000000"],
  ["dayBackground", "Fond des jours", "#fff900"], ["dayText", "Texte des jours", "#000000"],
  ["sessionBackground", "Fond des séances", "#92d050"], ["sessionText", "Texte des séances", "#000000"],
  ["actionBackground", "Fond des actions éducatives", "#dbeafe"], ["actionText", "Texte des actions éducatives", "#1e3a8a"],
  ["borderColor", "Bordures du tableau", "#000000"],
];
const DOCUMENT_VISIBILITY_ITEMS = [
  ["logo", "Logo"], ["seal", "Sceau / cachet"], ["title", "Titre du document"],
  ["sessionType", "Type de session"], ["year", "Année universitaire"], ["filiere", "Filière et spécialité"],
  ["meta", "Semestre et informations complémentaires"], ["slot", "En-têtes des créneaux"], ["day", "Noms des jours"],
  ["module", "Intitulé du module"], ["teacher", "Nom de l’enseignant"], ["room", "Nom de la salle"],
  ["groups", "Groupes mutualisés"], ["action", "Actions éducatives"], ["footer", "Pied de page / date"],
];

function commitDocumentFormat(session) {
  session.documentFormat = normalizeDocumentFormat(session.documentFormat);
  saveState();
  if (typeof refreshAllSelectorsAndGrids === "function") refreshAllSelectorsAndGrids();
}

function renderDocumentFormatSettings(session) {
  session.documentFormat = normalizeDocumentFormat(session.documentFormat);
  const format = session.documentFormat;
  const imagesWrap = document.getElementById("documentImageSizes");
  const tableBody = document.getElementById("documentFormatTableBody");
  imagesWrap.innerHTML = "";
  tableBody.innerHTML = "";

  [["logo", "Logo"], ["seal", "Sceau / cachet"]].forEach(([key, label]) => {
    const maxWidth = key === "logo" ? 120 : 60;
    const width = el("input", { type: "number", min: "5", max: String(maxWidth), step: "1", value: format[key].widthMm, "aria-label": `${label}, largeur en millimètres` });
    const height = el("input", { type: "number", min: "5", max: "60", step: "1", value: format[key].heightMm, "aria-label": `${label}, hauteur en millimètres` });
    const commitDimension = (axis, input) => {
      const value = Number(input.value);
      const maximum = key === "logo" && axis === "widthMm" ? 120 : 60;
      if (!Number.isFinite(value)) { input.value = session.documentFormat[key][axis]; return; }
      session.documentFormat[key][axis] = Math.max(5, Math.min(maximum, Math.round(value)));
      commitDocumentFormat(session);
      input.value = session.documentFormat[key][axis];
    };
    width.addEventListener("change", () => commitDimension("widthMm", width));
    height.addEventListener("change", () => commitDimension("heightMm", height));
    imagesWrap.appendChild(el("div", { class: "document-size-control" }, [
      el("strong", {}, label),
      el("label", {}, ["Largeur (mm)", width]),
      el("label", {}, ["Hauteur (mm)", height]),
    ]));
  });

  DOCUMENT_FORMAT_ITEMS.forEach(([key, label]) => {
    const item = format.elements[key];
    const font = el("select", { "aria-label": `${label}, police` }, DOCUMENT_FORMAT_FONTS.map(name => el("option", { value: name }, name)));
    font.value = item.fontFamily;
    const size = el("input", { type: "number", min: "6", max: "36", step: "0.5", value: item.fontSizePt, "aria-label": `${label}, taille en points` });
    const bold = el("input", { type: "checkbox", "aria-label": `${label}, gras` });
    bold.checked = item.bold;
    const align = el("select", { "aria-label": `${label}, alignement horizontal` }, [
      el("option", { value: "left" }, "Gauche"), el("option", { value: "center" }, "Centré"), el("option", { value: "right" }, "Droite"),
    ]);
    align.value = item.align;
    const valign = el("select", { "aria-label": `${label}, alignement vertical` }, [
      el("option", { value: "top" }, "Haut"), el("option", { value: "middle" }, "Centré"), el("option", { value: "bottom" }, "Bas"),
    ]);
    valign.value = item.valign;
    const color = el("input", { type: "color", value: item.textColor, "aria-label": `${label}, couleur du texte` });

    font.addEventListener("change", () => { session.documentFormat.elements[key].fontFamily = font.value; commitDocumentFormat(session); });
    size.addEventListener("change", () => {
      const n = Number(size.value);
      if (!Number.isFinite(n)) { size.value = session.documentFormat.elements[key].fontSizePt; return; }
      session.documentFormat.elements[key].fontSizePt = Math.max(6, Math.min(36, n));
      commitDocumentFormat(session);
      size.value = session.documentFormat.elements[key].fontSizePt;
    });
    bold.addEventListener("change", () => { session.documentFormat.elements[key].bold = bold.checked; commitDocumentFormat(session); });
    align.addEventListener("change", () => { session.documentFormat.elements[key].align = align.value; commitDocumentFormat(session); });
    valign.addEventListener("change", () => { session.documentFormat.elements[key].valign = valign.value; commitDocumentFormat(session); });
    color.addEventListener("change", () => { session.documentFormat.elements[key].textColor = color.value; commitDocumentFormat(session); });
    tableBody.appendChild(el("tr", {}, [
      el("td", {}, label), el("td", {}, font), el("td", {}, size),
      el("td", {}, el("label", { class: "format-bold" }, bold)), el("td", {}, align), el("td", {}, valign),
      el("td", {}, color),
    ]));
  });
}

function renderDocumentThemePreview(session, groupId) {
  const wrap = document.getElementById("themePreviewWrap");
  wrap.innerHTML = "";
  const group = session.groups.find(item => item.id === groupId);
  if (!group) {
    wrap.appendChild(el("div", { class: "empty-state" }, "Ajoutez un groupe pour prévisualiser le thème."));
    return;
  }
  wrap.appendChild(buildGroupDocSection(session, group));
}

function refreshDocumentThemePreview(session) {
  const wrap = document.getElementById("themePreviewWrap");
  if (wrap && !wrap.classList.contains("hidden")) {
    renderDocumentThemePreview(session, document.getElementById("themePreviewGroup").value);
  }
}

function commitDocumentTheme(session) {
  session.documentTheme = normalizeDocumentTheme(session.documentTheme);
  saveState();
  if (typeof refreshAllSelectorsAndGrids === "function") refreshAllSelectorsAndGrids();
  refreshDocumentThemePreview(session);
}

function renderDocumentThemeSettings(session) {
  session.documentTheme = normalizeDocumentTheme(session.documentTheme);
  const theme = session.documentTheme;
  const controls = document.getElementById("documentThemeControls");
  const groupSelect = document.getElementById("themePreviewGroup");
  const previewWrap = document.getElementById("themePreviewWrap");
  const previewToggle = document.getElementById("themePreviewToggle");
  const preserveColors = document.getElementById("themePreserveSessionColors");
  controls.innerHTML = "";
  DOCUMENT_THEME_ITEMS.forEach(([key, label, defaultColor]) => {
    const input = el("input", { type: "color", value: theme[key] || defaultColor, "aria-label": label });
    input.addEventListener("input", () => {
      session.documentTheme[key] = input.value;
      refreshDocumentThemePreview(session);
    });
    input.addEventListener("change", () => {
      session.documentTheme[key] = input.value;
      commitDocumentTheme(session);
    });
    controls.appendChild(el("label", { class: "theme-color-control" }, [el("span", {}, label), input]));
  });

  preserveColors.checked = theme.preserveSessionColors;
  preserveColors.onchange = () => {
    session.documentTheme.preserveSessionColors = preserveColors.checked;
    commitDocumentTheme(session);
  };

  const previousGroup = groupSelect.value;
  groupSelect.innerHTML = "";
  if (!session.groups.length) groupSelect.appendChild(el("option", { value: "" }, "Aucun groupe"));
  session.groups.forEach(group => groupSelect.appendChild(el("option", { value: group.id }, `${group.name} (S${group.semestre || "-"})`)));
  groupSelect.value = session.groups.some(group => group.id === previousGroup) ? previousGroup : (session.groups[0]?.id || "");
  groupSelect.disabled = session.groups.length === 0;
  groupSelect.onchange = () => refreshDocumentThemePreview(session);

  previewToggle.onclick = () => {
    const show = previewWrap.classList.contains("hidden");
    previewWrap.classList.toggle("hidden", !show);
    previewToggle.textContent = show ? "Masquer l’aperçu" : "Aperçu du thème";
    if (show) renderDocumentThemePreview(session, groupSelect.value);
  };

  renderDocumentVisibilitySettings(session);
}

function renderDocumentVisibilitySettings(session) {
  session.documentVisibility = normalizeDocumentVisibility(session.documentVisibility);
  const controls = document.getElementById("documentVisibilityControls");
  controls.innerHTML = "";
  DOCUMENT_VISIBILITY_ITEMS.forEach(([key, label]) => {
    const checkbox = el("input", { type: "checkbox", "aria-label": `Afficher : ${label}` });
    checkbox.checked = session.documentVisibility[key];
    checkbox.addEventListener("change", () => {
      session.documentVisibility[key] = checkbox.checked;
      session.documentVisibility = normalizeDocumentVisibility(session.documentVisibility);
      saveState();
      if (typeof refreshAllSelectorsAndGrids === "function") refreshAllSelectorsAndGrids();
      refreshDocumentThemePreview(session);
    });
    controls.appendChild(el("label", { class: "document-visibility-control" }, [checkbox, el("span", {}, label)]));
  });
}

/**
 * Reconstruit les options d'une liste déroulante à partir d'une liste de base et d'une
 * liste de choix personnalisés ajoutés par l'utilisateur (bouton "+"), dont un éventuel
 * choix vide (valeur ""). La valeur courante est toujours conservée, même si elle a été
 * retirée entre-temps des deux listes (évite de perdre silencieusement une donnée saisie).
 */
function populateSelectWithCustomOptions(select, baseOptions, customOptions, currentValue) {
  const seen = new Set();
  select.innerHTML = "";
  baseOptions.forEach(([v, l]) => { select.appendChild(new Option(l, v)); seen.add(v); });
  (customOptions || []).forEach(v => {
    if (seen.has(v)) return;
    seen.add(v);
    select.appendChild(new Option(v === "" ? "(vide)" : v, v));
  });
  if (!seen.has(currentValue)) {
    select.appendChild(new Option(currentValue === "" ? "(vide)" : currentValue, currentValue));
  }
  select.value = currentValue;
}

function renderConfigView() {
  const session = getCurrentSession();

  const sessionList = document.getElementById("sessionConfigList");
  sessionList.innerHTML = "";
  STATE.sessions.forEach(s => {
    const nameInput = inputCell(s.label, value => {
      if (!renameSessionById(s.id, value)) {
        nameInput.value = s.label;
        return;
      }
      s.label = String(value).trim();
    });
    nameInput.classList.add("session-name-input");
    sessionList.appendChild(el("div", { class: "session-config-row" }, [
      el("span", { class: "session-config-current" }, s.id === STATE.currentSessionId ? "● Active" : ""),
      nameInput,
      el("button", { class: "btn small", onclick: () => {
        STATE.currentSessionId = s.id;
        saveState();
        renderAll();
      } }, "Ouvrir"),
      el("button", { class: "btn small danger", onclick: () => deleteSessionById(s.id) }, "Supprimer"),
    ]));
  });

  // Document header info
  populateSelectWithCustomOptions(
    document.getElementById("cfgTypeSession"),
    [["Automne", "Automne"], ["Printemps", "Printemps"]],
    STATE.customTypeSessionOptions,
    session.typeSession || "Printemps"
  );
  populateSelectWithCustomOptions(
    document.getElementById("cfgStatut"),
    [["provisoire", "Provisoire"], ["final", "Final / Validé"]],
    STATE.customStatutOptions,
    session.statut || "provisoire"
  );
  document.getElementById("cfgAnnee").value = session.annee || "";
  document.getElementById("cfgFiliere").value = session.filiere || "";
  document.getElementById("cfgOption").value = session.option || "";
  document.getElementById("cfgStartDate").value = session.startDate || "";

  renderLogoPreview();
  renderSealPreview();
  renderDocumentFormatSettings(session);
  renderDocumentThemeSettings(session);

  // Days
  const daysConfig = document.getElementById("daysConfig");
  daysConfig.innerHTML = "";
  const ALL_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  ALL_DAYS.forEach(day => {
    const active = session.config.days.includes(day);
    const chip = el("div", { class: "day-chip" + (active ? " active" : "") }, day);
    chip.addEventListener("click", () => {
      const idx = session.config.days.indexOf(day);
      if (idx >= 0) {
        session.config.days.splice(idx, 1);
      } else {
        session.config.days.push(day);
        session.config.days.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
      }
      saveState();
      renderConfigView();
      refreshAllSelectorsAndGrids();
    });
    daysConfig.appendChild(chip);
  });

  // Slots table
  const tbody = document.querySelector("#slotsTable tbody");
  tbody.innerHTML = "";
  session.config.slots.forEach((slot, idx) => {
    const tr = el("tr", {}, [
      el("td", {}, String(idx + 1)),
      el("td", {}, inputCell(slot.label, v => { slot.label = v; commitConfig(); })),
      el("td", {}, inputCell(slot.start, v => { slot.start = v; commitConfig(); }, "time")),
      el("td", {}, inputCell(slot.end, v => { slot.end = v; commitConfig(); }, "time")),
      el("td", {}, el("button", { class: "icon-btn", onclick: () => {
        if (!confirm("Supprimer ce créneau ? Les séances qui l'utilisent seront décalées.")) return;
        session.config.slots.splice(idx, 1);
        commitConfig();
        renderConfigView();
        refreshAllSelectorsAndGrids();
      }}, "🗑️")),
    ]);
    tbody.appendChild(tr);
  });
}

function inputCell(value, onChange, type = "text") {
  const input = el("input", { type, value });
  input.addEventListener("change", () => onChange(input.value));
  return input;
}

function commitConfig() { saveState(); }

/* ================= RESOURCES VIEW ================= */
function renderResourcesView() {
  renderGroupsTable();
  renderRoomsTable();
  renderTeachersTable();
  renderModulesTable();
}

function renderGroupsTable() {
  const session = getCurrentSession();
  const tbody = document.querySelector("#groupsTable tbody");
  tbody.innerHTML = "";
  session.groups.forEach(g => {
    const roomSelect = el("select", {});
    session.rooms.forEach(r => {
      const opt = el("option", { value: r.id }, r.name);
      if (r.id === g.defaultRoomId) opt.selected = true;
      roomSelect.appendChild(opt);
    });
    roomSelect.addEventListener("change", () => { g.defaultRoomId = roomSelect.value; saveState(); });

    const actionDaySelect = el("select", {});
    actionDaySelect.appendChild(el("option", { value: "" }, "— Aucun jour —"));
    session.config.days.forEach(day => actionDaySelect.appendChild(el("option", { value: day }, day)));
    actionDaySelect.value = g.educationalActionDay || "";
    actionDaySelect.addEventListener("change", () => {
      const result = setGroupEducationalAction(session, g.id, actionDaySelect.value, g.educationalActionLabel);
      if (result.error === "day-conflict") {
        alert(`Le groupe « ${g.name} » a déjà un cours le ${actionDaySelect.value}. Choisissez un autre jour.`);
        actionDaySelect.value = g.educationalActionDay || "";
        return;
      }
      if (result.error) return;
      saveState();
      refreshAllSelectorsAndGrids();
    });
    const actionLabelInput = inputCell(g.educationalActionLabel || DEFAULT_EDUCATIONAL_ACTION_LABEL, value => {
      g.educationalActionLabel = normalizeEducationalActionLabel(value);
      saveState();
      refreshAllSelectorsAndGrids();
    });

    tbody.appendChild(el("tr", {}, [
      el("td", {}, inputCell(g.name, v => { g.name = v; saveState(); refreshAllSelectorsAndGrids(); })),
      el("td", {}, inputCell(g.semestre, v => { g.semestre = v; saveState(); })),
      el("td", {}, inputCell(String(g.effectif), v => { g.effectif = Number(v) || 0; saveState(); refreshConflictsViews(); }, "number")),
      el("td", {}, roomSelect),
      el("td", {}, actionDaySelect),
      el("td", {}, actionLabelInput),
      el("td", {}, deleteBtn(() => {
        if (!confirm(`Supprimer "${g.name}" ? Les séances associées perdront ce groupe.`)) return;
        session.groups = session.groups.filter(x => x.id !== g.id);
        session.seances.forEach(s => { s.groupIds = s.groupIds.filter(id => id !== g.id); });
        session.seances = session.seances.filter(s => s.groupIds.length > 0);
        saveState();
        renderResourcesView();
        refreshAllSelectorsAndGrids();
      })),
    ]));
  });
}

function renderRoomsTable() {
  const session = getCurrentSession();
  const tbody = document.querySelector("#roomsTable tbody");
  tbody.innerHTML = "";
  session.rooms.forEach(r => {
    const typeSelect = el("select", {}, [
      el("option", { value: "salle" }, "Salle"),
      el("option", { value: "amphi" }, "Amphithéâtre"),
    ]);
    typeSelect.value = r.type;
    typeSelect.addEventListener("change", () => { r.type = typeSelect.value; saveState(); });

    const nbUnavailable = Array.isArray(r.unavailable) ? r.unavailable.length : 0;

    tbody.appendChild(el("tr", {}, [
      el("td", {}, inputCell(r.name, v => { r.name = v; saveState(); refreshAllSelectorsAndGrids(); })),
      el("td", {}, inputCell(String(r.capacity), v => { r.capacity = Number(v) || 0; saveState(); refreshConflictsViews(); }, "number")),
      el("td", {}, typeSelect),
      el("td", {}, el("button", { class: "btn small", onclick: () => openRoomAvailabilityModal(r.id) },
        nbUnavailable > 0 ? `📅 Disponibilités (${nbUnavailable} bloqué${nbUnavailable > 1 ? "s" : ""})` : "📅 Disponibilités")),
      el("td", {}, deleteBtn(() => {
        if (!confirm(`Supprimer la salle "${r.name}" ?`)) return;
        session.rooms = session.rooms.filter(x => x.id !== r.id);
        saveState();
        renderResourcesView();
        refreshAllSelectorsAndGrids();
      })),
    ]));
  });
}

function renderTeachersTable() {
  const session = getCurrentSession();
  const tbody = document.querySelector("#teachersTable tbody");
  tbody.innerHTML = "";
  session.teachers.forEach(t => {
    const count = session.seances.filter(s => s.teacherId === t.id).length;
    const nbUnavailable = Array.isArray(t.unavailable) ? t.unavailable.length : 0;
    const nbModules = (t.moduleIds || []).length;
    tbody.appendChild(el("tr", {}, [
      el("td", {}, inputCell(t.name, v => { t.name = v; saveState(); refreshAllSelectorsAndGrids(); })),
      el("td", {}, String(count)),
      el("td", {}, el("button", { class: "btn small", onclick: () => openAvailabilityModal(t.id) },
        nbUnavailable > 0 ? `📅 Disponibilités (${nbUnavailable} bloqué${nbUnavailable > 1 ? "s" : ""})` : "📅 Disponibilités")),
      el("td", {}, el("button", { class: "btn small", onclick: () => openTeacherModulesModal(t.id) },
        t.allModules ? "📚 Tous les modules" : `📚 ${nbModules} module(s)`)),
      el("td", {}, deleteBtn(() => {
        if (!confirm(`Supprimer "${t.name}" ?`)) return;
        session.teachers = session.teachers.filter(x => x.id !== t.id);
        saveState();
        renderResourcesView();
        refreshAllSelectorsAndGrids();
      })),
    ]));
  });
}

/** Contenu du modal « Modules assurés » pour un enseignant. */
function renderTeacherModulesModal(teacherId) {
  const session = getCurrentSession();
  const teacher = session.teachers.find(t => t.id === teacherId);
  if (!teacher) return;
  document.getElementById("teacherModulesModalTitle").textContent = `Modules assurés — ${teacher.name}`;

  const allToggle = document.getElementById("teacherModulesAllToggle");
  allToggle.checked = !!teacher.allModules;
  allToggle.onchange = () => {
    teacher.allModules = allToggle.checked;
    if (teacher.allModules) teacher.moduleIds = session.modules.map(m => m.id);
    saveState();
    renderTeacherModulesModal(teacherId);
    renderResourcesView();
    refreshAllSelectorsAndGrids();
  };

  const wrap = document.getElementById("teacherModulesListWrap");
  wrap.innerHTML = "";
  teacher.moduleIds = Array.isArray(teacher.moduleIds) ? teacher.moduleIds : [];
  teacher.moduleGroupCounts = teacher.moduleGroupCounts && typeof teacher.moduleGroupCounts === "object" ? teacher.moduleGroupCounts : {};
  const commitAndRender = () => {
    saveState();
    renderTeacherModulesModal(teacherId);
    renderResourcesView();
    refreshAllSelectorsAndGrids();
  };
  const quick = (label, fn) => el("button", { class: "btn small ghost", onclick: () => { fn(); commitAndRender(); } }, label);
  wrap.appendChild(el("div", { class: "aff-label" }, [
    `Modules choisis (${teacher.allModules ? session.modules.length : teacher.moduleIds.length})`,
    quick("Tous", () => { teacher.allModules = true; teacher.moduleIds = session.modules.map(m => m.id); }),
    quick("Aucun", () => { teacher.allModules = false; teacher.moduleIds = []; }),
  ]));
  wrap.appendChild(el("p", { class: "hint" }, "Pour chaque module, cochez l’enseignant puis indiquez le nombre de groupes qu’il prendra en charge. Ces nombres guident la répartition et la planification automatiques."));

  const list = el("div", { class: "teacher-modules-semesters" });
  const semesterGroups = new Map();
  session.modules.forEach(m => {
    const key = String(m.semestre || "").trim() || "Sans semestre";
    if (!semesterGroups.has(key)) semesterGroups.set(key, []);
    semesterGroups.get(key).push(m);
  });
  const semesterOrder = (a, b) => {
    if (a === "Sans semestre") return 1;
    if (b === "Sans semestre") return -1;
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b, "fr", { numeric: true });
  };
  const fixedOrder = ["1", "3", "5", "2", "4", "6"];
  const slotOf = key => {
    const match = String(key).match(/\d+/);
    return match ? match[0] : null;
  };
  const slotPriority = key => {
    const idx = fixedOrder.indexOf(slotOf(key));
    return idx === -1 ? fixedOrder.length : idx;
  };
  const displayOrder = [...semesterGroups.keys()].sort((a, b) => {
    const pa = slotPriority(a), pb = slotPriority(b);
    return pa !== pb ? pa - pb : semesterOrder(a, b);
  });
  displayOrder.forEach(semester => {
    const modules = semesterGroups.get(semester) || [];
    const slot = slotOf(semester);
    const semesterClass = slot && fixedOrder.includes(slot) ? ` semester-slot-${slot}` : "";
    const column = el("section", { class: "teacher-modules-semester-column" + semesterClass }, [
      el("h3", {}, semester === "Sans semestre" ? semester : `Semestre ${semester}`),
      el("div", { class: "teacher-module-columns" }, [
        el("span", { class: "teacher-module-column-heading" }, "Intitulé du module"),
        el("span", { class: "teacher-module-column-heading teacher-module-count-heading" }, "Nombre de groupes"),
      ]),
    ]);
    modules.sort((a, b) => a.name.localeCompare(b.name, "fr")).forEach(m => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = teacherCanTeachModule(teacher, m.id);
      const semesterGroupCount = session.groups.filter(g => !m.semestre || g.semestre === m.semestre).length;
      const maxGroups = (m.groupIds || []).length || semesterGroupCount;
      const count = el("input", { type: "number", min: "0", max: String(maxGroups), step: "1", class: "teacher-module-count" });
      count.value = String(Math.min(maxGroups, Math.max(0, Number(teacher.moduleGroupCounts[m.id]) || 0)));
      count.disabled = !cb.checked;
      count.title = `Nombre de groupes de ${m.semestre ? `Semestre ${m.semestre}` : "ce module"} attribués à cet enseignant`;
      count.addEventListener("change", () => {
        const max = (m.groupIds || []).length || semesterGroupCount;
        const parsed = Math.max(0, Math.min(max || 0, Math.floor(Number(count.value) || 0)));
        count.value = String(parsed);
        if (parsed > 0 && !(m.groupIds || []).length) {
          m.groupIds = session.groups.filter(g => !m.semestre || g.semestre === m.semestre).map(g => g.id);
        }
        teacher.moduleGroupCounts[m.id] = parsed;
        saveState();
        renderResourcesView();
        refreshAllSelectorsAndGrids();
      });
      cb.addEventListener("change", () => {
        if (teacher.allModules) teacher.moduleIds = session.modules.map(x => x.id);
        teacher.moduleIds = teacher.moduleIds.filter(id => id !== m.id);
        if (cb.checked) teacher.moduleIds.push(m.id);
        teacher.allModules = false;
        commitAndRender();
      });
      const title = el("label", { class: "teacher-module-title" }, [cb, ` ${m.name}`]);
      const row = el("div", { class: "teacher-module-row" }, [title, count]);
      column.appendChild(row);
    });
    list.appendChild(column);
  });
  wrap.appendChild(list);
}

function renderModulesTable() {
  const session = getCurrentSession();
  const tbody = document.querySelector("#modulesTable tbody");
  tbody.innerHTML = "";
  session.modules.forEach(m => {
    const natureSelect = el("select", {}, MODULE_NATURES.map(n => el("option", { value: n.value }, n.label)));
    natureSelect.value = m.nature || "metier";
    natureSelect.title = "Métier : module classique. Transversal : séance 1h30, 2 à 3 groupes regroupés en amphi.";
    natureSelect.addEventListener("change", () => {
      m.nature = natureSelect.value;
      saveState();
      renderResourcesView();
      refreshAllSelectorsAndGrids();
    });

    tbody.appendChild(el("tr", {}, [
      el("td", {}, inputCell(m.name, v => { m.name = v; saveState(); refreshAllSelectorsAndGrids(); })),
      el("td", {}, inputCell(m.semestre || "", v => { m.semestre = v; saveState(); })),
      el("td", {}, inputCell(String(m.volumeHoraire || 0), v => { m.volumeHoraire = Number(v) || 0; saveState(); }, "number")),
      el("td", {}, natureSelect),
      el("td", {}, el("button", {
        class: "btn small ghost", title: "Ouvrir la répartition des groupes et enseignants",
        onclick: () => document.querySelector('.nav-item[data-view="affectations"]').click(),
      }, (m.groupIds || []).length
        ? `${m.groupIds.length} groupe(s) · ${getModuleAffectations(session, m.id).filter(a => a.groupIds.length).length} ens.`
        : "Définir…")),
      el("td", {}, deleteBtn(() => {
        if (!confirm(`Supprimer "${m.name}" ?`)) return;
        session.modules = session.modules.filter(x => x.id !== m.id);
        saveState();
        renderResourcesView();
        refreshAllSelectorsAndGrids();
      })),
    ]));
  });
}

function deleteBtn(onClick) {
  return el("button", { class: "icon-btn", onclick: onClick }, "🗑️");
}

/* ================= SCHEDULE GRID (shared engine) ================= */

/**
 * Calcule la mise en page logique d'une grille (partagée par l'écran, le PDF et l'export Excel).
 * Retourne, pour chaque jour, une liste de cellules :
 *   { kind: "empty" | "seance" | "conflict", slotIdx, span, seances: [...] }
 * - "seance"   : une seule séance, étendue sur `span` créneaux consécutifs
 * - "conflict" : plusieurs séances se chevauchent sur ce créneau (span = 1)
 * Garantit que chaque ligne couvre exactement `slots.length` colonnes.
 */
function computeGridRows(session, filterFn) {
  const slots = session.config.slots;
  const all = session.seances.filter(filterFn);
  return session.config.days.map(day => {
    const daySeances = all.filter(s => s.day === day);
    const cover = i => daySeances.filter(s => i >= s.startSlotIndex && i < s.startSlotIndex + s.duration);
    const cells = [];
    let i = 0;
    while (i < slots.length) {
      const c = cover(i);
      if (c.length === 0) {
        cells.push({ kind: "empty", slotIdx: i, span: 1, seances: [] });
        i += 1;
      } else if (c.length > 1) {
        cells.push({ kind: "conflict", slotIdx: i, span: 1, seances: c });
        i += 1;
      } else {
        const s = c[0];
        let span = 1;
        while (i + span < slots.length) {
          const next = cover(i + span);
          if (next.length === 1 && next[0] === s) span += 1; else break;
        }
        cells.push({ kind: "seance", slotIdx: i, span, seances: [s] });
        i += span;
      }
    }
    return { day, cells };
  });
}

function educationalActionVirtualSeance(session, group) {
  if (!group || !group.educationalActionDay) return null;
  return {
    id: `educational-action-${group.id}`,
    action: true,
    actionLabel: normalizeEducationalActionLabel(group.educationalActionLabel),
    moduleId: null,
    teacherId: "",
    groupIds: [group.id],
    roomId: "",
    day: group.educationalActionDay,
    startSlotIndex: 0,
    duration: session.config.slots.length,
    color: "#dbeafe",
  };
}

/**
 * Lignes de texte affichées dans une séance, selon le type de vue
 * (on n'affiche pas ce qui est déjà l'objet de la vue : l'enseignant dans sa propre vue, etc.)
 * kind : "group" | "teacher" | "room" | undefined (tout afficher)
 */
function getSeanceLines(session, s, kind, visibility = session.documentVisibility || DOCUMENT_VISIBILITY_DEFAULTS) {
  if (s.action) return visibility.action ? [{ key: "action", cls: "s-educational-action", text: normalizeEducationalActionLabel(s.actionLabel) }] : [];
  const mod = session.modules.find(m => m.id === s.moduleId);
  const teacher = session.teachers.find(t => t.id === s.teacherId);
  const room = session.rooms.find(r => r.id === s.roomId);
  const groupNames = s.groupIds.map(gid => {
    const g = session.groups.find(g => g.id === gid);
    return g ? g.name : "?";
  }).join(", ");

  // La salle est mise en évidence (rouge dans les documents) lorsqu'elle diffère de la
  // salle par défaut du groupe concerné : signale un changement de salle ponctuel.
  const singleGroup = s.groupIds.length === 1 ? session.groups.find(g => g.id === s.groupIds[0]) : null;
  const roomIsAlt = !!(singleGroup && room && singleGroup.defaultRoomId && room.id !== singleGroup.defaultRoomId);

  const L = {
    module: { key: "module", cls: "s-module", text: mod ? mod.name : "Module" },
    teacher: { key: "teacher", cls: "s-teacher", text: teacher ? teacher.name : "" },
    room: { key: "room", cls: "s-room" + (roomIsAlt ? " s-room-alt" : ""), text: room ? room.name : "" },
    groups: { key: "groups", cls: "s-groups", text: groupNames },
  };
  let order;
  switch (kind) {
    case "group": order = [L.module, L.teacher, L.room]; if (s.groupIds.length > 1) order.push(L.groups); break;
    case "teacher": order = [L.module, L.groups, L.room]; break;
    case "room": order = [L.module, L.teacher, L.groups]; break;
    default: order = [L.module, L.teacher, L.room, L.groups];
  }
  return order.filter(l => l.text && visibility[l.key] !== false);
}

function documentFormatElementStyle(session, key, layout = "text", color = "") {
  const format = session.documentFormat || DOCUMENT_FORMAT_DEFAULTS;
  const item = format.elements?.[key] || DOCUMENT_FORMAT_DEFAULTS.elements.module;
  // La couleur définie pour cet élément dans le tableau "Mise en forme" (colonne Couleur)
  // est prioritaire ; l'argument `color` (issu du thème de couleurs) ne sert plus que de
  // repli si, pour une raison quelconque, aucune couleur n'est définie sur l'élément.
  const resolvedColor = item.textColor || color;
  const crossAlign = { left: "flex-start", center: "center", right: "flex-end" }[item.align] || "center";
  const mainAlign = { top: "flex-start", middle: "center", bottom: "flex-end" }[item.valign] || "center";
  const layoutStyles = {
    stack: "display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start",
    line: `display:flex;flex:1 1 0;width:100%;min-width:0;align-items:${mainAlign};justify-content:${crossAlign}`,
    meta: `display:flex;flex:1 1 0;min-width:0;align-items:${mainAlign};justify-content:${crossAlign}`,
  };
  return [
    `font-family:${JSON.stringify(item.fontFamily)}`,
    `font-size:${item.fontSizePt}pt`,
    `font-weight:${item.bold ? 700 : 400}`,
    `text-align:${item.align}`,
    `vertical-align:${item.valign}`,
    resolvedColor ? `color:${resolvedColor}` : "",
    layoutStyles[layout] || "",
  ].filter(Boolean).join(";");
}

function documentImageStyle(session, key) {
  const format = session.documentFormat || DOCUMENT_FORMAT_DEFAULTS;
  const size = format[key];
  return `width:${size.widthMm}mm;height:${size.heightMm}mm;max-width:${size.widthMm}mm;max-height:${size.heightMm}mm;object-fit:contain`;
}

/**
 * Construit une grille générique.
 * filterFn(seance) -> true si la séance doit apparaître dans cette vue.
 * opts.onCellClick(day, slotIndex) -> clic sur une cellule vide.
 * opts.onSeanceClick(seance)       -> clic sur une séance existante.
 * opts.kind                        -> "group" | "teacher" | "room" (contenu des cellules).
 */
function buildScheduleTable(session, filterFn, opts) {
  const { onCellClick, onSeanceClick, renderSeanceLabel, kind, virtualSeances = [], applyDocumentTheme = false } = opts;
  const slots = session.config.slots;
  const theme = session.documentTheme || DOCUMENT_THEME_DEFAULTS;
  const visibility = session.documentVisibility || DOCUMENT_VISIBILITY_DEFAULTS;
  const conflictedSeanceIds = new Set();
  computeConflicts(session).forEach(c => c.seanceIds.forEach(id => conflictedSeanceIds.add(id)));
  const gridSession = virtualSeances.length ? { ...session, seances: session.seances.concat(virtualSeances) } : session;

  const table = el("table", {
    class: "schedule",
    style: applyDocumentTheme
      ? `--edt-border-color:${theme.borderColor};--edt-slot-background:${theme.slotBackground};--edt-slot-text:${theme.slotText};--edt-day-background:${theme.dayBackground};--edt-day-text:${theme.dayText};--edt-session-background:${theme.sessionBackground};--edt-session-text:${theme.sessionText};--edt-action-background:${theme.actionBackground};--edt-action-text:${theme.actionText}`
      : "",
  });

  // Largeurs de colonnes : colonne "jours" fixe (~17%), puis chaque créneau proportionnel à
  // sa durée réelle (une pause déjeuner plus courte donne naturellement une colonne plus étroite).
  const dayColPct = 17;
  const totalMinutes = slots.reduce((sum, s) => sum + Math.max(1, hhmmToMinutes(s.end) - hhmmToMinutes(s.start)), 0) || 1;
  const colgroup = el("colgroup", {}, [
    el("col", { style: `width:${dayColPct}%` }),
    ...slots.map(s => {
      const mins = Math.max(1, hhmmToMinutes(s.end) - hhmmToMinutes(s.start));
      const pct = ((100 - dayColPct) * mins) / totalMinutes;
      return el("col", { style: `width:${pct}%` });
    }),
  ]);
  table.appendChild(colgroup);

  table.appendChild(el("thead", {}, el("tr", {}, [
    el("th", {}, ""),
    ...slots.map(s => el("th", { style: documentFormatElementStyle(session, "slot", "text", applyDocumentTheme ? theme.slotText : "") }, visibility.slot ? s.label : "")),
  ])));

  const tbody = el("tbody");
  const visibleFilter = seance => filterFn(seance) && (!seance.action || visibility.action);
  computeGridRows(gridSession, visibleFilter).forEach(({ day, cells }) => {
    const tr = el("tr");
    tr.appendChild(el("th", { class: "day-cell", style: documentFormatElementStyle(session, "day", "text", applyDocumentTheme ? theme.dayText : "") }, visibility.day ? day : ""));

    cells.forEach(cell => {
      if (cell.kind === "empty") {
        const td = el("td", { class: "empty-cell" });
        td.addEventListener("click", () => onCellClick(day, cell.slotIdx));
        tr.appendChild(td);
      } else if (cell.kind === "conflict") {
        const td = el("td", { class: "conflict-cell" });
        cell.seances.forEach(s => {
          const mini = el("div", { class: "conflict-mini" }, visibility.module ? renderSeanceLabel(s, true) : "");
          mini.addEventListener("click", (e) => { e.stopPropagation(); onSeanceClick(s); });
          td.appendChild(mini);
        });
        tr.appendChild(td);
      } else {
        const s = cell.seances[0];
        const td = el("td", { colspan: String(cell.span) });
        const textColor = applyDocumentTheme ? (s.action ? theme.actionText : theme.sessionText) : "";
        const backgroundOverride = !applyDocumentTheme
          ? `background:${s.color || "#e9edfb"};`
          : (!s.action && theme.preserveSessionColors && s.color ? `background:${s.color} !important;` : "");
        const box = el("div", {
          class: "seance-cell" + (s.action ? " educational-action-cell" : "") + (conflictedSeanceIds.has(s.id) ? " conflict" : ""),
          style: `${backgroundOverride}border-left-color:${darken(s.color)};${documentFormatElementStyle(session, s.action ? "action" : "module", "stack", textColor)}`,
        }, buildSeanceCellContent(session, s, kind, applyDocumentTheme));
        if (!s.action) box.addEventListener("click", () => onSeanceClick(s));
        td.appendChild(box);
        tr.appendChild(td);
      }
    });
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}

function buildSeanceCellContent(session, s, kind, applyDocumentTheme = false) {
  const theme = session.documentTheme || DOCUMENT_THEME_DEFAULTS;
  const visibility = session.documentVisibility || DOCUMENT_VISIBILITY_DEFAULTS;
  const color = applyDocumentTheme ? (s.action ? theme.actionText : theme.sessionText) : "";
  return getSeanceLines(session, s, kind, visibility).map(l => el("div", { class: l.cls, style: documentFormatElementStyle(session, l.key, "line", color) }, l.text));
}

function darken(hex) {
  if (!hex) return "#4f6df7";
  try {
    const c = hex.replace("#", "");
    const num = parseInt(c, 16);
    let r = (num >> 16) - 40, g = ((num >> 8) & 0xff) - 40, b = (num & 0xff) - 40;
    r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
    return `rgb(${r},${g},${b})`;
  } catch (e) { return "#4f6df7"; }
}

/* ================= DOCUMENTS (aperçu écran + impression PDF) ================= */

/** Hauteur de ligne (en mm) pour que la grille + en-tête + pied tiennent sur une page A4 paysage. */
function docRowHeightMm(session) {
  const n = Math.max(1, session.config.days.length);
  // A4 paysage : 210 mm de haut. L'en-tête conserve son logo/cachet à taille fixe ;
  // la grille reçoit donc une hauteur prudente, ajustée ensuite si nécessaire.
  return Math.max(12, Math.min(24, Math.floor((98 - 11) / n)));
}

function formatHours(minutes) {
  const h = minutes / 60;
  return (Math.round(h * 100) / 100).toString().replace(".", ",");
}

/** Spécifications de document pour un groupe / un enseignant / une salle. */
function groupDocSpec(session, group) {
  const room = session.rooms.find(r => r.id === group.defaultRoomId);
  return {
    kind: "group",
    filterFn: s => s.groupIds.includes(group.id),
    virtualSeances: [educationalActionVirtualSeance(session, group)].filter(Boolean),
    metaLeft: `Semestre : ${group.semestre || "-"}`,
    metaRight: `Groupe : ${group.name} / ${room ? (/^salle\b/i.test(room.name) ? room.name : "Salle " + room.name) : "Salle -"}`,
  };
}

function teacherDocSpec(session, teacher) {
  const mine = session.seances.filter(s => s.teacherId === teacher.id);
  const minutes = mine.reduce((sum, s) => sum + seanceMinutes(session, s), 0);
  return {
    kind: "teacher",
    filterFn: s => s.teacherId === teacher.id,
    metaLeft: `Enseignant : ${teacher.name}`,
    metaRight: `Charge hebdomadaire : ${formatHours(minutes)} h (${mine.length} séance${mine.length > 1 ? "s" : ""})`,
  };
}

function roomDocSpec(session, room) {
  return {
    kind: "room",
    filterFn: s => s.roomId === room.id,
    metaLeft: `Salle : ${room.name}`,
    metaRight: `${room.type === "amphi" ? "Amphithéâtre" : "Salle"} — ${room.capacity} places`,
  };
}

/**
 * Construit une page "document" : en-tête (titre, année, filière, méta) + grille + pied de page.
 * Le même bloc sert à l'aperçu écran et à l'impression / export PDF.
 */
function buildDocSection(session, spec, opts = {}) {
  const interactive = !!opts.interactive;
  const theme = session.documentTheme || DOCUMENT_THEME_DEFAULTS;
  const visibility = session.documentVisibility || DOCUMENT_VISIBILITY_DEFAULTS;

  const header = el("div", { class: "doc-header-block" }, [
    visibility.seal && session.seal && session.seal.dataUrl ? el("img", { class: "doc-seal", src: session.seal.dataUrl, alt: "Sceau", style: documentImageStyle(session, "seal") }) : null,
    visibility.logo && session.logo && session.logo.dataUrl ? el("img", { class: "doc-logo", src: session.logo.dataUrl, alt: "Logo", style: documentImageStyle(session, "logo") }) : null,
    visibility.title ? el("div", { class: "doc-title-main", style: documentFormatElementStyle(session, "title", "text", theme.titleColor) }, [
      "Emploi du temps ",
      el("span", { class: "doc-provisoire", style: documentFormatElementStyle(session, "statut", "text", theme.titleColor) }, statutLabel(session)),
    ]) : null,
    visibility.sessionType ? el("div", { class: "doc-session-type", style: documentFormatElementStyle(session, "sessionType", "text", theme.titleColor) }, sessionTypeLabel(session.typeSession || "Printemps")) : null,
    visibility.year ? el("div", { class: "doc-annee", style: documentFormatElementStyle(session, "year", "text", theme.titleColor) }, `Année universitaire ${session.annee || ""}`) : null,
    visibility.filiere ? el("div", { class: "doc-filiere", style: documentFormatElementStyle(session, "filiere", "text", theme.titleColor) }, `${session.filiere || ""}${session.option ? " Spécialité : " + session.option : ""}`) : null,
    visibility.meta ? el("div", { class: "doc-meta-row" }, [
      el("span", { style: documentFormatElementStyle(session, "metaLeft", "meta", theme.sessionText) }, spec.metaLeft),
      el("span", { style: documentFormatElementStyle(session, "metaRight", "meta", theme.sessionText) }, spec.metaRight),
    ]) : null,
  ]);

  const labelOf = (s) => {
    if (s.action) return normalizeEducationalActionLabel(s.actionLabel);
    const mod = session.modules.find(m => m.id === s.moduleId);
    return mod ? mod.name : "?";
  };

  const table = buildScheduleTable(session, spec.filterFn, {
    kind: spec.kind,
    onCellClick: interactive && spec.onCellClick ? spec.onCellClick : () => {},
    onSeanceClick: interactive ? (s) => openSeanceModal(s) : () => {},
    renderSeanceLabel: labelOf,
    virtualSeances: spec.virtualSeances || [],
    applyDocumentTheme: true,
  });

  const footer = visibility.footer ? el("div", { class: "doc-footer" }, [
    el("div", { class: "doc-footer-note", style: documentFormatElementStyle(session, "footer", "text", theme.sessionText) }, [
      "Début des cours : ",
      el("span", { class: "doc-date", style: documentFormatElementStyle(session, "footer", "text", theme.sessionText) }, startCoursesDateLabel(session)),
    ]),
  ]) : null;

  return el("div", { class: "doc-page", style: `--row-h:${docRowHeightMm(session)}mm;background-color:${theme.pageBackground};color:${theme.sessionText}` }, [
    header,
    el("div", { class: "doc-table-wrap" }, table),
    footer,
  ]);
}

/** Compatibilité : document d'un groupe (mise en forme des emplois du temps de référence). */
function buildGroupDocSection(session, group, opts = {}) {
  const spec = groupDocSpec(session, group);
  if (opts.interactive) {
    spec.onCellClick = (day, slotIdx) => openSeanceModal(null, { day, startSlotIndex: slotIdx, groupIds: [group.id] });
  }
  return buildDocSection(session, spec, opts);
}

/* ---------- Semester planning (plusieurs groupes, un seul document) ---------- */
function renderSemesterButtons(container, semesters, active, onSelect) {
  container.innerHTML = "";
  if (semesters.length === 0) {
    container.appendChild(el("div", { class: "empty-state" }, "Aucun groupe rattaché à un semestre pour l'instant."));
    return;
  }
  semesters.forEach(sem => {
    const chip = el("div", { class: "day-chip" + (sem === active ? " active" : "") }, `Semestre ${sem}`);
    chip.addEventListener("click", () => onSelect(sem));
    container.appendChild(chip);
  });
}

function renderSemesterDocs(semestre) {
  const session = getCurrentSession();
  const wrap = document.getElementById("semesterDocsWrap");
  wrap.innerHTML = "";
  if (!semestre) {
    wrap.appendChild(el("div", { class: "empty-state" }, "Sélectionnez un semestre ci-dessus."));
    return;
  }
  const groups = session.groups.filter(g => g.semestre === semestre);
  if (groups.length === 0) {
    wrap.appendChild(el("div", { class: "empty-state" }, "Aucun groupe pour ce semestre."));
    return;
  }
  groups.forEach(g => {
    wrap.appendChild(buildGroupDocSection(session, g, { interactive: true }));
  });
}

/* ---------- Group / Teacher / Room views ---------- */
function renderEntityGrid(wrapId, emptyMsg, entityId, kind, filterFn, prefillFn) {
  const session = getCurrentSession();
  const wrap = document.getElementById(wrapId);
  wrap.innerHTML = "";
  if (!entityId) {
    wrap.appendChild(el("div", { class: "empty-state" }, emptyMsg));
    return;
  }
  const table = buildScheduleTable(session, filterFn, {
    kind,
    onCellClick: (day, slotIdx) => openSeanceModal(null, { day, startSlotIndex: slotIdx, ...prefillFn() }),
    onSeanceClick: (s) => openSeanceModal(s),
    renderSeanceLabel: (s) => {
      if (s.action) return normalizeEducationalActionLabel(s.actionLabel);
      const mod = session.modules.find(m => m.id === s.moduleId);
      return mod ? mod.name : "?";
    },
    virtualSeances: kind === "group"
      ? [educationalActionVirtualSeance(session, session.groups.find(g => g.id === entityId))].filter(Boolean)
      : [],
  });
  wrap.appendChild(table);
}

function renderPlanningGrid(groupId) {
  renderEntityGrid("planningGridWrap", "Sélectionnez un groupe.", groupId, "group",
    s => s.groupIds.includes(groupId), () => ({ groupIds: [groupId] }));
}

function renderTeacherGrid(teacherId) {
  renderEntityGrid("teacherGridWrap", "Sélectionnez un enseignant.", teacherId, "teacher",
    s => s.teacherId === teacherId, () => ({ teacherId }));
}

function renderRoomGrid(roomId) {
  renderEntityGrid("roomGridWrap", "Sélectionnez une salle.", roomId, "room",
    s => s.roomId === roomId, () => ({ roomId }));
}

/* ---------- Teacher availability grid ---------- */
function renderAvailabilityGrid(teacherId) {
  const session = getCurrentSession();
  const teacher = session.teachers.find(t => t.id === teacherId);
  const wrap = document.getElementById("availabilityGridWrap");
  wrap.innerHTML = "";
  if (!teacher) return;

  // Les créneaux nouvellement apparus restent indisponibles jusqu'à validation manuelle.
  ensureTeacherAvailability(session, teacher);

  document.getElementById("availabilityModalTitle").textContent = `Disponibilités — ${teacher.name}`;

  const days = session.config.days;
  const slots = session.config.slots;

  const table = el("table", { class: "schedule" });
  const thead = el("thead", {}, el("tr", {}, [
    el("th", {}, ""),
    ...slots.map(s => el("th", {}, s.label)),
  ]));
  table.appendChild(thead);

  // "Matin" agit sur les deux premiers créneaux de chaque journée, "Après-midi" sur les
  // deux derniers — deux cases globales en haut de la fenêtre (pas une par jour) qui
  // rendent disponible ce demi-créneau sur TOUS les jours en un seul clic.
  const morningIdx = [0, 1].filter(i => i < slots.length);
  const afternoonIdx = slots.length >= 2 ? [slots.length - 2, slots.length - 1] : [];

  const quickToggleAllDays = (idxList, checked) => {
    days.forEach(day => idxList.forEach(i => setTeacherAvailability(teacher, day, i, checked)));
    saveState();
    renderAvailabilityGrid(teacherId);
    refreshConflictsViews();
    renderResourcesView();
  };

  const quickWrap = document.getElementById("availabilityQuickToggles");
  quickWrap.innerHTML = "";
  const allDaysHaveIdx = (idxList) => idxList.length > 0;
  const morningAllChecked = allDaysHaveIdx(morningIdx) && days.every(day => morningIdx.every(i => !isTeacherUnavailable(teacher, day, i)));
  const morningCb = el("input", { type: "checkbox" });
  morningCb.checked = morningAllChecked;
  morningCb.disabled = !allDaysHaveIdx(morningIdx) || days.length === 0;
  morningCb.addEventListener("change", () => quickToggleAllDays(morningIdx, morningCb.checked));

  const afternoonAllChecked = allDaysHaveIdx(afternoonIdx) && days.every(day => afternoonIdx.every(i => !isTeacherUnavailable(teacher, day, i)));
  const afternoonCb = el("input", { type: "checkbox" });
  afternoonCb.checked = afternoonAllChecked;
  afternoonCb.disabled = !allDaysHaveIdx(afternoonIdx) || days.length === 0;
  afternoonCb.addEventListener("change", () => quickToggleAllDays(afternoonIdx, afternoonCb.checked));

  quickWrap.appendChild(el("label", { class: "chk availability-quick", title: "Rend disponibles les deux créneaux du matin, tous les jours." }, [morningCb, " ☀️ Matin (tous les jours)"]));
  quickWrap.appendChild(el("label", { class: "chk availability-quick", title: "Rend disponibles les deux derniers créneaux de l'après-midi, tous les jours." }, [afternoonCb, " 🌇 Après-midi (tous les jours)"]));

  const tbody = el("tbody");
  days.forEach(day => {
    const tr = el("tr");
    tr.appendChild(el("th", { class: "day-cell" }, day));

    slots.forEach((slot, idx) => {
      const unavailable = isTeacherUnavailable(teacher, day, idx);
      const td = el("td", { style: "cursor:pointer; padding:0;" });
      const cell = el("div", {
        class: "availability-cell " + (unavailable ? "is-unavailable" : "is-available"),
        style: `height:100%; min-height:56px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600;
                background:${unavailable ? "#fdecec" : "#e7f8ee"}; color:${unavailable ? "#a11a1a" : "#1c7a44"};`,
      }, unavailable ? "Indisponible" : "Disponible");
      cell.addEventListener("click", () => {
        toggleTeacherAvailability(teacher, day, idx);
        saveState();
        renderAvailabilityGrid(teacherId);
        refreshConflictsViews();
        renderResourcesView();
      });
      td.appendChild(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
}

/* ---------- Room availability grid ---------- */
function renderRoomAvailabilityGrid(roomId) {
  const session = getCurrentSession();
  const room = session.rooms.find(r => r.id === roomId);
  const wrap = document.getElementById("roomAvailabilityGridWrap");
  wrap.innerHTML = "";
  if (!room) return;

  ensureRoomAvailability(session, room);

  document.getElementById("roomAvailabilityModalTitle").textContent = `Disponibilités — ${room.name}`;

  const days = session.config.days;
  const slots = session.config.slots;

  const table = el("table", { class: "schedule" });
  const thead = el("thead", {}, el("tr", {}, [
    el("th", {}, ""),
    ...slots.map(s => el("th", {}, s.label)),
  ]));
  table.appendChild(thead);

  const tbody = el("tbody");
  days.forEach(day => {
    const tr = el("tr");
    tr.appendChild(el("th", { class: "day-cell" }, day));
    slots.forEach((slot, idx) => {
      const unavailable = isRoomUnavailable(room, day, idx);
      const td = el("td", { style: "cursor:pointer; padding:0;" });
      const cell = el("div", {
        class: "availability-cell " + (unavailable ? "is-unavailable" : "is-available"),
        style: `height:100%; min-height:56px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600;
                background:${unavailable ? "#fdecec" : "#e7f8ee"}; color:${unavailable ? "#a11a1a" : "#1c7a44"};`,
      }, unavailable ? "Indisponible" : "Disponible");
      cell.addEventListener("click", () => {
        toggleRoomAvailability(room, day, idx);
        saveState();
        renderRoomAvailabilityGrid(roomId);
        refreshConflictsViews();
        renderResourcesView();
      });
      td.appendChild(cell);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
}

/* ---------- Full conflicts view ---------- */
function renderConflictsView() {
  const session = getCurrentSession();
  const conflicts = computeConflicts(session);
  renderConflictList(document.getElementById("conflictsFull"), conflicts, session);
  updateConflictBadge(conflicts.length);
}

function refreshConflictsViews() {
  renderDashboard();
  renderConflictsView();
}
