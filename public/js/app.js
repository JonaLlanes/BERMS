const CATEGORIES = [
  'Patient Monitor',
  'Infusion Pump',
  'Ventilator',
  'Defibrillator',
  'Diagnostic Imaging',
  'Laboratory Analyzer',
  'Other'
];

const OPERATIONAL_STATUSES = [
  'In Service',
  'In Repair',
  'Out of Service',
  'Decommissioned'
];

const MAINTENANCE_TYPES = [
  'Preventive Maintenance',
  'Corrective Maintenance',
  'Incoming Inspection',
  'Electrical Safety Test',
  'Calibration'
];

const PM_INTERVALS = {
  Monthly: 1,
  Quarterly: 3,
  'Semi-Annual': 6,
  Annual: 12
};

const PM_SCHEDULE_TYPES = [
  'Preventive Maintenance',
  'Incoming Inspection',
  'Electrical Safety Test',
  'Calibration'
];

const ENGINEER_TYPES = ['In-House Engineer', 'Supplier Engineer'];

const REQUEST_STATUSES = [
  'Open',
  'In Progress',
  'Waiting for Parts',
  'Completed',
  'Cancelled'
];

const REQUEST_PRIORITIES = ['Low', 'Medium', 'High'];

const REQUEST_FIELDS = ['equipment_id', 'reported_by', 'priority', 'problem', 'opened_on'];

const FIELD_NAMES = [
  'equipment_name',
  'asset_tag',
  'category',
  'department',
  'manufacturer',
  'model_number',
  'serial_number',
  'operational_status',
  'pm_interval',
  'purchase_date',
  'last_maintenance_date',
  'next_maintenance_date',
  'notes'
];

const HISTORY_FIELDS = ['maintenance_type', 'maintenance_date', 'performed_by', 'performed_by_type', 'remarks'];

const searchForm = document.querySelector('#search-form');
const searchInput = document.querySelector('#search');
const maintenanceFilter = document.querySelector('#maintenance-filter');
const serviceFilter = document.querySelector('#service-filter');
const categoryFilter = document.querySelector('#category-filter');
const scheduleFilter = document.querySelector('#schedule-filter');
const departmentFilter = document.querySelector('#department-filter');
const resultCount = document.querySelector('#result-count');
const banner = document.querySelector('#banner');
const tbody = document.querySelector('#equipment-body');
const formDialog = document.querySelector('#form-dialog');
const form = document.querySelector('#equipment-form');
const formTitle = document.querySelector('#form-title');
const formError = document.querySelector('#form-error');
const historyDialog = document.querySelector('#history-dialog');
const historyForm = document.querySelector('#history-form');
const historyTitle = document.querySelector('#history-title');
const historyMeta = document.querySelector('#history-meta');
const deviceFacts = document.querySelector('#device-facts');
const historyMessage = document.querySelector('#history-message');
const historyList = document.querySelector('#history-list');
const metricButtons = [...document.querySelectorAll('#metrics [data-metric]')];
const inventoryView = document.querySelector('#inventory-view');
const operationsView = document.querySelector('#operations-view');
const operationsBanner = document.querySelector('#operations-banner');
const opsRequestsBanner = document.querySelector('#ops-requests-banner');
const requestsView = document.querySelector('#requests-view');
const reportsView = document.querySelector('#reports-view');
const reportsBanner = document.querySelector('#reports-banner');
const reportCenter = document.querySelector('#report-center');
const requestsBanner = document.querySelector('#requests-banner');
const requestsBody = document.querySelector('#requests-body');
const requestCount = document.querySelector('#request-count');
const requestStatusFilter = document.querySelector('#request-status-filter');
const requestDialog = document.querySelector('#request-dialog');
const requestForm = document.querySelector('#request-form');
const requestFormError = document.querySelector('#request-form-error');
const chartOperational = document.querySelector('#chart-operational');
const chartPm = document.querySelector('#chart-pm');
const chartDepartment = document.querySelector('#chart-department');
const chartCategory = document.querySelector('#chart-category');
const chartRequests = document.querySelector('#chart-requests');
const chartPriority = document.querySelector('#chart-priority');
const chartMostRequests = document.querySelector('#chart-most-requests');
const chartRequestDepartment = document.querySelector('#chart-requests-department');
const chartRequestCategory = document.querySelector('#chart-requests-category');
const openWorkAge = document.querySelector('#open-work-age');
const attentionList = document.querySelector('#attention-list');
const navButtons = [...document.querySelectorAll('.nav-link')];

let records = [];
let historyEquipment = null;
let searchTimer = null;
let reportCatalog = [];
let dashboardEquipment = null;
let dashboardRequests = null;
const dashboardFilters = {
  department: '',
  category: '',
  operational_status: '',
  request_status: ''
};

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusClass(status) {
  return `status-${status.toLowerCase().replaceAll(' ', '-')}`;
}

function opClass(status) {
  return `op-${String(status).toLowerCase().replaceAll(' ', '-')}`;
}

function showDate(value) {
  return value ? escapeHtml(String(value).slice(0, 10)) : '—';
}

function showBanner(message, isError) {
  banner.hidden = false;
  banner.textContent = message;
  banner.classList.toggle('error', Boolean(isError));
}

function clearBanner() {
  banner.hidden = true;
  banner.textContent = '';
  banner.classList.remove('error');
}

function clearFieldErrors() {
  formError.hidden = true;
  formError.textContent = '';
  for (const name of FIELD_NAMES) {
    const field = form.elements[name];
    const error = document.querySelector(`#${name}-error`);
    field.removeAttribute('aria-invalid');
    error.textContent = '';
  }
}

function showErrors(errors) {
  clearFieldErrors();
  const entries = Object.entries(errors || {});
  if (!entries.length) return;
  for (const [name, message] of entries) {
    if (name === 'form' || !form.elements[name]) {
      formError.hidden = false;
      formError.textContent = message;
      continue;
    }
    form.elements[name].setAttribute('aria-invalid', 'true');
    document.querySelector(`#${name}-error`).textContent = message;
  }
  const firstInvalid = form.querySelector('[aria-invalid="true"]');
  if (firstInvalid) firstInvalid.focus();
}

function addMonths(dateString, months) {
  const [year, month, day] = dateString.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  const nextYear = target.getFullYear();
  const nextMonth = String(target.getMonth() + 1).padStart(2, '0');
  const nextDay = String(target.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function readForm() {
  const data = {};
  for (const name of FIELD_NAMES) data[name] = form.elements[name].value.trim();
  return data;
}

function validateForm(data) {
  const errors = {};
  if (!data.equipment_name) errors.equipment_name = 'Device name is required.';
  else if (data.equipment_name.length > 100) errors.equipment_name = 'Device name must be 100 characters or fewer.';

  if (!data.asset_tag) errors.asset_tag = 'Asset tag is required.';
  else if (data.asset_tag.length > 50) errors.asset_tag = 'Asset tag must be 50 characters or fewer.';

  if (!data.category) errors.category = 'Device category is required.';
  else if (!CATEGORIES.includes(data.category)) errors.category = 'Select a valid device category.';

  if (!data.manufacturer) errors.manufacturer = 'Manufacturer is required.';
  else if (data.manufacturer.length > 100) errors.manufacturer = 'Manufacturer must be 100 characters or fewer.';

  if (!data.model_number) errors.model_number = 'Model number is required.';
  else if (data.model_number.length > 100) errors.model_number = 'Model number must be 100 characters or fewer.';

  if (!data.serial_number) errors.serial_number = 'Serial number is required.';
  else if (data.serial_number.length > 100) errors.serial_number = 'Serial number must be 100 characters or fewer.';

  if (!data.department) errors.department = 'Clinical department is required.';
  else if (data.department.length > 100) errors.department = 'Clinical department must be 100 characters or fewer.';

  if (!OPERATIONAL_STATUSES.includes(data.operational_status)) {
    errors.operational_status = 'Select a valid operational status.';
  }
  if (data.operational_status && data.operational_status !== 'In Service' && !data.notes) {
    errors.notes = 'Enter notes that explain why the device is not in service.';
  }

  if (data.pm_interval && !Object.hasOwn(PM_INTERVALS, data.pm_interval)) {
    errors.pm_interval = 'Select a PM schedule: monthly, quarterly, semi-annual, or annual.';
  }

  for (const [name, label] of [
    ['purchase_date', 'Purchase date'],
    ['last_maintenance_date', 'Last PM date'],
    ['next_maintenance_date', 'Next PM due date']
  ]) {
    if (data[name] && !isRealDate(data[name])) errors[name] = `${label} must be a valid date.`;
  }

  if (data.last_maintenance_date && isRealDate(data.last_maintenance_date) && data.last_maintenance_date > todayString()) {
    errors.last_maintenance_date = 'Last PM date cannot be in the future.';
  }

  if (
    data.last_maintenance_date &&
    data.next_maintenance_date &&
    isRealDate(data.last_maintenance_date) &&
    isRealDate(data.next_maintenance_date) &&
    data.last_maintenance_date > data.next_maintenance_date
  ) {
    errors.next_maintenance_date = 'Last PM date must be on or before the next PM due date.';
  }

  if (data.notes.length > 2000) errors.notes = 'Notes must be 2000 characters or fewer.';
  return errors;
}

function listParams() {
  const params = new URLSearchParams();
  const query = searchInput.value.trim();
  if (query) params.set('q', query);
  if (maintenanceFilter.value) params.set('maintenance_status', maintenanceFilter.value);
  if (serviceFilter.value) params.set('operational_status', serviceFilter.value);
  if (categoryFilter.value) params.set('category', categoryFilter.value);
  if (scheduleFilter.value) params.set('pm_interval', scheduleFilter.value);
  if (departmentFilter.value) params.set('department', departmentFilter.value);
  return params;
}

function filtersActive() {
  return Boolean(
    searchInput.value.trim() ||
    maintenanceFilter.value ||
    serviceFilter.value ||
    categoryFilter.value ||
    scheduleFilter.value ||
    departmentFilter.value
  );
}

function highlightMetrics() {
  const service = serviceFilter.value;
  const maintenance = maintenanceFilter.value;
  for (const card of metricButtons) {
    const key = card.dataset.metric;
    let active = false;
    if (key === 'total') active = !service && !maintenance;
    if (key === 'in_service') active = service === 'In Service' && !maintenance;
    if (key === 'in_repair') active = service === 'In Repair' && !maintenance;
    if (key === 'out_of_service') active = service === 'Out of Service' && !maintenance;
    if (key === 'decommissioned') active = service === 'Decommissioned' && !maintenance;
    if (key === 'due_soon') active = maintenance === 'Due' && !service;
    if (key === 'overdue') active = maintenance === 'Overdue' && !service;
    card.classList.toggle('active', active);
    card.setAttribute('aria-pressed', String(active));
  }
}

function applyMetric(name) {
  if (name === 'total') {
    serviceFilter.value = '';
    maintenanceFilter.value = '';
  } else if (name === 'in_service') {
    serviceFilter.value = 'In Service';
    maintenanceFilter.value = '';
  } else if (name === 'in_repair') {
    serviceFilter.value = 'In Repair';
    maintenanceFilter.value = '';
  } else if (name === 'out_of_service') {
    serviceFilter.value = 'Out of Service';
    maintenanceFilter.value = '';
  } else if (name === 'decommissioned') {
    serviceFilter.value = 'Decommissioned';
    maintenanceFilter.value = '';
  } else if (name === 'due_soon') {
    maintenanceFilter.value = 'Due';
    serviceFilter.value = '';
  } else if (name === 'overdue') {
    maintenanceFilter.value = 'Overdue';
    serviceFilter.value = '';
  }
  highlightMetrics();
  loadEquipment().catch(() => showBanner('Could not reach the server.', true));
}

function showOperationsBanner(message, isError) {
  operationsBanner.hidden = false;
  operationsBanner.textContent = message;
  operationsBanner.classList.toggle('error', Boolean(isError));
}

function clearOperationsBanner() {
  operationsBanner.hidden = true;
  operationsBanner.textContent = '';
  operationsBanner.classList.remove('error');
}

function formatOnScheduleRate(summary) {
  const denominator = summary.current + summary.due_soon + summary.overdue;
  if (!denominator) return '—';
  return formatPercent(summary.current, denominator);
}

function formatRequestsPerDevice(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return '—';
  const rounded = Math.round(Number(rate) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatPercent(count, total) {
  if (!total) return '0%';
  const rounded = Math.round((count / total) * 1000) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function chartSummary(title, items, total) {
  const parts = items.map((item) => `${item.label} ${item.count} (${formatPercent(item.count, total)})`);
  return `${title}. ${parts.join('. ')}.`;
}

function setChartMessage(host, message) {
  if (!host) return;
  host.innerHTML = `<p class="chart-empty">${escapeHtml(message)}</p>`;
}

function legendHtml(items, total) {
  return `<ul class="chart-legend">${items.map((item) => `
    <li>
      <span class="swatch" style="background:${item.color}"></span>
      <span class="legend-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
      <span class="legend-value">${item.count}</span>
      <span class="legend-pct">${formatPercent(item.count, total)}</span>
    </li>
  `).join('')}</ul>`;
}

function arcPath(cx, cy, radius, start, end) {
  const startX = cx + radius * Math.cos(start);
  const startY = cy + radius * Math.sin(start);
  const endX = cx + radius * Math.cos(end);
  const endY = cy + radius * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;
}

function donutArcs(items, total) {
  const active = items.filter((item) => item.count > 0);
  if (!total || active.length === 0) return [];
  if (active.length === 1) return [{ ...active[0], full: true }];
  const gap = 0.045;
  let angle = -Math.PI / 2;
  return active.map((item) => {
    const sweep = (item.count / total) * Math.PI * 2;
    const inset = sweep > gap * 3 ? gap / 2 : 0;
    const arc = { ...item, start: angle + inset, end: angle + sweep - inset };
    angle += sweep;
    return arc;
  });
}

function renderDonut(host, items, { title, centerLabel }) {
  if (!host) return;
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const arcs = donutArcs(items, total).map((arc) => {
    if (arc.full) {
      return `<circle cx="60" cy="60" r="42" fill="none" stroke="${arc.color}" stroke-width="16"></circle>`;
    }
    return `<path d="${arcPath(60, 60, 42, arc.start, arc.end)}" fill="none" stroke="${arc.color}" stroke-width="16"></path>`;
  }).join('');
  host.innerHTML = `
    <div class="chart-layout" role="img" aria-label="${escapeHtml(chartSummary(title, items, total))}">
      <svg class="donut" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="42" fill="none" stroke="var(--chart-track)" stroke-width="16"></circle>
        ${arcs}
        <text class="donut-total" x="60" y="58" text-anchor="middle">${total}</text>
        <text class="donut-caption" x="60" y="74" text-anchor="middle">${escapeHtml(centerLabel)}</text>
      </svg>
      ${legendHtml(items, total)}
    </div>
  `;
}

function sortByCountDesc(rows, labelKey) {
  return rows
    .map((row) => ({ label: row[labelKey], count: row.count }))
    .sort((left, right) => right.count - left.count || String(left.label).localeCompare(String(right.label)));
}

function renderHorizontalBars(host, rows, color, seriesLabel, emptyMessage = 'No devices yet.') {
  if (!host) return;
  if (!rows.length) {
    setChartMessage(host, emptyMessage);
    return;
  }
  const max = Math.max(...rows.map((row) => row.count), 1);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const bars = rows.map((row) => {
    const width = row.count === 0 ? 0 : Math.max((row.count / max) * 100, 1.5);
    return `
      <div class="bar-row">
        <span class="bar-label" title="${escapeHtml(row.label)}">${escapeHtml(row.label)}</span>
        <svg class="bar-svg" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <rect width="100" height="10" rx="2" fill="var(--chart-track)"></rect>
          <rect width="${width.toFixed(2)}" height="10" rx="2" fill="${color}"></rect>
        </svg>
        <span class="bar-count">${row.count}</span>
        <span class="bar-pct">${formatPercent(row.count, total)}</span>
      </div>
    `;
  }).join('');
  const summary = rows.map((row) => `${row.label} ${row.count} (${formatPercent(row.count, total)})`).join('. ');
  host.innerHTML = `
    <div class="bar-chart" role="img" aria-label="${escapeHtml(`${seriesLabel}. ${summary}.`)}">
      ${bars}
      <ul class="chart-legend">
        <li>
          <span class="swatch" style="background:${color}"></span>
          <span class="legend-label">${escapeHtml(seriesLabel)}</span>
          <span class="legend-value">${total}</span>
          <span class="legend-pct">${total ? '100%' : '0%'}</span>
        </li>
      </ul>
    </div>
  `;
}

function renderColumnChart(host, items, title) {
  if (!host) return;
  const width = 360;
  const height = 220;
  const padLeft = 16;
  const padRight = 16;
  const base = 176;
  const top = 28;
  const plotHeight = base - top;
  const max = Math.max(...items.map((item) => item.count), 1);
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const slot = (width - padLeft - padRight) / items.length;
  const bars = items.map((item, index) => {
    const barHeight = item.count === 0 ? 0 : Math.max((item.count / max) * plotHeight, 2);
    const x = padLeft + index * slot + (slot - 44) / 2;
    const y = base - barHeight;
    return `
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="44" height="${barHeight.toFixed(2)}" rx="2" fill="${item.color}"></rect>
      <text class="col-value" x="${(x + 22).toFixed(2)}" y="${Math.max(y - 8, 16).toFixed(2)}" text-anchor="middle">${item.count}</text>
      <text class="col-label" x="${(x + 22).toFixed(2)}" y="200" text-anchor="middle">${escapeHtml(item.label)}</text>
    `;
  }).join('');
  host.innerHTML = `
    <div role="img" aria-label="${escapeHtml(chartSummary(title, items, total))}">
      <svg class="column-chart" viewBox="0 0 ${width} ${height}" aria-hidden="true">
        <line x1="${padLeft}" y1="${base}" x2="${width - padRight}" y2="${base}" stroke="#e0e0e0"></line>
        ${bars}
      </svg>
      ${legendHtml(items, total)}
    </div>
  `;
}

function countLabeled(rows, key, order) {
  const counts = new Map(order.map((item) => [item.label, 0]));
  for (const row of rows) {
    const label = row[key];
    if (counts.has(label)) counts.set(label, counts.get(label) + 1);
  }
  return order.map((item) => ({ ...item, count: counts.get(item.label) }));
}

function renderOperations(summary, emptyMessage = 'No devices yet.') {
  const active = summary.total - summary.decommissioned;
  const values = {
    'ops-total': summary.total,
    'ops-active': active,
    'ops-in-repair': summary.in_repair,
    'ops-out-of-service': summary.out_of_service,
    'ops-available': summary.available ?? summary.in_service,
    'ops-unavailable': summary.unavailable ?? (summary.in_repair + summary.out_of_service),
    'ops-decommissioned': summary.decommissioned,
    'ops-due': summary.due_soon,
    'ops-overdue': summary.overdue,
    'ops-current': summary.current,
    'ops-not-scheduled': summary.not_scheduled
  };
  for (const [id, value] of Object.entries(values)) {
    document.querySelector(`#${id}`).textContent = value;
  }
  document.querySelector('#ops-due-card').classList.toggle('has-count', summary.due_soon > 0);
  document.querySelector('#ops-overdue-card').classList.toggle('has-count', summary.overdue > 0);
  document.querySelector('#ops-unavailable-card').classList.toggle('has-count', (summary.unavailable ?? 0) > 0);
  document.querySelector('#ops-on-schedule-rate').textContent = formatOnScheduleRate(summary);
  renderDonut(chartOperational, [
    { label: 'In Service', count: summary.in_service, color: 'var(--ok)' },
    { label: 'In Repair', count: summary.in_repair, color: 'var(--chart-amber)' },
    { label: 'Out of Service', count: summary.out_of_service, color: 'var(--danger)' },
    { label: 'Decommissioned', count: summary.decommissioned, color: 'var(--chart-gray)' }
  ], { title: 'Equipment Operational Status', centerLabel: 'equipment' });
  renderDonut(chartPm, [
    { label: 'On Schedule', count: summary.current, color: 'var(--ok)' },
    { label: 'Due', count: summary.due_soon, color: 'var(--chart-amber)' },
    { label: 'Overdue', count: summary.overdue, color: 'var(--danger)' },
    { label: 'Not Scheduled', count: summary.not_scheduled, color: 'var(--chart-gray)' }
  ], { title: 'Preventive Maintenance Status', centerLabel: 'active' });
  renderHorizontalBars(
    chartDepartment,
    sortByCountDesc(summary.by_department || [], 'department'),
    'var(--blue)',
    'Equipment count',
    emptyMessage
  );
  renderHorizontalBars(
    chartCategory,
    sortByCountDesc(summary.by_category || [], 'category'),
    'var(--chart-teal)',
    'Equipment count',
    emptyMessage
  );
}

function showView(name) {
  inventoryView.hidden = name !== 'inventory';
  operationsView.hidden = name !== 'operations';
  requestsView.hidden = name !== 'requests';
  reportsView.hidden = name !== 'reports';
  for (const button of navButtons) {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  if (name === 'operations') {
    loadDashboardEquipment().catch(() => showOperationsBanner('Could not reach the server.', true));
    loadRequests().catch(() => showRequestBanner('Could not reach the server.', true));
  }
  if (name === 'reports') {
    loadReports().catch(() => showReportsBanner('Could not reach the server.', true));
  }
}

function renderMetrics(summary) {
  const values = {
    'metric-total': summary.total,
    'metric-in-service': summary.in_service,
    'metric-under-maintenance': summary.in_repair,
    'metric-out-of-service': summary.out_of_service,
    'metric-decommissioned': summary.decommissioned,
    'metric-due-soon': summary.due_soon,
    'metric-overdue': summary.overdue
  };
  for (const [id, value] of Object.entries(values)) {
    document.querySelector(`#${id}`).textContent = value;
  }

  document.querySelector('[data-metric="due_soon"]').classList.toggle('has-count', summary.due_soon > 0);
  document.querySelector('[data-metric="overdue"]').classList.toggle('has-count', summary.overdue > 0);

  const selected = departmentFilter.value;
  const departments = summary.departments || [];
  const options = ['<option value="">All clinical departments</option>'];
  const names = new Set(departments);
  if (selected) names.add(selected);
  for (const name of [...names].sort((left, right) => left.localeCompare(right))) {
    const selectedAttr = name === selected ? ' selected' : '';
    options.push(`<option${selectedAttr}>${escapeHtml(name)}</option>`);
  }
  departmentFilter.innerHTML = options.join('');
}

function emptyRow(columns, message) {
  return `<tr><td colspan="${columns}" class="empty"><div class="empty-state"><p>${escapeHtml(message)}</p></div></td></tr>`;
}

function equipmentRowClass(row) {
  if (row.maintenance_status === 'Overdue' || row.operational_status === 'Out of Service') return 'row-alert';
  if (row.maintenance_status === 'Due' || row.operational_status === 'In Repair') return 'row-warn';
  if (row.operational_status === 'Decommissioned') return 'row-muted';
  return '';
}

function renderTable(rows) {
  records = rows;
  const noun = rows.length === 1 ? 'record' : 'records';
  resultCount.textContent = `Showing ${rows.length} ${noun}`;
  if (!rows.length) {
    const message = filtersActive()
      ? 'No devices match these filters.'
      : 'No devices yet. Add a device to start tracking PM dates.';
    tbody.innerHTML = emptyRow(6, message);
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr class="record-row ${equipmentRowClass(row)}" data-id="${row.id}" tabindex="0">
      <td>
        <div class="equip-name">${escapeHtml(row.equipment_name)}</div>
        <div class="equip-meta"><span class="tag">${escapeHtml(row.asset_tag)}</span> · ${escapeHtml(row.manufacturer)} ${escapeHtml(row.model_number)}</div>
      </td>
      <td class="nowrap">${escapeHtml(row.department)}</td>
      <td class="nowrap">${showDate(row.last_maintenance_date)}</td>
      <td class="nowrap">${showDate(row.next_maintenance_date)}${row.pm_interval ? `<div class="equip-meta">${escapeHtml(row.pm_interval)}</div>` : ''}</td>
      <td><span class="badge ${statusClass(row.maintenance_status)}">${escapeHtml(row.maintenance_status)}</span></td>
      <td class="service"><span class="op ${opClass(row.operational_status)}">${escapeHtml(row.operational_status)}</span></td>
    </tr>
  `).join('');
}

async function loadSummary() {
  const response = await fetch('/api/summary');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.errors?.form || 'Could not load inventory totals.';
    showBanner(message, true);
    showOperationsBanner(message, true);
    for (const host of [chartOperational, chartPm, chartDepartment, chartCategory, chartMostRequests, chartRequestDepartment, chartRequestCategory, openWorkAge, attentionList]) {
      setChartMessage(host, message);
    }
    return;
  }
  clearOperationsBanner();
  renderMetrics(data);
  if (dashboardEquipment && dashboardRequests) applyDashboard();
  else if (!dashboardFiltersActive()) renderOperations(data);
}

async function loadEquipment() {
  const params = listParams();
  const query = params.toString();
  const response = await fetch(`/api/equipment${query ? `?${query}` : ''}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.errors?.form || data.errors?.maintenance_status || 'Could not load device records.';
    tbody.innerHTML = emptyRow(6, message);
    resultCount.textContent = '';
    showBanner(message, true);
    return;
  }
  if (banner.classList.contains('error')) clearBanner();
  renderTable(data);
}

function openCreate() {
  form.reset();
  form.dataset.id = '';
  formTitle.textContent = 'Add device';
  clearFieldErrors();
  formDialog.showModal();
  form.elements.equipment_name.focus();
}

async function openEdit(id) {
  clearBanner();
  const response = await fetch(`/api/equipment/${id}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    showBanner(data.errors?.form || 'Could not open that device record.', true);
    return;
  }
  form.reset();
  form.dataset.id = String(data.id);
  formTitle.textContent = 'Edit device';
  clearFieldErrors();
  for (const name of FIELD_NAMES) {
    form.elements[name].value = data[name] || '';
  }
  formDialog.showModal();
  form.elements.equipment_name.focus();
}

function clearHistoryErrors() {
  historyMessage.hidden = true;
  historyMessage.textContent = '';
  historyMessage.classList.remove('error');
  for (const name of [...HISTORY_FIELDS, 'history_operational_status', 'history_next_maintenance_date']) {
    const field = name === 'history_next_maintenance_date'
      ? historyForm.elements.next_maintenance_date
      : name === 'history_operational_status'
        ? historyForm.elements.operational_status
        : historyForm.elements[name];
    const error = document.querySelector(`#${name}-error`);
    field.removeAttribute('aria-invalid');
    error.textContent = '';
  }
}

function showHistoryErrors(errors) {
  clearHistoryErrors();
  const entries = Object.entries(errors || {});
  if (!entries.length) return;
  let focused = false;
  for (const [name, message] of entries) {
    const fieldName = name === 'next_maintenance_date'
      ? 'history_next_maintenance_date'
      : name === 'operational_status'
        ? 'history_operational_status'
        : name;
    const field = name === 'next_maintenance_date'
      ? historyForm.elements.next_maintenance_date
      : name === 'operational_status'
        ? historyForm.elements.operational_status
        : historyForm.elements[name];
    const error = document.querySelector(`#${fieldName}-error`);
    if (!field || !error) {
      historyMessage.hidden = false;
      historyMessage.textContent = message;
      historyMessage.classList.add('error');
      continue;
    }
    field.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    if (!focused) {
      field.focus();
      focused = true;
    }
  }
}

function fillFacts(equipment) {
  const rows = [
    ['Asset tag', equipment.asset_tag],
    ['Serial number', equipment.serial_number],
    ['Manufacturer', equipment.manufacturer],
    ['Model number', equipment.model_number],
    ['Device category', equipment.category],
    ['Clinical department', equipment.department],
    ['PM schedule', equipment.pm_interval || 'Not set'],
    ['Last PM date', showDate(equipment.last_maintenance_date)],
    ['Next PM due date', showDate(equipment.next_maintenance_date)],
    ['Notes', equipment.notes || 'None']
  ];
  deviceFacts.innerHTML = rows.map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${label === 'Last PM date' || label === 'Next PM due date' ? value : escapeHtml(value)}</dd>
    </div>
  `).join('') + `
    <div>
      <dt>Operational status</dt>
      <dd><span class="op ${opClass(equipment.operational_status)}">${escapeHtml(equipment.operational_status)}</span></dd>
    </div>
    <div>
      <dt>PM status</dt>
      <dd><span class="badge ${statusClass(equipment.maintenance_status)}">${escapeHtml(equipment.maintenance_status)}</span></dd>
    </div>
  `;
}

function showHistoryNote(message, isError) {
  historyMessage.hidden = false;
  historyMessage.textContent = message;
  historyMessage.classList.toggle('error', Boolean(isError));
}

function renderHistory(rows) {
  if (!rows.length) {
    historyList.innerHTML = '<div class="empty-state"><p>No equipment history yet.</p></div>';
    return;
  }
  historyList.innerHTML = `<ol class="timeline">${rows.map((row) => `
    <li class="history-item">
      <div class="timeline-date">${showDate(row.maintenance_date)}</div>
      <div>
        <strong>${escapeHtml(row.maintenance_type)}</strong>
        ${row.performed_by ? `<p>${escapeHtml(row.performed_by)}${row.performed_by_type ? ` · ${escapeHtml(row.performed_by_type)}` : ''}</p>` : ''}
        ${row.operational_status ? `<p>Status after check: ${escapeHtml(row.operational_status)}</p>` : ''}
        ${row.remarks ? `<p>${escapeHtml(row.remarks)}</p>` : ''}
      </div>
    </li>
  `).join('')}</ol>`;
}

async function openHistory(id) {
  clearBanner();
  const [equipmentResponse, historyResponse] = await Promise.all([
    fetch(`/api/equipment/${id}`),
    fetch(`/api/equipment/${id}/maintenance`)
  ]);
  const equipment = await equipmentResponse.json().catch(() => ({}));
  const history = await historyResponse.json().catch(() => ({}));
  if (!equipmentResponse.ok) {
    showBanner(equipment.errors?.form || 'Could not open equipment history.', true);
    return;
  }
  if (!historyResponse.ok) {
    showBanner(history.errors?.form || 'Could not open equipment history.', true);
    return;
  }
  historyEquipment = equipment;
  historyForm.reset();
  historyForm.elements.maintenance_date.max = todayString();
  historyForm.elements.next_maintenance_date.value = equipment.next_maintenance_date || '';
  historyForm.elements.operational_status.value = equipment.operational_status || 'In Service';
  clearHistoryErrors();
  historyTitle.textContent = `${equipment.equipment_name} ${equipment.asset_tag}`;
  historyMeta.textContent = '';
  fillFacts(equipment);
  renderHistory(history);
  historyDialog.showModal();
}

function validateHistory(data) {
  const errors = {};
  if (!data.performed_by) errors.performed_by = 'Enter who performed the service.';
  else if (data.performed_by.length > 100) errors.performed_by = 'Name must be 100 characters or fewer.';
  if (!ENGINEER_TYPES.includes(data.performed_by_type)) {
    errors.performed_by_type = 'Select in-house engineer or supplier engineer.';
  }
  if (!OPERATIONAL_STATUSES.includes(data.operational_status)) {
    errors.operational_status = 'Select the operational status after this check.';
  }
  if (!data.maintenance_type) errors.maintenance_type = 'Work type is required.';
  else if (!MAINTENANCE_TYPES.includes(data.maintenance_type)) {
    errors.maintenance_type = 'Select a valid work type.';
  }
  if (!data.maintenance_date) errors.maintenance_date = 'Service date is required.';
  else if (!isRealDate(data.maintenance_date)) errors.maintenance_date = 'Service date must be a valid date.';
  else if (data.maintenance_date > todayString()) errors.maintenance_date = 'Service date cannot be in the future.';
  if (data.next_maintenance_date && !isRealDate(data.next_maintenance_date)) {
    errors.next_maintenance_date = 'Next PM due date must be a valid date.';
  } else if (
    data.maintenance_date &&
    data.next_maintenance_date &&
    isRealDate(data.maintenance_date) &&
    isRealDate(data.next_maintenance_date) &&
    data.maintenance_date > data.next_maintenance_date
  ) {
    errors.next_maintenance_date = 'Next PM due date must be on or after the service date.';
  }
  if (data.remarks.length > 1000) errors.remarks = 'Findings must be 1000 characters or fewer.';
  if (data.operational_status && data.operational_status !== 'In Service' && !data.remarks) {
    errors.remarks = 'Enter the findings that explain this operational status.';
  }
  return errors;
}

async function saveHistory(event) {
  event.preventDefault();
  const data = {
    maintenance_type: historyForm.elements.maintenance_type.value.trim(),
    maintenance_date: historyForm.elements.maintenance_date.value.trim(),
    performed_by: historyForm.elements.performed_by.value.trim(),
    performed_by_type: historyForm.elements.performed_by_type.value.trim(),
    operational_status: historyForm.elements.operational_status.value.trim(),
    next_maintenance_date: historyForm.elements.next_maintenance_date.value.trim(),
    remarks: historyForm.elements.remarks.value.trim()
  };
  const errors = validateHistory(data);
  if (Object.keys(errors).length) {
    showHistoryErrors(errors);
    return;
  }

  const response = await fetch(`/api/equipment/${historyEquipment.id}/maintenance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    showHistoryErrors(payload.errors || { form: 'Could not save the service record.' });
    return;
  }

  historyEquipment = payload.equipment;
  historyForm.elements.maintenance_type.value = '';
  historyForm.elements.maintenance_date.value = '';
  historyForm.elements.performed_by.value = '';
  historyForm.elements.performed_by_type.value = '';
  historyForm.elements.remarks.value = '';
  historyForm.elements.next_maintenance_date.value = payload.equipment.next_maintenance_date || '';
  historyForm.elements.operational_status.value = payload.equipment.operational_status || 'In Service';
  clearHistoryErrors();
  fillFacts(payload.equipment);
  showHistoryNote('Service record saved.', false);
  const historyResponse = await fetch(`/api/equipment/${historyEquipment.id}/maintenance`);
  const history = await historyResponse.json().catch(() => ({}));
  if (historyResponse.ok) renderHistory(history);
  await Promise.all([loadSummary(), loadEquipment()]);
}

async function saveEquipment(event) {
  event.preventDefault();
  const data = readForm();
  const errors = validateForm(data);
  if (Object.keys(errors).length) {
    showErrors(errors);
    return;
  }

  const id = form.dataset.id;
  const response = await fetch(id ? `/api/equipment/${id}` : '/api/equipment', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    showErrors(payload.errors || { form: 'Could not save the device record.' });
    return;
  }

  formDialog.close();
  showBanner(`${payload.equipment_name} ${payload.asset_tag} saved. Status: ${payload.maintenance_status}.`, false);
  await Promise.all([loadSummary(), loadEquipment()]);
}

function resetFilters() {
  clearTimeout(searchTimer);
  searchInput.value = '';
  maintenanceFilter.value = '';
  serviceFilter.value = '';
  categoryFilter.value = '';
  scheduleFilter.value = '';
  departmentFilter.value = '';
  highlightMetrics();
  loadEquipment().catch(() => showBanner('Could not reach the server.', true));
}

searchForm.addEventListener('submit', (event) => event.preventDefault());
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    loadEquipment().catch(() => showBanner('Could not reach the server.', true));
  }, 250);
});

for (const select of [maintenanceFilter, serviceFilter, categoryFilter, scheduleFilter, departmentFilter]) {
  select.addEventListener('change', () => {
    highlightMetrics();
    loadEquipment().catch(() => showBanner('Could not reach the server.', true));
  });
}

for (const card of metricButtons) {
  card.addEventListener('click', () => applyMetric(card.dataset.metric));
}

for (const button of navButtons) {
  button.addEventListener('click', () => showView(button.dataset.view));
}

function applyEquipmentSchedule() {
  const last = form.elements.last_maintenance_date.value;
  const interval = form.elements.pm_interval.value;
  if (last && PM_INTERVALS[interval] && isRealDate(last)) {
    form.elements.next_maintenance_date.value = addMonths(last, PM_INTERVALS[interval]);
  }
}

function applyHistorySchedule() {
  if (!historyEquipment || !PM_INTERVALS[historyEquipment.pm_interval]) return;
  const type = historyForm.elements.maintenance_type.value;
  const serviceDate = historyForm.elements.maintenance_date.value;
  if (!PM_SCHEDULE_TYPES.includes(type) || !isRealDate(serviceDate)) return;
  historyForm.elements.next_maintenance_date.value = addMonths(serviceDate, PM_INTERVALS[historyEquipment.pm_interval]);
}

form.elements.pm_interval.addEventListener('change', applyEquipmentSchedule);
form.elements.last_maintenance_date.addEventListener('change', applyEquipmentSchedule);
historyForm.elements.maintenance_type.addEventListener('change', applyHistorySchedule);
historyForm.elements.maintenance_date.addEventListener('change', applyHistorySchedule);

document.querySelector('#reset-filters').addEventListener('click', resetFilters);
document.querySelector('#details-edit').addEventListener('click', () => {
  if (!historyEquipment) return;
  const id = historyEquipment.id;
  historyDialog.close();
  openEdit(id);
});
document.querySelector('#add-button').addEventListener('click', openCreate);
form.addEventListener('submit', (event) => {
  saveEquipment(event).catch(() => showErrors({ form: 'Could not reach the server.' }));
});
historyForm.addEventListener('submit', (event) => {
  saveHistory(event).catch(() => showHistoryErrors({ form: 'Could not reach the server.' }));
});

function openInventoryRow(id) {
  openHistory(id).catch(() => showBanner('Could not reach the server.', true));
}

tbody.addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-id]');
  if (!row || !tbody.contains(row)) return;
  openInventoryRow(Number(row.dataset.id));
});

tbody.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const row = event.target.closest('tr[data-id]');
  if (!row || event.target !== row) return;
  event.preventDefault();
  openInventoryRow(Number(row.dataset.id));
});

for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => {
    const target = button.dataset.close;
    const dialog = target === 'form' ? formDialog : target === 'request' ? requestDialog : historyDialog;
    dialog.close();
  });
}

function priorityClass(priority) {
  if (priority === 'High') return 'status-overdue';
  if (priority === 'Medium') return 'status-due';
  return 'status-not-scheduled';
}

function requestStatusClass(status) {
  return `req-${String(status).toLowerCase().replaceAll(' ', '-')}`;
}

function requestRowClass(row) {
  const active = row.status !== 'Completed' && row.status !== 'Cancelled';
  if (active && row.priority === 'High') return 'row-alert';
  if (row.status === 'Waiting for Parts') return 'row-warn';
  if (row.status === 'Cancelled') return 'row-muted';
  return '';
}

function showRequestBanner(message, isError) {
  for (const banner of [requestsBanner, opsRequestsBanner]) {
    banner.hidden = false;
    banner.textContent = message;
    banner.classList.toggle('error', Boolean(isError));
  }
}

function clearRequestBanner() {
  for (const banner of [requestsBanner, opsRequestsBanner]) {
    banner.hidden = true;
    banner.textContent = '';
    banner.classList.remove('error');
  }
}

function renderRequestMetrics(rows) {
  const summary = DashboardFilter.summarizeWork(rows, todayString());
  const values = {
    'ops-requests-open': summary.open,
    'ops-requests-progress': summary.in_progress,
    'ops-requests-parts': summary.waiting_for_parts,
    'ops-requests-completed': summary.completed_this_month,
    'ops-open-work': summary.open_work,
    'ops-high-priority': summary.high_priority_open_work,
    'ops-oldest-age': summary.oldest_open_age == null ? '—' : summary.oldest_open_age
  };
  for (const [id, value] of Object.entries(values)) {
    document.querySelector(`#${id}`).textContent = value;
  }
  document.querySelector('#ops-requests-parts-card').classList.toggle('has-count', summary.waiting_for_parts > 0);
  document.querySelector('#ops-high-priority-card').classList.toggle('has-count', summary.high_priority_open_work > 0);
  document.querySelector('#ops-oldest-age-card').classList.toggle('has-count', (summary.oldest_open_age ?? 0) >= 7);
  renderDonut(chartRequests, countLabeled(rows, 'status', [
    { label: 'Open', color: 'var(--chart-open)' },
    { label: 'In Progress', color: 'var(--ok)' },
    { label: 'Waiting for Parts', color: 'var(--chart-amber)' },
    { label: 'Completed', color: 'var(--blue)' },
    { label: 'Cancelled', color: 'var(--chart-gray)' }
  ]), { title: 'Service Request Status', centerLabel: 'requests' });
  renderColumnChart(chartPriority, countLabeled(rows, 'priority', [
    { label: 'High', color: 'var(--danger)' },
    { label: 'Medium', color: 'var(--chart-amber)' },
    { label: 'Low', color: 'var(--chart-open)' }
  ]), 'Service Request Priority');
}

function statusOptions(selected) {
  return REQUEST_STATUSES.map((status) => {
    const selectedAttr = status === selected ? ' selected' : '';
    return `<option${selectedAttr}>${escapeHtml(status)}</option>`;
  }).join('');
}

function renderRequestTable(rows) {
  const noun = rows.length === 1 ? 'request' : 'requests';
  requestCount.textContent = `Showing ${rows.length} ${noun}`;
  if (!rows.length) {
    const message = requestStatusFilter.value
      ? 'No requests match this status.'
      : 'No service requests yet.';
    requestsBody.innerHTML = emptyRow(8, message);
    return;
  }
  requestsBody.innerHTML = rows.map((row) => `
    <tr class="${requestRowClass(row)}">
      <td class="nowrap">${escapeHtml(row.request_number)}</td>
      <td>
        <div class="equip-name">${escapeHtml(row.equipment_name)}</div>
        <div class="equip-meta"><span class="tag">${escapeHtml(row.asset_tag)}</span></div>
      </td>
      <td>${escapeHtml(row.reported_by)}</td>
      <td><span class="badge ${priorityClass(row.priority)}">${escapeHtml(row.priority)}</span></td>
      <td class="problem-cell">${escapeHtml(row.problem)}</td>
      <td>
        <select class="status-select ${requestStatusClass(row.status)}" data-request-id="${row.id}" aria-label="Status for ${escapeHtml(row.request_number)}">
          ${statusOptions(row.status)}
        </select>
      </td>
      <td class="nowrap">${showDate(row.opened_on)}</td>
      <td class="nowrap">${showDate(row.closed_on)}</td>
    </tr>
  `).join('');
}

async function loadRequests() {
  const response = await fetch('/api/service-requests');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.errors?.form || data.errors?.status || 'Could not load service requests.';
    showRequestBanner(message, true);
    requestsBody.innerHTML = emptyRow(8, message);
    requestCount.textContent = '';
    setChartMessage(chartRequests, message);
    setChartMessage(chartPriority, message);
    for (const host of [chartMostRequests, chartRequestDepartment, chartRequestCategory, openWorkAge, attentionList]) {
      setChartMessage(host, message);
    }
    dashboardRequests = null;
    return;
  }
  clearRequestBanner();
  dashboardRequests = data;
  if (dashboardEquipment) applyDashboard();
  else if (!dashboardFiltersActive()) renderRequestMetrics(data);
  const status = requestStatusFilter.value;
  if (!status) {
    renderRequestTable(data);
    return;
  }
  const filteredResponse = await fetch(`/api/service-requests?status=${encodeURIComponent(status)}`);
  const filtered = await filteredResponse.json().catch(() => ({}));
  if (!filteredResponse.ok) {
    const message = filtered.errors?.status || filtered.errors?.form || 'Could not filter service requests.';
    showRequestBanner(message, true);
    return;
  }
  renderRequestTable(filtered);
}

function clearRequestErrors() {
  requestFormError.hidden = true;
  requestFormError.textContent = '';
  for (const name of REQUEST_FIELDS) {
    requestForm.elements[name].removeAttribute('aria-invalid');
    document.querySelector(`#${name}-error`).textContent = '';
  }
}

function showRequestErrors(errors) {
  clearRequestErrors();
  const entries = Object.entries(errors || {});
  if (!entries.length) return;
  for (const [name, message] of entries) {
    if (name === 'form' || !requestForm.elements[name]) {
      requestFormError.hidden = false;
      requestFormError.textContent = message;
      continue;
    }
    requestForm.elements[name].setAttribute('aria-invalid', 'true');
    document.querySelector(`#${name}-error`).textContent = message;
  }
  const firstInvalid = requestForm.querySelector('[aria-invalid="true"]');
  if (firstInvalid) firstInvalid.focus();
}

function validateRequest(data) {
  const errors = {};
  if (!data.equipment_id) errors.equipment_id = 'Select a device.';
  if (!data.reported_by) errors.reported_by = 'Enter who reported the problem.';
  else if (data.reported_by.length > 100) errors.reported_by = 'Name must be 100 characters or fewer.';
  if (!REQUEST_PRIORITIES.includes(data.priority)) errors.priority = 'Select a priority: low, medium, or high.';
  if (!data.problem) errors.problem = 'Problem description is required.';
  else if (data.problem.length > 1000) errors.problem = 'Problem description must be 1000 characters or fewer.';
  if (!data.opened_on) errors.opened_on = 'Date opened is required.';
  else if (!isRealDate(data.opened_on)) errors.opened_on = 'Date opened must be a valid date.';
  else if (data.opened_on > todayString()) errors.opened_on = 'Date opened cannot be in the future.';
  return errors;
}

async function openRequestForm() {
  clearRequestBanner();
  const response = await fetch('/api/equipment');
  const devices = await response.json().catch(() => ({}));
  if (!response.ok) {
    showRequestBanner(devices.errors?.form || 'Could not load devices for a new request.', true);
    return;
  }
  const options = ['<option value="">Select a device</option>'];
  for (const device of devices) {
    options.push(
      `<option value="${device.id}">${escapeHtml(device.equipment_name)} (${escapeHtml(device.asset_tag)})</option>`
    );
  }
  requestForm.elements.equipment_id.innerHTML = options.join('');
  requestForm.reset();
  requestForm.elements.opened_on.value = todayString();
  requestForm.elements.opened_on.max = todayString();
  clearRequestErrors();
  requestDialog.showModal();
  requestForm.elements.equipment_id.focus();
}

async function saveRequest(event) {
  event.preventDefault();
  const data = {
    equipment_id: requestForm.elements.equipment_id.value.trim(),
    reported_by: requestForm.elements.reported_by.value.trim(),
    priority: requestForm.elements.priority.value.trim(),
    problem: requestForm.elements.problem.value.trim(),
    opened_on: requestForm.elements.opened_on.value.trim()
  };
  const errors = validateRequest(data);
  if (Object.keys(errors).length) {
    showRequestErrors(errors);
    return;
  }
  const response = await fetch('/api/service-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    showRequestErrors(payload.errors || { form: 'Could not save the service request.' });
    return;
  }
  requestDialog.close();
  await loadRequests();
  showRequestBanner(`${payload.request_number} saved.`, false);
}

async function updateRequestStatus(select) {
  const id = select.dataset.requestId;
  const status = select.value;
  const response = await fetch(`/api/service-requests/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    await loadRequests();
    showRequestBanner(payload.errors?.status || payload.errors?.form || 'Could not update the request status.', true);
    return;
  }
  await loadRequests();
  showRequestBanner(`${payload.request_number} is ${payload.status}.`, false);
}

document.querySelector('#request-filter-form').addEventListener('submit', (event) => event.preventDefault());
requestStatusFilter.addEventListener('change', () => {
  loadRequests().catch(() => showRequestBanner('Could not reach the server.', true));
});
document.querySelector('#add-request-button').addEventListener('click', () => {
  openRequestForm().catch(() => showRequestBanner('Could not reach the server.', true));
});
requestForm.addEventListener('submit', (event) => {
  saveRequest(event).catch(() => showRequestErrors({ form: 'Could not reach the server.' }));
});
requestsBody.addEventListener('change', (event) => {
  const select = event.target.closest('select[data-request-id]');
  if (!select) return;
  updateRequestStatus(select).catch(() => showRequestBanner('Could not reach the server.', true));
});

const REPORT_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatGeneratedDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!match) return iso || '';
  const month = REPORT_MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

function showReportsBanner(message, isError) {
  reportsBanner.hidden = false;
  reportsBanner.textContent = message;
  reportsBanner.classList.toggle('error', Boolean(isError));
}

function clearReportsBanner() {
  reportsBanner.hidden = true;
  reportsBanner.textContent = '';
  reportsBanner.classList.remove('error');
}

function renderReportCenter(reports) {
  if (!reports.length) {
    reportCenter.innerHTML = '<div class="empty-state"><p>No reports are available.</p></div>';
    return;
  }

  const groups = [];
  for (const report of reports) {
    let group = groups.find((item) => item.section === report.section);
    if (!group) {
      group = { section: report.section, reports: [] };
      groups.push(group);
    }
    group.reports.push(report);
  }

  reportCenter.innerHTML = groups.map((group) => {
    const headingId = `report-section-${group.section.toLowerCase().replaceAll(' ', '-')}`;
    const cards = group.reports.map((report) => `
      <article class="report-card">
        <div>
          <span class="file-chip">CSV</span>
          <h4>${escapeHtml(report.name)}</h4>
          <p>${escapeHtml(report.description)}</p>
          <p class="report-meta">Generated ${escapeHtml(formatGeneratedDate(report.generated_on))} · ${escapeHtml(report.filename)}</p>
        </div>
        <button type="button" class="button primary" data-report-id="${escapeHtml(report.id)}" aria-label="Download ${escapeHtml(report.name)}">Download</button>
      </article>
    `).join('');
    return `
      <section class="report-group" aria-labelledby="${headingId}">
        <h3 id="${headingId}" class="dash-section">${escapeHtml(group.section)}</h3>
        <div class="report-list">${cards}</div>
      </section>
    `;
  }).join('');
}

async function loadReports() {
  const response = await fetch('/api/reports');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.errors?.form || 'Could not load reports.';
    showReportsBanner(message, true);
    reportCatalog = [];
    reportCenter.innerHTML = `<div class="empty-state"><p>${escapeHtml(message)}</p></div>`;
    return;
  }
  clearReportsBanner();
  reportCatalog = data.reports || [];
  renderReportCenter(reportCatalog);
}

async function downloadReport(id, button) {
  const report = reportCatalog.find((item) => item.id === id);
  if (!report) return;
  button.disabled = true;
  try {
    const response = await fetch(`/api/reports/${encodeURIComponent(id)}`);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      showReportsBanner(data.errors?.form || 'Could not download the report.', true);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = report.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    clearReportsBanner();
  } finally {
    button.disabled = false;
  }
}

reportCenter.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-report-id]');
  if (!button) return;
  downloadReport(button.dataset.reportId, button).catch(() => {
    showReportsBanner('Could not reach the server.', true);
  });
});

const DASHBOARD_FILTER_LABELS = {
  department: 'Clinical department',
  category: 'Device category',
  operational_status: 'Operational status',
  request_status: 'Service request status'
};

function dashboardFiltersActive() {
  return Object.values(dashboardFilters).some(Boolean);
}

function slicerChoices(key) {
  if (key === 'department') {
    const names = new Set((dashboardEquipment || []).map((device) => device.department).filter(Boolean));
    if (dashboardFilters.department) names.add(dashboardFilters.department);
    return [...names].sort((left, right) => left.localeCompare(right)).map((name) => ({ value: name, label: name }));
  }
  if (key === 'category') return CATEGORIES.map((name) => ({ value: name, label: name }));
  if (key === 'operational_status') return OPERATIONAL_STATUSES.map((name) => ({ value: name, label: name }));
  return REQUEST_STATUSES.map((name) => ({ value: name, label: name }));
}

function slicerButton(key, value, label, selected) {
  const active = selected ? ' active' : '';
  return `<button type="button" class="slicer-option${active}" data-slicer="${escapeHtml(key)}" data-value="${escapeHtml(value)}" aria-pressed="${selected ? 'true' : 'false'}">${escapeHtml(label)}</button>`;
}

function syncSlicer(host, key) {
  const selected = dashboardFilters[key];
  const options = [{ value: '', label: 'All' }, ...slicerChoices(key)];
  const signature = options.map((option) => `${option.value}\t${option.label}`).join('\n');
  if (host.dataset.signature !== signature) {
    host.dataset.signature = signature;
    host.innerHTML = `
      <span class="slicer-label" id="${host.id}-label">${escapeHtml(host.dataset.label)}</span>
      <div class="slicer-options" role="group" aria-labelledby="${host.id}-label">
        ${options.map((option) => slicerButton(key, option.value, option.label, option.value === selected)).join('')}
      </div>
    `;
    return;
  }
  for (const button of host.querySelectorAll('.slicer-option')) {
    const active = button.dataset.value === selected;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}

function renderDashboardSlicers() {
  syncSlicer(document.querySelector('#slicer-department'), 'department');
  syncSlicer(document.querySelector('#slicer-category'), 'category');
  syncSlicer(document.querySelector('#slicer-operational'), 'operational_status');
  syncSlicer(document.querySelector('#slicer-request'), 'request_status');
}

function renderActiveFilters(equipmentCount, requestCount) {
  const host = document.querySelector('#dashboard-active-filters');
  const reset = document.querySelector('#reset-dashboard-filters');
  const entries = Object.entries(DASHBOARD_FILTER_LABELS).filter(([key]) => dashboardFilters[key]);
  reset.disabled = entries.length === 0;
  if (!entries.length) {
    host.hidden = true;
    host.innerHTML = '';
    return;
  }
  host.hidden = false;
  const chips = entries.map(([key, label]) => `
    <span class="filter-chip">${escapeHtml(label)}: ${escapeHtml(dashboardFilters[key])}
      <button type="button" data-clear-filter="${escapeHtml(key)}" aria-label="Clear ${escapeHtml(label)} filter">×</button>
    </span>
  `).join('');
  const counts = equipmentCount == null
    ? ''
    : `<span class="filter-result">${equipmentCount} ${equipmentCount === 1 ? 'device' : 'devices'} · ${requestCount} ${requestCount === 1 ? 'request' : 'requests'}</span>`;
  host.innerHTML = chips + counts;
}

function renderSupportTable(host, headers, rows, emptyMessage) {
  if (!host) return;
  if (!rows.length) {
    setChartMessage(host, emptyMessage);
    return;
  }
  const head = headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('');
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
  host.innerHTML = `<table class="compact-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderSupport(equipment, requests, emptyMessage) {
  const support = DashboardFilter.summarizeSupport(equipment, requests, todayString());
  document.querySelector('#ops-requests-per-device').textContent = formatRequestsPerDevice(support.requests_per_active);
  const requestMessage = emptyMessage === 'No devices yet.'
    ? 'No service requests yet.'
    : 'No service requests for this selection.';
  renderHorizontalBars(
    chartMostRequests,
    support.most_requests,
    'var(--chart-amber)',
    'Service requests',
    requestMessage
  );
  renderHorizontalBars(
    chartRequestDepartment,
    support.by_department,
    'var(--blue)',
    'Service requests',
    emptyMessage
  );
  renderHorizontalBars(
    chartRequestCategory,
    support.by_category,
    'var(--chart-teal)',
    'Service requests',
    emptyMessage
  );
  renderSupportTable(
    openWorkAge,
    ['Request', 'Equipment', 'Status', 'Priority', 'Age (days)'],
    support.open_work.map((row) => [
      escapeHtml(row.request_number),
      `${escapeHtml(row.equipment_name)} <span class="tag">${escapeHtml(row.asset_tag)}</span>`,
      `<span class="badge ${statusClass(row.status)}">${escapeHtml(row.status)}</span>`,
      `<span class="badge ${priorityClass(row.priority)}">${escapeHtml(row.priority)}</span>`,
      row.age == null ? '—' : `<span class="${Number(row.age) >= 7 ? 'age-warn' : ''}">${escapeHtml(row.age)}</span>`
    ]),
    'No open work for this selection.'
  );
  renderSupportTable(
    attentionList,
    ['Device', 'Department', 'Requests', 'Corrective visits'],
    support.attention.map((row) => [
      `${escapeHtml(row.equipment_name)} <span class="tag">${escapeHtml(row.asset_tag)}</span>`,
      escapeHtml(row.department),
      escapeHtml(row.requests),
      escapeHtml(row.corrective)
    ]),
    'No equipment has two or more requests or two or more corrective visits.'
  );
}

function applyDashboard() {
  renderDashboardSlicers();
  if (!dashboardEquipment || !dashboardRequests) {
    renderActiveFilters(null, null);
    return;
  }
  const filtered = DashboardFilter.filterDashboard(dashboardEquipment, dashboardRequests, dashboardFilters);
  const summary = DashboardFilter.summarizeEquipment(filtered.equipment);
  const emptyMessage = dashboardFiltersActive() ? 'No devices match these filters.' : 'No devices yet.';
  renderOperations(summary, emptyMessage);
  renderRequestMetrics(filtered.requests);
  renderSupport(filtered.equipment, filtered.requests, emptyMessage);
  renderActiveFilters(filtered.equipment.length, filtered.requests.length);
}

async function loadDashboardEquipment() {
  const response = await fetch('/api/equipment');
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data)) {
    const message = data.errors?.form || 'Could not load dashboard equipment.';
    showOperationsBanner(message, true);
    dashboardEquipment = null;
    for (const host of [chartOperational, chartPm, chartDepartment, chartCategory, chartMostRequests, chartRequestDepartment, chartRequestCategory, openWorkAge, attentionList]) {
      setChartMessage(host, message);
    }
    return;
  }
  dashboardEquipment = data;
  clearOperationsBanner();
  applyDashboard();
}

function resetDashboardFilters() {
  dashboardFilters.department = '';
  dashboardFilters.category = '';
  dashboardFilters.operational_status = '';
  dashboardFilters.request_status = '';
  applyDashboard();
}

document.querySelector('#dashboard-filters').addEventListener('click', (event) => {
  if (event.target.closest('#reset-dashboard-filters')) {
    resetDashboardFilters();
    return;
  }
  const clear = event.target.closest('[data-clear-filter]');
  if (clear) {
    dashboardFilters[clear.dataset.clearFilter] = '';
    applyDashboard();
    return;
  }
  const option = event.target.closest('[data-slicer]');
  if (!option) return;
  const key = option.dataset.slicer;
  const value = option.dataset.value;
  dashboardFilters[key] = !value || dashboardFilters[key] === value ? '' : value;
  applyDashboard();
});

renderDashboardSlicers();
renderActiveFilters(null, null);

Promise.all([loadSummary(), loadEquipment(), loadRequests()]).catch(() => showBanner('Could not reach the server.', true));
