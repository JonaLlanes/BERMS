const DUE_SOON_DAYS = 30;

const MAINTENANCE_STATUSES = ['Not Scheduled', 'Overdue', 'Due', 'On Schedule'];

const PM_INTERVALS = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'];

const PM_INTERVAL_MONTHS = {
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

function todayString(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return todayString(date);
}

function addMonths(dateString, months) {
  const [year, month, day] = dateString.split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return todayString(target);
}

function nextPmDate(lastDate, interval) {
  const months = PM_INTERVAL_MONTHS[interval];
  if (!lastDate || !months) return null;
  return addMonths(String(lastDate).slice(0, 10), months);
}

function maintenanceStatus(nextDate, today = todayString()) {
  if (!nextDate) return 'Not Scheduled';
  const next = String(nextDate).slice(0, 10);
  if (next < today) return 'Overdue';
  if (next <= addDays(today, DUE_SOON_DAYS)) return 'Due';
  return 'On Schedule';
}

function statusCondition(status, today = todayString()) {
  const dueSoonEnd = addDays(today, DUE_SOON_DAYS);
  if (status === 'Not Scheduled') return { sql: 'next_maintenance_date IS NULL', params: [] };
  if (status === 'Overdue') return { sql: 'next_maintenance_date < ?', params: [today] };
  if (status === 'Due') {
    return {
      sql: 'next_maintenance_date >= ? AND next_maintenance_date <= ?',
      params: [today, dueSoonEnd]
    };
  }
  if (status === 'On Schedule') return { sql: 'next_maintenance_date > ?', params: [dueSoonEnd] };
  return null;
}

module.exports = {
  DUE_SOON_DAYS,
  MAINTENANCE_STATUSES,
  PM_INTERVALS,
  PM_SCHEDULE_TYPES,
  todayString,
  addDays,
  addMonths,
  nextPmDate,
  maintenanceStatus,
  statusCondition
};
