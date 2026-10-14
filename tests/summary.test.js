const assert = require('node:assert');
const { addDays, todayString } = require('../server/maintenance');
const { buildEquipmentSummary } = require('../server/routes/summary');

const today = todayString();
const due = addDays(today, 10);
const overdue = '2000-01-01';
const current = '2099-01-01';

const summary = buildEquipmentSummary([
  {
    operational_status: 'In Service',
    next_maintenance_date: due,
    department: 'ICU',
    category: 'Patient Monitor'
  },
  {
    operational_status: 'In Service',
    next_maintenance_date: current,
    department: 'ICU',
    category: 'Ventilator'
  },
  {
    operational_status: 'In Repair',
    next_maintenance_date: null,
    department: 'Radiology',
    category: 'Defibrillator'
  },
  {
    operational_status: 'Out of Service',
    next_maintenance_date: overdue,
    department: 'Radiology',
    category: 'Diagnostic Imaging'
  },
  {
    operational_status: 'Decommissioned',
    next_maintenance_date: overdue,
    department: 'ICU',
    category: 'Infusion Pump'
  },
  {
    operational_status: 'In Service',
    next_maintenance_date: null,
    department: '',
    category: 'Other'
  }
]);

assert.strictEqual(summary.total, 6);
assert.strictEqual(summary.in_service, 3);
assert.strictEqual(summary.in_repair, 1);
assert.strictEqual(summary.out_of_service, 1);
assert.strictEqual(summary.decommissioned, 1);
assert.strictEqual(summary.due_soon, 1);
assert.strictEqual(summary.overdue, 1);
assert.strictEqual(summary.current, 1);
assert.strictEqual(summary.not_scheduled, 2);
assert.strictEqual(summary.available, 3);
assert.strictEqual(summary.unavailable, 2);
assert.strictEqual(summary.on_schedule_rate, 1 / 3);
assert.strictEqual(summary.total - summary.decommissioned, 5);
assert.deepStrictEqual(summary.departments, ['ICU', 'Radiology']);
assert.deepStrictEqual(summary.by_department, [
  { department: 'ICU', count: 3 },
  { department: 'Radiology', count: 2 }
]);
assert.deepStrictEqual(summary.by_category, [
  { category: 'Defibrillator', count: 1 },
  { category: 'Diagnostic Imaging', count: 1 },
  { category: 'Infusion Pump', count: 1 },
  { category: 'Other', count: 1 },
  { category: 'Patient Monitor', count: 1 },
  { category: 'Ventilator', count: 1 }
]);

const empty = buildEquipmentSummary([]);
assert.strictEqual(empty.total, 0);
assert.strictEqual(empty.available, 0);
assert.strictEqual(empty.unavailable, 0);
assert.strictEqual(empty.on_schedule_rate, null);
assert.deepStrictEqual(empty.by_department, []);
assert.deepStrictEqual(empty.by_category, []);

console.log('summary tests passed');
