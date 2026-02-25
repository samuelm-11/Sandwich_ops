import { supabase } from “./supabase.js”;
import { $, setStatus, eur, isoDate, toInt, esc } from “./ui.js”;
import { goTab } from “./app.js”;

export async function refreshToday() {
await refreshTodayProductionOnly();
await refreshTodayWithdrawSummary();
}

async function refreshTodayProductionOnly() {
const dateFab = $(“dayDate”).value || isoDate();
setStatus(“Calcul…”);

const res = await supabase
.from(“deliveries”)
.select(“location_id, product_id, qty_depose”)
.eq(“date_fabrication”, dateFab);
setStatus(””);

if (res.error) { alert(“Erreur: “ + res.error.message); return; }

const { locations, products } = window.__state;
const locsSorted  = locations.filter(l => l.is_active).slice().sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999));
const prodsSorted = products.filter(p => p.is_active).slice().sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999));
const locById  = Object.fromEntries(locsSorted.map(l => [l.id, l]));
const prodById = Object.fromEntries(prodsSorted.map(p => [p.id, p]));

const byProd = new Map();
const locTotals = new Map();
for (const l of locsSorted) locTotals.set(l.id, 0);

for (const r of (res.data || [])) {
const p = prodById[r.product_id], l = locById[r.location_id];
if (!p || !l) continue;
const q = Number(r.qty_depose || 0);
if (!byProd.has(p.id)) byProd.set(p.id, { product: p, perLoc: new Map(), totalQty: 0, totalCents: 0 });
const g = byProd.get(p.id);
g.perLoc.set(l.id, (g.perLoc.get(l.id) || 0) + q);
g.totalQty += q;
g.totalCents += q * Number(p.price_cents || 0);
locTotals.set(l.id, (locTotals.get(l.id) || 0) + q);
}

let totalPieces = 0, totalCents = 0;
for (const g of byProd.values()) { totalPieces += g.totalQty; totalCents += g.totalCents; }

$(“todayPieces”).textContent = String(totalPieces);
$(“todayEur”).textContent = eur(totalCents);

if (!locsSorted.length || !prodsSorted.length) {
$(“todayTable”).innerHTML = `<div class="muted" style="margin-top:10px;">Ajoute/active au moins 1 lieu et 1 sandwich dans Paramètres.</div>`;
return;
}

let html = `<table><thead><tr><th>Sandwich</th>${locsSorted.map(l => `<th>${esc(l.name)}</th>`).join("")}<th>TOTAL</th></tr></thead><tbody>`;
for (const p of prodsSorted) {
const g = byProd.get(p.id);
const t = g?.totalQty || 0;
html += `<tr><td><b>${esc(p.name)}</b></td>${locsSorted.map(l => `<td>${g?.perLoc.get(l.id) || 0}</td>`).join("")}<td><b>${t}</b></td></tr>`;
}
html += `</tbody><tfoot><tr><td>TOTAL</td>${locsSorted.map(l => `<td>${locTotals.get(l.id) || 0}</td>`).join("")}<td>${totalPieces}</td></tr></tfoot></table>`;
$(“todayTable”).innerHTML = html;
}

async function refreshTodayWithdrawSummary() {
const todayISO = $(“dayDate”).value || isoDate();
const v = await supabase.from(“v_delivery_remaining”).select(”*”);
if (v.error) { $(“todayWithdrawSummary”).textContent = “Erreur: “ + v.error.message; return; }

const { locations } = window.__state;
const due = (v.data || []).filter(r => Number(r.qty_remaining || 0) > 0 && String(r.date_retrait) <= todayISO);
const byLoc = new Map();
let total = 0;
const locByIdAll = Object.fromEntries(locations.map(l => [l.id, l]));

for (const r of due) {
const k = r.location_id, q = Number(r.qty_remaining || 0);
byLoc.set(k, (byLoc.get(k) || 0) + q);
total += q;
}

const lines = [];
for (const [locId, q] of byLoc.entries()) {
const name   = locByIdAll[locId]?.name || locId;
const active = locByIdAll[locId]?.is_active !== false;
lines.push(`${esc(name)} : ${q} pièce(s) ${active ? "" : '<span class="badgeOff">inactif</span>'}`);
}
lines.sort((a, b) => a.localeCompare(b));

$(“todayWithdrawSummary”).innerHTML = lines.length
? `${lines.join("<br>")}<br><br><b>Total à retirer: ${total} pièce(s)</b>`
: `Rien à retirer ✅`;
}

export function initToday() {
$(“dayDate”).value = isoDate();
$(“todayRefresh”).onclick = refreshToday;
$(“gotoWithdraw”).onclick = () => {
$(“withdrawDate”).value = $(“dayDate”).value || isoDate();
goTab(“withdraw”);
};
}
