import { supabase } from "./supabase.js";
import { $, setStatus, eur, isoDate, toInt, esc } from "./ui.js";
import { loadSettings } from "./ui.js";
import { addDaysISO } from "./ui.js";

// ─── État livraison ──────────────────────────────────────────────────────────
let qtyByProduct = {};

export function resetQty() {
qtyByProduct = {};
const { products } = window.__state;
for (const p of products.filter(p => p.is_active)) qtyByProduct[p.id] = 0;
}

export function renderLocationPills() {
const box = $("locationPills");
box.innerHTML = "";
const { locations } = window.__state;
const locs = locations.filter(l => l.is_active);
if (!locs.length) {
box.innerHTML = `<div class="muted">Aucun lieu actif. Va dans Paramètres.</div>`;
return;
}
locs.forEach(l => {
const b = document.createElement("button");
b.className = "pill" + (l.id === window.__state.locationId ? " active" : "");
b.textContent = l.name;
b.onclick = () => { window.__state.locationId = l.id; renderLocationPills(); };
box.appendChild(b);
});
}

export function renderDeliveryList() {
const hide = $("hideZeros").checked;
const list = $("deliveryList");
list.innerHTML = "";
const { products } = window.__state;
const prods = products.filter(p => p.is_active).slice().sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999));

if (!prods.length) {
list.innerHTML = `<div class="muted">Aucun sandwich actif. Va dans Paramètres.</div>`;
return;
}

const visible = hide ? prods.filter(p => (qtyByProduct[p.id] || 0) > 0) : prods;
const toShow  = (visible.length === 0 && hide) ? prods : visible;

toShow.forEach(p => {
const q   = qtyByProduct[p.id] || 0;
const row = document.createElement("div");
row.className = "row";
row.innerHTML = ` <div><div class="name">${esc(p.name)}</div><div class="sub">${eur(p.price_cents)}</div></div> <div class="qty"> <button class="btn" type="button">−</button> <div class="qnum">${q}</div> <button class="btn" type="button">+</button> </div>`;
const btns = row.querySelectorAll("button");
btns[0].onclick = () => { qtyByProduct[p.id] = Math.max(0, q - 1); renderDeliveryList(); updateDeliveryTotals(); };
btns[1].onclick = () => { qtyByProduct[p.id] = q + 1; renderDeliveryList(); updateDeliveryTotals(); };
list.appendChild(row);
});
}

export function updateDeliveryTotals() {
let pieces = 0, cents = 0;
const { products } = window.__state;
for (const p of products.filter(p => p.is_active)) {
const q = Number(qtyByProduct[p.id] || 0);
pieces += q;
cents  += q * Number(p.price_cents || 0);
}
$("delTotalPieces").textContent = String(pieces);
$("delTotalEur").textContent    = eur(cents);
}

export async function loadDayLocationFromDB(dateISO, locId) {
const res = await supabase
.from("deliveries")
.select("product_id, qty_depose")
.eq("date_fabrication", dateISO)
.eq("location_id", locId);

if (res.error) { alert("Erreur chargement: " + res.error.message); return false; }

resetQty();
const { products } = window.__state;
const activeIds = new Set(products.filter(p => p.is_active).map(p => p.id));
for (const r of (res.data || [])) {
if (!activeIds.has(r.product_id)) continue;
qtyByProduct[r.product_id] = (qtyByProduct[r.product_id] || 0) + Number(r.qty_depose || 0);
}
renderDeliveryList();
updateDeliveryTotals();
return true;
}

export async function saveDayLocationToDB(dateISO, locId) {
const s       = loadSettings();
const retrait = addDaysISO(dateISO, Number(s.withdrawJ || 3));
const { products } = window.__state;
const rows    = products
.filter(p => p.is_active)
.map(p => ({ product_id: p.id, qty: Number(qtyByProduct[p.id] || 0) }))
.filter(x => x.qty > 0);

setStatus("Enregistrement...");
$("saveLocationBtn").disabled = true;

const delOld = await supabase.from("deliveries").delete().eq("date_fabrication", dateISO).eq("location_id", locId);
if (delOld.error) {
$("saveLocationBtn").disabled = false;
setStatus("");
alert("Erreur delete (RLS?) : " + delOld.error.message);
return;
}

if (!rows.length) {
$("saveLocationBtn").disabled = false;
setStatus("");
alert("Lieu mis à 0 (enregistré) ✅");
return;
}

const payload = rows.map(r => ({
date_fabrication: dateISO,
date_retrait:     retrait,
location_id:      locId,
product_id:       r.product_id,
qty_depose:       r.qty,
}));

const ins = await supabase.from("deliveries").insert(payload);
$("saveLocationBtn").disabled = false;
setStatus("");

if (ins.error) { alert("Erreur insert: " + ins.error.message); return; }
alert("Enregistré ✅ (jour + lieu remplacé)");
}

export function initDelivery() {
$("delDate").value = isoDate();

$("hideZeros").addEventListener("change", renderDeliveryList);

$("loadFromDBBtn").onclick = async () => {
const d = $("delDate").value || isoDate();
if (!window.__state.locationId) { alert("Aucun lieu actif."); return; }
await loadDayLocationFromDB(d, window.__state.locationId);
};

$("saveLocationBtn").onclick = async () => {
const d = $("delDate").value || isoDate();
if (!window.__state.locationId) { alert("Aucun lieu actif."); return; }
await saveDayLocationToDB(d, window.__state.locationId);
};
}
