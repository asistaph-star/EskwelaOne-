import { apiClient } from './client';

export const studentApi = {
  // Fetch gate attendance records for the student
  getGateAttendance: async (studentId: string) => {
    return await apiClient.get(`/attendance/gate/${studentId}`);
  },

  // Fetch class attendance records for the student
  getClassAttendance: async (studentId: string) => {
    return await apiClient.get(`/attendance/class/${studentId}`);
  },

  // Fetch enrollment history to calculate grades
  getEnrollmentHistory: async (studentId: string, academicYearId: string) => {
    return await apiClient.get(`/enrollments/student/${studentId}/history/${academicYearId}`);
  },

  // Fetch guidance records
  getGuidanceRecords: async (studentId: string) => {
    return await apiClient.get(`/student-services/guidance/${studentId}`);
  },

  // Fetch clinic records
  getClinicRecords: async (studentId: string) => {
    return await apiClient.get(`/student-services/clinic/${studentId}`);
  },

  // Fetch appointments
  getAppointments: async (studentId: string) => {
    return await apiClient.get(`/student-services/appointments/${studentId}`);
  },

  // Create an appointment
  createAppointment: async (appointmentData: any) => {
    return await apiClient.post('/student-services/appointments', appointmentData);
  },

  // Fetch staff members (Principal, Nurse, etc.)
  getStaff: async () => {
    return await apiClient.get('/student-services/staff');
  },

  updateAppointmentStatus: async (id: string, status: string) => {
    return await apiClient.patch(`/student-services/appointments/${id}/status`, { status });
  },

  // Fetch excuse letters
  getExcuseLetters: async (studentId: string) => {
    return await apiClient.get(`/attendance/excuses/${studentId}`);
  },

  // Create an excuse letter
  createExcuseLetter: async (excuseData: {
    teacherId: string;
    startDate: string;
    endDate: string;
    reason: string;
    documentId?: string;
  }) => {
    return await apiClient.post('/attendance/excuses', excuseData);
  },

  // Upload a document
  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return await apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // Get presigned download URL
  getPresignedDownloadUrl: async (documentId: string) => {
    return await apiClient.post(`/documents/${documentId}/presign-download`);
  },

  // Fetch document requests
  getDocumentRequests: async (studentId: string) => {
    return await apiClient.get(`/student-services/documents/${studentId}`);
  },

  // Create a document request
  createDocumentRequest: async (requestData: any) => {
    return await apiClient.post('/student-services/documents', requestData);
  },

  // Process payment
  processPayment: async (paymentData: any) => {
    return await apiClient.post('/finance/payments', paymentData);
  }
};
