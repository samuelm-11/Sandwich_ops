import { byId, esc, safeOn } from '../utils/dom.js';
import { eur, isoDate, addDaysISO, euroStringToCents } from '../utils/format.js';

export function createExpensesModule(ctx) {
  const clearExpenseForm = () => {
    byId('expAmount').value = '';
    byId('expNote').value = '';
    byId('expReceipt').value = '';
    byId('expCategory').value = 'Parking';
    byId('expDate').value = isoDate();
  };

  const openReceipt = async (path) => {
    if (!path) return;
    const pub = ctx.supabase.storage.from('receipts').getPublicUrl(path);
    const url = pub?.data?.publicUrl;
    if (!url) return alert("Impossible d'ouvrir le scan.");
    window.open(url, '_blank');
  };

  const deleteExpense = async (id, receipt_path) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    ctx.setStatus('Suppression…');
    const del = await ctx.supabase.from('expenses').delete().eq('id', id);
    ctx.setStatus('');
    if (del.error) return alert(`Erreur: ${del.error.message}`);
    if (receipt_path) await ctx.supabase.storage.from('receipts').remove([receipt_path]);
    await refreshExpenses();
    await ctx.refreshResults();
  };

  const renderExpensesTable = (rows) => {
    if (!rows.length) return '<div class="muted">Aucune dépense sur la période.</div>';
    return `<table><thead><tr><th>Date</th><th>Catégorie</th><th>Note</th><th>Montant</th><th>Actions</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.expense_date)}</td><td>${esc(r.category)}</td><td>${r.note ? `<div>${esc(r.note)}</div>` : '<span class="muted">—</span>'}</td><td style="white-space:nowrap;font-weight:900;">${eur(r.amount_cents)}</td><td style="white-space:nowrap;">${r.receipt_path ? `<button class="mini" data-exp-view="${r.id}" type="button">Voir</button>` : '<span class="muted">—</span>'} <button class="mini" data-exp-del="${r.id}" type="button">Suppr.</button></td></tr>`).join('')}</tbody></table>`;
  };

  const refreshExpenses = async () => {
    const from = byId('expFrom').value || addDaysISO(isoDate(), -30);
    const to = byId('expTo').value || isoDate();
    ctx.setStatus('Chargement dépenses…');
    const res = await ctx.supabase.from('expenses').select('id,expense_date,amount_cents,category,note,receipt_path,created_at').gte('expense_date', from).lte('expense_date', to).order('expense_date', { ascending: false }).order('created_at', { ascending: false });
    ctx.setStatus('');
    if (res.error) return alert(`Erreur: ${res.error.message}`);
    const rows = res.data || [];
    byId('expTotal').textContent = eur(rows.reduce((sum, r) => sum + Number(r.amount_cents || 0), 0));
    byId('expList').innerHTML = renderExpensesTable(rows);
    for (const r of rows) {
      const d = document.querySelector(`[data-exp-del="${r.id}"]`);
      const v = document.querySelector(`[data-exp-view="${r.id}"]`);
      if (d) d.onclick = () => deleteExpense(r.id, r.receipt_path);
      if (v) v.onclick = () => openReceipt(r.receipt_path);
    }
  };

  const addExpenseFromForm = async () => {
    const expense_date = byId('expDate').value || isoDate();
    const amount_cents = euroStringToCents(byId('expAmount').value);
    const category = (byId('expCategory').value || '').trim();
    const note = (byId('expNote').value || '').trim() || null;
    const file = byId('expReceipt').files?.[0] || null;
    if (!amount_cents || amount_cents <= 0) return alert('Montant invalide.');

    byId('addExpenseBtn').disabled = true;
    ctx.setStatus('Ajout dépense…');
    let receipt_path = null;
    if (file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'jpg';
      receipt_path = `receipts/${expense_date}/${crypto.randomUUID()}.${ext}`;
      const up = await ctx.supabase.storage.from('receipts').upload(receipt_path, file, { upsert: false });
      if (up.error) {
        byId('addExpenseBtn').disabled = false; ctx.setStatus(''); return alert(`Erreur upload: ${up.error.message}`);
      }
    }
    const ins = await ctx.supabase.from('expenses').insert({ expense_date, amount_cents, category, note, receipt_path });
    byId('addExpenseBtn').disabled = false;
    ctx.setStatus('');
    if (ins.error) return alert(`Erreur dépense: ${ins.error.message}`);
    alert('Dépense ajoutée ✅');
    byId('expAmount').value = ''; byId('expNote').value = ''; byId('expReceipt').value = '';
    await refreshExpenses();
    await ctx.refreshResults();
  };

  safeOn(byId('refreshExpenses'), 'click', refreshExpenses);
  safeOn(byId('addExpenseBtn'), 'click', addExpenseFromForm);
  safeOn(byId('clearExpenseFormBtn'), 'click', clearExpenseForm);

  return { refreshExpenses };
}
