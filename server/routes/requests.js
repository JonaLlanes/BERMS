const express = require('express');
const pool = require('../db');
const { sendDbError, parseId } = require('../http');
const { presentServiceRequest } = require('../present');
const { validateServiceRequest, parseRequestQuery, validateRequestStatus } = require('../validate');
const { requestNumber, closedOnForStatus, SERVICE_REQUEST_SELECT } = require('../serviceRequests');
const { todayString } = require('../maintenance');

const router = express.Router();

router.get('/', async (req, res) => {
  const { errors, value } = parseRequestQuery(req.query);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const where = [];
  const params = [];
  if (value.status) {
    where.push('r.status = ?');
    params.push(value.status);
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  try {
    const [rows] = await pool.query(
      `${SERVICE_REQUEST_SELECT}${clause} ORDER BY r.opened_on DESC, r.id DESC`,
      params
    );
    res.json(rows.map(presentServiceRequest));
  } catch (error) {
    sendDbError(res, error);
  }
});

router.post('/', async (req, res) => {
  const { errors, value } = validateServiceRequest(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [equipment] = await connection.query('SELECT id FROM equipment WHERE id = ? FOR UPDATE', [value.equipment_id]);
    if (!equipment.length) {
      await connection.rollback();
      return res.status(404).json({ errors: { equipment_id: 'Device record not found.' } });
    }

    const [result] = await connection.query(
      `INSERT INTO service_requests (
        equipment_id, request_number, reported_by, priority, problem, status, opened_on, closed_on
      ) VALUES (?, ?, ?, ?, ?, 'Open', ?, NULL)`,
      [value.equipment_id, `N${Date.now().toString(36)}`, value.reported_by, value.priority, value.problem, value.opened_on]
    );
    const number = requestNumber(result.insertId);
    await connection.query('UPDATE service_requests SET request_number = ? WHERE id = ?', [number, result.insertId]);
    await connection.commit();

    const [rows] = await pool.query(`${SERVICE_REQUEST_SELECT} WHERE r.id = ?`, [result.insertId]);
    res.status(201).json(presentServiceRequest(rows[0]));
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(rollbackError.message || rollbackError.code || 'Rollback failed');
    }
    sendDbError(res, error);
  } finally {
    connection.release();
  }
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ errors: { form: 'Invalid request id.' } });

  const { errors, value } = validateRequestStatus(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query('SELECT * FROM service_requests WHERE id = ? FOR UPDATE', [id]);
    if (!existing.length) {
      await connection.rollback();
      return res.status(404).json({ errors: { form: 'Service request not found.' } });
    }

    const current = existing[0];
    const closedOn = closedOnForStatus(value.status, todayString(), current.closed_on);
    await connection.query(
      'UPDATE service_requests SET status = ?, closed_on = ? WHERE id = ?',
      [value.status, closedOn, id]
    );
    await connection.commit();

    const [rows] = await pool.query(`${SERVICE_REQUEST_SELECT} WHERE r.id = ?`, [id]);
    res.json(presentServiceRequest(rows[0]));
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(rollbackError.message || rollbackError.code || 'Rollback failed');
    }
    sendDbError(res, error);
  } finally {
    connection.release();
  }
});

module.exports = router;
