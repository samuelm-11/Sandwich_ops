import { supabase } from "./supabase.js";
import { $, setStatus, eur, isoDate, addDaysISO, esc } from "./ui.js";

export async function refreshResults() {
const from = $("resFrom").value || addDaysISO(isoDate(), -30);
const to   = $("resTo").value   || isoDate();
setStatus("Calcul résultats...");

const del = await supabase.from("deliveries").select("date_fabrication,product_id,qty_depose").gte("date_fabrication", from).lte("date_fabrication", to);
const exp = await supabase.from("expenses").select("expense_date,amount_cents,category").gte("expense_date", from).lte("expense_date", to);
setStatus("");

if (del.error || exp.error) { alert("Erreur chargement résultats"); return; }

const { products } = window.__state;
const prodByIdAll = Object.fromEntries(products.map(p => [p.id, p]));

let deliveredPieces = 0, revenueCents = 0;
for (const r of (del.data || [])) {
deliveredPieces += Number(r.qty_depose || 0);
const p = prodByIdAll[r.product_id];
if (p) revenueCents += Number(r.qty_depose || 0) * Number(p.price_cents || 0);
}

let expenseCents = 0;
const byCat = new Map();
for (const r of (exp.data || [])) {
const a = Number(r.amount_cents || 0);
expenseCents += a;
const c = String(r.category || "Divers");
byCat.set(c, (byCat.get(c) || 0) + a);
}

$("resCA").textContent     = eur(revenueCents);
$("resExp").textContent    = eur(expenseCents);
$("resNet").textContent    = eur(revenueCents - expenseCents);
$("resPieces").textContent = `${deliveredPieces} pièces livrées sur la période.`;

const cats = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
$("resByCategory").innerHTML = !cats.length
? `<div class="muted">Aucune dépense sur la période.</div>`
: `<table><thead><tr><th>Dépenses par catégorie</th><th style="text-align:right;">Total</th></tr></thead> <tbody>${cats.map(([c, v]) => `<tr><td>${esc(c)}</td><td style="text-align:right;font-weight:900;">${eur(v)}</td></tr>`).join("")}</tbody></table>`;
}

export function initResults() {
const today = isoDate();
$("resFrom").value = addDaysISO(today, -30);
$("resTo").value   = today;
$("refreshResults").onclick = refreshResults;
}
