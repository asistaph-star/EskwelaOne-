import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../../../api/client';
import { AStatus } from '../../shared/types';

export interface AttendanceRecord {
  enrollment_id: string;
  date: string;
  status: AStatus;
  remarks?: string;
  enrollment: {
    id: string;
    student: {
      id: string;
      lrn: string;
      first_name: string;
      last_name: string;
    }
  }
}

export interface EnrolledStudent {
  id: string; // enrollment_id
  student_id: string;
  student: {
    id: string;
    lrn: string;
    first_name: string;
    last_name: string;
  }
}

export function useAttendance(classId: string) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [roster, setRoster] = useState<EnrolledStudent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!classId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [recordsRes, rosterRes]: any = await Promise.all([
        apiClient.get(`/attendance/classes/${classId}/records`),
        apiClient.get(`/attendance/classes/${classId}/roster`)
      ]);
      setRecords(recordsRes || []);
      setRoster(rosterRes || []);
    } catch (err: any) {
      console.error('Failed to load attendance records', err);
      setError(err.message || 'Failed to load attendance');
      setRecords([]);
      setRoster([]);
    } finally {
      setIsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const saveBulkAttendance = async (
    updates: { studentEnrollmentId: string; date: string; status: AStatus; remarks?: string }[],
    skipRefresh = false
  ) => {
    if (!classId || updates.length === 0) return true;
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(`/attendance/classes/${classId}/records/bulk`, { records: updates });
      if (!skipRefresh) {
        await fetchRecords();
      }
      return true;
    } catch (err: any) {
      console.error('Failed to save attendance', err);
      setError(err.message || 'Failed to save attendance');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    records,
    roster,
    isLoading,
    isSaving,
    error,
    saveBulkAttendance,
    refresh: fetchRecords
  };
}
