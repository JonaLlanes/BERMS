const express = require('express');
const pool = require('../db');
const { sendDbError } = require('../http');
const { maintenanceStatus } = require('../maintenance');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT operational_status, next_maintenance_date, department FROM equipment'
    );
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
      departments: []
    };
    const departments = new Set();

    for (const row of rows) {
      if (row.operational_status === 'In Service') summary.in_service += 1;
      else if (row.operational_status === 'In Repair') summary.in_repair += 1;
      else if (row.operational_status === 'Out of Service') summary.out_of_service += 1;
      else if (row.operational_status === 'Decommissioned') summary.decommissioned += 1;

      const status = maintenanceStatus(row.next_maintenance_date);
      if (row.department) departments.add(row.department);
      if (row.operational_status === 'Decommissioned') continue;
      if (status === 'Due') summary.due_soon += 1;
      else if (status === 'Overdue') summary.overdue += 1;
      else if (status === 'Current') summary.current += 1;
      else summary.not_scheduled += 1;
    }

    summary.departments = [...departments].sort((left, right) => left.localeCompare(right));
    res.json(summary);
  } catch (error) {
    sendDbError(res, error);
  }
});

module.exports = router;
