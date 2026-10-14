const { todayString } = require('./maintenance');
const { formatOnScheduleRate } = require('./operations');

function blank(value) {
  return value == null ? '' : String(value);
}

const REPORTS = [
  {
    id: 'inventory',
    section: 'Inventory Reports',
    name: 'Inventory Report',
    description: 'Device register for meetings and audits, with serial number, device category, manufacturer, model number, clinical department, operational status, and PM status.',
    filename: 'Inventory_Report.csv',
    columns: [
      'Asset Tag',
      'Device Name',
      'Serial Number',
      'Device Category',
      'Manufacturer',
      'Model Number',
      'Clinical Department',
      'Operational Status',
      'PM Status'
    ]
  },
  {
    id: 'pm-schedule',
    section: 'Maintenance Reports',
    name: 'PM Schedule Report',
    description: 'Full preventive maintenance schedule for the fleet, including serial number, PM schedule, last PM date, next PM due date, and PM status. Every status is included. Decommissioned devices remain on this report.',
    filename: 'PM_Schedule_Report.csv',
    columns: [
      'Asset Tag',
      'Device Name',
      'Serial Number',
      'Clinical Department',
      'PM Schedule',
      'Last PM Date',
      'Next PM Due Date',
      'PM Status'
    ]
  },
  {
    id: 'service-requests',
    section: 'Service Request Reports',
    name: 'Service Request Report',
    description: 'Service work for review, with the device, clinical department, reporter, problem description, priority, status, and opened and closed dates.',
    filename: 'Service_Request_Report.csv',
    columns: [
      'Request Number',
      'Device',
      'Clinical Department',
      'Reported By',
      'Problem Description',
      'Priority',
      'Status',
      'Date Opened',
      'Date Closed'
    ]
  },
  {
    id: 'operations-summary',
    section: 'Operations Reports',
    name: 'Operations Summary',
    description: 'Fleet, maintenance compliance, availability, and open-work totals for an operations review. PM counts and the on-schedule rate omit decommissioned devices. The rate also omits devices that are not scheduled.',
    filename: 'Operations_Summary.csv',
    columns: ['KPI', 'Value']
  }
];

function findReport(id) {
  return REPORTS.find((report) => report.id === id) || null;
}

function reportCatalog(today = todayString()) {
  return REPORTS.map((report) => ({
    id: report.id,
    section: report.section,
    name: report.name,
    description: report.description,
    filename: report.filename,
    generated_on: today
  }));
}

function inventoryRows(devices) {
  return devices.map((device) => [
    device.asset_tag,
    device.equipment_name,
    blank(device.serial_number),
    device.category,
    device.manufacturer,
    device.model_number,
    device.department,
    device.operational_status,
    device.maintenance_status
  ]);
}

function pmScheduleRows(devices) {
  return devices.map((device) => [
    device.asset_tag,
    device.equipment_name,
    blank(device.serial_number),
    device.department,
    blank(device.pm_interval),
    blank(device.last_maintenance_date),
    blank(device.next_maintenance_date),
    device.maintenance_status
  ]);
}

function serviceRequestRows(requests) {
  return requests.map((request) => [
    request.request_number,
    `${request.equipment_name} (${request.asset_tag})`,
    blank(request.department),
    blank(request.reported_by),
    blank(request.problem),
    request.priority,
    request.status,
    blank(request.opened_on),
    blank(request.closed_on)
  ]);
}

function operationsSummaryRows(equipmentSummary, requestSummary) {
  return [
    ['Total Equipment', equipmentSummary.total],
    ['Active Equipment', equipmentSummary.total - equipmentSummary.decommissioned],
    ['In Service', equipmentSummary.in_service],
    ['In Repair', equipmentSummary.in_repair],
    ['Out of Service', equipmentSummary.out_of_service],
    ['Decommissioned', equipmentSummary.decommissioned],
    ['Available Equipment', equipmentSummary.available],
    ['Unavailable Equipment', equipmentSummary.unavailable],
    ['PM On Schedule', equipmentSummary.current],
    ['PM Due', equipmentSummary.due_soon],
    ['PM Overdue', equipmentSummary.overdue],
    ['PM Not Scheduled', equipmentSummary.not_scheduled],
    ['PM On-Schedule Rate', formatOnScheduleRate(
      equipmentSummary.current,
      equipmentSummary.due_soon,
      equipmentSummary.overdue
    )],
    ['Open Requests', requestSummary.open],
    ['In Progress', requestSummary.in_progress],
    ['Waiting for Parts', requestSummary.waiting_for_parts],
    ['Open Work Backlog', requestSummary.open_work],
    ['High Priority Open Work', requestSummary.high_priority_open_work],
    ['Completed This Month', requestSummary.completed_this_month]
  ];
}

function rowsFor(id, source) {
  if (id === 'inventory') return inventoryRows(source);
  if (id === 'pm-schedule') return pmScheduleRows(source);
  if (id === 'service-requests') return serviceRequestRows(source);
  if (id === 'operations-summary') {
    return operationsSummaryRows(source.equipment, source.requests);
  }
  return null;
}

module.exports = {
  REPORTS,
  findReport,
  reportCatalog,
  inventoryRows,
  pmScheduleRows,
  serviceRequestRows,
  operationsSummaryRows,
  rowsFor
};
