const { MAINTENANCE_STATUSES, PM_INTERVALS, nextPmDate, todayString } = require('./maintenance');
const { REQUEST_PRIORITIES, REQUEST_STATUSES } = require('./serviceRequests');
const { parseId } = require('./http');

const ENGINEER_TYPES = ['In-House Engineer', 'Supplier Engineer'];

const MAINTENANCE_TYPES = [
  'Preventive Maintenance',
  'Corrective Maintenance',
  'Incoming Inspection',
  'Electrical Safety Test',
  'Calibration'
];

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

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function optionalDate(value, label, errors, key) {
  const text = asText(value);
  if (!text) return null;
  if (!isRealDate(text)) {
    errors[key] = `${label} must be a valid date.`;
    return null;
  }
  return text;
}

function validateEquipment(body) {
  const errors = {};
  const source = body && typeof body === 'object' ? body : {};

  const equipmentName = asText(source.equipment_name);
  const assetTag = asText(source.asset_tag);
  const category = asText(source.category);
  const manufacturer = asText(source.manufacturer);
  const modelNumber = asText(source.model_number);
  const serialNumber = asText(source.serial_number);
  const department = asText(source.department);
  const operationalStatus = asText(source.operational_status) || 'In Service';
  const pmInterval = asText(source.pm_interval);
  const notes = asText(source.notes);

  if (!equipmentName) errors.equipment_name = 'Device name is required.';
  else if (equipmentName.length > 100) errors.equipment_name = 'Device name must be 100 characters or fewer.';

  if (!assetTag) errors.asset_tag = 'Asset tag is required.';
  else if (assetTag.length > 50) errors.asset_tag = 'Asset tag must be 50 characters or fewer.';

  if (!category) errors.category = 'Device category is required.';
  else if (!CATEGORIES.includes(category)) errors.category = 'Select a valid device category.';

  if (!manufacturer) errors.manufacturer = 'Manufacturer is required.';
  else if (manufacturer.length > 100) errors.manufacturer = 'Manufacturer must be 100 characters or fewer.';

  if (!modelNumber) errors.model_number = 'Model number is required.';
  else if (modelNumber.length > 100) errors.model_number = 'Model number must be 100 characters or fewer.';

  if (!serialNumber) errors.serial_number = 'Serial number is required.';
  else if (serialNumber.length > 100) errors.serial_number = 'Serial number must be 100 characters or fewer.';

  if (!department) errors.department = 'Clinical department is required.';
  else if (department.length > 100) errors.department = 'Clinical department must be 100 characters or fewer.';

  if (!OPERATIONAL_STATUSES.includes(operationalStatus)) {
    errors.operational_status = 'Select a valid operational status.';
  }

  if (operationalStatus !== 'In Service' && !asText(source.notes)) {
    errors.notes = 'Enter notes that explain why the device is not in service.';
  }

  if (pmInterval && !PM_INTERVALS.includes(pmInterval)) {
    errors.pm_interval = 'Select a PM schedule: monthly, quarterly, semi-annual, or annual.';
  }

  const purchaseDate = optionalDate(source.purchase_date, 'Purchase date', errors, 'purchase_date');
  const lastMaintenanceDate = optionalDate(
    source.last_maintenance_date,
    'Last PM date',
    errors,
    'last_maintenance_date'
  );
  const nextMaintenanceDate = optionalDate(
    source.next_maintenance_date,
    'Next PM due date',
    errors,
    'next_maintenance_date'
  );

  if (lastMaintenanceDate && lastMaintenanceDate > todayString()) {
    errors.last_maintenance_date = 'Last PM date cannot be in the future.';
  }

  const resolvedNext = !nextMaintenanceDate && pmInterval && lastMaintenanceDate && !errors.last_maintenance_date && !errors.pm_interval
    ? nextPmDate(lastMaintenanceDate, pmInterval)
    : nextMaintenanceDate;
  if (resolvedNext && resolvedNext !== nextMaintenanceDate) delete errors.next_maintenance_date;

  if (lastMaintenanceDate && resolvedNext && lastMaintenanceDate > resolvedNext) {
    errors.next_maintenance_date = 'Last PM date must be on or before the next PM due date.';
  }

  if (notes.length > 2000) errors.notes = 'Notes must be 2000 characters or fewer.';

  return {
    errors,
    value: {
      equipment_name: equipmentName,
      asset_tag: assetTag,
      category,
      manufacturer,
      model_number: modelNumber,
      serial_number: serialNumber,
      department,
      operational_status: operationalStatus,
      pm_interval: pmInterval || null,
      purchase_date: purchaseDate,
      last_maintenance_date: lastMaintenanceDate,
      next_maintenance_date: resolvedNext,
      notes: notes || null
    }
  };
}

function parseListQuery(query) {
  const errors = {};
  const source = query && typeof query === 'object' ? query : {};
  const maintenanceStatus = asText(source.maintenance_status);
  const category = asText(source.category);
  const operationalStatus = asText(source.operational_status);
  const department = asText(source.department);
  const pmInterval = asText(source.pm_interval);

  if (maintenanceStatus && !MAINTENANCE_STATUSES.includes(maintenanceStatus)) {
    errors.maintenance_status = 'Select a valid PM status.';
  }
  if (category && !CATEGORIES.includes(category)) errors.category = 'Select a valid device category.';
  if (operationalStatus && !OPERATIONAL_STATUSES.includes(operationalStatus)) {
    errors.operational_status = 'Select a valid operational status.';
  }
  if (department.length > 100) errors.department = 'Clinical department must be 100 characters or fewer.';
  if (pmInterval && !PM_INTERVALS.includes(pmInterval)) {
    errors.pm_interval = 'Select a PM schedule: monthly, quarterly, semi-annual, or annual.';
  }

  return {
    errors,
    value: {
      q: asText(source.q).slice(0, 100),
      maintenance_status: maintenanceStatus,
      category,
      operational_status: operationalStatus,
      department: department.slice(0, 100),
      pm_interval: pmInterval
    }
  };
}

function validateMaintenance(body) {
  const errors = {};
  const source = body && typeof body === 'object' ? body : {};
  const maintenanceType = asText(source.maintenance_type);
  const maintenanceDate = asText(source.maintenance_date);
  const performedBy = asText(source.performed_by);
  const performedByType = asText(source.performed_by_type);
  const remarks = asText(source.remarks);
  const operationalStatus = asText(source.operational_status);
  const hasNext = Object.prototype.hasOwnProperty.call(source, 'next_maintenance_date');

  if (!maintenanceType) errors.maintenance_type = 'Work type is required.';
  else if (!MAINTENANCE_TYPES.includes(maintenanceType)) {
    errors.maintenance_type = 'Select a valid work type.';
  }

  if (!performedBy) errors.performed_by = 'Enter who performed the service.';
  else if (performedBy.length > 100) errors.performed_by = 'Name must be 100 characters or fewer.';

  if (!ENGINEER_TYPES.includes(performedByType)) {
    errors.performed_by_type = 'Select in-house engineer or supplier engineer.';
  }

  if (!OPERATIONAL_STATUSES.includes(operationalStatus)) {
    errors.operational_status = 'Select the operational status after this check.';
  }

  if (!maintenanceDate) errors.maintenance_date = 'Service date is required.';
  else if (!isRealDate(maintenanceDate)) errors.maintenance_date = 'Service date must be a valid date.';
  else if (maintenanceDate > todayString()) {
    errors.maintenance_date = 'Service date cannot be in the future.';
  }

  let nextMaintenanceDate;
  if (hasNext) {
    nextMaintenanceDate = optionalDate(
      source.next_maintenance_date,
      'Next PM due date',
      errors,
      'next_maintenance_date'
    );
    if (
      maintenanceDate &&
      nextMaintenanceDate &&
      isRealDate(maintenanceDate) &&
      maintenanceDate > nextMaintenanceDate
    ) {
      errors.next_maintenance_date = 'Next PM due date must be on or after the service date.';
    }
  }

  if (remarks.length > 1000) errors.remarks = 'Findings must be 1000 characters or fewer.';
  if (operationalStatus && operationalStatus !== 'In Service' && !remarks) {
    errors.remarks = 'Enter the findings that explain this operational status.';
  }

  return {
    errors,
    value: {
      maintenance_type: maintenanceType,
      maintenance_date: maintenanceDate,
      performed_by: performedBy,
      performed_by_type: performedByType,
      operational_status: operationalStatus,
      remarks: remarks || null,
      next_maintenance_date: hasNext ? nextMaintenanceDate : undefined
    }
  };
}

function validateServiceRequest(body) {
  const errors = {};
  const source = body && typeof body === 'object' ? body : {};
  const equipmentId = parseId(source.equipment_id);
  const reportedBy = asText(source.reported_by);
  const priority = asText(source.priority);
  const problem = asText(source.problem);
  const openedOn = asText(source.opened_on) || todayString();

  if (!equipmentId) errors.equipment_id = 'Select a device.';
  if (!reportedBy) errors.reported_by = 'Enter who reported the problem.';
  else if (reportedBy.length > 100) errors.reported_by = 'Name must be 100 characters or fewer.';
  if (!REQUEST_PRIORITIES.includes(priority)) errors.priority = 'Select a priority: low, medium, or high.';
  if (!problem) errors.problem = 'Problem description is required.';
  else if (problem.length > 1000) errors.problem = 'Problem description must be 1000 characters or fewer.';
  if (!isRealDate(openedOn)) errors.opened_on = 'Date opened must be a valid date.';
  else if (openedOn > todayString()) errors.opened_on = 'Date opened cannot be in the future.';

  return {
    errors,
    value: {
      equipment_id: equipmentId,
      reported_by: reportedBy,
      priority,
      problem,
      opened_on: openedOn
    }
  };
}

function parseRequestQuery(query) {
  const errors = {};
  const source = query && typeof query === 'object' ? query : {};
  const status = asText(source.status);
  if (status && !REQUEST_STATUSES.includes(status)) errors.status = 'Select a valid request status.';
  return { errors, value: { status } };
}

function validateRequestStatus(body) {
  const errors = {};
  const source = body && typeof body === 'object' ? body : {};
  const status = asText(source.status);
  if (!REQUEST_STATUSES.includes(status)) errors.status = 'Select a valid request status.';
  return { errors, value: { status } };
}

module.exports = {
  CATEGORIES,
  OPERATIONAL_STATUSES,
  MAINTENANCE_TYPES,
  ENGINEER_TYPES,
  validateEquipment,
  parseListQuery,
  validateMaintenance,
  validateServiceRequest,
  parseRequestQuery,
  validateRequestStatus
};
