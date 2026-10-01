const { statusCondition, todayString } = require('./maintenance');
const { likeTerm } = require('./http');

function buildEquipmentListQuery(filters, today = todayString()) {
  const where = [];
  const params = [];

  if (filters.q) {
    const term = likeTerm(filters.q);
    where.push(`(
      asset_tag LIKE ? ESCAPE '\\\\'
      OR equipment_name LIKE ? ESCAPE '\\\\'
      OR category LIKE ? ESCAPE '\\\\'
      OR manufacturer LIKE ? ESCAPE '\\\\'
      OR model_number LIKE ? ESCAPE '\\\\'
      OR serial_number LIKE ? ESCAPE '\\\\'
      OR department LIKE ? ESCAPE '\\\\'
    )`);
    params.push(term, term, term, term, term, term, term);
  }

  if (filters.category) {
    where.push('category = ?');
    params.push(filters.category);
  }

  if (filters.operational_status) {
    where.push('operational_status = ?');
    params.push(filters.operational_status);
  }

  if (filters.department) {
    where.push('department = ?');
    params.push(filters.department);
  }

  if (filters.pm_interval) {
    where.push('pm_interval = ?');
    params.push(filters.pm_interval);
  }

  if (filters.maintenance_status) {
    where.push("operational_status <> 'Decommissioned'");
    const condition = statusCondition(filters.maintenance_status, today);
    where.push(condition.sql);
    params.push(...condition.params);
  }

  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT * FROM equipment${clause} ORDER BY next_maintenance_date IS NULL, next_maintenance_date ASC, equipment_name ASC`;
  return { sql, params };
}

module.exports = {
  buildEquipmentListQuery
};
