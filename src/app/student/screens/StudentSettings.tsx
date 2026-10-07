import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';

import { usersApi } from '../../../api/users.api';
import { studentApi } from '../../../api/student.api';
import { useEffect } from 'react';
import { useAppContext } from '../../shared/AppContext';

export function StudentSettings({ setTab, currentUser, updateCurrentUser }: any) {
  const { getGenericDocument, saveGenericDocument } = useAppContext();
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = React.useState(false);
  const [photoUploadError, setPhotoUploadError] = React.useState("");
  const [emailInputValue, setEmailInputValue] = React.useState(currentUser?.parentEmail || "");
  const [emailError, setEmailError] = React.useState("");
  const [isSavingEmail, setIsSavingEmail] = React.useState(false);
  const [emailSaveSuccess, setEmailSaveSuccess] = React.useState(false);

  React.useEffect(() => {
    if (currentUser?.parentEmail) setEmailInputValue(currentUser.parentEmail);
  }, [currentUser?.parentEmail]);

  React.useEffect(() => {
    let url: string | null = null;
    if (currentUser?.photoDocId) {
      getGenericDocument(currentUser.photoDocId).then((doc: any) => {
        if (doc?.blob) {
          url = URL.createObjectURL(doc.blob);
          setPhotoUrl(url);
        }
      }).catch(() => {});
    } else {
      setPhotoUrl(null);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [currentUser?.photoDocId, getGenericDocument]);

  const handleEmailSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInputValue.trim();
    if (!trimmed) {
      setEmailError("Email is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError("Please enter a valid email.");
      return;
    }
    setEmailError("");
    setIsSavingEmail(true);
    try {
      await updateCurrentUser({ parentEmail: trimmed });
      setEmailSaveSuccess(true);
      setTimeout(() => setEmailSaveSuccess(false), 3000);
    } catch (err: any) {
      setEmailError(err.message || "Failed to update email.");
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      setPhotoUploadError("Please select a JPEG or PNG image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoUploadError("Image size must be less than 5MB.");
      return;
    }

    setPhotoUploadError("");
    setIsUploadingPhoto(true);
    try {
      const savedDoc = await saveGenericDocument({
        id: "doc_" + Date.now().toString(),
        type: file.type,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        status: 'completed',
        blob: file
      });
      await updateCurrentUser({ photoDocId: savedDoc.id });
    } catch (err: any) {
      setPhotoUploadError(err.message || "Failed to upload photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-8 py-2.5 w-full" style={{ animation: "fadeIn 0.3s ease-out" }}>
              
              {/* Profile Card */}
              <div style={{ 
                background: "#fff", 
                borderRadius: 16, 
                padding: "32px 24px", 
                textAlign: "center",
                boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                border: "1px solid rgba(0,0,0,0.04)",
                height: "fit-content",
                position: "relative",
                overflow: "hidden"
              }}>
                {/* Decorative background element */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, background: `linear-gradient(135deg, ${C.m700}, ${C.m900})`, zIndex: 0 }} />
                
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 16, position: "relative" }}>
                    <div style={{ 
                      width: 96, height: 96, borderRadius: 48, 
                      background: "#fff", padding: 4,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)"
                    }}>
                      <div style={{ 
                        width: "100%", height: "100%", borderRadius: 50, 
                        background: `linear-gradient(135deg, ${C.m600}, ${C.m800})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        overflow: "hidden"
                      }}>
                        {photoUrl ? (
                          <img src={photoUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 32, fontWeight: 800, color: C.gold, letterSpacing: "-1px" }}>
                            {currentUser?.name ? currentUser.name.split(" ").map(n => n[0]).join("").substring(0,2) : "SJ"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{currentUser?.name || "Student User"}</div>
                  <div style={{ fontSize: 13, color: C.t2 }}>{currentUser?.section || "Grade 10 - Pilot Section"}</div>
                  <div style={{ fontSize: 12, color: C.t3, marginTop: 4, fontWeight: 500 }}>Learner Reference Number: <span style={{ color: C.m700, fontWeight: 700 }}>100001</span></div>
                  
                  <div style={{ marginTop: 24, padding: "16px", background: C.paper, borderRadius: 12, border: `1px solid ${C.borderMed}`, textAlign: "left" }}>
                     <div style={{ fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Account Status</div>
                     <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                       <div style={{ width: 8, height: 8, borderRadius: 4, background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
                       <span style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>Active & Enrolled</span>
                     </div>
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: "none" }} 
                    accept="image/jpeg, image/png"
                    onChange={handlePhotoUpload}
                  />
                  {photoUploadError && <div style={{ color: C.red, fontSize: 12, marginTop: 8, textAlign: "center", fontWeight: 600 }}>{photoUploadError}</div>}
                  <button 
                    disabled={isUploadingPhoto}
                    onClick={() => fileInputRef.current?.click()} 
                    style={{ 
                      marginTop: 24, width: "100%", background: "#fff", 
                      border: `1px solid ${C.m700}`, 
                      padding: "10px 16px", borderRadius: 8, cursor: isUploadingPhoto ? "not-allowed" : "pointer", 
                      fontSize: 13, fontWeight: 700, color: C.m700, 
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "all 0.2s",
                      opacity: isUploadingPhoto ? 0.6 : 1
                    }}
                  >
                    <Upload size={16} />
                    {isUploadingPhoto ? "Uploading..." : "Change Profile Photo"}
                  </button>
                </div>
              </div>

              {/* Settings Forms Container */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                {/* Contact Email */}
                <div style={{ 
                  background: "#fff", borderRadius: 16, padding: 32,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.04)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(99, 102, 241, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1" }}>
                      <Mail size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Contact Information</h3>
                      <p style={{ fontSize: 12, color: C.t3, margin: "4px 0 0 0" }}>Receive official school communications and alerts.</p>
                    </div>
                  </div>

                  <form onSubmit={handleEmailSave} style={{ marginTop: 24 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 8 }}>Parent / Guardian Email</label>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <input 
                          type="email" 
                          value={emailInputValue} 
                          onChange={e => setEmailInputValue(e.target.value)} 
                          placeholder="parent@email.com" 
                          style={{ 
                            width: "100%", padding: "12px 16px", fontSize: 14, boxSizing: "border-box",
                            background: C.paper, border: `1px solid ${emailError ? C.red : C.borderMed}`, borderRadius: 8, 
                            outline: "none", color: C.t1, transition: "border-color 0.2s" 
                          }} 
                          onFocus={e => e.target.style.borderColor = emailError ? C.red : "#6366f1"}
                          onBlur={e => e.target.style.borderColor = emailError ? C.red : C.borderMed}
                        />
                        {emailError && <div style={{ color: C.red, fontSize: 11, marginTop: 6, fontWeight: 600 }}>{emailError}</div>}
                      </div>
                      <button 
                        type="submit" 
                        disabled={isSavingEmail}
                        style={{ 
                          background: emailSaveSuccess ? C.green : C.m700, color: "#fff", 
                          border: "none", padding: "0 24px", borderRadius: 8, cursor: isSavingEmail ? "not-allowed" : "pointer", 
                          fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8,
                          transition: "all 0.2s", boxShadow: emailSaveSuccess ? `0 4px 12px ${C.green}40` : "none",
                          height: 44, opacity: isSavingEmail ? 0.7 : 1
                        }}
                      >
                        {emailSaveSuccess ? <CheckCircle size={16} /> : <CheckSquare size={16} />}
                        {emailSaveSuccess ? "Saved" : isSavingEmail ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Password Change */}
                <div style={{ 
                  background: "#fff", borderRadius: 16, padding: 32,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.04)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(245, 158, 11, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: C.gold }}>
                      <Lock size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Security Settings</h3>
                      <p style={{ fontSize: 12, color: C.t3, margin: "4px 0 0 0" }}>Update your password to keep your account secure.</p>
                    </div>
                  </div>

                  <form onSubmit={e => e.preventDefault()} style={{ marginTop: 24 }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 8 }}>Current Password</label>
                        <input 
                          type="password" disabled value="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó" placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó" 
                          style={{ 
                            width: "100%", padding: "12px 16px", fontSize: 14, 
                            background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 8, 
                            boxSizing: "border-box", outline: "none", transition: "border-color 0.2s", opacity: 0.7
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 8 }}>New Password</label>
                        <input 
                          type="password" disabled value="" placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó" 
                          style={{ 
                            width: "100%", padding: "12px 16px", fontSize: 14, 
                            background: C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 8, 
                            boxSizing: "border-box", outline: "none", transition: "border-color 0.2s", opacity: 0.7
                          }}
                        />
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: 16, fontSize: 12, color: C.t3, display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertCircle size={14} color={C.m500} />
                      Password changes will be available when secure backend authentication is implemented.
                    </div>
                    
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button 
                        type="button" 
                        disabled
                        style={{ 
                          background: C.borderMed, color: C.t3, 
                          border: "none", padding: "12px 24px", borderRadius: 8, cursor: "not-allowed", 
                          fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8,
                          transition: "all 0.2s"
                        }}
                      >
                        <Shield size={16} />
                        Update Password
                      </button>
                    </div>
                  </form>
                </div>

                {/* Notifications */}
                <div style={{ 
                  background: "#fff", borderRadius: 16, padding: 32,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.04)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(16, 185, 129, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: C.green }}>
                      <Bell size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Notification Preferences</h3>
                      <p style={{ fontSize: 12, color: C.t3, margin: "4px 0 0 0" }}>Control how you receive updates and alerts.</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Toggle 1 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: C.paper, borderRadius: 12, border: `1px solid ${C.borderMed}` }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>SMS Broadcasts</div>
                        <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Receive emergency alerts and tardiness logs on your mobile.</div>
                      </div>
                      <div 
                        onClick={() => {
                          updateCurrentUser({ smsAlerts: !currentUser?.smsAlerts }).catch(console.error);
                        }}
                        style={{ 
                          width: 44, height: 24, borderRadius: 12, 
                          background: currentUser?.smsAlerts ? C.green : C.borderMed, 
                          position: "relative", cursor: "pointer", transition: "background 0.3s"
                        }}
                      >
                        <div style={{ 
                          width: 18, height: 18, borderRadius: 9, background: "#fff", 
                          position: "absolute", top: 3, left: currentUser?.smsAlerts ? 23 : 3, 
                          transition: "left 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" 
                        }} />
                      </div>
                    </div>

                    {/* Toggle 2 */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: C.paper, borderRadius: 12, border: `1px solid ${C.borderMed}` }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>Weekly Email Reports</div>
                        <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>Get a summary of scholastic averages and grading checklists.</div>
                      </div>
                      <div 
                        onClick={() => {
                          updateCurrentUser({ emailAlerts: !currentUser?.emailAlerts }).catch(console.error);
                        }}
                        style={{ 
                          width: 44, height: 24, borderRadius: 12, 
                          background: currentUser?.emailAlerts ? C.green : C.borderMed, 
                          position: "relative", cursor: "pointer", transition: "background 0.3s"
                        }}
                      >
                        <div style={{ 
                          width: 18, height: 18, borderRadius: 9, background: "#fff", 
                          position: "absolute", top: 3, left: currentUser?.emailAlerts ? 23 : 3, 
                          transition: "left 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" 
                        }} />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
  );
}
