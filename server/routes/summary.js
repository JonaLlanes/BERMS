const express = require('express');
const pool = require('../db');
const { sendDbError } = require('../http');
const { maintenanceStatus } = require('../maintenance');

const EQUIPMENT_SUMMARY_SQL =
  'SELECT operational_status, next_maintenance_date, department, category FROM equipment';

const router = express.Router();

function countGroups(counts) {
  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([name, count]) => ({ name, count }));
}

function buildEquipmentSummary(rows) {
  const summary = {
    total: rows.length,
    in_service: 0,
    in_repair: 0,
    out_of_service: 0,
    decommissioned: 0,
    due_soon: 0,
    overdue: 0,
    current: 0,
    not_scheduled: 0,
    departments: [],
    by_department: [],
    by_category: []
  };
  const departments = new Set();
  const departmentCounts = new Map();
  const categoryCounts = new Map();

  for (const row of rows) {
    if (row.operational_status === 'In Service') summary.in_service += 1;
    else if (row.operational_status === 'In Repair') summary.in_repair += 1;
    else if (row.operational_status === 'Out of Service') summary.out_of_service += 1;
    else if (row.operational_status === 'Decommissioned') summary.decommissioned += 1;

    const status = maintenanceStatus(row.next_maintenance_date);
    if (row.department) {
      departments.add(row.department);
      departmentCounts.set(row.department, (departmentCounts.get(row.department) || 0) + 1);
    }
    if (row.category) {
      categoryCounts.set(row.category, (categoryCounts.get(row.category) || 0) + 1);
    }
    if (row.operational_status === 'Decommissioned') continue;
    if (status === 'Due') summary.due_soon += 1;
    else if (status === 'Overdue') summary.overdue += 1;
    else if (status === 'On Schedule') summary.current += 1;
    else summary.not_scheduled += 1;
  }

  summary.available = summary.in_service;
  summary.unavailable = summary.in_repair + summary.out_of_service;
  const scheduled = summary.current + summary.due_soon + summary.overdue;
  summary.on_schedule_rate = scheduled ? summary.current / scheduled : null;

  summary.departments = [...departments].sort((left, right) => left.localeCompare(right));
  summary.by_department = countGroups(departmentCounts).map((group) => ({
    department: group.name,
    count: group.count
  }));
  summary.by_category = countGroups(categoryCounts).map((group) => ({
    category: group.name,
    count: group.count
  }));
  return summary;
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(EQUIPMENT_SUMMARY_SQL);
    res.json(buildEquipmentSummary(rows));
  } catch (error) {
    sendDbError(res, error);
  }
});

module.exports = router;
module.exports.buildEquipmentSummary = buildEquipmentSummary;
module.exports.EQUIPMENT_SUMMARY_SQL = EQUIPMENT_SUMMARY_SQL;
