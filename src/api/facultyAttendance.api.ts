import { apiClient } from './client';

export function getManilaTodayDateString(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find(p => p.type === 'year')?.value ?? '2026';
  const month = parts.find(p => p.type === 'month')?.value ?? '01';
  const day = parts.find(p => p.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

export interface FacultyAttendanceSummary {
  date: string;
  totalActiveFaculty: number;
  checkedInCount: number;
  completedCount: number;
  timeOutPendingCount: number;
  onLeaveCount: number;
  officialBusinessCount: number;
  pendingCheckInCount: number;
  policyConfigured: boolean;
}

export interface FacultyAttendanceItem {
  id: string | null;
  teacherId: string;
  userId: string;
  name: string;
  employeeId: string;
  department: string;
  position: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  timeInFormatted: string | null;
  timeOutFormatted: string | null;
  status: 'Completed' | 'Time Out Pending' | 'On Leave' | 'Official Business' | 'Not Checked In';
  captureSource: string | null;
  remarks: string | null;
}

export interface FacultyPunchStatus {
  date: string;
  teacherId: string;
  name: string;
  employeeId: string;
  department: string | null;
  status: 'Completed' | 'Time Out Pending' | 'On Leave' | 'Official Business' | 'Not Checked In';
  hasTimedIn: boolean;
  hasTimedOut: boolean;
  timeIn: string | null;
  timeOut: string | null;
  timeInFormatted: string | null;
  timeOutFormatted: string | null;
  leaveType: string | null;
  remarks: string | null;
}

export const facultyAttendanceApi = {
  getTeacherPunchStatus: async (date?: string): Promise<FacultyPunchStatus> => {
    const res: any = await apiClient.get(`/attendance/faculty/me${date ? `?date=${date}` : ''}`);
    return res?.data ?? res;
  },

  recordTimeIn: async (remarks?: string): Promise<any> => {
    const res: any = await apiClient.post('/attendance/faculty/time-in', { remarks });
    return res?.data ?? res;
  },

  recordTimeOut: async (remarks?: string): Promise<any> => {
    const res: any = await apiClient.post('/attendance/faculty/time-out', { remarks });
    return res?.data ?? res;
  },

  getSummary: async (date?: string): Promise<FacultyAttendanceSummary> => {
    const res: any = await apiClient.get(`/attendance/faculty/summary${date ? `?date=${date}` : ''}`);
    return res?.data ?? res;
  },

  getList: async (params: {
    date?: string;
    status?: string;
    department?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ data: FacultyAttendanceItem[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> => {
    const searchParams = new URLSearchParams();
    if (params.date) searchParams.set('date', params.date);
    if (params.status && params.status !== 'All') searchParams.set('status', params.status);
    if (params.department && params.department !== 'All') searchParams.set('department', params.department);
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    const res: any = await apiClient.get(`/attendance/faculty${qs ? `?${qs}` : ''}`);
    const items = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
    const pagination = res?.pagination || { total: items.length, page: 1, limit: items.length || 10, totalPages: 1 };
    return { data: items, pagination };
  },

  adminCorrect: async (id: string, body: {
    time_in?: string | null;
    time_out?: string | null;
    override_status?: string | null;
    override_remarks?: string | null;
  }): Promise<any> => {
    const res: any = await apiClient.patch(`/attendance/faculty/${id}`, body);
    return res?.data ?? res;
  },
};
