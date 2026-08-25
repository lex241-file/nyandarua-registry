// Kenyan public holidays. Extend this list each year.
const KE_HOLIDAYS = new Set([
  '2025-01-01', '2025-04-18', '2025-04-21', '2025-05-01', '2025-06-01',
  '2025-10-10', '2025-10-20', '2025-12-12', '2025-12-25', '2025-12-26',
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-06-01',
  '2026-10-10', '2026-10-20', '2026-12-12', '2026-12-25', '2026-12-26',
]);

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isHoliday(d: Date): boolean {
  return KE_HOLIDAYS.has(d.toISOString().split('T')[0]);
}

export function addWorkingDays(date: Date, days: number): Date {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d) && !isHoliday(d)) added++;
  }
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Special-role users (County Attorney, CPSB) get a 3-month due date.
 * Everyone else gets 7 working days from the acceptance/assignment date.
 */
export function computeDueDate(role: 'admin' | 'user' | 'special', fromDate: Date): Date {
  if (role === 'special') return addMonths(fromDate, 3);
  return addWorkingDays(fromDate, 7);
}
