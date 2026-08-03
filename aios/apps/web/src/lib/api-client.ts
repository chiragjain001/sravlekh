import axios from 'axios';

const isDemoMode = typeof window !== 'undefined' && localStorage.getItem('aios_demo_mode') === 'true';

/**
 * Axios instance pre-configured for the AIOS API.
 */
export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

if (isDemoMode) {
  apiClient.interceptors.request.use((config) => {
    // Return mock data by rejecting with a special signature we catch in response
    return Promise.reject({ __isMock: true, config });
  });
}

// Request interceptor — inject Bearer token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aios_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: any) => {
    if (error.__isMock) {
      const url = error.config.url || '';
      // Provide mock data based on URL
      let mockData: any = { data: [] };
      if (url.includes('/analytics/overview')) {
        mockData = { totalStudents: 1250, totalTeachers: 45, activeExams: 3 };
      } else if (url.includes('/batches')) {
        mockData = [
          { id: 'b1', name: 'JEE Target 2026', studentCount: 120, avgMastery: 72 },
          { id: 'b2', name: 'NEET Droppers', studentCount: 85, avgMastery: 65 }
        ];
      } else if (url.includes('/students')) {
        mockData = { data: [{ id: 's1', user: { name: 'Aarav Sharma', email: 'aarav@demo.com', status: 'ACTIVE' }, batch: { name: 'JEE Target 2026' }, rollNumber: '2026-001' }] };
      } else if (url.includes('/teachers')) {
        mockData = { data: [{ id: 't1', user: { name: 'Dr. Verma', email: 'verma@demo.com', status: 'ACTIVE' }, subjects: [{ subject: { name: 'Physics' } }] }] };
      } else if (url.includes('/blueprints')) {
        mockData = [];
      } else if (url.includes('/timetable')) {
        mockData = [];
      } else if (url.includes('/institutes') && !url.includes('/students') && !url.includes('/teachers') && !url.includes('/batches') && !url.includes('/analytics') && !url.includes('/timetable') && !url.includes('/exams')) {
        // Assume /institutes list or details
        mockData = [{ id: 'demo-inst-1', name: 'Demo Institute', type: 'COACHING' }];
      } else if (url.includes('/subjects')) {
        mockData = [{ id: 'sub1', name: 'Physics', code: 'PHY101' }, { id: 'sub2', name: 'Chemistry', code: 'CHE101' }];
      } else if (url.includes('/questions')) {
        mockData = { data: [] };
      }
      return Promise.resolve({ data: mockData, status: 200 });
    }

    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      typeof window !== 'undefined'
    ) {
      // Clear stale session and redirect to login
      localStorage.removeItem('aios_access_token');
      localStorage.removeItem('aios_user');
      window.location.href = '/login?reason=session_expired';
    }
    return Promise.reject(error);
  },
);

/**
 * Axios instance for the Python AI Engine.
 * Note: Uses full localhost URL since it runs on a different port.
 */
export const aiClient = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
});

if (isDemoMode) {
  aiClient.interceptors.request.use((config) => {
    return Promise.reject({ __isMock: true, config });
  });
}

aiClient.interceptors.response.use(
  (response) => response,
  (error: any) => {
    if (error.__isMock) {
      const url = error.config.url || '';
      let mockData: any = { data: [] };
      
      if (url.includes('/heatmap')) {
        mockData = {
          success: true,
          data: [
            { topicId: 't1', topicName: 'Kinematics', averageMastery: 35.5, studentsStruggling: 45, totalStudents: 120, strugglePercentage: 37.5, status: 'CRITICAL' },
            { topicId: 't2', topicName: 'Optics', averageMastery: 62.0, studentsStruggling: 20, totalStudents: 120, strugglePercentage: 16.6, status: 'WARNING' },
            { topicId: 't3', topicName: 'Thermodynamics', averageMastery: 85.0, studentsStruggling: 5, totalStudents: 120, strugglePercentage: 4.1, status: 'HEALTHY' }
          ]
        };
      } else if (url.includes('/generate-blueprint')) {
        mockData = {
          success: true,
          data: {
            title: "AI Generated Mock Test",
            duration: 90,
            rules: [
              { topicName: "Kinematics", questionType: "MCQ", difficulty: "HARD", count: 10 },
              { topicName: "Optics", questionType: "NUMERICAL", difficulty: "MEDIUM", count: 5 }
            ]
          }
        };
      }
      return Promise.resolve({ data: mockData, status: 200 });
    }
    return Promise.reject(error);
  }
);

aiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aios_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
