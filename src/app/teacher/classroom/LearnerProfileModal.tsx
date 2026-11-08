import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../shared/constants/tokens';
import { 
  X, User, Shield, Heart, Activity, Calendar, MapPin, 
  Phone, Mail, CheckCircle, AlertTriangle, Scale, Ruler, Sparkles,
  History, RefreshCw, Edit3, Save, Check, GraduationCap, Info, FileText, Lock
} from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { 
  calculateCurrentAge, 
  calculateMeasurementAge,
  calculateSchoolFormAge,
  calculateBmiValue,
  classifyWhoBmi,
  classifyWhoHfa,
  PROVISIONAL_SF1_AGE_CUTOFF_SY2026_2027,
  BmiNutritionalStatus,
  HfaNutritionalStatus
} from '../../shared/utils/healthCalculators';
import { apiClient } from '../../../api/client';
import { toast } from 'sonner';
import { validateLearnerPersonalInfoForm } from '../../shared/utils/studentValidation';

interface LearnerProfileModalProps {
  student: any;
  sectionInfo: { grade: number; section: string };
  isAdviser: boolean;
  onClose: () => void;
  onStudentUpdated?: (updated: any) => void;
}

type ProfileTab = 'personal' | 'enrollment' | 'health' | 'history';

export function LearnerProfileModal({ 
  student: initialStudent, 
  sectionInfo, 
  isAdviser, 
  onClose,
  onStudentUpdated
}: LearnerProfileModalProps) {
  const [student, setStudent] = useState<any>(initialStudent);
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');

  // Health metric encoding form state
  const [measurementPeriod, setMeasurementPeriod] = useState<'BOSY' | 'EOSY' | 'INTERIM'>('BOSY');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [measurementDate, setMeasurementDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [remarks, setRemarks] = useState<string>('');

  // UI state for health metric save
  const [isSavingMetric, setIsSavingMetric] = useState(false);
  const [saveMetricSuccess, setSaveMetricSuccess] = useState(false);
  const [metricErrorMessage, setMetricErrorMessage] = useState<string | null>(null);

  // History state
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Multi-Year Enrollment History state
  const [academicYearsHistory, setAcademicYearsHistory] = useState<any[]>([]);
  const [isLoadingYearsHistory, setIsLoadingYearsHistory] = useState(false);

  // Personal Information edit form state
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    firstName: student.first || '',
    middleName: student.middleName || '',
    lastName: student.surname || '',
    suffix: student.suffix || '',
    dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
    gender: (student.gender === 'Female' ? 'Female' : 'Male') as 'Male' | 'Female',
    street: student.street || '',
    city: student.city || '',
    stateProvince: student.stateProvince || '',
    zipCode: student.zipCode || '',
    guardianFirstName: student.guardianFirstName || '',
    guardianLastName: student.guardianLastName || '',
    guardianPhone: student.guardianPhone || '',
    guardianEmail: student.guardianEmail || '',
    bloodType: student.bloodType || '',
    allergies: student.allergies || '',
    medicalConditions: student.medicalConditions || '',
    confirmGuardianContact: false,
    guardianConfirmationMethod: 'SCHOOL_ENROLLMENT_CONFIRMED',
    guardianConfirmationSource: 'DepEd SF1 Enrollment Document Verification',
  });
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalSaveSuccess, setPersonalSaveSuccess] = useState(false);
  const [personalErrorMessage, setPersonalErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Guardian contact authorization state
  const [guardianAuth, setGuardianAuth] = useState<{
    hasEmail: boolean;
    status: 'PENDING_VERIFICATION' | 'AUTHORIZED' | 'REPLACED' | 'REVOKED' | 'BLOCKED' | 'NOT_CONFIGURED';
    guardianEmail?: string;
    guardianName?: string;
    verificationMethod?: string | null;
    verifiedAt?: string | null;
    authorizedAt?: string | null;
    authorizedByUserId?: string | null;
    confirmationSource?: string | null;
  } | null>(null);
  const [showOtpPrompt, setShowOtpPrompt] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isAuthorizingManual, setIsAuthorizingManual] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMethod, setConfirmMethod] = useState<'SCHOOL_ENROLLMENT_CONFIRMED' | 'SCHOOL_CONTACT_UPDATE_CONFIRMED' | 'IN_PERSON_PSA_VERIFICATION'>('SCHOOL_ENROLLMENT_CONFIRMED');
  const [confirmSource, setConfirmSource] = useState('DepEd SF1 Enrollment Document Verification');

  const fetchGuardianAuth = useCallback(async () => {
    if (!student.id) return;
    try {
      const res: any = await apiClient.get(`/academic/health/students/${student.id}/guardian-contact/status`);
      const auth = res?.data || res;
      if (auth && (auth.hasEmail !== undefined || auth.status)) {
        setGuardianAuth(auth);
      }
    } catch {}
  }, [student.id]);

  useEffect(() => {
    fetchGuardianAuth();
  }, [fetchGuardianAuth, student.guardianEmail]);

  const handleVerifyOtp = async () => {
    if (!otpValue || otpValue.trim().length !== 6) {
      toast.error('Please enter a valid 6-digit verification code.');
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res: any = await apiClient.post(`/academic/health/students/${student.id}/guardian-contact/verify-otp`, {
        otp: otpValue.trim(),
      });
      const payload = res?.data || res;
      if (payload?.success || res?.success || payload?.status === 'AUTHORIZED') {
        toast.success(payload?.message || 'Guardian contact verified and authorized successfully!');
        setShowOtpPrompt(false);
        setOtpValue('');
        await fetchGuardianAuth();
      } else {
        toast.error(payload?.message || res?.message || 'Invalid or expired verification code.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to verify OTP code.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSchoolConfirm = async () => {
    setIsAuthorizingManual(true);
    try {
      const res: any = await apiClient.post(`/academic/health/students/${student.id}/guardian-contact/authorize`, {
        verificationMethod: confirmMethod,
        reason: confirmSource.trim() || 'DepEd SF1 Enrollment Document Verification',
      });
      const payload = res?.data || res;
      if (payload?.success || res?.success || payload?.status === 'AUTHORIZED') {
        toast.success('Guardian contact confirmed and authorized through school records!');
        setShowConfirmModal(false);
        await fetchGuardianAuth();
      } else {
        toast.error(payload?.message || res?.message || 'Authorization failed.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to authorize contact.');
    } finally {
      setIsAuthorizingManual(false);
    }
  };

  const handleSendOtp = async () => {
    setIsSendingOtp(true);
    try {
      const res: any = await apiClient.post(`/academic/health/students/${student.id}/guardian-contact/resend-verification`);
      const payload = res?.data || res;
      if (payload?.success || res?.success) {
        toast.success(payload?.message || 'Verification code sent to guardian email.');
        setShowOtpPrompt(true);
        await fetchGuardianAuth();
      } else {
        toast.error(payload?.message || res?.message || 'Failed to send verification code.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to send verification code.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Keep personalForm in sync if student prop updates
  useEffect(() => {
    setPersonalForm({
      firstName: student.first || '',
      middleName: student.middleName || '',
      lastName: student.surname || '',
      suffix: student.suffix || '',
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
      gender: student.gender === 'Female' ? 'Female' : 'Male',
      street: student.street || '',
      city: student.city || '',
      stateProvince: student.stateProvince || '',
      zipCode: student.zipCode || '',
      guardianFirstName: student.guardianFirstName || '',
      guardianLastName: student.guardianLastName || '',
      guardianPhone: student.guardianPhone || '',
      guardianEmail: student.guardianEmail || '',
      bloodType: student.bloodType || '',
      allergies: student.allergies || '',
      medicalConditions: student.medicalConditions || '',
      confirmGuardianContact: false,
      guardianConfirmationMethod: 'SCHOOL_ENROLLMENT_CONFIRMED',
      guardianConfirmationSource: 'DepEd SF1 Enrollment Document Verification',
    });
  }, [student]);

  // Fetch health metrics history from backend
  const fetchHistory = useCallback(async () => {
    if (!student.id) return;
    setIsLoadingHistory(true);
    try {
      const res: any = await apiClient.get(`/academic/health/students/${student.id}`);
      const history = Array.isArray(res) ? res : res?.data || [];
      setMetricsHistory(history);

      // Pre-fill form with latest measurement if available
      const latest = history.find((m: any) => m.is_latest);
      if (latest) {
        setHeightCm(Number(latest.height_cm));
        setWeightKg(Number(latest.weight_kg));
        setMeasurementPeriod(latest.measurement_period || 'BOSY');
        if (latest.measurement_date) {
          setMeasurementDate(new Date(latest.measurement_date).toISOString().split('T')[0]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load health history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [student.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const fetchEnrollmentHistory = useCallback(async () => {
    if (!student.id) return;
    setIsLoadingYearsHistory(true);
    try {
      const res: any = await apiClient.get(`/enrollments/student/${student.id}/years`);
      const list = res?.data || res;
      if (Array.isArray(list)) {
        setAcademicYearsHistory(list);
      }
    } catch (err: any) {
      console.warn('Failed to load enrollment history:', err);
    } finally {
      setIsLoadingYearsHistory(false);
    }
  }, [student.id]);

  useEffect(() => {
    if (activeTab === 'enrollment') {
      fetchEnrollmentHistory();
    }
  }, [activeTab, fetchEnrollmentHistory]);

  // Compute live verified age contexts
  const currentAge = calculateCurrentAge(student.dateOfBirth);
  const ageAtMeasurement = calculateMeasurementAge(student.dateOfBirth, measurementDate);
  const schoolFormAge = calculateSchoolFormAge(student.dateOfBirth); // Defaults to June 5, 2026 provisional cutoff

  // Effective age in years for WHO classification (strictly uses measurement date)
  const effectiveAgeYears = ageAtMeasurement ? ageAtMeasurement.years : (currentAge ? currentAge.years : 14);

  // Live WHO calculations (formula: weight / (height in meters)², 1 decimal place)
  const hNum = typeof heightCm === 'number' ? heightCm : parseFloat(heightCm as string);
  const wNum = typeof weightKg === 'number' ? weightKg : parseFloat(weightKg as string);
  const liveBmi = (!isNaN(hNum) && !isNaN(wNum) && hNum > 0 && wNum > 0)
    ? calculateBmiValue(hNum, wNum)
    : null;

  const bmiResult = classifyWhoBmi(
    isNaN(hNum) ? null : hNum,
    isNaN(wNum) ? null : wNum,
    effectiveAgeYears,
    student.gender
  );

  const hfaResult = classifyWhoHfa(
    isNaN(hNum) ? null : hNum,
    effectiveAgeYears,
    student.gender
  );

  const statusColorMap: Record<string, { color: string; bg: string }> = {
    'Normal': { color: '#059669', bg: '#ecfdf5' },
    'Wasted': { color: '#d97706', bg: '#fffbeb' },
    'Severely Wasted': { color: '#dc2626', bg: '#fef2f2' },
    'Overweight': { color: '#ea580c', bg: '#fff7ed' },
    'Obese': { color: '#b91c1c', bg: '#fef2f2' },
    'Tall': { color: '#0284c7', bg: '#f0f9ff' },
    'Stunted': { color: '#d97706', bg: '#fffbeb' },
    'Severely Stunted': { color: '#dc2626', bg: '#fef2f2' },
    'Pending Verification / Not Calculated': { color: '#64748b', bg: '#f1f5f9' },
  };

  const statusTheme = statusColorMap[bmiResult.status] || statusColorMap['Pending Verification / Not Calculated'];
  const hfaTheme = statusColorMap[hfaResult.status] || statusColorMap['Pending Verification / Not Calculated'];

  // Handle saving new or updated health measurement
  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(hNum) || isNaN(wNum) || hNum <= 0 || wNum <= 0) {
      setMetricErrorMessage('Please enter valid height (cm) and weight (kg) values.');
      return;
    }

    setIsSavingMetric(true);
    setMetricErrorMessage(null);

    try {
      await apiClient.post('/academic/health/metrics', {
        studentId: student.id,
        measurementPeriod,
        measurementDate,
        heightCm: hNum,
        weightKg: wNum,
        remarks: remarks || undefined,
      });

      setSaveMetricSuccess(true);
      await fetchHistory();
      setTimeout(() => setSaveMetricSuccess(false), 4000);
    } catch (err: any) {
      setMetricErrorMessage(err.response?.data?.message || err.message || 'Failed to save health measurement');
    } finally {
      setIsSavingMetric(false);
    }
  };

  // Handle updating learner personal details (Phase 1B Professional UX)
  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalErrorMessage(null);

    // Client-side authoritative field validation
    const validation = validateLearnerPersonalInfoForm({
      firstName: personalForm.firstName,
      lastName: personalForm.lastName,
      middleName: personalForm.middleName,
      suffix: personalForm.suffix,
      guardianFirstName: personalForm.guardianFirstName,
      guardianLastName: personalForm.guardianLastName,
      guardianPhone: personalForm.guardianPhone,
      guardianEmail: personalForm.guardianEmail,
      zipCode: personalForm.zipCode,
      bloodType: personalForm.bloodType,
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      // Clean UX: Do NOT show top red banner; do NOT trigger toast for ordinary inline field errors
      setPersonalErrorMessage(null);
      const fieldIdMap: Record<string, string> = {
        firstName: 'input-edit-first-name',
        lastName: 'input-edit-last-name',
        middleName: 'input-edit-middle-name',
        suffix: 'input-edit-suffix',
        guardianFirstName: 'input-edit-guardian-first',
        guardianLastName: 'input-edit-guardian-last',
        guardianPhone: 'input-edit-guardian-phone',
        guardianEmail: 'input-edit-guardian-email',
        zipCode: 'input-edit-zip',
        bloodType: 'input-edit-blood-type',
      };
      const firstField = Object.keys(validation.errors)[0];
      const targetId = fieldIdMap[firstField];
      if (targetId) {
        setTimeout(() => {
          const el = document.getElementById(targetId);
          if (el) {
            el.focus();
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      }
      return;
    }

    setFieldErrors({});
    setIsSavingPersonal(true);

    try {
      const res: any = await apiClient.patch(`/academic/health/students/${student.id}/personal-info`, {
        firstName: personalForm.firstName.trim(),
        middleName: personalForm.middleName.trim() || null,
        lastName: personalForm.lastName.trim(),
        suffix: personalForm.suffix.trim() || null,
        dateOfBirth: personalForm.dateOfBirth || undefined,
        gender: personalForm.gender,
        street: personalForm.street.trim() || null,
        city: personalForm.city.trim() || null,
        stateProvince: personalForm.stateProvince.trim() || null,
        zipCode: personalForm.zipCode.trim() || null,
        guardianFirstName: personalForm.guardianFirstName.trim() || null,
        guardianLastName: personalForm.guardianLastName.trim() || null,
        guardianPhone: personalForm.guardianPhone.trim() || null,
        guardianEmail: personalForm.guardianEmail.trim() || null,
        bloodType: personalForm.bloodType.trim() || null,
        allergies: personalForm.allergies.trim() || null,
        medicalConditions: personalForm.medicalConditions.trim() || null,
        confirmGuardianContact: personalForm.confirmGuardianContact,
        guardianConfirmationMethod: personalForm.guardianConfirmationMethod,
        guardianConfirmationSource: personalForm.guardianConfirmationSource,
      });

      const updated = res?.data || res;
      setStudent((prev: any) => ({
        ...prev,
        first: updated.first_name || personalForm.firstName,
        surname: updated.last_name || personalForm.lastName,
        middleName: updated.middle_name || personalForm.middleName,
        suffix: updated.suffix || personalForm.suffix,
        gender: updated.gender || personalForm.gender,
        street: updated.street || personalForm.street,
        city: updated.city || personalForm.city,
        stateProvince: updated.state_province || personalForm.stateProvince,
        zipCode: updated.zip_code || personalForm.zipCode,
        guardianFirstName: updated.guardian_first_name || personalForm.guardianFirstName,
        guardianLastName: updated.guardian_last_name || personalForm.guardianLastName,
        guardianPhone: updated.guardian_phone || personalForm.guardianPhone,
        guardianEmail: updated.guardian_email || personalForm.guardianEmail,
        bloodType: updated.blood_type || personalForm.bloodType,
        allergies: updated.allergies || personalForm.allergies,
        medicalConditions: updated.medical_conditions || personalForm.medicalConditions,
      }));

      if (onStudentUpdated) {
        onStudentUpdated(updated);
      }

      setPersonalSaveSuccess(true);
      toast.success('Learner profile updated successfully.');
      setIsEditingPersonal(false);
      await fetchGuardianAuth();
      setTimeout(() => setPersonalSaveSuccess(false), 3500);
    } catch (err: any) {
      const msg = err.message || err.response?.data?.message || err.response?.data?.error?.message;
      setPersonalErrorMessage(msg || 'Failed to update learner personal information');
      toast.error(msg || 'Failed to update learner personal information');
    } finally {
      setIsSavingPersonal(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      id="learner-profile-modal-overlay"
      style={{ 
        position: 'fixed', inset: 0, zIndex: 99999, 
        background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        style={{ 
          width: '100%', maxWidth: 880, maxHeight: '92vh', overflowY: 'auto',
          background: '#fff', borderRadius: 12, boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{ background: C.m900, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <User size={22} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: "'Fraunces', serif" }}>
                {student.surname}, {student.first} {student.middleName ? `${student.middleName} ` : ''}{student.suffix || ''}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', display: 'flex', gap: 10, marginTop: 2, alignItems: 'center' }}>
                <span>LRN: <strong style={{ color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace" }}>{student.lrn}</strong></span>
                <span>•</span>
                <span>Grade {sectionInfo.grade} - {sectionInfo.section}</span>
                <span>•</span>
                <span style={{ color: '#a7f3d0' }}>SY 2026–2027</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isAdviser ? (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 4, background: '#f59e0b', color: '#fff', textTransform: 'uppercase' }}>
                Class Adviser View
              </span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.2)', color: '#fff', textTransform: 'uppercase' }}>
                Read-Only View
              </span>
            )}
            <button 
              id="btn-close-learner-profile"
              onClick={onClose} 
              style={{ width: 28, height: 28, borderRadius: 4, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ background: '#f8fafc', borderBottom: `1px solid ${C.borderMed}`, display: 'flex', padding: '0 24px', gap: 8 }}>
          {[
            { id: 'personal', label: 'Personal Information', icon: User },
            { id: 'enrollment', label: 'Enrollment Information', icon: GraduationCap },
            { id: 'health', label: 'Health & Nutrition (SF8)', icon: Heart },
            { id: 'history', label: `Measurement History (${metricsHistory.length})`, icon: History },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                onClick={() => setActiveTab(t.id as ProfileTab)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: isActive ? `3px solid ${C.m700}` : '3px solid transparent',
                  color: isActive ? C.m700 : C.t2,
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  marginBottom: -1, transition: 'all 0.15s'
                }}
              >
                <Icon size={14} color={isActive ? C.m700 : C.t3} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Modal Content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Privacy & Operational Policy Banner */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={16} color="#0284c7" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.4 }}>
              <strong style={{ color: '#0f172a' }}>Calulut INHS Health Protocol:</strong> Class Advisers encode learner personal details, baseline BOSY/EOSY metrics, and SF8 summaries. No school nurse is required. Official DepEd 12-digit LRN is protected.
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB 1: PERSONAL INFORMATION */}
          {/* ──────────────────────────────────────────────────────────── */}
          {activeTab === 'personal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>Learner Identity & Demographic Record</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Official DepEd School Form 1 (SF1) learner profile data</div>
                </div>
                {isAdviser && !isEditingPersonal && (
                  <button
                    id="btn-edit-personal-info"
                    type="button"
                    onClick={() => setIsEditingPersonal(true)}
                    style={{
                      fontSize: 11, fontWeight: 700, color: C.m700, background: C.m100,
                      border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5
                    }}
                  >
                    <Edit3 size={13} /> Edit Personal Details
                  </button>
                )}
              </div>

              {personalSaveSuccess && (
                <div style={{ padding: '8px 12px', background: '#ecfdf5', color: '#059669', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={14} /> Personal information successfully saved and verified in PostgreSQL.
                </div>
              )}

              {personalErrorMessage && (
                <div 
                  id="personal-info-error-banner"
                  style={{ 
                    padding: '10px 14px', 
                    background: '#fef2f2', 
                    border: '1px solid #fecaca', 
                    color: '#dc2626', 
                    borderRadius: 6, 
                    fontSize: 12, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8,
                    marginBottom: 12
                  }}
                >
                  <AlertTriangle size={15} color="#dc2626" />
                  <span>{personalErrorMessage}</span>
                </div>
              )}


              {/* Edit Form (Phase 1B Professional UX) */}
              {isEditingPersonal ? (
                <form 
                  onSubmit={handleSavePersonal} 
                  style={{ 
                    background: '#ffffff', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: 12, 
                    boxShadow: '0 4px 12px -2px rgba(0,0,0,0.05)',
                    overflow: 'hidden',
                    marginBottom: 16
                  }}
                >
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Edit3 size={15} color="#2563eb" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Edit Learner Personal Profile</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Authoritative SF1 record update · Changes persist immediately to PostgreSQL</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* SECTION 1: Personal Information */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                        Personal Information
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>First Name *</label>
                          <input
                            id="input-edit-first-name"
                            type="text"
                            value={personalForm.firstName}
                            onChange={(e) => {
                              setPersonalForm({ ...personalForm, firstName: e.target.value });
                              if (fieldErrors.firstName) setFieldErrors(prev => ({ ...prev, firstName: '' }));
                            }}
                            placeholder="Given name"
                            style={{ 
                              width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, 
                              border: `1px solid ${fieldErrors.firstName ? '#f87171' : '#cbd5e1'}`, 
                              boxSizing: 'border-box', outline: 'none' 
                            }}
                            aria-invalid={Boolean(fieldErrors.firstName)}
                          />
                          {fieldErrors.firstName && (
                            <div id="error-edit-first-name" style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                              {fieldErrors.firstName}
                            </div>
                          )}
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>Middle Name</label>
                          <input
                            id="input-edit-middle-name"
                            type="text"
                            value={personalForm.middleName}
                            onChange={(e) => {
                              setPersonalForm({ ...personalForm, middleName: e.target.value });
                              if (fieldErrors.middleName) setFieldErrors(prev => ({ ...prev, middleName: '' }));
                            }}
                            placeholder="Optional"
                            style={{ 
                              width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, 
                              border: `1px solid ${fieldErrors.middleName ? '#f87171' : '#cbd5e1'}`, 
                              boxSizing: 'border-box', outline: 'none' 
                            }}
                            aria-invalid={Boolean(fieldErrors.middleName)}
                          />
                          {fieldErrors.middleName && (
                            <div id="error-edit-middle-name" style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                              {fieldErrors.middleName}
                            </div>
                          )}
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>Last Name *</label>
                          <input
                            id="input-edit-last-name"
                            type="text"
                            value={personalForm.lastName}
                            onChange={(e) => {
                              setPersonalForm({ ...personalForm, lastName: e.target.value });
                              if (fieldErrors.lastName) setFieldErrors(prev => ({ ...prev, lastName: '' }));
                            }}
                            placeholder="Surname"
                            style={{ 
                              width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, 
                              border: `1px solid ${fieldErrors.lastName ? '#f87171' : '#cbd5e1'}`, 
                              boxSizing: 'border-box', outline: 'none' 
                            }}
                            aria-invalid={Boolean(fieldErrors.lastName)}
                          />
                          {fieldErrors.lastName && (
                            <div id="error-edit-last-name" style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                              {fieldErrors.lastName}
                            </div>
                          )}
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>Suffix</label>
                          <input
                            id="input-edit-suffix"
                            type="text"
                            value={personalForm.suffix}
                            onChange={(e) => {
                              setPersonalForm({ ...personalForm, suffix: e.target.value });
                              if (fieldErrors.suffix) setFieldErrors(prev => ({ ...prev, suffix: '' }));
                            }}
                            placeholder="Jr., III, etc."
                            style={{ 
                              width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, 
                              border: `1px solid ${fieldErrors.suffix ? '#f87171' : '#cbd5e1'}`, 
                              boxSizing: 'border-box', outline: 'none' 
                            }}
                            aria-invalid={Boolean(fieldErrors.suffix)}
                          />
                          {fieldErrors.suffix && (
                            <div id="error-edit-suffix" style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                              {fieldErrors.suffix}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                            <Lock size={12} color="#64748b" /> Date of Birth
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8' }}>(Protected DepEd PSA Record)</span>
                          </label>
                          <input
                            id="input-edit-birth-date"
                            type="date"
                            value={personalForm.dateOfBirth}
                            disabled
                            title="Protected DepEd PSA Birth Certificate Record. Corrections require Registrar verification."
                            style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #e2e8f0', boxSizing: 'border-box', background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                          />
                          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>Official birth record · Changes require Registrar / Admin verification</div>
                        </div>
                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>
                            <Lock size={12} color="#64748b" /> Recorded Biological Sex
                            <span style={{ fontSize: 10, fontWeight: 500, color: '#94a3b8' }}>(Protected DepEd PSA Record)</span>
                          </label>
                          <select
                            id="select-edit-gender"
                            value={personalForm.gender}
                            disabled
                            title="Protected DepEd PSA Birth Certificate Record. Corrections require Registrar verification."
                            style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #e2e8f0', boxSizing: 'border-box', background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>Official demographic · Changes require Registrar / Admin verification</div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: Residential Address */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                        Residential Address
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>Street Address</label>
                          <input
                            id="input-edit-street"
                            type="text"
                            value={personalForm.street}
                            onChange={(e) => setPersonalForm({ ...personalForm, street: e.target.value })}
                            placeholder="House No., Street, Barangay"
                            style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>City / Municipality</label>
                          <input
                            id="input-edit-city"
                            type="text"
                            value={personalForm.city}
                            onChange={(e) => setPersonalForm({ ...personalForm, city: e.target.value })}
                            placeholder="City of San Fernando"
                            style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>Province</label>
                          <input
                            id="input-edit-province"
                            type="text"
                            value={personalForm.stateProvince}
                            onChange={(e) => setPersonalForm({ ...personalForm, stateProvince: e.target.value })}
                            placeholder="Pampanga"
                            style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>ZIP Code</label>
                          <input
                            id="input-edit-zip"
                            type="text"
                            value={personalForm.zipCode}
                            onChange={(e) => {
                              setPersonalForm({ ...personalForm, zipCode: e.target.value });
                              if (fieldErrors.zipCode) setFieldErrors(prev => ({ ...prev, zipCode: '' }));
                            }}
                            placeholder="e.g. 2000"
                            style={{ 
                              width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, 
                              border: `1px solid ${fieldErrors.zipCode ? '#f87171' : '#cbd5e1'}`, 
                              boxSizing: 'border-box', outline: 'none' 
                            }}
                            aria-invalid={Boolean(fieldErrors.zipCode)}
                          />
                          {fieldErrors.zipCode && (
                            <div id="error-edit-zip" style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                              {fieldErrors.zipCode}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: Parent or Guardian Contact */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                        Parent or Guardian Contact
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>Guardian First Name</label>
                          <input
                            id="input-edit-guardian-first"
                            type="text"
                            value={personalForm.guardianFirstName}
                            onChange={(e) => {
                              setPersonalForm({ ...personalForm, guardianFirstName: e.target.value });
                              if (fieldErrors.guardianFirstName) setFieldErrors(prev => ({ ...prev, guardianFirstName: '' }));
                            }}
                            placeholder="Parent/Guardian given name"
                            style={{ 
                              width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, 
                              border: `1px solid ${fieldErrors.guardianFirstName ? '#f87171' : '#cbd5e1'}`, 
                              boxSizing: 'border-box', outline: 'none' 
                            }}
                            aria-invalid={Boolean(fieldErrors.guardianFirstName)}
                          />
                          {fieldErrors.guardianFirstName && (
                            <div id="error-edit-guardian-first" style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                              {fieldErrors.guardianFirstName}
                            </div>
                          )}
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>Guardian Last Name</label>
                          <input
                            id="input-edit-guardian-last"
                            type="text"
                            value={personalForm.guardianLastName}
                            onChange={(e) => {
                              setPersonalForm({ ...personalForm, guardianLastName: e.target.value });
                              if (fieldErrors.guardianLastName) setFieldErrors(prev => ({ ...prev, guardianLastName: '' }));
                            }}
                            placeholder="Parent/Guardian surname"
                            style={{ 
                              width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, 
                              border: `1px solid ${fieldErrors.guardianLastName ? '#f87171' : '#cbd5e1'}`, 
                              boxSizing: 'border-box', outline: 'none' 
                            }}
                            aria-invalid={Boolean(fieldErrors.guardianLastName)}
                          />
                          {fieldErrors.guardianLastName && (
                            <div id="error-edit-guardian-last" style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                              {fieldErrors.guardianLastName}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 2 }}>
                            Guardian Mobile Number
                          </label>
                          <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 6 }}>
                            Philippine mobile number · 10 digits after +63
                          </div>
                          <input
                            id="input-edit-guardian-phone"
                            type="tel"
                            value={personalForm.guardianPhone}
                            onChange={(e) => {
                              setPersonalForm({ ...personalForm, guardianPhone: e.target.value });
                              if (fieldErrors.guardianPhone) setFieldErrors(prev => ({ ...prev, guardianPhone: '' }));
                            }}
                            placeholder="0917 123 4567"
                            style={{ 
                              width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, 
                              border: `1px solid ${fieldErrors.guardianPhone ? '#f87171' : '#cbd5e1'}`, 
                              boxSizing: 'border-box', outline: 'none' 
                            }}
                            aria-invalid={Boolean(fieldErrors.guardianPhone)}
                          />
                          {fieldErrors.guardianPhone && (
                            <div id="error-edit-guardian-phone" style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                              {fieldErrors.guardianPhone}
                            </div>
                          )}
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 2 }}>
                            Guardian Email
                          </label>
                          <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 6 }}>
                            Optional contact email for official communications
                          </div>
                          <input
                            id="input-edit-guardian-email"
                            type="email"
                            value={personalForm.guardianEmail}
                            onChange={(e) => {
                              setPersonalForm({ ...personalForm, guardianEmail: e.target.value });
                              if (fieldErrors.guardianEmail) setFieldErrors(prev => ({ ...prev, guardianEmail: '' }));
                            }}
                            placeholder="guardian@example.com"
                            style={{ 
                              width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, 
                              border: `1px solid ${fieldErrors.guardianEmail ? '#f87171' : '#cbd5e1'}`, 
                              boxSizing: 'border-box', outline: 'none' 
                            }}
                            aria-invalid={Boolean(fieldErrors.guardianEmail)}
                          />
                          {fieldErrors.guardianEmail && (
                            <div id="error-edit-guardian-email" style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                              {fieldErrors.guardianEmail}
                            </div>
                          )}
                          {personalForm.guardianEmail && personalForm.guardianEmail.trim().length > 0 && (
                            <div style={{ marginTop: 8, padding: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: '#166534', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  id="checkbox-confirm-guardian"
                                  checked={personalForm.confirmGuardianContact}
                                  onChange={(e) => setPersonalForm({ ...personalForm, confirmGuardianContact: e.target.checked })}
                                  style={{ accentColor: '#16a34a', width: 14, height: 14 }}
                                />
                                School-Confirmed Contact (Verified via SF1 or Signed Update Form)
                              </label>
                              {personalForm.confirmGuardianContact && (
                                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <select
                                    id="select-edit-confirm-method"
                                    value={personalForm.guardianConfirmationMethod}
                                    onChange={(e) => setPersonalForm({ ...personalForm, guardianConfirmationMethod: e.target.value })}
                                    style={{ width: '100%', padding: '5px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff' }}
                                  >
                                    <option value="SCHOOL_ENROLLMENT_CONFIRMED">DepEd SF1 Enrollment Record / PSA Verified</option>
                                    <option value="SCHOOL_CONTACT_UPDATE_CONFIRMED">Official Parent Contact Update Form</option>
                                    <option value="IN_PERSON_PSA_VERIFICATION">In-Person Parent Conference Verification</option>
                                  </select>
                                  <input
                                    type="text"
                                    id="input-edit-confirm-source"
                                    value={personalForm.guardianConfirmationSource}
                                    onChange={(e) => setPersonalForm({ ...personalForm, guardianConfirmationSource: e.target.value })}
                                    placeholder="Document Reference / Source Note"
                                    style={{ width: '100%', padding: '5px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff' }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: Health Notes */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                        Health Notes
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: 14 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>Blood Type</label>
                          <input
                            id="input-edit-blood-type"
                            type="text"
                            value={personalForm.bloodType}
                            onChange={(e) => {
                              setPersonalForm({ ...personalForm, bloodType: e.target.value });
                              if (fieldErrors.bloodType) setFieldErrors(prev => ({ ...prev, bloodType: '' }));
                            }}
                            placeholder="e.g. O+, A+, B+"
                            style={{ 
                              width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, 
                              border: `1px solid ${fieldErrors.bloodType ? '#f87171' : '#cbd5e1'}`, 
                              boxSizing: 'border-box', outline: 'none' 
                            }}
                            aria-invalid={Boolean(fieldErrors.bloodType)}
                          />
                          {fieldErrors.bloodType && (
                            <div id="error-edit-blood-type" style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                              {fieldErrors.bloodType}
                            </div>
                          )}
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>Known Allergies</label>
                          <input
                            id="input-edit-allergies"
                            type="text"
                            value={personalForm.allergies}
                            onChange={(e) => setPersonalForm({ ...personalForm, allergies: e.target.value })}
                            placeholder="None or list known allergies"
                            style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#334155', marginBottom: 5 }}>Medical Conditions</label>
                          <input
                            id="input-edit-medical-conditions"
                            type="text"
                            value={personalForm.medicalConditions}
                            onChange={(e) => setPersonalForm({ ...personalForm, medicalConditions: e.target.value })}
                            placeholder="Asthma, Diabetes, etc."
                            style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 6, border: '1px solid #cbd5e1', boxSizing: 'border-box', outline: 'none' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* STICKY FOOTER ACTION BAR */}
                  <div style={{ 
                    position: 'sticky', 
                    bottom: 0, 
                    background: '#f8fafc', 
                    borderTop: '1px solid #e2e8f0', 
                    padding: '14px 22px', 
                    display: 'flex', 
                    justifyContent: 'flex-end', 
                    alignItems: 'center', 
                    gap: 10,
                    zIndex: 10
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPersonal(false);
                        setFieldErrors({});
                      }}
                      style={{ 
                        padding: '9px 18px', fontSize: 12.5, fontWeight: 600, color: '#475569', 
                        background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 6, 
                        cursor: 'pointer' 
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      id="btn-save-personal-info"
                      type="submit"
                      disabled={isSavingPersonal}
                      style={{ 
                        padding: '9px 22px', fontSize: 12.5, fontWeight: 700, color: '#ffffff', 
                        background: isSavingPersonal ? '#94a3b8' : '#2563eb', border: 'none', 
                        borderRadius: 6, cursor: isSavingPersonal ? 'not-allowed' : 'pointer', 
                        display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <Save size={14} /> {isSavingPersonal ? 'Saving changes...' : 'Save changes'}
                    </button>
                  </div>
                </form>
              ) : null}

              {/* Identity & Demographics Cards (View Mode Only) */}
              {!isEditingPersonal && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: C.paper, padding: 18, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>DepEd 12-Digit LRN</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
                        {student.lrn}
                      </div>
                      <div style={{ fontSize: 9, color: '#059669', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Lock size={10} /> Official Identity / Protected
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Recorded Biological Sex</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginTop: 3 }}>{student.gender || 'Not specified'}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Verified Date of Birth</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginTop: 3 }}>
                        {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Pending Verification'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Current Chronological Age</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.m700, marginTop: 3 }}>
                        {currentAge ? currentAge.formatted : 'Pending Verification'}
                      </div>
                      <div style={{ fontSize: 9, color: C.t3, marginTop: 2 }}>As of today (calculated automatically)</div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>DepEd School Form (SF1) Age</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#b45309', marginTop: 3 }}>
                        {schoolFormAge.age ? schoolFormAge.age.formatted : 'Pending Verification'}
                      </div>
                      <div style={{ fontSize: 9, color: '#d97706', fontWeight: 600, marginTop: 2 }}>
                        ⚠️ {schoolFormAge.statusNote}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Blood Type</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginTop: 3 }}>
                        {student.bloodType || 'Not recorded'}
                      </div>
                    </div>
                  </div>

                  {/* Address & Contact Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                    <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.t1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={13} color={C.m700} /> Residential Address
                      </div>
                      <div style={{ fontSize: 12, color: C.t1, lineHeight: 1.5 }}>
                        <div><strong>Street:</strong> {student.street || '—'}</div>
                        <div><strong>City/Municipality:</strong> {student.city || '—'}</div>
                        <div><strong>Province:</strong> {student.stateProvince || '—'}</div>
                        <div><strong>ZIP Code:</strong> {student.zipCode || '—'}</div>
                      </div>
                    </div>

                    <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.t1, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Phone size={13} color={C.m700} /> Parent / Guardian Information
                        </span>
                        {guardianAuth && guardianAuth.hasEmail ? (
                          <span 
                            id="badge-guardian-auth-status"
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 12,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: guardianAuth.status === 'AUTHORIZED' ? '#dcfce7' : guardianAuth.status === 'PENDING_VERIFICATION' ? '#fef3c7' : '#fee2e2',
                              color: guardianAuth.status === 'AUTHORIZED' ? '#166534' : guardianAuth.status === 'PENDING_VERIFICATION' ? '#92400e' : '#991b1b',
                              border: `1px solid ${guardianAuth.status === 'AUTHORIZED' ? '#86efac' : guardianAuth.status === 'PENDING_VERIFICATION' ? '#fcd34d' : '#fca5a5'}`,
                            }}
                          >
                            {guardianAuth.status === 'AUTHORIZED' ? '✓ Verified & Authorized' : guardianAuth.status === 'PENDING_VERIFICATION' ? '⏱ Pending Verification' : guardianAuth.status}
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #cbd5e1',
                          }}>
                            No Email Configured
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.t1, lineHeight: 1.5 }}>
                        <div><strong>Name:</strong> {student.guardianFirstName || student.guardianLastName ? `${student.guardianFirstName || ''} ${student.guardianLastName || ''}`.trim() : '—'}</div>
                        <div><strong>Contact Phone:</strong> {student.guardianPhone || '—'}</div>
                        <div><strong>Email:</strong> {student.guardianEmail || '—'}</div>

                        {/* Authorized details display */}
                        {guardianAuth && guardianAuth.status === 'AUTHORIZED' && (
                          <div id="guardian-auth-details" style={{ marginTop: 8, padding: '8px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 11, color: '#166534' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                              <div>
                                <strong>Verification Method:</strong>{' '}
                                {guardianAuth.verificationMethod === 'SCHOOL_ENROLLMENT_CONFIRMED'
                                  ? 'School Confirmed (DepEd SF1 Enrollment)'
                                  : guardianAuth.verificationMethod === 'SCHOOL_CONTACT_UPDATE_CONFIRMED'
                                  ? 'School Confirmed (Contact Update Form)'
                                  : guardianAuth.verificationMethod === 'IN_PERSON_PSA_VERIFICATION' || guardianAuth.verificationMethod === 'IN_PERSON_STAFF'
                                  ? 'In-Person Verified (PSA / Valid ID)'
                                  : guardianAuth.verificationMethod === 'OTP'
                                  ? 'Email OTP Verified'
                                  : guardianAuth.verificationMethod === 'DIRECT_EMAIL_LINK'
                                  ? 'Direct Email Link Verified'
                                  : guardianAuth.verificationMethod || 'Verified & Authorized'}
                              </div>
                              {guardianAuth.verifiedAt && (
                                <div>
                                  <strong>Confirmed On:</strong>{' '}
                                  {new Date(guardianAuth.verifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </div>
                              )}
                            </div>
                            {guardianAuth.confirmationSource && (
                              <div style={{ marginTop: 4, fontSize: 10, color: '#15803d' }}>
                                <strong>Reference / Source:</strong> {guardianAuth.confirmationSource}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Pending verification workflow */}
                        {isAdviser && guardianAuth && guardianAuth.status === 'PENDING_VERIFICATION' && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fef3c7', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>
                              Contact pending school confirmation or guardian verification. Attendance recording continues normally; automatic email notices will be held until confirmed.
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                id="btn-school-confirm-contact"
                                onClick={() => setShowConfirmModal(!showConfirmModal)}
                                disabled={isAuthorizingManual}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '4px 10px',
                                  borderRadius: 5,
                                  background: '#dcfce7',
                                  border: '1px solid #86efac',
                                  color: '#166534',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Check size={12} />
                                {isAuthorizingManual ? 'Confirming...' : 'School-Confirmed Contact'}
                              </button>
                              <button
                                type="button"
                                id="btn-verify-by-email"
                                onClick={handleSendOtp}
                                disabled={isSendingOtp}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '4px 10px',
                                  borderRadius: 5,
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#1d4ed8',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Mail size={12} />
                                {isSendingOtp ? 'Sending...' : 'Verify by Email'}
                              </button>
                              <button
                                type="button"
                                id="btn-enter-otp"
                                onClick={() => setShowOtpPrompt(!showOtpPrompt)}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '4px 10px',
                                  borderRadius: 5,
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  cursor: 'pointer',
                                }}
                              >
                                {showOtpPrompt ? 'Cancel OTP' : 'Enter OTP Code'}
                              </button>
                            </div>

                            {/* School confirmation prompt */}
                            {showConfirmModal && (
                              <div id="box-school-confirm-form" style={{ marginTop: 10, padding: 12, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                                  Confirm Guardian Contact via School Records
                                </div>
                                <div style={{ fontSize: 11, color: '#15803d', marginBottom: 8 }}>
                                  Confirm guardian details verified through official DepEd documents without requiring parent email OTP.
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div>
                                    <label style={{ fontSize: 10.5, fontWeight: 700, color: '#166534', display: 'block', marginBottom: 2 }}>
                                      Confirmation Method / Procedure:
                                    </label>
                                    <select
                                      id="select-confirmation-method"
                                      value={confirmMethod}
                                      onChange={(e: any) => {
                                        setConfirmMethod(e.target.value);
                                        if (e.target.value === 'SCHOOL_ENROLLMENT_CONFIRMED') {
                                          setConfirmSource('DepEd SF1 Enrollment Document Verification');
                                        } else if (e.target.value === 'SCHOOL_CONTACT_UPDATE_CONFIRMED') {
                                          setConfirmSource('Official Parent Contact Update Form');
                                        } else {
                                          setConfirmSource('In-Person Parent Conference Verification');
                                        }
                                      }}
                                      style={{ width: '100%', padding: '5px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #86efac', background: '#fff' }}
                                    >
                                      <option value="SCHOOL_ENROLLMENT_CONFIRMED">DepEd SF1 Enrollment Record / PSA Verified</option>
                                      <option value="SCHOOL_CONTACT_UPDATE_CONFIRMED">Official Parent Contact Update Form Signed by Guardian</option>
                                      <option value="IN_PERSON_PSA_VERIFICATION">In-Person Parent Conference / Identification</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: 10.5, fontWeight: 700, color: '#166534', display: 'block', marginBottom: 2 }}>
                                      Document Reference / Note:
                                    </label>
                                    <input
                                      type="text"
                                      id="input-confirmation-source"
                                      value={confirmSource}
                                      onChange={(e) => setConfirmSource(e.target.value)}
                                      placeholder="e.g. DepEd SF1 SY 2026-2027 confirmed"
                                      style={{ width: '100%', padding: '5px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #86efac', background: '#fff' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                                    <button
                                      type="button"
                                      onClick={() => setShowConfirmModal(false)}
                                      style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', cursor: 'pointer' }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      id="btn-submit-school-confirm"
                                      onClick={handleSchoolConfirm}
                                      disabled={isAuthorizingManual}
                                      style={{ padding: '4px 12px', fontSize: 11, fontWeight: 700, borderRadius: 4, border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}
                                    >
                                      {isAuthorizingManual ? 'Authorizing...' : 'Authorize Contact'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* OTP Code Entry */}
                            {showOtpPrompt && (
                              <div id="box-otp-entry-form" style={{ marginTop: 8, padding: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="text"
                                  id="input-otp-code"
                                  maxLength={6}
                                  placeholder="6-digit OTP"
                                  value={otpValue}
                                  onChange={(e) => setOtpValue(e.target.value)}
                                  style={{ width: 110, padding: '5px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #cbd5e1', letterSpacing: 2, textAlign: 'center' }}
                                />
                                <button
                                  type="button"
                                  id="btn-submit-otp"
                                  onClick={handleVerifyOtp}
                                  disabled={isVerifyingOtp}
                                  style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, background: '#0284c7', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                >
                                  {isVerifyingOtp ? 'Verifying...' : 'Submit OTP'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Medical Information */}
                  <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.t1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Activity size={13} color="#e11d48" /> Medical & Special Health Notes
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                      <div><strong>Known Allergies:</strong> {student.allergies || 'None recorded'}</div>
                      <div><strong>Medical Conditions:</strong> {student.medicalConditions || 'None recorded'}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB 2: ENROLLMENT INFORMATION */}
          {/* ──────────────────────────────────────────────────────────── */}
          {activeTab === 'enrollment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>Academic Enrollment Status</div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Current section enrollment and advisory information</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, background: C.paper, padding: 18, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Assigned Advisory Section</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginTop: 3 }}>
                    Grade {sectionInfo.grade} - {sectionInfo.section}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Academic Year</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginTop: 3 }}>
                    SY 2026–2027
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Enrollment Status</div>
                  <div style={{ marginTop: 4 }}>
                    <Stamp label={student.status || 'Enrolled'} color="#059669" bg="#ecfdf5" />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Designated Class Adviser</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginTop: 3 }}>
                    Maria Clara
                  </div>
                  <div style={{ fontSize: 10, color: '#059669', marginTop: 1 }}>Assigned Section Adviser</div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Internal Student ID</div>
                  <div style={{ fontSize: 11, color: C.t2, fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
                    {student.id}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Enrollment ID</div>
                  <div style={{ fontSize: 11, color: C.t2, fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
                    {student.enrollmentId || 'Active'}
                  </div>
                </div>
              </div>

              {/* Multi-Year Academic Enrollment History Table */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.t1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <History size={14} color={C.navy} />
                  Official DepEd Multi-Year Enrollment History
                </div>
                <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: `1px solid ${C.borderMed}` }}>
                        <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase' }}>School Year</th>
                        <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase' }}>Grade Level</th>
                        <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase' }}>Section</th>
                        <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, color: C.t3, textTransform: 'uppercase' }}>Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {academicYearsHistory.length > 0 ? (
                        academicYearsHistory.map((ay) => (
                          <tr key={ay.enrollmentId} style={{ borderBottom: `1px solid ${C.border}` }}>
                            <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: C.t1 }}>
                              {ay.academicYearName}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, color: C.t2 }}>
                              Grade {ay.gradeLevel}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600, color: C.t1 }}>
                              {ay.sectionName}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: 4 }}>
                                {ay.enrollmentStatus || 'Enrolled'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {ay.isCurrent ? (
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '2px 6px', borderRadius: 4 }}>
                                  Active Year
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: 4 }}>
                                  Archived · Read-Only
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} style={{ padding: 18, textAlign: 'center', fontSize: 11, color: C.t3 }}>
                            {isLoadingYearsHistory ? 'Loading enrollment history...' : 'No historical enrollment records found.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB 3: HEALTH & NUTRITION (SF8) */}
          {/* ──────────────────────────────────────────────────────────── */}
          {activeTab === 'health' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Heart size={16} color="#e11d48" />
                  Learner Basic Health and Nutrition Assessment (SF8)
                </div>
                <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>
                  Standard DepEd anthropometric measurement. Encoded by <strong>Class Adviser</strong> or <strong>MAPEH Teacher</strong> (No School Nurse required at Calulut INHS).
                </div>
              </div>

              <form onSubmit={handleSaveMeasurement} style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                      Assessment Period *
                    </label>
                    <select
                      id="select-measurement-period"
                      value={measurementPeriod}
                      onChange={(e) => setMeasurementPeriod(e.target.value as any)}
                      disabled={!isAdviser}
                      style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                    >
                      <option value="BOSY">BOSY (Beginning of Year)</option>
                      <option value="EOSY">EOSY (End of Year)</option>
                      <option value="INTERIM">INTERIM (Mid-Year)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                      <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Measurement Date *
                    </label>
                    <input 
                      id="input-measurement-date"
                      type="date" 
                      value={measurementDate}
                      onChange={(e) => setMeasurementDate(e.target.value)}
                      disabled={!isAdviser}
                      required
                      style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                      <Ruler size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Height in Centimeters (cm) *
                    </label>
                    <input 
                      id="input-height-cm"
                      type="number" 
                      step="0.1" 
                      placeholder="e.g. 165.0"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      disabled={!isAdviser}
                      required
                      style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                      <Scale size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Weight in Kilograms (kg) *
                    </label>
                    <input 
                      id="input-weight-kg"
                      type="number" 
                      step="0.1" 
                      placeholder="e.g. 55.0"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      disabled={!isAdviser}
                      required
                      style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                    Observations / Remarks
                  </label>
                  <input
                    id="input-health-remarks"
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional notes regarding assessment conditions"
                    disabled={!isAdviser}
                    style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Feedback messages */}
                {saveMetricSuccess && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: '#ecfdf5', color: '#059669', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={14} /> Measurement record successfully saved and committed to PostgreSQL database!
                  </div>
                )}
                {metricErrorMessage && (
                  <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} /> {metricErrorMessage}
                  </div>
                )}

                {/* Live Automated Calculation Cards (Immediate Real-Time Update) */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.t2, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={12} color="#0284c7" /> Live Real-Time Health Calculations
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {/* Card 1: Computed BMI */}
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Computed BMI</div>
                      <div id="display-computed-bmi" style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                        {liveBmi != null ? `${liveBmi} kg/m²` : '—'}
                      </div>
                      <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>weight / (height in meters)²</div>
                    </div>

                    {/* Card 2: WHO 2007 BMI-for-Age */}
                    <div style={{ background: statusTheme.bg, padding: 12, borderRadius: 8, border: `1px solid ${statusTheme.color}30` }}>
                      <div style={{ fontSize: 10, color: statusTheme.color, fontWeight: 700, textTransform: 'uppercase' }}>WHO 2007 BMI-for-Age</div>
                      <div id="display-bmi-status" style={{ fontSize: 15, fontWeight: 800, color: statusTheme.color, marginTop: 4 }}>
                        {bmiResult.status}
                      </div>
                      <div style={{ fontSize: 9, color: statusTheme.color, opacity: 0.8, marginTop: 2 }}>
                        Age {effectiveAgeYears} {student.gender || 'learner'}
                      </div>
                    </div>

                    {/* Card 3: WHO 2007 Height-for-Age */}
                    <div style={{ background: hfaTheme.bg, padding: 12, borderRadius: 8, border: `1px solid ${hfaTheme.color}30` }}>
                      <div style={{ fontSize: 10, color: hfaTheme.color, fontWeight: 700, textTransform: 'uppercase' }}>WHO 2007 Height-for-Age</div>
                      <div id="display-hfa-status" style={{ fontSize: 15, fontWeight: 800, color: hfaTheme.color, marginTop: 4 }}>
                        {hfaResult.status}
                      </div>
                      <div style={{ fontSize: 9, color: hfaTheme.color, opacity: 0.8, marginTop: 2 }}>
                        Stunting / Growth status
                      </div>
                    </div>

                    {/* Card 4: Age at Measurement Date */}
                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Age at Measurement</div>
                      <div id="display-age-at-measurement" style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                        {ageAtMeasurement ? ageAtMeasurement.formatted : 'Pending'}
                      </div>
                      <div style={{ fontSize: 9, color: '#059669', fontWeight: 600, marginTop: 2 }}>
                        ✓ DepEd DO 58 s. 2017 compliant
                      </div>
                    </div>
                  </div>
                </div>

                {isAdviser && (
                  <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      id="btn-save-health-metric"
                      type="submit" 
                      disabled={isSavingMetric}
                      style={{ padding: '10px 22px', fontSize: 12, fontWeight: 700, color: '#fff', background: isSavingMetric ? '#94a3b8' : C.m700, border: 'none', borderRadius: 6, cursor: isSavingMetric ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Save size={14} /> {isSavingMetric ? 'Persisting Metric...' : 'Save Health Metric'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────── */}
          {/* TAB 4: MEASUREMENT HISTORY & AUDIT TRAIL */}
          {/* ──────────────────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>Measurement History & Audit Trail (SF8)</div>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>Chronological versioned health assessments preserved in PostgreSQL</div>
                </div>
                <button
                  id="btn-refresh-health-history"
                  type="button"
                  onClick={fetchHistory}
                  style={{ fontSize: 11, color: C.m700, background: C.m100, border: 'none', borderRadius: 4, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}
                >
                  <RefreshCw size={12} /> Refresh History
                </button>
              </div>

              {isLoadingHistory ? (
                <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: C.t3 }}>Loading historical records...</div>
              ) : metricsHistory.length === 0 ? (
                <div style={{ padding: 24, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                  No health measurements recorded yet for this learner. Enter the baseline BOSY assessment in the Health & Nutrition tab.
                </div>
              ) : (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: C.paper, borderBottom: `1px solid ${C.border}`, textAlign: 'left', color: C.t2 }}>
                        <th style={{ padding: '9px 12px' }}>Period</th>
                        <th style={{ padding: '9px 12px' }}>Measurement Date</th>
                        <th style={{ padding: '9px 12px' }}>Height</th>
                        <th style={{ padding: '9px 12px' }}>Weight</th>
                        <th style={{ padding: '9px 12px' }}>Age at Date</th>
                        <th style={{ padding: '9px 12px' }}>BMI</th>
                        <th style={{ padding: '9px 12px' }}>BMI-for-Age</th>
                        <th style={{ padding: '9px 12px' }}>Height-for-Age</th>
                        <th style={{ padding: '9px 12px' }}>Version</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricsHistory.map((m: any, idx: number) => (
                        <tr 
                          key={m.id || idx} 
                          style={{ 
                            borderBottom: idx < metricsHistory.length - 1 ? `1px solid ${C.border}` : 'none',
                            background: m.is_latest ? '#ffffff' : '#f8fafc',
                            opacity: m.is_latest ? 1 : 0.8
                          }}
                        >
                          <td style={{ padding: '9px 12px', fontWeight: 700, color: C.m900 }}>
                            {m.measurement_period}
                            {m.is_latest && (
                              <span style={{ marginLeft: 6, fontSize: 9, padding: '2px 5px', borderRadius: 3, background: '#ecfdf5', color: '#059669', fontWeight: 800 }}>LATEST</span>
                            )}
                          </td>
                          <td style={{ padding: '9px 12px', color: C.t2 }}>
                            {m.measurement_date ? new Date(m.measurement_date).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ padding: '9px 12px', fontWeight: 600 }}>{Number(m.height_cm).toFixed(1)} cm</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600 }}>{Number(m.weight_kg).toFixed(1)} kg</td>
                          <td style={{ padding: '9px 12px', color: C.t2 }}>{m.computed_age_years ? `${m.computed_age_years} yrs` : '—'}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                            {m.computed_bmi ? `${Number(m.computed_bmi).toFixed(1)}` : '—'}
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ 
                              padding: '3px 7px', borderRadius: 4, fontWeight: 700, fontSize: 10,
                              background: (statusColorMap[m.bmi_category] || statusColorMap['Pending Verification / Not Calculated']).bg,
                              color: (statusColorMap[m.bmi_category] || statusColorMap['Pending Verification / Not Calculated']).color,
                            }}>
                              {m.bmi_category || 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ 
                              padding: '3px 7px', borderRadius: 4, fontWeight: 700, fontSize: 10,
                              background: (statusColorMap[m.hfa_category] || statusColorMap['Pending Verification / Not Calculated']).bg,
                              color: (statusColorMap[m.hfa_category] || statusColorMap['Pending Verification / Not Calculated']).color,
                            }}>
                              {m.hfa_category || 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', color: C.t3 }}>
                            v{m.version_number}
                            {m.recorded_by?.school_id && (
                              <span style={{ display: 'block', fontSize: 9 }}>by {m.recorded_by.school_id}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', background: C.paper, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <button 
            id="btn-footer-close-profile"
            onClick={onClose}
            style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, color: C.t2, background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 6, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
