'use client';

import { useEffect, useState } from 'react';
// TopHeader is rendered by the parent founder/page.tsx — do not re-render here
import { useFounderSettings, useUpdateFounderSettings } from '@/hooks/useApi';
import {
  Settings, Shield, Key, Bell, Database, Cpu, Lock,
  Globe, Mail, Smartphone, Layers, Server, RefreshCw, CheckCircle2,
  Save, AlertTriangle, ArrowRight, Clock, FileText, Check, ToggleLeft, ToggleRight,
  Sparkles, Code, Terminal, Eye, Trash2, Plus, Download, HardDrive, Wifi, Sliders, X
} from 'lucide-react';

const SETTINGS_TABS = [
  'General', 'Branding', 'Authentication', 'Security', 'Institutes',
  'Users', 'Notifications', 'Communication', 'AI Configuration',
  'Assessment Engine', 'Question Bank', 'Analytics Engine', 'Subscription Plans',
  'Billing', 'Storage', 'Backups', 'Integrations', 'API Keys', 'Feature Flags',
  'Environment', 'Email Templates', 'WhatsApp Templates', 'Audit Settings',
  'System Maintenance', 'Developer Settings',
];

const CONFIG_CHANGES_MOCK = [
  { item: 'AI Model Updated', changedBy: 'Super Admin', module: 'AI Configuration', oldVal: 'gpt-3.5-turbo', newVal: 'gpt-4o', date: '23 May, 09:30 AM' },
  { item: 'Max Upload Size Changed', changedBy: 'Super Admin', module: 'General', oldVal: '100 MB', newVal: '250 MB', date: '22 May, 04:15 PM' },
  { item: 'Session Timeout Updated', changedBy: 'Super Admin', module: 'Security', oldVal: '20 Minutes', newVal: '30 Minutes', date: '22 May, 02:10 PM' },
  { item: 'WhatsApp API Key Updated', changedBy: 'Super Admin', module: 'Integrations', oldVal: '••••••••', newVal: '••••••••', date: '22 May, 10:45 AM' },
];

// Defaults shown before the real persisted values load, and for any toggle
// key that's never been saved yet. Once useFounderSettings() resolves, real
// persisted values (if any) override these per-key.
const DEFAULT_TOGGLES: Record<string, boolean> = {
  maintMode: false,
  whiteLabel: true,
  darkModeDefault: false,
  mfaEnforced: true,
  ssoGoogle: true,
  ssoSaml: true,
  ipWhitelisting: false,
  autoApproveInst: true,
  pushNotifs: true,
  aiTokenTracking: true,
  proctoringWatermark: true,
  bloomTaxonomy: true,
  autoBackup: true,
  ipAnonymize: false,
  graphqlSandbox: true,
  flagAiBuilder: true,
  flagWhatsAppAlerts: true,
  flagAutoTimetable: true,
  flagProctoring: true,
  flagMultiBranch: true,
};

export function FounderSettings() {
  const [activeTab, setActiveTab] = useState('General');
  const [saved, setSaved]         = useState(false);
  const [modalAction, setModalAction] = useState<string | null>(null);

  // Real persistence: GET/PATCH /founder/settings (see docs on the audit's
  // "Save Changes lies about persisting" Critical finding). Only the boolean
  // toggle switches on this screen persist for real — the many uncontrolled
  // text/number/select fields below describe subsystems (billing, SAML SSO,
  // LLM provider selection, etc.) that have no real backend anywhere in this
  // codebase yet, and are left as illustrative until that's genuinely built.
  const { data: persisted, isPending: settingsLoading } = useFounderSettings();
  const updateSettings = useUpdateFounderSettings();

  const [toggles, setToggles] = useState<Record<string, boolean>>(DEFAULT_TOGGLES);

  useEffect(() => {
    if (persisted) setToggles((prev) => ({ ...DEFAULT_TOGGLES, ...prev, ...persisted }));
  }, [persisted]);

  const toggle = (key: string) => setToggles(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    await updateSettings.mutateAsync(toggles);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Helper toggle component
  const Switch = ({ id, label, desc }: { id: string; label: string; desc?: string }) => (
    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white transition-colors">
      <div>
        <p className="text-[12px] font-bold text-slate-800">{label}</p>
        {desc && <p className="text-[10.5px] text-slate-500">{desc}</p>}
      </div>
      <button onClick={() => toggle(id)} className="text-indigo-600 focus:outline-none">
        {toggles[id] ? <ToggleRight className="w-7 h-7 text-indigo-600" /> : <ToggleLeft className="w-7 h-7 text-slate-400" />}
      </button>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <div className="px-5 pt-4 flex items-center justify-between gap-4">
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-3xl">
          The toggle switches on this screen persist for real. The text, number, and dropdown fields below are illustrative previews of settings this platform doesn&apos;t enforce anywhere yet (billing, SSO/SAML, LLM provider selection, and similar) — saving does not change their behavior.
        </p>
        <button onClick={handleSave} disabled={updateSettings.isPending || settingsLoading}
          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-[12px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-colors disabled:opacity-60">
          {updateSettings.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
          {updateSettings.isPending ? 'Saving…' : saved ? 'Changes Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="p-5 space-y-6 animate-fadein max-w-[1700px] mx-auto">
        {/* ── TOP METADATA BAR ── */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 flex flex-wrap items-center justify-between gap-4">
          {[
            { label: 'Platform Version', val: 'v2.4.12', status: 'Latest', color: 'emerald' },
            { label: 'Environment', val: 'Production', status: 'Live', color: 'emerald' },
            { label: 'License Status', val: 'Enterprise', status: 'Valid till 30 Nov 2026', color: 'indigo' },
            { label: 'Storage Usage', val: '12.4 TB / 20 TB', status: '62%', color: 'sky' },
            { label: 'Backup Status', val: 'Healthy', status: 'Last: 23 May 02:00 AM', color: 'teal' },
            { label: 'Security Score', val: '92 / 100', status: 'Excellent', color: 'emerald' },
            { label: 'AI Configuration', val: 'OpenAI (gpt-4o)', status: 'Primary', color: 'violet' },
            { label: 'Feature Flags', val: '18 Active', status: 'Active', color: 'blue' },
          ].map(m => (
            <div key={m.label} className="text-left border-r border-slate-100 last:border-0 pr-4">
              <p className="text-[10px] text-slate-400 font-medium">{m.label}</p>
              <p className="text-[13px] font-bold text-slate-800 leading-tight">{m.val}</p>
              <span className="text-[9.5px] font-semibold text-emerald-600">{m.status}</span>
            </div>
          ))}
        </div>

        {/* ── MAIN WORKSPACE: LEFT NAV TABS + TAB CONTENT ── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

          {/* Left Vertical Nav Tabs (1 Col) */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-2 flex flex-col gap-0.5 max-h-[720px] overflow-y-auto">
            {SETTINGS_TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[11.5px] font-semibold transition-all flex items-center justify-between ${activeTab === tab ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-50'}`}>
                <span>{tab}</span>
                {activeTab === tab && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            ))}
          </div>

          {/* Right Main Content Panel (4 Cols) */}
          <div className="xl:col-span-4 space-y-5">

            {/* Dynamic Card Container for Tab Content */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800">{activeTab} Settings</h3>
                  <p className="text-[11.5px] text-slate-500">Configure parameters for {activeTab.toLowerCase()}</p>
                </div>
                <span className="text-[10.5px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">Live Active Config</span>
              </div>

              {/* ── TAB CONTENT SWITCHER ── */}
              {activeTab === 'General' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Platform Name</label>
                    <input defaultValue="AIOS - Academic Intelligence Operating System" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tagline</label>
                    <input defaultValue="Intelligent. Personalized. Scalable." className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default Timezone</label>
                    <select defaultValue="Asia/Kolkata (GMT+05:30)" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium bg-white">
                      <option>Asia/Kolkata (GMT+05:30)</option><option>UTC (GMT+00:00)</option><option>America/New_York (EST)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Date Format</label>
                    <select defaultValue="DD/MM/YYYY" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium bg-white">
                      <option>DD/MM/YYYY</option><option>YYYY-MM-DD</option><option>MM/DD/YYYY</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Support Email</label>
                    <input defaultValue="support@aios.co.in" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Max Upload Limit</label>
                    <select defaultValue="250 MB" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium bg-white">
                      <option>100 MB</option><option>250 MB</option><option>500 MB</option><option>1 GB</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Switch id="maintMode" label="Maintenance Mode" desc="When enabled, non-admin users will see a maintenance page" />
                  </div>
                </div>
              )}

              {activeTab === 'Branding' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Primary Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" defaultValue="#4f46e5" className="w-10 h-9 rounded cursor-pointer border border-slate-200" />
                      <input defaultValue="#4f46e5" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Custom Domain</label>
                    <input defaultValue="app.aios.co.in" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Favicon URL</label>
                    <input defaultValue="https://aios.co.in/favicon.ico" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Header Logo URL</label>
                    <input defaultValue="https://aios.co.in/logo-dark.svg" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" />
                  </div>
                  <Switch id="whiteLabel" label="Enable White-Labeling" desc="Allow institutes to display custom branding & logos" />
                  <Switch id="darkModeDefault" label="Dark Mode Default" desc="Set dark theme as default interface appearance" />
                </div>
              )}

              {activeTab === 'Authentication' && (
                <div className="space-y-4 text-[12px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Session Timeout (Minutes)</label>
                      <input defaultValue="30" type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Max Failed Login Attempts</label>
                      <input defaultValue="5" type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Switch id="mfaEnforced" label="Enforce Multi-Factor Authentication" desc="Require OTP for all Admins & Owners" />
                    <Switch id="ssoGoogle" label="Google OAuth SSO" desc="Allow login via Google Workspace" />
                    <Switch id="ssoSaml" label="SAML 2.0 Enterprise SSO" desc="Enable Okta / Azure AD authentication" />
                  </div>
                </div>
              )}

              {activeTab === 'Security' && (
                <div className="space-y-4 text-[12px]">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Allowed IP Whitelist (Comma separated)</label>
                    <textarea rows={2} defaultValue="103.21.45.78, 49.36.120.4, 182.72.90.12" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-[11px]" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rate Limit Threshold (Requests / min)</label>
                      <input defaultValue="1000" type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Encryption Algorithm</label>
                      <input defaultValue="AES-256-GCM (Hardware Accelerated)" disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium bg-slate-100 text-slate-600" />
                    </div>
                  </div>
                  <Switch id="ipWhitelisting" label="Enforce Strict IP Whitelisting" desc="Restrict Super Admin login to white-listed IP addresses only" />
                </div>
              )}

              {activeTab === 'Institutes' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default Student Capacity per Institute</label>
                    <input defaultValue="50000" type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Default Sub Plan for New Signups</label>
                    <select defaultValue="Standard" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium">
                      <option>Enterprise</option><option>Premium</option><option>Standard</option><option>Trial</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Switch id="autoApproveInst" label="Auto-Approve Institute Registration" desc="Automatically activate newly registered institutes after email validation" />
                  </div>
                </div>
              )}

              {activeTab === 'AI Configuration' && (
                <div className="space-y-4 text-[12px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Primary LLM Provider</label>
                      <select defaultValue="OpenAI (gpt-4o)" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium">
                        <option>OpenAI (gpt-4o)</option><option>Anthropic (Claude 3.5 Sonnet)</option><option>Google (Gemini 1.5 Pro)</option><option>Local vLLM Cluster</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Fallback Model</label>
                      <select defaultValue="gpt-3.5-turbo" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium">
                        <option>gpt-3.5-turbo</option><option>claude-3-haiku</option><option>gemini-1.5-flash</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Temperature Setting (Creativity vs Determinism)</label>
                      <input defaultValue="0.2" type="number" step="0.1" min="0" max="1" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Monthly Cost Limit (INR ₹)</label>
                      <input defaultValue="50000" type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" />
                    </div>
                  </div>
                  <Switch id="aiTokenTracking" label="Track Token Usage Per Institute" desc="Record token consumption in DB for billing breakdown" />
                </div>
              )}

              {activeTab === 'Assessment Engine' && (
                <div className="space-y-4 text-[12px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Default Negative Marking Penalty</label>
                      <select defaultValue="-0.25" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium">
                        <option>-0.25 (Standard JEE/NEET)</option><option>-0.33</option><option>-0.50</option><option>0 (No Negative)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Proctoring Strictness Level</label>
                      <select defaultValue="High" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium">
                        <option>High (AI Eye-Tracking + Tab Lock)</option><option>Medium (Tab Switch Detection)</option><option>Low (Basic Warning)</option>
                      </select>
                    </div>
                  </div>
                  <Switch id="proctoringWatermark" label="Dynamic Anti-Cheating Watermark" desc="Overlay student Roll No and IP transparently during exam" />
                </div>
              )}

              {activeTab === 'API Keys' && (
                <div className="space-y-4 text-[12px]">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-slate-800">Active Platform API Keys</p>
                    <button onClick={() => setModalAction('Generate API Key')} className="flex items-center gap-1 text-[11px] font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg cursor-pointer">
                      <Plus className="w-3.5 h-3.5" /> Generate New Key
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-[11.5px]">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr><th className="p-2.5">Key Name</th><th className="p-2.5">Token Mask</th><th className="p-2.5">Scope</th><th className="p-2.5 text-right">Actions</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        <tr><td className="p-2.5 font-bold font-sans">Production Webhook Key</td><td className="p-2.5 text-indigo-600">sk_live_9012...84a</td><td className="p-2.5 text-slate-500 font-sans">Full Access</td><td className="p-2.5 text-right font-sans"><button disabled title="API key management not yet wired" className="text-slate-300 font-bold cursor-not-allowed">Revoke</button></td></tr>
                        <tr><td className="p-2.5 font-bold font-sans">Analytics Sync Key</td><td className="p-2.5 text-indigo-600">sk_live_3412...92b</td><td className="p-2.5 text-slate-500 font-sans">Read Only</td><td className="p-2.5 text-right font-sans"><button disabled title="API key management not yet wired" className="text-slate-300 font-bold cursor-not-allowed">Revoke</button></td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'Feature Flags' && (
                <div className="space-y-3 text-[12px]">
                  <Switch id="flagAiBuilder" label="AI Paper Builder v2" desc="Enable automated AI paper creation wizard for teachers" />
                  <Switch id="flagWhatsAppAlerts" label="WhatsApp Parent Alerts" desc="Send automated attendance & score alerts via WhatsApp API" />
                  <Switch id="flagAutoTimetable" label="Batch Timetable Auto-Generator" desc="Constraint-satisfaction auto scheduling algorithm" />
                  <Switch id="flagProctoring" label="AI Eye-Tracking Proctoring" desc="Webcam gaze tracking during online exam sessions" />
                  <Switch id="flagMultiBranch" label="Multi-Branch Consolidated Reporting" desc="Enable multi-location cross-branch analytics for owners" />
                </div>
              )}

              {/* Default Fallback Form View for remaining tabs */}
              {!['General', 'Branding', 'Authentication', 'Security', 'Institutes', 'AI Configuration', 'Assessment Engine', 'API Keys', 'Feature Flags'].includes(activeTab) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">{activeTab} Mode</label>
                    <select defaultValue="Enabled" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium">
                      <option>Enabled (Production)</option><option>Staging</option><option>Disabled</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Configuration Parameter Key</label>
                    <input defaultValue={`aios_config_${activeTab.toLowerCase().replace(/\s+/g, '_')}`} className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-[11px]" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Max Refresh Interval</label>
                    <input defaultValue="300 seconds" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Log Level</label>
                    <select defaultValue="VERBOSE" className="w-full px-3 py-2 border border-slate-200 rounded-lg font-medium">
                      <option>VERBOSE</option><option>INFO</option><option>WARN</option><option>ERROR</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Switch id={`tabToggle_${activeTab}`} label={`Enable Automated Sync for ${activeTab}`} desc={`Keep ${activeTab.toLowerCase()} parameters in sync across all active clusters`} />
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Row: Recent Configuration Changes & Quick Actions */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

              {/* Recent Configuration Changes Table (2 Cols) */}
              <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-sm p-4">
                <h4 className="text-sm font-bold text-slate-800 mb-3">Recent Configuration Changes</h4>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-[11.5px]">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                      <tr>
                        <th className="px-3 py-2">Change</th>
                        <th className="px-3 py-2">Changed By</th>
                        <th className="px-3 py-2">Module</th>
                        <th className="px-3 py-2">Old Value</th>
                        <th className="px-3 py-2">New Value</th>
                        <th className="px-3 py-2 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {CONFIG_CHANGES_MOCK.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 font-bold text-slate-800">{c.item}</td>
                          <td className="px-3 py-2 text-slate-600">{c.changedBy}</td>
                          <td className="px-3 py-2 text-indigo-600 font-semibold">{c.module}</td>
                          <td className="px-3 py-2 text-rose-600 font-mono text-[10.5px]">{c.oldVal}</td>
                          <td className="px-3 py-2 text-emerald-600 font-mono font-bold text-[10.5px]">{c.newVal}</td>
                          <td className="px-3 py-2 text-right text-slate-400 text-[10.5px]">{c.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Actions Side Card (1 Col) */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 flex flex-col justify-between">
                <h4 className="text-sm font-bold text-slate-800 mb-3">Quick System Actions</h4>
                <div className="space-y-2 text-[11.5px]">
                  {[
                    'View Audits', 'Rollback Changes', 'Export Logs', 'Flush Redis Cache', 'Run Security Audit',
                  ].map(action => (
                    <button key={action} onClick={() => setModalAction(action)}
                      className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-semibold text-slate-700 flex items-center justify-between border border-slate-100 cursor-pointer">
                      <span>{action}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* ── CENTERED OVERLAY MODAL CARD: SETTINGS SYSTEM ACTION ── */}
      {modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-lg font-bold text-slate-800">{modalAction}</h3>
              <button onClick={() => setModalAction(null)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-50 text-[12.5px]">
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                <p className="font-bold text-slate-800">Confirm Action: {modalAction}</p>
                <p className="text-slate-600">Executing this administrative operation will update system settings across all 15 active nodes.</p>
              </div>

              {modalAction === 'Generate API Key' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Key Alias / Description</label>
                  <input placeholder="e.g. Analytics Pipeline Token" className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800" />
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setModalAction(null)} className="px-4 py-2 text-[12px] font-bold border border-slate-200 text-slate-700 rounded-xl">Cancel</button>
              <button onClick={() => setModalAction(null)} className="px-5 py-2 text-[12px] font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Execute Action</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
