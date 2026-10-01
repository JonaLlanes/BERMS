const express = require('express');
const pool = require('../db');
const { sendDbError, parseId } = require('../http');
const { presentEquipment } = require('../present');
const { buildEquipmentListQuery } = require('../equipmentQuery');
const { validateEquipment, parseListQuery } = require('../validate');
const { todayString } = require('../maintenance');

const router = express.Router();

const equipmentValues = (value) => [
  value.asset_tag,
  value.equipment_name,
  value.category,
  value.manufacturer,
  value.model_number,
  value.serial_number,
  value.department,
  value.operational_status,
  value.pm_interval,
  value.purchase_date,
  value.last_maintenance_date,
  value.next_maintenance_date,
  value.notes
];

async function recordHistory(executor, equipmentId, type, date, remarks) {
  await executor.query(
    `INSERT INTO maintenance_history (
      equipment_id, maintenance_type, maintenance_date, performed_by, performed_by_type, remarks
    ) VALUES (?, ?, ?, NULL, NULL, ?)`,
    [equipmentId, type, date, remarks]
  );
}

function lifecycleNotes(current, value) {
  const notes = [];
  if (current.asset_tag !== value.asset_tag) {
    notes.push({
      type: 'Asset Registration',
      remarks: `Asset tag changed from ${current.asset_tag} to ${value.asset_tag}.`
    });
  }
  if (current.serial_number !== value.serial_number) {
    notes.push({
      type: 'Asset Registration',
      remarks: `Serial number changed from ${current.serial_number} to ${value.serial_number}.`
    });
  }
  if (current.operational_status !== value.operational_status) {
    notes.push({
      type: 'Operational Status Change',
      remarks: value.notes
        ? `Status changed from ${current.operational_status} to ${value.operational_status}. ${value.notes}`.slice(0, 1000)
        : `Status changed from ${current.operational_status} to ${value.operational_status}.`
    });
  }
  const previousSchedule = current.pm_interval || 'not set';
  const nextSchedule = value.pm_interval || 'not set';
  if (previousSchedule !== nextSchedule) {
    notes.push({
      type: 'PM Schedule Change',
      remarks: `PM schedule changed from ${previousSchedule} to ${nextSchedule}.`
    });
  }
  return notes;
}

router.get('/', async (req, res) => {
  const { errors, value } = parseListQuery(req.query);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const { sql, params } = buildEquipmentListQuery(value);
  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(presentEquipment));
  } catch (error) {
    sendDbError(res, error);
  }
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ errors: { form: 'Invalid device id.' } });

  try {
    const [rows] = await pool.query('SELECT * FROM equipment WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ errors: { form: 'Device record not found.' } });
    res.json(presentEquipment(rows[0]));
  } catch (error) {
    sendDbError(res, error);
  }
});

router.post('/', async (req, res) => {
  const { errors, value } = validateEquipment(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO equipment (
        asset_tag, equipment_name, category, manufacturer, model_number, serial_number,
        department, operational_status, pm_interval, purchase_date, last_maintenance_date, next_maintenance_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      equipmentValues(value)
    );
    await recordHistory(
      connection,
      result.insertId,
      'Asset Registration',
      todayString(),
      `Record created for ${value.asset_tag}.`
    );
    await connection.commit();
    const [rows] = await pool.query('SELECT * FROM equipment WHERE id = ?', [result.insertId]);
    res.status(201).json(presentEquipment(rows[0]));
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
  if (!id) return res.status(400).json({ errors: { form: 'Invalid device id.' } });

  const { errors, value } = validateEquipment(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ errors });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query('SELECT * FROM equipment WHERE id = ? FOR UPDATE', [id]);
    if (!existing.length) {
      await connection.rollback();
      return res.status(404).json({ errors: { form: 'Device record not found.' } });
    }

    await connection.query(
      `UPDATE equipment SET
        asset_tag = ?, equipment_name = ?, category = ?, manufacturer = ?, model_number = ?,
        serial_number = ?, department = ?, operational_status = ?, pm_interval = ?, purchase_date = ?,
        last_maintenance_date = ?, next_maintenance_date = ?, notes = ?
      WHERE id = ?`,
      [...equipmentValues(value), id]
    );

    const today = todayString();
    for (const note of lifecycleNotes(existing[0], value)) {
      await recordHistory(connection, id, note.type, today, note.remarks);
    }

    await connection.commit();
    const [rows] = await pool.query('SELECT * FROM equipment WHERE id = ?', [id]);
    res.json(presentEquipment(rows[0]));
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

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ errors: { form: 'Invalid device id.' } });

  try {
    const [history] = await pool.query('SELECT id FROM maintenance_history WHERE equipment_id = ? LIMIT 1', [id]);
    if (history.length) {
      return res.status(409).json({
        errors: {
          form: 'This device already has history, so it cannot be deleted. Set operational status to Decommissioned if it is no longer in use.'
        }
      });
    }
    const [result] = await pool.query('DELETE FROM equipment WHERE id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ errors: { form: 'Device record not found.' } });
    res.json({ deleted: true });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        errors: {
          form: 'This device already has history, so it cannot be deleted. Set operational status to Decommissioned if it is no longer in use.'
        }
      });
    }
    sendDbError(res, error);
  }
});

module.exports = router;
