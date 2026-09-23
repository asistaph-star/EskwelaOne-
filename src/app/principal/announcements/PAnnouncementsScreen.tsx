import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { Megaphone, Users, User, Send, CheckCircle } from 'lucide-react';
import { DocPanel } from '../../shared/components/DocPanel';

export function PAnnouncementsScreen() {
  const { announcements, addAnnouncement, currentUser, addNotification, students } = useAppContext();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("All");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    const newAnnouncement = {
      id: "ann-" + Date.now(),
      author: currentUser?.name || "School Administration",
      title,
      body,
      audience,
      timestamp: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    };

    await addAnnouncement(newAnnouncement);

    // Notify appropriate audiences
    if (audience === "All" || audience === "Students") {
      // Notify all students
      for (const s of students) {
        // Here we just notify all students in the system (mocked by looping through `students` from context)
        const sId = s.id;
        addNotification({
          id: "notif-ann-" + Date.now() + "-" + sId,
          recipientId: sId,
          title: "New School Announcement",
          body: newAnnouncement.title,
          timestamp: "Just now",
          isRead: false,
          iconType: "megaphone"
        });
      }
    }

    setSuccess(true);
    setTitle("");
    setBody("");
    setAudience("All");
    setTimeout(() => setSuccess(false), 3000);
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

        <form onSubmit={handleSubmit} style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Title</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif" }} placeholder="e.g. School Closing Early Tomorrow" />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Audience</label>
            <select value={audience} onChange={e => setAudience(e.target.value)} style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif", cursor: "pointer" }}>
              <option value="All">All (Students, Parents, Teachers)</option>
              <option value="Students">Students Only</option>
              <option value="Teachers">Teachers Only</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Message Body</label>
            <textarea required value={body} onChange={e => setBody(e.target.value)} rows={6} style={{ width: "100%", padding: "10px 14px", fontSize: 13, border: `1.5px solid ${C.borderMed}`, borderRadius: 6, boxSizing: "border-box", outline: "none", fontFamily: "'Inter', sans-serif", resize: "vertical" }} placeholder="Enter the details of the announcement here..." />
          </div>

          <button type="submit" style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: 8, background: C.m700, color: "#fff", border: "none", padding: "12px 24px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = C.m600}
            onMouseLeave={e => e.currentTarget.style.background = C.m700}
          >
            <Send size={16} /> Post Announcement
          </button>
        </form>
      </div>

      {/* Right: History */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Recent Announcements</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {announcements.map(ann => (
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
          ))}
          {announcements.length === 0 && (
            <div style={{ background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, padding: 40, textAlign: "center", color: C.t3, fontSize: 13 }}>
              No announcements posted yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
