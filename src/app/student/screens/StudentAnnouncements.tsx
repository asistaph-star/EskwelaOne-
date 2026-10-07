import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Calendar, LayoutDashboard, ClipboardList, FileText, Heart, Activity, Bell, AlertCircle,
  QrCode, Shield, CheckCircle, Clock, FileSpreadsheet, User, UserCheck,
  Settings, RefreshCw, Send, CheckSquare, Square, Upload, Paperclip, Search, Lock, ChevronLeft, ChevronRight,
  Check, Menu, MessageSquare, FolderOpen, AlertTriangle, ChevronDown, Megaphone, School, X, Sparkles, CalendarCheck, Mail, Eye, XCircle, Stethoscope } from 'lucide-react';
import { StatBox } from '../../shared/components/StatBox';
import { Stamp } from '../../shared/components/Stamp';

export function StudentAnnouncements({ setTab, announcements, C }: any) {
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>School Announcements</h1>
                  <div style={{ fontSize: 11, color: C.t3, marginTop: 3 }}>Stay updated with the latest news, notices, and events.</div>
                </div>
              </div>

              <div style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                {announcements.filter(a => a.audience === "All" || a.audience === "Students").map((ann) => (
                  <div key={ann.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px", border: `1px solid ${C.borderMed}`, borderRadius: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Megaphone size={14} color={C.m700} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{ann.title}</div>
                        <span style={{ fontSize: 9.5, padding: "2px 8px", background: "#f0fdf4", color: C.green, borderRadius: 10, fontWeight: 700 }}>Announcement</span>
                      </div>
                      <p style={{ fontSize: 11.5, color: C.t2, margin: "6px 0", lineHeight: 1.5 }}>{ann.body}</p>
                      <span style={{ fontSize: 9.5, color: C.t3 }}>{new Date(ann.created_at || new Date()).toLocaleDateString()} &middot; {ann.author?.first_name ? `${ann.author.first_name} ${ann.author.last_name}` : "Administration"}</span>
                    </div>
                  </div>
                ))}
                {announcements.filter(a => a.audience === "All" || a.audience === "Students").length === 0 && (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 11, color: C.t3 }}>No new announcements.</div>
                )}
              </div>
            </div>
  );
}
