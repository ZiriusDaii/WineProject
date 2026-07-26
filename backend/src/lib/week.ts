// Calcula semana ISO 8601 (lunes a domingo, semana 1 = la que contiene el primer jueves del anio).
// Usado para relacionar una fecha de cita con el turno semanal asignado a una manicurista.
export function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Lunes=0 .. Domingo=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // jueves de esa semana
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return { week, year: d.getUTCFullYear() };
}

// Inverso de getISOWeek: fecha (lunes, UTC) de una semana ISO dada. Sirve para
// medir distancias reales entre semanas sin asumir 52 semanas por anio (algunos
// anios ISO, como 2026, tienen 53).
export function isoWeekStart(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayNum);
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return target;
}
