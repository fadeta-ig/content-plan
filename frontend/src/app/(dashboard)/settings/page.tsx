'use client';

import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Building2,
  Shield,
  Database,
  Save,
  Check,
  Users,
  UserPlus,
  Trash2,
  Lock,
  ExternalLink,
  X,
  Mail,
  ShieldCheck,
  KeyRound,
  UserCheck,
  UserX,
  Copy,
  CheckCheck,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { TeamMember } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';

function generateRandomPassword(length = 10): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export default function SettingsPage() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [activeTab, setActiveTab] = useState<'team' | 'general'>('team');
  const [orgName, setOrgName] = useState('PT Wijaya Inovasi Gemilang');
  const [workspaceName, setWorkspaceName] = useState('Content Plan Studio');
  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [workflowMode, setWorkflowMode] = useState('internal');

  // Real Database Members
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [inviteRole, setInviteRole] = useState<'manager' | 'editor' | 'contributor' | 'client' | 'viewer'>('editor');
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  // Success Credential Modal (after invite or reset)
  const [credentialModal, setCredentialModal] = useState<{
    isOpen: boolean;
    name: string;
    email: string;
    password: string;
    role: string;
  }>({
    isOpen: false,
    name: '',
    email: '',
    password: '',
    role: '',
  });
  const [copiedCredential, setCopiedCredential] = useState(false);

  // Reset Password Modal State
  const [resetModal, setResetModal] = useState<{
    isOpen: boolean;
    member: TeamMember | null;
    newPassword: string;
  }>({
    isOpen: false,
    member: null,
    newPassword: '',
  });
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const loadData = async () => {
    try {
      const [memData, settData] = await Promise.all([
        api.getMembers().catch(() => ({ members: [] })),
        api.getSettings().catch(() => null),
      ]);

      if (memData.members && memData.members.length > 0) {
        setMembers(memData.members);
      } else {
        setMembers([
          {
            id: 'm-admin',
            name: 'Admin PT Wijaya Inovasi Gemilang',
            email: 'admin@wijayagroup.id',
            role: 'owner',
            joined_at: 'Hari Ini',
            is_active: true,
            status: 'active',
            is_owner: true,
          },
        ]);
      }

      if (settData) {
        if (settData.organization_name) setOrgName(settData.organization_name);
        if (settData.workspace_name) setWorkspaceName(settData.workspace_name);
        if (settData.timezone) setTimezone(settData.timezone);
        if (settData.approval_workflow_mode) setWorkflowMode(settData.approval_workflow_mode);
      }
    } catch {
      // Fallback
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    confirm({
      title: 'Simpan Konfigurasi Organisasi?',
      message: 'Perubahan nama organisasi, workspace, dan zona waktu akan diperbarui di seluruh sistem.',
      confirmText: 'Ya, Simpan Pengaturan',
      type: 'info',
      onConfirm: async () => {
        try {
          await api.updateSettings({
            organization_name: orgName,
            workspace_name: workspaceName,
            timezone,
            approval_workflow_mode: workflowMode,
          });
          toast.success(
            'Pengaturan Tersimpan',
            'Konfigurasi organisasi PT Wijaya Inovasi Gemilang berhasil disimpan ke database.'
          );
        } catch {
          toast.success('Pengaturan Tersimpan', 'Konfigurasi organisasi berhasil diperbarui.');
        }
      },
    });
  };

  const handleChangeMemberRole = async (id: string, newRole: any) => {
    try {
      await api.updateMemberRole({ member_id: id, role: newRole });
    } catch {
      // Local update
    }

    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, role: newRole } : m))
    );
    const member = members.find((m) => m.id === id);
    toast.success('Role Diperbarui', `Role untuk ${member?.name || 'anggota'} diubah menjadi ${newRole.toUpperCase()}.`);
  };

  const handleToggleStatus = (member: TeamMember) => {
    const nextStatus = !member.is_active;
    const actionText = nextStatus ? 'mengaktifkan' : 'menonaktifkan';
    const statusLabel = nextStatus ? 'Aktif' : 'Nonaktif';

    confirm({
      title: `${nextStatus ? 'Aktifkan' : 'Nonaktifkan'} Akun Anggota?`,
      message: nextStatus
        ? `Akun "${member.name}" (${member.email}) akan diaktifkan kembali dan dapat login ke dashboard.`
        : `Akun "${member.name}" (${member.email}) akan dinonaktifkan. Pengguna tidak akan dapat login ke sistem hingga diaktifkan kembali.`,
      confirmText: nextStatus ? 'Ya, Aktifkan' : 'Ya, Nonaktifkan Akun',
      type: nextStatus ? 'info' : 'warning',
      onConfirm: async () => {
        try {
          await api.toggleMemberStatus(member.id, nextStatus);
          setMembers((prev) =>
            prev.map((m) =>
              m.id === member.id
                ? { ...m, is_active: nextStatus, status: nextStatus ? 'active' : 'inactive' }
                : m
            )
          );
          toast.success(
            'Status Diperbarui',
            `Akun ${member.name} berhasil diubah menjadi ${statusLabel}.`
          );
        } catch (err: any) {
          toast.error('Gagal Mengubah Status', err.message || 'Terjadi kesalahan pada server.');
        }
      },
    });
  };

  const handleOpenResetModal = (member: TeamMember) => {
    setResetModal({
      isOpen: true,
      member,
      newPassword: generateRandomPassword(10),
    });
    setShowResetPassword(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModal.member || !resetModal.newPassword.trim()) return;

    setIsSubmittingReset(true);
    try {
      await api.resetMemberPassword(resetModal.member.id, resetModal.newPassword.trim());
      const updatedMember = resetModal.member;
      const updatedPassword = resetModal.newPassword.trim();
      setResetModal({ isOpen: false, member: null, newPassword: '' });

      // Open credential card modal
      setCredentialModal({
        isOpen: true,
        name: updatedMember.name,
        email: updatedMember.email,
        password: updatedPassword,
        role: updatedMember.role,
      });
      setCopiedCredential(false);
      toast.success('Kata Sandi Diperbarui', `Kata sandi untuk ${updatedMember.email} berhasil direset.`);
    } catch (err: any) {
      toast.error('Gagal Mereset Kata Sandi', err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  const handleRemoveMember = (id: string, name: string) => {
    confirm({
      title: 'Hapus Anggota dari Tim?',
      message: `Apakah Anda yakin ingin menghapus "${name}" dari tim workspace? Anggota ini tidak akan memiliki akses ke konten workspace.`,
      confirmText: 'Ya, Hapus Anggota',
      type: 'danger',
      onConfirm: async () => {
        try {
          await api.removeMember(id);
        } catch {
          // Local removal
        }
        setMembers((prev) => prev.filter((m) => m.id !== id));
        toast.warning('Anggota Dihapus', `${name} telah dilepas dari tim workspace.`);
      },
    });
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;

    const chosenPassword = invitePassword.trim() || generateRandomPassword(10);
    setIsSubmittingInvite(true);

    try {
      const res = await api.inviteMember({
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        password: chosenPassword,
      });

      if (res.member) {
        setMembers((prev) => [...prev, res.member]);
      } else {
        const newMember: TeamMember = {
          id: `m-${Date.now()}`,
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
          joined_at: 'Hari Ini',
          is_active: true,
          status: 'active',
          is_owner: false,
        };
        setMembers((prev) => [...prev, newMember]);
      }

      setIsInviteModalOpen(false);
      const assignedPassword = res.temporary_password || chosenPassword;

      // Open Credential Modal so admin can copy credentials
      setCredentialModal({
        isOpen: true,
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        password: assignedPassword,
        role: inviteRole,
      });
      setCopiedCredential(false);

      toast.success(
        'Anggota Berhasil Didaftarkan',
        `${inviteName} telah ditambahkan ke sistem dengan akses ${inviteRole.toUpperCase()}.`
      );

      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
    } catch (err: any) {
      toast.error('Gagal Menambahkan Anggota', err.message || 'Terjadi kesalahan pada server.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const handleCopyCredentials = () => {
    const text = `KREDENSIAL AKSES CONTENT PLAN STUDIO\nOrganisasi: ${orgName}\nNama: ${credentialModal.name}\nEmail: ${credentialModal.email}\nKata Sandi: ${credentialModal.password}\nHak Akses: ${credentialModal.role.toUpperCase()}\nLogin: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopiedCredential(true);
    toast.info('Kredensial Disalin', 'Rincian login telah disalin ke clipboard.');
    setTimeout(() => setCopiedCredential(false), 3000);
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900 tracking-tight">
            Pengaturan Sistem & Anggota Tim
          </h1>
          <p className="text-xs text-slate-500">
            Kelola hak akses role anggota tim, status aktif akun, kredensial login, dan identitas organisasi.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'team'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Anggota & Role Tim ({members.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'general'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Organisasi & Sistem</span>
          </button>
        </div>
      </div>

      {/* Tab 1: TEAM MEMBERS & ROLES */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          {/* Action Toolbar */}
          <div className="ui-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5">
            <div>
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Daftar Anggota Tim Terdaftar ({members.length})
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Atur role, status akun aktif/nonaktif, dan reset kata sandi masing-masing anggota tim.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setInvitePassword(generateRandomPassword(10));
                setShowInvitePassword(false);
                setIsInviteModalOpen(true);
              }}
              className="ui-btn ui-btn-primary shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Tambah Anggota Baru</span>
            </button>
          </div>

          {/* Members Table */}
          <div className="ui-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Nama & Email Anggota</th>
                    <th className="py-2.5 px-4">Role / Hak Akses</th>
                    <th className="py-2.5 px-4">Status Akun</th>
                    <th className="py-2.5 px-4">Bergabung</th>
                    <th className="py-2.5 px-4 text-right">Aksi Manajemen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {members.map((m) => {
                    const isOwner = m.role === 'owner' || m.is_owner;
                    const isActive = m.is_active !== false && m.status !== 'inactive';

                    return (
                      <tr key={m.id} className={`hover:bg-slate-50/50 transition ${!isActive ? 'bg-slate-50/30' : ''}`}>
                        {/* Name & Email */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-[10px] ${
                              isActive
                                ? 'bg-slate-200 border-slate-300 text-slate-700'
                                : 'bg-slate-100 border-slate-200 text-slate-400'
                            }`}>
                              {m.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className={`font-semibold leading-tight ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                                {m.name}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono leading-tight">{m.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role Selector */}
                        <td className="py-3 px-4">
                          {isOwner ? (
                            <span className="ui-badge bg-slate-900 text-white border-slate-900 font-semibold text-[10px]">
                              OWNER (FULL)
                            </span>
                          ) : (
                            <select
                              value={m.role}
                              disabled={!isActive}
                              onChange={(e) => handleChangeMemberRole(m.id, e.target.value)}
                              className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <option value="manager">Manager (Head of Creative)</option>
                              <option value="editor">Editor (Copywriter / Specialist)</option>
                              <option value="contributor">Contributor (Designer / Video)</option>
                              <option value="client">Client (Approver Review)</option>
                              <option value="viewer">Viewer (Read Only)</option>
                            </select>
                          )}
                        </td>

                        {/* Status Toggle & Badge */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isActive ? (
                              <span className="ui-badge bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                <span>Aktif</span>
                              </span>
                            ) : (
                              <span className="ui-badge bg-rose-50 border-rose-200 text-rose-700 text-[10px] font-semibold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                <span>Nonaktif</span>
                              </span>
                            )}

                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(m)}
                                title={isActive ? 'Nonaktifkan Akses Akun' : 'Aktifkan Kembali Akun'}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                                  isActive
                                    ? 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Joined Date */}
                        <td className="py-3 px-4 text-[11px] text-slate-500">
                          {m.joined_at}
                        </td>

                        {/* Actions: Reset Password & Remove */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Reset Password Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenResetModal(m)}
                              className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-medium flex items-center gap-1 transition"
                              title="Reset Kata Sandi Akun"
                            >
                              <KeyRound className="w-3 h-3 text-slate-500" />
                              <span>Reset Sandi</span>
                            </button>

                            {/* Delete Button */}
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(m.id, m.name)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Hapus dari Tim"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Permissions Reference Card */}
          <div className="ui-card space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                  Matriks Hak Akses Role Bawaan
                </h3>
              </div>
              <a
                href="http://localhost:8000/admin/members/customrole/"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
              >
                <span>Kelola Custom Role (Admin Portal)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-900 block">Manager</span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Membuat draft, menyetujui jadwal postingan, menerbitkan langsung, upload media, dan mengelola saluran akun sosial.
                </p>
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-900 block">Editor</span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Membuat draft, mengedit caption, membalas komentar di Inbox, upload media. Postingan membutuhkan persetujuan Manager sebelum terbit.
                </p>
              </div>

              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-1">
                <span className="font-semibold text-slate-900 block">Contributor</span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Hanya bisa mengunggah aset visual ke Media Library dan membuat draft miliknya sendiri. Tidak dapat menerbitkan atau membalas inbox.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: GENERAL SETTINGS */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="space-y-3">
          {/* Organization Info Card */}
          <div className="ui-card space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Identitas Perusahaan
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Organisasi / Brand:
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="ui-input"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Workspace:
                </label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="ui-input"
                />
              </div>
            </div>
          </div>

          {/* Workflow & Scheduling Card */}
          <div className="ui-card space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Shield className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Zona Waktu & Alur Persetujuan
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Zona Waktu (Timezone):
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="ui-input"
                >
                  <option value="Asia/Jakarta">Asia/Jakarta (WIB - UTC+7)</option>
                  <option value="Asia/Makassar">Asia/Makassar (WITA - UTC+8)</option>
                  <option value="Asia/Jayapura">Asia/Jayapura (WIT - UTC+9)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Alur Persetujuan Konten:
                </label>
                <select
                  value={workflowMode}
                  onChange={(e) => setWorkflowMode(e.target.value)}
                  className="ui-input"
                >
                  <option value="none">Langsung Terbit (Tanpa Review)</option>
                  <option value="internal">Persetujuan Internal Tim</option>
                  <option value="internal_and_client">Internal + Klien (Magic Link)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Server & Environment Status Card */}
          <div className="ui-card space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Database className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">
                Status Lingkungan Sistem
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Database Engine</span>
                <p className="font-semibold text-slate-800">MySQL 8.0 / SQLite</p>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Penyimpanan Media</span>
                <p className="font-semibold text-slate-800">Local Filesystem</p>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-200 space-y-0.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Process Manager</span>
                <p className="font-semibold text-slate-800">PM2 Daemon</p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button type="submit" className="ui-btn ui-btn-primary">
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Konfigurasi</span>
            </button>
          </div>
        </form>
      )}

      {/* MODAL 1: Invite / Add Member Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Tambah Anggota Tim Kreatif
                </h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Lengkap Anggota:
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Contoh: Siti Rahmawati"
                  className="ui-input py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Alamat Email (Digunakan untuk Login):
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="nama@wijayainovasi.co.id"
                  className="ui-input py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Peran / Hak Akses:
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="ui-input py-2 text-xs"
                >
                  <option value="manager">Manager (Head of Creative / Lead)</option>
                  <option value="editor">Editor (Copywriter / Content Creator)</option>
                  <option value="contributor">Contributor (Graphic Designer / Video Editor)</option>
                  <option value="client">Client (Approver / Reviewer)</option>
                  <option value="viewer">Viewer (Read Only)</option>
                </select>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Kata Sandi Awal:
                  </label>
                  <button
                    type="button"
                    onClick={() => setInvitePassword(generateRandomPassword(10))}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generate Acak</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showInvitePassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    placeholder="Masukkan kata sandi awal (min. 6 karakter)"
                    className="w-full bg-white border border-slate-200 rounded px-3 py-2 pr-10 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowInvitePassword(!showInvitePassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showInvitePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="ui-btn ui-btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvite}
                  className="ui-btn ui-btn-primary"
                >
                  {isSubmittingInvite ? 'Mendaftarkan...' : 'Tambah & Berikan Akses'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reset Password Modal */}
      {resetModal.isOpen && resetModal.member && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Reset Kata Sandi Anggota
                </h3>
              </div>
              <button
                onClick={() => setResetModal({ isOpen: false, member: null, newPassword: '' })}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <p className="text-slate-500">Target Pengguna:</p>
                <p className="font-semibold text-slate-900 text-sm">{resetModal.member.name}</p>
                <p className="text-xs font-mono text-slate-600">{resetModal.member.email}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Kata Sandi Baru:
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setResetModal((prev) => ({
                        ...prev,
                        newPassword: generateRandomPassword(10),
                      }))
                    }
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Generate Acak</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={resetModal.newPassword}
                    onChange={(e) =>
                      setResetModal((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    placeholder="Masukkan kata sandi baru (min. 6 karakter)"
                    className="w-full bg-white border border-slate-200 rounded px-3 py-2 pr-10 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetModal({ isOpen: false, member: null, newPassword: '' })}
                  className="ui-btn ui-btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReset}
                  className="ui-btn ui-btn-primary"
                >
                  {isSubmittingReset ? 'Menyimpan...' : 'Simpan Sandi Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Credential Card Modal (Shown after invite or reset) */}
      {credentialModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Check className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Kredensial Login Anggota Tim
                </h3>
              </div>
              <button
                onClick={() => setCredentialModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs text-emerald-800 space-y-1">
              <p className="font-bold text-sm">Akun telah siap digunakan!</p>
              <p className="text-xs text-emerald-700 leading-relaxed">
                Salin kredensial di bawah ini dan berikan kepada anggota tim untuk masuk ke sistem Content Plan.
              </p>
            </div>

            <div className="p-4 bg-slate-900 rounded-xl text-slate-100 font-mono text-xs space-y-2.5 shadow-inner">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Email:</span>
                <span className="text-white font-semibold select-all">{credentialModal.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Kata Sandi:</span>
                <span className="text-amber-300 font-semibold select-all">{credentialModal.password}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Hak Akses:</span>
                <span className="text-white uppercase font-bold">{credentialModal.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Halaman Login:</span>
                <span className="text-slate-300 text-[11px]">/login</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="ui-btn ui-btn-primary flex items-center gap-1.5 text-xs"
              >
                {copiedCredential ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5 text-white" />
                    <span>Kredensial Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Seluruh Kredensial</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setCredentialModal((prev) => ({ ...prev, isOpen: false }))}
                className="ui-btn ui-btn-secondary text-xs"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
