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

  // Parse initial date or default to now/August 2026
  const initialDate = value ? new Date(value) : new Date(2026, 7, 19, 10, 0);
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
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

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

    setSelectedDay(day);
    setSelectedMonth(targetMonth);
    setSelectedYear(targetYear);

    const formattedMonth = (targetMonth + 1).toString().padStart(2, '0');
    const formattedDay = day.toString().padStart(2, '0');
    onChange(`${targetYear}-${formattedMonth}-${formattedDay}T${selectedHour}:${selectedMinute}`);
  };

  const handleApply = () => {
    const formattedMonth = (selectedMonth + 1).toString().padStart(2, '0');
    const formattedDay = selectedDay.toString().padStart(2, '0');
    onChange(`${selectedYear}-${formattedMonth}-${formattedDay}T${selectedHour}:${selectedMinute}`);
    setIsOpen(false);
  };

  const handleSetPreset = (preset: 'today_afternoon' | 'tomorrow_morning' | 'tomorrow_evening') => {
    const base = new Date(2026, 7, 19);
    let targetDate = new Date(base);
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
          return `${dayName}, ${dateNum} ${mName} ${yr} • ${hours}:${mins} WIB`;
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
          className={`absolute left-0 bg-white border border-slate-200 rounded-lg p-3 z-50 w-[330px] shadow-2xl animate-in fade-in zoom-in-95 space-y-3 ${
            openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {/* Quick Presets Row */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-100">
            <button
              type="button"
              onClick={() => handleSetPreset('today_afternoon')}
              className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700 shrink-0"
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
                className="p-1 rounded hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
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
                  className={`h-7 rounded text-xs font-medium flex items-center justify-center transition ${
                    isSelected
                      ? 'bg-slate-900 text-white font-semibold shadow-sm'
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
                <span className="text-[10px] text-slate-400 font-medium ml-0.5">WIB</span>
              </div>
            </div>

            {/* Confirm button */}
            <button
              type="button"
              onClick={handleApply}
              className="ui-btn ui-btn-primary text-[11px] py-1 px-2.5"
            >
              <Check className="w-3 h-3" />
              <span>Pilih</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
