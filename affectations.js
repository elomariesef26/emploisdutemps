/* ============================================================
   AFFECTATIONS.JS — Affectation des modules aux enseignants
   et répartition des groupes (séances en amphi)

   Modèle :
   - module.nature           : "metier" | "transversal"
   - module.groupIds         : groupes qui suivent le module ensemble
   - session.affectations[]  : { id, moduleId, teacherId, groupCount, groupIds[] }
       → « l'enseignant T prend en charge groupCount groupes du module M »
       L'utilisateur choisit explicitement les groupes pris en charge par chaque
       couple enseignant/module ; groupCount est dérivé de groupIds.
   Règles :
   - un enseignant peut prendre plusieurs groupes d'un même module (2, 3, …)
   - un module peut avoir plusieurs enseignants (chacun son nombre de groupes)
   - un groupe n'a qu'UN enseignant par module
   - module transversal : séance de 1h30, 2 à 3 groupes regroupés en amphi ;
     un enseignant assurant ce module a obligatoirement au moins 2 groupes regroupés
   ============================================================ */

/** Nettoie les références orphelines (groupe/enseignant/module supprimé). Appelée à chaque sauvegarde. */
function cleanAffectations(session) {
  if (!session) return;
  if (!Array.isArray(session.affectations)) session.affectations = [];
  const groupIds = new Set((session.groups || []).map(g => g.id));
  const teacherIds = new Set((session.teachers || []).map(t => t.id));
  const modules = new Map((session.modules || []).map(m => [m.id, m]));

  const moduleIdSet = new Set(modules.keys());
  (session.teachers || []).forEach(t => {
    t.moduleIds = Array.from(new Set((t.moduleIds || []).filter(id => moduleIdSet.has(id))));
    if (!t.moduleGroupCounts || typeof t.moduleGroupCounts !== "object" || Array.isArray(t.moduleGroupCounts)) t.moduleGroupCounts = {};
    Object.keys(t.moduleGroupCounts).forEach(id => { if (!moduleIdSet.has(id)) delete t.moduleGroupCounts[id]; });
    if (t.allModules === undefined) t.allModules = t.moduleIds.length === 0;
  });

  modules.forEach(m => {
    m.groupIds = Array.from(new Set((m.groupIds || []).filter(id => groupIds.has(id))));
    if (m.nature !== "transversal") m.nature = "metier";
    if (m.fullDay === undefined) m.fullDay = false;
    const roomIds = new Set((session.rooms || []).map(r => r.id));
    m.roomPoolIds = Array.from(new Set((m.roomPoolIds || []).filter(id => roomIds.has(id))));
  });
  session.affectations = session.affectations.filter(a => modules.has(a.moduleId) && teacherIds.has(a.teacherId));
  session.affectations.forEach(a => {
    const allowed = new Set(modules.get(a.moduleId).groupIds);
    a.groupIds = Array.from(new Set((a.groupIds || []).filter(id => allowed.has(id))));
    if (!(Number(a.groupCount) > 0)) a.groupCount = a.groupIds.length || 1;
  });
}

function getModuleAffectations(session, moduleId) {
  return (session.affectations || []).filter(a => a.moduleId === moduleId);
}

/** Séance → Affectation : une séance créée ou modifiée manuellement (Planning par groupe,
 * Planning par semestre, Vue enseignant, Vue salle) met à jour l'affectation module ↔ enseignant
 * correspondante pour refléter les groupes réellement planifiés. Si un groupe planifié appartenait
 * jusque-là à l'affectation d'un autre enseignant pour ce module, il lui est retiré (un groupe n'a
 * qu'un enseignant par module). Renvoie true si une affectation a été créée ou modifiée. */
function syncAffectationFromSeance(session, seance) {
  if (!session || !seance || !seance.moduleId || !seance.teacherId) return false;
  const groupIds = Array.isArray(seance.groupIds) ? seance.groupIds : [];
  if (!groupIds.length) return false;
  const mod = (session.modules || []).find(m => m.id === seance.moduleId);
  const teacher = (session.teachers || []).find(t => t.id === seance.teacherId);
  if (!mod || !teacher) return false;
  if (!Array.isArray(session.affectations)) session.affectations = [];

  let aff = session.affectations.find(a => a.moduleId === seance.moduleId && a.teacherId === seance.teacherId);
  if (!aff) {
    aff = { id: uid("af"), moduleId: seance.moduleId, teacherId: seance.teacherId, groupCount: 0, groupIds: [] };
    session.affectations.push(aff);
  }

  let changed = false;
  if (!Array.isArray(mod.groupIds)) mod.groupIds = [];
  groupIds.forEach(gid => {
    if (!mod.groupIds.includes(gid)) {
      // Le groupe n'était pas encore dans le périmètre du module (Ressources → Modules
      // toujours à "Définir…") : une séance manuelle définit ce périmètre au fur et à
      // mesure, au lieu d'exiger une configuration préalable dans un autre onglet.
      mod.groupIds.push(gid);
      changed = true;
    }
    if (aff.groupIds.includes(gid)) return;
    // Retirer ce groupe de toute autre affectation du même module (un seul enseignant par groupe et par module).
    session.affectations.forEach(other => {
      if (other !== aff && other.moduleId === seance.moduleId && (other.groupIds || []).includes(gid)) {
        other.groupIds = other.groupIds.filter(id => id !== gid);
        other.groupCount = other.groupIds.length;
      }
    });
    aff.groupIds.push(gid);
    changed = true;
  });
  if (changed) aff.groupCount = aff.groupIds.length;
  return changed;
}

/** Affectation → Séances : après une modification dans l'onglet Affectations (changement
 * d'enseignant, de groupes pris en charge, répartition automatique…), toute séance déjà planifiée
 * dont tous les groupes correspondent exactement à une affectation est réalignée sur l'enseignant
 * de cette affectation. Renvoie true si au moins une séance a été modifiée. */
function syncSeancesFromModuleAffectations(session, moduleId) {
  if (!session) return false;
  const affs = getModuleAffectations(session, moduleId).filter(a => (a.groupIds || []).length);
  if (!affs.length) return false;
  let changed = false;
  (session.seances || []).filter(s => s.moduleId === moduleId && (s.groupIds || []).length).forEach(s => {
    const match = affs.find(a => s.groupIds.every(id => a.groupIds.includes(id)));
    if (match && s.teacherId !== match.teacherId) {
      s.teacherId = match.teacherId;
      changed = true;
    }
  });
  return changed;
}

/** Repasse sur TOUTES les séances déjà enregistrées (créées avant le correctif, ou importées)
 * et reconstruit les affectations manquantes à partir d'elles — utile en une seule fois pour
 * rattraper des séances créées avant que le module ait eu son périmètre de groupes défini.
 * Renvoie le nombre de séances ayant déclenché une création/mise à jour d'affectation. */
function resyncAllAffectationsFromSeances(session) {
  if (!session) return 0;
  let count = 0;
  (session.seances || []).forEach(s => {
    if (syncAffectationFromSeance(session, s)) count++;
  });
  return count;
}

/** Construit ou met à jour les affectations à partir des nombres saisis dans
 * « Modules assurés ». Une quantité explicitement ramenée à zéro retire la ligne. */
function syncModuleAffectationsFromTeacherCounts(session, moduleId) {
  const mod = (session.modules || []).find(m => m.id === moduleId);
  if (!mod) return [];
  if (!Array.isArray(session.affectations)) session.affectations = [];
  session.teachers.forEach(teacher => {
    if (!teacherCanTeachModule(teacher, moduleId)) return;
    const counts = teacher.moduleGroupCounts;
    if (!counts || !Object.prototype.hasOwnProperty.call(counts, moduleId)) return;
    const groupCount = Math.max(0, Math.min((mod.groupIds || []).length, Math.floor(Number(counts[moduleId]) || 0)));
    let aff = session.affectations.find(a => a.moduleId === moduleId && a.teacherId === teacher.id);
    if (groupCount === 0) {
      if (aff) session.affectations = session.affectations.filter(a => a !== aff);
      return;
    }
    if (!aff) {
      aff = { id: uid("af"), moduleId, teacherId: teacher.id, groupCount, groupIds: [] };
      session.affectations.push(aff);
    }
    aff.groupCount = groupCount;
  });
  return getModuleAffectations(session, moduleId);
}

function hasTeacherGroupCountPlan(teacher, moduleId) {
  return !!(teacher && teacher.moduleGroupCounts && Number(teacher.moduleGroupCounts[moduleId]) > 0);
}

function affGroupNames(session, ids) {
  return ids.map(id => (session.groups.find(g => g.id === id) || {}).name).filter(Boolean);
}

/** Nombre de séances déjà planifiées qui correspondent à l'affectation (même module, même enseignant, groupes inclus). */
function affectationSeanceCount(session, aff) {
  return session.seances.filter(s =>
    s.moduleId === aff.moduleId && s.teacherId === aff.teacherId &&
    s.groupIds.length > 0 && s.groupIds.every(id => aff.groupIds.includes(id))
  ).length;
}

function unplannedAffectationGroupIds(session, aff) {
  const planned = new Set();
  session.seances.filter(s => s.moduleId === aff.moduleId && s.teacherId === aff.teacherId)
    .forEach(s => (s.groupIds || []).forEach(id => planned.add(id)));
  return (aff.groupIds || []).filter(id => !planned.has(id));
}

/**
 * Contrôles de cohérence. Retourne [{ level: "error"|"warning", kind, moduleId, message, count? }]
 */
function computeAffectationIssues(session) {
  const issues = [];
  session.modules.forEach(m => {
    const groups = m.groupIds || [];
    if (!groups.length) return;
    const affs = getModuleAffectations(session, m.id);
    const transversal = isTransversal(m);

    const uncovered = groups.filter(gid => !affs.some(a => a.groupIds.includes(gid)));
    if (uncovered.length) {
      issues.push({
        level: "error", kind: "uncovered", moduleId: m.id, count: uncovered.length,
        message: `« ${m.name} » : ${affGroupNames(session, uncovered).join(", ")} ${uncovered.length > 1 ? "n'ont pas d'enseignant (répartition automatique à relancer)" : "n'a pas d'enseignant (répartition automatique à relancer)"}.`,
      });
    }
    const doubled = groups.filter(gid => affs.filter(a => a.groupIds.includes(gid)).length > 1);
    if (doubled.length) {
      issues.push({
        level: "error", kind: "duplicate", moduleId: m.id, count: doubled.length,
        message: `« ${m.name} » : ${affGroupNames(session, doubled).join(", ")} affecté(s) à plusieurs enseignants.`,
      });
    }
    affs.filter(a => a.groupIds.length === 0).forEach(a => {
      const t = session.teachers.find(x => x.id === a.teacherId);
      issues.push({ level: "warning", kind: "empty", moduleId: m.id, message: `« ${m.name} » : ${t ? t.name : "?"} n'a aucun groupe (nombre demandé : ${a.groupCount || 0}).` });
    });

    const totalRequested = affs.reduce((n, a) => n + (Number(a.groupCount) || 0), 0);
    if (affs.length && totalRequested !== groups.length) {
      issues.push({
        level: "warning", kind: "count-mismatch", moduleId: m.id,
        message: `« ${m.name} » : ${totalRequested} groupe(s) demandé(s) au total pour ${groups.length} groupe(s) concerné(s).`,
      });
    }

    if (transversal) {
      affs.forEach(a => {
        const t = session.teachers.find(x => x.id === a.teacherId);
        if ((Number(a.groupCount) || 0) < TRANSVERSAL_MIN_GROUPS) {
          issues.push({
            level: "error", kind: "transversal-min", moduleId: m.id,
            message: `« ${m.name} » (transversal) : ${t ? t.name : "?"} doit avoir au moins ${TRANSVERSAL_MIN_GROUPS} groupes regroupés (actuellement ${a.groupCount || 0}).`,
          });
        } else if (packSizes(a.groupCount).some(sz => sz < TRANSVERSAL_MIN_GROUPS)) {
          issues.push({
            level: "warning", kind: "transversal-pack", moduleId: m.id,
            message: `« ${m.name} » (transversal) : la répartition de ${t ? t.name : "?"} en paquets de ${TRANSVERSAL_MIN_GROUPS}-${TRANSVERSAL_MAX_GROUPS} groupes laisse un reliquat ; ajustez le nombre de groupes.`,
          });
        }
      });
    }

    if (affs.length) {
      session.seances.filter(s => s.moduleId === m.id).forEach(s => {
        const ok = affs.some(a => a.teacherId === s.teacherId && s.groupIds.every(id => a.groupIds.includes(id)));
        if (!ok) {
          const t = session.teachers.find(x => x.id === s.teacherId);
          issues.push({
            level: "warning", kind: "seance", moduleId: m.id,
            message: `Séance « ${m.name} » (${s.day}, créneau ${s.startSlotIndex + 1}) : ${t ? t.name : "sans enseignant"} / ${affGroupNames(session, s.groupIds).join(", ")} ne correspond à aucune affectation.`,
          });
        }
      });
    }
  });
  return issues;
}

/** Avertissements affichés dans la fenêtre de séance (le candidat n'est pas conforme aux affectations). */
function checkCandidateAffectation(session, cand) {
  const affs = getModuleAffectations(session, cand.moduleId).filter(a => a.groupIds.length);
  if (!affs.length) return [];
  const mod = session.modules.find(m => m.id === cand.moduleId);
  const teacherName = id => (session.teachers.find(t => t.id === id) || {}).name || "?";
  const summary = affs.map(a => `${teacherName(a.teacherId)} → ${affGroupNames(session, a.groupIds).join(", ")}`).join(" · ");
  const mine = affs.find(a => a.teacherId === cand.teacherId);
  if (!mine) {
    return [{ level: "warning", text: `ℹ️ ${teacherName(cand.teacherId)} n'est pas affecté à « ${mod.name} ». Affectations : ${summary}.` }];
  }
  const outside = cand.groupIds.filter(id => !mine.groupIds.includes(id));
  if (outside.length) {
    return [{ level: "warning", text: `ℹ️ ${affGroupNames(session, outside).join(", ")} n'est/ne sont pas affecté(s) à ${teacherName(mine.teacherId)} pour ce module (ses groupes : ${affGroupNames(session, mine.groupIds).join(", ")}).` }];
  }
  return [];
}

/**
 * Répartit équitablement le NOMBRE de groupes du module entre les enseignants déjà listés
 * (ex. 5 groupes / 2 enseignants → 3 + 2). La composition précise des groupes (et leur
 * regroupement en amphi si le module est transversal) est ensuite calculée automatiquement —
 * voir autoAssignModuleGroups() dans autoscheduler.js.
 */
function distributeGroupsEvenly(session, moduleId) {
  const mod = session.modules.find(m => m.id === moduleId);
  const affs = getModuleAffectations(session, moduleId);
  if (!mod || !affs.length) return;
  const total = mod.groupIds.length;
  const base = Math.floor(total / affs.length), extra = total % affs.length;
  affs.forEach((a, i) => {
    a.groupCount = base + (i < extra ? 1 : 0);
  });
  if (typeof autoAssignModuleGroups === "function") autoAssignModuleGroups(session, moduleId);
}

function defaultAmphiRoomId(session) {
  const r = session.rooms.find(x => x.type === "amphi");
  return r ? r.id : (session.rooms[0] ? session.rooms[0].id : "");
}

/** Relance la répartition automatique des groupes (sans mélange aléatoire) après un simple
 * changement de saisie, pour que la composition affichée soit toujours à jour immédiatement
 * (l'utilisateur n'a pas besoin de cliquer sur « 🎲 Répartir » à chaque petite modification). */
function autoAssignQuiet(session, moduleId) {
  if (typeof autoAssignModuleGroups === "function") autoAssignModuleGroups(session, moduleId, { shuffle: false });
}

/* ============================================================
   VUE « Affectations »
   ============================================================ */
/* ---------- Tableau des cas de planification automatique ---------- */
// Résultat de la dernière planification automatique (rempli par les boutons ci-dessous),
// permettant de choisir un autre cas que celui appliqué par défaut sans tout relancer.
let AUTOSCHEDULE_RESULT = null;

function renderAutoScheduleCasesPanel() {
  const panel = document.getElementById("autoScheduleCasesPanel");
  const tbody = document.getElementById("autoScheduleCasesTbody");
  const title = document.getElementById("autoScheduleCasesTitle");
  if (!panel || !tbody || !AUTOSCHEDULE_RESULT) return;

  const { cases, appliedIndex, fullDayNote } = AUTOSCHEDULE_RESULT;
  panel.classList.remove("hidden");
  title.textContent = `🎲 ${cases.length} cas de planification trouvé(s)` + (fullDayNote ? " — " + fullDayNote : "");
  tbody.innerHTML = "";

  cases.forEach((c, i) => {
    const tr = document.createElement("tr");
    tr.className = "case-row" + (i === appliedIndex ? " applied" : "");
    tr.tabIndex = 0;

    const tdLabel = document.createElement("td");
    tdLabel.textContent = c.label;
    tr.appendChild(tdLabel);

    const tdPlaced = document.createElement("td");
    tdPlaced.textContent = `${c.totalJobs - c.unplacedCount}/${c.totalJobs}`;
    tr.appendChild(tdPlaced);

    const tdConflicts = document.createElement("td");
    tdConflicts.textContent = String(c.conflictCount);
    tdConflicts.className = "case-conflicts " + (c.conflictCount === 0 ? "zero" : "nonzero");
    tr.appendChild(tdConflicts);

    const tdAction = document.createElement("td");
    if (i === appliedIndex) {
      tdAction.innerHTML = `<span class="case-applied-tag">✓ Appliqué</span>`;
    } else {
      const btn = document.createElement("button");
      btn.className = "btn-mini";
      btn.textContent = "Choisir";
      btn.addEventListener("click", (e) => { e.stopPropagation(); applyAutoScheduleCase(i); });
      tdAction.appendChild(btn);
    }
    tr.appendChild(tdAction);

    tr.addEventListener("click", () => { if (i !== AUTOSCHEDULE_RESULT.appliedIndex) applyAutoScheduleCase(i); });
    tbody.appendChild(tr);
  });
}

/** Applique le cas choisi (remplace les séances auto par celles de ce cas) sans relancer l'algorithme. */
function applyAutoScheduleCase(index) {
  if (!AUTOSCHEDULE_RESULT) return;
  const { session, fixedSeances, cases } = AUTOSCHEDULE_RESULT;
  const chosen = cases[index];
  if (!chosen) return;
  session.seances = fixedSeances.concat(chosen.placedSeances);
  saveState(`🎲 Planification automatique — ${chosen.label} choisi manuellement (${chosen.conflictCount} conflit(s))`);
  AUTOSCHEDULE_RESULT.appliedIndex = index;
  renderAutoScheduleCasesPanel();
  renderAffectationsView();
  refreshAllSelectorsAndGrids();
  showToast(`✅ ${chosen.label} appliqué (${chosen.conflictCount} conflit(s), ${chosen.totalJobs - chosen.unplacedCount}/${chosen.totalJobs} séance(s) placée(s)).`);
}

function initAutoScheduleCasesPanel() {
  const panel = document.getElementById("autoScheduleCasesPanel");
  const minBtn = document.getElementById("autoScheduleCasesMinBtn");
  const closeBtn = document.getElementById("autoScheduleCasesCloseBtn");
  if (!panel || !minBtn || !closeBtn) return;
  minBtn.addEventListener("click", () => {
    panel.classList.toggle("minimized");
    minBtn.textContent = panel.classList.contains("minimized") ? "▢" : "▁";
    minBtn.title = panel.classList.contains("minimized") ? "Développer" : "Réduire";
  });
  closeBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
    panel.classList.remove("minimized");
    minBtn.textContent = "▁";
  });
}

function initAffectationsView() {
  document.getElementById("affSemesterFilter").addEventListener("change", renderAffectationsView);
  initAutoScheduleCasesPanel();

  function eligibleModuleIds(session, filterVal) {
    return session.modules
      .filter(m => (!filterVal || m.semestre === filterVal) && m.groupIds.length &&
        (getModuleAffectations(session, m.id).length || session.teachers.some(t => teacherCanTeachModule(t, m.id) && hasTeacherGroupCountPlan(t, m.id))))
      .map(m => m.id);
  }

  document.getElementById("autoScheduleAllBtn").addEventListener("click", () => {
    const ok = confirm(
      "Répartir et planifier automatiquement toutes les séances éligibles du semestre affiché ?\n\n" +
      "Les séances déjà planifiées automatiquement pour ces modules seront recalculées (jour, créneau, salle, voire enseignant/groupes peuvent changer).\n" +
      "Les séances créées ou modifiées manuellement ne sont jamais touchées."
    );
    if (!ok) return;
    const session = getCurrentSession();
    const filterVal = document.getElementById("affSemesterFilter").value;
    const moduleIds = eligibleModuleIds(session, filterVal);
    if (!moduleIds.length) { showToast("Aucun module avec affectations à planifier."); return; }
    autoAssignAllModules(session, moduleIds);
    const fullDayIds = moduleIds.filter(id => isFullDayModule(session.modules.find(m => m.id === id)));
    const normalIds = moduleIds.filter(id => !fullDayIds.includes(id));
    const summaries = [];
    let result = null;
    if (normalIds.length) {
      result = autoScheduleSession(session, { onlyModuleIds: normalIds, historyLabel: "🎲 Tout répartir & planifier automatiquement" });
      summaries.push(result.summary);
    }
    fullDayIds.forEach(id => summaries.push(autoAssignFullDayDays(session, id, { attempts: 25, historyLabel: "🎲 Tout répartir & planifier automatiquement" }).summary));
    renderAffectationsView();
    refreshAllSelectorsAndGrids();
    showToast(summaries.join(" "));
    if (result && result.cases && result.cases.length) {
      AUTOSCHEDULE_RESULT = {
        session, fixedSeances: result.fixedSeances, cases: result.cases, appliedIndex: result.appliedCaseIndex,
        fullDayNote: fullDayIds.length ? "les modules en journée complète sont planifiés à part, non inclus ici" : null,
      };
      renderAutoScheduleCasesPanel();
    }
  });

  // « Compléter » : laisse intactes toutes les séances déjà programmées (manuelles ou
  // automatiques) et ne répartit/planifie que ce qui n'a encore aucune séance.
  document.getElementById("completeScheduleBtn").addEventListener("click", () => {
    const session = getCurrentSession();
    const filterVal = document.getElementById("affSemesterFilter").value;
    const moduleIds = eligibleModuleIds(session, filterVal);
    if (!moduleIds.length) { showToast("Aucun module avec affectations à planifier."); return; }
    completeAssignAllModules(session, moduleIds);
    const fullDayIds = moduleIds.filter(id => isFullDayModule(session.modules.find(m => m.id === id)));
    const normalIds = moduleIds.filter(id => !fullDayIds.includes(id));
    const summaries = [];
    let result = null;
    if (normalIds.length) {
      result = autoScheduleSession(session, { onlyModuleIds: normalIds, keepExistingAuto: true, historyLabel: "➕ Compléter (garder l'existant)" });
      summaries.push(result.summary);
    }
    fullDayIds.forEach(id => summaries.push(autoAssignFullDayDays(session, id, { attempts: 25, keepExistingAuto: true, historyLabel: "➕ Compléter (garder l'existant)" }).summary));
    renderAffectationsView();
    refreshAllSelectorsAndGrids();
    showToast("➕ Existant conservé. " + summaries.join(" "));
    if (result && result.cases && result.cases.length) {
      AUTOSCHEDULE_RESULT = {
        session, fixedSeances: result.fixedSeances, cases: result.cases, appliedIndex: result.appliedCaseIndex,
        fullDayNote: fullDayIds.length ? "les modules en journée complète sont planifiés à part, non inclus ici" : null,
      };
      renderAutoScheduleCasesPanel();
    }
  });
}

function affChanged() {
  const session = getCurrentSession();
  if (session) session.modules.forEach(m => syncSeancesFromModuleAffectations(session, m.id));
  saveState();
  if (typeof refreshAllSelectorsAndGrids === "function") {
    refreshAllSelectorsAndGrids();
  } else {
    renderAffectationsView();
    renderDashboard();
  }
}

function renderAffectationsView() {
  const session = getCurrentSession();
  cleanAffectations(session);

  // Filtre semestre
  const filter = document.getElementById("affSemesterFilter");
  const previous = filter.value;
  const semesters = Array.from(new Set(session.modules.map(m => m.semestre).filter(Boolean))).sort();
  filter.innerHTML = "";
  filter.appendChild(new Option("Tous les semestres", ""));
  semesters.forEach(s => filter.appendChild(new Option("Semestre " + s, s)));
  filter.value = semesters.includes(previous) ? previous : "";

  renderAffectationsSummary(session);

  const wrap = document.getElementById("affectationsWrap");
  wrap.innerHTML = "";
  const modules = session.modules.filter(m => !filter.value || m.semestre === filter.value);
  if (!modules.length) {
    wrap.appendChild(el("div", { class: "empty-state" }, "Aucun module. Ajoutez d'abord des modules dans l'onglet Ressources."));
  }
  modules.forEach(m => wrap.appendChild(buildAffectationCard(session, m)));

  renderTeacherLoad(session);
}

function renderAffectationsSummary(session) {
  const box = document.getElementById("affSummary");
  box.innerHTML = "";
  const withGroups = session.modules.filter(m => m.groupIds.length);
  const issues = computeAffectationIssues(session);
  const incompleteModules = new Set(issues.filter(i => i.level === "error").map(i => i.moduleId));
  const complete = withGroups.filter(m => !incompleteModules.has(m.id)).length;

  box.appendChild(el("div", { class: "aff-summary" }, [
    el("span", { class: "pill" }, `${withGroups.length} module(s) avec groupes`),
    el("span", { class: "pill " + (withGroups.length && complete === withGroups.length ? "ok" : (incompleteModules.size ? "ko" : "")) },
      `${complete} complet(s)`),
    incompleteModules.size ? el("span", { class: "pill ko" }, `${incompleteModules.size} à compléter`) : null,
    el("button", {
      class: "btn small ghost",
      title: "Relit toutes les séances déjà planifiées (Planning par groupe/semestre, Vue enseignant, Vue salle) et complète les affectations manquantes, y compris pour les séances créées avant que le module ait un périmètre de groupes défini.",
      onclick: () => {
        const n = resyncAllAffectationsFromSeances(session);
        saveState("🔄 Affectations resynchronisées depuis les séances");
        refreshAllSelectorsAndGrids();
        showToast(n ? `${n} séance(s) prise(s) en compte dans les affectations` : "Affectations déjà à jour");
      },
    }, "🔄 Resynchroniser depuis les séances"),
  ]));

  if (issues.length) {
    const list = el("div", { class: "aff-issues" });
    issues.slice(0, 12).forEach(i => list.appendChild(el("div", { class: "aff-issue " + i.level }, (i.level === "error" ? "⛔ " : "⚠️ ") + i.message)));
    if (issues.length > 12) list.appendChild(el("div", { class: "aff-issue more" }, `… et ${issues.length - 12} autre(s)`));
    box.appendChild(list);
  }
}

function buildAffectationCard(session, m) {
  const affs = getModuleAffectations(session, m.id);
  // Une carte ne propose que les groupes du même semestre que le module.
  // Les références éventuellement héritées d'un autre semestre restent conservées
  // dans les données pour ne pas les supprimer silencieusement, mais ne sont jamais
  // présentées dans cette vue.
  const semesterGroups = session.groups.filter(g => !m.semestre || g.semestre === m.semestre);
  const issues = computeAffectationIssues(session).filter(i => i.moduleId === m.id && i.level === "error");
  const covered = m.groupIds.length && !issues.length;
  const transversal = isTransversal(m);
  const hasConfiguredCounts = session.teachers.some(t => teacherCanTeachModule(t, m.id) && hasTeacherGroupCountPlan(t, m.id));
  const hasPlanningSetup = affs.length > 0 || hasConfiguredCounts;

  // --- En-tête
  const status = !m.groupIds.length
    ? el("span", { class: "pill" }, "aucun groupe défini")
    : (covered ? el("span", { class: "pill ok" }, `✅ ${m.groupIds.length} groupe(s) · ${affs.filter(a => a.groupIds.length).length} enseignant(s)`)
      : el("span", { class: "pill ko" }, "⚠️ à compléter"));
  const card = el("div", { class: "panel aff-card" });
  card.appendChild(el("div", { class: "aff-head" }, [
    el("div", {}, [
      el("strong", {}, m.name),
      el("span", { class: "aff-sem" }, m.semestre ? ` · Semestre ${m.semestre}` : ""),
      el("span", { class: "pill nature" + (transversal ? " transversal" : "") }, moduleNatureLabel(m)),
    ]),
    status,
  ]));
  if (transversal) {
    card.appendChild(el("p", { class: "hint" }, `🧩 Module transversal : séance de 1h30, groupes regroupés par 2 à 3 dans un amphi. Un enseignant affecté à ce module doit avoir au moins ${TRANSVERSAL_MIN_GROUPS} groupes.`));
  }

  // --- Groupes concernés
  const chips = el("div", { class: "aff-groups" });
  semesterGroups.forEach(g => {
    const cb = el("input", { type: "checkbox" });
    cb.checked = m.groupIds.includes(g.id);
    cb.addEventListener("change", () => {
      if (cb.checked) { if (!m.groupIds.includes(g.id)) m.groupIds.push(g.id); }
      else m.groupIds = m.groupIds.filter(id => id !== g.id);
      affChanged();
    });
    chips.appendChild(el("label", { class: "chk" + (cb.checked ? " on" : "") }, [cb, ` ${g.name}`]));
  });
  const quick = (label, fn) => el("button", { class: "btn small ghost", onclick: () => { fn(); affChanged(); } }, label);
  card.appendChild(el("div", { class: "aff-label" }, [
    `Groupes concernés (${m.groupIds.filter(id => semesterGroups.some(g => g.id === id)).length})`,
    quick("Groupes du semestre", () => { m.groupIds = semesterGroups.map(g => g.id); }),
    quick("Tous", () => { m.groupIds = semesterGroups.map(g => g.id); }),
    quick("Aucun", () => { m.groupIds = []; }),
  ]));
  card.appendChild(chips);

  if (!m.groupIds.length) {
    card.appendChild(el("p", { class: "hint" }, "Cochez les groupes qui suivent ce module (ex. en amphi) pour pouvoir répartir les enseignants."));
    return card;
  }

  // --- Enseignants et groupes pris en charge individuellement
  card.appendChild(el("div", { class: "aff-label" }, "Enseignant et groupes pris en charge (sélection explicite)"));
  card.appendChild(el("p", { class: "hint" }, "Cochez les groupes de chaque enseignant. Un groupe ne peut être affecté qu'à un seul enseignant pour ce module."));
  affs.forEach(aff => card.appendChild(buildAffectationRow(session, m, aff)));

  const actions = el("div", { class: "aff-actions" }, [
    el("button", { class: "btn small", onclick: () => addAffectationRow(session, m) }, "+ Ajouter un enseignant"),
    affs.length > 1 ? el("button", { class: "btn small ghost", title: "Ex. 5 groupes et 2 enseignants → 3 + 2", onclick: () => { distributeGroupsEvenly(session, m.id); affChanged(); } }, "⚖️ Répartir équitablement") : null,
    hasPlanningSetup ? el("button", {
      class: "btn small primary", title: "Choisit automatiquement quels groupes précis chaque enseignant prend en charge (et leur regroupement en amphi si module transversal), selon les disponibilités",
      onclick: () => {
        if (typeof autoAssignModuleGroups !== "function") return;
        syncModuleAffectationsFromTeacherCounts(session, m.id);
        autoAssignModuleGroups(session, m.id, { shuffle: true });
        affChanged();
      },
    }, "🎲 Répartir les groupes automatiquement") : null,
    hasPlanningSetup ? el("button", {
      class: "btn small ghost", title: "Répartit les groupes puis planifie automatiquement les séances (jour / créneau / salle) sans conflit",
      onclick: () => {
        if (typeof autoScheduleSession !== "function") return;
        syncModuleAffectationsFromTeacherCounts(session, m.id);
        autoAssignModuleGroups(session, m.id, { shuffle: true });
        const report = autoScheduleSession(session, { onlyModuleIds: [m.id] });
        affChanged();
        refreshAllSelectorsAndGrids();
        showToast(report.summary);
      },
    }, "🗓️ Planifier automatiquement") : null,
  ]);
  card.appendChild(actions);

  return card;
}

function buildAffectationRow(session, m, aff) {
  const teacherSelect = el("select", {});
  const eligible = eligibleTeachersForModule(session, m.id);
  const currentTeacher = session.teachers.find(t => t.id === aff.teacherId);
  const options = eligible.some(t => t.id === aff.teacherId) || !currentTeacher ? eligible : [currentTeacher, ...eligible];
  options.forEach(t => teacherSelect.appendChild(new Option(t.name, t.id)));
  if (currentTeacher && !eligible.some(t => t.id === aff.teacherId)) {
    teacherSelect.title = `${currentTeacher.name} n'est plus déclaré comme assurant ce module (voir Ressources → Enseignants → 📚 Modules assurés).`;
    teacherSelect.classList.add("select-warning");
  }
  teacherSelect.value = aff.teacherId;
  teacherSelect.addEventListener("change", () => {
    if (getModuleAffectations(session, m.id).some(a => a !== aff && a.teacherId === teacherSelect.value)) {
      alert("Cet enseignant a déjà une ligne pour ce module : modifiez plutôt son nombre de groupes sur cette ligne.");
      renderAffectationsView();
      return;
    }
    aff.teacherId = teacherSelect.value;
    affChanged();
  });

  const transversal = isTransversal(m);
  const minCount = transversal ? TRANSVERSAL_MIN_GROUPS : 1;
  const countInput = el("input", { type: "number", min: String(minCount), step: "1", class: "aff-count-input" });
  countInput.value = String(aff.groupCount || 0);
  countInput.title = transversal ? `Minimum ${TRANSVERSAL_MIN_GROUPS} groupes (module transversal, regroupés par 2-3 en amphi)` : "Nombre de groupes pris en charge";
  countInput.addEventListener("change", () => {
    aff.groupCount = aff.groupIds.length;
    countInput.value = String(aff.groupCount);
    affChanged();
  });
  countInput.readOnly = true;
  countInput.title = "Calculé automatiquement à partir des groupes cochés ci-dessous";

  const groupChooser = el("div", { class: "aff-explicit-groups" });
  (m.groupIds || []).map(id => session.groups.find(g => g.id === id)).filter(Boolean).forEach(g => {
    const groupCb = el("input", { type: "checkbox" });
    groupCb.checked = aff.groupIds.includes(g.id);
    const assignedToOther = session.affectations.some(other =>
      other !== aff && other.moduleId === m.id && (other.groupIds || []).includes(g.id)
    );
    groupCb.disabled = assignedToOther;
    if (assignedToOther) groupCb.title = "Ce groupe est déjà affecté à un autre enseignant pour ce module.";
    groupCb.addEventListener("change", () => {
      if (groupCb.checked) {
        session.affectations.filter(other => other !== aff && other.moduleId === m.id).forEach(other => {
          other.groupIds = (other.groupIds || []).filter(id => id !== g.id);
          other.groupCount = other.groupIds.length;
        });
        if (!aff.groupIds.includes(g.id)) aff.groupIds.push(g.id);
      } else {
        aff.groupIds = aff.groupIds.filter(id => id !== g.id);
      }
      aff.groupCount = aff.groupIds.length;
      affChanged();
    });
    groupChooser.appendChild(el("label", { class: "chk" + (groupCb.checked ? " on" : "") }, [groupCb, ` ${g.name}`]));
  });

  // Composition réelle (calculée automatiquement) : groupes précis + regroupement en amphi
  const composition = el("div", { class: "aff-row-groups" });
  if (aff.groupIds.length) {
    const packs = transversal ? packSizes(aff.groupIds.length) : [aff.groupIds.length];
    let cursor = 0;
    packs.forEach((size, i) => {
      const packGroupIds = aff.groupIds.slice(cursor, cursor + size);
      cursor += size;
      const names = affGroupNames(session, packGroupIds).join(" + ");
      composition.appendChild(el("span", { class: "chk on", title: transversal ? "Regroupés dans un même amphi" : "" },
        (transversal ? "🏛️ " : "") + names + (transversal && packs.length > 1 ? ` (paquet ${i + 1})` : "")));
    });
  } else {
    composition.appendChild(el("span", { class: "hint" }, "Aucun groupe sélectionné pour cet enseignant."));
  }

  const done = affectationSeanceCount(session, aff);
  const planBtn = isFullDayModule(m)
    ? el("span", { class: "hint" }, "→ jour par groupe ci-dessous")
    : el("button", {
      class: "btn small primary", title: "Créer la séance de cet enseignant avec ses groupes",
      onclick: () => {
        if (!aff.groupIds.length) { alert("Sélectionnez d'abord les groupes pris en charge par cet enseignant."); return; }
        const existing = session.seances.find(s => s.moduleId === m.id && s.color);
        const nextGroups = unplannedAffectationGroupIds(session, aff);
        openSeanceModal(null, { moduleId: m.id, teacherId: aff.teacherId, groupIds: nextGroups.length ? nextGroups : aff.groupIds.slice(), roomId: defaultAmphiRoomId(session), color: existing ? existing.color : undefined });
      },
    }, "🗓️ Planifier");

  return el("div", { class: "aff-row" }, [
    el("div", {}, [el("div", { class: "aff-row-groups-label" }, "1. Groupe(s) à affecter :"), groupChooser]),
    el("div", {}, [el("div", { class: "aff-row-groups-label" }, "2. Enseignant :"), teacherSelect]),
    el("div", {}, [countInput, el("span", { class: "aff-count" }, " groupe(s)")]),
    el("div", {}, [el("div", { class: "aff-row-groups-label" }, "Groupes attribués :"), composition]),
    el("span", { class: "aff-planned " + (done ? "ok" : "") }, done ? `${done} séance(s) planifiée(s)` : "à planifier"),
    planBtn,
    deleteBtn(() => {
      session.affectations = session.affectations.filter(a => a !== aff);
      affChanged();
    }),
  ]);
}

function addAffectationRow(session, m) {
  const current = getModuleAffectations(session, m.id);
  if (current.length && !current.some(a => (a.groupIds || []).length)) {
    alert("Choisissez d'abord le ou les groupes à affecter au premier enseignant avant d'ajouter un autre enseignant.");
    return;
  }
  if (current.length && !m.groupIds.some(gid => !current.some(a => (a.groupIds || []).includes(gid)))) {
    alert("Tous les groupes de ce module sont déjà affectés. Supprimez d'abord un ou plusieurs groupes d'un enseignant pour pouvoir en affecter un autre.");
    return;
  }
  const used = new Set(getModuleAffectations(session, m.id).map(a => a.teacherId));
  const teacher = eligibleTeachersForModule(session, m.id).find(t => !used.has(t.id));
  if (!teacher) {
    const anyEligible = eligibleTeachersForModule(session, m.id).length > 0;
    alert(anyEligible
      ? "Tous les enseignants assurant ce module ont déjà une ligne."
      : "Aucun enseignant n'est déclaré comme assurant ce module. Ajoutez-le depuis Ressources → Enseignants → 📚 Modules assurés.");
    return;
  }
  // Une nouvelle ligne démarre sans groupe : l'utilisateur choisit explicitement
  // les groupes dans les cases à cocher de la ligne de l'enseignant.
  session.affectations.push({ id: uid("af"), moduleId: m.id, teacherId: teacher.id, groupCount: 0, groupIds: [] });
  affChanged();
}

function renderTeacherLoad(session) {
  const box = document.getElementById("affTeacherLoad");
  box.innerHTML = "";
  const rows = session.teachers.map(t => {
    const mine = (session.affectations || []).filter(a => a.teacherId === t.id && a.groupIds.length);
    return { t, mine, groups: mine.reduce((n, a) => n + a.groupIds.length, 0) };
  }).filter(r => r.mine.length);
  if (!rows.length) { box.appendChild(el("div", { class: "empty-state" }, "Aucune affectation pour l'instant.")); return; }
  const table = el("table", { class: "table" }, [
    el("thead", {}, el("tr", {}, ["Enseignant", "Modules et groupes", "Nb modules", "Nb groupes"].map(h => el("th", {}, h)))),
    el("tbody", {}, rows.map(r => el("tr", {}, [
      el("td", {}, r.t.name),
      el("td", {}, r.mine.map(a => {
        const m = session.modules.find(x => x.id === a.moduleId);
        return el("div", {}, `${m ? m.name : "?"} — ${affGroupNames(session, a.groupIds).join(", ")}`);
      })),
      el("td", {}, String(r.mine.length)),
      el("td", {}, String(r.groups)),
    ]))),
  ]);
  box.appendChild(table);
}
