import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { C } from '../../shared/constants/tokens';
import { 
  X, Search, UserPlus, CheckCircle, AlertTriangle, 
  User, Shield, Calendar, ArrowRight, UserCheck, ChevronRight, Info, AlertCircle
} from 'lucide-react';
import { apiClient } from '../../../api/client';
import { useAppContext } from '../../shared/AppContext';
import { toast } from 'sonner';
import { validateLrn, validateStudentRegistrationForm } from '../../shared/utils/studentValidation';

export interface SearchLearnerResult {
  studentId: string;
  id?: string;
  lrn: string;
  firstName: string;
  lastName: string;
  first_name?: string;
  last_name?: string;
  middleName?: string | null;
  suffix?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  hasPortalAccount?: boolean;
  currentEnrollment?: {
    isEnrolled: boolean;
    enrollmentId?: string;
    sectionId?: string;
    sectionName?: string;
    gradeLevel?: number;
    academicYearId?: string;
    status?: string;
  };
}

interface AdviserAddLearnerModalProps {
  sectionId: string;
  grade: number;
  section: string;
  adviserName?: string;
  onLearnerAdded: () => void;
  onClose: () => void;
}

export function AdviserAddLearnerModal({
  sectionId,
  grade,
  section,
  adviserName: propAdviserName,
  onLearnerAdded,
  onClose
}: AdviserAddLearnerModalProps) {
  const { currentUser } = useAppContext();
  const effectiveAdviserName = propAdviserName || currentUser?.name || 'Maria Clara';

  // Modal navigation mode: 'enroll_existing' | 'register_new'
  const [activeTab, setActiveTab] = useState<'enroll_existing' | 'register_new'>('enroll_existing');

  // --- Tab 1: Enroll Existing Learner State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchLearnerResult[] | null>(null);
  const [selectedLearner, setSelectedLearner] = useState<SearchLearnerResult | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState(false);

  // --- Tab 2: Register New Learner State ---
  const [regStep, setRegStep] = useState<'lrn_check' | 'form' | 'review'>('lrn_check');
  const [lrnInput, setLrnInput] = useState('');
  const [isCheckingLrn, setIsCheckingLrn] = useState(false);
  const [lrnCheckError, setLrnCheckError] = useState<string | null>(null);
  const [lrnExistingMatch, setLrnExistingMatch] = useState<SearchLearnerResult | null>(null);
  const [lrnVerifiedAbsent, setLrnVerifiedAbsent] = useState(false);

  const [formData, setFormData] = useState({
    lrn: '',
    firstName: '',
    lastName: '',
    middleName: '',
    suffix: '',
    dateOfBirth: '',
    gender: 'Male',
    street: '',
    city: 'City of San Fernando',
    stateProvince: 'Pampanga',
    guardianFirstName: '',
    guardianLastName: '',
    guardianPhone: '',
    guardianEmail: '',
  });
  const [regFormError, setRegFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isRegistering, setIsRegistering] = useState(false);
  const [regSubmitError, setRegSubmitError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState(false);

  // ─────────────────────────────────────────────────────────────
  // TAB 1 ACTIONS: ENROLL EXISTING LEARNER
  // ─────────────────────────────────────────────────────────────

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();

    // Enforce minimum query length (single character searches like 'a' must never proceed)
    if (!query || query.length < 2) {
      setSearchError('Please enter at least 2 characters or a 12-digit LRN to search.');
      setSearchResults(null);
      setSelectedLearner(null);
      return;
    }

    setSearchError(null);
    setSelectedLearner(null);
    setIsSearching(true);

    try {
      const res: any = await apiClient.get(`/academic/advisory/search?q=${encodeURIComponent(query)}`);
      const results: SearchLearnerResult[] = res?.data || (Array.isArray(res) ? res : []);
      setSearchResults(results);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      setSearchError(msg || 'Error searching learner records.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleEnrollExisting = async () => {
    if (!selectedLearner) return;
    const studentIdToEnroll = selectedLearner.studentId || selectedLearner.id;
    if (!studentIdToEnroll) return;

    setIsEnrolling(true);
    setEnrollError(null);

    try {
      await apiClient.post(`/academic/advisory/sections/${sectionId}/enroll-existing`, {
        studentId: studentIdToEnroll,
      });
      setEnrollSuccess(true);
      setTimeout(() => {
        onLearnerAdded();
        onClose();
      }, 1200);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message;
      setEnrollError(msg || 'Failed to enroll student into advisory section.');
    } finally {
      setIsEnrolling(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // TAB 2 ACTIONS: REGISTER NEW LEARNER
  // ─────────────────────────────────────────────────────────────

  const handleVerifyLrn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanLrn = lrnInput.trim();

    const lrnCheck = validateLrn(cleanLrn);
    if (!lrnCheck.valid) {
      setLrnCheckError(lrnCheck.error || 'Invalid LRN');
      toast.error(lrnCheck.error || 'Invalid LRN');
      setLrnExistingMatch(null);
      setLrnVerifiedAbsent(false);
      return;
    }

    setLrnCheckError(null);
    setIsCheckingLrn(true);
    setLrnExistingMatch(null);
    setLrnVerifiedAbsent(false);

    try {
      const res: any = await apiClient.get(`/academic/advisory/search?q=${encodeURIComponent(cleanLrn)}`);
      const results: SearchLearnerResult[] = res?.data || (Array.isArray(res) ? res : []);
      
      const exactMatch = results.find(r => r.lrn === cleanLrn);
      if (exactMatch) {
        setLrnExistingMatch(exactMatch);
        setLrnVerifiedAbsent(false);
      } else {
        setLrnExistingMatch(null);
        setLrnVerifiedAbsent(true);
        setFormData(prev => ({ ...prev, lrn: cleanLrn }));
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message;
      setLrnCheckError(msg || 'Error checking LRN against local registry.');
      toast.error(msg || 'Error checking LRN against local registry.');
    } finally {
      setIsCheckingLrn(false);
    }
  };

  const handleSwitchToEnrollFromLrnCheck = (matched: SearchLearnerResult) => {
    setActiveTab('enroll_existing');
    setSearchQuery(matched.lrn);
    setSearchResults([matched]);
    setSelectedLearner(matched);
    setSearchError(null);
  };

  const handleProceedToForm = () => {
    setRegFormError(null);
    setRegStep('form');
  };

  const handleReviewRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateStudentRegistrationForm(formData);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      // Clean UX: Do NOT show top red banner, DO NOT trigger toast for ordinary inline field errors
      setRegFormError(null);
      const fieldIdMap: Record<string, string> = {
        lrn: 'register-lrn-input',
        firstName: 'reg-first-name',
        lastName: 'reg-last-name',
        middleName: 'reg-middle-name',
        suffix: 'reg-suffix',
        dateOfBirth: 'reg-dob',
        gender: 'reg-gender',
        guardianFirstName: 'reg-guardian-first',
        guardianLastName: 'reg-guardian-last',
        guardianPhone: 'reg-guardian-phone',
        guardianEmail: 'reg-guardian-email',
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
    setRegFormError(null);
    setRegStep('review');
  };

  const handleConfirmRegisterAndEnroll = async () => {
    setIsRegistering(true);
    setRegSubmitError(null);

    try {
      await apiClient.post(`/academic/advisory/sections/${sectionId}/register`, {
        lrn: formData.lrn.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        middleName: formData.middleName?.trim() || undefined,
        suffix: formData.suffix?.trim() || undefined,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        street: formData.street?.trim() || undefined,
        city: formData.city?.trim() || undefined,
        stateProvince: formData.stateProvince?.trim() || undefined,
        guardianFirstName: formData.guardianFirstName?.trim() || undefined,
        guardianLastName: formData.guardianLastName?.trim() || undefined,
        guardianPhone: formData.guardianPhone?.trim() || undefined,
        guardianEmail: formData.guardianEmail?.trim() || undefined,
      });

      setRegSuccess(true);
      toast.success('Learner registered and enrolled successfully!');
      setTimeout(() => {
        onLearnerAdded();
        onClose();
      }, 1200);
    } catch (err: any) {
      const errData = err.response?.data?.error;
      const msg = errData?.message || err.response?.data?.message || err.message || 'Failed to register and enroll learner.';
      if (errData?.details && Array.isArray(errData.details)) {
        const backendErrors: Record<string, string> = {};
        for (const d of errData.details) {
          backendErrors[d.field] = d.message;
        }
        setFieldErrors(backendErrors);
        setRegStep('form');
      }
      setRegSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      id="adviser-add-learner-modal-overlay"
      style={{ 
        position: 'fixed', inset: 0, zIndex: 99999, 
        background: 'rgba(10, 25, 47, 0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        id="adviser-add-learner-modal-container"
        style={{ 
          width: '100%', maxWidth: 660, maxHeight: '92vh', overflowY: 'auto',
          background: '#ffffff', borderRadius: 12, boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column', border: `1px solid ${C.border}`
        }}
      >
        {/* Modal Header */}
        <div style={{ background: C.m900, padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 11, borderTopRightRadius: 11 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', fontFamily: "'Fraunces', serif", letterSpacing: '0.2px' }}>
                Enroll Student in Advisory Section
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                Grade {grade}, Section {section} | Class Adviser: {effectiveAdviserName} (SY 2026–2027)
              </div>
            </div>
          </div>
          <button 
            id="btn-close-learner-modal"
            onClick={onClose} 
            title="Close Modal"
            style={{ width: 28, height: 28, borderRadius: 4, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Segmented Tab Navigation: Immediate Choice */}
        <div style={{ padding: '14px 22px 0 22px', background: C.paper, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 6, background: '#e2e8f0', padding: 3, borderRadius: 8 }}>
            <button
              type="button"
              id="tab-enroll-existing"
              onClick={() => { setActiveTab('enroll_existing'); setSearchError(null); }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: activeTab === 'enroll_existing' ? C.m900 : 'transparent',
                color: activeTab === 'enroll_existing' ? '#ffffff' : C.t2,
                boxShadow: activeTab === 'enroll_existing' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <UserCheck size={14} />
              Enroll Existing Learner
            </button>
            <button
              type="button"
              id="tab-register-new"
              onClick={() => { setActiveTab('register_new'); }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '8px 14px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: activeTab === 'register_new' ? C.m900 : 'transparent',
                color: activeTab === 'register_new' ? '#ffffff' : C.t2,
                boxShadow: activeTab === 'register_new' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <UserPlus size={14} />
              Register New Learner
            </button>
          </div>

          {/* DepEd Order DO 017 Policy Guidance */}
          <div style={{ margin: '12px 0', padding: '8px 12px', background: '#ffffff', border: `1px solid ${C.border}`, borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Info size={14} color={C.m700} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.45 }}>
              <strong>DepEd Order No. 017, s. 2025:</strong> Class Advisers must verify existing records first using the 12-digit LRN to prevent duplicate identities and preserve academic history.
            </div>
          </div>
        </div>

        {/* Modal Body Content */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* TAB 1: ENROLL EXISTING LEARNER                             */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'enroll_existing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Search Form */}
              <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2 }}>
                  12-Digit LRN or Learner Name
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} color={C.t3} style={{ position: 'absolute', left: 12, top: 11 }} />
                    <input 
                      id="enroll-search-input"
                      type="text" 
                      placeholder="e.g. 100000000001 or dela Cruz"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (searchError) setSearchError(null);
                      }}
                      style={{ 
                        width: '100%', padding: '9px 12px 9px 34px', fontSize: 12, 
                        borderRadius: 6, border: `1px solid ${searchError ? '#ef4444' : C.borderMed}`, 
                        outline: 'none', boxSizing: 'border-box' 
                      }}
                    />
                  </div>
                  <button 
                    id="btn-enroll-search"
                    type="submit" 
                    disabled={isSearching}
                    style={{ 
                      padding: '9px 18px', background: C.m700, color: '#ffffff', border: 'none', 
                      borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: isSearching ? 'not-allowed' : 'pointer', 
                      display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
                    }}
                  >
                    <Search size={13} />
                    {isSearching ? 'Searching...' : 'Find Learner'}
                  </button>
                </div>

                {/* Validation or Error Message */}
                {searchError && (
                  <div id="enroll-search-error" style={{ fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                    <AlertCircle size={13} />
                    <span>{searchError}</span>
                  </div>
                )}
              </form>

              {/* Search Results Display */}
              {searchResults !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Matching Local Records ({searchResults.length})
                  </div>

                  {searchResults.length === 0 ? (
                    <div style={{ padding: '16px', background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.t2 }}>
                        No existing learner records found matching "{searchQuery}"
                      </div>
                      <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
                        Please verify the 12-digit LRN or surname spelling.
                      </div>
                      <button
                        type="button"
                        id="btn-switch-to-register-empty"
                        onClick={() => {
                          setActiveTab('register_new');
                          if (/^\d{12}$/.test(searchQuery.trim())) {
                            setLrnInput(searchQuery.trim());
                          }
                        }}
                        style={{
                          marginTop: 10, padding: '6px 14px', fontSize: 11, fontWeight: 700,
                          background: '#ffffff', color: C.m700, border: `1px solid ${C.m700}`,
                          borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5
                        }}
                      >
                        <UserPlus size={13} />
                        Register as New Learner Instead
                      </button>
                    </div>
                  ) : (
                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {searchResults.map((learner) => {
                        const isEnrolledInThisSection = 
                          learner.currentEnrollment?.isEnrolled && 
                          learner.currentEnrollment?.sectionId === sectionId;
                        const isEnrolledInOtherSection = 
                          learner.currentEnrollment?.isEnrolled && 
                          learner.currentEnrollment?.sectionId !== sectionId;
                        const isSelected = selectedLearner?.studentId === learner.studentId;

                        return (
                          <div 
                            key={learner.studentId}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 6,
                              border: `1px solid ${isSelected ? C.m700 : C.border}`,
                              background: isSelected ? '#eff6ff' : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>
                                  {learner.lastName || learner.last_name}, {learner.firstName || learner.first_name} {learner.middleName || ''} {learner.suffix || ''}
                                </span>
                                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: C.t2 }}>
                                  LRN: {learner.lrn}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>
                                <span>{learner.gender || 'Sex Unrecorded'} • DOB: {learner.dateOfBirth || 'N/A'}</span>
                                <span style={{ margin: '0 6px' }}>•</span>
                                {isEnrolledInThisSection ? (
                                  <span style={{ color: '#059669', fontWeight: 600 }}>Active in Grade {grade}, Section {section}</span>
                                ) : isEnrolledInOtherSection ? (
                                  <span style={{ color: '#d97706', fontWeight: 600 }}>Enrolled in {learner.currentEnrollment?.sectionName || 'Another Section'}</span>
                                ) : (
                                  <span style={{ color: C.t3 }}>Not Actively Enrolled</span>
                                )}
                              </div>
                            </div>

                            <div>
                              {isEnrolledInThisSection ? (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: '#ecfdf5', padding: '4px 8px', borderRadius: 4 }}>
                                  Already in Section
                                </span>
                              ) : isEnrolledInOtherSection ? (
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309', background: '#fef3c7', padding: '4px 8px', borderRadius: 4 }} title="DepEd mid-year transfer must be filed with the Registrar">
                                  Transfer Conflict
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  id={`btn-select-learner-${learner.studentId}`}
                                  onClick={() => setSelectedLearner(learner)}
                                  style={{
                                    padding: '5px 12px', fontSize: 11, fontWeight: 700,
                                    background: isSelected ? C.m900 : '#ffffff',
                                    color: isSelected ? '#ffffff' : C.m700,
                                    border: `1px solid ${isSelected ? C.m900 : C.m700}`,
                                    borderRadius: 4, cursor: 'pointer'
                                  }}
                                >
                                  {isSelected ? 'Selected' : 'Select Learner'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Selected Learner Confirmation Panel */}
              {selectedLearner && (
                <div style={{ padding: 14, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 800, fontSize: 12 }}>
                      <CheckCircle size={15} />
                      <span>Ready to Enroll into Grade {grade}, Section {section}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLearner(null)}
                      style={{ fontSize: 11, color: C.t3, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Change Selection
                    </button>
                  </div>

                  <div style={{ fontSize: 12, color: '#1e293b', lineHeight: 1.5 }}>
                    <div><strong>Learner:</strong> {selectedLearner.lastName || selectedLearner.last_name}, {selectedLearner.firstName || selectedLearner.first_name}</div>
                    <div><strong>12-Digit LRN:</strong> <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{selectedLearner.lrn}</span></div>
                    <div><strong>Target Placement:</strong> Grade {grade}, Section {section} (SY 2026–2027)</div>
                    <div style={{ fontSize: 11, color: '#15803d', marginTop: 4 }}>
                      Reusing Student UUID <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>({selectedLearner.studentId})</span>. Preserves existing learner identity without duplicate records.
                    </div>
                  </div>

                  {enrollError && (
                    <div style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '6px 10px', borderRadius: 4 }}>
                      {enrollError}
                    </div>
                  )}

                  {enrollSuccess ? (
                    <div style={{ padding: 8, background: '#dcfce7', color: '#15803d', borderRadius: 6, fontSize: 12, textAlign: 'center', fontWeight: 700 }}>
                      ✓ Learner enrolled into {section} successfully!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                      <button
                        type="button"
                        id="btn-confirm-enroll"
                        onClick={handleEnrollExisting}
                        disabled={isEnrolling}
                        style={{
                          padding: '8px 18px', fontSize: 12, fontWeight: 700, color: '#ffffff',
                          background: '#16a34a', border: 'none', borderRadius: 6,
                          cursor: isEnrolling ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6
                        }}
                      >
                        {isEnrolling ? 'Enrolling...' : `Confirm Enrollment into ${section}`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* TAB 2: REGISTER NEW LEARNER                                */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeTab === 'register_new' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Sub-step 1: Pre-Registration LRN Verification */}
              {regStep === 'lrn_check' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
                    <strong>Step 1 — 12-Digit LRN Pre-Verification:</strong> Under DepEd policy, you must first verify that this 12-digit LRN is not already registered locally.
                  </div>

                  <form onSubmit={handleVerifyLrn} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2 }}>
                      Learner Reference Number (LRN) *
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input 
                        id="register-lrn-input"
                        type="text" 
                        maxLength={12}
                        placeholder="Enter 12-digit DepEd LRN"
                        value={lrnInput}
                        onChange={(e) => {
                          const val = e.target.value.slice(0, 12);
                          setLrnInput(val);
                          if (/[a-zA-Z]/.test(val)) {
                            setLrnCheckError('Student LRN cannot contain letters. Please enter numbers only.');
                          } else if (lrnCheckError) {
                            setLrnCheckError(null);
                          }
                        }}
                        style={{ 
                          flex: 1, padding: '9px 12px', fontSize: 12, 
                          borderRadius: 6, border: `1px solid ${lrnCheckError ? '#ef4444' : C.borderMed}`, 
                          outline: 'none', fontFamily: "'JetBrains Mono', monospace", boxSizing: 'border-box' 
                        }}
                      />
                      <button 
                        id="btn-verify-lrn"
                        type="submit" 
                        disabled={isCheckingLrn}
                        style={{ 
                          padding: '9px 16px', background: C.m700, color: '#ffffff', border: 'none', 
                          borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: isCheckingLrn ? 'not-allowed' : 'pointer', 
                          display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
                        }}
                      >
                        <Shield size={13} />
                        {isCheckingLrn ? 'Verifying...' : 'Verify LRN Locally'}
                      </button>
                    </div>

                    {lrnCheckError && (
                      <div id="register-lrn-error" style={{ fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <AlertCircle size={13} />
                        <span>{lrnCheckError}</span>
                      </div>
                    )}
                  </form>

                  {/* LRN Already Exists Notice */}
                  {lrnExistingMatch && (
                    <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#92400e', fontWeight: 800, fontSize: 12 }}>
                        <AlertTriangle size={15} />
                        <span>Learner Record Already Found in DigiSkwela</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#78350f', lineHeight: 1.45 }}>
                        LRN <strong>{lrnExistingMatch.lrn}</strong> is already registered to <strong>{lrnExistingMatch.lastName || lrnExistingMatch.last_name}, {lrnExistingMatch.firstName || lrnExistingMatch.first_name}</strong>.
                        Please use the <strong>Enroll Existing Learner</strong> option to assign this student without duplicating records.
                      </div>
                      <button
                        type="button"
                        id="btn-switch-to-enroll"
                        onClick={() => handleSwitchToEnrollFromLrnCheck(lrnExistingMatch)}
                        style={{
                          alignSelf: 'flex-start', padding: '6px 14px', fontSize: 11, fontWeight: 700,
                          background: '#d97706', color: '#ffffff', border: 'none', borderRadius: 5,
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5
                        }}
                      >
                        <UserCheck size={13} />
                        Switch to Enroll Existing Learner
                      </button>
                    </div>
                  )}

                  {/* LRN Verified Absent Notice: Proceed to Form */}
                  {lrnVerifiedAbsent && (
                    <div style={{ padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1e40af', fontWeight: 800, fontSize: 12 }}>
                        <CheckCircle size={15} />
                        <span>LRN {formData.lrn} Verified Absent from Local Records</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#1e3a8a', lineHeight: 1.5 }}>
                        <strong>LIS Verification Notice:</strong> Local absence confirms this LRN does not yet exist in this DigiSkwela database. 
                        <em> Note: Local verification does not constitute national DepEd Learner Information System (LIS) verification.</em> Ensure physical PSA birth certificate or Form 137 has been verified.
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <button
                          type="button"
                          id="btn-proceed-to-form"
                          onClick={handleProceedToForm}
                          style={{
                            padding: '8px 16px', fontSize: 12, fontWeight: 700,
                            background: C.m700, color: '#ffffff', border: 'none', borderRadius: 6,
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
                          }}
                        >
                          <span>Proceed to Registration Form</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-step 2: Compact Registration Form */}
              {regStep === 'form' && (
                <form onSubmit={handleReviewRegistration} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Derived Target Section Context Banner */}
                  <div style={{ padding: '8px 12px', background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                    <div>
                      <strong>Target Section:</strong> Grade {grade} — {section} • <strong>Adviser:</strong> {effectiveAdviserName} • <strong>SY:</strong> 2026-2027
                    </div>
                    <button
                      type="button"
                      onClick={() => setRegStep('lrn_check')}
                      style={{ fontSize: 11, color: C.m700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Change LRN ({formData.lrn})
                    </button>
                  </div>

                  {/* Form Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>First Name *</label>
                      <input 
                        id="reg-first-name"
                        type="text" 
                        placeholder="e.g. Crispin"
                        value={formData.firstName}
                        onChange={(e) => {
                          setFormData({ ...formData, firstName: e.target.value });
                          if (fieldErrors.firstName) setFieldErrors(prev => ({ ...prev, firstName: '' }));
                        }}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fieldErrors.firstName ? '#ef4444' : C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                        aria-invalid={Boolean(fieldErrors.firstName)}
                      />
                      {fieldErrors.firstName && (
                        <div id="error-reg-first-name" style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={12} /> {fieldErrors.firstName}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Last Name *</label>
                      <input 
                        id="reg-last-name"
                        type="text" 
                        placeholder="e.g. Sisa"
                        value={formData.lastName}
                        onChange={(e) => {
                          setFormData({ ...formData, lastName: e.target.value });
                          if (fieldErrors.lastName) setFieldErrors(prev => ({ ...prev, lastName: '' }));
                        }}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fieldErrors.lastName ? '#ef4444' : C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                        aria-invalid={Boolean(fieldErrors.lastName)}
                      />
                      {fieldErrors.lastName && (
                        <div id="error-reg-last-name" style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={12} /> {fieldErrors.lastName}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Middle Name</label>
                      <input 
                        id="reg-middle-name"
                        type="text" 
                        placeholder="Optional"
                        value={formData.middleName}
                        onChange={(e) => {
                          setFormData({ ...formData, middleName: e.target.value });
                          if (fieldErrors.middleName) setFieldErrors(prev => ({ ...prev, middleName: '' }));
                        }}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fieldErrors.middleName ? '#ef4444' : C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                        aria-invalid={Boolean(fieldErrors.middleName)}
                      />
                      {fieldErrors.middleName && (
                        <div id="error-reg-middle-name" style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={12} /> {fieldErrors.middleName}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Suffix</label>
                      <input 
                        id="reg-suffix"
                        type="text" 
                        placeholder="Jr., III, etc."
                        value={formData.suffix}
                        onChange={(e) => {
                          setFormData({ ...formData, suffix: e.target.value });
                          if (fieldErrors.suffix) setFieldErrors(prev => ({ ...prev, suffix: '' }));
                        }}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fieldErrors.suffix ? '#ef4444' : C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                        aria-invalid={Boolean(fieldErrors.suffix)}
                      />
                      {fieldErrors.suffix && (
                        <div id="error-reg-suffix" style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={12} /> {fieldErrors.suffix}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Date of Birth *</label>
                      <input 
                        id="reg-dob"
                        type="date" 
                        value={formData.dateOfBirth}
                        onChange={(e) => {
                          setFormData({ ...formData, dateOfBirth: e.target.value });
                          if (fieldErrors.dateOfBirth) setFieldErrors(prev => ({ ...prev, dateOfBirth: '' }));
                        }}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fieldErrors.dateOfBirth ? '#ef4444' : C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                        aria-invalid={Boolean(fieldErrors.dateOfBirth)}
                      />
                      {fieldErrors.dateOfBirth && (
                        <div id="error-reg-dob" style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={12} /> {fieldErrors.dateOfBirth}
                        </div>
                      )}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Recorded Biological Sex *</label>
                      <select 
                        id="reg-gender"
                        value={formData.gender}
                        onChange={(e) => {
                          setFormData({ ...formData, gender: e.target.value });
                          if (fieldErrors.gender) setFieldErrors(prev => ({ ...prev, gender: '' }));
                        }}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fieldErrors.gender ? '#ef4444' : C.borderMed}`, outline: 'none', boxSizing: 'border-box', background: '#ffffff' }}
                        aria-invalid={Boolean(fieldErrors.gender)}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                      {fieldErrors.gender && (
                        <div id="error-reg-gender" style={{ fontSize: 11, color: '#dc2626', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={12} /> {fieldErrors.gender}
                        </div>
                      )}
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Parent / Guardian Details</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        <div>
                          <input 
                            id="reg-guardian-first"
                            type="text" 
                            placeholder="Guardian First Name"
                            value={formData.guardianFirstName}
                            onChange={(e) => {
                              setFormData({ ...formData, guardianFirstName: e.target.value });
                              if (fieldErrors.guardianFirstName) setFieldErrors(prev => ({ ...prev, guardianFirstName: '' }));
                            }}
                            style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fieldErrors.guardianFirstName ? '#ef4444' : C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                            aria-invalid={Boolean(fieldErrors.guardianFirstName)}
                          />
                          {fieldErrors.guardianFirstName && (
                            <div id="error-reg-guardian-first" style={{ fontSize: 10, color: '#dc2626', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <AlertCircle size={11} /> {fieldErrors.guardianFirstName}
                            </div>
                          )}
                        </div>
                        <div>
                          <input 
                            id="reg-guardian-last"
                            type="text" 
                            placeholder="Guardian Last Name"
                            value={formData.guardianLastName}
                            onChange={(e) => {
                              setFormData({ ...formData, guardianLastName: e.target.value });
                              if (fieldErrors.guardianLastName) setFieldErrors(prev => ({ ...prev, guardianLastName: '' }));
                            }}
                            style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fieldErrors.guardianLastName ? '#ef4444' : C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                            aria-invalid={Boolean(fieldErrors.guardianLastName)}
                          />
                          {fieldErrors.guardianLastName && (
                            <div id="error-reg-guardian-last" style={{ fontSize: 10, color: '#dc2626', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <AlertCircle size={11} /> {fieldErrors.guardianLastName}
                            </div>
                          )}
                        </div>
                        <div>
                          <input 
                            id="reg-guardian-phone"
                            type="tel" 
                            placeholder="0917 123 4567"
                            value={formData.guardianPhone}
                            onChange={(e) => {
                              setFormData({ ...formData, guardianPhone: e.target.value });
                              if (fieldErrors.guardianPhone) setFieldErrors(prev => ({ ...prev, guardianPhone: '' }));
                            }}
                            style={{ width: '100%', padding: '8px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${fieldErrors.guardianPhone ? '#f87171' : C.borderMed}`, outline: 'none', boxSizing: 'border-box' }}
                            aria-invalid={Boolean(fieldErrors.guardianPhone)}
                          />
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Philippine mobile number · 10 digits after +63</div>
                          {fieldErrors.guardianPhone && (
                            <div id="error-reg-guardian-phone" style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>
                              {fieldErrors.guardianPhone}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setRegStep('lrn_check')}
                      style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.t2, background: '#ffffff', border: `1px solid ${C.borderMed}`, borderRadius: 6, cursor: 'pointer' }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      id="btn-review-registration"
                      style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, color: '#ffffff', background: C.m700, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Review Registration Details →
                    </button>
                  </div>
                </form>
              )}

              {/* Sub-step 3: Concise Review Before Final Submission */}
              {regStep === 'review' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>
                    Review Registration & Section Enrollment
                  </div>

                  <div style={{ padding: 14, background: '#f8fafc', border: `1px solid ${C.border}`, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 4 }}>
                      <span style={{ color: C.t3, fontWeight: 600 }}>Learner Name:</span>
                      <strong style={{ color: C.t1 }}>{formData.lastName}, {formData.firstName} {formData.middleName || ''} {formData.suffix || ''}</strong>
                      
                      <span style={{ color: C.t3, fontWeight: 600 }}>12-Digit LRN:</span>
                      <strong style={{ color: C.t1, fontFamily: "'JetBrains Mono', monospace" }}>{formData.lrn}</strong>

                      <span style={{ color: C.t3, fontWeight: 600 }}>Biological Sex:</span>
                      <span>{formData.gender}</span>

                      <span style={{ color: C.t3, fontWeight: 600 }}>Date of Birth:</span>
                      <span>{formData.dateOfBirth}</span>

                      <span style={{ color: C.t3, fontWeight: 600 }}>Target Section:</span>
                      <strong style={{ color: C.m700 }}>Grade {grade} — {section}</strong>

                      <span style={{ color: C.t3, fontWeight: 600 }}>Class Adviser:</span>
                      <span>{effectiveAdviserName}</span>

                      <span style={{ color: C.t3, fontWeight: 600 }}>Academic Year:</span>
                      <span>SY 2026-2027</span>

                      <span style={{ color: C.t3, fontWeight: 600 }}>Parent / Guardian:</span>
                      <span>{formData.guardianFirstName || ''} {formData.guardianLastName || ''} {formData.guardianPhone ? `(${formData.guardianPhone})` : ''}</span>
                    </div>

                    <div style={{ marginTop: 6, paddingTop: 8, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.t3 }}>
                      <strong>Provisioning Note:</strong> Under Approach A, learner profile and advisory enrollment will be created with <code>Student.user_id = null</code>. No portal credentials will be generated until official IT Admin provisioning.
                    </div>
                  </div>

                  {regSubmitError && (
                    <div style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: 6 }}>
                      {regSubmitError}
                    </div>
                  )}

                  {regSuccess ? (
                    <div style={{ padding: 10, background: '#dcfce7', color: '#15803d', borderRadius: 6, fontSize: 12, textAlign: 'center', fontWeight: 700 }}>
                      ✓ Learner registered and enrolled into Grade {grade} - {section} successfully!
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        type="button"
                        id="btn-back-to-edit"
                        onClick={() => setRegStep('form')}
                        disabled={isRegistering}
                        style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.t2, background: '#ffffff', border: `1px solid ${C.borderMed}`, borderRadius: 6, cursor: isRegistering ? 'not-allowed' : 'pointer' }}
                      >
                        ← Edit Details
                      </button>
                      <button
                        type="button"
                        id="btn-confirm-register"
                        onClick={handleConfirmRegisterAndEnroll}
                        disabled={isRegistering}
                        style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, color: '#ffffff', background: C.m700, border: 'none', borderRadius: 6, cursor: isRegistering ? 'not-allowed' : 'pointer' }}
                      >
                        {isRegistering ? 'Registering...' : 'Confirm & Register Learner'}
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
