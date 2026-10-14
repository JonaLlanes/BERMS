const { Readable } = require('stream');
const express = require('express');
const pool = require('../db');
const { sendDbError } = require('../http');
const { presentEquipment, presentServiceRequest } = require('../present');
const { buildEquipmentListQuery } = require('../equipmentQuery');
const { buildEquipmentSummary, EQUIPMENT_SUMMARY_SQL } = require('./summary');
const { SERVICE_REQUEST_SELECT, summarizeRequests } = require('../serviceRequests');
const { todayString } = require('../maintenance');
const { toCsv } = require('../csv');
const { findReport, reportCatalog, rowsFor } = require('../reports');

const router = express.Router();

function sendCsv(res, filename, csv) {
  res.status(200);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  Readable.from([csv]).pipe(res);
}

async function loadEquipment() {
  const { sql, params } = buildEquipmentListQuery({});
  const [rows] = await pool.query(sql, params);
  return rows.map(presentEquipment);
}

async function loadServiceRequests() {
  const [rows] = await pool.query(
    `${SERVICE_REQUEST_SELECT} ORDER BY r.opened_on DESC, r.id DESC`
  );
  return rows.map(presentServiceRequest);
}

async function loadOperationsSummary() {
  const [equipment] = await pool.query(EQUIPMENT_SUMMARY_SQL);
  const [requests] = await pool.query('SELECT status, priority, closed_on FROM service_requests');
  return {
    equipment: buildEquipmentSummary(equipment),
    requests: summarizeRequests(requests, todayString())
  };
}

async function loadSource(id) {
  if (id === 'inventory' || id === 'pm-schedule') return loadEquipment();
  if (id === 'service-requests') return loadServiceRequests();
  if (id === 'operations-summary') return loadOperationsSummary();
  return null;
}

router.get('/', (req, res) => {
  const today = todayString();
  res.json({ generated_on: today, reports: reportCatalog(today) });
});

router.get('/:id', async (req, res) => {
  const report = findReport(req.params.id);
  if (!report) return res.status(404).json({ errors: { form: 'Report not found.' } });

  try {
    const source = await loadSource(report.id);
    sendCsv(res, report.filename, toCsv(report.columns, rowsFor(report.id, source)));
  } catch (error) {
    sendDbError(res, error);
  }
});

module.exports = router;
