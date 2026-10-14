const assert = require('node:assert');
const { addDays, todayString } = require('../server/maintenance');
const { toCsv } = require('../server/csv');
const { buildEquipmentSummary } = require('../server/routes/summary');
const { summarizeRequests } = require('../server/serviceRequests');
const {
  findReport,
  reportCatalog,
  rowsFor
} = require('../server/reports');

const catalog = reportCatalog('2026-10-14');
assert.deepStrictEqual(catalog.map((report) => report.section), [
  'Inventory Reports',
  'Maintenance Reports',
  'Service Request Reports',
  'Operations Reports'
]);
assert.deepStrictEqual(catalog.map((report) => report.name), [
  'Inventory Report',
  'PM Schedule Report',
  'Service Request Report',
  'Operations Summary'
]);
assert.deepStrictEqual(catalog.map((report) => report.filename), [
  'Inventory_Report.csv',
  'PM_Schedule_Report.csv',
  'Service_Request_Report.csv',
  'Operations_Summary.csv'
]);
assert.ok(catalog.every((report) => report.generated_on === '2026-10-14'));
assert.strictEqual(findReport('missing'), null);

const devices = [
  {
    asset_tag: 'PM-001',
    equipment_name: 'Monitor, ICU',
    category: 'Patient Monitor',
    manufacturer: 'Philips',
    model_number: 'MX450',
    serial_number: 'SN-PM-10001',
    department: 'ICU',
    operational_status: 'In Service',
    pm_interval: 'Semi-Annual',
    last_maintenance_date: '2026-04-01',
    next_maintenance_date: '2026-10-01',
    maintenance_status: 'Due'
  },
  {
    asset_tag: 'DF-033',
    equipment_name: 'Defibrillator',
    category: 'Defibrillator',
    manufacturer: 'Zoll',
    model_number: 'R Series',
    serial_number: 'SN-DF-10033',
    department: 'Emergency Department',
    operational_status: 'In Repair',
    pm_interval: null,
    last_maintenance_date: null,
    next_maintenance_date: null,
    maintenance_status: 'Not Scheduled'
  }
];

const inventory = rowsFor('inventory', devices);
assert.deepStrictEqual(findReport('inventory').columns, [
  'Asset Tag',
  'Device Name',
  'Serial Number',
  'Device Category',
  'Manufacturer',
  'Model Number',
  'Clinical Department',
  'Operational Status',
  'PM Status'
]);
assert.deepStrictEqual(inventory[0], [
  'PM-001',
  'Monitor, ICU',
  'SN-PM-10001',
  'Patient Monitor',
  'Philips',
  'MX450',
  'ICU',
  'In Service',
  'Due'
]);

const schedule = rowsFor('pm-schedule', devices);
assert.deepStrictEqual(findReport('pm-schedule').columns, [
  'Asset Tag',
  'Device Name',
  'Serial Number',
  'Clinical Department',
  'PM Schedule',
  'Last PM Date',
  'Next PM Due Date',
  'PM Status'
]);
assert.deepStrictEqual(schedule[1], [
  'DF-033',
  'Defibrillator',
  'SN-DF-10033',
  'Emergency Department',
  '',
  '',
  '',
  'Not Scheduled'
]);

const requests = rowsFor('service-requests', [
  {
    request_number: 'SR-1001',
    equipment_name: 'Infusion Pump',
    asset_tag: 'IP-014',
    department: 'Emergency Department',
    reported_by: 'ED Nursing',
    problem: 'Occlusion alarm keeps returning.',
    priority: 'High',
    status: 'Open',
    opened_on: '2026-10-02',
    closed_on: null
  }
]);
assert.deepStrictEqual(findReport('service-requests').columns, [
  'Request Number',
  'Device',
  'Clinical Department',
  'Reported By',
  'Problem Description',
  'Priority',
  'Status',
  'Date Opened',
  'Date Closed'
]);
assert.deepStrictEqual(requests[0], [
  'SR-1001',
  'Infusion Pump (IP-014)',
  'Emergency Department',
  'ED Nursing',
  'Occlusion alarm keeps returning.',
  'High',
  'Open',
  '2026-10-02',
  ''
]);

const equipmentSummary = buildEquipmentSummary([
  {
    operational_status: 'In Service',
    next_maintenance_date: addDays(todayString(), 10),
    department: 'ICU',
    category: 'Patient Monitor'
  },
  {
    operational_status: 'Decommissioned',
    next_maintenance_date: '2000-01-01',
    department: 'ICU',
    category: 'Infusion Pump'
  }
]);
const requestSummary = summarizeRequests([
  { status: 'Open', priority: 'High', closed_on: null },
  { status: 'In Progress', priority: 'Medium', closed_on: null },
  { status: 'Waiting for Parts', priority: 'Low', closed_on: null },
  { status: 'Completed', priority: 'High', closed_on: '2026-10-03' },
  { status: 'Completed', priority: 'Low', closed_on: '2026-09-20' }
], '2026-10-14');
assert.deepStrictEqual(rowsFor('operations-summary', {
  equipment: equipmentSummary,
  requests: requestSummary
}), [
  ['Total Equipment', 2],
  ['Active Equipment', 1],
  ['In Service', 1],
  ['In Repair', 0],
  ['Out of Service', 0],
  ['Decommissioned', 1],
  ['Available Equipment', 1],
  ['Unavailable Equipment', 0],
  ['PM On Schedule', 0],
  ['PM Due', 1],
  ['PM Overdue', 0],
  ['PM Not Scheduled', 0],
  ['PM On-Schedule Rate', '0%'],
  ['Open Requests', 1],
  ['In Progress', 1],
  ['Waiting for Parts', 1],
  ['Open Work Backlog', 3],
  ['High Priority Open Work', 1],
  ['Completed This Month', 1]
]);

const csv = toCsv(findReport('inventory').columns, inventory);
assert.ok(csv.startsWith('\uFEFFAsset Tag,Device Name,'));
assert.ok(csv.includes('"Monitor, ICU"'));
assert.ok(csv.endsWith('\r\n'));
assert.strictEqual(
  toCsv(['Note'], [['Say "check"']]),
  '\uFEFFNote\r\n"Say ""check"""\r\n'
);

console.log('report tests passed');
