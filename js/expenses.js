import { supabase } from “./supabase.js”;
import { $, setStatus, eur, isoDate, addDaysISO, toEuroStringToCents, esc } from “./ui.js”;
// refreshResults appelé via window pour éviter les imports circulaires

export async function refreshExpenses() {
const from = $(“expFrom”).value || addDaysISO(isoDate(), -30);
const to   = $(“expTo”).value   || isoDate();
setStatus(“Chargement dépenses…”);

const res = await supabase
.from(“expenses”)
.select(“id,expense_date,amount_cents,category,note,receipt_path,created_at”)
.gte(“expense_date”, from)
.lte(“expense_date”, to)
.order(“expense_date”, { ascending: false })
.order(“created_at”,   { ascending: false });
setStatus(””);

if (res.error) { alert(“Erreur: “ + res.error.message); return; }

const rows = res.data || [];
let total = 0;
for (const r of rows) total += Number(r.amount_cents || 0);
$(“expTotal”).textContent = eur(total);
$(“expList”).innerHTML    = renderExpensesTable(rows);

for (const r of rows) {
const delBtn  = document.querySelector(`[data-exp-del="${r.id}"]`);
const viewBtn = document.querySelector(`[data-exp-view="${r.id}"]`);
if (delBtn)  delBtn.onclick  = () => deleteExpense(r.id, r.receipt_path);
if (viewBtn) viewBtn.onclick = () => openReceipt(r.receipt_path);
}
}

function renderExpensesTable(rows) {
if (!rows.length) return `<div class="muted">Aucune dépense sur la période.</div>`;
const trs = rows.map(r => `<tr> <td>${esc(r.expense_date)}</td> <td>${esc(r.category)}</td> <td>${r.note ? `<div>${esc(r.note)}</div>`:`<span class="muted">—</span>`}</td> <td style="white-space:nowrap;font-weight:900;">${eur(r.amount_cents)}</td> <td style="white-space:nowrap;"> ${r.receipt_path ? `<button class="mini" data-exp-view="${r.id}">Voir</button>`:`<span class="muted">—</span>`}
<button class="mini" data-exp-del="${r.id}">Suppr.</button>
</td>

  </tr>`).join("");
  return `<table><thead><tr><th>Date</th><th>Catégorie</th><th>Note</th><th>Montant</th><th>Actions</th></tr></thead><tbody>${trs}</tbody></table>`;
}

async function openReceipt(path) {
if (!path) return;
const pub = supabase.storage.from(“receipts”).getPublicUrl(path);
const url = pub?.data?.publicUrl;
if (!url) { alert(“Impossible d’ouvrir le scan.”); return; }
window.open(url, “_blank”);
}

async function deleteExpense(id, receipt_path) {
if (!confirm(“Supprimer cette dépense ?”)) return;
setStatus(“Suppression…”);
const del = await supabase.from(“expenses”).delete().eq(“id”, id);
setStatus(””);
if (del.error) { alert(“Erreur: “ + del.error.message); return; }
if (receipt_path) await supabase.storage.from(“receipts”).remove([receipt_path]);
await refreshExpenses();
if (window.__refreshResults) await window.__refreshResults();
}

async function addExpenseFromForm() {
const expense_date  = $(“expDate”).value || isoDate();
const amount_cents  = toEuroStringToCents($(“expAmount”).value);
const category      = ($(“expCategory”).value || “”).trim();
const note          = ($(“expNote”).value || “”).trim() || null;
const file          = $(“expReceipt”).files?.[0] || null;

if (!amount_cents || amount_cents <= 0) { alert(“Montant invalide.”); return; }

$(“addExpenseBtn”).disabled = true;
setStatus(“Ajout dépense…”);

let receipt_path = null;
if (file) {
const ext     = (file.name.split(”.”).pop() || “jpg”).toLowerCase();
const safeExt = ext.replace(/[^a-z0-9]/g, “”).slice(0, 6) || “jpg”;
const path    = `receipts/${expense_date}/${crypto.randomUUID()}.${safeExt}`;
const up = await supabase.storage.from(“receipts”).upload(path, file, { upsert: false });
if (up.error) { $(“addExpenseBtn”).disabled = false; setStatus(””); alert(“Erreur upload: “ + up.error.message); return; }
receipt_path = path;
}

const ins = await supabase.from(“expenses”).insert({ expense_date, amount_cents, category, note, receipt_path });
$(“addExpenseBtn”).disabled = false;
setStatus(””);

if (ins.error) { alert(“Erreur dépense: “ + ins.error.message); return; }
alert(“Dépense ajoutée ✅”);
$(“expAmount”).value  = “”;
$(“expNote”).value    = “”;
$(“expReceipt”).value = “”;
await refreshExpenses();
if (window.__refreshResults) await window.__refreshResults();
}

export function initExpenses() {
const today = isoDate();
$(“expDate”).value = today;
$(“expFrom”).value = addDaysISO(today, -30);
$(“expTo”).value   = today;

$(“refreshExpenses”).onclick    = refreshExpenses;
$(“addExpenseBtn”).onclick      = addExpenseFromForm;
$(“clearExpenseFormBtn”).onclick = () => {
$(“expAmount”).value   = “”;
$(“expNote”).value     = “”;
$(“expReceipt”).value  = “”;
$(“expCategory”).value = “Parking”;
$(“expDate”).value     = isoDate();
};
}
