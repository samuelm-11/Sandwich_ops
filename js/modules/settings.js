import { byId, esc, safeOn } from '../utils/dom.js';
import { eur, toInt, euroStringToCents } from '../utils/format.js';

export function createSettingsModule(ctx) {
  const saveSettingsLocal = () => {
    const s = { dlc: Number(byId('setDlc').value || 2), withdrawJ: Number(byId('setWithdrawJ').value || 3) };
    localStorage.setItem('sandops:settings', JSON.stringify(s));
    alert('Paramètres sauvegardés ✅');
  };

  const addLocation = async () => {
    const name = byId('newLocName').value.trim();
    const sort = toInt(byId('newLocSort').value, 9999);
    if (!name) return alert('Nom du lieu obligatoire.');
    ctx.setStatus('Ajout lieu…');
    const res = await ctx.supabase.from('locations').insert({ name, sort_order: sort, is_active: true });
    ctx.setStatus('');
    if (res.error) return alert(`Erreur: ${res.error.message}`);
    byId('newLocName').value = ''; byId('newLocSort').value = '';
    alert('Lieu ajouté ✅');
    await ctx.reloadAllData();
  };

  const addProduct = async () => {
    const name = byId('newProdName').value.trim();
    const price_cents = euroStringToCents(byId('newProdPrice').value);
    const sort = toInt(byId('newProdSort').value, 9999);
    if (!name) return alert('Nom du sandwich obligatoire.');
    if (price_cents === null) return alert('Prix invalide.');
    ctx.setStatus('Ajout sandwich…');
    const res = await ctx.supabase.from('products').insert({ name, price_cents, sort_order: sort, is_active: true });
    ctx.setStatus('');
    if (res.error) return alert(`Erreur: ${res.error.message}`);
    byId('newProdName').value = ''; byId('newProdPrice').value = ''; byId('newProdSort').value = '';
    alert('Sandwich ajouté ✅');
    await ctx.reloadAllData();
  };

  const setLocationActive = async (id, is_active) => {
    ctx.setStatus('Mise à jour…');
    const res = await ctx.supabase.from('locations').update({ is_active }).eq('id', id);
    ctx.setStatus('');
    if (res.error) return alert(`Erreur: ${res.error.message}`);
    await ctx.reloadAllData();
  };
  const setProductActive = async (id, is_active) => {
    ctx.setStatus('Mise à jour…');
    const res = await ctx.supabase.from('products').update({ is_active }).eq('id', id);
    ctx.setStatus('');
    if (res.error) return alert(`Erreur: ${res.error.message}`);
    await ctx.reloadAllData();
  };

  const updateLocation = async (id) => {
    const name = byId(`locName:${id}`).value.trim();
    const sort = toInt(byId(`locSort:${id}`).value, 9999);
    if (!name) return alert('Nom obligatoire.');
    ctx.setStatus('Sauvegarde…');
    const res = await ctx.supabase.from('locations').update({ name, sort_order: sort }).eq('id', id);
    ctx.setStatus('');
    if (res.error) return alert(`Erreur: ${res.error.message}`);
    await ctx.reloadAllData();
  };

  const updateProduct = async (id) => {
    const name = byId(`prodName:${id}`).value.trim();
    const sort = toInt(byId(`prodSort:${id}`).value, 9999);
    const price_cents = euroStringToCents(byId(`prodPrice:${id}`).value);
    if (!name) return alert('Nom obligatoire.');
    if (price_cents === null) return alert('Prix invalide.');
    ctx.setStatus('Sauvegarde…');
    const res = await ctx.supabase.from('products').update({ name, sort_order: sort, price_cents }).eq('id', id);
    ctx.setStatus('');
    if (res.error) return alert(`Erreur: ${res.error.message}`);
    await ctx.reloadAllData();
  };

  const refreshSettingsLists = async () => {
    const locHtml = ctx.state.locations.length
      ? ctx.state.locations.slice().sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999)).map((l) => `<div class="card" style="margin-top:10px;"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><div style="font-weight:900;">${esc(l.name)}</div>${l.is_active ? '' : ' <span class="badgeOff">inactif</span>'}<div style="flex:1;"></div><button class="mini" type="button" data-action="toggleLoc" data-id="${l.id}" data-active="${l.is_active ? '1' : '0'}">${l.is_active ? 'Désactiver' : 'Activer'}</button></div><div class="spacer"></div><div class="grid2"><input id="locName:${l.id}" type="text" value="${esc(l.name)}" /><input id="locSort:${l.id}" type="number" value="${toInt(l.sort_order, 9999)}" /></div><button class="cta" type="button" data-action="saveLoc" data-id="${l.id}">Sauvegarder</button></div>`).join('')
      : '<div class="muted">Aucun lieu.</div>';
    const prodHtml = ctx.state.products.length
      ? ctx.state.products.slice().sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999)).map((p) => `<div class="card" style="margin-top:10px;"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><div style="font-weight:900;">${esc(p.name)}</div>${p.is_active ? '' : ' <span class="badgeOff">inactif</span>'}<div class="muted">— <b>${eur(p.price_cents)}</b></div><div style="flex:1;"></div><button class="mini" type="button" data-action="toggleProd" data-id="${p.id}" data-active="${p.is_active ? '1' : '0'}">${p.is_active ? 'Désactiver' : 'Activer'}</button></div><div class="spacer"></div><div class="grid2"><input id="prodName:${p.id}" type="text" value="${esc(p.name)}" /><input id="prodPrice:${p.id}" type="text" value="${(Number(p.price_cents || 0) / 100).toFixed(2).replace('.', ',')}" /></div><div class="spacer"></div><input id="prodSort:${p.id}" type="number" value="${toInt(p.sort_order, 9999)}" /><button class="cta" type="button" data-action="saveProd" data-id="${p.id}">Sauvegarder</button></div>`).join('')
      : '<div class="muted">Aucun sandwich.</div>';

    byId('settingsLocList').innerHTML = locHtml;
    byId('settingsProdList').innerHTML = prodHtml;

    byId('settingsLocList').querySelectorAll('[data-action]').forEach((btn) => {
      btn.onclick = async () => {
        const { action, id, active } = btn.dataset;
        if (action === 'toggleLoc') await setLocationActive(id, active !== '1');
        if (action === 'saveLoc') await updateLocation(id);
      };
    });
    byId('settingsProdList').querySelectorAll('[data-action]').forEach((btn) => {
      btn.onclick = async () => {
        const { action, id, active } = btn.dataset;
        if (action === 'toggleProd') await setProductActive(id, active !== '1');
        if (action === 'saveProd') await updateProduct(id);
      };
    });
  };

  safeOn(byId('saveSettings'), 'click', saveSettingsLocal);
  safeOn(byId('btnAddLoc'), 'click', addLocation);
  safeOn(byId('btnAddProd'), 'click', addProduct);
  safeOn(byId('btnReloadAll'), 'click', async () => ctx.reloadAllData());

  return { refreshSettingsLists, saveSettingsLocal };
}
