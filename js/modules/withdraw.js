import { byId, esc, safeOn } from '../utils/dom.js';
import { isoDate, toInt } from '../utils/format.js';

export function createWithdrawModule(ctx) {
  const state = { withdrawQtyByDelivery: {}, remainingByDelivery: {}, lastDueList: null };

  const renderWithdrawList = (dueList) => {
    const list = byId('withdrawList');
    if (!list) return;
    list.innerHTML = '';
    if (!dueList?.length) {
      list.innerHTML = '<div class="card"><div style="font-weight:900;">Rien à retirer ✅</div><div class="muted">Aucun lot arrivé à échéance à cette date.</div></div>';
      return;
    }
    const byLoc = new Map();
    dueList.forEach((x) => { const k = x.location.name; if (!byLoc.has(k)) byLoc.set(k, []); byLoc.get(k).push(x); });

    for (const [locName, items] of byLoc.entries()) {
      const t = document.createElement('div');
      t.style.fontWeight = '900'; t.style.margin = '16px 0 8px 0';
      t.innerHTML = `${esc(locName)} ${items[0]?.location?.is_active ? '' : '<span class="badgeOff">inactif</span>'}`;
      list.appendChild(t);
      items.forEach((item) => {
        const q = state.withdrawQtyByDelivery[item.delivery_id] || 0;
        const max = item.qty_remaining;
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<div><div class="name">${esc(item.product.name)} ${item.product.is_active ? '' : '<span class="badgeOff">inactif</span>'}</div><div class="sub">Fab ${esc(item.date_fabrication)} · À retirer dès ${esc(item.date_retrait)} · Reste: ${max}</div></div><div class="qty"><button class="btn" type="button">−</button><div class="qnum">${q}</div><button class="btn" type="button">+</button></div>`;
        const btns = row.querySelectorAll('button');
        btns[0].onclick = () => { state.withdrawQtyByDelivery[item.delivery_id] = Math.max(0, q - 1); renderWithdrawList(dueList); };
        btns[1].onclick = () => { state.withdrawQtyByDelivery[item.delivery_id] = Math.min(max, q + 1); renderWithdrawList(dueList); };
        list.appendChild(row);
      });
    }
  };

  const refreshWithdraw = async () => {
    ctx.setStatus('Chargement des lots à retirer…');
    const todayISO = byId('withdrawDate').value || isoDate();
    const v = await ctx.supabase.from('v_delivery_remaining').select('*');
    ctx.setStatus('');
    if (v.error) return alert(`Erreur: ${v.error.message}`);

    const prodByIdAll = Object.fromEntries(ctx.state.products.map((p) => [p.id, p]));
    const locByIdAll = Object.fromEntries(ctx.state.locations.map((l) => [l.id, l]));
    const due = (v.data || []).filter((r) => Number(r.qty_remaining || 0) > 0 && String(r.date_retrait) <= todayISO).map((r) => ({
      delivery_id: r.delivery_id,
      date_fabrication: r.date_fabrication,
      date_retrait: r.date_retrait,
      qty_remaining: Number(r.qty_remaining || 0),
      product: prodByIdAll[r.product_id],
      location: locByIdAll[r.location_id],
    })).filter((x) => x.product && x.location)
      .sort((a, b) => toInt(a.location.sort_order, 9999) - toInt(b.location.sort_order, 9999)
      || toInt(a.product.sort_order, 9999) - toInt(b.product.sort_order, 9999)
      || String(a.date_fabrication).localeCompare(String(b.date_fabrication)));

    state.lastDueList = due;
    state.remainingByDelivery = {};
    state.withdrawQtyByDelivery = {};
    for (const d of due) { state.remainingByDelivery[d.delivery_id] = d.qty_remaining; state.withdrawQtyByDelivery[d.delivery_id] = 0; }
    renderWithdrawList(due);
  };

  const saveWithdrawals = async () => {
    const dateEff = byId('withdrawDate').value || isoDate();
    const rows = Object.entries(state.withdrawQtyByDelivery).map(([delivery_id, qty_retire]) => ({ delivery_id, qty_retire: Number(qty_retire || 0) })).filter((x) => x.qty_retire > 0);
    if (!rows.length) return alert('Aucun retrait encodé (tout est à 0).');
    for (const r of rows) if (r.qty_retire > (state.remainingByDelivery[r.delivery_id] ?? 0)) return alert('Retrait trop grand.');

    byId('saveWithdrawBtn').disabled = true;
    ctx.setStatus('Enregistrement retraits…');
    const ins = await ctx.supabase.from('withdrawals').insert(rows.map((r) => ({ date_retrait_effectif: dateEff, delivery_id: r.delivery_id, qty_retire: r.qty_retire })));
    byId('saveWithdrawBtn').disabled = false;
    ctx.setStatus('');
    if (ins.error) return alert(`Erreur: ${ins.error.message}`);
    alert('Retraits enregistrés ✅');
    await refreshWithdraw(); await ctx.refreshToday(); await ctx.refreshHistory();
  };

  safeOn(byId('refreshWithdraw'), 'click', refreshWithdraw);
  safeOn(byId('saveWithdrawBtn'), 'click', saveWithdrawals);
  safeOn(byId('btnWithdrawAll'), 'click', () => {
    if (!state.lastDueList) return;
    Object.keys(state.remainingByDelivery).forEach((id) => { state.withdrawQtyByDelivery[id] = state.remainingByDelivery[id]; });
    renderWithdrawList(state.lastDueList);
  });
  safeOn(byId('btnWithdrawNone'), 'click', () => {
    if (!state.lastDueList) return;
    Object.keys(state.withdrawQtyByDelivery).forEach((id) => { state.withdrawQtyByDelivery[id] = 0; });
    renderWithdrawList(state.lastDueList);
  });

  return { refreshWithdraw };
}
