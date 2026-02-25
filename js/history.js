import { supabase } from “./supabase.js”;
import { $, setStatus, eur, isoDate, addDaysISO, esc } from “./ui.js”;

export async function refreshHistory() {
const from = $(“histFrom”).value || addDaysISO(isoDate(), -30);
const to   = $(“histTo”).value   || isoDate();
setStatus(“Chargement historique…”);

const del = await supabase.from(“deliveries”).select(“date_fabrication, product_id, qty_depose”).gte(“date_fabrication”, from).lte(“date_fabrication”, to);
const wit = await supabase.from(“withdrawals”).select(“date_retrait_effectif, qty_retire”).gte(“date_retrait_effectif”, from).lte(“date_retrait_effectif”, to);
setStatus(””);

if (del.error) { alert(“Erreur deliveries: “ + del.error.message); return; }
if (wit.error) { alert(“Erreur withdrawals: “ + wit.error.message); return; }

const { products } = window.__state;
const prodByIdAll = Object.fromEntries(products.map(p => [p.id, p]));

let deliveredPieces = 0, revenueCents = 0;
for (const r of (del.data || [])) {
deliveredPieces += Number(r.qty_depose || 0);
const p = prodByIdAll[r.product_id];
if (p) revenueCents += Number(r.qty_depose || 0) * Number(p.price_cents || 0);
}

let withdrawnPieces = 0;
for (const r of (wit.data || [])) withdrawnPieces += Number(r.qty_retire || 0);

$(“histDelivered”).textContent = String(deliveredPieces);
$(“histWithdrawn”).textContent = String(withdrawnPieces);
$(“histRevenue”).textContent   = eur(revenueCents);

const byDate = new Map();
for (const r of (del.data || [])) {
const d = r.date_fabrication;
if (!byDate.has(d)) byDate.set(d, { pieces: 0, cents: 0 });
const p = prodByIdAll[r.product_id];
byDate.get(d).pieces += Number(r.qty_depose || 0);
if (p) byDate.get(d).cents += Number(r.qty_depose || 0) * Number(p.price_cents || 0);
}

const dates = […byDate.keys()].sort((a, b) => b.localeCompare(a)).slice(0, 12);
let html = “”;
for (const d of dates) {
const x = byDate.get(d);
html += `<div class="row"><div><div class="name">${esc(d)}</div><div class="sub">${x.pieces} pièces</div></div><div style="font-weight:900;">${eur(x.cents)}</div></div>`;
}
$(“histList”).innerHTML = html || `<div class="muted">Aucune donnée sur cette période.</div>`;
}

export function initHistory() {
const today = isoDate();
$(“histFrom”).value = addDaysISO(today, -30);
$(“histTo”).value   = today;
$(“refreshHist”).onclick = refreshHistory;
}
