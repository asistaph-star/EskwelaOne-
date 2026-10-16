import React, { useState, useEffect } from 'react';
import { ScanLine, ShieldCheck, CheckCircle2, AlertCircle, ExternalLink, QrCode, Monitor } from 'lucide-react';
import { apiClient } from '../../../api/client';

export function GateTerminalsManagement() {
  const [currentRole, setCurrentRole] = useState<'student' | 'faculty'>('student');
  const [selectedRole, setSelectedRole] = useState<'student' | 'faculty'>('student');
  const [adminPassword, setAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('digiskwela_station_terminal_type')?.toLowerCase();
      if (stored === 'faculty' || stored === 'student') {
        setCurrentRole(stored);
        setSelectedRole(stored);
        return;
      }
    }
    const envRole = ((import.meta as any).env?.VITE_GATE_TERMINAL_TYPE || 'student').toLowerCase();
    const resolved = envRole === 'faculty' ? 'faculty' : 'student';
    setCurrentRole(resolved);
    setSelectedRole(resolved);
  }, []);

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    try {
      // Reconfigure requires Admin credential challenge per DigiSkwela security policy
      await apiClient.post('/attendance/gate/terminal/reconfigure', {
        email: 'admin@demo.com',
        password: adminPassword,
        terminalType: selectedRole,
      });

      localStorage.setItem('digiskwela_station_terminal_type', selectedRole);
      setCurrentRole(selectedRole);
      setAdminPassword('');
      setFeedback({
        type: 'success',
        message: `Station successfully locked as ${selectedRole === 'faculty' ? 'Faculty Terminal (Faculty Only)' : 'Student Terminal (Students Only)'}.`,
      });
    } catch (err: any) {
      const message = err?.error?.message || err?.message || 'Failed to reconfigure station. Verify administrator credentials.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Title & Introduction */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ScanLine className="text-blue-600" size={28} />
          Attendance Gate Terminals Configuration
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Centrally manage physical kiosk station roles, hardware endpoints, and scanner credential policies.
        </p>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm font-medium ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
          ) : (
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Configuration Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">This Device Station Assignment</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure the dedicated role for this machine when running the Gate Attendance app.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Active Deployment:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
              currentRole === 'faculty'
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}>
              {currentRole === 'faculty' ? 'Faculty Terminal' : 'Student Terminal'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveConfiguration} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Student Terminal Option */}
            <label className={`relative flex flex-col p-5 rounded-xl border-2 cursor-pointer transition ${
              selectedRole === 'student'
                ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <input
                    type="radio"
                    name="terminalType"
                    value="student"
                    checked={selectedRole === 'student'}
                    onChange={() => setSelectedRole('student')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Student Terminal</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                  Students Only
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Connects strictly to <code className="text-blue-700 font-mono">/api/attendance/gate/student/scan</code>.
                Accepts 12-digit Student LRNs. Rejects teacher credentials.
              </p>
            </label>

            {/* Faculty Terminal Option */}
            <label className={`relative flex flex-col p-5 rounded-xl border-2 cursor-pointer transition ${
              selectedRole === 'faculty'
                ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <input
                    type="radio"
                    name="terminalType"
                    value="faculty"
                    checked={selectedRole === 'faculty'}
                    onChange={() => setSelectedRole('faculty')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Faculty Terminal</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  Faculty Only
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Connects strictly to <code className="text-indigo-700 font-mono">/api/attendance/gate/faculty/scan</code>.
                Accepts TeacherScanCredentials (EMP-T-001). Rejects student LRNs.
              </p>
            </label>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-md space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase">
              <ShieldCheck size={16} className="text-slate-500" />
              <span>Admin Confirmation</span>
            </div>
            <div>
              <label className="block text-xs text-slate-600 font-medium mb-1">
                Enter Administrator Password (<code className="text-slate-500">admin@demo.com</code>):
              </label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="password123"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Saving Configuration...' : 'Save & Lock Station Assignment'}
            </button>
          </div>
        </form>
      </div>

      {/* Integration Assets & Diagnostic Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <QrCode size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Student Test QR (Juan Dela Cruz)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                LRN payload: <code className="font-mono text-slate-700">123456789012</code>
              </p>
            </div>
          </div>
          <a
            href="/test_student_qr.png"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <span>Open Student QR</span>
            <ExternalLink size={14} />
          </a>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <QrCode size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Faculty Test QR (Maria Clara)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Credential payload: <code className="font-mono text-slate-700">EMP-T-001</code>
              </p>
            </div>
          </div>
          <a
            href="/test_faculty_qr.png"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <span>Open Faculty QR</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
