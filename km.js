import { supabase } from "./supabase.js";
import { $, setStatus, eur, isoDate, addDaysISO, toInt, esc } from "./ui.js";

export async function refreshKm() {
const from = $("kmFrom").value || addDaysISO(isoDate(), -30);
const to   = $("kmTo").value   || isoDate();
setStatus("Chargement kilomètres...");

const res = await supabase
.from("kilometers")
.select("*")
.gte("km_date", from)
.lte("km_date", to)
.order("km_date", { ascending: false });
setStatus("");

if (res.error) { alert("Erreur: " + res.error.message); return; }

const rows = res.data || [];
let totalKm = 0, totalReimb = 0;
for (const r of rows) {
totalKm    += Number(r.km_total || 0);
totalReimb += Number(r.reimbursement_cents || 0);
}

$("kmTotal").textContent = `${totalKm} km`;
$("kmReimb").textContent = eur(totalReimb);

let html = "";
for (const r of rows) {
html += `<div class="row"> <div> <div class="name">${esc(r.km_date)}</div> <div class="sub">${r.km_start} → ${r.km_end} km · ${r.km_total} km${r.note ? ` · ${esc(r.note)}` : ""}</div> </div> <div style="font-weight:900;">${eur(r.reimbursement_cents)}</div> </div>`;
}
$("kmList").innerHTML = html || `<div class="muted">Aucun trajet sur la période.</div>`;
}

async function addKmFromForm() {
const km_date  = $("kmDate").value || isoDate();
const km_start = toInt($("kmStart").value);
const km_end   = toInt($("kmEnd").value);
const rate_str = ($("kmRate").value || "").replace(",", ".");
const rate     = parseFloat(rate_str);
const note     = ($("kmNote").value || "").trim() || null;

if (!km_start || !km_end || km_end <= km_start) { alert("Kilométrages invalides (fin > début)."); return; }
if (!Number.isFinite(rate) || rate <= 0)         { alert("Taux invalide (ex: 0,42)."); return; }

const km_total            = km_end - km_start;
const reimbursement_cents = Math.round(km_total * rate * 100);

$("addKmBtn").disabled = true;
setStatus("Ajout trajet...");

const res = await supabase.from("kilometers").insert({ km_date, km_start, km_end, km_total, rate_cents: Math.round(rate * 100), reimbursement_cents, note });
$("addKmBtn").disabled = false;
setStatus("");

if (res.error) { alert("Erreur: " + res.error.message); return; }
alert("Trajet ajouté ✅");
$("kmStart").value = "";
$("kmEnd").value   = "";
$("kmNote").value  = "";
await refreshKm();
}

export function initKm() {
const today = isoDate();
$("kmDate").value = today;
$("kmFrom").value = addDaysISO(today, -30);
$("kmTo").value   = today;
if ($("kmRate")) $("kmRate").value = "0,42"; // taux par défaut

$("refreshKm").onclick = refreshKm;
$("addKmBtn").onclick  = addKmFromForm;
}
