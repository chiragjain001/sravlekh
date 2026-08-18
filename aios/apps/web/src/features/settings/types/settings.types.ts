// ─── Settings Module: Domain & Form Types ─────────────────────────────────────

export interface InstituteProfile {
  name:         string;
  code:         string;
  address:      string;
  phone:        string;
  supportEmail: string;
  logoUrl?:     string;
}

export interface AcademicRules {
  activeYear:                string; // "2024 - 2025 (Current Active)"
  minAttendance:             number; // 75
  sendSMSOnAbsence:          boolean;
  negativeMarkingOnTests:    boolean;
  allowStudentSelfAttendance: boolean;
}

export interface NotificationRule {
  id:      string;
  title:   string;
  desc:    string;
  channel: string; // 'SMS & App' | 'Email & App' | 'WhatsApp & SMS' | 'App Push'
  enabled: boolean;
}

export interface SecuritySettings {
  adminEmail:            string;
  sessionTimeoutMinutes: number; // 30
}

export interface SystemSettings {
  profile:       InstituteProfile;
  academic:      AcademicRules;
  notifications: NotificationRule[];
  security:      SecuritySettings;
}

export type SettingsCategoryTab = 'profile' | 'academic' | 'notifications' | 'security';
