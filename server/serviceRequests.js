const REQUEST_STATUSES = [
  'Open',
  'In Progress',
  'Waiting for Parts',
  'Completed',
  'Cancelled'
];

const REQUEST_PRIORITIES = ['Low', 'Medium', 'High'];

const TERMINAL_REQUEST_STATUSES = ['Completed', 'Cancelled'];

const SERVICE_REQUEST_SELECT = `
  SELECT
    r.id, r.request_number, r.equipment_id, r.reported_by, r.priority, r.problem,
    r.status, r.opened_on, r.closed_on, r.created_at,
    e.equipment_name, e.asset_tag, e.department
  FROM service_requests r
  INNER JOIN equipment e ON e.id = r.equipment_id
`;

function requestNumber(id) {
  return `SR-${String(id).padStart(3, '0')}`;
}

function closedOnForStatus(status, today, currentClosed = null) {
  if (!TERMINAL_REQUEST_STATUSES.includes(status)) return null;
  if (currentClosed) return String(currentClosed).slice(0, 10);
  return today;
}

function summarizeRequests(rows, today) {
  const month = String(today).slice(0, 7);
  const summary = {
    open: 0,
    in_progress: 0,
    waiting_for_parts: 0,
    completed_this_month: 0,
    open_work: 0,
    high_priority_open_work: 0
  };

  for (const row of rows) {
    const openWork = row.status === 'Open'
      || row.status === 'In Progress'
      || row.status === 'Waiting for Parts';
    if (row.status === 'Open') summary.open += 1;
    else if (row.status === 'In Progress') summary.in_progress += 1;
    else if (row.status === 'Waiting for Parts') summary.waiting_for_parts += 1;
    if (openWork) {
      summary.open_work += 1;
      if (row.priority === 'High') summary.high_priority_open_work += 1;
    }

    const closed = row.closed_on ? String(row.closed_on).slice(0, 10) : '';
    if (row.status === 'Completed' && closed.slice(0, 7) === month) {
      summary.completed_this_month += 1;
    }
  }

  return summary;
}

module.exports = {
  REQUEST_STATUSES,
  REQUEST_PRIORITIES,
  SERVICE_REQUEST_SELECT,
  requestNumber,
  closedOnForStatus,
  summarizeRequests
};
