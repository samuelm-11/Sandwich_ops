import { byId, esc, safeOn } from '../utils/dom.js';
import { eur, isoDate, toInt } from '../utils/format.js';

export function createTodayModule(ctx) {
  const activeLocations = () => ctx.state.locations.filter((l) => l.is_active);
  const activeProducts = () => ctx.state.products.filter((p) => p.is_active);

  const refreshTodayProductionOnly = async () => {
    const dateFab = byId('dayDate').value || isoDate();
    ctx.setStatus('Calcul…');
    const res = await ctx.supabase.from('deliveries').select('location_id, product_id, qty_depose').eq('date_fabrication', dateFab);
    ctx.setStatus('');
    if (res.error) return alert(`Erreur: ${res.error.message}`);

    const locsSorted = activeLocations().slice().sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999));
    const prodsSorted = activeProducts().slice().sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999));
    const locById = Object.fromEntries(locsSorted.map((l) => [l.id, l]));
    const prodById = Object.fromEntries(prodsSorted.map((p) => [p.id, p]));

    const byProd = new Map();
    const locTotals = new Map(locsSorted.map((l) => [l.id, 0]));
    for (const r of (res.data || [])) {
      const p = prodById[r.product_id]; const l = locById[r.location_id]; if (!p || !l) continue;
      const q = Number(r.qty_depose || 0);
      if (!byProd.has(p.id)) byProd.set(p.id, { product: p, perLoc: new Map(), totalQty: 0, totalCents: 0 });
      const g = byProd.get(p.id);
      g.perLoc.set(l.id, (g.perLoc.get(l.id) || 0) + q);
      g.totalQty += q;
      g.totalCents += q * Number(p.price_cents || 0);
      locTotals.set(l.id, (locTotals.get(l.id) || 0) + q);
    }

    let totalPieces = 0; let totalCents = 0;
    for (const g of byProd.values()) { totalPieces += g.totalQty; totalCents += g.totalCents; }
    byId('todayPieces').textContent = String(totalPieces);
    byId('todayEur').textContent = eur(totalCents);

    if (!locsSorted.length || !prodsSorted.length) {
      byId('todayTable').innerHTML = '<div class="muted" style="margin-top:10px;">Ajoute/active au moins 1 lieu et 1 sandwich dans Paramètres.</div>';
      return;
    }

    let html = `<table><thead><tr><th>Sandwich</th>${locsSorted.map((l) => `<th>${esc(l.name)}</th>`).join('')}<th>TOTAL</th></tr></thead><tbody>`;
    for (const p of prodsSorted) {
      const g = byProd.get(p.id); const t = g?.totalQty || 0;
      html += `<tr><td><b>${esc(p.name)}</b></td>${locsSorted.map((l) => `<td>${g?.perLoc.get(l.id) || 0}</td>`).join('')}<td><b>${t}</b></td></tr>`;
    }
    html += `</tbody><tfoot><tr><td>TOTAL</td>${locsSorted.map((l) => `<td>${locTotals.get(l.id) || 0}</td>`).join('')}<td>${totalPieces}</td></tr></tfoot></table>`;
    byId('todayTable').innerHTML = html;
  };

  const refreshTodayWithdrawSummary = async () => {
    const todayISO = byId('dayDate').value || isoDate();
    const v = await ctx.supabase.from('v_delivery_remaining').select('*');
    if (v.error) return byId('todayWithdrawSummary').textContent = `Erreur: ${v.error.message}`;
    const due = (v.data || []).filter((r) => Number(r.qty_remaining || 0) > 0 && String(r.date_retrait) <= todayISO);
    const byLoc = new Map(); let total = 0;
    const locByIdAll = Object.fromEntries(ctx.state.locations.map((l) => [l.id, l]));
    for (const r of due) { const q = Number(r.qty_remaining || 0); byLoc.set(r.location_id, (byLoc.get(r.location_id) || 0) + q); total += q; }
    const lines = [];
    for (const [locId, q] of byLoc.entries()) {
      const name = locByIdAll[locId]?.name || locId;
      const active = locByIdAll[locId]?.is_active !== false;
      lines.push(`${esc(name)} : ${q} pièce(s) ${active ? '' : '<span class="badgeOff">inactif</span>'}`);
    }
    lines.sort((a, b) => a.localeCompare(b));
    byId('todayWithdrawSummary').innerHTML = lines.length ? `${lines.join('<br>')}<br><br><b>Total à retirer: ${total} pièce(s)</b>` : 'Rien à retirer ✅';
  };

  const refreshToday = async () => { await refreshTodayProductionOnly(); await refreshTodayWithdrawSummary(); };

  safeOn(byId('todayRefresh'), 'click', refreshToday);
  safeOn(byId('gotoWithdraw'), 'click', () => {
    byId('withdrawDate').value = byId('dayDate').value || isoDate();
    ctx.goTab('withdraw');
    ctx.refreshWithdraw();
  });

  return { refreshToday };
}
