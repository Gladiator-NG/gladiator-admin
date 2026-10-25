import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/rentalEndDate.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { rentalEndDate } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('12-hour route departing at 15:30 ends the next day, including buffer', () => {
  assert.equal(rentalEndDate('2026-10-25', '15:30', 12, 'outbound'), '2026-10-26');
});
test('short daytime routes keep their date', () => {
  assert.equal(rentalEndDate('2026-10-25', '15:30', 1, 'return'), '2026-10-25');
});
test('midnight, month/year rollover and multiple days retain the full duration', () => {
  assert.equal(rentalEndDate('2026-12-31', '22:00', 1, 'outbound'), '2027-01-01');
  assert.equal(rentalEndDate('2026-10-31', '15:30', 12, 'round_trip'), '2026-11-01');
  assert.equal(rentalEndDate('2026-10-25', '15:30', 48, 'outbound'), '2026-10-27');
});
test('missing optional time or duration preserves the date', () => {
  assert.equal(rentalEndDate('2026-10-25', '', 12, 'outbound'), '2026-10-25');
  assert.equal(rentalEndDate('2026-10-25', '15:30', null, 'outbound'), '2026-10-25');
});
