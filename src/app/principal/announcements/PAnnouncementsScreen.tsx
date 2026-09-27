import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { Megaphone, Users, User, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { DocPanel } from '../../shared/components/DocPanel';
import { apiClient } from '../../../api/client';
import { useAppContext } from '../../shared/AppContext';

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  created_at?: string;
  author?: {
    first_name: string;
    last_name: string;
  };
};

export function PAnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("All");
  const [success, setSuccess] = useState(false);

  const { addNotification, currentUser, students, teachers } = useAppContext();

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiClient.get<Announcement[]>('/admin/announcements');
      setAnnouncements(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    try {
      setIsSubmitting(true);
      setError("");
      setSuccess(false);

      const payload = {
        title: title.trim(),
        body: body.trim(),
        audience
      };

      const newAnn = await apiClient.post<Announcement>('/admin/announcements', payload);

      setAnnouncements(prev => [newAnn, ...prev]);
      
      // Dispatch mock frontend notifications to satisfy the UI red badge logic across portals
      if (currentUser) {
         addNotification({
           id: "",
           recipientId: currentUser.id,
           title: "Announcement Posted",
           body: `You posted: ${newAnn.title}`,
           timestamp: "Just now",
           isRead: false,
           iconType: "megaphone"
         });
      }

      if (audience === "All" || audience === "Students") {
        students.forEach(s => {
          addNotification({
            id: "",
            recipientId: s.id,
            title: "New School Announcement",
            body: newAnn.title,
            timestamp: "Just now",
            isRead: false,
            iconType: "megaphone"
          });
        });
      }

      if (audience === "All" || audience === "Teachers") {
        teachers.forEach(t => {
          addNotification({
            id: "",
            recipientId: t.id,
            title: "New Staff Announcement",
            body: newAnn.title,
            timestamp: "Just now",
            isRead: false,
            iconType: "megaphone"
          });
        });
      }

      setSuccess(true);
      setTitle("");
      setBody("");
      setAudience("All");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to post announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 24, padding: "24px 32px", height: "100%", overflowY: "auto" }}>
      {/* Left: Create Form */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Megaphone size={18} color={C.m700} /> Create Announcement
        </h2>
        
        {success && (
          <div style={{ background: C.greenBg, border: `1px solid ${C.green}40`, padding: "12px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, color: C.green, fontSize: 13, fontWeight: 600 }}>
            <CheckCircle size={16} /> Announcement posted successfully.
          </div>
        )}

        {error && (
          <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", padding: "12px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8, color: "#B91C1C", fontSize: 13, fontWeight: 600 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Title</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif" }} placeholder="e.g. School Closing Early Tomorrow" disabled={isSubmitting} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Audience</label>
            <select value={audience} onChange={e => setAudience(e.target.value)} style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif", cursor: "pointer" }} disabled={isSubmitting}>
              <option value="All">All (Students, Parents, Teachers, Staff)</option>
              <option value="Students">Students Only</option>
              <option value="Teachers">Teachers Only</option>
              <option value="Parents">Parents Only</option>
              <option value="Staff">Staff Only</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Message Body</label>
            <textarea required value={body} onChange={e => setBody(e.target.value)} rows={6} style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif", resize: "vertical" }} placeholder="Enter the details of the announcement here..." disabled={isSubmitting} />
          </div>

          <button type="submit" disabled={isSubmitting} style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 8, background: isSubmitting ? C.t3 : C.m700, color: "#fff", border: "none", padding: "12px 24px", borderRadius: 6, cursor: isSubmitting ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, transition: "background 0.15s" }}
            onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.background = C.m600; }}
            onMouseLeave={e => { if (!isSubmitting) e.currentTarget.style.background = C.m700; }}
          >
            <Send size={16} /> {isSubmitting ? "Posting..." : "Post Announcement"}
          </button>
        </form>
      </div>

      {/* Right: History */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Recent Announcements</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: C.t3, fontSize: 13 }}>Loading announcements...</div>
          ) : announcements.length === 0 ? (
            <div style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 40, textAlign: "center", color: C.t3, fontSize: 13 }}>
              No announcements posted yet.
            </div>
          ) : (
            announcements.map(ann => (
              <DocPanel key={ann.id} title={ann.title} icon={Megaphone}>
                <div style={{ padding: "12px 16px" }}>
                  <p style={{ fontSize: 12, color: C.t2, lineHeight: 1.5, margin: "0 0 12px 0", whiteSpace: "pre-wrap" }}>{ann.body}</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                    <span style={{ fontSize: 10, color: C.t3, display: "flex", alignItems: "center", gap: 4 }}><User size={12} /> {ann.author?.first_name ? `${ann.author.first_name} ${ann.author.last_name}` : "Administration"}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 10, color: C.t3, display: "flex", alignItems: "center", gap: 4 }}><Users size={12} /> Audience: {ann.audience}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: C.m700, background: C.m50, padding: "2px 8px", borderRadius: 10 }}>{new Date(ann.created_at || new Date()).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                    </div>
                  </div>
                </div>
              </DocPanel>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
