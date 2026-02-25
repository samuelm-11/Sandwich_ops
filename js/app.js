import { supabase } from “./supabase.js”;
import { $, setStatus, isoDate, loadSettings } from “./ui.js”;
import { initToday, refreshToday }    from “./today.js”;
import { initDelivery, resetQty, renderLocationPills, renderDeliveryList, updateDeliveryTotals } from “./delivery.js”;
import { initWithdraw, refreshWithdraw } from “./withdraw.js”;
import { initHistory, refreshHistory }   from “./history.js”;
import { initSettings, refreshSettingsLists } from “./settings.js”;
import { initExpenses, refreshExpenses }  from “./expenses.js”;
import { initResults, refreshResults }    from “./results.js”;
import { initShifts, refreshShifts }      from “./shifts.js”;
import { initKm, refreshKm }              from “./km.js”;

// ─── État global (partagé entre modules via window.__state) ──────────────────
window.__state = {
locations:  [],
products:   [],
locationId: “”,
};

// ─── Navigation ─────────────────────────────────────────────────────────────
const TAB_TITLES = {
today:    “Aujourd’hui”,
delivery: “Livraison”,
withdraw: “À retirer”,
history:  “Historique”,
expenses: “Dépenses”,
results:  “Résultats”,
settings: “Paramètres”,
shifts:   “Shift”,
km:       “KM”,
};

const drawer  = $(“drawer”);
const overlay = $(“drawerOverlay”);

function openDrawer()  { drawer.classList.add(“open”);    overlay.classList.add(“open”); }
function closeDrawer() { drawer.classList.remove(“open”); overlay.classList.remove(“open”); }

export function goTab(tab) {
closeDrawer();
document.querySelectorAll(”.navitem[data-tab]”).forEach(b => b.classList.remove(“active”));
document.querySelector(`.navitem[data-tab="${tab}"]`)?.classList.add(“active”);
document.querySelectorAll(”.section”).forEach(s => s.classList.remove(“active”));
document.getElementById(`tab-${tab}`)?.classList.add(“active”);
$(“title”).textContent = TAB_TITLES[tab] || tab;
}

// ─── Chargement des données de référence ────────────────────────────────────
async function loadRefsFresh() {
setStatus(“Chargement produits/lieux…”);
const locRes  = await supabase.from(“locations”).select(“id,name,sort_order,is_active”).order(“sort_order”, { ascending: true });
const prodRes = await supabase.from(“products”).select(“id,name,price_cents,sort_order,is_active”).order(“sort_order”, { ascending: true });
setStatus(””);
if (locRes.error)  throw locRes.error;
if (prodRes.error) throw prodRes.error;

window.__state.locations = (locRes.data  || []).map(x => ({ …x, is_active: !!x.is_active }));
window.__state.products  = (prodRes.data || []).map(x => ({ …x, is_active: !!x.is_active }));

const actLocs = window.__state.locations.filter(l => l.is_active);
if (!window.__state.locationId || !actLocs.find(l => l.id === window.__state.locationId)) {
window.__state.locationId = actLocs[0]?.id || “”;
}
resetQty();
}

async function reloadAllData() {
await loadRefsFresh();
renderLocationPills();
renderQuickPills();
renderDeliveryList();
updateDeliveryTotals();
await refreshSettingsLists();
await refreshToday();
await refreshExpenses();
await refreshResults();
}

// Exposer pour les modules qui en ont besoin
window.__reloadAllData = reloadAllData;

function renderQuickPills() {
const box  = $(“quickLocPills”);
box.innerHTML = “”;
const locs = window.__state.locations.filter(l => l.is_active);
if (!locs.length) {
box.innerHTML = `<div class="muted">Ajoute/active un lieu dans Paramètres.</div>`;
return;
}
locs.forEach(l => {
const b = document.createElement(“button”);
b.className  = “pill”;
b.textContent = l.name;
b.onclick = () => {
$(“delDate”).value        = $(“dayDate”).value || isoDate();
window.__state.locationId = l.id;
renderLocationPills();
goTab(“delivery”);
};
box.appendChild(b);
});
}

// ─── Boot ────────────────────────────────────────────────────────────────────
(async () => {
// Auth
const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = “./index.html”; return; }

// Drawer
$(“openDrawer”).onclick  = openDrawer;
$(“closeDrawer”).onclick = closeDrawer;
overlay.onclick          = closeDrawer;

// Navigation
document.querySelectorAll(”.navitem[data-tab]”).forEach(b => {
b.addEventListener(“click”, () => goTab(b.dataset.tab));
});
document.querySelector(’.navitem[data-tab=“today”]’).classList.add(“active”);

// Déconnexion
$(“logoutBtn”).onclick = async () => {
if (!confirm(“Se déconnecter ?”)) return;
await supabase.auth.signOut();
window.location.href = “./index.html”;
};

// Init des modules
loadSettings();
initToday();
initDelivery();
initWithdraw();
initHistory();
initSettings();
initExpenses();
initResults();
initShifts();
initKm();

// Chargement initial
try {
setStatus(“Connecté ✅”);
await reloadAllData();
await refreshWithdraw();
await refreshHistory();
} catch (e) {
alert(“Erreur init: “ + (e?.message || e));
}
})();
