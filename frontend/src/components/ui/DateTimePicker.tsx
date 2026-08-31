'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  placement?: 'auto' | 'top' | 'bottom';
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function parsePickerDate(value: string): Date {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const nextSlot = new Date();
  nextSlot.setSeconds(0, 0);
  const remainder = nextSlot.getMinutes() % 5;
  nextSlot.setMinutes(nextSlot.getMinutes() + (remainder === 0 ? 5 : 5 - remainder));
  return nextSlot;
}

export default function DateTimePicker({
  value,
  onChange,
  placeholder = 'Pilih Tanggal & Waktu Publikasi',
  className = '',
  placement = 'auto',
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse the current value, or start from the user's actual current time.
  const initialDate = parsePickerDate(value);
  const [viewDate, setViewDate] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedHour, setSelectedHour] = useState(
    initialDate.getHours().toString().padStart(2, '0')
  );
  const [selectedMinute, setSelectedMinute] = useState(
    initialDate.getMinutes().toString().padStart(2, '0')
  );

  useEffect(() => {
    if (!value) return;
    const date = parsePickerDate(value);
    setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelectedDay(date.getDate());
    setSelectedMonth(date.getMonth());
    setSelectedYear(date.getFullYear());
    setSelectedHour(date.getHours().toString().padStart(2, '0'));
    setSelectedMinute(date.getMinutes().toString().padStart(2, '0'));
  }, [value]);

  // Auto-detect viewport boundary to open upward or downward
  useEffect(() => {
    if (isOpen && containerRef.current) {
      if (placement === 'top') {
        setOpenUpward(true);
      } else if (placement === 'bottom') {
        setOpenUpward(false);
      } else {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const popoverHeight = 360; // Estimated height with margin

        if (spaceBelow < popoverHeight && rect.top > 250) {
          setOpenUpward(true);
        } else {
          setOpenUpward(false);
        }
      }
    }
  }, [isOpen, placement]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const canViewPreviousMonth = new Date(year, month, 1) > currentMonthStart;
  const selectedDateTime = new Date(
    selectedYear,
    selectedMonth,
    selectedDay,
    Number(selectedHour),
    Number(selectedMinute)
  );
  const selectionIsPast = selectedDateTime.getTime() <= now.getTime();
  const todayAfternoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
  const todayAfternoonHasPassed = todayAfternoon.getTime() <= now.getTime();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarDays = [];
  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      monthOffset: -1,
    });
  }
  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: true,
      monthOffset: 0,
    });
  }
  // Next month leading days to complete grid
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let day = 1; day <= remaining; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: false,
      monthOffset: 1,
    });
  }

  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canViewPreviousMonth) return;
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day: number, monthOffset: number) => {
    let targetMonth = month + monthOffset;
    let targetYear = year;

    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear -= 1;
    } else if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }

    const targetDate = new Date(targetYear, targetMonth, day);
    if (targetDate < todayStart) return;

    setSelectedDay(day);
    setSelectedMonth(targetMonth);
    setSelectedYear(targetYear);

    const formattedMonth = (targetMonth + 1).toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    onChange(`${targetYear}-${formattedMonth}-${formattedDay}T${selectedHour}:${selectedMinute}`);
  };

  const handleApply = () => {
    if (selectionIsPast) return;
    const formattedMonth = (selectedMonth + 1).toString().padStart(2, '0');
    const formattedDay = selectedDay.toString().padStart(2, '0');
    onChange(`${selectedYear}-${formattedMonth}-${formattedDay}T${selectedHour}:${selectedMinute}`);
    setIsOpen(false);
  };

  const handleSetPreset = (preset: 'today_afternoon' | 'tomorrow_morning' | 'tomorrow_evening') => {
    const base = new Date();
    const targetDate = new Date(base);
    let h = '10';
    let m = '00';

    if (preset === 'today_afternoon') {
      h = '17';
      m = '00';
    } else if (preset === 'tomorrow_morning') {
      targetDate.setDate(base.getDate() + 1);
      h = '09';
      m = '00';
    } else if (preset === 'tomorrow_evening') {
      targetDate.setDate(base.getDate() + 1);
      h = '19';
      m = '30';
    }

    setSelectedDay(targetDate.getDate());
    setSelectedMonth(targetDate.getMonth());
    setSelectedYear(targetDate.getFullYear());
    setViewDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
    setSelectedHour(h);
    setSelectedMinute(m);

    const fMonth = (targetDate.getMonth() + 1).toString().padStart(2, '0');
    const fDay = targetDate.getDate().toString().padStart(2, '0');
    onChange(`${targetDate.getFullYear()}-${fMonth}-${fDay}T${h}:${m}`);
    setIsOpen(false);
  };

  // Format label for display
  const displayLabel = value
    ? (() => {
        try {
          const d = new Date(value);
          const dayName = DAY_NAMES[d.getDay()];
          const dateNum = d.getDate();
          const mName = MONTH_NAMES[d.getMonth()];
          const yr = d.getFullYear();
          const hours = d.getHours().toString().padStart(2, '0');
          const mins = d.getMinutes().toString().padStart(2, '0');
          return `${dayName}, ${dateNum} ${mName} ${yr} • ${hours}:${mins}`;
        } catch {
          return value;
        }
      })()
    : null;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-md px-3 py-2 text-xs text-left flex items-center justify-between transition group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="w-4 h-4 text-slate-500 shrink-0 group-hover:text-slate-900 transition" />
          <span className={`truncate font-medium ${displayLabel ? 'text-slate-900' : 'text-slate-400'}`}>
            {displayLabel || placeholder}
          </span>
        </div>
        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
      </button>

      {/* Popover Calendar & Time Picker Panel with Smart Dropup / Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Pilih tanggal dan waktu publikasi"
          className={`absolute left-0 bg-white border border-slate-200 rounded-lg p-3 z-50 w-[330px] shadow-2xl animate-in fade-in zoom-in-95 space-y-3 ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {/* Quick Presets Row */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-100">
            <button
              type="button"
              onClick={() => handleSetPreset('today_afternoon')}
              disabled={todayAfternoonHasPassed}
              title={todayAfternoonHasPassed ? 'Waktu ini sudah lewat' : undefined}
              className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sore Ini (17:00)
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('tomorrow_morning')}
              className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700 shrink-0"
            >
              Besok Pagi (09:00)
            </button>
            <button
              type="button"
              onClick={() => handleSetPreset('tomorrow_evening')}
              className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700 shrink-0"
            >
              Besok Malam (19:30)
            </button>
          </div>

          {/* Month & Year Navigation Header */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-900">
              {MONTH_NAMES[month]} {year}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Bulan sebelumnya"
                disabled={!canViewPreviousMonth}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 border border-slate-200 transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Bulan berikutnya"
                className="p-1 rounded hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Days Header */}
          <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-400 py-0.5">
            {DAY_NAMES.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Calendar Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, index) => {
              const targetDate = new Date(year, month + item.monthOffset, item.day);
              const isPastDay = targetDate < todayStart;
              const isSelected =
                item.isCurrentMonth &&
                item.day === selectedDay &&
                month === selectedMonth &&
                year === selectedYear;

              return (
                <button
                  key={`day-${index}`}
                  type="button"
                  onClick={() => handleSelectDay(item.day, item.monthOffset)}
                  disabled={isPastDay}
                  aria-pressed={isSelected}
                  aria-label={targetDate.toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                  className={`h-7 rounded text-xs font-medium flex items-center justify-center transition ${
                    isSelected
                      ? 'bg-slate-900 text-white font-semibold shadow-sm'
                      : isPastDay
                      ? 'text-slate-300 cursor-not-allowed opacity-50'
                      : item.isCurrentMonth
                      ? 'text-slate-800 hover:bg-slate-100'
                      : 'text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {item.day}
                </button>
              );
            })}
          </div>

          {/* Time Picker Controls Row */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-700">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-semibold text-[11px]">Waktu:</span>
              <div className="flex items-center gap-1 ml-1">
                {/* Hour selector */}
                <select
                  value={selectedHour}
                  aria-label="Jam publikasi"
                  onChange={(e) => setSelectedHour(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-400 font-semibold"
                >
                  {Array.from({ length: 24 }).map((_, i) => {
                    const h = i.toString().padStart(2, '0');
                    return (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    );
                  })}
                </select>
                <span className="font-bold text-slate-400">:</span>
                {/* Minute selector */}
                <select
                  value={selectedMinute}
                  aria-label="Menit publikasi"
                  onChange={(e) => setSelectedMinute(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-400 font-semibold"
                >
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map(
                    (m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    )
                  )}
                </select>
                <span className="text-[10px] text-slate-400 font-medium ml-0.5">waktu workspace</span>
              </div>
            </div>

            {/* Confirm button */}
            <button
              type="button"
              onClick={handleApply}
              disabled={selectionIsPast}
              title={selectionIsPast ? 'Pilih tanggal dan waktu yang belum lewat' : undefined}
              className="ui-btn ui-btn-primary text-[11px] py-1 px-2.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="w-3 h-3" />
              <span>Pilih</span>
            </button>
          </div>
          {selectionIsPast && (
            <p className="text-[10px] text-rose-600" role="alert">
              Pilih tanggal dan waktu yang belum lewat.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
