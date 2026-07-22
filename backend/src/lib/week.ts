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
