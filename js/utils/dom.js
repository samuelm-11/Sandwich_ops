export const byId = (id) => document.getElementById(id);

export const safeOn = (element, event, handler, options) => {
  if (!element || typeof handler !== 'function') return false;
  element.addEventListener(event, handler, options);
  return true;
};

export const setText = (element, text = '') => {
  if (element) element.textContent = text;
};

export const setHtml = (element, html = '') => {
  if (element) element.innerHTML = html;
};

export const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');
