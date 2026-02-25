import { supabase } from “./supabase.js”;
import { $, setStatus, isoDate, toInt, esc } from “./ui.js”;
import { refreshHistory } from “./history.js”;
import { refreshToday } from “./today.js”;

let lastDueList         = null;
let withdrawQtyByDelivery = {};
let remainingByDelivery   = {};

export async function refreshWithdraw() {
setStatus(“Chargement des lots à retirer…”);
const todayISO = $(“withdrawDate”).value || isoDate();
const v = await supabase.from(“v_delivery_remaining”).select(”*”);
setStatus(””);
if (v.error) { alert(“Erreur: “ + v.error.message); return; }

const { products, locations } = window.__state;
const prodByIdAll = Object.fromEntries(products.map(p => [p.id, p]));
const locByIdAll  = Object.fromEntries(locations.map(l => [l.id, l]));

const due = (v.data || [])
.filter(r => Number(r.qty_remaining || 0) > 0 && String(r.date_retrait) <= todayISO)
.map(r => ({
delivery_id:      r.delivery_id,
date_fabrication: r.date_fabrication,
date_retrait:     r.date_retrait,
qty_remaining:    Number(r.qty_remaining || 0),
product:          prodByIdAll[r.product_id],
location:         locByIdAll[r.location_id],
}))
.filter(x => x.product && x.location)
.sort((a, b) => {
const lo = toInt(a.location.sort_order, 9999) - toInt(b.location.sort_order, 9999);
if (lo !== 0) return lo;
const po = toInt(a.product.sort_order, 9999) - toInt(b.product.sort_order, 9999);
if (po !== 0) return po;
return String(a.date_fabrication).localeCompare(String(b.date_fabrication));
});

lastDueList = due;
remainingByDelivery   = {};
withdrawQtyByDelivery = {};
for (const d of due) {
remainingByDelivery[d.delivery_id]   = d.qty_remaining;
withdrawQtyByDelivery[d.delivery_id] = 0;
}
renderWithdrawList(due);
}

function renderWithdrawList(dueList) {
const list = $(“withdrawList”);
list.innerHTML = “”;
if (!dueList || !dueList.length) {
list.innerHTML = `<div class="card"><div style="font-weight:900;">Rien à retirer ✅</div><div class="muted">Aucun lot arrivé à échéance à cette date.</div></div>`;
return;
}

const byLoc = new Map();
dueList.forEach(x => {
const k = x.location.name;
if (!byLoc.has(k)) byLoc.set(k, []);
byLoc.get(k).push(x);
});

for (const [locName, items] of byLoc.entries()) {
const t = document.createElement(“div”);
t.style.fontWeight = “900”;
t.style.margin     = “16px 0 8px 0”;
t.innerHTML = `${esc(locName)} ${items[0]?.location?.is_active ? "" : '<span class="badgeOff">inactif</span>'}`;
list.appendChild(t);

```
items.forEach(item => {
  const q   = withdrawQtyByDelivery[item.delivery_id] || 0;
  const max = item.qty_remaining;
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
    <div>
      <div class="name">${esc(item.product.name)} ${item.product.is_active ? "" : '<span class="badgeOff">inactif</span>'}</div>
      <div class="sub">Fab ${esc(item.date_fabrication)} · À retirer dès ${esc(item.date_retrait)} · Reste: ${max}</div>
    </div>
    <div class="qty">
      <button class="btn" type="button">−</button>
      <div class="qnum">${q}</div>
      <button class="btn" type="button">+</button>
    </div>`;
  const btns = row.querySelectorAll("button");
  btns[0].onclick = () => { withdrawQtyByDelivery[item.delivery_id] = Math.max(0, q - 1); renderWithdrawList(dueList); };
  btns[1].onclick = () => { withdrawQtyByDelivery[item.delivery_id] = Math.min(max, q + 1); renderWithdrawList(dueList); };
  list.appendChild(row);
});
```

}
}

async function saveWithdrawals() {
const dateEff = $(“withdrawDate”).value || isoDate();
const rows = Object.entries(withdrawQtyByDelivery)
.map(([delivery_id, qty_retire]) => ({ delivery_id, qty_retire: Number(qty_retire || 0) }))
.filter(x => x.qty_retire > 0);

if (!rows.length) { alert(“Aucun retrait encodé (tout est à 0).”); return; }
for (const r of rows) {
if (r.qty_retire > (remainingByDelivery[r.delivery_id] ?? 0)) { alert(“Retrait trop grand.”); return; }
}

$(“saveWithdrawBtn”).disabled = true;
setStatus(“Enregistrement retraits…”);

const ins = await supabase.from(“withdrawals”).insert(
rows.map(r => ({ date_retrait_effectif: dateEff, delivery_id: r.delivery_id, qty_retire: r.qty_retire }))
);
$(“saveWithdrawBtn”).disabled = false;
setStatus(””);

if (ins.error) { alert(“Erreur: “ + ins.error.message); return; }
alert(“Retraits enregistrés ✅”);
await refreshWithdraw();
await refreshToday();
await refreshHistory();
}

export function initWithdraw() {
$(“withdrawDate”).value = isoDate();
$(“refreshWithdraw”).onclick = refreshWithdraw;
$(“btnWithdrawAll”).onclick  = () => {
if (!lastDueList) return;
Object.keys(remainingByDelivery).forEach(id => withdrawQtyByDelivery[id] = remainingByDelivery[id]);
renderWithdrawList(lastDueList);
};
$(“btnWithdrawNone”).onclick = () => {
if (!lastDueList) return;
Object.keys(withdrawQtyByDelivery).forEach(id => withdrawQtyByDelivery[id] = 0);
renderWithdrawList(lastDueList);
};
$(“saveWithdrawBtn”).onclick = saveWithdrawals;
}
