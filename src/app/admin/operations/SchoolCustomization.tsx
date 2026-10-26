import React, { useState, useEffect, useRef } from "react";
import {
  Building2,
  Palette,
  Image as ImageIcon,
  FileText,
  Save,
  RotateCcw,
  Eye,
  Upload,
  CheckCircle2,
  AlertCircle,
  Lock,
  Sparkles,
  X,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { useAppContext } from "../../shared/AppContext";
import { useSchoolSettings } from "../../shared/context/SchoolSettingsContext";
import { settingsApi, SchoolSettingsData } from "../../../api/settings.api";

export function SchoolCustomization() {
  const { currentUser } = useAppContext();
  const { settings, updateSettings, resetSettings } = useSchoolSettings();

  const isITAdmin =
    currentUser?.rawRoles?.includes("ITAdmin") || currentUser?.role === "ITAdmin";

  const [formData, setFormData] = useState<SchoolSettingsData>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Synchronize form when external settings update
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleInputChange = (field: keyof SchoolSettingsData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType: "logo" | "favicon" | "background",
    field: keyof SchoolSettingsData
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(assetType);
    try {
      const res = await settingsApi.uploadAsset(file, assetType);
      handleInputChange(field, res.url);
      showToast(`${assetType.charAt(0).toUpperCase() + assetType.slice(1)} asset uploaded successfully.`);
    } catch (err: any) {
      showToast(err.message || `Failed to upload ${assetType}`, "error");
    } finally {
      setUploadingField(null);
      e.target.value = "";
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isITAdmin) return;

    setIsSaving(true);
    try {
      await updateSettings(formData);
      showToast("School customization settings saved successfully.");
    } catch (err: any) {
      showToast(err.message || "Failed to save school settings.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!isITAdmin) return;

    setIsSaving(true);
    try {
      const res = await resetSettings();
      setFormData(res);
      setResetModalOpen(false);
      showToast("Default visual branding restored successfully.");
    } catch (err: any) {
      showToast(err.message || "Failed to reset school settings.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1040, margin: "0 auto", boxSizing: "border-box" }}>
      {/* Toast Feedback */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 20px",
            borderRadius: 8,
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            background: toast.type === "success" ? "#065f46" : "#991b1b",
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.m900, margin: "0 0 6px" }}>
              School Customization
            </h1>
            <p style={{ fontSize: 13, color: C.t2, margin: 0 }}>
              Configure institutional visual identity, colors, and branding across DigiSkwela.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 8,
                background: "#ffffff",
                border: `1px solid ${C.borderMed}`,
                color: C.m900,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Eye size={15} />
              Preview Changes
            </button>

            {isITAdmin && (
              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                disabled={isSaving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#ffffff",
                  border: `1px solid ${C.borderMed}`,
                  color: "#b91c1c",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                <RotateCcw size={15} />
                Restore Default Branding
              </button>
            )}

            {isITAdmin && (
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={isSaving}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 20px",
                  borderRadius: 8,
                  background: C.m900,
                  border: "none",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                <Save size={15} />
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            )}
          </div>
        </div>

        {/* Read-Only Banner for Standard Admin */}
        {!isITAdmin && (
          <div
            style={{
              marginTop: 20,
              padding: "14px 18px",
              borderRadius: 8,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Lock size={18} color="#1d4ed8" />
            <div style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.4 }}>
              <strong>Read-Only Mode:</strong> You are viewing institutional settings as a School Administrator.
              Modifying institutional branding and school settings requires <strong>IT Administrator</strong> privileges.
            </div>
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* SECTION 1: School Identity */}
        <div style={{ background: "#ffffff", borderRadius: 12, border: `1px solid ${C.borderMed}`, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 14 }}>
            <Building2 size={20} color={C.m700} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.m900, margin: 0 }}>
              Institutional Profile
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.m900, marginBottom: 6 }}>
                Official School Full Name *
              </label>
              <input
                type="text"
                value={formData.schoolName}
                disabled={!isITAdmin}
                onChange={(e) => handleInputChange("schoolName", e.target.value)}
                placeholder="e.g. City Integrated High School"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  background: isITAdmin ? "#ffffff" : "#f8fafc",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.m900, marginBottom: 6 }}>
                School Short Name / Abbreviation *
              </label>
              <input
                type="text"
                value={formData.schoolShortName}
                disabled={!isITAdmin}
                onChange={(e) => handleInputChange("schoolShortName", e.target.value)}
                placeholder="e.g. CIHS"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  background: isITAdmin ? "#ffffff" : "#f8fafc",
                }}
              />
              <span style={{ fontSize: 11, color: C.t3, marginTop: 4, display: "block" }}>
                Used in navigation sidebars, document titles, and compact badges.
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.m900, marginBottom: 6 }}>
                Campus Address
              </label>
              <input
                type="text"
                value={formData.address || ""}
                disabled={!isITAdmin}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="e.g. Institutional Campus Address, City, Province"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  background: isITAdmin ? "#ffffff" : "#f8fafc",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.m900, marginBottom: 6 }}>
                Official Contact Email
              </label>
              <input
                type="email"
                value={formData.contactEmail || ""}
                disabled={!isITAdmin}
                onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                placeholder="e.g. contact@school.edu.ph"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  background: isITAdmin ? "#ffffff" : "#f8fafc",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.m900, marginBottom: 6 }}>
                Official Contact Number
              </label>
              <input
                type="text"
                value={formData.contactNumber || ""}
                disabled={!isITAdmin}
                onChange={(e) => handleInputChange("contactNumber", e.target.value)}
                placeholder="e.g. (045) 123-4567"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  background: isITAdmin ? "#ffffff" : "#f8fafc",
                }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Visual Branding & Palette */}
        <div style={{ background: "#ffffff", borderRadius: 12, border: `1px solid ${C.borderMed}`, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 14 }}>
            <Palette size={20} color={C.m700} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.m900, margin: 0 }}>
              Visual Branding & Theme Colors
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* School Logo */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.m900, marginBottom: 8 }}>
                School Logo / Seal
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 10,
                    border: `1px solid ${C.borderMed}`,
                    background: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="School Logo" style={{ width: "80%", height: "80%", objectFit: "contain" }} />
                  ) : (
                    <ImageIcon size={24} color={C.t3} />
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {isITAdmin && (
                    <>
                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: "none" }}
                        onChange={(e) => handleFileUpload(e, "logo", "logoUrl")}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingField === "logo"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 6,
                          background: "#f1f5f9",
                          border: `1px solid ${C.borderMed}`,
                          fontSize: 12,
                          fontWeight: 600,
                          color: C.m900,
                          cursor: "pointer",
                        }}
                      >
                        <Upload size={13} />
                        {uploadingField === "logo" ? "Uploading..." : "Upload New Logo"}
                      </button>
                    </>
                  )}
                  <span style={{ fontSize: 11, color: C.t3 }}>PNG, JPEG, or WebP (max 10MB)</span>
                </div>
              </div>
            </div>

            {/* Favicon */}
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.m900, marginBottom: 8 }}>
                Browser Favicon
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    border: `1px solid ${C.borderMed}`,
                    background: "#f8fafc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {formData.faviconUrl ? (
                    <img src={formData.faviconUrl} alt="Favicon" style={{ width: 28, height: 28, objectFit: "contain" }} />
                  ) : (
                    <ImageIcon size={18} color={C.t3} />
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {isITAdmin && (
                    <>
                      <input
                        type="file"
                        ref={faviconInputRef}
                        accept="image/x-icon,image/png,image/jpeg"
                        style={{ display: "none" }}
                        onChange={(e) => handleFileUpload(e, "favicon", "faviconUrl")}
                      />
                      <button
                        type="button"
                        onClick={() => faviconInputRef.current?.click()}
                        disabled={uploadingField === "favicon"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 14px",
                          borderRadius: 6,
                          background: "#f1f5f9",
                          border: `1px solid ${C.borderMed}`,
                          fontSize: 12,
                          fontWeight: 600,
                          color: C.m900,
                          cursor: "pointer",
                        }}
                      >
                        <Upload size={13} />
                        {uploadingField === "favicon" ? "Uploading..." : "Upload Favicon"}
                      </button>
                    </>
                  )}
                  <span style={{ fontSize: 11, color: C.t3 }}>ICO or PNG (max 10MB)</span>
                </div>
              </div>
            </div>

            {/* Colors */}
            <div style={{ gridColumn: "span 2", borderTop: `1px solid ${C.borderLight}`, paddingTop: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.m900, marginBottom: 14 }}>
                Brand Theme Colors
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {/* Primary Color */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.m900, marginBottom: 6 }}>
                    Primary Brand Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="color"
                      value={formData.primaryColor || "#0A192F"}
                      disabled={!isITAdmin}
                      onChange={(e) => handleInputChange("primaryColor", e.target.value)}
                      style={{ width: 40, height: 38, padding: 0, borderRadius: 6, border: `1px solid ${C.borderMed}`, cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={formData.primaryColor || "#0A192F"}
                      disabled={!isITAdmin}
                      onChange={(e) => handleInputChange("primaryColor", e.target.value)}
                      placeholder="#0A192F"
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: `1px solid ${C.borderMed}`,
                        fontSize: 13,
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: C.t3, marginTop: 4, display: "block" }}>
                    Sidebar header & dark background surfaces
                  </span>
                </div>

                {/* Secondary Color */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.m900, marginBottom: 6 }}>
                    Secondary Brand Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="color"
                      value={formData.secondaryColor || "#1B3A6B"}
                      disabled={!isITAdmin}
                      onChange={(e) => handleInputChange("secondaryColor", e.target.value)}
                      style={{ width: 40, height: 38, padding: 0, borderRadius: 6, border: `1px solid ${C.borderMed}`, cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={formData.secondaryColor || "#1B3A6B"}
                      disabled={!isITAdmin}
                      onChange={(e) => handleInputChange("secondaryColor", e.target.value)}
                      placeholder="#1B3A6B"
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: `1px solid ${C.borderMed}`,
                        fontSize: 13,
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: C.t3, marginTop: 4, display: "block" }}>
                    Active navigation elements & buttons
                  </span>
                </div>

                {/* Accent Color */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.m900, marginBottom: 6 }}>
                    Accent Highlight Color
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="color"
                      value={formData.accentColor || "#F5A623"}
                      disabled={!isITAdmin}
                      onChange={(e) => handleInputChange("accentColor", e.target.value)}
                      style={{ width: 40, height: 38, padding: 0, borderRadius: 6, border: `1px solid ${C.borderMed}`, cursor: "pointer" }}
                    />
                    <input
                      type="text"
                      value={formData.accentColor || "#F5A623"}
                      disabled={!isITAdmin}
                      onChange={(e) => handleInputChange("accentColor", e.target.value)}
                      placeholder="#F5A623"
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: `1px solid ${C.borderMed}`,
                        fontSize: 13,
                        fontFamily: "monospace",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: C.t3, marginTop: 4, display: "block" }}>
                    Badge highlights, badges, and focal indicators
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Login Appearance & Shared Footer */}
        <div style={{ background: "#ffffff", borderRadius: 12, border: `1px solid ${C.borderMed}`, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, borderBottom: `1px solid ${C.borderLight}`, paddingBottom: 14 }}>
            <Sparkles size={20} color={C.m700} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.m900, margin: 0 }}>
              Login Appearance & Footer
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.m900, marginBottom: 6 }}>
                Login Screen Welcome Headline / Text
              </label>
              <input
                type="text"
                value={formData.loginWelcomeText || ""}
                disabled={!isITAdmin}
                onChange={(e) => handleInputChange("loginWelcomeText", e.target.value)}
                placeholder="e.g. Education Shapes the Future"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: C.m900, marginBottom: 6 }}>
                Shared Footer Text
              </label>
              <input
                type="text"
                value={formData.footerText || ""}
                disabled={!isITAdmin}
                onChange={(e) => handleInputChange("footerText", e.target.value)}
                placeholder="e.g. DigiSkwela · School Management System"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>

        {/* Action bar for ITAdmin */}
        {isITAdmin && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 24px",
                borderRadius: 8,
                background: C.m900,
                border: "none",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: isSaving ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
              }}
            >
              <Save size={16} />
              {isSaving ? "Saving Settings..." : "Save Settings"}
            </button>
          </div>
        )}
      </form>

      {/* MODAL 1: Interactive Live Preview Modal */}
      {previewOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 760,
              background: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Eye size={18} color={C.m900} />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: C.m900 }}>
                  Branding Preview
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: C.t2 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Sidebar Header Preview */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.t3, letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
                  1. Sidebar Navigation Header Preview
                </span>
                <div
                  style={{
                    width: 260,
                    background: formData.primaryColor || "#0A192F",
                    borderRadius: 10,
                    padding: "18px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  }}
                >
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="Logo"
                      style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }}
                      onError={(e) => ((e.currentTarget as any).style.display = "none")}
                    />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <GraduationCap size={28} color="#ffffff" />
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ color: "#ffffff", fontSize: 17, fontWeight: 700, fontFamily: "'Fraunces', serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {formData.schoolShortName || "CIS"}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 2 }}>
                      Admin / IT Portal
                    </div>
                  </div>
                </div>
              </div>

              {/* Login Card Header Preview */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: C.t3, letterSpacing: "0.1em", display: "block", marginBottom: 8 }}>
                  2. Login Screen Header Preview
                </span>
                <div
                  style={{
                    background: `linear-gradient(135deg, ${formData.primaryColor || "#0A192F"} 0%, ${formData.secondaryColor || "#1B3A6B"} 100%)`,
                    borderRadius: 12,
                    padding: "24px 28px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    color: "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {formData.logoUrl ? (
                      <img
                        src={formData.logoUrl}
                        alt="Logo"
                        style={{ width: 42, height: 42, objectFit: "contain" }}
                        onError={(e) => ((e.currentTarget as any).style.display = "none")}
                      />
                    ) : (
                      <div style={{ width: 42, height: 42, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <GraduationCap size={26} color="#ffffff" />
                      </div>
                    )}
                    <div style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>
                      {formData.schoolName || "DigiSkwela Institution"}
                    </div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                    {formData.loginWelcomeText || "Education Shapes the Future"}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                    {formData.footerText || "DigiSkwela · School Management System"}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "14px 24px", background: "#f8fafc", borderTop: `1px solid ${C.borderLight}`, display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  background: C.m900,
                  color: "#ffffff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Reset Confirmation Modal */}
      {resetModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#ffffff",
              borderRadius: 14,
              boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
              padding: 24,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#b91c1c", marginBottom: 12 }}>
              <AlertCircle size={22} />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                Restore Default Visual Branding?
              </h3>
            </div>

            <p style={{ fontSize: 13, color: C.t2, lineHeight: 1.5, margin: "0 0 20px" }}>
              This action will reset the visual identity (colors, logo, favicon, and login welcome text) back to
              default presentation settings. Your institutional identity (School Name, Short Name, Address, and Contact details)
              will <strong>NOT</strong> be affected.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                disabled={isSaving}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: `1px solid ${C.borderMed}`,
                  background: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.m900,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isSaving}
                style={{
                  padding: "8px 18px",
                  borderRadius: 6,
                  border: "none",
                  background: "#b91c1c",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                {isSaving ? "Restoring..." : "Restore Default Branding"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
