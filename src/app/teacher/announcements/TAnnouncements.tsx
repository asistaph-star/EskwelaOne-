import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { Megaphone, Users, User } from 'lucide-react';
import { DocPanel } from '../../shared/components/DocPanel';
import { apiClient } from '../../../api/client';

export function TAnnouncements() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await apiClient.get('/admin/announcements');
        setAnnouncements(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error("Failed to fetch announcements:", err);
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "24px 32px", height: "100%", overflowY: "auto", boxSizing: "border-box", maxWidth: 800, margin: "0 auto", width: "100%" }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Megaphone size={20} color={C.m700} /> School Announcements
        </h2>
        <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Read-only broadcast messages from School Administration.</div>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
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
                    <span style={{ fontSize: 10, fontWeight: 600, color: C.m700, background: C.m50, padding: "2px 8px", borderRadius: 10 }}>{new Date(ann.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
              </div>
            </DocPanel>
          ))
        )}
      </div>
    </div>
  );
}
