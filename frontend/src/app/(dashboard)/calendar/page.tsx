'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Filter,
  Clapperboard,
  MapPin,
  RefreshCw,
  Sparkles,
  Share2,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import {
  CalendarEvent,
  KanbanColumn,
  SocialAccount,
} from '@/lib/types';
import SocialIcon from '@/components/ui/SocialIcon';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import AttachmentList from '@/components/ui/AttachmentList';
import CalendarScheduleModal from '@/components/calendar/CalendarScheduleModal';
import CalendarEventDetailModal from '@/components/calendar/CalendarEventDetailModal';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const SHOOTING_STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  planned: { label: 'Rencana', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  confirmed: { label: 'Terkonfirmasi', badgeClass: 'bg-slate-900 text-white border-slate-900' },
  in_progress: { label: 'Sedang Take', badgeClass: 'bg-slate-800 text-slate-100 border-slate-700' },
  completed: { label: 'Selesai', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Dibatalkan', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function CalendarPage() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const searchParams = useSearchParams();

  // Core state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(() => new Date().getDate());
  const [filterType, setFilterType] = useState<'all' | 'post' | 'shooting'>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState('');

  // Connected Social Accounts (Poin 4!)
  const [connectedAccounts, setConnectedAccounts] = useState<SocialAccount[]>([]);

  // Selected Detail Modal / Inspector
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Unified Schedule Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalTab, setScheduleModalTab] = useState<'post' | 'shooting'>('post');
  const [kanbanIdeas, setKanbanIdeas] = useState<{ id: string; title: string; content?: string }[]>([]);
  const [prefilledPostIdeaId, setPrefilledPostIdeaId] = useState('');
  const [prefilledShootIdeaId, setPrefilledShootIdeaId] = useState('');
  const [prefilledPostCaption, setPrefilledPostCaption] = useState('');
  const [prefilledShootTitle, setPrefilledShootTitle] = useState('');
  const [prefilledShootDescription, setPrefilledShootDescription] = useState('');

  // Drag-and-drop state
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const dragDataRef = useRef<{ eventId: string; originalDate: string; eventType: 'post' | 'shooting' } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Load Connected Social Accounts
  const loadAccounts = useCallback(async () => {
    try {
      const data = await api.getSocialAccounts();
      if (data && data.accounts) {
        setConnectedAccounts(data.accounts);
      }
    } catch {
      // Non-blocking fallback
    }
  }, []);

  // Load Calendar Events & Kanban Ideas
  const loadCalendarData = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month + 2, 0).toISOString();

      const [calData, kanbanData] = await Promise.all([
        api.getCalendarEvents({ start_date: startDate, end_date: endDate }),
        api.getKanbanIdeas().catch(() => ({ columns: [] as KanbanColumn[] })),
      ]);

      if (calData && calData.events) {
        setEvents(calData.events);
      }

      if (kanbanData && kanbanData.columns) {
        const allCards = kanbanData.columns.flatMap((column) => column.cards || []);
        setKanbanIdeas(allCards);

        // Check if query params has idea_id (from Kanban)
        const paramIdeaId = searchParams.get('idea_id');
        const paramAction = searchParams.get('action');
        if (paramIdeaId) {
          const found = allCards.find((card) => card.id === paramIdeaId);
          if (found) {
            if (paramAction === 'shoot') {
              setPrefilledShootIdeaId(found.id);
              setPrefilledShootTitle(found.title);
              if (found.content) setPrefilledShootDescription(found.content);
              setScheduleModalTab('shooting');
            } else {
              setPrefilledPostIdeaId(found.id);
              const initialText = found.content
                ? `${found.title}\n\n${found.content}`
                : found.title;
              setPrefilledPostCaption(initialText);
              setScheduleModalTab('post');
            }
            setIsScheduleModalOpen(true);
          }
        }
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Tidak dapat terhubung ke server.');
      setLoadError(message);
      toast.error('Gagal Memuat Kalender', message);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [month, searchParams, toast, year]);

  useEffect(() => {
    void loadCalendarData();
    void loadAccounts();
  }, [loadCalendarData, loadAccounts]);

  // Calendar cells generation
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

  // Navigation handlers
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayNumber(today.getDate());
  };

  const handleDateClick = (dayNumber: number, openModal: boolean = false) => {
    setSelectedDayNumber(dayNumber);
    if (openModal) {
      setPrefilledPostCaption('');
      setPrefilledPostIdeaId('');
      setPrefilledShootTitle('');
      setPrefilledShootDescription('');
      setPrefilledShootIdeaId('');
      setIsScheduleModalOpen(true);
    }
  };

  // Filtered events based on Type, Platform, and Specific Account (Poin 4!)
  const filteredEvents = events.filter((ev) => {
    if (filterType === 'post' && ev.type === 'shooting') return false;
    if (filterType === 'shooting' && ev.type !== 'shooting') return false;

    // Filter by platform
    if (filterPlatform !== 'all') {
      if (ev.type === 'shooting') return filterPlatform === 'shooting';
      return ev.platforms && ev.platforms.includes(filterPlatform);
    }

    // Filter by specific account
    if (filterAccountId !== 'all') {
      if (ev.type === 'shooting') return false;
      if (!ev.accounts || ev.accounts.length === 0) return false;
      return ev.accounts.some((acc) => acc.id === filterAccountId || acc.account_handle === filterAccountId);
    }

    return true;
  });

  const activeDateEvents = selectedDayNumber
    ? filteredEvents.filter((ev) => {
        if (!ev.start) return false;
        const d = new Date(ev.start);
        return d.getDate() === selectedDayNumber && d.getMonth() === month && d.getFullYear() === year;
      })
    : filteredEvents;

  // Drag-and-drop Handlers
  const handleEventDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    dragDataRef.current = {
      eventId: event.id,
      originalDate: event.start,
      eventType: event.type === 'shooting' ? 'shooting' : 'post',
    };
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

    const { eventId, originalDate, eventType } = dragData;
    const origDate = new Date(originalDate);
    const origHours = origDate.getHours();
    const origMinutes = origDate.getMinutes();

    const newDate = new Date(year, month, targetDay, origHours, origMinutes);
    const newIsoString = newDate.toISOString();

    if (origDate.getDate() === targetDay && origDate.getMonth() === month && origDate.getFullYear() === year) {
      dragDataRef.current = null;
      return;
    }

    // Optimistic UI update
    setEvents((prev) =>
      prev.map((ev) => (ev.id === eventId ? { ...ev, start: newIsoString } : ev))
    );

    try {
      if (eventType === 'shooting') {
        await api.rescheduleShootingSession(eventId, newIsoString);
        toast.success(
          'Sesi Shooting Dipindahkan',
          `Jadwal shooting berhasil dipindahkan ke tanggal ${targetDay} ${MONTH_NAMES[month]} ${year}.`
        );
      } else {
        await api.reschedulePost(eventId, newIsoString);
        toast.success(
          'Postingan Dijadwalkan Ulang',
          `Postingan berhasil dipindahkan ke tanggal ${targetDay} ${MONTH_NAMES[month]} ${year}.`
        );
      }
    } catch (error: unknown) {
      setEvents((prev) =>
        prev.map((ev) => (ev.id === eventId ? { ...ev, start: originalDate } : ev))
      );
      toast.error('Gagal Memindahkan Jadwal', getErrorMessage(error, 'Terjadi kesalahan saat memindahkan jadwal.'));
    } finally {
      dragDataRef.current = null;
    }
  };

  // Toggle Equipment Checklist Item in Detail View
  const handleToggleEquipment = async (itemIdx: number) => {
    if (!selectedEvent || selectedEvent.type !== 'shooting') return;
    const currentChecklist = selectedEvent.equipment_checklist || [];
    const updatedChecklist = currentChecklist.map((item, idx) =>
      idx === itemIdx ? { ...item, checked: !item.checked } : item
    );

    const updatedEvent = { ...selectedEvent, equipment_checklist: updatedChecklist };
    setSelectedEvent(updatedEvent);
    setEvents((prev) => prev.map((ev) => (ev.id === selectedEvent.id ? updatedEvent : ev)));

    try {
      await api.updateShootingSession(selectedEvent.id, {
        equipment_checklist: updatedChecklist,
      });
    } catch (error: unknown) {
      toast.error('Gagal Update Checklist', getErrorMessage(error, 'Checklist belum berhasil diperbarui.'));
    }
  };

  // Delete Event Handler
  const handleDeleteEvent = async (eventToDelete: CalendarEvent) => {
    confirm({
      title: eventToDelete.type === 'shooting' ? 'Hapus Sesi Shooting?' : 'Hapus Postingan Terjadwal?',
      message: `Apakah Anda yakin ingin menghapus "${eventToDelete.title}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, Hapus',
      type: 'danger',
      onConfirm: async () => {
        try {
          if (eventToDelete.type === 'shooting') {
            await api.deleteShootingSession(eventToDelete.id);
            toast.success('Berhasil Dihapus', 'Sesi shooting telah dihapus dari kalender.');
          } else {
            await api.deletePost(eventToDelete.id);
            toast.success('Berhasil Dihapus', 'Postingan telah dihapus dari kalender.');
          }
          setEvents((prev) => prev.filter((ev) => ev.id !== eventToDelete.id));
          setSelectedEvent(null);
        } catch (error: unknown) {
          toast.error('Gagal Menghapus', getErrorMessage(error, 'Jadwal belum berhasil dihapus.'));
        }
      },
    });
  };

  const todayObj = new Date();
  const isCurrentMonthThisMonth = todayObj.getMonth() === month && todayObj.getFullYear() === year;

  return (
    <div className="space-y-3.5 max-w-full">
      {/* Header & Month Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
            <CalendarIcon className="w-4 h-4 text-slate-100" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Kalender Konten &amp; Sesi Shooting
            </h1>
            <p className="text-[11px] text-slate-500">
              Jadwal postingan media sosial per-akun dan rencana produksi shooting studio.
            </p>
          </div>
        </div>

        {/* Month Navigation & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-2.5 py-0.5 text-xs font-semibold text-slate-900 hover:bg-white rounded transition"
            >
              {MONTH_NAMES[month]} {year}
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleDateClick(selectedDayNumber || todayObj.getDate(), true)}
            className="ui-btn ui-btn-primary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Jadwal</span>
          </button>
        </div>
      </div>

      {loadError && (
        <div className="ui-card border-rose-200 bg-rose-50 text-rose-800 p-3 flex items-center justify-between gap-3" role="alert">
          <span className="text-xs">Kalender gagal dimuat: {loadError}</span>
          <button type="button" className="ui-btn ui-btn-secondary shrink-0" onClick={() => void loadCalendarData()}>
            <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
          </button>
        </div>
      )}

      {isLoading && (
        <div className="ui-card py-6 text-center text-xs text-slate-500" role="status">
          Memuat kalender dan sesi shooting...
        </div>
      )}

      {/* Filter Bar with Type, Platform, and Specific Social Account (Poin 4!) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Filter:</span>
          </span>

          <button
            type="button"
            onClick={() => {
              setFilterType('all');
              setFilterAccountId('all');
              setFilterPlatform('all');
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              filterType === 'all' && filterAccountId === 'all' && filterPlatform === 'all'
                ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Semua ({events.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('post')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
              filterType === 'post'
                ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Share2 className="w-3 h-3" />
            <span>Post Medsos ({events.filter((e) => e.type !== 'shooting').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('shooting')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${
              filterType === 'shooting'
                ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Clapperboard className="w-3 h-3" />
            <span>Sesi Shooting ({events.filter((e) => e.type === 'shooting').length})</span>
          </button>
        </div>

        {/* Account & Platform Filter Pills (Poin 4!) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter per Akun Spesifik */}
          {connectedAccounts.length > 0 && (
            <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
              <span className="text-[10.5px] font-bold text-slate-400 mr-1 hidden sm:inline">Akun:</span>
              <select
                value={filterAccountId}
                onChange={(e) => {
                  setFilterAccountId(e.target.value);
                  setFilterPlatform('all');
                }}
                className="text-[11px] font-medium p-1 bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none"
              >
                <option value="all">Semua Akun ({connectedAccounts.length})</option>
                {connectedAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    @{acc.account_handle || acc.account_name} ({acc.platform})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Platform Pills */}
          {['all', 'instagram', 'tiktok', 'linkedin', 'facebook'].map((plat) => (
            <button
              key={plat}
              type="button"
              onClick={() => {
                setFilterPlatform(plat);
                setFilterAccountId('all');
              }}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition ${
                filterPlatform === plat && filterAccountId === 'all'
                  ? 'bg-slate-800 text-white font-semibold shadow-2xs'
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
              <span>{plat === 'all' ? 'Semua Channel' : plat.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Split: Calendar (Left) & Day Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left Column: Calendar Grid (8 Cols) */}
        <div className="lg:col-span-8 ui-card p-0 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-xs">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center py-2 text-xs font-semibold text-slate-600">
            {DAYS.map((dayName, idx) => (
              <div key={dayName}>
                <span className="hidden sm:inline">{dayName}</span>
                <span className="sm:hidden">{DAYS_SHORT[idx]}</span>
              </div>
            ))}
          </div>

          {/* Month Day Cells */}
          <div
            className="grid grid-cols-7 divide-x divide-y divide-slate-200 bg-white"
            role="grid"
            aria-label={`Kalender ${MONTH_NAMES[month]} ${year}`}
          >
            {calendarCells.map((cell, idx) => {
              const cellDate = new Date(year, month + cell.monthOffset, cell.day);
              const cellDateLabel = cellDate.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              });
              const isToday =
                cell.isCurrent &&
                isCurrentMonthThisMonth &&
                cell.day === todayObj.getDate();
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
                  onClick={() => cell.isCurrent && handleDateClick(cell.day, false)}
                  onKeyDown={(event) => {
                    if (cell.isCurrent && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      handleDateClick(cell.day, false);
                    }
                  }}
                  role="gridcell"
                  tabIndex={cell.isCurrent ? 0 : -1}
                  aria-label={cellDateLabel}
                  aria-selected={isSelected}
                  onDragOver={(e) => (cell.isCurrent ? handleCellDragOver(e, cell.day) : undefined)}
                  onDragLeave={cell.isCurrent ? handleCellDragLeave : undefined}
                  onDrop={(e) => (cell.isCurrent ? handleCellDrop(e, cell.day) : undefined)}
                  className={`h-22 sm:h-26 p-1.5 flex flex-col justify-between cursor-pointer transition-all duration-150 relative group select-none ${
                    !cell.isCurrent
                      ? 'bg-slate-50/40 opacity-30 cursor-default'
                      : isDragTarget
                      ? 'bg-slate-100 ring-2 ring-inset ring-slate-400 shadow-inner'
                      : isSelected
                      ? 'bg-slate-100/90 font-medium ring-1 ring-inset ring-slate-300'
                      : isToday
                      ? 'bg-slate-50/80'
                      : 'hover:bg-slate-50/70'
                  }`}
                >
                  {/* Top Day Number Row */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center justify-center text-xs transition ${
                        isToday
                          ? 'w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[10px]'
                          : isSelected
                          ? 'w-5 h-5 rounded-full bg-slate-700 text-white font-bold text-[10px]'
                          : cell.isCurrent
                          ? 'text-slate-800 font-medium pl-0.5 text-xs'
                          : 'text-slate-400 pl-0.5'
                      }`}
                    >
                      {cell.day}
                    </span>

                    {/* Quick Add Button on Hover */}
                    {cell.isCurrent && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDateClick(cell.day, true);
                        }}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition shadow-2xs"
                        title="Tambah jadwal"
                        aria-label={`Tambah jadwal pada ${cellDateLabel}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Cell Events Badges (Draggable) with Account Info (Poin 4!) */}
                  <div className="space-y-1 overflow-y-auto max-h-[58px] sm:max-h-[68px] pr-0.5">
                    {cellEvents.slice(0, 2).map((ev) => {
                      const isShooting = ev.type === 'shooting';
                      const primaryAccount = ev.accounts && ev.accounts.length > 0 ? ev.accounts[0] : null;

                      return (
                        <div
                          key={ev.id}
                          draggable
                          onDragStart={(e) => handleEventDragStart(e, ev)}
                          onDragEnd={handleEventDragEnd}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(ev);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              setSelectedEvent(ev);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Buka detail ${ev.title}`}
                          className={`px-1.5 py-0.5 rounded-md border text-[10px] leading-tight transition cursor-grab active:cursor-grabbing truncate flex items-center gap-1 ${
                            isShooting
                              ? 'bg-slate-100 border-slate-300 text-slate-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-2xs'
                          }`}
                          title={`${ev.title} (Geser untuk pindah)`}
                        >
                          {isShooting ? (
                            <Clapperboard className="w-2.5 h-2.5 text-slate-800 shrink-0" />
                          ) : (
                            <div className="shrink-0 flex items-center">
                              {ev.platforms && ev.platforms.length > 0 && (
                                <SocialIcon platform={ev.platforms[0]} size={9} />
                              )}
                            </div>
                          )}

                          {/* Account Handle or Title */}
                          <span className="truncate flex-1 font-medium text-[9.5px]">
                            {!isShooting && primaryAccount?.account_handle ? (
                              <strong className="text-slate-900 mr-0.5">@{primaryAccount.account_handle}:</strong>
                            ) : null}
                            {ev.title}
                          </span>
                        </div>
                      );
                    })}

                    {cellEvents.length > 2 && (
                      <div className="text-[9px] text-slate-500 font-semibold pl-1">
                        +{cellEvents.length - 2} lainnya
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Dedicated Day Agenda & Inspector Panel (4 Cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="ui-card p-3.5 space-y-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            {/* Selected Date Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-700" />
                <div>
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {selectedDayNumber
                      ? `${selectedDayNumber} ${MONTH_NAMES[month]} ${year}`
                      : 'Semua Agenda'}
                  </h2>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {activeDateEvents.length} Agenda Terjadwal
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDateClick(selectedDayNumber || todayObj.getDate(), true)}
                className="ui-btn ui-btn-secondary py-1 px-2.5 text-[11px] font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah</span>
              </button>
            </div>

            {/* Agenda List for Selected Day */}
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-0.5">
              {activeDateEvents.length > 0 ? (
                activeDateEvents.map((ev) => {
                  const isShooting = ev.type === 'shooting';
                  const shootConf = SHOOTING_STATUS_CONFIG[ev.status] || SHOOTING_STATUS_CONFIG.planned;

                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition cursor-pointer space-y-2 text-xs bg-white shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isShooting ? (
                            <Clapperboard className="w-3.5 h-3.5 text-slate-800 shrink-0" />
                          ) : (
                            <div className="shrink-0 flex items-center">
                              {ev.platforms && ev.platforms.length > 0 && (
                                <SocialIcon platform={ev.platforms[0]} size={12} />
                              )}
                            </div>
                          )}
                          <span className="font-semibold text-slate-900 truncate text-xs">
                            {ev.title}
                          </span>
                        </div>

                        {isShooting ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${shootConf.badgeClass}`}>
                            {shootConf.label}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {ev.platforms.join(', ').toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Account Badges per Post (Poin 4!) */}
                      {!isShooting && ev.accounts && ev.accounts.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {ev.accounts.map((acc) => (
                            <span
                              key={acc.id}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-medium text-slate-800 border border-slate-200"
                            >
                              <SocialIcon platform={acc.platform} size={9} />
                              <span>@{acc.account_handle || acc.account_name}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Time & Location */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {ev.start
                              ? new Date(ev.start).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
                          </span>
                        </span>

                        {ev.location && (
                          <span className="flex items-center gap-1 text-slate-600 truncate max-w-[130px]">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{ev.location}</span>
                          </span>
                        )}
                      </div>

                      {/* Idea / Brief Reference Badge */}
                      {ev.related_idea_title && (
                        <div className="text-[10px] text-blue-800 font-semibold flex items-center gap-1 bg-blue-50/90 px-2 py-0.5 rounded border border-blue-200/90 truncate">
                          <Sparkles className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                          <span className="truncate">Sumber Brief: {ev.related_idea_title}</span>
                        </div>
                      )}

                      {/* Caption snippet */}
                      {(ev.caption || ev.description) && (
                        <p className="text-[10.5px] text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed font-sans">
                          {ev.caption || ev.description}
                        </p>
                      )}

                      {/* Attachments preview */}
                      {ev.attachments && ev.attachments.length > 0 && (
                        <div className="mt-1">
                          <AttachmentList attachments={ev.attachments} compact />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <CalendarIcon className="w-7 h-7 mx-auto text-slate-300" />
                  <p className="text-xs">Tidak ada agenda pada tanggal ini.</p>
                  <button
                    type="button"
                    onClick={() => handleDateClick(selectedDayNumber || todayObj.getDate(), true)}
                    className="text-xs font-semibold text-slate-800 hover:underline"
                  >
                    + Tambah Jadwal Sekarang
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: UNIFIED SCHEDULE MODAL (Rich Editor, Media, GDocs, Accounts)     */}
      {/* ========================================================================= */}
      <CalendarScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        selectedDayNumber={selectedDayNumber}
        month={month}
        year={year}
        kanbanIdeas={kanbanIdeas}
        connectedAccounts={connectedAccounts}
        initialTab={scheduleModalTab}
        initialPostIdeaId={prefilledPostIdeaId}
        initialShootIdeaId={prefilledShootIdeaId}
        initialPostCaption={prefilledPostCaption}
        initialShootTitle={prefilledShootTitle}
        initialShootDescription={prefilledShootDescription}
        onPostCreated={(newEv) => setEvents((prev) => [...prev, newEv])}
        onShootingCreated={(newEv) => setEvents((prev) => [...prev, newEv])}
      />

      {/* ========================================================================= */}
      {/* MODAL 2: EVENT DETAIL INSPECTOR & INLINE EDITOR (Poin 2 & Poin 5!)        */}
      {/* ========================================================================= */}
      <CalendarEventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        connectedAccounts={connectedAccounts}
        onEventUpdated={(updatedEv) => {
          setEvents((prev) => prev.map((e) => (e.id === updatedEv.id ? updatedEv : e)));
          setSelectedEvent(updatedEv);
        }}
        onDelete={handleDeleteEvent}
        onToggleEquipment={handleToggleEquipment}
      />
    </div>
  );
}
