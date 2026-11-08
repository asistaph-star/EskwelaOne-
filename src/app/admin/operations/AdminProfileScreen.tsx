import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import {
  User,
  Shield,
  KeyRound,
  CheckCircle,
  AlertCircle,
  Save,
  Lock,
  Mail,
  ShieldCheck,
  Activity,
  Layers,
  Sparkles,
  Building
} from 'lucide-react';
import { useAppContext } from '../../shared/AppContext';
import { apiClient } from '../../../api/client';
import { authApi } from '../../../api/auth.api';

export function AdminProfileScreen() {
  const { currentUser, setCurrentUser } = useAppContext();

  // Profile Information Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [email, setEmail] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [permissionsCount, setPermissionsCount] = useState<number>(0);

  // Status & Feedback
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Load authoritative user profile from /api/auth/me
  const loadProfile = async () => {
    setLoadingProfile(true);
    setProfileError(null);
    try {
      const res = await apiClient.get<any>('/auth/me');
      const me = res?.data || res;
      if (me) {
        setFirstName(me.firstName || '');
        setLastName(me.lastName || '');
        setMiddleName(me.middleName || '');
        setEmail(me.email || '');
        setSchoolId(me.schoolId || 'ADM-001');
        setRoles(me.roles || ['Admin']);
        setPermissionsCount(me.permissions?.length || 0);
      }
    } catch (err: any) {
      console.error('Failed to load admin profile', err);
      // Fallback to session currentUser
      if (currentUser) {
        setFirstName(currentUser.firstName || currentUser.name?.split(' ')[0] || '');
        setLastName(currentUser.lastName || currentUser.name?.split(' ').slice(1).join(' ') || '');
        setMiddleName(currentUser.middleName || '');
        setEmail(currentUser.email || '');
        setSchoolId(currentUser.schoolId || 'ADM-001');
        setRoles(currentUser.roles || [currentUser.role || 'Admin']);
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Handle Profile Update (Name & Email)
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('First Name and Last Name are required.');
      return;
    }

    setSavingProfile(true);
    try {
      const targetId = currentUser?.id || 'demo-admin-1';
      const updated = await apiClient.patch<any>(`/users/${targetId}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || undefined,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_name: middleName.trim() || undefined,
      });

      setProfileSuccess('Profile details successfully updated and saved to system records.');
      // Update global context
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName: middleName.trim() || null,
          name: `${firstName.trim()} ${lastName.trim()}`,
        });
      }
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to update profile details.';
      setProfileError(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please provide your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation password do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password.');
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setPasswordSuccess('Password successfully updated. Your new credentials are active.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to update password. Please check your current password.';
      setPasswordError(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div id="admin-profile-screen" style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.2s ease-out' }}>
      
      {/* Header Banner */}
      <div style={{
        background: `linear-gradient(135deg, ${C.m800} 0%, #0f172a 100%)`,
        borderRadius: 12,
        padding: '24px 28px',
        color: '#fff',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(255,255,255,0.25)',
            fontSize: 20,
            fontWeight: 800,
            color: C.gold,
            flexShrink: 0
          }}>
            {firstName ? firstName[0] + (lastName ? lastName[0] : '') : 'AD'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Calulut Integrated School
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 12 }}>
                Active Session
              </span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 2px 0', fontFamily: "'Fraunces', serif" }}>
              {firstName} {lastName}
            </h1>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span>School ID: <strong style={{ color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{schoolId}</strong></span>
              <span>&bull;</span>
              <span>Primary Role: <strong style={{ color: '#fff' }}>{roles.join(', ') || 'System Administrator'}</strong></span>
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          padding: '10px 16px',
          textAlign: 'right'
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security Clearance</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} color="#10b981" /> Full Operations Access
          </div>
        </div>
      </div>

      {/* Main 2-Column Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        
        {/* Column 1: Personal Profile Details Form */}
        <div style={{
          background: '#fff',
          borderRadius: 10,
          border: `1.5px solid ${C.borderMed}`,
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: C.m50, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.m700 }}>
              <User size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: C.t1 }}>Personal Account Details</h3>
              <span style={{ fontSize: 11, color: C.t3 }}>Update your administrative staff identity</span>
            </div>
          </div>

          {profileSuccess && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} color="#059669" /> {profileSuccess}
            </div>
          )}

          {profileError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} color="#dc2626" /> {profileError}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                School ID
              </label>
              <input
                type="text"
                value={schoolId}
                disabled
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.borderMed}`,
                  background: '#f8fafc',
                  color: C.t2,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 12.5,
                  cursor: 'not-allowed',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: 10, color: C.t3, marginTop: 4, display: 'block' }}>
                Assigned by the school administration and cannot be modified.
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                  First Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="admin-profile-first-name"
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: `1px solid ${C.borderMed}`,
                    fontSize: 13,
                    color: C.t1,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                  Last Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="admin-profile-last-name"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: `1px solid ${C.borderMed}`,
                    fontSize: 13,
                    color: C.t1,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                Middle Name (Optional)
              </label>
              <input
                id="admin-profile-middle-name"
                type="text"
                value={middleName}
                onChange={e => setMiddleName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  color: C.t1,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                Official Email Address
              </label>
              <input
                id="admin-profile-email"
                type="email"
                value={email}
                disabled
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.borderMed}`,
                  background: '#f8fafc',
                  fontSize: 13,
                  color: C.t2,
                  outline: 'none',
                  cursor: 'not-allowed',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: 10, color: C.t3, marginTop: 4, display: 'block' }}>
                Primary institutional email. Managed by School IT Administrator.
              </span>
            </div>

            <div style={{ marginTop: 8 }}>
              <button
                id="btn-save-admin-profile"
                type="submit"
                disabled={savingProfile}
                style={{
                  padding: '10px 20px',
                  background: C.m700,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: savingProfile ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: savingProfile ? 0.7 : 1,
                  transition: 'background 0.2s'
                }}
              >
                <Save size={15} /> {savingProfile ? 'Saving Changes...' : 'Save Profile Details'}
              </button>
            </div>
          </form>
        </div>

        {/* Column 2: Security & Password Management */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div style={{
            background: '#fff',
            borderRadius: 10,
            border: `1.5px solid ${C.borderMed}`,
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: `1px solid ${C.border}`, paddingBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b45309' }}>
                <KeyRound size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: C.t1 }}>Security &amp; Credentials</h3>
                <span style={{ fontSize: 11, color: C.t3 }}>Change portal password</span>
              </div>
            </div>

            {passwordSuccess && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} color="#059669" /> {passwordSuccess}
              </div>
            )}

            {passwordError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={16} color="#dc2626" /> {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                  Current Password <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="admin-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: `1px solid ${C.borderMed}`,
                    fontSize: 13,
                    color: C.t1,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                  New Password <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="admin-new-password"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  placeholder="At least 8 characters"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: `1px solid ${C.borderMed}`,
                    fontSize: 13,
                    color: C.t1,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
                  Confirm New Password <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="admin-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter new password"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: `1px solid ${C.borderMed}`,
                    fontSize: 13,
                    color: C.t1,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginTop: 8 }}>
                <button
                  id="btn-update-admin-password"
                  type="submit"
                  disabled={savingPassword}
                  style={{
                    padding: '10px 20px',
                    background: '#0f172a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: savingPassword ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: savingPassword ? 0.7 : 1,
                    transition: 'background 0.2s'
                  }}
                >
                  <Lock size={15} /> {savingPassword ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Quick System Info Badge */}
          <div style={{
            background: '#fff',
            borderRadius: 10,
            border: `1px solid ${C.borderMed}`,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14
          }}>
            <Shield size={24} color={C.m700} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 11.5, color: C.t2, lineHeight: 1.5 }}>
              Administrative actions taken on this account are permanently recorded in the <strong>Audit Trail</strong> under Republic Act No. 10173 and DepEd DO 11, s. 2018.
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
