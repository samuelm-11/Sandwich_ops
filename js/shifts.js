import { supabase } from "./supabase.js";
import { $, setStatus, isoDate, addDaysISO, esc } from "./ui.js";

export async function refreshShifts() {
const from = $("shiftFrom").value || addDaysISO(isoDate(), -30);
const to   = $("shiftTo").value   || isoDate();
setStatus("Chargement shifts...");

const res = await supabase
.from("shifts")
.select("*")
.gte("shift_date", from)
.lte("shift_date", to)
.order("shift_date", { ascending: false });
setStatus("");

if (res.error) { alert("Erreur: " + res.error.message); return; }

const rows = res.data || [];
let totalMinutes = 0;
for (const r of rows) totalMinutes += Number(r.minutes_total || 0);

const h = Math.floor(totalMinutes / 60), m = totalMinutes % 60;
$("shiftTotal").textContent = `${h}h${String(m).padStart(2, "0")}`;

let html = "";
for (const r of rows) {
const mins = Number(r.minutes_total || 0);
const rh = Math.floor(mins / 60), rm = mins % 60;
html += `<div class="row"> <div> <div class="name">${esc(r.shift_date)}</div> <div class="sub">${esc(r.start_time)} → ${esc(r.end_time)}${r.note ? ` · ${esc(r.note)}` : ""}</div> </div> <div style="font-weight:900;">${rh}h${String(rm).padStart(2, "0")}</div> </div>`;
}
$("shiftList").innerHTML = html || `<div class="muted">Aucun shift sur la période.</div>`;
}

async function addShiftFromForm() {
const shift_date = $("shiftDate").value || isoDate();
const start_time = $("shiftStart").value;
const end_time   = $("shiftEnd").value;
const note       = ($("shiftNote").value || "").trim() || null;

if (!start_time || !end_time) { alert("Heure début et fin obligatoires."); return; }

const start   = new Date(`1970-01-01T${start_time}`);
const end     = new Date(`1970-01-01T${end_time}`);
const minutes = (end - start) / 60000;
if (minutes <= 0) { alert("L'heure de fin doit être après l'heure de début."); return; }

$("addShiftBtn").disabled = true;
setStatus("Ajout shift...");

const res = await supabase.from("shifts").insert({ shift_date, start_time, end_time, minutes_total: minutes, note });
$("addShiftBtn").disabled = false;
setStatus("");

if (res.error) { alert("Erreur: " + res.error.message); return; }
alert("Shift ajouté ✅");
$("shiftStart").value = "";
$("shiftEnd").value   = "";
$("shiftNote").value  = "";
await refreshShifts();
}

export function initShifts() {
const today = isoDate();
$("shiftDate").value = today;
$("shiftFrom").value = addDaysISO(today, -30);
$("shiftTo").value   = today;

$("refreshShifts").onclick = refreshShifts;
$("addShiftBtn").onclick   = addShiftFromForm;
}
