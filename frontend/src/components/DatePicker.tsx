import React, { useState, useEffect, useMemo } from 'react';

interface DatePickerProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  availableDates?: Set<string>;
  markedDates?: Set<string>;
  minDate?: string;
  className?: string;
  disabled?: boolean;
  // "Hoy" en la zona del negocio (YYYY-MM-DD), cuando el llamador ya la sabe
  // (ej. el admin puede estar conectado desde otro huso horario) -- sin esto
  // se usa la hora local del navegador, que es lo correcto para el flujo de
  // reserva (el cliente esta fisicamente donde reserva).
  todayKey?: string;
  // Para vistas donde se necesita poder abrir/marcar fechas pasadas (ej. el
  // calendario del admin, para ver citas que ya ocurrieron) en vez del
  // comportamiento por defecto de deshabilitarlas.
  allowPast?: boolean;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAYS_HEADER = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const toDateKey = (year: number, month: number, day: number) => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

export const DatePicker: React.FC<DatePickerProps> = React.memo(({
  selectedDate,
  onSelectDate,
  availableDates,
  markedDates,
  minDate,
  className = '',
  disabled = false,
  todayKey,
  allowPast = false,
}) => {
  // Sin memo: si el picker queda montado cruzando la medianoche (una
  // pestana de admin abierta toda la noche, por ejemplo), congelar "hoy" en
  // el primer render dejaria "Hoy", el minimo y el resaltado de hoy mal.
  const today = new Date();
  const todayStr = todayKey ?? toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  // Leer `new Date()` fresco en cada render no alcanza si el picker esta
  // inactivo (nada mas lo re-renderiza) justo cuando pasa la medianoche --
  // este timer se auto-reprograma para forzar un re-render en ese momento.
  const [, forceMidnightRefresh] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => {
        forceMidnightRefresh(n => n + 1);
        scheduleNextMidnight();
      }, nextMidnight.getTime() - now.getTime());
    };
    scheduleNextMidnight();
    return () => clearTimeout(timer);
  }, []);

  // La vista inicial arranca en el mes de `selectedDate` cuando ya hay una
  // fecha elegida (ej. el admin reabre el calendario en un dia ya marcado),
  // en vez de siempre el mes de "hoy" del navegador.
  const [initialYear, initialMonth] = useMemo(() => {
    const source = selectedDate || todayStr;
    const [y, m] = source.split('-').map(Number);
    return y && m ? [y, m - 1] : [today.getFullYear(), today.getMonth()];
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const minDateStr = allowPast ? '' : (minDate || todayStr);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const goToday = () => {
    const [ty, tm] = todayStr.split('-').map(Number);
    setViewYear(ty);
    setViewMonth(tm - 1);
    // "Hoy" navegaba el calendario Y seleccionaba la fecha sin chequear las
    // mismas restricciones que bloquean el boton de cada dia (minDate,
    // availableDates) -- podia seleccionar un dia sin disponibilidad real.
    const isBlocked = (!!minDateStr && todayStr < minDateStr) || (availableDates ? !availableDates.has(todayStr) : false);
    if (!isBlocked) onSelectDate(todayStr);
  };

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div className={`bg-white border border-[#EADEC9]/60 rounded-2xl p-4 shadow-sm mx-auto ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          disabled={disabled}
          className="w-7 h-7 flex items-center justify-center rounded-full text-[#A68F63] hover:bg-[#EADEC9]/30 disabled:opacity-30 text-sm font-bold"
        >
          ‹
        </button>
        <span className="serif-title text-sm text-[#3B0019] font-medium">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={disabled}
          className="w-7 h-7 flex items-center justify-center rounded-full text-[#A68F63] hover:bg-[#EADEC9]/30 disabled:opacity-30 text-sm font-bold"
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_HEADER.map((d) => (
          <div key={d} className="text-center text-[9px] text-[#A68F63] font-bold uppercase py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;

          const dateStr = toDateKey(viewYear, viewMonth, day);
          const isPast = minDateStr && dateStr < minDateStr;
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const hasAvailability = availableDates ? availableDates.has(dateStr) : true;
          const isMarked = markedDates?.has(dateStr);

          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled || isPast || !hasAvailability}
              onClick={() => onSelectDate(dateStr)}
              aria-label={`${day} de ${MONTHS[viewMonth]}${isMarked ? ', tiene citas agendadas' : ''}`}
              className={`
                relative w-8 h-8 rounded-full text-[11px] font-medium mx-auto flex items-center justify-center transition-all
                ${isSelected
                  ? 'bg-[#5C0632] text-white shadow-md'
                  : isPast
                  ? 'text-[#D6C8B8] cursor-not-allowed'
                  : !hasAvailability
                  ? 'text-[#D6C8B8] cursor-not-allowed line-through'
                  : 'text-[#44403C] hover:bg-[#8E1B54]/10 hover:text-[#8E1B54]'
                }
                ${isToday && !isSelected ? 'border border-[#8E1B54]' : ''}
              `}
            >
              {day}
              {isMarked && (
                <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[#8E1B54]'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      <div className="mt-3 pt-2 border-t border-[#EADEC9]/20 flex justify-center">
        <button
          type="button"
          onClick={goToday}
          disabled={disabled}
          className="text-[10px] text-[#A68F63] hover:text-[#8E1B54] font-semibold disabled:opacity-30"
        >
          Hoy
        </button>
      </div>
    </div>
  );
});
