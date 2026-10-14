function formatOnScheduleRate(onSchedule, due, overdue) {
  const denominator = Number(onSchedule) + Number(due) + Number(overdue);
  if (!denominator) return '';
  const rounded = Math.round((Number(onSchedule) / denominator) * 1000) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

module.exports = {
  formatOnScheduleRate
};
