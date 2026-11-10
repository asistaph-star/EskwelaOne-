import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import {
  User,
  Shield,
  Calendar,
  School,
  Heart,
  Mail,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Lock,
  Sparkles,
  Building,
  UserCheck,
  Stethoscope
} from 'lucide-react';
import { Stamp } from '../../shared/components/Stamp';
import { SScreen } from '../shared/SSidebar';
import { apiClient } from '../../../api/client';

export function StudentProfileScreen({ currentUser, setTab }: {
  currentUser: any;
  setTab: (tab: SScreen) => void;
}) {
  const [detailedUser, setDetailedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If currentUser is present, optionally refresh own user record from /api/users/:id
    if (currentUser?.id) {
      setLoading(true);
      apiClient.get<any>(`/users/${currentUser.id}`)
        .then(res => {
          const data = res?.data || res;
          setDetailedUser(data);
        })
        .catch(err => {
          console.warn('Could not fetch extra profile details, using session data', err);
        })
        .finally(() => setLoading(false));
    }
  }, [currentUser?.id]);

  const profile = detailedUser?.student || currentUser?.studentProfile || {};
  const user = detailedUser || currentUser || {};

  const nameParts = [
    user?.first_name || user?.firstName,
    user?.middle_name || user?.middleName,
    user?.last_name || user?.lastName
  ].filter(Boolean);
  const fullName = nameParts.length > 0 ? nameParts.join(' ') : (user?.name || 'Enrolled Student');
  const lrn = profile?.lrn || currentUser?.lrn || currentUser?.schoolId || '—';
  const schoolId = user?.school_id || user?.schoolId || '—';
  const sectionName = profile?.sectionName || profile?.current_section?.name || currentUser?.studentProfile?.sectionName || '—';
  const gradeLevel = profile?.gradeLevel || profile?.grade_level || (profile?.current_section?.grade_level ? `Grade ${profile.current_section.grade_level}` : '—');
  const adviserName = profile?.adviserName || (profile?.current_section?.adviser_teacher?.user
    ? `${profile.current_section.adviser_teacher.user.first_name} ${profile.current_section.adviser_teacher.user.last_name}`
    : (currentUser?.studentProfile?.adviserName || '—'));
  const academicYear = profile?.academicYear || currentUser?.studentProfile?.academicYear || 'SY 2026-2027';

  const dobRaw = profile?.dateOfBirth || profile?.date_of_birth || profile?.dob;
  let formattedDob = '—';
  let calculatedAge: number | string = '—';
  if (dobRaw) {
    try {
      const d = new Date(dobRaw);
      if (!isNaN(d.getTime())) {
        formattedDob = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const ageDiffMs = Date.now() - d.getTime();
        const ageDate = new Date(ageDiffMs);
        calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);
      }
    } catch {
      // Keep default
    }
  }

  const gender = profile?.gender || user?.gender || '—';
  const bloodType = profile?.bloodType || profile?.blood_type || '—';
  const allergies = profile?.allergies || 'None Recorded';
  const medicalConditions = profile?.medicalConditions || profile?.medical_conditions || 'None Recorded';

  const guardianFirst = profile?.guardianFirstName || profile?.guardian_first_name || '';
  const guardianLast = profile?.guardianLastName || profile?.guardian_last_name || '';
  const guardianFullName = [guardianFirst, guardianLast].filter(Boolean).join(' ') || profile?.guardianName || '—';
  const guardianPhone = profile?.guardianPhone || profile?.guardian_phone || '—';
  const guardianEmail = profile?.guardianEmail || profile?.guardian_email || '—';

  const addressParts = [
    profile?.street,
    profile?.city,
    profile?.stateProvince || profile?.state_province,
    profile?.zipCode || profile?.zip_code
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : '—';

  return (
    <div id="student-personal-records-view" style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100, margin: '0 auto', animation: 'fadeIn 0.25s ease-out' }}>
      
      {/* DepEd SF1 Official Header Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${C.m900} 0%, ${C.m800} 100%)`,
        borderRadius: 12,
        padding: '24px 28px',
        color: '#fff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: 'rgba(255,255,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid rgba(255,255,255,0.2)',
            flexShrink: 0
          }}>
            <UserCheck size={28} color={C.gold} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Department of Education, School Form 1 (SF1)
              </span>
              <Stamp label="Official Learner Record" color="#10b981" bg="rgba(16, 185, 129, 0.2)" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 2px 0', fontFamily: "'Fraunces', serif" }}>
              {fullName}
            </h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>LRN: <strong style={{ color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{lrn}</strong></span>
              <span>&bull;</span>
              <span>Portal ID: <strong style={{ color: '#fff' }}>{schoolId}</strong></span>
              <span>&bull;</span>
              <span>Calulut Integrated School</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            id="btn-goto-doc-requests"
            onClick={() => setTab('doc-requests')}
            style={{
              padding: '9px 16px',
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 6,
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          >
            <FileText size={14} /> Request Document or Correction
          </button>
          <button
            id="btn-goto-academics"
            onClick={() => setTab('academics')}
            style={{
              padding: '9px 16px',
              background: C.gold,
              border: 'none',
              borderRadius: 6,
              color: '#0f172a',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <ExternalLink size={14} /> View Grades &amp; SF9
          </button>
        </div>
      </div>

      {/* Grid of Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        
        {/* Section 1: Official DepEd Identity & Demographics */}
        <div style={{
          background: '#fff',
          borderRadius: 10,
          border: `1.5px solid ${C.borderMed}`,
          padding: '20px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: C.m50, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.m700 }}>
              <User size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: C.t1 }}>Learner Identification</h3>
              <span style={{ fontSize: 10.5, color: C.t3 }}>Official DepEd DO 54, s. 2016 Learner Data</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Learner Reference Number (LRN)</span>
              <strong style={{ fontSize: 13, color: C.m700, fontFamily: "'JetBrains Mono', monospace" }}>{lrn}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>School ID</span>
              <strong style={{ fontSize: 12.5, color: C.t1 }}>{schoolId}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Date of Birth</span>
              <strong style={{ fontSize: 12.5, color: C.t1 }}>{formattedDob}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Current Age</span>
              <strong style={{ fontSize: 12.5, color: C.t1 }}>{calculatedAge} years old</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Sex</span>
              <strong style={{ fontSize: 12.5, color: C.t1 }}>{gender}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>DepEd Verification</span>
              <Stamp label="Verified in LIS" color="#059669" bg="#ecfdf5" />
            </div>
          </div>
        </div>

        {/* Section 2: Active Advisory Placement */}
        <div style={{
          background: '#fff',
          borderRadius: 10,
          border: `1.5px solid ${C.borderMed}`,
          padding: '20px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <School size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: C.t1 }}>Advisory Enrollment</h3>
              <span style={{ fontSize: 10.5, color: C.t3 }}>Current Academic Year Placement</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>School Year</span>
              <strong style={{ fontSize: 12.5, color: C.t1 }}>{academicYear}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Grade Level</span>
              <strong style={{ fontSize: 12.5, color: C.t1 }}>Grade {gradeLevel}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Assigned Section</span>
              <strong style={{ fontSize: 13, color: '#2563eb' }}>{sectionName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Designated Class Adviser</span>
              <strong style={{ fontSize: 12.5, color: C.t1 }}>{adviserName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Enrollment Standing</span>
              <Stamp label="Officially Enrolled" color="#059669" bg="#ecfdf5" />
            </div>
          </div>
        </div>

        {/* Section 3: Parent & Guardian Contact Information */}
        <div style={{
          background: '#fff',
          borderRadius: 10,
          border: `1.5px solid ${C.borderMed}`,
          padding: '20px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
              <Mail size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: C.t1 }}>Parent or Guardian and Residence</h3>
              <span style={{ fontSize: 10.5, color: C.t3 }}>Authorized Emergency Contacts</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Parent or Guardian Name</span>
              <strong style={{ fontSize: 12.5, color: C.t1 }}>{guardianFullName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Emergency Contact Phone</span>
              <strong style={{ fontSize: 12.5, color: C.t1, fontFamily: "'JetBrains Mono', monospace" }}>{guardianPhone}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Parent or Guardian Email</span>
              <strong style={{ fontSize: 12, color: C.t1 }}>{guardianEmail}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Permanent Residential Address</span>
              <div style={{ fontSize: 12, color: C.t1, fontWeight: 600, lineHeight: 1.4, background: C.paper, padding: '8px 12px', borderRadius: 6, border: `1px solid ${C.borderMed}` }}>
                <MapPin size={12} style={{ display: 'inline', marginRight: 4, color: C.m700 }} />
                {fullAddress}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Baseline Health & Clinic Record */}
        <div style={{
          background: '#fff',
          borderRadius: 10,
          border: `1.5px solid ${C.borderMed}`,
          padding: '20px 24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: `1px solid ${C.border}`, paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }}>
                <Stethoscope size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: C.t1 }}>Baseline Health Profile</h3>
                <span style={{ fontSize: 10.5, color: C.t3 }}>DepEd SF8 Nutritional &amp; Clinic Baseline</span>
              </div>
            </div>
            <button
              onClick={() => setTab('clinic')}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.m700,
                background: C.m50,
                border: `1px solid ${C.m700}30`,
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              Full Clinic Log &rarr;
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Blood Type</span>
              <strong style={{ fontSize: 13, color: '#dc2626', fontWeight: 800 }}>{bloodType}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Documented Allergies</span>
              <strong style={{ fontSize: 12.5, color: allergies !== 'None' && allergies !== 'None logged' ? '#b45309' : C.t1 }}>
                {allergies}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Medical Conditions</span>
              <strong style={{ fontSize: 12.5, color: medicalConditions !== 'None' && medicalConditions !== 'None logged' ? '#0369a1' : C.t1 }}>
                {medicalConditions}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.t2 }}>Clinic Clearance Status</span>
              <Stamp label="Clearance Active" color="#059669" bg="#ecfdf5" />
            </div>
          </div>
        </div>

      </div>

      {/* DepEd DO 11, s. 2018 Compliance Notice Card */}
      <div style={{
        background: '#fff',
        borderRadius: 10,
        border: `1px solid ${C.borderMed}`,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
      }}>
        <Shield size={22} color={C.m700} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px 0', color: C.t1 }}>
            DepEd DO 11, s. 2018 &amp; RA 10173 Institutional Data Governance
          </h4>
          <p style={{ fontSize: 11.5, color: C.t2, margin: 0, lineHeight: 1.5 }}>
            This authoritative learner record is protected by Republic Act No. 10173 (Data Privacy Act of 2012) and Department of Education policies. Demographic fields (LRN, legal name, birthdate, and advisory placement) are maintained and certified by the <strong>Calulut Integrated School Registrar</strong>. To request corrections or update legal documentation, please submit a request through the <strong>Request Documents</strong> module or contact the Registrar Office.
          </p>
        </div>
      </div>

    </div>
  );
}
