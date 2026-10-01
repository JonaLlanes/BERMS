const express = require('express');
const pool = require('../db');
const { sendDbError, parseId } = require('../http');
const { presentEquipment, presentHistory } = require('../present');
const { PM_SCHEDULE_TYPES, nextPmDate } = require('../maintenance');
const { validateMaintenance } = require('../validate');

const router = express.Router();

router.get('/:id/maintenance', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ errors: { form: 'Invalid device id.' } });

  try {
    const [equipment] = await pool.query('SELECT id FROM equipment WHERE id = ?', [id]);
    if (!equipment.length) return res.status(404).json({ errors: { form: 'Device record not found.' } });

    const [rows] = await pool.query(
      `SELECT * FROM maintenance_history
       WHERE equipment_id = ?
       ORDER BY maintenance_date DESC, id DESC`,
      [id]
    );
    res.json(rows.map(presentHistory));
  } catch (error) {
    sendDbError(res, error);
  }
});

router.post('/:id/maintenance', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ errors: { form: 'Invalid device id.' } });

  const { errors, value } = validateMaintenance(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [equipmentRows] = await connection.query('SELECT * FROM equipment WHERE id = ? FOR UPDATE', [id]);
    if (!equipmentRows.length) {
      await connection.rollback();
      return res.status(404).json({ errors: { form: 'Device record not found.' } });
    }

    const current = equipmentRows[0];
    const currentLast = current.last_maintenance_date ? String(current.last_maintenance_date).slice(0, 10) : null;
    const countsAsPm = PM_SCHEDULE_TYPES.includes(value.maintenance_type);
    const lastDate = countsAsPm && (!currentLast || value.maintenance_date > currentLast)
      ? value.maintenance_date
      : currentLast;
    const visitSetsPm = countsAsPm && lastDate === value.maintenance_date;
    let nextDate = value.next_maintenance_date === undefined
      ? (current.next_maintenance_date ? String(current.next_maintenance_date).slice(0, 10) : null)
      : value.next_maintenance_date;
    if (visitSetsPm && current.pm_interval) {
      nextDate = nextPmDate(value.maintenance_date, current.pm_interval);
    }

    if (lastDate && nextDate && lastDate > nextDate) {
      await connection.rollback();
      return res.status(400).json({
        errors: {
          next_maintenance_date: 'Next PM due date must be on or after the latest PM date.'
        }
      });
    }

    const [result] = await connection.query(
      `INSERT INTO maintenance_history (
        equipment_id, maintenance_type, maintenance_date, performed_by, performed_by_type, operational_status, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, value.maintenance_type, value.maintenance_date, value.performed_by, value.performed_by_type, value.operational_status, value.remarks]
    );
    await connection.query(
      'UPDATE equipment SET operational_status = ?, last_maintenance_date = ?, next_maintenance_date = ? WHERE id = ?',
      [value.operational_status, lastDate, nextDate, id]
    );
    await connection.commit();

    const [historyRows] = await pool.query('SELECT * FROM maintenance_history WHERE id = ?', [result.insertId]);
    const [updated] = await pool.query('SELECT * FROM equipment WHERE id = ?', [id]);
    res.status(201).json({
      history: presentHistory(historyRows[0]),
      equipment: presentEquipment(updated[0])
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(rollbackError.message || rollbackError.code || 'Rollback failed');
    }
    sendDbError(res, error);
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
