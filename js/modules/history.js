import { byId, esc, safeOn } from '../utils/dom.js';
import { eur, isoDate, addDaysISO } from '../utils/format.js';

export function createHistoryModule(ctx) {
  const refreshHistory = async () => {
    const from = byId('histFrom').value || addDaysISO(isoDate(), -30);
    const to = byId('histTo').value || isoDate();
    ctx.setStatus('Chargement historique…');
    const del = await ctx.supabase.from('deliveries').select('date_fabrication, product_id, qty_depose').gte('date_fabrication', from).lte('date_fabrication', to);
    const wit = await ctx.supabase.from('withdrawals').select('date_retrait_effectif, qty_retire').gte('date_retrait_effectif', from).lte('date_retrait_effectif', to);
    ctx.setStatus('');
    if (del.error) return alert(`Erreur deliveries: ${del.error.message}`);
    if (wit.error) return alert(`Erreur withdrawals: ${wit.error.message}`);

    const prodByIdAll = Object.fromEntries(ctx.state.products.map((p) => [p.id, p]));
    let deliveredPieces = 0; let revenueCents = 0;
    for (const r of (del.data || [])) {
      deliveredPieces += Number(r.qty_depose || 0);
      const p = prodByIdAll[r.product_id];
      if (p) revenueCents += Number(r.qty_depose || 0) * Number(p.price_cents || 0);
    }

    let withdrawnPieces = 0;
    for (const r of (wit.data || [])) withdrawnPieces += Number(r.qty_retire || 0);
    byId('histDelivered').textContent = String(deliveredPieces);
    byId('histWithdrawn').textContent = String(withdrawnPieces);
    byId('histRevenue').textContent = eur(revenueCents);

    const byDate = new Map();
    for (const r of (del.data || [])) {
      if (!byDate.has(r.date_fabrication)) byDate.set(r.date_fabrication, { pieces: 0, cents: 0 });
      const p = prodByIdAll[r.product_id];
      byDate.get(r.date_fabrication).pieces += Number(r.qty_depose || 0);
      if (p) byDate.get(r.date_fabrication).cents += Number(r.qty_depose || 0) * Number(p.price_cents || 0);
    }

    const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a)).slice(0, 12);
    let html = '';
    for (const d of dates) {
      const x = byDate.get(d);
      html += `<div class="row"><div><div class="name">${esc(d)}</div><div class="sub">${x.pieces} pièces</div></div><div style="font-weight:900;">${eur(x.cents)}</div></div>`;
    }
    byId('histList').innerHTML = html || '<div class="muted">Aucune donnée sur cette période.</div>';
  };

  safeOn(byId('refreshHist'), 'click', refreshHistory);
  return { refreshHistory };
}
