'use client';
// ─── AdminCommunication — Communication & Announcements Console ─────────────
// Full service layer integration with TanStack Query, drawer inspection, creation modal & overlap overlays.

import React, { useState, useCallback } from 'react';
import {
  Calendar, Bell, Plus, Search, ChevronDown, Send, Mail, MessageSquare,
  CheckCircle2, Megaphone, Users, PhoneCall, ChevronRight, Eye, Clock,
} from 'lucide-react';
import { AdminOverlapModal } from '../shared/AdminOverlapModal';

import {
  useAnnouncementsList,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from '@/features/communication/hooks/useCommunication';
import { AnnouncementsTable }           from '@/features/communication/components/AnnouncementsTable';
import { AnnouncementProfileDrawer }    from '@/features/communication/components/AnnouncementProfileDrawer';
import { CreateAnnouncementDialog }    from '@/features/communication/components/CreateAnnouncementDialog';
import { DeleteAnnouncementDialog }    from '@/features/communication/components/DeleteAnnouncementDialog';
import { CommunicationAnalyticsPanel } from '@/features/communication/components/CommunicationAnalyticsPanel';

import type {
  AnnouncementItem,
  GetAnnouncementsParams,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '@/features/communication/types/communication.types';

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const show = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

function Toast({ msg, type }: { msg: string; type: string }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white text-sm font-bold transition-all
      ${type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
      {type === 'success' ? '✓' : '✗'} {msg}
    </div>
  );
}

export function AdminCommunication() {
  const [search, setSearch]               = useState('');
  const [targetFilter, setTargetFilter]   = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter]   = useState('');

  // Modals & Drawers
  const [activeModal, setActiveModal]                 = useState<'broadcasts' | 'messages' | 'scheduled' | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementItem | null>(null);
  const [createOpen, setCreateOpen]                   = useState(false);
  const [editTarget, setEditTarget]                   = useState<AnnouncementItem | null>(null);
  const [deleteTarget, setDeleteTarget]               = useState<AnnouncementItem | null>(null);

  const { toast, show: showToast } = useToast();

  const params: GetAnnouncementsParams = {
    search,
    target:  targetFilter  || undefined,
    channel: channelFilter || undefined,
    status:  statusFilter  || undefined,
  };

  const { data: announcements = [], isLoading } = useAnnouncementsList(params);

  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();

  async function handleCreateAnnouncement(input: CreateAnnouncementInput | UpdateAnnouncementInput) {
    await createMutation.mutateAsync(input as CreateAnnouncementInput);
    showToast('Broadcast announcement dispatched successfully');
  }

  async function handleEditAnnouncement(input: CreateAnnouncementInput | UpdateAnnouncementInput) {
    await updateMutation.mutateAsync(input as UpdateAnnouncementInput);
    showToast('Announcement updated');
    setEditTarget(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    setSelectedAnnouncement(null);
    showToast('Announcement withdrawn');
  }

  return (
    <div className="p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Communication &amp; Announcements</h1>
          <p className="text-xs text-gray-500 mt-0.5">Broadcast updates, manage notification channels, and view delivery metrics</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Today, 23 May 2025</span>
          </div>
          <div className="relative p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
            <Bell className="w-4 h-4 text-gray-500" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
              4
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Controls Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-2.5 rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search announcements by title or target..."
                className="pl-8 pr-3 py-1.5 w-full text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="relative">
              <select
                value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Target Groups</option>
                <option value="Students">All Students</option>
                <option value="Parents">All Parents</option>
                <option value="JEE">JEE Batches</option>
                <option value="NEET">NEET Batches</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Channels</option>
                <option value="App Push">App Push</option>
                <option value="SMS">SMS Alert</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="Published">Published</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Draft">Draft</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditTarget(null); setCreateOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <Megaphone className="w-3.5 h-3.5" /> New Broadcast Announcement
            </button>
          </div>
        </div>

        {/* ── RECENT ANNOUNCEMENTS MASTER TABLE SET TO FULL WIDTH CARD ── */}
        <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Megaphone className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Recent &amp; Broadcast Announcements</h2>
                <p className="text-[11px] text-gray-500">Master record of institute notices dispatched across channels</p>
              </div>
            </div>
            <button
              onClick={() => setActiveModal('broadcasts')}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View Full History →
            </button>
          </div>

          <AnnouncementsTable
            announcements={announcements}
            loading={isLoading}
            onSelect={(ann) => setSelectedAnnouncement(ann)}
            onViewStats={(ann) => setSelectedAnnouncement(ann)}
          />
        </div>

        {/* ── SECONDARY COMMUNICATION WIDGETS BELOW FULL WIDTH MASTER TABLE ── */}
        <CommunicationAnalyticsPanel
          onOpenBroadcastModal={() => { setEditTarget(null); setCreateOpen(true); }}
          onOpenDirectMessages={() => setActiveModal('messages')}
          onOpenScheduled={() => setActiveModal('scheduled')}
        />
      </div>

      {/* Drawer */}
      <AnnouncementProfileDrawer
        announcement={selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
        onEdit={(ann) => { setEditTarget(ann); setCreateOpen(true); setSelectedAnnouncement(null); }}
      />

      {/* Create / Edit Dialog */}
      <CreateAnnouncementDialog
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        editTarget={editTarget}
        onSubmit={editTarget ? handleEditAnnouncement : handleCreateAnnouncement}
      />

      {/* Delete Dialog */}
      <DeleteAnnouncementDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        announcement={deleteTarget}
        loading={deleteMutation.isPending}
      />

      {/* ── OVERLAP MODALS ── */}

      {/* 1. All Broadcast Announcements Directory Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'broadcasts'}
        onClose={() => setActiveModal(null)}
        title="Institute Broadcast Announcements Directory"
        subtitle="Complete archive of all dispatched notices and push broadcasts"
        icon={Megaphone}
        badgeText={`${announcements.length} Dispatches`}
      >
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">Title</th>
                  <th className="p-3">Target Cohort</th>
                  <th className="p-3">Dispatch Time</th>
                  <th className="p-3">Delivery Rate</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {announcements.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/20">
                    <td className="p-3 font-bold text-slate-900">{item.title}</td>
                    <td className="p-3 text-slate-700">{item.targetAudience}</td>
                    <td className="p-3 text-slate-500">{item.publishDate}</td>
                    <td className="p-3 font-bold text-emerald-600">{item.readRate}% Read Rate</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => { setSelectedAnnouncement(item); setActiveModal(null); }}
                        className="px-3 py-1 bg-blue-600 text-white font-bold text-[11px] rounded-lg cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AdminOverlapModal>

      {/* 2. Direct Messages Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'messages'}
        onClose={() => setActiveModal(null)}
        title="Direct Parent &amp; Student Messages Queue"
        subtitle="Incoming inquiries and direct support messages"
        icon={MessageSquare}
        badgeText="14 Unread"
      >
        <div className="space-y-3">
          {[
            { sender: 'Rohan Verma (Parent)', msg: 'Inquiry regarding PTM timing slot and teacher availability', time: '10 min ago' },
            { sender: 'Ananya Sharma (Student)', msg: 'Request for Physics revision numericals PDF', time: '42 min ago' },
            { sender: 'Dr. Ramesh Kumar (Faculty)', msg: 'Submitted test paper blueprint for review', time: '1 hr ago' },
          ].map((m, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{m.sender}</h4>
                <p className="text-xs text-slate-600 mt-0.5">{m.msg}</p>
                <span className="text-[10px] text-slate-400">{m.time}</span>
              </div>
              <button
                onClick={() => { showToast('Reply sent'); setActiveModal(null); }}
                className="px-3 py-1 bg-blue-600 text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                Reply
              </button>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 3. Scheduled Broadcasts Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'scheduled'}
        onClose={() => setActiveModal(null)}
        title="Scheduled Automated Broadcasts"
        subtitle="Manage upcoming queue of automated push alerts and emails"
        icon={Clock}
        badgeText="4 Scheduled"
      >
        <div className="space-y-3">
          {[
            { title: 'Weekly Performance Digest', time: 'Tomorrow, 09:00 AM', target: 'All Parents' },
            { title: 'NEET Practice Test Reminder', time: '25 May, 06:00 PM', target: 'NEET Batches' },
          ].map((s, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{s.title}</h4>
                <p className="text-xs text-blue-600 font-bold mt-0.5">Scheduled for: {s.time}</p>
                <span className="text-[10px] text-slate-400">Target: {s.target}</span>
              </div>
              <button
                onClick={() => { showToast('Scheduled broadcast cancelled'); setActiveModal(null); }}
                className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-100 font-bold text-xs rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
