'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Filter,
  X,
  Eye,
  CheckCircle2,
  ListFilter,
  Layers,
  ArrowRight,
  GripVertical,
  Move,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CalendarEvent } from '@/lib/types';
import SocialIcon from '@/components/ui/SocialIcon';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Trash2 } from 'lucide-react';

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function CalendarPage() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 19)); // Aug 2026
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isQuickScheduleOpen, setIsQuickScheduleOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDate, setQuickDate] = useState('2026-08-20T10:00');
  const [quickPlatform, setQuickPlatform] = useState('instagram');
  const [kanbanIdeas, setKanbanIdeas] = useState<{ id: string; title: string; content?: string }[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string>('');
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);

  // Drag-and-drop state
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const dragDataRef = useRef<{ eventId: string; originalDate: string } | null>(null);

  const loadCalendar = async () => {
    try {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth();
      const startDate = new Date(y, m - 1, 1).toISOString();
      const endDate = new Date(y, m + 2, 0).toISOString();
      const [calData, kanbanData] = await Promise.all([
        api.getCalendarEvents({ start_date: startDate, end_date: endDate }),
        api.getKanbanIdeas().catch(() => ({ columns: [] })),
      ]);
      if (calData.events) {
        setEvents(calData.events);
      }
      if (kanbanData.columns) {
        const allCards = kanbanData.columns.flatMap((col: any) => col.cards || []);
        setKanbanIdeas(allCards);
      }
    } catch {
      setEvents([]);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [currentDate]);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarCells: { day: number; isCurrent: boolean; monthOffset: number }[] = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({ day: daysInPrevMonth - i, isCurrent: false, monthOffset: -1 });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push({ day, isCurrent: true, monthOffset: 0 });
  }
  const remaining = (7 - (calendarCells.length % 7)) % 7;
  for (let day = 1; day <= remaining; day++) {
    calendarCells.push({ day, isCurrent: false, monthOffset: 1 });
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleQuickScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    try {
      await api.createPost({
        master_caption: quickTitle,
        target_account_ids: [quickPlatform],
        scheduled_at: quickDate,
      });

      const newEv: CalendarEvent = {
        id: `ev-${Date.now()}`,
        title: quickTitle,
        start: quickDate,
        platforms: [quickPlatform],
        status: 'scheduled',
      };
      setEvents((prev) => [...prev, newEv]);
      toast.success('Jadwal Ditambahkan', `Postingan "${quickTitle}" berhasil disimpan ke database.`);
    } catch (err: any) {
      toast.error('Gagal Menjadwalkan', err.message || 'Gagal menyimpan jadwal ke server.');
    } finally {
      setQuickTitle('');
      setIsQuickScheduleOpen(false);
    }
  };

  const filteredEvents = events.filter((ev) =>
    filterPlatform === 'all' ? true : ev.platforms.includes(filterPlatform)
  );

  const activeDateEvents = selectedDayNumber
    ? filteredEvents.filter((ev) => {
        if (!ev.start) return false;
        const d = new Date(ev.start);
        return d.getDate() === selectedDayNumber && d.getMonth() === month && d.getFullYear() === year;
      })
    : filteredEvents;

  // --- Calendar Drag-and-Drop Handlers ---
  const handleEventDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    dragDataRef.current = { eventId: event.id, originalDate: event.start };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.id);

    const target = e.currentTarget as HTMLElement;
    requestAnimationFrame(() => {
      target.style.opacity = '0.35';
    });
  };

  const handleEventDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDragOverDay(null);
    dragDataRef.current = null;
  };

  const handleCellDragOver = (e: React.DragEvent, dayNumber: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDay !== dayNumber) {
      setDragOverDay(dayNumber);
    }
  };

  const handleCellDragLeave = (e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    if (relatedTarget && currentTarget.contains(relatedTarget)) return;
    setDragOverDay(null);
  };

  const handleCellDrop = async (e: React.DragEvent, targetDay: number) => {
    e.preventDefault();
    setDragOverDay(null);

    const dragData = dragDataRef.current;
    if (!dragData) return;

    const { eventId, originalDate } = dragData;

    // Calculate new date, preserving original time
    const origDate = new Date(originalDate);
    const origHours = origDate.getHours();
    const origMinutes = origDate.getMinutes();

    const newDate = new Date(year, month, targetDay, origHours, origMinutes);
    const newIsoString = newDate.toISOString();

    // Check if dropped on same day
    if (origDate.getDate() === targetDay && origDate.getMonth() === month && origDate.getFullYear() === year) {
      dragDataRef.current = null;
      return;
    }

    // Optimistic update
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === eventId ? { ...ev, start: newIsoString } : ev
      )
    );

    try {
      await api.reschedulePost(eventId, newIsoString);
      toast.success(
        'Jadwal Diperbarui',
        `Postingan berhasil dipindahkan ke tanggal ${targetDay} ${monthNames[month]} ${year}.`
      );
    } catch (err: any) {
      // Rollback
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId ? { ...ev, start: originalDate } : ev
        )
      );
      toast.error('Gagal Memindahkan', err.message || 'Gagal memperbarui jadwal di server.');
    }

    dragDataRef.current = null;
  };

  return (
    <div className="space-y-3">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 pb-2.5">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Kalender Konten &amp; Jadwal Distribusi
          </h1>
          <p className="text-xs text-slate-500">
            Jadwal postingan terpadu seluruh saluran PT Wijaya Inovasi Gemilang.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month Navigation Control */}
          <div className="inline-flex items-center rounded-md border border-slate-200 bg-white shadow-xs">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-slate-50 text-slate-600 border-r border-slate-200 transition"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setCurrentDate(new Date(2026, 7, 19));
                setSelectedDayNumber(null);
              }}
              className="px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
            >
              {monthNames[month]} {year}
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-slate-50 text-slate-600 border-l border-slate-200 transition"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsQuickScheduleOpen(true)}
            className="ui-btn ui-btn-primary py-1.5 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Jadwal</span>
          </button>
        </div>
      </div>

      {/* Filter Channel Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 rounded-md border border-slate-200 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-slate-700 mr-1 flex items-center gap-1 text-[11px]">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Saluran:</span>
          </span>
          {['all', 'instagram', 'linkedin', 'facebook', 'tiktok', 'youtube'].map((plat) => (
            <button
              key={plat}
              onClick={() => setFilterPlatform(plat)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                filterPlatform === plat
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {plat !== 'all' && (
                <SocialIcon
                  platform={plat}
                  size={10}
                  className={filterPlatform === plat ? 'text-white' : 'text-slate-600'}
                />
              )}
              <span>{plat === 'all' ? 'Semua' : plat.toUpperCase()}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-500 font-medium">
            Total Terjadwal: <strong className="text-slate-900">{filteredEvents.length}</strong>
          </span>
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <Move className="w-3 h-3" />
            <span>Geser kartu untuk pindah tanggal</span>
          </span>
        </div>
      </div>

      {/* Main Two-Column Compact Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Left Column: Compact Calendar Grid (7 Cols) */}
        <div className="lg:col-span-7 ui-card p-0 overflow-hidden">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-[11px] font-semibold text-slate-600 py-1.5">
            {DAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Month Day Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 bg-white">
            {calendarCells.map((cell, idx) => {
              const isToday = cell.isCurrent && cell.day === 19 && month === 7 && year === 2026;
              const isSelected = cell.isCurrent && cell.day === selectedDayNumber;
              const isDragTarget = cell.isCurrent && cell.day === dragOverDay;

              const cellEvents = cell.isCurrent
                ? filteredEvents.filter((ev) => {
                    if (!ev.start) return false;
                    const evDate = new Date(ev.start);
                    return (
                      evDate.getDate() === cell.day &&
                      evDate.getMonth() === month &&
                      evDate.getFullYear() === year
                    );
                  })
                : [];

              return (
                <div
                  key={`cell-${idx}`}
                  onClick={() => cell.isCurrent && setSelectedDayNumber(cell.day)}
                  onDragOver={(e) => cell.isCurrent ? handleCellDragOver(e, cell.day) : undefined}
                  onDragLeave={cell.isCurrent ? handleCellDragLeave : undefined}
                  onDrop={(e) => cell.isCurrent ? handleCellDrop(e, cell.day) : undefined}
                  className={`h-16 p-2 flex flex-col justify-between cursor-pointer transition-all duration-150 select-none ${
                    !cell.isCurrent
                      ? 'bg-slate-50/40 opacity-30 cursor-default'
                      : isDragTarget
                      ? 'bg-blue-50/80 ring-2 ring-inset ring-blue-400 shadow-inner'
                      : isSelected
                      ? 'bg-slate-100/80 font-medium'
                      : isToday
                      ? 'bg-slate-50/70'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Top Day Number Row */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center justify-center text-xs transition ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-slate-900 text-white font-medium text-[11px]'
                          : isSelected
                          ? 'w-6 h-6 rounded-full bg-slate-200 text-slate-900 font-semibold text-[11px]'
                          : cell.isCurrent
                          ? 'text-slate-700 font-medium pl-0.5'
                          : 'text-slate-400 pl-0.5'
                      }`}
                    >
                      {cell.day}
                    </span>

                    {cellEvents.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 ring-2 ring-white" />
                    )}
                  </div>

                  {/* Bottom Platform Dots / Chips — Draggable */}
                  <div className="flex items-center gap-1 overflow-hidden">
                    {cellEvents.map((ev) => (
                      <div
                        key={ev.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleEventDragStart(e, ev);
                        }}
                        onDragEnd={handleEventDragEnd}
                        className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-mono text-slate-700 truncate max-w-full cursor-grab active:cursor-grabbing hover:bg-slate-200 hover:border-slate-300 transition"
                        title={`${ev.title} — Geser untuk pindah tanggal`}
                      >
                        {ev.platforms.slice(0, 2).map((p) => (
                          <SocialIcon key={p} platform={p} size={8} />
                        ))}
                        <span className="truncate font-semibold">
                          {ev.start ? new Date(ev.start).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Timeline Agenda & Post Details (5 Cols) */}
        <div className="lg:col-span-5 ui-card p-3 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                {selectedDayNumber
                  ? `Jadwal Tanggal ${selectedDayNumber} ${monthNames[month]}`
                  : 'Semua Agenda Mendatang'}
              </h2>
            </div>

            {selectedDayNumber && (
              <button
                type="button"
                onClick={() => setSelectedDayNumber(null)}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-medium"
              >
                Lihat Semua ({filteredEvents.length})
              </button>
            )}
          </div>

          {/* Agenda List */}
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
            {activeDateEvents.length > 0 ? (
              activeDateEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-200 hover:border-slate-300 hover:bg-white transition cursor-pointer text-xs space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {ev.platforms.map((p) => (
                        <div key={p} className="p-1 rounded bg-white border border-slate-200 flex items-center justify-center">
                          <SocialIcon platform={p} size={11} />
                        </div>
                      ))}
                      <span className="text-[11px] font-mono text-slate-500 font-semibold">
                        {ev.start ? new Date(ev.start).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </span>
                    </div>

                    <span className="ui-badge bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px]">
                      {ev.status === 'scheduled' ? 'Terjadwal' : 'Draft'}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    {ev.thumbnail_url && (
                      <img
                        src={ev.thumbnail_url}
                        alt={ev.title}
                        className="w-12 h-12 object-cover rounded border border-slate-200 shrink-0"
                      />
                    )}
                    <p className="font-semibold text-slate-900 line-clamp-2 leading-relaxed text-[11px] group-hover:text-slate-950 flex-1">
                      {ev.title}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-400">
                    <span>Otomatisasi Publikasi Aktif</span>
                    <span className="text-slate-800 font-medium group-hover:underline flex items-center gap-0.5">
                      Lihat Rincian
                      <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <CalendarIcon className="w-6 h-6 text-slate-300 mx-auto" />
                <p>Belum ada jadwal postingan.</p>
                <button
                  type="button"
                  onClick={() => setIsQuickScheduleOpen(true)}
                  className="ui-btn ui-btn-primary text-xs py-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Jadwalkan Post Baru</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Schedule Modal */}
      {isQuickScheduleOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Tambah Jadwal Postingan Baru
              </h3>
              <button
                onClick={() => setIsQuickScheduleOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickScheduleSubmit} className="space-y-3">
              {/* Tarik dari Ide Kanban Selector */}
              {kanbanIdeas.length > 0 && (
                <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-500" />
                      <span>Tarik dari Ide Kanban (Opsional):</span>
                    </label>
                    {selectedIdeaId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIdeaId('');
                          setQuickTitle('');
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-medium"
                      >
                        Reset Pilihan
                      </button>
                    )}
                  </div>
                  <select
                    value={selectedIdeaId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedIdeaId(id);
                      const found = kanbanIdeas.find((item) => item.id === id);
                      if (found) {
                        setQuickTitle(found.title);
                        toast.info('Ide Terpilih', `Judul otomatis diisi dari ide "${found.title}".`);
                      }
                    }}
                    className="ui-input text-xs"
                  >
                    <option value="">-- Pilih Ide dari Papan Kanban --</option>
                    {kanbanIdeas.map((idea) => (
                      <option key={idea.id} value={idea.id}>
                        {idea.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Judul / Topik Post:
                </label>
                <input
                  type="text"
                  required
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="Contoh: Pengumuman Layanan Baru"
                  className="ui-input"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Saluran Utama:
                </label>
                <select
                  value={quickPlatform}
                  onChange={(e) => setQuickPlatform(e.target.value)}
                  className="ui-input"
                >
                  <option value="instagram">Instagram Business</option>
                  <option value="linkedin">LinkedIn Company</option>
                  <option value="facebook">Facebook Page</option>
                  <option value="tiktok">TikTok</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Waktu Publikasi:
                </label>
                <DateTimePicker
                  value={quickDate}
                  onChange={(val) => setQuickDate(val)}
                  placement="top"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickScheduleOpen(false)}
                  className="ui-btn ui-btn-secondary"
                >
                  Batal
                </button>
                <button type="submit" className="ui-btn ui-btn-primary">
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Event Detail Inspector Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-5 space-y-4 shadow-xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-1.5">
                {selectedEvent.platforms.map((p) => (
                  <div key={p} className="p-1 rounded bg-slate-50 border border-slate-200 flex items-center justify-center">
                    <SocialIcon platform={p} size={13} />
                  </div>
                ))}
                <span className="text-xs font-semibold text-slate-900">Rincian Postingan Terjadwal</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Uncropped Media & Playable Video Preview */}
            {(() => {
              const mediaList =
                selectedEvent.media && selectedEvent.media.length > 0
                  ? selectedEvent.media
                  : selectedEvent.thumbnail_url
                  ? [
                      {
                        id: 'thumb-1',
                        file_url: selectedEvent.thumbnail_url,
                        thumbnail_url: selectedEvent.thumbnail_url,
                        file_type: (/\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(selectedEvent.thumbnail_url)
                          ? 'video'
                          : 'image') as 'image' | 'video',
                        title: selectedEvent.title,
                      },
                    ]
                  : [];

              if (mediaList.length === 0) return null;

              const currentMedia = mediaList[activeMediaIndex] || mediaList[0];
              const isVid =
                currentMedia.file_type === 'video' ||
                /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(currentMedia.file_url || '');

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                      Pratinjau Media ({activeMediaIndex + 1}/{mediaList.length}):
                    </span>
                    {mediaList.length > 1 && (
                      <div className="flex items-center gap-1">
                        {mediaList.map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveMediaIndex(i)}
                            className={`w-2 h-2 rounded-full transition ${
                              i === activeMediaIndex ? 'bg-slate-900 scale-125' : 'bg-slate-300 hover:bg-slate-400'
                            }`}
                            title={`Lihat Media ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Main Full Media Box */}
                  <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center min-h-[200px] max-h-[380px] p-1.5 shadow-inner">
                    {isVid ? (
                      <video
                        controls
                        autoPlay={false}
                        preload="metadata"
                        poster={currentMedia.thumbnail_url || undefined}
                        src={currentMedia.file_url}
                        className="max-h-[360px] w-full max-w-full object-contain rounded"
                      >
                        Browser Anda tidak mendukung pemutar video HTML5.
                      </video>
                    ) : (
                      <img
                        src={currentMedia.file_url || currentMedia.thumbnail_url}
                        alt={currentMedia.title || selectedEvent.title}
                        className="max-h-[360px] w-auto max-w-full object-contain rounded transition-all"
                      />
                    )}
                  </div>

                  {/* Multi-media Thumbnail Strip */}
                  {mediaList.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                      {mediaList.map((m, idx) => {
                        const isItemVid =
                          m.file_type === 'video' || /\.(mp4|webm|mov|ogg|m4v)($|\?)/i.test(m.file_url || '');
                        const isItemSelected = idx === activeMediaIndex;
                        return (
                          <button
                            key={m.id || idx}
                            type="button"
                            onClick={() => setActiveMediaIndex(idx)}
                            className={`relative shrink-0 w-14 h-14 rounded-md overflow-hidden border-2 transition ${
                              isItemSelected
                                ? 'border-blue-600 ring-2 ring-blue-100'
                                : 'border-slate-200 opacity-70 hover:opacity-100'
                            }`}
                          >
                            {isItemVid ? (
                              <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                                <span className="text-[9px] font-bold">VID</span>
                              </div>
                            ) : (
                              <img
                                src={m.thumbnail_url || m.file_url}
                                alt={m.title || `Media ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Full Content / Caption */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Konten / Caption Lengkap:
              </span>
              <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap max-h-48 overflow-y-auto">
                {selectedEvent.caption || selectedEvent.title}
              </div>
            </div>

            {/* First Comment if any */}
            {selectedEvent.first_comment && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                  First Comment:
                </span>
                <div className="p-2.5 rounded-md bg-slate-100/70 border border-slate-200 text-xs text-slate-700 whitespace-pre-wrap">
                  {selectedEvent.first_comment}
                </div>
              </div>
            )}

            {/* Schedule Time & Target Info */}
            <div className="p-2.5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Waktu Tayang:</span>
              <span className="font-semibold text-slate-900 font-mono">
                {selectedEvent.start ? new Date(selectedEvent.start).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }) : 'Draft'} WIB
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const ev = selectedEvent;
                  confirm({
                    title: 'Hapus Jadwal Postingan?',
                    message: `Apakah Anda yakin ingin membatalkan dan menghapus jadwal postingan "${ev.title}"?`,
                    confirmText: 'Ya, Hapus Jadwal',
                    type: 'danger',
                    onConfirm: async () => {
                      try {
                        await api.deletePost(ev.id);
                        setEvents((prev) => prev.filter((e) => e.id !== ev.id));
                        toast.warning('Jadwal Dihapus', 'Postingan terjadwal telah dihapus dari database.');
                        setSelectedEvent(null);
                      } catch (e: any) {
                        toast.error('Gagal Menghapus', e.message || 'Gagal menghapus jadwal dari server.');
                      }
                    },
                  });
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Jadwal</span>
              </button>

              <Link
                href={`/composer?post_id=${selectedEvent.id}`}
                className="ui-btn ui-btn-primary text-xs"
              >
                Edit di Composer
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
