const assert = require('node:assert');
const { todayString } = require('../server/maintenance');
const { closedOnForStatus, requestNumber, summarizeRequests } = require('../server/serviceRequests');
const { parseRequestQuery, validateRequestStatus, validateServiceRequest } = require('../server/validate');

const today = todayString();

assert.strictEqual(requestNumber(1), 'SR-001');
assert.strictEqual(requestNumber(42), 'SR-042');
assert.strictEqual(requestNumber(1001), 'SR-1001');

assert.strictEqual(closedOnForStatus('Open', '2026-10-14', null), null);
assert.strictEqual(closedOnForStatus('In Progress', '2026-10-14', '2026-10-01'), null);
assert.strictEqual(closedOnForStatus('Waiting for Parts', '2026-10-14', null), null);
assert.strictEqual(closedOnForStatus('Completed', '2026-10-14', null), '2026-10-14');
assert.strictEqual(closedOnForStatus('Cancelled', '2026-10-14', null), '2026-10-14');
assert.strictEqual(closedOnForStatus('Completed', '2026-10-14', '2026-09-02'), '2026-09-02');

const counts = summarizeRequests([
  { status: 'Open', priority: 'High', closed_on: null },
  { status: 'Open', priority: 'Low', closed_on: null },
  { status: 'In Progress', priority: 'High', closed_on: null },
  { status: 'Waiting for Parts', priority: 'Medium', closed_on: null },
  { status: 'Completed', priority: 'High', closed_on: '2026-10-03' },
  { status: 'Completed', priority: 'Low', closed_on: '2026-09-20' },
  { status: 'Cancelled', priority: 'High', closed_on: '2026-10-01' }
], '2026-10-14');

assert.deepStrictEqual(counts, {
  open: 2,
  in_progress: 1,
  waiting_for_parts: 1,
  completed_this_month: 1,
  open_work: 4,
  high_priority_open_work: 2
});

assert.deepStrictEqual(parseRequestQuery({}).errors, {});
assert.strictEqual(parseRequestQuery({ status: 'Open' }).value.status, 'Open');
assert.strictEqual(parseRequestQuery({ status: 'Waiting for Parts' }).value.status, 'Waiting for Parts');
assert.ok(parseRequestQuery({ status: 'Done' }).errors.status);

assert.deepStrictEqual(validateRequestStatus({ status: 'Completed' }).errors, {});
assert.ok(validateRequestStatus({ status: '' }).errors.status);

const created = validateServiceRequest({
  equipment_id: '4',
  reported_by: 'ICU Nursing',
  priority: 'High',
  problem: 'Alarm will not silence.',
  opened_on: today
});
assert.deepStrictEqual(created.errors, {});
assert.strictEqual(created.value.equipment_id, 4);
assert.strictEqual(created.value.opened_on, today);

const invalid = validateServiceRequest({
  equipment_id: '0',
  reported_by: '',
  priority: 'Urgent',
  problem: '',
  opened_on: '2099-01-01'
});
assert.ok(invalid.errors.equipment_id);
assert.ok(invalid.errors.reported_by);
assert.ok(invalid.errors.priority);
assert.ok(invalid.errors.problem);
assert.ok(invalid.errors.opened_on);

console.log('service request tests passed');
