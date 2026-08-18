'use client';
// ─── Communication Analytics Panel Component ─────────────────────────────────

import React from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Send, Megaphone, Clock } from 'lucide-react';
import { useCommunicationAnalytics } from '../hooks/useCommunication';

interface CommunicationAnalyticsPanelProps {
  onOpenBroadcastModal: () => void;
  onOpenDirectMessages: () => void;
  onOpenScheduled:      () => void;
}

export function CommunicationAnalyticsPanel({
  onOpenBroadcastModal, onOpenDirectMessages, onOpenScheduled,
}: CommunicationAnalyticsPanelProps) {
  const { data: analytics, isLoading } = useCommunicationAnalytics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 animate-pulse">
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const channelBreakdown = analytics?.channelBreakdown ?? [];
  const directMessages   = analytics?.recentDirectMessages ?? [];
  const scheduledQueue   = analytics?.scheduledBroadcasts ?? [];

  return (
    <div className="space-y-6 pt-2">
      {/* Row 1: Communication Channel Breakdown & Delivery Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Channel Breakdown */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Communication Channel Breakdown</h3>
            <p className="text-[11px] text-gray-400 mb-4">Volume distribution across message channels</p>
            <div className="flex items-center gap-6 my-auto">
              <div className="w-36 h-36 relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelBreakdown}
                      innerRadius={42} outerRadius={62} paddingAngle={2} dataKey="value" stroke="none"
                    >
                      {channelBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-sm font-bold text-gray-900">100%</span>
                  <span className="text-[9px] text-gray-400">Total Volume</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {channelBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-slate-50/70 p-2 rounded border border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-700 font-semibold">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-900">{item.percent}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Metrics */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Broadcast Delivery Metrics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-[10px] font-bold text-blue-600 block uppercase">Total Dispatched</span>
                <span className="text-2xl font-bold text-gray-900">{(analytics?.totalDispatched ?? 14250).toLocaleString()}</span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-600 block uppercase">Successfully Delivered</span>
                <span className="text-2xl font-bold text-gray-900">{(analytics?.successfullyDelivered ?? 13980).toLocaleString()} ({analytics?.deliveryRate ?? 98}%)</span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                <span className="text-[10px] font-bold text-amber-600 block uppercase">Average Read Rate</span>
                <span className="text-2xl font-bold text-gray-900">{analytics?.avgReadRate ?? 84}%</span>
              </div>
              <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                <span className="text-[10px] font-bold text-purple-600 block uppercase">Parent Engagement</span>
                <span className="text-2xl font-bold text-gray-900">{analytics?.parentEngagementRate ?? 92}%</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Row 2: Recent Direct Messages, Quick Actions & Scheduled Broadcasts (3 Equal Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Direct Messages */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">Recent Direct Messages</h3>
              <button
                onClick={onOpenDirectMessages}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                View All →
              </button>
            </div>
            <div className="space-y-2">
              {directMessages.map((msg) => (
                <div key={msg.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 text-xs">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold text-gray-900">{msg.senderName} ({msg.senderRole})</span>
                    <span className="text-[10px] text-gray-400">{msg.timeAgo}</span>
                  </div>
                  <p className="text-[11px] text-gray-600 truncate">{msg.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Broadcast Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={onOpenBroadcastModal}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition-colors border border-blue-100 cursor-pointer"
              >
                <span>Send SMS to All Parents</span>
                <Send className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenBroadcastModal}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition-colors border border-emerald-100 cursor-pointer"
              >
                <span>Post App Push Notification</span>
                <Megaphone className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onOpenScheduled}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-purple-50 text-purple-700 font-bold text-xs hover:bg-purple-100 transition-colors border border-purple-100 cursor-pointer"
              >
                <span>Schedule Automated Broadcast</span>
                <Clock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scheduled Broadcasts */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">Scheduled Broadcasts</h3>
              <button
                onClick={onOpenScheduled}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                View All →
              </button>
            </div>
            <div className="space-y-2">
              {scheduledQueue.map((sc) => (
                <div key={sc.id} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 text-xs">
                  <p className="font-bold text-gray-900">{sc.title}</p>
                  <div className="flex justify-between items-center mt-1 text-[10px] text-gray-500">
                    <span>Target: {sc.targetAudience}</span>
                    <span className="font-semibold text-blue-600">{sc.scheduledTime}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
