const assert = require('node:assert');
const { buildEquipmentListQuery } = require('../server/equipmentQuery');
const { parseListQuery, validateMaintenance } = require('../server/validate');

const today = '2026-10-01';
const validVisit = {
  maintenance_type: 'Preventive Maintenance',
  maintenance_date: '2026-09-01',
  next_maintenance_date: '2026-12-01',
  performed_by: 'M. Santos',
  performed_by_type: 'In-House Engineer',
  operational_status: 'In Service',
  remarks: 'Replaced the battery.'
};

assert.deepStrictEqual(validateMaintenance(validVisit).errors, {});
assert.strictEqual(validateMaintenance({ ...validVisit, performed_by: '  ' }).errors.performed_by, 'Enter who performed the service.');
assert.strictEqual(validateMaintenance({ ...validVisit, performed_by_type: 'Vendor' }).errors.performed_by_type, 'Select in-house engineer or supplier engineer.');
assert.strictEqual(
  validateMaintenance({ ...validVisit, operational_status: 'In Repair', remarks: '' }).errors.remarks,
  'Enter the findings that explain this operational status.'
);
assert.strictEqual(validateMaintenance({ ...validVisit, maintenance_type: 'Emergency' }).errors.maintenance_type, 'Select a valid work type.');
assert.strictEqual(
  validateMaintenance({ ...validVisit, maintenance_date: '2099-01-01' }).errors.maintenance_date,
  'Service date cannot be in the future.'
);
assert.strictEqual(
  validateMaintenance({ ...validVisit, next_maintenance_date: '2026-08-01' }).errors.next_maintenance_date,
  'Next PM due date must be on or after the service date.'
);
assert.strictEqual(validateMaintenance({
  maintenance_type: 'Incoming Inspection',
  maintenance_date: '2026-09-01'
}).value.next_maintenance_date, undefined);

const invalidQuery = parseListQuery({ maintenance_status: 'Late', category: 'Scanner' });
assert.strictEqual(invalidQuery.errors.maintenance_status, 'Select a valid PM status.');
assert.strictEqual(invalidQuery.errors.category, 'Select a valid device category.');

const filters = parseListQuery({
  q: '  pump  ',
  maintenance_status: 'Overdue',
  category: 'Infusion Pump',
  operational_status: 'In Service',
  department: 'Emergency'
}).value;
const { sql, params } = buildEquipmentListQuery(filters, today);

assert.match(sql, /asset_tag LIKE \?/);
assert.match(sql, /category = \?/);
assert.match(sql, /operational_status = \?/);
assert.match(sql, /department = \?/);
const scheduled = buildEquipmentListQuery(parseListQuery({ pm_interval: 'Quarterly' }).value, today);
assert.match(scheduled.sql, /pm_interval = \?/);
assert.deepStrictEqual(scheduled.params, ['Quarterly']);
assert.match(sql, /operational_status <> 'Decommissioned'/);
assert.match(sql, /next_maintenance_date < \?/);
assert.ok(params.includes('%pump%'));
assert.ok(params.includes('Infusion Pump'));
assert.ok(params.includes('Emergency'));
assert.strictEqual(params[params.length - 1], today);

const openEnded = buildEquipmentListQuery(parseListQuery({}).value, today);
assert.strictEqual(openEnded.params.length, 0);
assert.match(openEnded.sql, /^SELECT \* FROM equipment ORDER BY/);

console.log('history and filter tests passed');
