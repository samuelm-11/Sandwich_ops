export const eur = (cents) => `${(Number(cents || 0) / 100).toFixed(2).replace('.', ',')}€`;

export const isoDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const isoDateTimeLocal = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const addDaysISO = (baseISO, days) => {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

export const toInt = (value, def = 0) => {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : def;
};

export const euroStringToCents = (value) => {
  const n = Number(String(value ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
};

export const formatHoursFromMinutes = (minutes) => `${(minutes / 60).toFixed(1).replace('.', ',')} h`;
