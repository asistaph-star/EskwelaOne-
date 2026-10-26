import React, { useState } from "react";
import { Lock, KeyRound, ShieldAlert, CheckCircle2, Eye, EyeOff, LogOut, ArrowRight } from "lucide-react";
import { C } from "../shared/constants/tokens";
import { authApi } from "../../api/auth.api";
import { useAppContext } from "../shared/AppContext";

interface ChangePasswordScreenProps {
  onLogout: () => void;
  onSuccess: () => void;
}

export function ChangePasswordScreen({ onLogout, onSuccess }: ChangePasswordScreenProps) {
  const { currentUser } = useAppContext();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Please enter your current temporary password.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setError("Your new password must be different from your current temporary password.");
      return;
    }

    setLoading(true);

    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      onSuccess();
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.message || "Failed to update password. Please verify your current password.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      width: "100vw",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
      background: `linear-gradient(135deg, rgba(10,25,47,1) 0%, rgba(2,6,23,1) 100%)`,
      padding: 24,
      boxSizing: "border-box",
      position: "relative",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 480,
        background: "#ffffff",
        borderRadius: 16,
        padding: "36px 36px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
        boxSizing: "border-box",
        animation: "fadeIn 0.25s ease-out",
      }}>
        {/* Top Icon Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: C.m100,
            color: C.m700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}>
            <KeyRound size={24} />
          </div>
          <div>
            <h1 style={{
              fontSize: 20,
              fontWeight: 800,
              color: C.t1,
              fontFamily: "'Fraunces', serif",
              margin: 0,
              lineHeight: 1.2
            }}>
              Change Your Temporary Password
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: C.t3 }}>
              Mandatory Security Requirement
            </p>
          </div>
        </div>

        {/* Informational Notice */}
        <div style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          padding: "12px 14px",
          borderRadius: 8,
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-start",
          gap: 10
        }}>
          <ShieldAlert size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.5 }}>
            For security, you must replace your administrator-assigned temporary password with a private password before accessing your DigiSkwela portal.
          </div>
        </div>

        {/* User Identity Pill */}
        {currentUser && (
          <div style={{
            background: C.paper,
            border: `1px solid ${C.borderMed}`,
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            color: C.t2
          }}>
            <span>Logged in as: <strong>{currentUser.name}</strong></span>
            <span style={{
              background: C.m100,
              color: C.m800,
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700
            }}>
              {currentUser.role}
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{
            background: C.redBg,
            border: `1px solid ${C.red}40`,
            color: C.red,
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 12.5,
            fontWeight: 600
          }}>
            {error}
          </div>
        )}

        {/* Password Change Form */}
        <form onSubmit={handleSubmit}>
          {/* Current Temporary Password */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
              Current Temporary Password *
            </label>
            <div style={{ position: "relative" }}>
              <input
                required
                type={showCurrent ? "text" : "password"}
                placeholder="Enter current temporary password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 38px 10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  outline: "none"
                }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: C.t3
                }}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
              New Password (minimum 8 characters) *
            </label>
            <div style={{ position: "relative" }}>
              <input
                required
                type={showNew ? "text" : "password"}
                placeholder="Create new permanent password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 38px 10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  outline: "none"
                }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: C.t3
                }}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: C.t2, marginBottom: 6 }}>
              Confirm New Password *
            </label>
            <div style={{ position: "relative" }}>
              <input
                required
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm new permanent password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 38px 10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  outline: "none"
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: C.t3
                }}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 18px",
                background: C.m800,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {loading ? "Updating Password..." : "Change Password & Continue"}
                {!loading && <ArrowRight size={16} />}
              </span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              style={{
                width: "100%",
                padding: "10px 16px",
                background: "transparent",
                color: C.t3,
                border: "none",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6
              }}
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
