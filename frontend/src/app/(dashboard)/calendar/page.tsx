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
  Move,
  Clapperboard,
  Video,
  MapPin,
  Users,
  CheckSquare,
  Square,
  Sparkles,
  Trash2,
  Edit3,
  CalendarRange,
  LayoutGrid,
  ListCheck,
  Tag,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CalendarEvent, ShootingCrewMember, ShootingEquipmentItem, ShootingSession } from '@/lib/types';
import SocialIcon from '@/components/ui/SocialIcon';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const SHOOTING_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  planned: { label: 'Rencana', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  confirmed: { label: 'Terkonfirmasi', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  in_progress: { label: 'Sedang Take', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  completed: { label: 'Selesai Shooting', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  cancelled: { label: 'Dibatalkan', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarPage() {
  const toast = useToast();
  const { confirm } = useConfirm();

  // Core state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | null>(() => new Date().getDate());
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');
  const [filterType, setFilterType] = useState<'all' | 'post' | 'shooting'>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected Detail Modal / Inspector
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number>(0);

  // Unified Schedule Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [activeScheduleTab, setActiveScheduleTab] = useState<'post' | 'shooting'>('post');

  // Post Schedule Form state
  const [postCaption, setPostCaption] = useState('');
  const [postDate, setPostDate] = useState(() => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    return formatDateTimeLocal(d);
  });
  const [postPlatform, setPostPlatform] = useState('instagram');
  const [kanbanIdeas, setKanbanIdeas] = useState<{ id: string; title: string; content?: string }[]>([]);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string>('');

  // Shooting Session Form state
  const [shootTitle, setShootTitle] = useState('');
  const [shootLocation, setShootLocation] = useState('');
  const [shootScheduledAt, setShootScheduledAt] = useState(() => {
    const d = new Date();
    d.setHours(14, 0, 0, 0);
    return formatDateTimeLocal(d);
  });
  const [shootEndAt, setShootEndAt] = useState(() => {
    const d = new Date();
    d.setHours(17, 0, 0, 0);
    return formatDateTimeLocal(d);
  });
  const [shootDescription, setShootDescription] = useState('');
  const [shootStatus, setShootStatus] = useState<string>('planned');
  
  // Crew & Equipment state in modal
  const [crewList, setCrewList] = useState<ShootingCrewMember[]>([
    { name: '', role: 'Videografer' },
  ]);
  const [newCrewName, setNewCrewName] = useState('');
  const [newCrewRole, setNewCrewRole] = useState('Talent / Host');
  
  const [equipmentList, setEquipmentList] = useState<ShootingEquipmentItem[]>([
    { item: 'Kamera Utama (Sony A7IV)', checked: true },
    { item: 'Mic Wireless Rode / DJI', checked: true },
    { item: 'Lighting Softbox & RGB', checked: false },
  ]);
  const [newEquipmentItem, setNewEquipmentItem] = useState('');

  // Drag-and-drop state
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const dragDataRef = useRef<{ eventId: string; originalDate: string; eventType: 'post' | 'shooting' } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadCalendarData = async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month + 2, 0).toISOString();
      
      const [calData, kanbanData] = await Promise.all([
        api.getCalendarEvents({ start_date: startDate, end_date: endDate }),
        api.getKanbanIdeas().catch(() => ({ columns: [] })),
      ]);

      if (calData && calData.events) {
        setEvents(calData.events);
      }
      if (kanbanData && kanbanData.columns) {
        const allCards = kanbanData.columns.flatMap((col: any) => col.cards || []);
        setKanbanIdeas(allCards);
      }
    } catch (err: any) {
      toast.error('Gagal Memuat Kalender', err.message || 'Tidak dapat terhubung ke server.');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, [currentDate]);

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

  // Date selection & auto-prefill handler
  const handleDateClick = (dayNumber: number, openModal: boolean = false) => {
    setSelectedDayNumber(dayNumber);
    const targetDate = new Date(year, month, dayNumber, 10, 0, 0);
    const targetShootEnd = new Date(year, month, dayNumber, 13, 0, 0);

    const formattedStart = formatDateTimeLocal(targetDate);
    const formattedEnd = formatDateTimeLocal(targetShootEnd);

    setPostDate(formattedStart);
    setShootScheduledAt(formattedStart);
    setShootEndAt(formattedEnd);

    if (openModal) {
      setIsScheduleModalOpen(true);
    }
  };

  // Filtered events
  const filteredEvents = events.filter((ev) => {
    // Filter Type: all / post / shooting
    if (filterType === 'post' && ev.type === 'shooting') return false;
    if (filterType === 'shooting' && ev.type !== 'shooting') return false;

    // Filter Platform
    if (filterPlatform !== 'all') {
      if (ev.type === 'shooting') return filterPlatform === 'shooting';
      return ev.platforms && ev.platforms.includes(filterPlatform);
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

  // --- Drag-and-Drop Handlers ---
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

    // If dropped on the same day, ignore
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
          `Jadwal shooting berhasil digeser ke tanggal ${targetDay} ${MONTH_NAMES[month]} ${year}.`
        );
      } else {
        await api.reschedulePost(eventId, newIsoString);
        toast.success(
          'Postingan Dijadwalkan Ulang',
          `Postingan berhasil dipindahkan ke tanggal ${targetDay} ${MONTH_NAMES[month]} ${year}.`
        );
      }
    } catch (err: any) {
      // Rollback on error
      setEvents((prev) =>
        prev.map((ev) => (ev.id === eventId ? { ...ev, start: originalDate } : ev))
      );
      toast.error('Gagal Memindahkan Jadwal', err.message || 'Terjadi kesalahan saat memindahkan jadwal.');
    } finally {
      dragDataRef.current = null;
    }
  };

  // Submit Social Post Handler
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postCaption.trim()) {
      toast.error('Validasi Gagal', 'Caption atau judul postingan tidak boleh kosong.');
      return;
    }

    try {
      const res = await api.createPost({
        master_caption: postCaption,
        target_account_ids: [postPlatform],
        scheduled_at: postDate,
      });

      const newEv: CalendarEvent = {
        id: res.post_id || `post-${Date.now()}`,
        type: 'post',
        title: postCaption,
        start: postDate,
        platforms: [postPlatform],
        status: 'scheduled',
      };

      setEvents((prev) => [...prev, newEv]);
      toast.success('Jadwal Ditambahkan', 'Postingan media sosial berhasil dijadwalkan.');
      setIsScheduleModalOpen(false);
      setPostCaption('');
    } catch (err: any) {
      toast.error('Gagal Menjadwalkan', err.message || 'Tidak dapat menyimpan postingan ke server.');
    }
  };

  // Submit Shooting Session Handler
  const handleShootingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shootTitle.trim()) {
      toast.error('Validasi Gagal', 'Judul rencana sesi shooting wajib diisi.');
      return;
    }

    try {
      const cleanCrew = crewList.filter((c) => c.name.trim().length > 0);
      const cleanEquipment = equipmentList.filter((eq) => eq.item.trim().length > 0);

      const res = await api.createShootingSession({
        title: shootTitle,
        description: shootDescription,
        location: shootLocation,
        scheduled_at: shootScheduledAt,
        end_at: shootEndAt || undefined,
        status: shootStatus,
        crew_members: cleanCrew,
        equipment_checklist: cleanEquipment,
      });

      const newSession = res.session;
      const newEv: CalendarEvent = {
        id: newSession?.id || `shoot-${Date.now()}`,
        type: 'shooting',
        title: shootTitle,
        description: shootDescription,
        location: shootLocation,
        start: shootScheduledAt,
        end: shootEndAt,
        status: shootStatus,
        crew_members: cleanCrew,
        equipment_checklist: cleanEquipment,
        platforms: ['shooting'],
      };

      setEvents((prev) => [...prev, newEv]);
      toast.success('Sesi Shooting Dibuat', `Rencana shooting "${shootTitle}" berhasil disimpan ke kalender.`);
      setIsScheduleModalOpen(false);
      setShootTitle('');
      setShootDescription('');
      setShootLocation('');
    } catch (err: any) {
      toast.error('Gagal Menyimpan Shooting', err.message || 'Gagal menyimpan sesi shooting.');
    }
  };

  // Toggle Equipment Checklist Item in Detail View
  const handleToggleEquipment = async (itemIdx: number) => {
    if (!selectedEvent || selectedEvent.type !== 'shooting') return;
    const currentChecklist = selectedEvent.equipment_checklist || [];
    const updatedChecklist = currentChecklist.map((item, idx) =>
      idx === itemIdx ? { ...item, checked: !item.checked } : item
    );

    // Optimistic update
    const updatedEvent = { ...selectedEvent, equipment_checklist: updatedChecklist };
    setSelectedEvent(updatedEvent);
    setEvents((prev) => prev.map((ev) => (ev.id === selectedEvent.id ? updatedEvent : ev)));

    try {
      await api.updateShootingSession(selectedEvent.id, {
        equipment_checklist: updatedChecklist,
      });
    } catch (err: any) {
      toast.error('Gagal Update Checklist', err.message);
    }
  };

  // Delete Event Handler
  const handleDeleteEvent = async (event: CalendarEvent) => {
    confirm({
      title: event.type === 'shooting' ? 'Hapus Sesi Shooting?' : 'Hapus Postingan Terjadwal?',
      message: `Apakah Anda yakin ingin menghapus "${event.title}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, Hapus',
      type: 'danger',
      onConfirm: async () => {
        try {
          if (event.type === 'shooting') {
            await api.deleteShootingSession(event.id);
            toast.success('Berhasil Dihapus', 'Sesi shooting telah dihapus.');
          } else {
            await api.deletePost(event.id);
            toast.success('Berhasil Dihapus', 'Postingan telah dihapus dari kalender.');
          }
          setEvents((prev) => prev.filter((ev) => ev.id !== event.id));
          setSelectedEvent(null);
        } catch (err: any) {
          toast.error('Gagal Menghapus', err.message);
        }
      },
    });
  };

  const todayObj = new Date();
  const isCurrentMonthThisMonth = todayObj.getMonth() === month && todayObj.getFullYear() === year;

  return (
    <div className="space-y-4 max-w-full">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <CalendarIcon className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Kalender Konten & Sesi Shooting
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                v2.1 Production
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Kelola timeline postingan media sosial dan rencana produksi shooting studio dalam satu tempat.
            </p>
          </div>
        </div>

        {/* Right Navigation & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Month Navigation Control */}
          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 hover:text-slate-900 transition"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-1 text-xs font-bold text-slate-900 hover:bg-white rounded-md transition tracking-tight"
            >
              {MONTH_NAMES[month]} {year}
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 hover:text-slate-900 transition"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 ${
                viewMode === 'month' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid Kalender</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 ${
                viewMode === 'agenda' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <ListCheck className="w-3.5 h-3.5" />
              <span>Agenda List</span>
            </button>
          </div>

          {/* Add Schedule Button */}
          <button
            type="button"
            onClick={() => handleDateClick(selectedDayNumber || todayObj.getDate(), true)}
            className="ui-btn ui-btn-primary py-2 px-3 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Jadwal / Shooting</span>
          </button>
        </div>
      </div>

      {/* Category & Channel Filter Bar */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Category Type Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Tipe:</span>
          </span>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              filterType === 'all'
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Semua ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('post')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              filterType === 'post'
                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>📱 Post Medsos ({events.filter((e) => e.type !== 'shooting').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('shooting')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
              filterType === 'shooting'
                ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span>🎬 Sesi Shooting ({events.filter((e) => e.type === 'shooting').length})</span>
          </button>
        </div>

        {/* Platform Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', 'instagram', 'tiktok', 'linkedin', 'facebook', 'youtube'].map((plat) => (
            <button
              key={plat}
              type="button"
              onClick={() => setFilterPlatform(plat)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition ${
                filterPlatform === plat
                  ? 'bg-slate-800 text-white font-semibold'
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

      {/* Main Expansive Calendar Grid Layout */}
      {viewMode === 'month' ? (
        <div className="ui-card p-0 overflow-hidden shadow-sm border border-slate-200 rounded-xl bg-white">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90 text-center py-2.5 text-xs font-bold text-slate-700">
            {DAYS.map((dayName, idx) => (
              <div key={dayName} className="flex flex-col items-center">
                <span className="hidden md:inline">{dayName}</span>
                <span className="md:hidden">{DAYS_SHORT[idx]}</span>
              </div>
            ))}
          </div>

          {/* Month Day Cells Grid (Expansive & Responsive) */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 bg-white">
            {calendarCells.map((cell, idx) => {
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
                  onDragOver={(e) => (cell.isCurrent ? handleCellDragOver(e, cell.day) : undefined)}
                  onDragLeave={cell.isCurrent ? handleCellDragLeave : undefined}
                  onDrop={(e) => (cell.isCurrent ? handleCellDrop(e, cell.day) : undefined)}
                  className={`min-h-[90px] sm:min-h-[115px] lg:min-h-[125px] p-2 flex flex-col justify-between cursor-pointer transition-all duration-150 relative group select-none ${
                    !cell.isCurrent
                      ? 'bg-slate-50/50 opacity-30 cursor-default'
                      : isDragTarget
                      ? 'bg-blue-50/90 ring-2 ring-inset ring-blue-500 shadow-inner'
                      : isSelected
                      ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-300'
                      : isToday
                      ? 'bg-amber-50/30'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Cell Top Header */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`inline-flex items-center justify-center text-xs transition ${
                        isToday
                          ? 'w-6 h-6 rounded-full bg-slate-900 text-white font-bold shadow-xs'
                          : isSelected
                          ? 'w-6 h-6 rounded-full bg-indigo-600 text-white font-bold shadow-xs'
                          : cell.isCurrent
                          ? 'text-slate-800 font-semibold text-xs'
                          : 'text-slate-400'
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
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 shadow-xs transition"
                        title={`Tambah Jadwal pada tanggal ${cell.day} ${MONTH_NAMES[month]}`}
                      >
                        <Plus className="w-3 h-3 text-indigo-600" />
                      </button>
                    )}
                  </div>

                  {/* Cell Events List (Cards) */}
                  <div className="space-y-1 overflow-y-auto max-h-[85px] sm:max-h-[95px] pr-0.5 custom-scrollbar">
                    {cellEvents.map((ev) => {
                      const isShooting = ev.type === 'shooting';
                      const shootConf = SHOOTING_STATUS_CONFIG[ev.status] || SHOOTING_STATUS_CONFIG.planned;

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
                          className={`p-1.5 rounded-md border text-[11px] leading-tight transition cursor-grab active:cursor-grabbing hover:shadow-xs flex items-center gap-1.5 ${
                            isShooting
                              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-medium hover:bg-emerald-100'
                              : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-white hover:border-slate-300 font-normal'
                          }`}
                          title={`${ev.title} — Klik untuk detail / Geser untuk pindah tanggal`}
                        >
                          {isShooting ? (
                            <Clapperboard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <div className="flex items-center gap-0.5 shrink-0">
                              {ev.platforms && ev.platforms.length > 0 && (
                                <SocialIcon platform={ev.platforms[0]} size={11} />
                              )}
                            </div>
                          )}

                          <span className="truncate flex-1 font-semibold text-[10.5px]">
                            {ev.title}
                          </span>

                          <span className="text-[9.5px] text-slate-500 font-mono shrink-0">
                            {ev.start
                              ? new Date(ev.start).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty state indicator if no events */}
                  {cell.isCurrent && cellEvents.length === 0 && (
                    <div className="text-[10px] text-slate-300 italic pt-1 pointer-events-none hidden sm:block">
                      Kosong
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Agenda List View Mode */
        <div className="ui-card p-4 space-y-3 bg-white border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-indigo-600" />
              <span>Daftar Agenda {MONTH_NAMES[month]} {year}</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Total {filteredEvents.length} agenda ditemukan
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="py-3 px-2 hover:bg-slate-50 rounded-lg transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        ev.type === 'shooting'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {ev.type === 'shooting' ? (
                        <Clapperboard className="w-5 h-5" />
                      ) : (
                        <SocialIcon platform={ev.platforms[0] || 'instagram'} size={18} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs font-bold text-slate-900">{ev.title}</h3>
                        {ev.type === 'shooting' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            🎬 Sesi Shooting
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {ev.platforms.join(', ').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {ev.start
                              ? new Date(ev.start).toLocaleDateString('id-ID', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-'}
                          </span>
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-1 text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                            <span>{ev.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(ev);
                      }}
                      className="ui-btn ui-btn-secondary py-1 px-2.5 text-xs flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400">
                <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs">Tidak ada agenda pada bulan ini.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: UNIFIED SCHEDULE MODAL (Tabs: Social Post & Shooting Session)   */}
      {/* ========================================================================= */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Tambah Agenda Baru</h2>
                  <p className="text-[11px] text-slate-500">
                    Otomatis dijadwalkan pada tanggal terpilih:{' '}
                    <strong className="text-indigo-600">
                      {selectedDayNumber} {MONTH_NAMES[month]} {year}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-slate-200 bg-slate-100/70 p-1">
              <button
                type="button"
                onClick={() => setActiveScheduleTab('post')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeScheduleTab === 'post'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>1. Jadwal Postingan Medsos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveScheduleTab('shooting')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  activeScheduleTab === 'shooting'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clapperboard className="w-3.5 h-3.5" />
                <span>2. Rencana Sesi Shooting 🎬</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5">
              {activeScheduleTab === 'post' ? (
                /* TAB 1: SOCIAL POST FORM */
                <form onSubmit={handlePostSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Konten / Caption Utama
                    </label>
                    <textarea
                      rows={3}
                      value={postCaption}
                      onChange={(e) => setPostCaption(e.target.value)}
                      placeholder="Tulis draf caption konten Anda di sini..."
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Saluran Target
                      </label>
                      <select
                        value={postPlatform}
                        onChange={(e) => setPostPlatform(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="facebook">Facebook</option>
                        <option value="youtube">YouTube</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Waktu Tayang (Otomatis Prefill)
                      </label>
                      <input
                        type="datetime-local"
                        value={postDate}
                        onChange={(e) => setPostDate(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(false)}
                      className="ui-btn ui-btn-secondary py-2 text-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="ui-btn ui-btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Jadwalkan Postingan</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* TAB 2: SHOOTING SESSION FORM */
                <form onSubmit={handleShootingSubmit} className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Judul Sesi Shooting <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shootTitle}
                      onChange={(e) => setShootTitle(e.target.value)}
                      placeholder="Contoh: Shooting Video Reels Edukasi Ep. 12"
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span>Lokasi Shooting</span>
                      </label>
                      <input
                        type="text"
                        value={shootLocation}
                        onChange={(e) => setShootLocation(e.target.value)}
                        placeholder="Studio Utama WIG / Outdoor Tebet"
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Status Produksi
                      </label>
                      <select
                        value={shootStatus}
                        onChange={(e) => setShootStatus(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="planned">Rencana</option>
                        <option value="confirmed">Terkonfirmasi</option>
                        <option value="in_progress">Sedang Berlangsung</option>
                        <option value="completed">Selesai Shooting</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mulai Jam
                      </label>
                      <input
                        type="datetime-local"
                        value={shootScheduledAt}
                        onChange={(e) => setShootScheduledAt(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Selesai Estimasi
                      </label>
                      <input
                        type="datetime-local"
                        value={shootEndAt}
                        onChange={(e) => setShootEndAt(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Brief / Konsep / Catatan Produksi
                    </label>
                    <textarea
                      rows={2}
                      value={shootDescription}
                      onChange={(e) => setShootDescription(e.target.value)}
                      placeholder="Konsep visual, alur skrip, atau catatan penting untuk talent & tim..."
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Dynamic Crew & Equipment */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Kru & Talent Terlibat</span>
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCrewName}
                        onChange={(e) => setNewCrewName(e.target.value)}
                        placeholder="Nama talent / kru..."
                        className="flex-1 text-xs p-1.5 rounded-md border border-slate-200 bg-white"
                      />
                      <input
                        type="text"
                        value={newCrewRole}
                        onChange={(e) => setNewCrewRole(e.target.value)}
                        placeholder="Peran (Videografer/Talent)"
                        className="w-36 text-xs p-1.5 rounded-md border border-slate-200 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCrewName.trim()) return;
                          setCrewList((prev) => [...prev, { name: newCrewName, role: newCrewRole }]);
                          setNewCrewName('');
                        }}
                        className="px-2.5 py-1 bg-slate-800 text-white rounded-md text-xs font-semibold hover:bg-slate-900"
                      >
                        + Tambah
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {crewList.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] text-slate-700 flex items-center gap-1"
                        >
                          <strong>{c.name}</strong> ({c.role})
                          <button
                            type="button"
                            onClick={() => setCrewList((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-slate-400 hover:text-rose-500 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(false)}
                      className="ui-btn ui-btn-secondary py-2 text-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="ui-btn bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Clapperboard className="w-3.5 h-3.5" />
                      <span>Simpan Sesi Shooting</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EVENT DETAIL INSPECTOR (Post & Shooting Session)                 */}
      {/* ========================================================================= */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div
              className={`px-5 py-4 border-b flex items-center justify-between ${
                selectedEvent.type === 'shooting'
                  ? 'bg-emerald-50/80 border-emerald-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    selectedEvent.type === 'shooting'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {selectedEvent.type === 'shooting' ? (
                    <Clapperboard className="w-4 h-4" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedEvent.type === 'shooting'
                      ? 'Detail Sesi Shooting'
                      : 'Detail Postingan Medsos'}
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ID: {selectedEvent.id.slice(0, 18)}...
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Content */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <h4 className="text-base font-bold text-slate-900">{selectedEvent.title}</h4>
                {selectedEvent.caption && (
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {selectedEvent.caption}
                  </p>
                )}
                {selectedEvent.description && (
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap bg-emerald-50/40 p-3 rounded-lg border border-emerald-200">
                    {selectedEvent.description}
                  </p>
                )}
              </div>

              {/* Time & Location Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[11px] text-slate-400 font-medium block">Waktu Pelaksanaan</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      {selectedEvent.start
                        ? new Date(selectedEvent.start).toLocaleString('id-ID', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </span>
                  </span>
                </div>

                {selectedEvent.location && (
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium block">Lokasi Studio</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>{selectedEvent.location}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Interactive Equipment Checklist (Shooting Only) */}
              {selectedEvent.type === 'shooting' &&
                selectedEvent.equipment_checklist &&
                selectedEvent.equipment_checklist.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Checklist Peralatan & Properti (Klik untuk Check/Uncheck)</span>
                    </span>
                    <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {selectedEvent.equipment_checklist.map((eq, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleEquipment(idx)}
                          className="w-full flex items-center gap-2 p-1.5 rounded-md hover:bg-white text-left transition text-xs select-none"
                        >
                          {eq.checked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span
                            className={
                              eq.checked ? 'line-through text-slate-400 font-normal' : 'text-slate-800 font-medium'
                            }
                          >
                            {eq.item}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {/* Crew List (Shooting Only) */}
              {selectedEvent.type === 'shooting' &&
                selectedEvent.crew_members &&
                selectedEvent.crew_members.length > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Daftar Kru & Talent</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedEvent.crew_members.map((c, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-700 font-medium border border-slate-200"
                        >
                          {c.name} <span className="text-slate-400">({c.role})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteEvent(selectedEvent)}
                className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Agenda</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="ui-btn ui-btn-primary py-1.5 px-4 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
