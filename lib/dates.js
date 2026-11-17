// Pure helpers, shared by server tests and the browser page.
const MONTHS = ['JAN.', 'FEB.', 'MAR.', 'APR.', 'MAY', 'JUN.', 'JUL.', 'AUG.', 'SEP.', 'OCT.', 'NOV.', 'DEC.'];
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const pad = (n) => String(n).padStart(2, '0');

export function ordinal(day) {
  if (day % 100 >= 11 && day % 100 <= 13) return 'TH';
  return { 1: 'ST', 2: 'ND', 3: 'RD' }[day % 10] ?? 'TH';
}

export function dateFields(d) {
  const day = d.getDate();
  return {
    month: MONTHS[d.getMonth()],
    day: String(day),
    sup: ordinal(day),
    weekday: DAYS[d.getDay()],
    date: `${pad(day)}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
  };
}

export function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
