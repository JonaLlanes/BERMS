const assert = require('node:assert');
const { addDays, maintenanceStatus, nextPmDate, statusCondition } = require('../server/maintenance');
const { validateEquipment } = require('../server/validate');

const today = '2026-10-01';

assert.strictEqual(addDays(today, 30), '2026-10-31');
assert.strictEqual(maintenanceStatus('2026-10-15', today), 'Due');
assert.strictEqual(maintenanceStatus('2026-10-01', today), 'Due');
assert.strictEqual(maintenanceStatus('2026-10-31', today), 'Due');
assert.strictEqual(maintenanceStatus('2026-09-15', today), 'Overdue');
assert.strictEqual(maintenanceStatus('2026-11-01', today), 'On Schedule');
assert.strictEqual(maintenanceStatus(null, today), 'Not Scheduled');
assert.strictEqual(maintenanceStatus('', today), 'Not Scheduled');
assert.strictEqual(maintenanceStatus('2026-02-14', '2026-01-15'), 'Due');
assert.strictEqual(maintenanceStatus('2026-02-15', '2026-01-15'), 'On Schedule');

const dates = [null, '', '2026-09-15', '2026-10-01', '2026-10-31', '2026-11-01'];
for (const nextDate of dates) {
  const status = maintenanceStatus(nextDate, today);
  const condition = statusCondition(status, today);
  const next = nextDate ? String(nextDate).slice(0, 10) : '';
  if (status === 'Not Scheduled') assert.strictEqual(condition.sql, 'next_maintenance_date IS NULL');
  if (status === 'Overdue') assert.ok(next < condition.params[0]);
  if (status === 'Due') assert.ok(next >= condition.params[0] && next <= condition.params[1]);
  if (status === 'On Schedule') assert.ok(next > condition.params[0]);
}
assert.deepStrictEqual(statusCondition('Due', today).params, [today, '2026-10-31']);
assert.strictEqual(nextPmDate('2026-01-15', 'Monthly'), '2026-02-15');
assert.strictEqual(nextPmDate('2026-01-31', 'Monthly'), '2026-02-28');
assert.strictEqual(nextPmDate('2024-01-31', 'Monthly'), '2024-02-29');
assert.strictEqual(nextPmDate('2026-01-15', 'Quarterly'), '2026-04-15');
assert.strictEqual(nextPmDate('2026-03-31', 'Quarterly'), '2026-06-30');
assert.strictEqual(nextPmDate('2026-01-15', 'Semi-Annual'), '2026-07-15');
assert.strictEqual(nextPmDate('2026-01-15', 'Annual'), '2027-01-15');

const valid = {
  equipment_name: 'Patient Monitor',
  asset_tag: 'PM-100',
  category: 'Patient Monitor',
  manufacturer: 'Philips',
  model_number: 'MX450',
  serial_number: 'SN-100',
  department: 'ICU',
  operational_status: 'In Service',
  last_maintenance_date: '2026-09-01',
  next_maintenance_date: '2026-10-15'
};

assert.deepStrictEqual(validateEquipment(valid).errors, {});
assert.strictEqual(
  validateEquipment({ ...valid, last_maintenance_date: '2026-11-01', next_maintenance_date: '2026-10-15' }).errors.next_maintenance_date,
  'Last PM date must be on or before the next PM due date.'
);
assert.strictEqual(
  validateEquipment({ ...valid, equipment_name: '  ' }).errors.equipment_name,
  'Device name is required.'
);

console.log('maintenance status tests passed');
