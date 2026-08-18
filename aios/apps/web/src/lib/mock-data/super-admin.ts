// ─── Super Admin Mock Data Layer ─────────────────────────────────────────────
// Centralised, typed, realistic data. Plug in real API endpoints later.

export interface InstituteRow {
  id: string;
  name: string;
  owner: string;
  plan: 'Enterprise' | 'Premium' | 'Standard' | 'Trial';
  state: string;
  city: string;
  examType: string;
  students: string;
  teachers: string;
  revenue: string;
  profit: string;
  health: number;
  status: 'Active' | 'Trial' | 'Inactive' | 'Suspended';
  renewal: string;
  growth: 'High' | 'Medium' | 'Low';
  lastLogin: string;
  score: number;
  avatar: string;
  churnRisk: boolean;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  institute: string;
  location: string;
  status: 'Active' | 'Inactive' | 'Blocked';
  activity: 'Online' | 'Offline';
  verification: 'Verified' | 'Pending' | 'Failed';
  lastLogin: string;
  sessions: number;
  usage: 'High' | 'Medium' | 'Low';
  avatar: string;
}

export interface SubscriptionRow {
  id: string;
  institute: string;
  plan: 'Enterprise' | 'Premium' | 'Standard' | 'Trial';
  seats: string;
  storage: string;
  price: string;
  renewal: string;
  billing: 'Annual' | 'Monthly';
  status: 'Paid' | 'Overdue' | 'Pending' | 'Free';
  autoRenewal: 'ON' | 'OFF';
  coupons: string;
  invoice: string;
  outstanding: string;
}

export const institutes: InstituteRow[] = [
  { id: '1', name: 'Allen Career Institute', owner: 'Rajesh Maheshwari', plan: 'Enterprise', state: 'Rajasthan', city: 'Kota', examType: 'JEE/NEET', students: '1,25,000', teachers: '6,750', revenue: '₹48,75,000', profit: '+12%', health: 92, status: 'Active', renewal: '15 Jun 2025', growth: 'High', lastLogin: '1m ago', score: 98, avatar: 'AL', churnRisk: false },
  { id: '2', name: 'Resonance Delhi', owner: 'Vivek Neel', plan: 'Enterprise', state: 'Delhi', city: 'New Delhi', examType: 'JEE', students: '45,000', teachers: '2,120', revenue: '₹14,20,000', profit: '+15%', health: 89, status: 'Active', renewal: '20 Jun 2025', growth: 'Medium', lastLogin: '2h ago', score: 85, avatar: 'RD', churnRisk: false },
  { id: '3', name: 'FIITJEE Noida', owner: 'D.K. Goel', plan: 'Enterprise', state: 'UP', city: 'Noida', examType: 'JEE', students: '38,542', teachers: '1,864', revenue: '₹10,50,000', profit: '+8%', health: 87, status: 'Active', renewal: '10 Jul 2025', growth: 'High', lastLogin: '1h ago', score: 88, avatar: 'FN', churnRisk: false },
  { id: '4', name: 'Aakash Institute', owner: 'J.C. Chaudhry', plan: 'Premium', state: 'Bihar', city: 'Patna', examType: 'NEET', students: '78,451', teachers: '4,120', revenue: '₹21,75,000', profit: '+10%', health: 91, status: 'Active', renewal: '05 Aug 2025', growth: 'High', lastLogin: '30m ago', score: 94, avatar: 'AA', churnRisk: false },
  { id: '5', name: 'Sri Chaitanya', owner: 'S. Reddy', plan: 'Enterprise', state: 'Telangana', city: 'Hyderabad', examType: 'JEE/NEET', students: '1,05,420', teachers: '7,125', revenue: '₹41,20,000', profit: '+14%', health: 94, status: 'Active', renewal: '12 Sep 2025', growth: 'High', lastLogin: '5m ago', score: 96, avatar: 'SC', churnRisk: false },
  { id: '6', name: 'VMC Classes', owner: 'Vikas Oberoi', plan: 'Standard', state: 'Chandigarh', city: 'Chandigarh', examType: 'JEE', students: '22,185', teachers: '1,280', revenue: '₹5,40,000', profit: '+5%', health: 82, status: 'Active', renewal: '25 Oct 2025', growth: 'Low', lastLogin: '4h ago', score: 79, avatar: 'VM', churnRisk: false },
  { id: '7', name: 'Sigma Classes', owner: 'Ankit Sharma', plan: 'Standard', state: 'MP', city: 'Indore', examType: 'Foundation', students: '15,241', teachers: '1,142', revenue: '₹4,10,000', profit: '+6%', health: 68, status: 'Trial', renewal: '01 Nov 2025', growth: 'High', lastLogin: '1d ago', score: 65, avatar: 'SG', churnRisk: true },
  { id: '8', name: 'Bright Future Acad.', owner: 'Pooja Singh', plan: 'Standard', state: 'UP', city: 'Lucknow', examType: 'Foundation', students: '12,341', teachers: '954', revenue: '₹3,20,000', profit: '+4%', health: 74, status: 'Inactive', renewal: '15 Dec 2025', growth: 'Medium', lastLogin: '2d ago', score: 71, avatar: 'BF', churnRisk: true },
  { id: '9', name: 'Narayana IIT Academy', owner: 'P.K. Babu', plan: 'Premium', state: 'AP', city: 'Vijayawada', examType: 'JEE/NEET', students: '65,000', teachers: '3,200', revenue: '₹18,50,000', profit: '+11%', health: 88, status: 'Active', renewal: '20 Jan 2026', growth: 'High', lastLogin: '3h ago', score: 90, avatar: 'NA', churnRisk: false },
  { id: '10', name: 'Career Point', owner: 'Om Maheshwari', plan: 'Premium', state: 'Rajasthan', city: 'Kota', examType: 'JEE', students: '42,000', teachers: '2,500', revenue: '₹12,80,000', profit: '+9%', health: 85, status: 'Active', renewal: '10 Feb 2026', growth: 'Medium', lastLogin: '45m ago', score: 83, avatar: 'CP', churnRisk: false },
];

export const users: UserRow[] = [
  { id: '1', name: 'Rahul Verma', email: 'rahul.verma@allen.ac.in', role: 'Institute Owner', institute: 'Allen Career Inst.', location: 'Kota, Main', status: 'Active', activity: 'Online', verification: 'Verified', lastLogin: 'Today, 09:41 AM', sessions: 14, usage: 'High', avatar: 'RV' },
  { id: '2', name: 'Anjali Sharma', email: 'anjali@resonance.ac.in', role: 'Admin', institute: 'Resonance Delhi', location: 'New Delhi', status: 'Active', activity: 'Offline', verification: 'Verified', lastLogin: 'Today, 08:15 AM', sessions: 8, usage: 'High', avatar: 'AS' },
  { id: '3', name: 'Vivek Patel', email: 'vivek.patel@fiitjee.com', role: 'Teacher', institute: 'FIITJEE Noida', location: 'Noida, UP', status: 'Active', activity: 'Online', verification: 'Verified', lastLogin: 'Today, 10:20 AM', sessions: 2, usage: 'Medium', avatar: 'VP' },
  { id: '4', name: 'Riya Kumari', email: 'riya.k@aakash.ac.in', role: 'Student', institute: 'Aakash Institute', location: 'Patna Branch', status: 'Active', activity: 'Offline', verification: 'Verified', lastLogin: 'Today, 07:45 AM', sessions: 1, usage: 'Low', avatar: 'RK' },
  { id: '5', name: 'Pooja Singh', email: 'pooja.singh@chaitanya.in', role: 'Teacher', institute: 'Sri Chaitanya', location: 'Hyderabad', status: 'Active', activity: 'Offline', verification: 'Verified', lastLogin: 'Yesterday, 06:30 PM', sessions: 5, usage: 'Medium', avatar: 'PS' },
  { id: '6', name: 'Amit Kumar', email: 'amit.k@vmc.in', role: 'Student', institute: 'VMC Classes', location: 'Chandigarh', status: 'Inactive', activity: 'Offline', verification: 'Pending', lastLogin: '2 days ago', sessions: 0, usage: 'Low', avatar: 'AK' },
  { id: '7', name: 'Neha Gupta', email: 'neha.g@brightfuture.in', role: 'Parent', institute: 'Bright Future Acad.', location: 'Lucknow', status: 'Active', activity: 'Offline', verification: 'Verified', lastLogin: 'Yesterday, 09:20 PM', sessions: 2, usage: 'Low', avatar: 'NG' },
  { id: '8', name: 'Sanjay Trivedi', email: 'sanjay@narayana.ac.in', role: 'Institute Owner', institute: 'Narayana IIT', location: 'Vijayawada', status: 'Active', activity: 'Online', verification: 'Verified', lastLogin: 'Today, 11:00 AM', sessions: 24, usage: 'High', avatar: 'ST' },
  { id: '9', name: 'Priya Jain', email: 'priya.j@careerpoint.in', role: 'Admin', institute: 'Career Point', location: 'Kota', status: 'Active', activity: 'Online', verification: 'Verified', lastLogin: 'Today, 10:45 AM', sessions: 6, usage: 'Medium', avatar: 'PJ' },
  { id: '10', name: 'Dev Ratan Gupta', email: 'dev.ratan@sigma.in', role: 'Institute Owner', institute: 'Sigma Classes', location: 'Indore', status: 'Active', activity: 'Offline', verification: 'Pending', lastLogin: '3 days ago', sessions: 1, usage: 'Low', avatar: 'DG' },
];

export const subscriptions: SubscriptionRow[] = [
  { id: '1', institute: 'Allen Career Institute', plan: 'Enterprise', seats: '5000', storage: '2 TB', price: '₹48,75,000', renewal: '15 Jun 2025', billing: 'Annual', status: 'Paid', autoRenewal: 'ON', coupons: 'NONE', invoice: 'INV-2025-081', outstanding: '₹0' },
  { id: '2', institute: 'Resonance Delhi', plan: 'Enterprise', seats: '4000', storage: '1.5 TB', price: '₹36,20,000', renewal: '20 Jun 2025', billing: 'Annual', status: 'Paid', autoRenewal: 'ON', coupons: 'EARLY10', invoice: 'INV-2025-082', outstanding: '₹0' },
  { id: '3', institute: 'FIITJEE Noida', plan: 'Enterprise', seats: '3500', storage: '1.2 TB', price: '₹31,50,000', renewal: '10 Jul 2025', billing: 'Annual', status: 'Paid', autoRenewal: 'ON', coupons: 'NONE', invoice: 'INV-2025-091', outstanding: '₹0' },
  { id: '4', institute: 'Aakash Institute', plan: 'Premium', seats: '2500', storage: '1 TB', price: '₹21,75,000', renewal: '05 Aug 2025', billing: 'Annual', status: 'Paid', autoRenewal: 'ON', coupons: 'AAKASH15', invoice: 'INV-2025-104', outstanding: '₹0' },
  { id: '5', institute: 'Sri Chaitanya', plan: 'Enterprise', seats: '4500', storage: '1.8 TB', price: '₹41,20,000', renewal: '12 Sep 2025', billing: 'Annual', status: 'Paid', autoRenewal: 'ON', coupons: 'NONE', invoice: 'INV-2025-112', outstanding: '₹0' },
  { id: '6', institute: 'VMC Classes', plan: 'Standard', seats: '1000', storage: '500 GB', price: '₹5,40,000', renewal: '25 Oct 2025', billing: 'Annual', status: 'Overdue', autoRenewal: 'OFF', coupons: 'WELCOME10', invoice: 'INV-2025-120', outstanding: '₹20,500' },
  { id: '7', institute: 'Bright Future Acad.', plan: 'Standard', seats: '750', storage: '250 GB', price: '₹4,10,000', renewal: '15 Dec 2025', billing: 'Annual', status: 'Pending', autoRenewal: 'ON', coupons: 'NONE', invoice: 'INV-2025-135', outstanding: '₹4,10,000' },
  { id: '8', institute: 'Sigma Classes', plan: 'Trial', seats: '150', storage: '100 GB', price: '₹0', renewal: '01 Nov 2025', billing: 'Monthly', status: 'Free', autoRenewal: 'OFF', coupons: 'NONE', invoice: 'N/A', outstanding: '₹0' },
  { id: '9', institute: 'Narayana IIT Academy', plan: 'Premium', seats: '2000', storage: '800 GB', price: '₹18,50,000', renewal: '20 Jan 2026', billing: 'Annual', status: 'Paid', autoRenewal: 'ON', coupons: 'EARLY15', invoice: 'INV-2025-148', outstanding: '₹0' },
  { id: '10', institute: 'Career Point', plan: 'Premium', seats: '1800', storage: '700 GB', price: '₹12,80,000', renewal: '10 Feb 2026', billing: 'Annual', status: 'Paid', autoRenewal: 'ON', coupons: 'NONE', invoice: 'INV-2025-156', outstanding: '₹0' },
];

// Chart data
export const institutesGrowthData = [
  { month: 'Jan', institutes: 2240, active: 1920, trial: 320 },
  { month: 'Feb', institutes: 2350, active: 2010, trial: 340 },
  { month: 'Mar', institutes: 2480, active: 2100, trial: 380 },
  { month: 'Apr', institutes: 2650, active: 2240, trial: 410 },
  { month: 'May', institutes: 2842, active: 2287, trial: 555 },
];

export const revenueData = [
  { month: 'Jan', mrr: 1.2, arr: 14.4 },
  { month: 'Feb', mrr: 1.35, arr: 16.2 },
  { month: 'Mar', mrr: 1.42, arr: 17.04 },
  { month: 'Apr', mrr: 1.60, arr: 19.2 },
  { month: 'May', mrr: 1.85, arr: 22.2 },
  { month: 'Jun', mrr: 2.13, arr: 25.56 },
];

export const dauData = [
  { day: 'Mon', dau: 22.1 },
  { day: 'Tue', dau: 24.5 },
  { day: 'Wed', dau: 21.8 },
  { day: 'Thu', dau: 26.4 },
  { day: 'Fri', dau: 28.7 },
  { day: 'Sat', dau: 25.2 },
  { day: 'Sun', dau: 29.4 },
];

export const planDistribution = [
  { name: 'Enterprise', value: 243, pct: 9, fill: '#8b5cf6' },
  { name: 'Premium', value: 482, pct: 17, fill: '#0ea5e9' },
  { name: 'Standard', value: 1804, pct: 63, fill: '#10b981' },
  { name: 'Trial', value: 313, pct: 11, fill: '#f59e0b' },
];

export const churnData = [
  { month: 'Jan', rate: 4.2 },
  { month: 'Feb', rate: 3.8 },
  { month: 'Mar', rate: 3.5 },
  { month: 'Apr', rate: 3.1 },
  { month: 'May', rate: 2.8 },
];

export const apiPerfData = [
  { time: '10 AM', responseTime: 240, errors: 0.12 },
  { time: '12 PM', responseTime: 280, errors: 0.15 },
  { time: '2 PM', responseTime: 310, errors: 0.28 },
  { time: '4 PM', responseTime: 260, errors: 0.18 },
  { time: '6 PM', responseTime: 220, errors: 0.10 },
  { time: '8 PM', responseTime: 200, errors: 0.08 },
];

export const revenueByPlan = [
  { name: 'Enterprise', value: 65, fill: '#8b5cf6' },
  { name: 'Premium', value: 20, fill: '#0ea5e9' },
  { name: 'Standard', value: 10, fill: '#10b981' },
  { name: 'Trial', value: 5, fill: '#f59e0b' },
];

export const supportTrends = [
  { month: 'Jan', open: 80, inProgress: 48, resolved: 210 },
  { month: 'Feb', open: 65, inProgress: 52, resolved: 230 },
  { month: 'Mar', open: 55, inProgress: 60, resolved: 260 },
  { month: 'Apr', open: 45, inProgress: 55, resolved: 290 },
  { month: 'May', open: 32, inProgress: 54, resolved: 310 },
];
