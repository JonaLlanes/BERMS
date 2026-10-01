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
const metricButtons = [...document.querySelectorAll('[data-metric]')];

let records = [];
let historyEquipment = null;
let searchTimer = null;

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

function renderTable(rows) {
  records = rows;
  const noun = rows.length === 1 ? 'record' : 'records';
  resultCount.textContent = `Showing ${rows.length} ${noun}`;
  if (!rows.length) {
    const message = filtersActive()
      ? 'No devices match these filters.'
      : 'No devices yet. Add a device to start tracking PM dates.';
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${message}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>
        <div class="equip-name">
          <button type="button" class="name-button" data-action="history" data-id="${row.id}">${escapeHtml(row.equipment_name)}</button>
        </div>
        <div class="equip-meta"><span class="tag">${escapeHtml(row.asset_tag)}</span> · ${escapeHtml(row.manufacturer)} ${escapeHtml(row.model_number)}</div>
      </td>
      <td class="nowrap">${escapeHtml(row.department)}</td>
      <td class="nowrap">${showDate(row.last_maintenance_date)}</td>
      <td class="nowrap">${showDate(row.next_maintenance_date)}${row.pm_interval ? `<div class="equip-meta">${escapeHtml(row.pm_interval)}</div>` : ''}</td>
      <td><span class="badge ${statusClass(row.maintenance_status)}">${escapeHtml(row.maintenance_status)}</span></td>
      <td class="service"><span class="op ${opClass(row.operational_status)}">${escapeHtml(row.operational_status)}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="history" data-id="${row.id}">Open</button>
          <button type="button" data-action="edit" data-id="${row.id}">Edit</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadSummary() {
  const response = await fetch('/api/summary');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    showBanner(data.errors?.form || 'Could not load inventory totals.', true);
    return;
  }
  renderMetrics(data);
}

async function loadEquipment() {
  const params = listParams();
  const query = params.toString();
  const response = await fetch(`/api/equipment${query ? `?${query}` : ''}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.errors?.form || data.errors?.maintenance_status || 'Could not load device records.';
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(message)}</td></tr>`;
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
    ['Model', equipment.model_number],
    ['Category', equipment.category],
    ['Department', equipment.department],
    ['PM schedule', equipment.pm_interval || 'Not set'],
    ['Last PM', showDate(equipment.last_maintenance_date)],
    ['Next PM due', showDate(equipment.next_maintenance_date)],
    ['Notes', equipment.notes || 'None']
  ];
  deviceFacts.innerHTML = rows.map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${label === 'Last PM' || label === 'Next PM due' ? value : escapeHtml(value)}</dd>
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
    historyList.innerHTML = '<p class="empty">No service recorded for this device yet.</p>';
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
    showBanner(equipment.errors?.form || 'Could not open service history.', true);
    return;
  }
  if (!historyResponse.ok) {
    showBanner(history.errors?.form || 'Could not open service history.', true);
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

tbody.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const id = Number(button.dataset.id);
  if (button.dataset.action === 'edit') openEdit(id);
  if (button.dataset.action === 'history') {
    openHistory(id).catch(() => showBanner('Could not reach the server.', true));
  }
});

for (const button of document.querySelectorAll('[data-close]')) {
  button.addEventListener('click', () => {
    const target = button.dataset.close;
    const dialog = target === 'form' ? formDialog : historyDialog;
    dialog.close();
  });
}

Promise.all([loadSummary(), loadEquipment()]).catch(() => showBanner('Could not reach the server.', true));
