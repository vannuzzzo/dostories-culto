import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordinal, dateFields, slug } from '../lib/dates.js';

test('ordinal', () => {
  const exp = { 1: 'ST', 2: 'ND', 3: 'RD', 4: 'TH', 11: 'TH', 12: 'TH', 13: 'TH', 21: 'ST', 22: 'ND', 23: 'RD', 30: 'TH', 31: 'ST' };
  for (const [d, s] of Object.entries(exp)) assert.equal(ordinal(+d), s, `day ${d}`);
});

test('dateFields', () => {
  assert.deepEqual(dateFields(new Date(2026, 10, 19)),
    { month: 'NOV.', day: '19', sup: 'TH', weekday: 'THURSDAY', date: '19.11.2026' });
  assert.equal(dateFields(new Date(2026, 4, 1)).month, 'MAY');
  assert.equal(dateFields(new Date(2026, 4, 1)).date, '01.05.2026');
});

test('slug', () => assert.equal(slug('Giovedì MAISON 3!'), 'giovedi-maison-3'));
