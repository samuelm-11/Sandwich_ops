// ─── Utilitaires partagés ───────────────────────────────────────────────────

const TAB_TITLES = {
today: “Aujourd’hui”, delivery: “Livraison”, withdraw: “À retirer”,
history: “Historique”, expenses: “Dépenses”, results: “Résultats”,
settings: “Paramètres”, shifts: “Shift”, km: “KM”,
};

export function goTab(tab) {
// Fermer le drawer si ouvert
document.getElementById(“drawer”)?.classList.remove(“open”);
document.getElementById(“drawerOverlay”)?.classList.remove(“open”);
// Nav active
document.querySelectorAll(”.navitem[data-tab]”).forEach(b => b.classList.remove(“active”));
document.querySelector(`.navitem[data-tab="${tab}"]`)?.classList.add(“active”);
// Section active
document.querySelectorAll(”.section”).forEach(s => s.classList.remove(“active”));
document.getElementById(`tab-${tab}`)?.classList.add(“active”);
const titleEl = document.getElementById(“title”);
if (titleEl) titleEl.textContent = TAB_TITLES[tab] || tab;
}

export const $ = (id) => document.getElementById(id);

export function setStatus(msg) {
const el = $(“status”);
if (el) el.textContent = msg || “”;
}

export function eur(cents) {
return (Number(cents || 0) / 100).toFixed(2).replace(”.”, “,”) + “€”;
}

export function isoDate(d = new Date()) {
return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function addDaysISO(baseISO, days) {
const d = new Date(baseISO + “T00:00:00”);
d.setDate(d.getDate() + days);
return isoDate(d);
}

export function toInt(v, def = 0) {
const n = parseInt(String(v ?? “”).trim(), 10);
return Number.isFinite(n) ? n : def;
}

export function toEuroStringToCents(v) {
const n = Number(String(v ?? “”).trim().replace(”,”, “.”));
if (!Number.isFinite(n)) return null;
return Math.round(n * 100);
}

export function esc(s) {
return String(s ?? “”)
.replaceAll(”&”, “&”)
.replaceAll(”<”, “<”)
.replaceAll(”>”, “>”)
.replaceAll(’”’, “"”);
}

export function loadSettings() {
const raw = localStorage.getItem(“sandops:settings”);
const def = { dlc: 2, withdrawJ: 3 };
const s = raw ? { …def, …JSON.parse(raw) } : def;
if ($(“setDlc”)) $(“setDlc”).value = String(s.dlc);
if ($(“setWithdrawJ”)) $(“setWithdrawJ”).value = String(s.withdrawJ);
return s;
}
