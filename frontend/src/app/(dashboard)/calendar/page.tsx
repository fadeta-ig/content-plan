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
  Radio,
  SlidersHorizontal,
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

const SHOOTING_STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  planned: { label: 'Rencana', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
  confirmed: { label: 'Terkonfirmasi', badgeClass: 'bg-slate-900 text-white border-slate-900' },
  in_progress: { label: 'Sedang Take', badgeClass: 'bg-slate-800 text-slate-100 border-slate-700' },
  completed: { label: 'Selesai', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'Dibatalkan', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
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
  const [filterType, setFilterType] = useState<'all' | 'post' | 'shooting'>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Selected Detail Modal / Inspector
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

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
    { item: 'Mic Wireless Clip-on', checked: true },
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
      
      const calData = await api.getCalendarEvents({ start_date: startDate, end_date: endDate });
      if (calData && calData.events) {
        setEvents(calData.events);
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
    const targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0, 0);
    setPostDate(formatDateTimeLocal(targetDate));
    setShootScheduledAt(formatDateTimeLocal(targetDate));
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
    if (filterType === 'post' && ev.type === 'shooting') return false;
    if (filterType === 'shooting' && ev.type !== 'shooting') return false;

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
    <div className="space-y-3 max-w-full">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-slate-900 text-white flex items-center justify-center">
            <CalendarIcon className="w-4 h-4 text-slate-100" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Kalender Konten & Sesi Shooting
            </h1>
            <p className="text-[11px] text-slate-500">
              Jadwal postingan media sosial dan rencana produksi shooting studio.
            </p>
          </div>
        </div>

        {/* Month Navigation & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center bg-slate-50 rounded-md border border-slate-200 p-0.5">
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
            className="ui-btn ui-btn-primary py-1.5 px-3 text-xs font-medium flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Jadwal</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>Filter:</span>
          </span>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              filterType === 'all'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Semua ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('post')}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
              filterType === 'post'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Share2 className="w-3 h-3" />
            <span>Post Medsos ({events.filter((e) => e.type !== 'shooting').length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('shooting')}
            className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
              filterType === 'shooting'
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Clapperboard className="w-3 h-3" />
            <span>Sesi Shooting ({events.filter((e) => e.type === 'shooting').length})</span>
          </button>
        </div>

        {/* Platform Filter Pills */}
        <div className="flex items-center gap-1 flex-wrap">
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

      {/* Main 2-Column Split: Calendar (Left) & Dedicated Day Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left Column: Calendar Grid (8 Cols) */}
        <div className="lg:col-span-8 ui-card p-0 overflow-hidden border border-slate-200 rounded-lg bg-white shadow-xs">
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
                  className={`h-20 sm:h-24 p-1.5 flex flex-col justify-between cursor-pointer transition-all duration-150 relative group select-none ${
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
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition shadow-2xs"
                        title="Tambah jadwal"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Cell Events Badges (Draggable) */}
                  <div className="space-y-1 overflow-y-auto max-h-[50px] sm:max-h-[60px] pr-0.5">
                    {cellEvents.slice(0, 2).map((ev) => {
                      const isShooting = ev.type === 'shooting';

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
                          className={`px-1.5 py-0.5 rounded border text-[10px] leading-tight transition cursor-grab active:cursor-grabbing truncate flex items-center gap-1 ${
                            isShooting
                              ? 'bg-slate-100 border-slate-300 text-slate-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
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

                          <span className="truncate flex-1 font-medium text-[9.5px]">
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
          <div className="ui-card p-3.5 space-y-3 bg-white border border-slate-200 rounded-lg shadow-xs">
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
                className="ui-btn ui-btn-secondary py-1 px-2 text-[11px] font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Tambah</span>
              </button>
            </div>

            {/* Agenda List for Selected Day */}
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-0.5">
              {activeDateEvents.length > 0 ? (
                activeDateEvents.map((ev) => {
                  const isShooting = ev.type === 'shooting';
                  const shootConf = SHOOTING_STATUS_CONFIG[ev.status] || SHOOTING_STATUS_CONFIG.planned;

                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="p-2.5 rounded-md border border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 transition cursor-pointer space-y-1.5 text-xs bg-white shadow-2xs"
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
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${shootConf.badgeClass}`}>
                            {shootConf.label}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {ev.platforms.join(', ').toUpperCase()}
                          </span>
                        )}
                      </div>

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

                      {/* Brief description snippet */}
                      {(ev.caption || ev.description) && (
                        <p className="text-[10.5px] text-slate-600 line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                          {ev.caption || ev.description}
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <CalendarIcon className="w-6 h-6 mx-auto text-slate-300" />
                  <p className="text-xs">Tidak ada agenda pada tanggal ini.</p>
                  <button
                    type="button"
                    onClick={() => handleDateClick(selectedDayNumber || todayObj.getDate(), true)}
                    className="text-[11px] font-semibold text-slate-800 hover:underline"
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
      {/* MODAL 1: UNIFIED SCHEDULE MODAL (Tabs: Social Post & Shooting Session)   */}
      {/* ========================================================================= */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-900">Tambah Agenda</h2>
                  <p className="text-[10px] text-slate-500">
                    Dijadwalkan untuk tanggal: {selectedDayNumber} {MONTH_NAMES[month]} {year}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-slate-200 bg-slate-100/60 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveScheduleTab('post')}
                className={`flex-1 py-1.5 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeScheduleTab === 'post'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Postingan Media Sosial</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveScheduleTab('shooting')}
                className={`flex-1 py-1.5 rounded text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                  activeScheduleTab === 'shooting'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clapperboard className="w-3.5 h-3.5" />
                <span>Rencana Sesi Shooting</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4">
              {activeScheduleTab === 'post' ? (
                /* TAB 1: SOCIAL POST FORM */
                <form onSubmit={handlePostSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Konten / Caption Utama
                    </label>
                    <textarea
                      rows={3}
                      value={postCaption}
                      onChange={(e) => setPostCaption(e.target.value)}
                      placeholder="Tulis draf caption konten..."
                      className="w-full text-xs p-2 rounded-md border border-slate-200 focus:outline-none focus:border-slate-400 bg-slate-50 focus:bg-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Saluran Target
                      </label>
                      <select
                        value={postPlatform}
                        onChange={(e) => setPostPlatform(e.target.value)}
                        className="w-full text-xs p-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                      >
                        <option value="instagram">Instagram</option>
                        <option value="tiktok">TikTok</option>
                        <option value="linkedin">LinkedIn</option>
                        <option value="facebook">Facebook</option>
                        <option value="youtube">YouTube</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Waktu Tayang (Otomatis)
                      </label>
                      <input
                        type="datetime-local"
                        value={postDate}
                        onChange={(e) => setPostDate(e.target.value)}
                        className="w-full text-xs p-2 rounded-md border border-slate-200 bg-slate-50 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(false)}
                      className="ui-btn ui-btn-secondary py-1.5 text-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="ui-btn ui-btn-primary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Jadwalkan Postingan</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* TAB 2: SHOOTING SESSION FORM */
                <form onSubmit={handleShootingSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Judul Sesi Shooting <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shootTitle}
                      onChange={(e) => setShootTitle(e.target.value)}
                      placeholder="Contoh: Shooting Video Reels Edukasi Ep. 12"
                      className="w-full text-xs p-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>Lokasi Shooting</span>
                      </label>
                      <input
                        type="text"
                        value={shootLocation}
                        onChange={(e) => setShootLocation(e.target.value)}
                        placeholder="Studio Utama WIG / Outdoor"
                        className="w-full text-xs p-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Status Produksi
                      </label>
                      <select
                        value={shootStatus}
                        onChange={(e) => setShootStatus(e.target.value)}
                        className="w-full text-xs p-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                      >
                        <option value="planned">Rencana</option>
                        <option value="confirmed">Terkonfirmasi</option>
                        <option value="in_progress">Sedang Berlangsung</option>
                        <option value="completed">Selesai Shooting</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mulai Jam
                      </label>
                      <input
                        type="datetime-local"
                        value={shootScheduledAt}
                        onChange={(e) => setShootScheduledAt(e.target.value)}
                        className="w-full text-xs p-2 rounded-md border border-slate-200 bg-slate-50 font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Selesai Estimasi
                      </label>
                      <input
                        type="datetime-local"
                        value={shootEndAt}
                        onChange={(e) => setShootEndAt(e.target.value)}
                        className="w-full text-xs p-2 rounded-md border border-slate-200 bg-slate-50 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Brief & Catatan Produksi
                    </label>
                    <textarea
                      rows={2}
                      value={shootDescription}
                      onChange={(e) => setShootDescription(e.target.value)}
                      placeholder="Konsep visual, skrip singkat, atau catatan..."
                      className="w-full text-xs p-2 rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                    />
                  </div>

                  {/* Crew & Equipment */}
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-700" />
                      <span>Kru & Talent Terlibat</span>
                    </span>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newCrewName}
                        onChange={(e) => setNewCrewName(e.target.value)}
                        placeholder="Nama kru / talent..."
                        className="flex-1 text-xs p-1.5 rounded border border-slate-200 bg-white"
                      />
                      <input
                        type="text"
                        value={newCrewRole}
                        onChange={(e) => setNewCrewRole(e.target.value)}
                        placeholder="Peran"
                        className="w-28 text-xs p-1.5 rounded border border-slate-200 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newCrewName.trim()) return;
                          setCrewList((prev) => [...prev, { name: newCrewName, role: newCrewRole }]);
                          setNewCrewName('');
                        }}
                        className="px-2 py-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800"
                      >
                        + Tambah
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {crewList.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10.5px] text-slate-700 flex items-center gap-1"
                        >
                          <strong>{c.name}</strong> ({c.role})
                          <button
                            type="button"
                            onClick={() => setCrewList((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-slate-400 hover:text-rose-500 ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(false)}
                      className="ui-btn ui-btn-secondary py-1.5 text-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="ui-btn ui-btn-primary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5"
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center">
                  {selectedEvent.type === 'shooting' ? (
                    <Clapperboard className="w-3.5 h-3.5" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {selectedEvent.type === 'shooting'
                      ? 'Detail Sesi Shooting'
                      : 'Detail Postingan Terjadwal'}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {selectedEvent.id.slice(0, 16)}...
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 max-h-[65vh] overflow-y-auto text-xs">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{selectedEvent.title}</h4>
                {(selectedEvent.caption || selectedEvent.description) && (
                  <p className="text-[11px] text-slate-600 mt-1 whitespace-pre-wrap bg-slate-50 p-2.5 rounded border border-slate-200">
                    {selectedEvent.caption || selectedEvent.description}
                  </p>
                )}
              </div>

              {/* Time & Location */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-400 font-medium block text-[10px]">Waktu</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-500" />
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
                    <span className="text-slate-400 font-medium block text-[10px]">Lokasi</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{selectedEvent.location}</span>
                    </span>
                  </div>
                )}
              </div>

              {/* Equipment checklist (Shooting Only) */}
              {selectedEvent.type === 'shooting' &&
                selectedEvent.equipment_checklist &&
                selectedEvent.equipment_checklist.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5 text-slate-700" />
                      <span>Checklist Peralatan (Klik untuk centang)</span>
                    </span>
                    <div className="space-y-1 bg-slate-50 p-2.5 rounded border border-slate-200">
                      {selectedEvent.equipment_checklist.map((eq, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleToggleEquipment(idx)}
                          className="w-full flex items-center gap-2 p-1 rounded hover:bg-white text-left transition text-[11px] select-none"
                        >
                          {eq.checked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                    <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1 mb-1">
                      <Users className="w-3.5 h-3.5 text-slate-700" />
                      <span>Daftar Kru & Talent</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {selectedEvent.crew_members.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-100 rounded text-[10.5px] text-slate-700 font-medium border border-slate-200"
                        >
                          {c.name} <span className="text-slate-400">({c.role})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteEvent(selectedEvent)}
                className="px-2.5 py-1 rounded text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold flex items-center gap-1 transition"
              >
                <Trash2 className="w-3 h-3" />
                <span>Hapus</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="ui-btn ui-btn-primary py-1 px-3 text-xs"
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
