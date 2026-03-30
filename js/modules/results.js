import { byId, esc, safeOn } from '../utils/dom.js';
import { eur, isoDate, addDaysISO } from '../utils/format.js';

export function createResultsModule(ctx) {
  const refreshResults = async () => {
    const from = byId('resFrom').value || addDaysISO(isoDate(), -30);
    const to = byId('resTo').value || isoDate();
    ctx.setStatus('Calcul résultats…');
    const del = await ctx.supabase.from('deliveries').select('date_fabrication,product_id,qty_depose').gte('date_fabrication', from).lte('date_fabrication', to);
    const exp = await ctx.supabase.from('expenses').select('expense_date,amount_cents,category').gte('expense_date', from).lte('expense_date', to);
    ctx.setStatus('');
    if (del.error || exp.error) return alert('Erreur chargement résultats');

    const prodByIdAll = Object.fromEntries(ctx.state.products.map((p) => [p.id, p]));
    let deliveredPieces = 0; let revenueCents = 0;
    for (const r of (del.data || [])) {
      deliveredPieces += Number(r.qty_depose || 0);
      const p = prodByIdAll[r.product_id];
      if (p) revenueCents += Number(r.qty_depose || 0) * Number(p.price_cents || 0);
    }
    let expenseCents = 0;
    const byCat = new Map();
    for (const r of (exp.data || [])) {
      const a = Number(r.amount_cents || 0);
      expenseCents += a;
      const c = String(r.category || 'Divers');
      byCat.set(c, (byCat.get(c) || 0) + a);
    }

    byId('resCA').textContent = eur(revenueCents);
    byId('resExp').textContent = eur(expenseCents);
    byId('resNet').textContent = eur(revenueCents - expenseCents);
    byId('resPieces').textContent = `${deliveredPieces} pièces livrées sur la période.`;
    const cats = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
    byId('resByCategory').innerHTML = !cats.length ? '<div class="muted">Aucune dépense sur la période.</div>'
      : `<table><thead><tr><th>Dépenses par catégorie</th><th style="text-align:right;">Total</th></tr></thead><tbody>${cats.map(([c, v]) => `<tr><td>${esc(c)}</td><td style="text-align:right;font-weight:900;">${eur(v)}</td></tr>`).join('')}</tbody></table>`;
  };

  safeOn(byId('refreshResults'), 'click', refreshResults);
  return { refreshResults };
}
