import { byId, esc, safeOn } from '../utils/dom.js';
import { isoDate, addDaysISO, toInt } from '../utils/format.js';

const STORAGE_KEY = 'sandops:stock:v1';

const moveTypes = {
  depot: 'Dépôt',
  transfert_sortie: 'Transfert sortie',
  transfert_entree: 'Transfert entrée',
  retrait: 'Retrait',
  correction: 'Correction',
};

const generateId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeDate = (value) => {
  if (!value) return isoDate();
  return String(value).slice(0, 10);
};

const parseStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lots: [], movements: [] };
    const parsed = JSON.parse(raw);
    return {
      lots: Array.isArray(parsed.lots) ? parsed.lots : [],
      movements: Array.isArray(parsed.movements) ? parsed.movements : [],
    };
  } catch {
    return { lots: [], movements: [] };
  }
};

const saveStorage = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const lotPriority = (lot, today) => {
  if (lot.qty_restante <= 0) return { label: 'épuisé', cls: 'badge-muted' };
  if (lot.date_retrait_prevue < today) return { label: 'retard', cls: 'badge-danger' };
  if (lot.date_retrait_prevue === today) return { label: "à retirer aujourd'hui", cls: 'badge-danger' };
  if (lot.date_retrait_prevue === addDaysISO(today, 1)) return { label: 'à retirer demain', cls: 'badge-warn' };
  return { label: 'ok', cls: 'badge-ok' };
};

const lotAgeBadge = (dateFab, today) => {
  if (dateFab === today) return { label: "aujourd'hui", cls: 'badge-ok' };
  if (dateFab === addDaysISO(today, -1)) return { label: 'hier', cls: 'badge-warn' };
  if (dateFab < addDaysISO(today, -1)) return { label: 'ancien', cls: 'badge-danger' };
  return { label: dateFab, cls: 'badge-muted' };
};

export function createStockModule(ctx) {
  const db = parseStorage();

  const getDlcDays = () => {
    const settings = ctx.loadSettings();
    const dlc = Number(settings.dlc || 2);
    return Number.isFinite(dlc) && dlc > 0 ? dlc : 2;
  };

  const getRefs = () => ({
    prodById: Object.fromEntries(ctx.state.products.map((p) => [p.id, p])),
    locById: Object.fromEntries(ctx.state.locations.map((l) => [l.id, l])),
  });

  const getOpenLots = () => db.lots.filter((lot) => Number(lot.qty_restante || 0) > 0);

  const recomputeLotStatus = (lot) => {
    if (Number(lot.qty_restante || 0) <= 0) return 'épuisé';
    if (lot.status === 'retiré') return 'retiré';
    return lot.status === 'transféré_partiel' ? 'transféré_partiel' : 'actif';
  };

  const logMovement = (movement) => {
    db.movements.unshift({ id: generateId('mov'), ...movement });
  };

  const renderLotOptions = () => {
    const sourceLoc = byId('transferSource')?.value || '';
    const productId = byId('transferProduct')?.value || '';
    const list = byId('transferLotSource');
    if (!list) return;
    const { prodById } = getRefs();
    const sourceLots = getOpenLots()
      .filter((lot) => (!sourceLoc || lot.lieu_id === sourceLoc) && (!productId || lot.produit_id === productId))
      .sort((a, b) => String(a.date_fabrication).localeCompare(String(b.date_fabrication)));

    list.innerHTML = '<option value="">Choisir un lot source</option>' + sourceLots.map((lot) => {
      const p = prodById[lot.produit_id];
      return `<option value="${lot.id}">${esc(p?.name || lot.produit_id)} · Fab ${lot.date_fabrication} · reste ${lot.qty_restante}</option>`;
    }).join('');
  };

  const populateSelects = () => {
    const activeLocs = ctx.state.locations.filter((l) => l.is_active)
      .sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999));
    const activeProds = ctx.state.products.filter((p) => p.is_active)
      .sort((a, b) => toInt(a.sort_order, 9999) - toInt(b.sort_order, 9999));

    const locOptions = '<option value="">Tous</option>' + activeLocs.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
    const prodOptions = '<option value="">Tous</option>' + activeProds.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    const reqLocOptions = '<option value="">Choisir un lieu</option>' + activeLocs.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
    const reqProdOptions = '<option value="">Choisir un sandwich</option>' + activeProds.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');

    byId('stockFilterLocation').innerHTML = locOptions;
    byId('stockFilterProduct').innerHTML = prodOptions;
    byId('depositLocation').innerHTML = reqLocOptions;
    byId('depositProduct').innerHTML = reqProdOptions;
    byId('transferSource').innerHTML = reqLocOptions;
    byId('transferDestination').innerHTML = reqLocOptions;
    byId('transferProduct').innerHTML = reqProdOptions;
    byId('withdrawLocation').innerHTML = reqLocOptions;
    byId('withdrawProduct').innerHTML = reqProdOptions;

    renderLotOptions();
    renderWithdrawLotOptions();
  };

  const aggregateCurrentStock = () => {
    const locFilter = byId('stockFilterLocation')?.value || '';
    const prodFilter = byId('stockFilterProduct')?.value || '';
    const { prodById, locById } = getRefs();
    const grouped = new Map();
    getOpenLots().forEach((lot) => {
      if (locFilter && lot.lieu_id !== locFilter) return;
      if (prodFilter && lot.produit_id !== prodFilter) return;
      const loc = locById[lot.lieu_id];
      const prod = prodById[lot.produit_id];
      if (!loc || !prod) return;
      const key = `${lot.lieu_id}::${lot.produit_id}::${lot.date_fabrication}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          lieu_id: lot.lieu_id,
          produit_id: lot.produit_id,
          date_fabrication: lot.date_fabrication,
          qty: 0,
          location: loc,
          product: prod,
        });
      }
      grouped.get(key).qty += Number(lot.qty_restante || 0);
    });

    return [...grouped.values()].sort((a, b) =>
      toInt(a.location.sort_order, 9999) - toInt(b.location.sort_order, 9999)
      || toInt(a.product.sort_order, 9999) - toInt(b.product.sort_order, 9999)
      || String(a.date_fabrication).localeCompare(String(b.date_fabrication))
    );
  };

  const renderCurrentStock = () => {
    const mount = byId('stockCurrentList');
    if (!mount) return;
    const today = byId('stockDateRef')?.value || isoDate();
    const rows = aggregateCurrentStock();
    if (!rows.length) {
      mount.innerHTML = '<div class="muted">Aucun stock réel en cours.</div>';
      return;
    }

    const byLoc = new Map();
    rows.forEach((row) => {
      const key = row.lieu_id;
      if (!byLoc.has(key)) byLoc.set(key, { loc: row.location, byProd: new Map() });
      const box = byLoc.get(key);
      if (!box.byProd.has(row.produit_id)) box.byProd.set(row.produit_id, { product: row.product, ages: [] });
      box.byProd.get(row.produit_id).ages.push(row);
    });

    let html = '';
    for (const { loc, byProd } of byLoc.values()) {
      html += `<div class="card"><div style="font-weight:900;">${esc(loc.name)}</div>`;
      for (const { product, ages } of byProd.values()) {
        const chunks = ages.map((a) => `${a.qty} du ${a.date_fabrication}`).join(', ');
        html += `<div class="row"><div><div class="name">${esc(product.name)}</div><div class="sub">${chunks}</div></div></div>`;
      }
      html += '</div>';
    }
    mount.innerHTML = html;

    renderWithdrawDue();
  };

  const renderWithdrawDue = () => {
    const mount = byId('stockDueList');
    if (!mount) return;
    const today = byId('stockDateRef')?.value || isoDate();
    const tomorrow = addDaysISO(today, 1);
    const { prodById, locById } = getRefs();

    const dueRows = getOpenLots().map((lot) => ({
      lot,
      product: prodById[lot.produit_id],
      location: locById[lot.lieu_id],
      prio: lotPriority(lot, today),
    })).filter((x) => x.product && x.location)
      .sort((a, b) => String(a.lot.date_retrait_prevue).localeCompare(String(b.lot.date_retrait_prevue)));

    const late = dueRows.filter((x) => x.lot.date_retrait_prevue < today);
    const dueToday = dueRows.filter((x) => x.lot.date_retrait_prevue === today);
    const dueTomorrow = dueRows.filter((x) => x.lot.date_retrait_prevue === tomorrow);

    const block = (title, items) => {
      if (!items.length) return `<div class="muted">${title}: rien.</div>`;
      return `<div style="font-weight:900; margin-top:10px;">${title}</div>${items.map((x) => {
        const age = lotAgeBadge(x.lot.date_fabrication, today);
        return `<div class="row"><div><div class="name">${esc(x.location.name)} · ${esc(x.product.name)}</div><div class="sub">Fab ${x.lot.date_fabrication} · reste ${x.lot.qty_restante}</div></div><div><span class="badge ${x.prio.cls}">${x.prio.label}</span> <span class="badge ${age.cls}">${age.label}</span></div></div>`;
      }).join('')}`;
    };

    mount.innerHTML = block('Déjà en retard', late) + block("À retirer aujourd'hui", dueToday) + block('À retirer demain', dueTomorrow);
  };

  const createDeposit = () => {
    const lieu = byId('depositLocation').value;
    const produit = byId('depositProduct').value;
    const qty = Number(byId('depositQty').value || 0);
    const fab = normalizeDate(byId('depositFabDate').value || isoDate());
    if (!lieu || !produit || qty <= 0) return alert('Dépôt invalide.');

    const retrait = addDaysISO(fab, getDlcDays());
    const lot = {
      id: generateId('lot'),
      lieu_id: lieu,
      produit_id: produit,
      date_fabrication: fab,
      date_retrait_prevue: retrait,
      qty_initiale: qty,
      qty_restante: qty,
      statut: 'actif',
      created_at: new Date().toISOString(),
    };
    db.lots.unshift(lot);
    logMovement({
      type: 'depot',
      produit_id: produit,
      quantite: qty,
      date_mouvement: new Date().toISOString(),
      lieu_source_id: null,
      lieu_destination_id: lieu,
      date_fabrication_origine: fab,
      lot_source_id: lot.id,
      note: byId('depositNote').value?.trim() || null,
    });
    saveStorage(db);
    byId('depositQty').value = '';
    byId('depositNote').value = '';
    renderLotOptions();
    renderWithdrawLotOptions();
    refreshAll();
  };

  const findOrCreateDestinationLot = ({ destinationId, productId, fabDate }) => {
    const existing = db.lots.find((lot) =>
      lot.lieu_id === destinationId
      && lot.produit_id === productId
      && lot.date_fabrication === fabDate
      && Number(lot.qty_restante || 0) > 0
      && lot.statut !== 'retiré'
    );
    if (existing) return existing;
    const newLot = {
      id: generateId('lot'),
      lieu_id: destinationId,
      produit_id: productId,
      date_fabrication: fabDate,
      date_retrait_prevue: addDaysISO(fabDate, getDlcDays()),
      qty_initiale: 0,
      qty_restante: 0,
      statut: 'actif',
      created_at: new Date().toISOString(),
    };
    db.lots.unshift(newLot);
    return newLot;
  };

  const applyTransfer = () => {
    const sourceLotId = byId('transferLotSource').value;
    const destinationId = byId('transferDestination').value;
    const qty = Number(byId('transferQty').value || 0);
    if (!sourceLotId || !destinationId || qty <= 0) return alert('Transfert invalide.');

    const sourceLot = db.lots.find((lot) => lot.id === sourceLotId);
    if (!sourceLot) return alert('Lot source introuvable.');
    if (sourceLot.lieu_id === destinationId) return alert('Lieu source et destination identiques.');
    if (qty > Number(sourceLot.qty_restante || 0)) return alert('Quantité > stock restant.');

    sourceLot.qty_restante -= qty;
    sourceLot.statut = sourceLot.qty_restante <= 0 ? 'épuisé' : 'transféré_partiel';

    const destinationLot = findOrCreateDestinationLot({
      destinationId,
      productId: sourceLot.produit_id,
      fabDate: sourceLot.date_fabrication,
    });
    destinationLot.qty_initiale += qty;
    destinationLot.qty_restante += qty;
    destinationLot.statut = recomputeLotStatus(destinationLot);

    logMovement({
      type: 'transfert_sortie',
      produit_id: sourceLot.produit_id,
      quantite: qty,
      date_mouvement: new Date().toISOString(),
      lieu_source_id: sourceLot.lieu_id,
      lieu_destination_id: destinationId,
      date_fabrication_origine: sourceLot.date_fabrication,
      lot_source_id: sourceLot.id,
      note: byId('transferNote').value?.trim() || null,
    });
    logMovement({
      type: 'transfert_entree',
      produit_id: sourceLot.produit_id,
      quantite: qty,
      date_mouvement: new Date().toISOString(),
      lieu_source_id: sourceLot.lieu_id,
      lieu_destination_id: destinationId,
      date_fabrication_origine: sourceLot.date_fabrication,
      lot_source_id: destinationLot.id,
      note: byId('transferNote').value?.trim() || null,
    });

    saveStorage(db);
    byId('transferQty').value = '';
    byId('transferNote').value = '';
    renderLotOptions();
    renderWithdrawLotOptions();
    refreshAll();
  };

  const renderWithdrawLotOptions = () => {
    const locId = byId('withdrawLocation')?.value || '';
    const prodId = byId('withdrawProduct')?.value || '';
    const list = byId('withdrawLot');
    if (!list) return;
    const { prodById } = getRefs();
    const sourceLots = getOpenLots()
      .filter((lot) => (!locId || lot.lieu_id === locId) && (!prodId || lot.produit_id === prodId))
      .sort((a, b) => String(a.date_fabrication).localeCompare(String(b.date_fabrication)));

    list.innerHTML = '<option value="">Choisir un lot</option>' + sourceLots.map((lot) => {
      const p = prodById[lot.produit_id];
      return `<option value="${lot.id}">${esc(p?.name || lot.produit_id)} · Fab ${lot.date_fabrication} · reste ${lot.qty_restante}</option>`;
    }).join('');
  };

  const applyWithdraw = () => {
    const lotId = byId('withdrawLot').value;
    const qty = Number(byId('withdrawQty').value || 0);
    if (!lotId || qty <= 0) return alert('Retrait invalide.');
    const lot = db.lots.find((x) => x.id === lotId);
    if (!lot) return alert('Lot introuvable.');
    if (qty > Number(lot.qty_restante || 0)) return alert('Quantité > stock restant.');

    lot.qty_restante -= qty;
    lot.statut = lot.qty_restante <= 0 ? 'retiré' : 'actif';

    logMovement({
      type: 'retrait',
      produit_id: lot.produit_id,
      quantite: qty,
      date_mouvement: new Date().toISOString(),
      lieu_source_id: lot.lieu_id,
      lieu_destination_id: null,
      date_fabrication_origine: lot.date_fabrication,
      lot_source_id: lot.id,
      note: byId('withdrawNote').value?.trim() || null,
    });

    saveStorage(db);
    byId('withdrawQty').value = '';
    byId('withdrawNote').value = '';
    renderLotOptions();
    renderWithdrawLotOptions();
    refreshAll();
  };

  const renderMovements = () => {
    const mount = byId('stockMovements');
    if (!mount) return;
    const { prodById, locById } = getRefs();
    const rows = db.movements.slice(0, 40);
    if (!rows.length) return mount.innerHTML = '<div class="muted">Aucun mouvement.</div>';

    mount.innerHTML = rows.map((m) => {
      const p = prodById[m.produit_id];
      const src = m.lieu_source_id ? (locById[m.lieu_source_id]?.name || m.lieu_source_id) : '—';
      const dst = m.lieu_destination_id ? (locById[m.lieu_destination_id]?.name || m.lieu_destination_id) : '—';
      const date = String(m.date_mouvement || '').replace('T', ' ').slice(0, 16);
      return `<div class="row"><div><div class="name">${moveTypes[m.type] || m.type} · ${esc(p?.name || m.produit_id)}</div><div class="sub">${date} · Fab ${m.date_fabrication_origine} · ${src} → ${dst}</div>${m.note ? `<div class="sub">Note: ${esc(m.note)}</div>` : ''}</div><div style="font-weight:900;">${m.quantite}</div></div>`;
    }).join('');
  };

  const seedDemoData = () => {
    if (db.lots.length && !confirm('Remplacer le stock local actuel par les données de démonstration ?')) return;
    const today = isoDate();
    const d1 = addDaysISO(today, -1);
    const d2 = today;
    const d3 = addDaysISO(today, -2);

    const locs = ctx.state.locations;
    const prods = ctx.state.products;
    const bierset = locs.find((l) => l.name.toLowerCase().includes('bierset'))?.id || locs[0]?.id;
    const avia = locs.find((l) => l.name.toLowerCase().includes('avia'))?.id || locs[1]?.id || locs[0]?.id;
    const swiss = locs.find((l) => l.name.toLowerCase().includes('swiss'))?.id || locs[2]?.id || locs[0]?.id;
    const thon = prods.find((p) => p.name.toLowerCase().includes('thon'))?.id || prods[0]?.id;
    const dago = prods.find((p) => p.name.toLowerCase().includes('dago'))?.id || prods[1]?.id || prods[0]?.id;

    if (!bierset || !avia || !swiss || !thon || !dago) return alert('Crée/active au moins 3 lieux et 2 sandwichs pour le jeu de démo.');

    db.lots.length = 0;
    db.movements.length = 0;

    const addDemoLot = (lieu, produit, fab, qty, statut = 'actif') => {
      const lot = {
        id: generateId('lot'),
        lieu_id: lieu,
        produit_id: produit,
        date_fabrication: fab,
        date_retrait_prevue: addDaysISO(fab, getDlcDays()),
        qty_initiale: qty,
        qty_restante: qty,
        statut,
        created_at: new Date().toISOString(),
      };
      db.lots.push(lot);
      return lot;
    };

    const lot1 = addDemoLot(bierset, thon, d1, 2);
    const lot2 = addDemoLot(bierset, thon, d2, 1);
    const lot3 = addDemoLot(bierset, dago, d2, 3);
    const lot4 = addDemoLot(avia, thon, d3, 4);
    const lot5 = addDemoLot(swiss, dago, d1, 2);

    [lot1, lot2, lot3, lot4, lot5].forEach((lot) => {
      logMovement({
        type: 'depot',
        produit_id: lot.produit_id,
        quantite: lot.qty_initiale,
        date_mouvement: lot.created_at,
        lieu_source_id: null,
        lieu_destination_id: lot.lieu_id,
        date_fabrication_origine: lot.date_fabrication,
        lot_source_id: lot.id,
        note: 'seed',
      });
    });

    saveStorage(db);
    renderLotOptions();
    renderWithdrawLotOptions();
    refreshAll();
  };

  const importFromSupabase = async () => {
    ctx.setStatus('Import lots/mouvements depuis Supabase…');
    const [deliveries, withdrawals] = await Promise.all([
      ctx.supabase.from('deliveries').select('id,date_fabrication,date_retrait,location_id,product_id,qty_depose').order('date_fabrication', { ascending: false }),
      ctx.supabase.from('withdrawals').select('delivery_id,qty_retire,date_retrait_effectif'),
    ]);
    ctx.setStatus('');
    if (deliveries.error || withdrawals.error) {
      return alert(`Import impossible: ${deliveries.error?.message || withdrawals.error?.message}`);
    }

    const withdrawByDelivery = new Map();
    (withdrawals.data || []).forEach((w) => {
      withdrawByDelivery.set(w.delivery_id, (withdrawByDelivery.get(w.delivery_id) || 0) + Number(w.qty_retire || 0));
    });

    db.lots.length = 0;
    db.movements.length = 0;
    for (const d of (deliveries.data || [])) {
      const withdrew = withdrawByDelivery.get(d.id) || 0;
      const restante = Math.max(0, Number(d.qty_depose || 0) - withdrew);
      const lot = {
        id: `lot_${d.id}`,
        lieu_id: d.location_id,
        produit_id: d.product_id,
        date_fabrication: normalizeDate(d.date_fabrication),
        date_retrait_prevue: normalizeDate(d.date_retrait || addDaysISO(d.date_fabrication, getDlcDays())),
        qty_initiale: Number(d.qty_depose || 0),
        qty_restante: restante,
        statut: restante <= 0 ? 'épuisé' : 'actif',
        created_at: new Date().toISOString(),
      };
      db.lots.push(lot);
      logMovement({
        type: 'depot',
        produit_id: lot.produit_id,
        quantite: lot.qty_initiale,
        date_mouvement: `${lot.date_fabrication}T07:00:00`,
        lieu_source_id: null,
        lieu_destination_id: lot.lieu_id,
        date_fabrication_origine: lot.date_fabrication,
        lot_source_id: lot.id,
        note: 'import deliveries',
      });
      if (withdrew > 0) {
        logMovement({
          type: 'retrait',
          produit_id: lot.produit_id,
          quantite: withdrew,
          date_mouvement: `${normalizeDate(d.date_retrait)}T12:00:00`,
          lieu_source_id: lot.lieu_id,
          lieu_destination_id: null,
          date_fabrication_origine: lot.date_fabrication,
          lot_source_id: lot.id,
          note: 'import withdrawals',
        });
      }
    }

    saveStorage(db);
    renderLotOptions();
    renderWithdrawLotOptions();
    refreshAll();
    alert('Import terminé ✅');
  };

  const refreshAll = () => {
    renderCurrentStock();
    renderWithdrawDue();
    renderMovements();
  };

  const init = () => {
    if (byId('stockDateRef')) byId('stockDateRef').value = isoDate();
    if (byId('depositFabDate')) byId('depositFabDate').value = isoDate();
    populateSelects();
    refreshAll();
  };

  safeOn(byId('stockFilterLocation'), 'change', renderCurrentStock);
  safeOn(byId('stockFilterProduct'), 'change', renderCurrentStock);
  safeOn(byId('stockDateRef'), 'change', refreshAll);

  safeOn(byId('depositBtn'), 'click', createDeposit);
  safeOn(byId('transferBtn'), 'click', applyTransfer);
  safeOn(byId('withdrawActionBtn'), 'click', applyWithdraw);
  safeOn(byId('stockSeedBtn'), 'click', seedDemoData);
  safeOn(byId('stockImportBtn'), 'click', importFromSupabase);

  safeOn(byId('transferSource'), 'change', renderLotOptions);
  safeOn(byId('transferProduct'), 'change', renderLotOptions);
  safeOn(byId('withdrawLocation'), 'change', renderWithdrawLotOptions);
  safeOn(byId('withdrawProduct'), 'change', renderWithdrawLotOptions);

  return { init, refreshAll, populateSelects };
}
