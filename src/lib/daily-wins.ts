export function parseGoalDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

export function goalDateRange(dateStr: string) {
  const dayStart = parseGoalDate(dateStr);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return { gte: dayStart, lt: dayEnd };
}
