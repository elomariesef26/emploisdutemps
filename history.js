/* ============================================================
   HISTORY.JS — Vue « Historique des opérations »
   Affiche la liste des opérations enregistrées (la plus récente en haut) et
   permet, en cliquant sur une entrée, de restaurer l'état de l'application
   tel qu'il était juste après cette opération (voir restoreHistoryEntry()
   et recordHistoryEntry() dans data.js).
   ============================================================ */

function formatHistoryTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function initHistoryView() {
  document.getElementById("clearHistoryBtn").addEventListener("click", () => {
    if (!getOperationHistory().length) return;
    if (!confirm("Vider tout l'historique des opérations ? Cette action est irréversible (l'état actuel de l'application n'est pas affecté).")) return;
    clearOperationHistory();
    showToast("Historique vidé");
  });
}

function renderHistoryView() {
  const wrap = document.getElementById("historyList");
  if (!wrap) return; // vue pas encore initialisée (ex. tout premier appel avant DOMContentLoaded complet)
  wrap.innerHTML = "";

  const history = getOperationHistory();
  if (!history.length) {
    wrap.appendChild(el("div", { class: "empty-state" }, "Aucune opération enregistrée pour l'instant."));
    return;
  }

  // Le plus récent en premier ; la toute dernière entrée correspond à l'état actuel.
  const ordered = history.slice().reverse();
  ordered.forEach((entry, i) => {
    const isCurrent = i === 0;
    const row = el("div", { class: "history-item" + (isCurrent ? " current" : "") });

    const main = el("div", { class: "history-item-main" }, [
      el("div", { class: "history-item-label" }, entry.label + (isCurrent ? "  (état actuel)" : "")),
      el("div", { class: "history-item-time" }, formatHistoryTimestamp(entry.at)),
    ]);
    row.appendChild(main);

    if (!isCurrent) {
      const btn = el("button", { class: "btn" }, "↩️ Revenir ici");
      btn.addEventListener("click", () => {
        if (!confirm(`Revenir à l'état de l'application juste après :\n« ${entry.label} » (${formatHistoryTimestamp(entry.at)}) ?\n\nLes opérations effectuées après ce point resteront visibles dans l'historique, mais l'état actuel des données sera remplacé.`)) return;
        restoreHistoryEntry(entry.id);
        showToast("↩️ État restauré : " + entry.label);
      });
      row.appendChild(btn);
    }

    wrap.appendChild(row);
  });
}
