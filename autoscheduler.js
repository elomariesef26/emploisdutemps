/* ============================================================
   AUTOSCHEDULER.JS — Répartition automatique des groupes et
   planification automatique des séances (avec régénération en
   cas de conflit : le bouton "Régénérer" essaie une autre
   combinaison possible).

   1) autoAssignModuleGroups(session, moduleId) :
      à partir du nombre de groupes demandé par chaque enseignant
      (aff.groupCount), choisit QUELS groupes précis chacun prend
      en charge (aff.groupIds), en tenant compte des disponibilités
      des enseignants. Pour un module transversal, les groupes d'un
      même enseignant sont automatiquement regroupés par paquets de
      2 à 3 (jamais un groupe isolé).

   2) autoScheduleSession(session, opts) :
      place automatiquement (jour, créneau, salle) les séances
      correspondant aux affectations, en essayant plusieurs
      combinaisons aléatoires et en gardant la meilleure (le moins
      de conflits). Les séances qu'il crée/replace sont marquées
      `auto: true` ; les séances créées manuellement (via la vue
      Planning ou le bouton "Planifier") ne sont jamais touchées.
   ============================================================ */

function autoSchedulerRandomColor() {
  if (typeof randomColor === "function") return randomColor();
  const palette = ["#fcebc0", "#f6c9c9", "#d7ecc8", "#c7e3f7", "#e6d7f7", "#f7d7ec", "#d7f7ec"];
  return palette[Math.floor(Math.random() * palette.length)];
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Détermine, pour chaque enseignant d'un module, quels groupes précis il prend en charge,
 * à partir du nombre demandé (aff.groupCount). Priorité donnée aux enseignants les plus
 * contraints (le moins de créneaux disponibles) pour limiter les impasses. Groupes restants
 * non couverts si la demande totale dépasse le nombre de groupes du module.
 */
function autoAssignModuleGroups(session, moduleId, { shuffle = true } = {}) {
  const m = session.modules.find(x => x.id === moduleId);
  if (!m) return null;
  // Si aucun périmètre n'a encore été choisi pour le module, utiliser tous les groupes
  // du même semestre avant de répartir les quantités configurées par enseignant.
  if (!(m.groupIds || []).length) {
    m.groupIds = session.groups
      .filter(g => !m.semestre || g.semestre === m.semestre)
      .map(g => g.id);
  }
  if (typeof syncModuleAffectationsFromTeacherCounts === "function") {
    syncModuleAffectationsFromTeacherCounts(session, moduleId);
  }
  const affs = getModuleAffectations(session, moduleId);
  if (!affs.length) return null;

  let pool = m.groupIds.slice();
  if (shuffle) pool = shuffleArray(pool);

  // On traite d'abord les enseignants les plus indisponibles (plus contraints), pour éviter
  // qu'un enseignant très pris ne se retrouve sans créneau possible.
  const order = affs.slice().sort((a, b) => {
    const ta = session.teachers.find(t => t.id === a.teacherId);
    const tb = session.teachers.find(t => t.id === b.teacherId);
    return (tb && tb.unavailable ? tb.unavailable.length : 0) - (ta && ta.unavailable ? ta.unavailable.length : 0);
  });

  order.forEach(a => { a.groupIds = []; });
  order.forEach(a => {
    const n = Math.max(0, Number(a.groupCount) || 0);
    a.groupIds = pool.splice(0, n);
  });

  saveState(shuffle ? "🎲 Répartir les groupes du module" : undefined);
  return { unassigned: pool };
}

/** Répartit toutes les affectations de tous les modules d'une session (ou d'une liste de modules donnée). */
function autoAssignAllModules(session, moduleIds) {
  const ids = moduleIds || session.modules.map(m => m.id);
  ids.forEach(id => autoAssignModuleGroups(session, id, { shuffle: true }));
}

/**
 * Variante « Compléter » de autoAssignModuleGroups : ne touche JAMAIS l'enseignant d'un
 * groupe qui a déjà une séance programmée pour ce module (manuelle ou automatique) — cette
 * affectation est déduite directement des séances existantes, pas de ce qui est saisi dans
 * l'onglet Affectations. Seuls les groupes du module qui n'ont encore AUCUNE séance sont
 * répartis entre les enseignants, pour compléter leur quota (aff.groupCount) restant.
 */
function completeAssignModuleGroups(session, moduleId) {
  const m = session.modules.find(x => x.id === moduleId);
  if (!m) return null;
  if (!(m.groupIds || []).length) {
    m.groupIds = session.groups
      .filter(g => !m.semestre || g.semestre === m.semestre)
      .map(g => g.id);
  }
  if (typeof syncModuleAffectationsFromTeacherCounts === "function") {
    syncModuleAffectationsFromTeacherCounts(session, moduleId);
  }
  const affs = getModuleAffectations(session, moduleId);
  if (!affs.length) return null;

  // Groupes déjà couverts par une séance existante de ce module, par enseignant.
  const coveredByTeacher = new Map(); // teacherId -> Set(groupId)
  session.seances.filter(s => s.moduleId === moduleId && s.teacherId).forEach(s => {
    if (!coveredByTeacher.has(s.teacherId)) coveredByTeacher.set(s.teacherId, new Set());
    (s.groupIds || []).forEach(gid => coveredByTeacher.get(s.teacherId).add(gid));
  });
  const coveredGroupIds = new Set(Array.from(coveredByTeacher.values(), set => Array.from(set)).flat());

  // Seuls les groupes du module sans aucune séance existante sont à répartir.
  let pool = m.groupIds.filter(gid => !coveredGroupIds.has(gid));

  const order = affs.slice().sort((a, b) => {
    const ta = session.teachers.find(t => t.id === a.teacherId);
    const tb = session.teachers.find(t => t.id === b.teacherId);
    return (tb && tb.unavailable ? tb.unavailable.length : 0) - (ta && ta.unavailable ? ta.unavailable.length : 0);
  });

  order.forEach(a => {
    const already = Array.from(coveredByTeacher.get(a.teacherId) || []);
    const stillNeeded = Math.max(0, (Number(a.groupCount) || 0) - already.length);
    a.groupIds = already.concat(pool.splice(0, stillNeeded));
  });

  saveState();
  return { unassigned: pool };
}

/** Comme autoAssignAllModules, mais en mode « Compléter » (voir completeAssignModuleGroups). */
function completeAssignAllModules(session, moduleIds) {
  const ids = moduleIds || session.modules.map(m => m.id);
  ids.forEach(id => completeAssignModuleGroups(session, id));
}


/* ---------- Salles ---------- */

/** Cherche une salle libre à ce jour/créneaux, avec assez de capacité, en essayant la salle par défaut d'abord. */
function findRoomForPack(session, occupied, packGroupIds, day, startSlotIndex, duration, preferredRoomId) {
  const totalEffectif = packGroupIds.reduce((sum, gid) => {
    const g = session.groups.find(x => x.id === gid);
    return sum + (g ? Number(g.effectif) || 0 : 0);
  }, 0);
  const needsAmphi = packGroupIds.length > 1;

  const isRoomFree = (roomId) => {
    const room = session.rooms.find(r => r.id === roomId);
    for (let k = 0; k < duration; k++) {
      const idx = startSlotIndex + k;
      if (room && isRoomUnavailable(room, day, idx)) return false;
      const key = day + "|" + idx + "|room|" + roomId;
      if (occupied.has(key)) return false;
    }
    return true;
  };

  const candidates = [];
  if (preferredRoomId) {
    const pr = session.rooms.find(r => r.id === preferredRoomId);
    if (pr && pr.capacity >= totalEffectif) candidates.push(pr);
  }
  const ranked = session.rooms
    .filter(r => r.id !== preferredRoomId)
    .filter(r => r.capacity >= totalEffectif)
    .sort((a, b) => {
      // Priorité aux amphis pour les paquets groupés, aux salles normales sinon,
      // puis à la capacité la plus proche du besoin (évite de « gaspiller » un grand amphi).
      const aAmphi = a.type === "amphi" ? 0 : 1, bAmphi = b.type === "amphi" ? 0 : 1;
      const prefA = needsAmphi ? aAmphi : (a.type === "amphi" ? 1 : 0);
      const prefB = needsAmphi ? bAmphi : (b.type === "amphi" ? 1 : 0);
      if (prefA !== prefB) return prefA - prefB;
      return a.capacity - b.capacity;
    });
  candidates.push(...ranked);

  for (const room of candidates) {
    if (isRoomFree(room.id)) return room;
  }
  return null; // aucune salle libre avec assez de capacité à ce créneau
}

/* ---------- Occupation ---------- */

function buildOccupancy(seances) {
  const occ = new Set();
  seances.forEach(s => {
    for (let k = 0; k < s.duration; k++) {
      const idx = s.startSlotIndex + k;
      if (s.teacherId) occ.add(s.day + "|" + idx + "|teacher|" + s.teacherId);
      if (s.roomId) occ.add(s.day + "|" + idx + "|room|" + s.roomId);
      (s.groupIds || []).forEach(gid => occ.add(s.day + "|" + idx + "|group|" + gid));
    }
  });
  return occ;
}

function markOccupancy(occ, s) {
  for (let k = 0; k < s.duration; k++) {
    const idx = s.startSlotIndex + k;
    if (s.teacherId) occ.add(s.day + "|" + idx + "|teacher|" + s.teacherId);
    if (s.roomId) occ.add(s.day + "|" + idx + "|room|" + s.roomId);
    (s.groupIds || []).forEach(gid => occ.add(s.day + "|" + idx + "|group|" + gid));
  }
}

function isTeacherFreeAt(session, teacherId, day, startSlotIndex, duration, occ) {
  const teacher = session.teachers.find(t => t.id === teacherId);
  for (let k = 0; k < duration; k++) {
    const idx = startSlotIndex + k;
    if (teacher && isTeacherUnavailable(teacher, day, idx)) return false;
    if (occ.has(day + "|" + idx + "|teacher|" + teacherId)) return false;
  }
  return true;
}

function areGroupsFreeAt(groupIds, day, startSlotIndex, duration, occ) {
  for (let k = 0; k < duration; k++) {
    const idx = startSlotIndex + k;
    for (const gid of groupIds) {
      if (occ.has(day + "|" + idx + "|group|" + gid)) return false;
    }
  }
  return true;
}

/* ---------- Construction des "jobs" à planifier (un job = une séance à créer) ---------- */

function sameGroupSet(a, b) {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every(id => sb.has(id));
}

function buildJobsForModules(session, moduleIds, alreadyPlannedSeances) {
  const jobs = [];
  moduleIds.forEach(moduleId => {
    const m = session.modules.find(x => x.id === moduleId);
    if (!m || isFullDayModule(m)) return; // les modules "journée complète" sont gérés par autoAssignFullDayDays()
    const affs = getModuleAffectations(session, moduleId).filter(a => a.groupIds.length);
    const duration = seanceDurationForModule(session, m);
    affs.forEach(a => {
      // Les modules métier génèrent une séance distincte par groupe. Seuls les modules
      // transversaux mutualisent plusieurs groupes dans une même séance (paquets 2–3).
      const packs = isTransversal(m) ? packSizes(a.groupIds.length) : Array(a.groupIds.length).fill(1);
      let cursor = 0;
      packs.forEach(size => {
        const packGroupIds = a.groupIds.slice(cursor, cursor + size);
        cursor += size;
        if (!packGroupIds.length) return;
        // Ce paquet précis (module + enseignant + mêmes groupes) est-il déjà planifié
        // (séance manuelle ou déjà placée) ? Si oui, pas besoin de le replanifier.
        const alreadyCovered = (alreadyPlannedSeances || []).some(s =>
          s.moduleId === moduleId && s.teacherId === a.teacherId && sameGroupSet(s.groupIds, packGroupIds)
        );
        if (alreadyCovered) return;
        jobs.push({ moduleId, teacherId: a.teacherId, groupIds: packGroupIds, duration, nature: m.nature, color: a.color });
      });
    });
  });
  return jobs;
}

/**
 * Tente de placer un job (jour + créneau + salle) sans conflit. Essaie toutes les
 * combinaisons jour × créneau de départ, dans un ordre aléatoire (pour permettre au
 * bouton "Régénérer" de proposer une autre combinaison à chaque clic).
 */
function placeJob(session, occ, job) {
  const days = shuffleArray(session.config.days);
  const maxStart = session.config.slots.length - job.duration;
  if (maxStart < 0) return null;
  const starts = shuffleArray(Array.from({ length: maxStart + 1 }, (_, i) => i));

  // Salle par défaut à essayer en priorité : celle du groupe pour un paquet d'1 seul groupe,
  // sinon un amphi.
  const preferredRoomId = job.groupIds.length === 1
    ? (session.groups.find(g => g.id === job.groupIds[0]) || {}).defaultRoomId
    : (session.rooms.find(r => r.type === "amphi") || {}).id;

  for (const day of days) {
    for (const start of starts) {
      if (job.groupIds.some(gid => isGroupAwayForEducationalAction(session, gid, day))) continue;
      if (!isTeacherFreeAt(session, job.teacherId, day, start, job.duration, occ)) continue;
      if (!areGroupsFreeAt(job.groupIds, day, start, job.duration, occ)) continue;
      const room = findRoomForPack(session, occ, job.groupIds, day, start, job.duration, preferredRoomId);
      if (!room) continue;
      return { day, startSlotIndex: start, roomId: room.id };
    }
  }
  return null; // pas de solution sans conflit pour ce job
}

/* ============================================================
   MODULES "JOURNÉE COMPLÈTE" (ex. Actions Éducatives)
   Un groupe occupe TOUTE une journée par semaine sur ce module. Le jour peut être choisi
   manuellement par groupe (setFullDayManual) ou déterminé automatiquement pour tous les
   groupes du module (autoAssignFullDayDays), en répartissant les groupes sur les jours de
   la semaine et en choisissant une salle adaptée dans le pool défini pour le module — ce
   qui libère la salle par défaut du groupe les autres jours pour d'autres groupes.
   ============================================================ */

/** Enseignant chargé de ce groupe pour ce module, d'après les affectations (module → enseignant → groupes). */
function groupTeacherIdForModule(session, moduleId, groupId) {
  const aff = getModuleAffectations(session, moduleId).find(a => a.groupIds.includes(groupId));
  return aff ? aff.teacherId : null;
}

/** Cherche une salle libre toute la journée, avec assez de capacité, dans le pool du module
 * (ou dans toutes les salles si aucun pool défini), en essayant la salle par défaut du groupe d'abord. */
function findRoomForFullDay(session, occ, day, roomPoolIds, effectif, preferredRoomId) {
  const duration = fullDayDuration(session);
  const pool = (roomPoolIds && roomPoolIds.length) ? session.rooms.filter(r => roomPoolIds.includes(r.id)) : session.rooms.slice();
  const isFree = (roomId) => {
    const room = pool.find(r => r.id === roomId) || session.rooms.find(r => r.id === roomId);
    for (let k = 0; k < duration; k++) {
      if (room && isRoomUnavailable(room, day, k)) return false;
      if (occ.has(day + "|" + k + "|room|" + roomId)) return false;
    }
    return true;
  };
  // La salle par défaut du groupe n'est proposée en priorité que si elle fait partie du pool
  // défini pour le module : le pool est une restriction voulue, jamais contournée.
  const candidates = [];
  if (preferredRoomId) {
    const pr = pool.find(r => r.id === preferredRoomId);
    if (pr && pr.capacity >= effectif) candidates.push(pr);
  }
  pool.filter(r => r.id !== preferredRoomId).filter(r => r.capacity >= effectif)
    .sort((a, b) => a.capacity - b.capacity)
    .forEach(r => candidates.push(r));
  for (const room of candidates) {
    if (isFree(room.id)) return room;
  }
  return null;
}

function buildFullDaySeance(moduleId, teacherId, groupId, day, roomId, duration, auto) {
  return {
    id: uid("se"), moduleId, teacherId, groupIds: [groupId], roomId, day, startSlotIndex: 0,
    duration, color: autoSchedulerRandomColor(), auto, fullDay: true,
  };
}

/**
 * Fixe (ou retire, si `day` est vide/nul) manuellement le jour de la « journée complète »
 * d'UN groupe pour ce module. La salle est choisie automatiquement (salle par défaut du
 * groupe si elle est libre et dans le pool, sinon une autre salle du pool). Un conflit
 * éventuel (enseignant/salle/groupe déjà pris ce jour-là) apparaîtra dans l'onglet Conflits :
 * l'action manuelle n'est jamais bloquée, l'utilisateur garde la main.
 */
function setFullDayManual(session, moduleId, groupId, day) {
  const m = session.modules.find(x => x.id === moduleId);
  const group = session.groups.find(g => g.id === groupId);
  if (!m || !group) return { error: "not-found" };
  const duration = fullDayDuration(session);

  session.seances = session.seances.filter(s => !(s.moduleId === moduleId && s.fullDay
    && s.groupIds.length === 1 && s.groupIds[0] === groupId && s.duration === duration && s.startSlotIndex === 0));

  if (!day) { saveState("🗑️ Journée complète retirée (manuel)"); return { removed: true }; }

  const teacherId = groupTeacherIdForModule(session, moduleId, groupId);
  if (!teacherId) { saveState(); return { error: "no-teacher" }; }

  const occ = buildOccupancy(session.seances);
  const room = findRoomForFullDay(session, occ, day, m.roomPoolIds, Number(group.effectif) || 0, group.defaultRoomId);
  const roomId = room ? room.id : (m.roomPoolIds[0] || (session.rooms[0] || {}).id || "");
  const seance = buildFullDaySeance(moduleId, teacherId, groupId, day, roomId, duration, false);
  session.seances.push(seance);
  saveState("🖊️ Journée complète fixée manuellement");
  return { seance, roomFound: !!room };
}

/**
 * Bouton "🎲 Assigner les jours automatiquement" : répartit automatiquement, pour tous les
 * groupes du module qui n'ont pas déjà un jour fixé manuellement, un jour de la semaine
 * différent autant que possible (répartition tournante), en choisissant une salle libre
 * dans le pool défini pour le module. Essaie plusieurs combinaisons et garde la meilleure.
 */
function autoAssignFullDayDays(session, moduleId, { attempts = 20, keepExistingAuto = false, historyLabel = null } = {}) {
  const m = session.modules.find(x => x.id === moduleId);
  if (!m || !isFullDayModule(m)) return { summary: "Ce module n'est pas configuré en « journée complète ». " };
  const groups = m.groupIds.slice();
  if (!groups.length) return { summary: "Aucun groupe concerné par ce module." };

  const duration = fullDayDuration(session);
  // Jours déjà fixés à respecter comme contraintes : toujours les manuels, et en mode
  // « Compléter » (keepExistingAuto) également les séances déjà placées automatiquement,
  // pour ne jamais les redéplacer.
  const relevantFullDay = session.seances.filter(s => s.moduleId === moduleId && s.fullDay);
  const coveredFullDay = keepExistingAuto ? relevantFullDay : relevantFullDay.filter(s => !s.auto);
  const coveredGroupIds = new Set(coveredFullDay.flatMap(s => s.groupIds));
  const otherFixed = keepExistingAuto
    ? session.seances.slice()
    : session.seances.filter(s => !(s.moduleId === moduleId && s.fullDay && s.auto));
  const jobGroupIds = groups.filter(gid => !coveredGroupIds.has(gid));

  let best = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const occ = buildOccupancy(otherFixed);
    const days = shuffleArray(session.config.days);
    const order = shuffleArray(jobGroupIds);
    const placed = [], unplaced = [];
    let dayCursor = 0;

    order.forEach(gid => {
      const teacherId = groupTeacherIdForModule(session, moduleId, gid);
      const group = session.groups.find(g => g.id === gid);
      if (!teacherId || !group) { unplaced.push(gid); return; }
      let ok = false;
      for (let i = 0; i < days.length; i++) {
        const day = days[(dayCursor + i) % days.length];
        if (!isTeacherFreeAt(session, teacherId, day, 0, duration, occ)) continue;
        if (!areGroupsFreeAt([gid], day, 0, duration, occ)) continue;
        const room = findRoomForFullDay(session, occ, day, m.roomPoolIds, Number(group.effectif) || 0, group.defaultRoomId);
        if (!room) continue;
        const seance = buildFullDaySeance(moduleId, teacherId, gid, day, room.id, duration, true);
        markOccupancy(occ, seance);
        placed.push(seance);
        dayCursor = (dayCursor + i + 1) % days.length; // favorise un jour différent pour le groupe suivant
        ok = true;
        break;
      }
      if (!ok) unplaced.push(gid);
    });

    if (!best || unplaced.length < best.unplaced.length) {
      best = { placed, unplaced };
      if (unplaced.length === 0) break;
    }
  }
  if (!best) best = { placed: [], unplaced: jobGroupIds };

  session.seances = otherFixed.concat(best.placed);
  saveState(historyLabel || "🎲 Assigner les jours automatiquement (journée complète)");

  const summary = jobGroupIds.length === 0
    ? "Tous les groupes ont déjà un jour fixé manuellement."
    : best.unplaced.length === 0
      ? `✅ Jour attribué automatiquement pour ${best.placed.length} groupe(s), répartis sur la semaine.`
      : `⚠️ ${best.placed.length}/${jobGroupIds.length} groupe(s) programmé(s) ; ${best.unplaced.length} n'ont trouvé ni jour ni salle libre (vérifiez enseignants/salles/pool de salles du module).`;

  return { placed: best.placed, unplaced: best.unplaced, totalJobs: jobGroupIds.length, summary };
}

/** Attribue une journée extérieure à chaque groupe non renseigné, en conservant les choix manuels. */
function autoAssignEducationalActionDays(session, { overwrite = false } = {}) {
  const days = session.config.days || [];
  if (!days.length) return { assigned: 0, skipped: session.groups.length, summary: "Aucun jour configuré." };
  let assigned = 0;
  session.groups.forEach(group => {
    if (!overwrite && group.educationalActionDay) return;
    const scores = days.map(day => {
      const groupCourses = session.seances.filter(s => s.groupIds.includes(group.id) && s.day === day && !s.action).length;
      const otherActions = session.groups.filter(g => g.id !== group.id && g.educationalActionDay === day).length;
      return { day, score: groupCourses * 10 + otherActions };
    }).sort((a, b) => a.score - b.score);
    const result = setGroupEducationalAction(session, group.id, scores[0].day, group.educationalActionLabel, { allowConflict: true });
    if (!result.error) assigned++;
  });
  saveState("🎲 Attribution automatique des journées d'actions éducatives");
  return { assigned, skipped: session.groups.length - assigned, summary: `✅ Journée extérieure attribuée à ${assigned} groupe(s).` };
}

/**
 * Calcule le nombre de conflits (computeConflicts) qu'entraînerait un ensemble de séances
 * donné, sans toucher à la session réelle (clone superficiel avec .seances remplacé).
 */
function conflictCountForSeances(session, seancesList) {
  if (typeof computeConflicts !== "function") return 0;
  const temp = Object.assign({}, session, { seances: seancesList });
  return computeConflicts(temp).length;
}

function autoScheduleCaseSignature(placedSeances) {
  return placedSeances
    .map(s => `${s.moduleId}|${s.teacherId}|${(s.groupIds || []).slice().sort().join(",")}|${s.day}|${s.startSlotIndex}|${s.roomId}`)
    .sort()
    .join(";");
}

/**
 * Planifie automatiquement (jour / créneau / salle) les séances des modules donnés.
 * Essaie `attempts` combinaisons aléatoires DISTINCTES et les retourne TOUTES (sous forme
 * de "cas", dédupliqués et triés par nombre de séances non placées puis de conflits), afin
 * que l'utilisateur puisse choisir celle qu'il préfère dans le tableau de résultats. La
 * meilleure combinaison trouvée (cases[0]) est appliquée par défaut. Les séances manuelles
 * (sans `auto: true`) sont toujours respectées comme contraintes fixes et ne sont jamais
 * modifiées, quel que soit le cas choisi.
 * Retourne { placed, unplaced, totalJobs, summary, cases, fixedSeances }.
 */
function autoScheduleSession(session, { onlyModuleIds = null, attempts = 20, keepExistingAuto = false, historyLabel = null, maxCases = Infinity } = {}) {
  const moduleIds = onlyModuleIds || session.modules.map(m => m.id);
  // On ne "libère" (pour les replanifier) que les séances auto des modules pour lesquels
  // une répartition par groupes (Affectations) existe réellement : sinon, impossible de les
  // reconstruire, donc on les laisse intactes plutôt que de les supprimer sans remplacement.
  const regenerableModuleIds = new Set(
    moduleIds.filter(id => {
      const m = session.modules.find(x => x.id === id);
      return m && !isFullDayModule(m) && getModuleAffectations(session, id).some(a => a.groupIds.length);
    })
  );
  // En mode « Compléter » (keepExistingAuto), on ne supprime JAMAIS de séance existante,
  // qu'elle soit manuelle ou déjà placée automatiquement : seuls les couples (module,
  // enseignant, groupes) qui n'ont encore aucune séance seront ajoutés.
  const fixedSeances = keepExistingAuto
    ? session.seances.slice()
    : session.seances.filter(s => !s.auto || !regenerableModuleIds.has(s.moduleId));
  const skippedModuleIds = moduleIds.filter(id => !regenerableModuleIds.has(id));

  const jobModuleIds = Array.from(regenerableModuleIds);
  const rawAttempts = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const occ = buildOccupancy(fixedSeances);
    const jobs = shuffleArray(buildJobsForModules(session, jobModuleIds, fixedSeances));
    const placedSeances = [];
    const unplaced = [];

    jobs.forEach(job => {
      const spot = placeJob(session, occ, job);
      if (!spot) { unplaced.push(job); return; }
      const seance = {
        id: uid("se"), moduleId: job.moduleId, teacherId: job.teacherId, groupIds: job.groupIds,
        roomId: spot.roomId, day: spot.day, startSlotIndex: spot.startSlotIndex, duration: job.duration,
        color: job.color || autoSchedulerRandomColor(), auto: true,
      };
      markOccupancy(occ, seance);
      placedSeances.push(seance);
    });

    rawAttempts.push({ placedSeances, unplaced, totalJobs: jobs.length });
    // Pas d'arrêt anticipé même en cas de solution parfaite : on veut plusieurs cas
    // distincts à proposer, pas seulement le tout premier trouvé.
  }

  // Déduplique les essais qui ont abouti exactement à la même combinaison, calcule le
  // nombre réel de conflits de chacun, puis trie (le moins de non-placés, puis le moins
  // de conflits, en premier).
  const seenSignatures = new Set();
  const scoredCases = [];
  rawAttempts.forEach(a => {
    const sig = autoScheduleCaseSignature(a.placedSeances);
    if (seenSignatures.has(sig)) return;
    seenSignatures.add(sig);
    scoredCases.push({
      placedSeances: a.placedSeances,
      unplaced: a.unplaced,
      totalJobs: a.totalJobs,
      conflictCount: conflictCountForSeances(session, fixedSeances.concat(a.placedSeances)),
    });
  });
  scoredCases.sort((x, y) => (x.unplaced.length - y.unplaced.length) || (x.conflictCount - y.conflictCount));

  const best = scoredCases[0] || { placedSeances: [], unplaced: [], totalJobs: 0, conflictCount: 0 };
  const cases = scoredCases.slice(0, Math.max(1, maxCases)).map((c, i) => ({
    id: "case" + i,
    label: "Cas " + (i + 1),
    placedSeances: c.placedSeances,
    unplacedCount: c.unplaced.length,
    totalJobs: c.totalJobs,
    conflictCount: c.conflictCount,
  }));

  session.seances = fixedSeances.concat(best.placedSeances);
  saveState(historyLabel || "🎲 Planification automatique des séances");

  let summary = best.totalJobs === 0
    ? "Aucune séance à planifier pour ce périmètre (répartissez d'abord les groupes dans l'onglet Affectations)."
    : best.unplaced.length === 0
      ? `✅ ${best.placedSeances.length} séance(s) planifiée(s) automatiquement (${cases.length} cas trouvé(s) — meilleur : ${best.conflictCount} conflit(s)).`
      : `⚠️ ${best.placedSeances.length}/${best.totalJobs} séance(s) planifiée(s) ; ${best.unplaced.length} n'ont pas trouvé de créneau libre (disponibilités ou salles insuffisantes).`;
  if (skippedModuleIds.length) {
    const names = skippedModuleIds.map(id => (session.modules.find(m => m.id === id) || {}).name).filter(Boolean).join(", ");
    summary += ` (Non géré automatiquement, sans affectation par groupes : ${names}. À planifier depuis le Planning.)`;
  }

  return { placed: best.placedSeances, unplaced: best.unplaced, totalJobs: best.totalJobs, summary, cases, fixedSeances, appliedCaseIndex: 0 };
}

/**
 * Bouton "🔁 Régénérer" : relance une planification automatique (nouvelle combinaison
 * aléatoire) pour tous les modules dont des séances "auto" sont actuellement en conflit,
 * dans l'espoir de résoudre ces conflits. Les séances créées manuellement sont préservées.
 */
function regenerateOnConflicts() {
  const session = getCurrentSession();
  const conflictsBefore = computeConflicts(session);
  if (!conflictsBefore.length) {
    showToast("Aucun conflit à résoudre pour l'instant.");
    return;
  }
  const conflictSeanceIds = new Set(conflictsBefore.flatMap(c => c.seanceIds));
  const autoModuleIds = Array.from(new Set(
    session.seances.filter(s => s.auto && conflictSeanceIds.has(s.id)).map(s => s.moduleId)
  ));
  const fullDayModuleIds = autoModuleIds.filter(id => isFullDayModule(session.modules.find(m => m.id === id)));
  const normalModuleIds = autoModuleIds.filter(id => !fullDayModuleIds.includes(id));

  if (!autoModuleIds.length) {
    showToast("Les conflits actuels concernent des séances placées manuellement : ajustez-les depuis le Planning.");
    return;
  }

  const summaries = [];
  if (normalModuleIds.length) summaries.push(autoScheduleSession(session, { onlyModuleIds: normalModuleIds, attempts: 25, historyLabel: "🔁 Régénérer automatiquement (conflits)" }).summary);
  fullDayModuleIds.forEach(id => summaries.push(autoAssignFullDayDays(session, id, { attempts: 25, historyLabel: "🔁 Régénérer automatiquement (conflits)" }).summary));

  const conflictsAfter = computeConflicts(getCurrentSession());
  refreshAllSelectorsAndGrids();
  showToast(`🔁 Nouvelle combinaison générée — conflits : ${conflictsBefore.length} → ${conflictsAfter.length}. ${summaries.join(" ")}`);
}
