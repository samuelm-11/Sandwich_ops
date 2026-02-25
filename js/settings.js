import { supabase } from “./supabase.js”;
import { $, setStatus, eur, toInt, toEuroStringToCents, esc } from “./ui.js”;

export async function refreshSettingsLists() {
const { locations, products } = window.__state;

const locHtml = locations.length
? locations
.slice()
.sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999))
.map(l => `<div class="card" style="margin-top:10px;"> <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"> <div style="font-weight:900;">${esc(l.name)}</div> ${l.is_active ? "" :`<span class="badgeOff">inactif</span>`} <div style="flex:1;"></div> <button class="mini" data-action="toggleLoc" data-id="${l.id}" data-active="${l.is_active ? "1" : "0"}">${l.is_active ? "Désactiver" : "Activer"}</button> </div> <div class="spacer"></div> <div class="grid2"> <input id="locName:${l.id}" type="text" value="${esc(l.name)}" /> <input id="locSort:${l.id}" type="number" value="${toInt(l.sort_order, 9999)}" /> </div> <button class="cta" data-action="saveLoc" data-id="${l.id}">Sauvegarder</button> </div>`)
.join(””)
: `<div class="muted">Aucun lieu.</div>`;

const prodHtml = products.length
? products
.slice()
.sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999))
.map(p => `<div class="card" style="margin-top:10px;"> <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"> <div style="font-weight:900;">${esc(p.name)}</div> ${p.is_active ? "" :`<span class="badgeOff">inactif</span>`} <div class="muted">— <b>${eur(p.price_cents)}</b></div> <div style="flex:1;"></div> <button class="mini" data-action="toggleProd" data-id="${p.id}" data-active="${p.is_active ? "1" : "0"}">${p.is_active ? "Désactiver" : "Activer"}</button> </div> <div class="spacer"></div> <div class="grid2"> <input id="prodName:${p.id}" type="text" value="${esc(p.name)}" /> <input id="prodPrice:${p.id}" type="text" value="${(Number(p.price_cents || 0) / 100).toFixed(2).replace(".", ",")}" /> </div> <div class="spacer"></div> <input id="prodSort:${p.id}" type="number" value="${toInt(p.sort_order, 9999)}" /> <button class="cta" data-action="saveProd" data-id="${p.id}">Sauvegarder</button> </div>`)
.join(””)
: `<div class="muted">Aucun sandwich.</div>`;

$(“settingsLocList”).innerHTML  = locHtml;
$(“settingsProdList”).innerHTML = prodHtml;

$(“settingsLocList”).querySelectorAll(”[data-action]”).forEach(btn => {
btn.onclick = async () => {
const { action, id, active } = btn.dataset;
if (action === “toggleLoc”) await setLocationActive(id, active !== “1”);
if (action === “saveLoc”)   await updateLocation(id);
};
});

$(“settingsProdList”).querySelectorAll(”[data-action]”).forEach(btn => {
btn.onclick = async () => {
const { action, id, active } = btn.dataset;
if (action === “toggleProd”) await setProductActive(id, active !== “1”);
if (action === “saveProd”)   await updateProduct(id);
};
});
}

async function setLocationActive(id, is_active) {
setStatus(“Mise à jour…”);
const res = await supabase.from(“locations”).update({ is_active }).eq(“id”, id);
setStatus(””);
if (res.error) { alert(“Erreur: “ + res.error.message); return; }
await window.__reloadAllData();
}

async function setProductActive(id, is_active) {
setStatus(“Mise à jour…”);
const res = await supabase.from(“products”).update({ is_active }).eq(“id”, id);
setStatus(””);
if (res.error) { alert(“Erreur: “ + res.error.message); return; }
await window.__reloadAllData();
}

async function updateLocation(id) {
const name = $(`locName:${id}`).value.trim();
const sort  = toInt($(`locSort:${id}`).value, 9999);
if (!name) { alert(“Nom obligatoire.”); return; }
setStatus(“Sauvegarde…”);
const res = await supabase.from(“locations”).update({ name, sort_order: sort }).eq(“id”, id);
setStatus(””);
if (res.error) { alert(“Erreur: “ + res.error.message); return; }
await window.__reloadAllData();
}

async function updateProduct(id) {
const name        = $(`prodName:${id}`).value.trim();
const sort        = toInt($(`prodSort:${id}`).value, 9999);
const price_cents = toEuroStringToCents($(`prodPrice:${id}`).value);
if (!name) { alert(“Nom obligatoire.”); return; }
if (price_cents === null) { alert(“Prix invalide.”); return; }
setStatus(“Sauvegarde…”);
const res = await supabase.from(“products”).update({ name, sort_order: sort, price_cents }).eq(“id”, id);
setStatus(””);
if (res.error) { alert(“Erreur: “ + res.error.message); return; }
await window.__reloadAllData();
}

export function initSettings() {
$(“saveSettings”).onclick = () => {
const s = { dlc: Number($(“setDlc”).value || 2), withdrawJ: Number($(“setWithdrawJ”).value || 3) };
localStorage.setItem(“sandops:settings”, JSON.stringify(s));
alert(“Paramètres sauvegardés ✅”);
};

$(“btnAddLoc”).onclick = async () => {
const name = $(“newLocName”).value.trim();
const sort = toInt($(“newLocSort”).value, 9999);
if (!name) { alert(“Nom du lieu obligatoire.”); return; }
setStatus(“Ajout lieu…”);
const res = await supabase.from(“locations”).insert({ name, sort_order: sort, is_active: true });
setStatus(””);
if (res.error) { alert(“Erreur: “ + res.error.message); return; }
$(“newLocName”).value = “”;
$(“newLocSort”).value = “”;
alert(“Lieu ajouté ✅”);
await window.__reloadAllData();
};

$(“btnAddProd”).onclick = async () => {
const name        = $(“newProdName”).value.trim();
const price_cents = toEuroStringToCents($(“newProdPrice”).value);
const sort        = toInt($(“newProdSort”).value, 9999);
if (!name) { alert(“Nom du sandwich obligatoire.”); return; }
if (price_cents === null) { alert(“Prix invalide.”); return; }
setStatus(“Ajout sandwich…”);
const res = await supabase.from(“products”).insert({ name, price_cents, sort_order: sort, is_active: true });
setStatus(””);
if (res.error) { alert(“Erreur: “ + res.error.message); return; }
$(“newProdName”).value  = “”;
$(“newProdPrice”).value = “”;
$(“newProdSort”).value  = “”;
alert(“Sandwich ajouté ✅”);
await window.__reloadAllData();
};

$(“btnReloadAll”).onclick = async () => { await window.__reloadAllData(); };
}
