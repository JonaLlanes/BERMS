const assert = require('node:assert');
const {
  filterDashboard,
  summarizeEquipment,
  summarizeWork,
  summarizeSupport,
  daysBetween
} = require('../public/js/dashboardFilter');

const equipment = [
  {
    id: 1,
    department: 'ICU',
    category: 'Ventilator',
    operational_status: 'In Service',
    maintenance_status: 'On Schedule'
  },
  {
    id: 2,
    department: 'ICU',
    category: 'Infusion Pump',
    operational_status: 'In Repair',
    maintenance_status: 'Not Scheduled'
  },
  {
    id: 3,
    department: 'Emergency Department',
    category: 'Ventilator',
    operational_status: 'In Service',
    maintenance_status: 'Overdue'
  },
  {
    id: 4,
    department: 'ICU',
    category: 'Ventilator',
    operational_status: 'Decommissioned',
    maintenance_status: 'On Schedule'
  }
];

const requests = [
  { equipment_id: 1, status: 'Open', closed_on: null },
  { equipment_id: 2, status: 'Waiting for Parts', closed_on: null },
  { equipment_id: 3, status: 'Open', closed_on: null },
  { equipment_id: 1, status: 'Completed', closed_on: '2026-10-03' }
];

const all = filterDashboard(equipment, requests, {});
assert.strictEqual(all.equipment.length, 4);
assert.strictEqual(all.requests.length, 4);
assert.strictEqual(equipment.length, 4);

const icu = filterDashboard(equipment, requests, { department: 'ICU' });
assert.deepStrictEqual(icu.equipment.map((device) => device.id), [1, 2, 4]);
assert.deepStrictEqual(icu.requests.map((request) => request.equipment_id), [1, 2, 1]);

const ventilators = filterDashboard(equipment, requests, { category: 'Ventilator' });
assert.deepStrictEqual(ventilators.equipment.map((device) => device.id), [1, 3, 4]);
assert.deepStrictEqual(ventilators.requests.map((request) => request.equipment_id), [1, 3, 1]);

const icuVentilators = filterDashboard(equipment, requests, {
  department: 'ICU',
  category: 'Ventilator'
});
assert.deepStrictEqual(icuVentilators.equipment.map((device) => device.id), [1, 4]);
assert.deepStrictEqual(icuVentilators.requests.map((request) => request.status), ['Open', 'Completed']);

const inRepair = filterDashboard(equipment, requests, { operational_status: 'In Repair' });
assert.deepStrictEqual(inRepair.equipment.map((device) => device.id), [2]);
assert.strictEqual(inRepair.requests.length, 1);
assert.strictEqual(inRepair.requests[0].status, 'Waiting for Parts');

const openRequests = filterDashboard(equipment, requests, { request_status: 'Open' });
assert.deepStrictEqual(openRequests.equipment.map((device) => device.id), [1, 3]);
assert.deepStrictEqual(openRequests.requests.map((request) => request.status), ['Open', 'Open']);

const icuOpen = filterDashboard(equipment, requests, {
  department: 'ICU',
  request_status: 'Open'
});
assert.deepStrictEqual(icuOpen.equipment.map((device) => device.id), [1]);
assert.strictEqual(icuOpen.requests.length, 1);

const icuSummary = summarizeEquipment(icu.equipment);
assert.strictEqual(icuSummary.total, 3);
assert.strictEqual(icuSummary.total - icuSummary.decommissioned, 2);
assert.strictEqual(icuSummary.in_service, 1);
assert.strictEqual(icuSummary.in_repair, 1);
assert.strictEqual(icuSummary.decommissioned, 1);
assert.strictEqual(icuSummary.current, 1);
assert.strictEqual(icuSummary.available, 1);
assert.strictEqual(icuSummary.unavailable, 1);
assert.strictEqual(icuSummary.on_schedule_rate, 1);
assert.strictEqual(icuSummary.not_scheduled, 1);
assert.strictEqual(icuSummary.overdue, 0);
assert.deepStrictEqual(icuSummary.by_category, [
  { category: 'Infusion Pump', count: 1 },
  { category: 'Ventilator', count: 2 }
]);

const ventilatorSummary = summarizeEquipment(ventilators.equipment);
assert.strictEqual(ventilatorSummary.total, 3);
assert.strictEqual(ventilatorSummary.overdue, 1);
assert.strictEqual(ventilatorSummary.current, 1);
assert.strictEqual(ventilatorSummary.decommissioned, 1);

const supportEquipment = [
  {
    id: 1,
    equipment_name: 'Ventilator',
    asset_tag: 'VN-208',
    department: 'ICU',
    category: 'Ventilator',
    operational_status: 'In Service',
    corrective_count: 2
  },
  {
    id: 2,
    equipment_name: 'Infusion Pump',
    asset_tag: 'IP-014',
    department: 'Emergency Department',
    category: 'Infusion Pump',
    operational_status: 'In Repair',
    corrective_count: 1
  },
  {
    id: 3,
    equipment_name: 'Retired Monitor',
    asset_tag: 'PM-900',
    department: 'ICU',
    category: 'Patient Monitor',
    operational_status: 'Decommissioned',
    corrective_count: 0
  }
];
const supportRequests = [
  {
    request_number: 'SR-1',
    equipment_id: 1,
    equipment_name: 'Ventilator',
    asset_tag: 'VN-208',
    status: 'Open',
    priority: 'High',
    opened_on: '2026-10-01'
  },
  {
    request_number: 'SR-2',
    equipment_id: 1,
    equipment_name: 'Ventilator',
    asset_tag: 'VN-208',
    status: 'Completed',
    priority: 'Low',
    opened_on: '2026-09-01',
    closed_on: '2026-09-02'
  },
  {
    request_number: 'SR-3',
    equipment_id: 1,
    equipment_name: 'Ventilator',
    asset_tag: 'VN-208',
    status: 'Cancelled',
    priority: 'High',
    opened_on: '2026-09-01'
  },
  {
    request_number: 'SR-4',
    equipment_id: 2,
    equipment_name: 'Infusion Pump',
    asset_tag: 'IP-014',
    status: 'Waiting for Parts',
    priority: 'Medium',
    opened_on: '2026-10-10'
  },
  {
    request_number: 'SR-5',
    equipment_id: 2,
    equipment_name: 'Infusion Pump',
    asset_tag: 'IP-014',
    status: 'Open',
    priority: 'Low',
    opened_on: '2026-10-12'
  }
];
const work = summarizeWork(supportRequests, '2026-10-14');
assert.strictEqual(work.open_work, 3);
assert.strictEqual(work.high_priority_open_work, 1);
assert.strictEqual(work.oldest_open_age, 13);
assert.strictEqual(daysBetween('2026-10-12', '2026-10-14'), 2);

const support = summarizeSupport(supportEquipment, supportRequests, '2026-10-14');
assert.strictEqual(support.requests_per_active, 2);
assert.deepStrictEqual(support.most_requests.map((row) => row.label), [
  'Infusion Pump (IP-014)',
  'Ventilator (VN-208)'
]);
assert.deepStrictEqual(support.by_department, [
  { label: 'Emergency Department', count: 2 },
  { label: 'ICU', count: 2 }
]);
assert.deepStrictEqual(support.by_category[0], { label: 'Infusion Pump', count: 2 });
assert.deepStrictEqual(support.attention.map((row) => row.asset_tag), ['VN-208', 'IP-014']);
assert.strictEqual(support.open_work[0].request_number, 'SR-1');
assert.strictEqual(support.open_work[0].age, 13);
assert.ok(support.attention.every((row) => row.asset_tag !== 'PM-900'));

console.log('dashboard filter tests passed');
