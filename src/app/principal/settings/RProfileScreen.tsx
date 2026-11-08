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
  Building,
  School,
  FileText
} from 'lucide-react';
import { useAppContext } from '../../shared/AppContext';
import { apiClient } from '../../../api/client';
import { authApi } from '../../../api/auth.api';

export function RProfileScreen() {
  const { currentUser, setCurrentUser } = useAppContext();

  // Profile Information Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [email, setEmail] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [permissionsCount, setPermissionsCount] = useState<number>(7);

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
        setSchoolId(me.schoolId || 'REG-2026-001');
        setRoles(me.roles || ['Registrar']);
        setPermissionsCount(me.permissions?.length || 7);
      }
    } catch (err: any) {
      console.error('Failed to load registrar profile', err);
      if (currentUser) {
        setFirstName(currentUser.firstName || currentUser.name?.split(' ')[0] || 'Corazon');
        setLastName(currentUser.lastName || currentUser.name?.split(' ').slice(1).join(' ') || 'Pineda');
        setMiddleName(currentUser.middleName || '');
        setEmail(currentUser.email || 'registrar.qa@example.test');
        setSchoolId(currentUser.schoolId || 'EMP-QA-R01');
        setRoles(['Registrar']);
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

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
      const targetId = currentUser?.id || 'demo-registrar';
      await apiClient.patch<any>(`/users/${targetId}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        middleName: middleName.trim() || undefined,
      });

      if (currentUser && setCurrentUser) {
        setCurrentUser({
          ...currentUser,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          name: `${firstName.trim()} ${lastName.trim()}`,
        });
      }

      setProfileSuccess('Profile details updated successfully.');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setProfileError(err?.message || 'Failed to update profile information.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword, confirmPassword });
      setPasswordSuccess('Password changed successfully! Keep your credentials secure.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: any) {
      console.error(err);
      setPasswordError(err?.message || 'Failed to change password. Please verify your current password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto", paddingBottom: 100, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Header */}
        <div style={{ borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.m700, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            <School size={16} /> Calulut Integrated School (DepEd School ID: 500146)
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: 0 }}>
            My Profile
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.t3, lineHeight: 1.5 }}>
            Manage your registrar profile, contact details, and account security settings.
          </p>
        </div>

        {/* Identity Overview Banner */}
        <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: C.m50, color: C.m700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, border: `1px solid ${C.borderMed}` }}>
              {firstName?.[0] || 'R'}{lastName?.[0] || 'O'}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>
                {firstName || 'Registrar'} {lastName || 'Officer'}
              </div>
              <div style={{ fontSize: 12, color: C.t2, marginTop: 4, display: "flex", gap: 16 }}>
                <span><strong>Employee ID:</strong> {schoolId}</span>
                <span><strong>Office:</strong> Admissions and Academic Records</span>
                <span><strong>Authority:</strong> Student Enrollment and Permanent Records (SF10)</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.m700, background: C.m50, padding: "6px 12px", borderRadius: 20, border: `1px solid ${C.borderMed}` }}>
              Role: Registrar
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: C.greenBg, padding: "6px 12px", borderRadius: 20, border: `1px solid ${C.green}40` }}>
              Active Session
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          
          {/* Profile Form */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 12 }}>
              <User size={18} color={C.m700} />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.t1, margin: 0 }}>Personal Information</h2>
            </div>

            {profileSuccess && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: C.greenBg, color: C.green, borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                <CheckCircle size={16} /> {profileSuccess}
              </div>
            )}
            {profileError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: C.redBg, color: C.red, borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                <AlertCircle size={16} /> {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Middle Name (Optional)</label>
                <input
                  type="text"
                  value={middleName}
                  onChange={e => setMiddleName(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Official Email (Immutable)</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, fontSize: 13, background: C.paper, color: C.t3, outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                style={{
                  marginTop: 6, padding: "10px 18px", borderRadius: 8, background: C.m800, color: "#fff",
                  border: "none", fontSize: 13, fontWeight: 700, cursor: savingProfile ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                }}
              >
                <Save size={14} /> {savingProfile ? "Saving..." : "Save Profile Details"}
              </button>
            </form>
          </div>

          {/* Password Security Form */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 12 }}>
              <KeyRound size={18} color={C.m700} />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.t1, margin: 0 }}>Security & Password</h2>
            </div>

            {passwordSuccess && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: C.greenBg, color: C.green, borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                <CheckCircle size={16} /> {passwordSuccess}
              </div>
            )}
            {passwordError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: C.redBg, color: C.red, borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                <AlertCircle size={16} /> {passwordError}
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>New Password (min 8 characters)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderMed}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                style={{
                  marginTop: 6, padding: "10px 18px", borderRadius: 8, background: "#1e3a8a", color: "#fff",
                  border: "none", fontSize: 13, fontWeight: 700, cursor: savingPassword ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                }}
              >
                <Lock size={14} /> {savingPassword ? "Updating Password..." : "Update Password"}
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}

