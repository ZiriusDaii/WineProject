import React, { useState, useMemo } from 'react';

interface DatePickerProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  availableDates?: Set<string>;
  minDate?: string;
  className?: string;
  disabled?: boolean;
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

export const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  onSelectDate,
  availableDates,
  minDate,
  className = '',
  disabled = false,
}) => {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const minDateStr = minDate || toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const todayStr = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

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
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onSelectDate(todayStr);
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

          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled || isPast || !hasAvailability}
              onClick={() => onSelectDate(dateStr)}
              className={`
                w-8 h-8 rounded-full text-[11px] font-medium mx-auto flex items-center justify-center transition-all
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
};
