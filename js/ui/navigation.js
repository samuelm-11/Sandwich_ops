import { safeOn } from '../utils/dom.js';

export function createNavigation({ titleEl, drawerEl, overlayEl, sections, onTabChange }) {
  const navItems = Array.from(document.querySelectorAll('.navitem[data-tab]'));

  const lockScroll = (on) => {
    document.body.style.overflow = on ? 'hidden' : '';
    document.documentElement.style.overflow = on ? 'hidden' : '';
  };

  const openDrawer = () => {
    drawerEl?.classList.add('open');
    overlayEl?.classList.add('open');
    lockScroll(true);
  };

  const closeDrawer = () => {
    drawerEl?.classList.remove('open');
    overlayEl?.classList.remove('open');
    lockScroll(false);
  };

  const tabTitles = {
    today: "Aujourd'hui",
    delivery: 'Livraison',
    withdraw: 'À retirer',
    history: 'Historique',
    expenses: 'Dépenses',
    results: 'Résultats',
    settings: 'Paramètres',
    shiftkm: 'KM & Shifts',
  };

  const goTab = (tab) => {
    closeDrawer();
    navItems.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    Object.entries(sections).forEach(([k, sec]) => sec?.classList.toggle('active', k === tab));
    if (titleEl) titleEl.textContent = tabTitles[tab] || tab;
    onTabChange?.(tab);
  };

  safeOn(document.getElementById('openDrawer'), 'click', openDrawer);
  safeOn(document.getElementById('closeDrawer'), 'click', closeDrawer);
  safeOn(overlayEl, 'click', closeDrawer);
  navItems.forEach((b) => safeOn(b, 'click', () => goTab(b.dataset.tab)));

  return { goTab, openDrawer, closeDrawer };
}
