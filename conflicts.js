/* ============================================================
   CONFLICTS.JS — Détection des conflits d'emploi du temps
   ============================================================ */

/**
 * Deux séances se chevauchent si elles sont le même jour et que
 * leurs plages de créneaux [start, start+duration-1] s'intersectent.
 */
function seancesOverlap(a, b) {
  if (a.day !== b.day) return false;
  const aStart = a.startSlotIndex, aEnd = a.startSlotIndex + a.duration - 1;
  const bStart = b.startSlotIndex, bEnd = b.startSlotIndex + b.duration - 1;
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Deux sessions sont "concurrentes" (se déroulent physiquement dans la même période)
 * si elles ont la même année ET le même type de session (Printemps/Automne...). Dans ce
 * cas seulement, un enseignant ou une salle partagés entre les deux constituent un vrai
 * risque de conflit de ressources (ex. deux filières différentes en même temps).
 * Des sessions de périodes différentes (ex. Automne puis Printemps de la même année, ou
 * la même filière d'une année sur l'autre) se déroulent l'une après l'autre dans le temps :
 * les mêmes enseignants/salles peuvent légitimement y être réutilisés sans aucun conflit.
 */
function sessionsAreConcurrent(a, b) {
  return (a.annee || "") === (b.annee || "") && (a.typeSession || "") === (b.typeSession || "");
}

/**
 * Compare deux ressources (enseignant ou salle) entre sessions par leur NOM, pas par leur
 * identifiant technique : chaque session régénère des identifiants indépendants pour ses
 * ressources, même lorsqu'elle est dupliquée à partir d'une session existante (voir
 * cloneSessionResources dans app.js) — comparer par id ne détecterait donc pratiquement
 * jamais qu'il s'agit "physiquement" du même enseignant ou de la même salle.
 */
function sameResourceName(a, b) {
  return !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/**
 * Calcule tous les conflits pour la session donnée.
 * Retourne un tableau d'objets :
 * { type: 'teacher'|'room'|'group'|'capacity', seanceIds:[...], message, detail }
 */
function computeConflicts(session) {
  const conflicts = [];
  const seances = session.seances;

  // --- Conflits par paires (enseignant / salle / groupe) ---
  for (let i = 0; i < seances.length; i++) {
    for (let j = i + 1; j < seances.length; j++) {
      const a = seances[i], b = seances[j];
      if (!seancesOverlap(a, b)) continue;

      // Conflit enseignant : même enseignant, deux séances distinctes qui se chevauchent
      if (a.teacherId && a.teacherId === b.teacherId) {
        conflicts.push({
          type: "teacher",
          seanceIds: [a.id, b.id],
          message: `Enseignant en double réservation`,
          detail: describePair(session, a, b, "teacher"),
        });
      }

      // Conflit salle : même salle, deux séances distinctes qui se chevauchent
      // (une séance mutualisée = un seul objet séance avec plusieurs groupes -> pas de conflit ici)
      if (a.roomId && a.roomId === b.roomId) {
        conflicts.push({
          type: "room",
          seanceIds: [a.id, b.id],
          message: `Salle occupée deux fois en même temps`,
          detail: describePair(session, a, b, "room"),
        });
      }

      // Conflit groupe : un groupe commun entre deux séances distinctes qui se chevauchent
      const commonGroups = a.groupIds.filter(g => b.groupIds.includes(g));
      if (commonGroups.length > 0) {
        conflicts.push({
          type: "group",
          seanceIds: [a.id, b.id],
          message: `Groupe affecté à deux séances simultanées`,
          detail: describePair(session, a, b, "group", commonGroups),
        });
      }
    }
  }

  // --- Conflits de disponibilité enseignant ---
  seances.forEach(s => {
    const awayGroups = s.groupIds.filter(gid => isGroupAwayForEducationalAction(session, gid, s.day));
    if (awayGroups.length > 0) {
      conflicts.push({
        type: "educationalAction",
        seanceIds: [s.id],
        message: `Cours programmé pendant les Actions éducatives`,
        detail: `${awayGroups.map(gid => session.groups.find(g => g.id === gid)?.name || gid).join(", ")} est/sont absent(s) de l'établissement le ${s.day}.`,
      });
    }
    const teacher = session.teachers.find(t => t.id === s.teacherId);
    if (!teacher || !Array.isArray(teacher.unavailable) || teacher.unavailable.length === 0) return;
    const blockedSlots = [];
    for (let k = 0; k < s.duration; k++) {
      const idx = s.startSlotIndex + k;
      if (isTeacherUnavailable(teacher, s.day, idx)) blockedSlots.push(idx);
    }
    if (blockedSlots.length > 0) {
      conflicts.push({
        type: "availability",
        seanceIds: [s.id],
        message: `Enseignant indisponible sur ce créneau`,
        detail: `${teacher.name} a déclaré être indisponible le ${s.day} pendant "${labelModule(session, s.moduleId)}" (${slotRangeLabel(session, s)}).`,
      });
    }
  });

  // --- Conflits de disponibilité salle ---
  seances.forEach(s => {
    const room = session.rooms.find(r => r.id === s.roomId);
    if (!room || !Array.isArray(room.unavailable) || room.unavailable.length === 0) return;
    const blockedSlots = [];
    for (let k = 0; k < s.duration; k++) {
      const idx = s.startSlotIndex + k;
      if (isRoomUnavailable(room, s.day, idx)) blockedSlots.push(idx);
    }
    if (blockedSlots.length > 0) {
      conflicts.push({
        type: "roomAvailability",
        seanceIds: [s.id],
        message: `Salle indisponible sur ce créneau`,
        detail: `${room.name} a été déclarée indisponible le ${s.day} pendant "${labelModule(session, s.moduleId)}" (${slotRangeLabel(session, s)}).`,
      });
    }
  });

  // --- Conflit d'affectation : un même groupe suit un même module avec plusieurs
  // enseignants différents (indépendant de tout chevauchement horaire : deux séances
  // à des jours/heures différents comptent aussi, contrairement aux conflits ci-dessus) ---
  const teachersByModuleGroup = new Map(); // "moduleId||groupId" -> Map(teacherId -> [seanceIds])
  seances.forEach(s => {
    if (!s.teacherId) return;
    (s.groupIds || []).forEach(gid => {
      const key = `${s.moduleId}||${gid}`;
      if (!teachersByModuleGroup.has(key)) teachersByModuleGroup.set(key, new Map());
      const byTeacher = teachersByModuleGroup.get(key);
      if (!byTeacher.has(s.teacherId)) byTeacher.set(s.teacherId, []);
      byTeacher.get(s.teacherId).push(s.id);
    });
  });
  teachersByModuleGroup.forEach((byTeacher, key) => {
    if (byTeacher.size < 2) return;
    const [moduleId, groupId] = key.split("||");
    const teacherNames = Array.from(byTeacher.keys())
      .map(tid => (session.teachers.find(t => t.id === tid) || {}).name || tid);
    const group = session.groups.find(g => g.id === groupId);
    conflicts.push({
      type: "moduleTeacher",
      seanceIds: Array.from(byTeacher.values()).flat(),
      message: `Module assuré par plusieurs enseignants pour un même groupe`,
      detail: `${group ? group.name : groupId} suit « ${labelModule(session, moduleId)} » avec ${teacherNames.join(" et ")} sur des séances différentes.`,
    });
  });

  // --- Conflit enseignant entre deux FILIÈRES différentes se déroulant en même temps ---
  // (deux sessions ne sont comparées que si elles sont temporellement concurrentes — voir
  // sessionsAreConcurrent — et les enseignants sont rapprochés par leur NOM, pas par leur
  // id, qui est toujours propre à chaque session — voir sameResourceName)
  if (typeof STATE !== "undefined" && STATE && Array.isArray(STATE.sessions) && STATE.sessions.length > 1) {
    const otherSessions = STATE.sessions.filter(other => other.id !== session.id && sessionsAreConcurrent(session, other));
    seances.forEach(s => {
      if (!s.teacherId) return;
      const teacher = session.teachers.find(t => t.id === s.teacherId);
      if (!teacher) return;
      otherSessions.forEach(otherSession => {
        (otherSession.seances || []).forEach(o => {
          const otherTeacher = otherSession.teachers.find(t => t.id === o.teacherId);
          if (!sameResourceName(teacher.name, otherTeacher && otherTeacher.name)) return;
          if (!seancesOverlap(s, o)) return;
          conflicts.push({
            type: "teacherCrossSession",
            seanceIds: [s.id],
            message: `Enseignant en double réservation entre deux filières`,
            detail: `${teacher.name} est aussi programmé le ${s.day} (${slotRangeLabel(session, s)}) sur « ${labelModule(otherSession, o.moduleId)} » dans « ${otherSession.filiere || otherSession.label || "une autre filière"} », qui se déroule sur la même période (${session.typeSession || "?"} ${session.annee || ""}).`,
          });
        });
      });
    });
  }

  // --- Conflit salle entre deux FILIÈRES différentes se déroulant en même temps ---
  // (même logique que ci-dessus : seules les sessions concurrentes sont comparées, par nom)
  if (typeof STATE !== "undefined" && STATE && Array.isArray(STATE.sessions) && STATE.sessions.length > 1) {
    const otherSessionsForRooms = STATE.sessions.filter(other => other.id !== session.id && sessionsAreConcurrent(session, other));
    seances.forEach(s => {
      if (!s.roomId) return;
      const room = session.rooms.find(r => r.id === s.roomId);
      if (!room) return;
      otherSessionsForRooms.forEach(otherSession => {
        (otherSession.seances || []).forEach(o => {
          const otherRoom = otherSession.rooms.find(r => r.id === o.roomId);
          if (!sameResourceName(room.name, otherRoom && otherRoom.name)) return;
          if (!seancesOverlap(s, o)) return;
          conflicts.push({
            type: "roomCrossSession",
            seanceIds: [s.id],
            message: `Salle en double réservation entre deux filières`,
            detail: `${room.name} est aussi occupée le ${s.day} (${slotRangeLabel(session, s)}) par « ${labelModule(otherSession, o.moduleId)} » dans « ${otherSession.filiere || otherSession.label || "une autre filière"} », qui se déroule sur la même période (${session.typeSession || "?"} ${session.annee || ""}).`,
          });
        });
      });
    });
  }

  // --- Conflit de pool de salles (séance hors des salles autorisées pour ce module) ---
  seances.forEach(s => {
    if (!s.roomId) return;
    const mod = session.modules.find(m => m.id === s.moduleId);
    if (!mod || !Array.isArray(mod.roomPoolIds) || mod.roomPoolIds.length === 0) return;
    if (mod.roomPoolIds.includes(s.roomId)) return;
    const room = session.rooms.find(r => r.id === s.roomId);
    conflicts.push({
      type: "roomPool",
      seanceIds: [s.id],
      message: `Salle hors du pool autorisé pour ce module`,
      detail: `« ${labelModule(session, s.moduleId)} » est programmé dans "${room ? room.name : s.roomId}", qui ne fait pas partie des salles autorisées pour ce module.`,
    });
  });

  // --- Volume horaire du module non respecté (heures planifiées ≠ heures prévues) ---
  session.modules.forEach(m => {
    const groups = m.groupIds || [];
    const target = Number(m.volumeHoraire) || 0;
    if (!groups.length || target <= 0) return;
    groups.forEach(gid => {
      const relevant = seances.filter(s => s.moduleId === m.id && (s.groupIds || []).includes(gid));
      if (!relevant.length) return; // pas encore planifié du tout : déjà signalé côté Affectations
      const plannedHours = Math.round((relevant.reduce((sum, s) => sum + seanceMinutes(session, s), 0) / 60) * 100) / 100;
      if (Math.abs(plannedHours - target) > 0.01) {
        const g = session.groups.find(g => g.id === gid);
        conflicts.push({
          type: "volumeMismatch",
          seanceIds: relevant.map(s => s.id),
          message: plannedHours > target ? `Volume horaire du module dépassé` : `Volume horaire du module incomplet`,
          detail: `« ${labelModule(session, m.id)} » pour ${g ? g.name : gid} : ${plannedHours}h planifiée(s) sur ${target}h prévues.`,
        });
      }
    });
  });

  // --- Séance hors de la grille de créneaux (ex. après import Excel ou réduction de la grille horaire) ---
  seances.forEach(s => {
    const slotCount = session.config.slots.length;
    if (s.startSlotIndex < 0 || s.duration <= 0 || s.startSlotIndex + s.duration > slotCount) {
      conflicts.push({
        type: "outOfBounds",
        seanceIds: [s.id],
        message: `Séance hors de la grille de créneaux`,
        detail: `« ${labelModule(session, s.moduleId)} » (${s.day}) dépasse les créneaux disponibles de la journée (créneau ${s.startSlotIndex + 1}, durée ${s.duration}, grille de ${slotCount} créneau(x)).`,
      });
    }
  });

  // --- Salle par défaut du groupe trop petite pour son effectif ---
  // (incohérence statique, indépendante de toute séance planifiée : le groupe serait
  // proposé par défaut dans une salle qui ne peut physiquement pas l'accueillir)
  session.groups.forEach(g => {
    if (!g.defaultRoomId) return;
    const room = session.rooms.find(r => r.id === g.defaultRoomId);
    if (!room) return;
    const eff = Number(g.effectif) || 0;
    if (eff > room.capacity) {
      conflicts.push({
        type: "defaultRoomCapacity",
        seanceIds: [],
        message: `Salle par défaut trop petite pour le groupe`,
        detail: `${g.name} (${eff} étudiants) a "${room.name}" (capacité ${room.capacity}) comme salle par défaut.`,
      });
    }
  });

  // --- Conflits de capacité (séance mutualisée dépassant la capacité de la salle) ---
  seances.forEach(s => {
    const room = session.rooms.find(r => r.id === s.roomId);
    if (!room) return;
    const totalEffectif = s.groupIds.reduce((sum, gid) => {
      const g = session.groups.find(gr => gr.id === gid);
      return sum + (g ? Number(g.effectif) || 0 : 0);
    }, 0);
    if (totalEffectif > room.capacity) {
      conflicts.push({
        type: "capacity",
        seanceIds: [s.id],
        message: `Capacité de salle dépassée`,
        detail: `${labelModule(session, s.moduleId)} — ${totalEffectif} étudiants prévus pour "${room.name}" (capacité ${room.capacity}).`,
      });
    }
  });

  return conflicts;
}

function describePair(session, a, b, type, commonGroups) {
  const modA = labelModule(session, a.moduleId);
  const modB = labelModule(session, b.moduleId);
  const day = a.day;
  const slotA = slotRangeLabel(session, a);
  const slotB = slotRangeLabel(session, b);

  if (type === "teacher") {
    const t = session.teachers.find(t => t.id === a.teacherId);
    return `${t ? t.name : "Enseignant"} est affecté à "${modA}" (${day}, ${slotA}) et "${modB}" (${day}, ${slotB}).`;
  }
  if (type === "room") {
    const r = session.rooms.find(r => r.id === a.roomId);
    return `${r ? r.name : "Salle"} accueille "${modA}" et "${modB}" le ${day} sur des créneaux qui se chevauchent (${slotA} / ${slotB}).`;
  }
  if (type === "group") {
    const names = commonGroups.map(gid => {
      const g = session.groups.find(g => g.id === gid);
      return g ? g.name : gid;
    }).join(", ");
    return `${names} a "${modA}" (${slotA}) et "${modB}" (${slotB}) en même temps le ${day}.`;
  }
  return "";
}

function labelModule(session, moduleId) {
  const m = session.modules.find(m => m.id === moduleId);
  return m ? m.name : "Module inconnu";
}

function slotRangeLabel(session, seance) {
  const slots = session.config.slots;
  const start = slots[seance.startSlotIndex];
  const end = slots[seance.startSlotIndex + seance.duration - 1];
  if (!start) return "?";
  if (!end || start === end) return start.label;
  return `${start.start} - ${end.end}`;
}

/**
 * Vérifie en amont (avant sauvegarde) si une séance candidate créerait des conflits,
 * en excluant elle-même (utile en mode édition).
 */
function checkCandidateSeance(session, candidate) {
  const others = session.seances.filter(s => s.id !== candidate.id);
  const warnings = [];

  // Disponibilité de l'enseignant
  const teacher = session.teachers.find(t => t.id === candidate.teacherId);
  const awayGroups = candidate.groupIds.filter(gid => isGroupAwayForEducationalAction(session, gid, candidate.day));
  if (awayGroups.length > 0) {
    warnings.push({
      level: "error",
      text: `⚠️ ${awayGroups.map(gid => session.groups.find(g => g.id === gid)?.name || gid).join(", ")} est/sont réservé(s) aux Actions éducatives le ${candidate.day}.`,
    });
  }
  if (teacher) {
    for (let k = 0; k < candidate.duration; k++) {
      const idx = candidate.startSlotIndex + k;
      if (isTeacherUnavailable(teacher, candidate.day, idx)) {
        const slot = session.config.slots[idx];
        warnings.push({
          level: "error",
          text: `⚠️ ${teacher.name} a déclaré être indisponible le ${candidate.day}${slot ? " (" + slot.label + ")" : ""}.`,
        });
        break;
      }
    }
  }

  // Disponibilité de la salle (même logique que pour l'enseignant ci-dessus)
  const candidateRoom = session.rooms.find(r => r.id === candidate.roomId);
  if (candidateRoom) {
    for (let k = 0; k < candidate.duration; k++) {
      const idx = candidate.startSlotIndex + k;
      if (isRoomUnavailable(candidateRoom, candidate.day, idx)) {
        const slot = session.config.slots[idx];
        warnings.push({
          level: "error",
          text: `⚠️ La salle "${candidateRoom.name}" a été déclarée indisponible le ${candidate.day}${slot ? " (" + slot.label + ")" : ""}.`,
        });
        break;
      }
    }
  }

  // Cohérence d'affectation : le groupe a-t-il déjà ce module avec un AUTRE enseignant,
  // même sur une séance à un autre jour/créneau (pas de chevauchement requis) ?
  if (candidate.teacherId) {
    (candidate.groupIds || []).forEach(gid => {
      const mismatch = others.find(o =>
        o.moduleId === candidate.moduleId && o.teacherId && o.teacherId !== candidate.teacherId &&
        (o.groupIds || []).includes(gid)
      );
      if (mismatch) {
        const g = session.groups.find(g => g.id === gid);
        const otherTeacher = session.teachers.find(t => t.id === mismatch.teacherId);
        warnings.push({
          level: "error",
          text: `⚠️ ${g ? g.name : gid} suit déjà « ${labelModule(session, candidate.moduleId)} » avec ${otherTeacher ? otherTeacher.name : "un autre enseignant"} (${mismatch.day}, ${slotRangeLabel(session, mismatch)}).`,
        });
      }
    });
  }

  others.forEach(o => {
    if (!seancesOverlap(candidate, o)) return;

    if (candidate.teacherId && candidate.teacherId === o.teacherId) {
      const t = session.teachers.find(t => t.id === candidate.teacherId);
      warnings.push({
        level: "error",
        text: `⚠️ ${t ? t.name : "Cet enseignant"} enseigne déjà "${labelModule(session, o.moduleId)}" sur ce créneau (${o.day}, ${slotRangeLabel(session, o)}).`,
      });
    }
    if (candidate.roomId && candidate.roomId === o.roomId) {
      const r = session.rooms.find(r => r.id === candidate.roomId);
      warnings.push({
        level: "error",
        text: `⚠️ La salle "${r ? r.name : ""}" est déjà occupée par "${labelModule(session, o.moduleId)}" sur ce créneau.`,
      });
    }
    const commonGroups = candidate.groupIds.filter(g => o.groupIds.includes(g));
    if (commonGroups.length > 0) {
      const names = commonGroups.map(gid => {
        const g = session.groups.find(g => g.id === gid);
        return g ? g.name : gid;
      }).join(", ");
      warnings.push({
        level: "error",
        text: `⚠️ ${names} a déjà "${labelModule(session, o.moduleId)}" sur ce créneau.`,
      });
    }
  });

  // Double réservation de l'enseignant sur une AUTRE FILIÈRE se déroulant sur la même période
  if (candidate.teacherId && typeof STATE !== "undefined" && STATE && Array.isArray(STATE.sessions) && STATE.sessions.length > 1) {
    const t = session.teachers.find(t => t.id === candidate.teacherId);
    if (t) {
      STATE.sessions.filter(other => other.id !== session.id && sessionsAreConcurrent(session, other)).forEach(otherSession => {
        (otherSession.seances || []).forEach(o => {
          const otherTeacher = otherSession.teachers.find(x => x.id === o.teacherId);
          if (!sameResourceName(t.name, otherTeacher && otherTeacher.name)) return;
          if (!seancesOverlap(candidate, o)) return;
          warnings.push({
            level: "warning",
            text: `⚠️ ${t.name} est déjà programmé le ${candidate.day} dans « ${otherSession.filiere || otherSession.label || "une autre filière"} » (même période : ${otherSession.typeSession || "?"} ${otherSession.annee || ""}) sur « ${labelModule(otherSession, o.moduleId)} ».`,
          });
        });
      });
    }
  }

  // Double réservation de la salle sur une AUTRE FILIÈRE se déroulant sur la même période
  if (candidate.roomId && typeof STATE !== "undefined" && STATE && Array.isArray(STATE.sessions) && STATE.sessions.length > 1) {
    const r0 = session.rooms.find(r => r.id === candidate.roomId);
    if (r0) {
      STATE.sessions.filter(other => other.id !== session.id && sessionsAreConcurrent(session, other)).forEach(otherSession => {
        (otherSession.seances || []).forEach(o => {
          const otherRoom = otherSession.rooms.find(x => x.id === o.roomId);
          if (!sameResourceName(r0.name, otherRoom && otherRoom.name)) return;
          if (!seancesOverlap(candidate, o)) return;
          warnings.push({
            level: "warning",
            text: `⚠️ La salle "${r0.name}" est déjà occupée le ${candidate.day} dans « ${otherSession.filiere || otherSession.label || "une autre filière"} » (même période : ${otherSession.typeSession || "?"} ${otherSession.annee || ""}) sur « ${labelModule(otherSession, o.moduleId)} ».`,
          });
        });
      });
    }
  }

  // Salle hors du pool autorisé pour ce module
  const candidateModule = session.modules.find(m => m.id === candidate.moduleId);
  if (candidate.roomId && candidateModule && Array.isArray(candidateModule.roomPoolIds) && candidateModule.roomPoolIds.length &&
      !candidateModule.roomPoolIds.includes(candidate.roomId)) {
    const r = session.rooms.find(r => r.id === candidate.roomId);
    warnings.push({
      level: "warning",
      text: `⚠️ La salle "${r ? r.name : ""}" ne fait pas partie des salles autorisées pour « ${labelModule(session, candidate.moduleId)} ».`,
    });
  }

  // Volume horaire du module : cette séance ferait-elle dépasser les heures prévues ?
  if (candidateModule && Number(candidateModule.volumeHoraire) > 0) {
    const target = Number(candidateModule.volumeHoraire);
    (candidate.groupIds || []).forEach(gid => {
      const existingMinutes = others
        .filter(s => s.moduleId === candidate.moduleId && (s.groupIds || []).includes(gid))
        .reduce((sum, s) => sum + seanceMinutes(session, s), 0);
      const totalHours = Math.round(((existingMinutes + seanceMinutes(session, candidate)) / 60) * 100) / 100;
      if (totalHours - target > 0.01) {
        const g = session.groups.find(g => g.id === gid);
        warnings.push({
          level: "warning",
          text: `⚠️ Avec cette séance, ${g ? g.name : gid} atteindrait ${totalHours}h pour « ${labelModule(session, candidate.moduleId)} » (${target}h prévues).`,
        });
      }
    });
  }

  // Capacité
  const room = session.rooms.find(r => r.id === candidate.roomId);
  if (room) {
    const total = candidate.groupIds.reduce((sum, gid) => {
      const g = session.groups.find(gr => gr.id === gid);
      return sum + (g ? Number(g.effectif) || 0 : 0);
    }, 0);
    if (total > room.capacity) {
      warnings.push({
        level: "warning",
        text: `⚠️ Effectif total (${total}) supérieur à la capacité de "${room.name}" (${room.capacity}).`,
      });
    }
  }

  // Dépassement de fin de journée
  if (candidate.startSlotIndex + candidate.duration > session.config.slots.length) {
    warnings.push({
      level: "error",
      text: `⚠️ La durée dépasse le dernier créneau disponible de la journée.`,
    });
  }

  return warnings;
}
