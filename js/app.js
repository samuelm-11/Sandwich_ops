import { supabase, requireSession } from './supabase.js';
import { byId, esc, safeOn, setText } from './utils/dom.js';
import { isoDate, isoDateTimeLocal, addDaysISO, toInt, formatHoursFromMinutes } from './utils/format.js';
import { createNavigation } from './ui/navigation.js';
import { createDeliveryModule } from './modules/delivery.js';
import { createTodayModule } from './modules/today.js';
import { createWithdrawModule } from './modules/withdraw.js';
import { createHistoryModule } from './modules/history.js';
import { createExpensesModule } from './modules/expenses.js';
import { createResultsModule } from './modules/results.js';
import { createSettingsModule } from './modules/settings.js';

const state = { locations: [], products: [], locationId: '', qtyByProduct: {} };

const setStatus = (msg) => setText(byId('status'), msg || '');

const loadSettings = () => {
  const raw = localStorage.getItem('sandops:settings');
  const def = { dlc: 2, withdrawJ: 3 };
  const settings = raw ? { ...def, ...JSON.parse(raw) } : def;
  if (byId('setDlc')) byId('setDlc').value = String(settings.dlc);
  if (byId('setWithdrawJ')) byId('setWithdrawJ').value = String(settings.withdrawJ);
  return settings;
};

const activeLocations = () => state.locations.filter((l) => l.is_active);

const renderQuickPills = (goTab, renderLocationPills) => {
  const box = byId('quickLocPills');
  if (!box) return;
  box.innerHTML = '';
  const locs = activeLocations();
  if (!locs.length) return box.innerHTML = '<div class="muted">Ajoute/active un lieu dans Paramètres.</div>';
  locs.forEach((l) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.textContent = l.name;
    b.onclick = () => {
      byId('delDate').value = byId('dayDate').value || isoDate();
      state.locationId = l.id;
      renderLocationPills();
      goTab('delivery');
    };
    box.appendChild(b);
  });
};

const loadRefsFresh = async (deliveryModule) => {
  setStatus('Chargement produits/lieux…');
  const locRes = await supabase.from('locations').select('id,name,sort_order,is_active').order('sort_order', { ascending: true });
  const prodRes = await supabase.from('products').select('id,name,price_cents,sort_order,is_active').order('sort_order', { ascending: true });
  setStatus('');
  if (locRes.error) throw locRes.error;
  if (prodRes.error) throw prodRes.error;
  state.locations = (locRes.data || []).map((x) => ({ ...x, is_active: !!x.is_active }));
  state.products = (prodRes.data || []).map((x) => ({ ...x, is_active: !!x.is_active }));
  const actLocs = activeLocations();
  if (!state.locationId || !actLocs.find((l) => l.id === state.locationId)) state.locationId = actLocs[0]?.id || '';
  deliveryModule.resetQty();
};

const initShiftKm = (ctx) => {
  const addShift = async () => {
    const start = byId('shiftStart').value;
    const end = byId('shiftEnd').value;
    const note = (byId('shiftNote').value || '').trim() || null;
    if (!start || !end) return alert('Début et fin obligatoires.');
    const startISO = new Date(start).toISOString();
    const endISO = new Date(end).toISOString();
    if (new Date(endISO) <= new Date(startISO)) return alert('La fin doit être après le début.');
    setStatus('Ajout shift…');
    const res = await supabase.from('shifts').insert({ start_ts: startISO, end_ts: endISO, note });
    setStatus('');
    if (res.error) return alert(`Erreur shift: ${res.error.message}`);
    byId('shiftNote').value = '';
    alert('Shift ajouté ✅');
    await refreshShiftKmSummary();
  };

  const addKm = async () => {
    const day = byId('kmDay').value || isoDate();
    const odo_start = parseInt(byId('kmStart').value, 10);
    const odo_end = parseInt(byId('kmEnd').value, 10);
    const note = (byId('kmNote').value || '').trim() || null;
    if (!Number.isFinite(odo_start) || !Number.isFinite(odo_end)) return alert('Compteurs invalides.');
    if (odo_end < odo_start) return alert('odo_end doit être >= odo_start.');
    setStatus('Ajout KM…');
    const res = await supabase.from('km_logs').insert({ day, odo_start, odo_end, note });
    setStatus('');
    if (res.error) return alert(`Erreur KM: ${res.error.message}`);
    byId('kmStart').value = ''; byId('kmEnd').value = ''; byId('kmNote').value = '';
    alert('KM ajouté ✅');
    await refreshShiftKmSummary();
  };

  const refreshShiftKmSummary = async () => {
    const from = addDaysISO(isoDate(), -30); const to = isoDate();
    setStatus('Calcul KM/Shifts…');
    const shifts = await supabase.from('shifts').select('start_ts,end_ts').gte('start_ts', `${from}T00:00:00Z`).lte('start_ts', `${to}T23:59:59Z`);
    const kms = await supabase.from('km_logs').select('day,odo_start,odo_end').gte('day', from).lte('day', to);
    setStatus('');
    if (shifts.error) return byId('shiftKmSummary').textContent = `Erreur shifts: ${shifts.error.message}`;
    if (kms.error) return byId('shiftKmSummary').textContent = `Erreur km_logs: ${kms.error.message}`;
    let totalMinutes = 0;
    for (const s of (shifts.data || [])) {
      const mins = (new Date(s.end_ts) - new Date(s.start_ts)) / 60000;
      if (Number.isFinite(mins) && mins > 0) totalMinutes += mins;
    }
    let totalKm = 0;
    for (const k of (kms.data || [])) {
      const d = Number(k.odo_end || 0) - Number(k.odo_start || 0);
      if (Number.isFinite(d) && d >= 0) totalKm += d;
    }
    byId('shiftKmSummary').innerHTML = `<div class="kv"><div>Shifts (30j)</div><div style="font-weight:900;">${(shifts.data || []).length}</div></div><div class="kv"><div>Heures (30j)</div><div style="font-weight:900;">${formatHoursFromMinutes(totalMinutes)}</div></div><div class="kv"><div>Trajets KM (30j)</div><div style="font-weight:900;">${(kms.data || []).length}</div></div><div class="kv"><div>Kilomètres (30j)</div><div style="font-weight:900;">${totalKm} km</div></div>`;
  };

  safeOn(byId('refreshShiftKmBtn'), 'click', refreshShiftKmSummary);
  safeOn(byId('addShiftBtn'), 'click', addShift);
  safeOn(byId('addKmBtn'), 'click', addKm);
  ctx.refreshShiftKmSummary = refreshShiftKmSummary;
};

const initDates = () => {
  byId('dayDate').value = isoDate();
  byId('delDate').value = isoDate();
  byId('withdrawDate').value = isoDate();
  const today = isoDate();
  byId('histFrom').value = addDaysISO(today, -30); byId('histTo').value = today;
  byId('expDate').value = isoDate(); byId('expFrom').value = addDaysISO(today, -30); byId('expTo').value = today;
  byId('resFrom').value = addDaysISO(today, -30); byId('resTo').value = today;
  byId('kmDay').value = isoDate();
  byId('shiftStart').value = isoDateTimeLocal();
  byId('shiftEnd').value = isoDateTimeLocal();
};

async function boot() {
  await requireSession('./index.html');
  safeOn(byId('logoutBtn'), 'click', async () => {
    if (!confirm('Se déconnecter ?')) return;
    await supabase.auth.signOut();
    window.location.href = './index.html';
  });

  const sections = {
    today: byId('tab-today'), delivery: byId('tab-delivery'), withdraw: byId('tab-withdraw'), history: byId('tab-history'),
    settings: byId('tab-settings'), expenses: byId('tab-expenses'), results: byId('tab-results'), shiftkm: byId('tab-shiftkm'),
  };

  const nav = createNavigation({
    titleEl: byId('title'), drawerEl: byId('drawer'), overlayEl: byId('drawerOverlay'), sections,
    onTabChange: (tab) => { if (tab === 'shiftkm') ctx.refreshShiftKmSummary?.(); },
  });

  const ctx = { state, supabase, setStatus, loadSettings, goTab: nav.goTab };
  const delivery = createDeliveryModule({ ...ctx, refreshToday: () => today.refreshToday() });
  const today = createTodayModule({ ...ctx, goTab: nav.goTab, refreshWithdraw: () => withdraw.refreshWithdraw() });
  const withdraw = createWithdrawModule({ ...ctx, refreshToday: () => today.refreshToday(), refreshHistory: () => history.refreshHistory() });
  const history = createHistoryModule(ctx);
  const results = createResultsModule(ctx);
  const expenses = createExpensesModule({ ...ctx, refreshResults: () => results.refreshResults() });
  const settings = createSettingsModule({ ...ctx, reloadAllData });

  initDates();
  initShiftKm(ctx);

  async function reloadAllData() {
    await loadRefsFresh(delivery);
    delivery.renderLocationPills();
    renderQuickPills(nav.goTab, delivery.renderLocationPills);
    delivery.renderDeliveryList();
    delivery.updateDeliveryTotals();
    await settings.refreshSettingsLists();
    await today.refreshToday();
    await expenses.refreshExpenses();
    await results.refreshResults();
  }

  ctx.reloadAllData = reloadAllData;
  ctx.refreshToday = today.refreshToday;
  ctx.refreshWithdraw = withdraw.refreshWithdraw;
  ctx.refreshHistory = history.refreshHistory;
  ctx.refreshResults = results.refreshResults;

  nav.goTab('today');
  try {
    loadSettings();
    setStatus('Connecté ✅');
    await reloadAllData();
    await withdraw.refreshWithdraw();
    await history.refreshHistory();
    await ctx.refreshShiftKmSummary();
  } catch (e) {
    alert(`Erreur init: ${e?.message || e}`);
  }
}

boot();
