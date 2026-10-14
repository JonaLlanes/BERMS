(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DashboardFilter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function filterDashboard(equipment, requests, filters = {}) {
    const department = filters.department || '';
    const category = filters.category || '';
    const operationalStatus = filters.operational_status || '';
    const requestStatus = filters.request_status || '';

    const matchedEquipment = equipment.filter((device) => {
      if (department && device.department !== department) return false;
      if (category && device.category !== category) return false;
      if (operationalStatus && device.operational_status !== operationalStatus) return false;
      return true;
    });
    const matchedIds = new Set(matchedEquipment.map((device) => Number(device.id)));
    let matchedRequests = requests.filter((request) => matchedIds.has(Number(request.equipment_id)));

    if (!requestStatus) {
      return { equipment: matchedEquipment, requests: matchedRequests };
    }

    matchedRequests = matchedRequests.filter((request) => request.status === requestStatus);
    const requestedIds = new Set(matchedRequests.map((request) => Number(request.equipment_id)));
    return {
      equipment: matchedEquipment.filter((device) => requestedIds.has(Number(device.id))),
      requests: matchedRequests
    };
  }

  function summarizeEquipment(rows) {
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
      available: 0,
      unavailable: 0,
      on_schedule_rate: null,
      by_department: [],
      by_category: []
    };
    const departmentCounts = new Map();
    const categoryCounts = new Map();

    for (const row of rows) {
      if (row.operational_status === 'In Service') summary.in_service += 1;
      else if (row.operational_status === 'In Repair') summary.in_repair += 1;
      else if (row.operational_status === 'Out of Service') summary.out_of_service += 1;
      else if (row.operational_status === 'Decommissioned') summary.decommissioned += 1;

      if (row.department) {
        departmentCounts.set(row.department, (departmentCounts.get(row.department) || 0) + 1);
      }
      if (row.category) {
        categoryCounts.set(row.category, (categoryCounts.get(row.category) || 0) + 1);
      }
      if (row.operational_status === 'Decommissioned') continue;
      if (row.maintenance_status === 'Due') summary.due_soon += 1;
      else if (row.maintenance_status === 'Overdue') summary.overdue += 1;
      else if (row.maintenance_status === 'On Schedule') summary.current += 1;
      else summary.not_scheduled += 1;
    }

    summary.available = summary.in_service;
    summary.unavailable = summary.in_repair + summary.out_of_service;
    const scheduled = summary.current + summary.due_soon + summary.overdue;
    summary.on_schedule_rate = scheduled ? summary.current / scheduled : null;

    summary.by_department = [...departmentCounts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([department, count]) => ({ department, count }));
    summary.by_category = [...categoryCounts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([category, count]) => ({ category, count }));
    return summary;
  }

  const OPEN_WORK_STATUSES = ['Open', 'In Progress', 'Waiting for Parts'];

  function daysBetween(start, end) {
    const [startYear, startMonth, startDay] = String(start).slice(0, 10).split('-').map(Number);
    const [endYear, endMonth, endDay] = String(end).slice(0, 10).split('-').map(Number);
    if (![startYear, startMonth, startDay, endYear, endMonth, endDay].every(Number.isFinite)) return null;
    const from = Date.UTC(startYear, startMonth - 1, startDay);
    const to = Date.UTC(endYear, endMonth - 1, endDay);
    return Math.round((to - from) / 86400000);
  }

  function summarizeWork(rows, today) {
    const month = String(today).slice(0, 7);
    const summary = {
      open: 0,
      in_progress: 0,
      waiting_for_parts: 0,
      completed_this_month: 0,
      open_work: 0,
      high_priority_open_work: 0,
      oldest_open_age: null
    };
    let oldest = null;

    for (const row of rows) {
      const openWork = OPEN_WORK_STATUSES.includes(row.status);
      if (row.status === 'Open') summary.open += 1;
      else if (row.status === 'In Progress') summary.in_progress += 1;
      else if (row.status === 'Waiting for Parts') summary.waiting_for_parts += 1;
      if (openWork) {
        summary.open_work += 1;
        if (row.priority === 'High') summary.high_priority_open_work += 1;
        if (row.opened_on) {
          const age = daysBetween(row.opened_on, today);
          if (age != null && (oldest == null || age > oldest)) oldest = age;
        }
      }
      const closed = row.closed_on ? String(row.closed_on).slice(0, 10) : '';
      if (row.status === 'Completed' && closed.slice(0, 7) === month) {
        summary.completed_this_month += 1;
      }
    }

    summary.oldest_open_age = oldest;
    return summary;
  }

  function summarizeSupport(equipment, requests, today) {
    const byId = new Map(equipment.map((device) => [Number(device.id), device]));
    const activeIds = new Set(
      equipment
        .filter((device) => device.operational_status !== 'Decommissioned')
        .map((device) => Number(device.id))
    );
    const counted = requests.filter((request) => (
      request.status !== 'Cancelled' && byId.has(Number(request.equipment_id))
    ));
    const activeRequests = counted.filter((request) => activeIds.has(Number(request.equipment_id)));
    const requestCounts = new Map();
    for (const request of counted) {
      const id = Number(request.equipment_id);
      requestCounts.set(id, (requestCounts.get(id) || 0) + 1);
    }

    const mostRequests = equipment
      .map((device) => ({
        label: `${device.equipment_name} (${device.asset_tag})`,
        count: requestCounts.get(Number(device.id)) || 0
      }))
      .filter((row) => row.count > 0)
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, 8);

    function grouped(key) {
      const counts = new Map();
      for (const device of equipment) {
        if (device[key]) counts.set(device[key], counts.get(device[key]) || 0);
      }
      for (const request of counted) {
        const device = byId.get(Number(request.equipment_id));
        if (!device || !device[key]) continue;
        counts.set(device[key], (counts.get(device[key]) || 0) + 1);
      }
      return [...counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
    }

    const attention = equipment
      .map((device) => ({
        equipment_name: device.equipment_name,
        asset_tag: device.asset_tag,
        department: device.department || '',
        requests: requestCounts.get(Number(device.id)) || 0,
        corrective: Number(device.corrective_count) || 0
      }))
      .filter((row) => row.requests >= 2 || row.corrective >= 2)
      .sort((left, right) => (
        right.requests - left.requests
        || right.corrective - left.corrective
        || left.asset_tag.localeCompare(right.asset_tag)
      ));

    const openWork = requests
      .filter((request) => OPEN_WORK_STATUSES.includes(request.status))
      .map((request) => ({
        request_number: request.request_number,
        equipment_name: request.equipment_name,
        asset_tag: request.asset_tag,
        status: request.status,
        priority: request.priority,
        age: request.opened_on ? daysBetween(request.opened_on, today) : null
      }))
      .sort((left, right) => (
        (right.age ?? -1) - (left.age ?? -1)
        || String(left.request_number).localeCompare(String(right.request_number))
      ));

    return {
      most_requests: mostRequests,
      by_category: grouped('category'),
      by_department: grouped('department'),
      requests_per_active: activeIds.size ? activeRequests.length / activeIds.size : null,
      attention,
      open_work: openWork
    };
  }

  return {
    filterDashboard,
    summarizeEquipment,
    summarizeWork,
    summarizeSupport,
    daysBetween
  };
});
