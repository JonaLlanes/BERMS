const { maintenanceStatus } = require('./maintenance');

function dateOnly(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function presentEquipment(row) {
  return {
    id: row.id,
    asset_tag: row.asset_tag,
    equipment_name: row.equipment_name,
    category: row.category,
    manufacturer: row.manufacturer,
    model_number: row.model_number,
    serial_number: row.serial_number,
    department: row.department,
    operational_status: row.operational_status,
    pm_interval: row.pm_interval,
    purchase_date: dateOnly(row.purchase_date),
    last_maintenance_date: dateOnly(row.last_maintenance_date),
    next_maintenance_date: dateOnly(row.next_maintenance_date),
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    maintenance_status: maintenanceStatus(row.next_maintenance_date),
    corrective_count: Number(row.corrective_count) || 0
  };
}

function presentServiceRequest(row) {
  return {
    id: row.id,
    request_number: row.request_number,
    equipment_id: row.equipment_id,
    equipment_name: row.equipment_name,
    asset_tag: row.asset_tag,
    department: row.department,
    reported_by: row.reported_by,
    priority: row.priority,
    problem: row.problem,
    status: row.status,
    opened_on: dateOnly(row.opened_on),
    closed_on: dateOnly(row.closed_on),
    created_at: row.created_at
  };
}

function presentHistory(row) {
  return {
    id: row.id,
    equipment_id: row.equipment_id,
    maintenance_type: row.maintenance_type,
    maintenance_date: dateOnly(row.maintenance_date),
    performed_by: row.performed_by,
    performed_by_type: row.performed_by_type,
    operational_status: row.operational_status,
    remarks: row.remarks,
    created_at: row.created_at
  };
}

module.exports = {
  presentEquipment,
  presentHistory,
  presentServiceRequest
};
