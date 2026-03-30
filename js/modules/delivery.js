import { byId, esc, setHtml, safeOn } from '../utils/dom.js';
import { eur, isoDate, toInt, addDaysISO } from '../utils/format.js';

export function createDeliveryModule(ctx) {
  const activeProducts = () => ctx.state.products.filter((p) => p.is_active);
  const activeLocations = () => ctx.state.locations.filter((l) => l.is_active);

  const resetQty = () => {
    ctx.state.qtyByProduct = {};
    for (const p of activeProducts()) ctx.state.qtyByProduct[p.id] = 0;
  };

  const renderLocationPills = () => {
    const box = byId('locationPills');
    if (!box) return;
    box.innerHTML = '';
    const locs = activeLocations();
    if (!locs.length) return setHtml(box, '<div class="muted">Aucun lieu actif. Va dans Paramètres.</div>');
    locs.forEach((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pill${l.id === ctx.state.locationId ? ' active' : ''}`;
      b.textContent = l.name;
      b.onclick = () => { ctx.state.locationId = l.id; renderLocationPills(); };
      box.appendChild(b);
    });
  };

  const renderDeliveryList = () => {
    const list = byId('deliveryList');
    const hide = byId('hideZeros')?.checked;
    if (!list) return;
    list.innerHTML = '';
    const prods = activeProducts().slice().sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999));
    if (!prods.length) return setHtml(list, '<div class="muted">Aucun sandwich actif. Va dans Paramètres.</div>');
    const visible = hide ? prods.filter((p) => (ctx.state.qtyByProduct[p.id] || 0) > 0) : prods;
    const toShow = visible.length === 0 && hide ? prods : visible;

    toShow.forEach((p) => {
      const q = ctx.state.qtyByProduct[p.id] || 0;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div><div class="name">${esc(p.name)}</div><div class="sub">${eur(p.price_cents)}</div></div><div class="qty"><button class="btn" type="button">−</button><div class="qnum">${q}</div><button class="btn" type="button">+</button></div>`;
      const btns = row.querySelectorAll('button');
      btns[0].onclick = () => { ctx.state.qtyByProduct[p.id] = Math.max(0, q - 1); renderDeliveryList(); updateDeliveryTotals(); };
      btns[1].onclick = () => { ctx.state.qtyByProduct[p.id] = q + 1; renderDeliveryList(); updateDeliveryTotals(); };
      list.appendChild(row);
    });
  };

  const updateDeliveryTotals = () => {
    let pieces = 0; let cents = 0;
    for (const p of activeProducts()) {
      const q = Number(ctx.state.qtyByProduct[p.id] || 0);
      pieces += q;
      cents += q * Number(p.price_cents || 0);
    }
    byId('delTotalPieces').textContent = String(pieces);
    byId('delTotalEur').textContent = eur(cents);
  };

  const loadDayLocationFromDB = async (dateISO, locId) => {
    const res = await ctx.supabase.from('deliveries').select('product_id, qty_depose').eq('date_fabrication', dateISO).eq('location_id', locId);
    if (res.error) return alert(`Erreur chargement: ${res.error.message}`), false;
    resetQty();
    const activeIds = new Set(activeProducts().map((p) => p.id));
    for (const r of (res.data || [])) if (activeIds.has(r.product_id)) ctx.state.qtyByProduct[r.product_id] = (ctx.state.qtyByProduct[r.product_id] || 0) + Number(r.qty_depose || 0);
    renderDeliveryList(); updateDeliveryTotals();
    return true;
  };

  const saveDayLocationToDB = async (dateISO, locId) => {
    const s = ctx.loadSettings();
    const retrait = addDaysISO(dateISO, Number(s.withdrawJ || 3));
    const rows = activeProducts().map((p) => ({ product_id: p.id, qty: Number(ctx.state.qtyByProduct[p.id] || 0) })).filter((x) => x.qty > 0);
    ctx.setStatus('Enregistrement…');
    byId('saveLocationBtn').disabled = true;
    const delOld = await ctx.supabase.from('deliveries').delete().eq('date_fabrication', dateISO).eq('location_id', locId);
    if (delOld.error) {
      byId('saveLocationBtn').disabled = false; ctx.setStatus(''); return alert(`Erreur delete (RLS?) : ${delOld.error.message}`);
    }
    if (!rows.length) {
      byId('saveLocationBtn').disabled = false; ctx.setStatus(''); alert('Lieu mis à 0 (enregistré) ✅'); return ctx.refreshToday();
    }
    const payload = rows.map((r) => ({ date_fabrication: dateISO, date_retrait: retrait, location_id: locId, product_id: r.product_id, qty_depose: r.qty }));
    const ins = await ctx.supabase.from('deliveries').insert(payload);
    byId('saveLocationBtn').disabled = false; ctx.setStatus('');
    if (ins.error) return alert(`Erreur insert: ${ins.error.message}`);
    alert('Enregistré ✅ (jour + lieu remplacé)');
    await ctx.refreshToday();
  };

  safeOn(byId('hideZeros'), 'change', renderDeliveryList);
  safeOn(byId('loadFromDBBtn'), 'click', async () => {
    if (!ctx.state.locationId) return alert('Aucun lieu actif.');
    await loadDayLocationFromDB(byId('delDate').value || isoDate(), ctx.state.locationId);
  });
  safeOn(byId('saveLocationBtn'), 'click', async () => {
    if (!ctx.state.locationId) return alert('Aucun lieu actif.');
    await saveDayLocationToDB(byId('delDate').value || isoDate(), ctx.state.locationId);
  });

  return { renderLocationPills, renderDeliveryList, updateDeliveryTotals, resetQty, loadDayLocationFromDB };
}
