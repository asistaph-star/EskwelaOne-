import React, { useState } from "react";
import { Search, ChevronDown, Award, Plus, FileText, CheckCircle, Clock } from "lucide-react";
import { useAppContext } from "../../shared/AppContext";
import { C } from "../../shared/constants/tokens";
import { TEACHER_POSITIONS } from "../../shared/constants/teacherPositions";
import { TeacherRankingRecord } from "../../shared/types";
import RankingDetailModal from "./components/RankingDetailModal";

export default function PRankingScreen({ inTab = false }: { inTab?: boolean }) {
  const [teacherRankings, setTeacherRankings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [targetPos, setTargetPos] = useState<string>("Master Teacher I");
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  React.useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async () => {
    try {
      setIsLoading(true);
      const { apiClient } = await import('../../../api/client');
      const res = await apiClient.get<any[]>('/admin/rankings');
      setTeacherRankings(res || []);
    } catch (err) {
      console.error('Failed to fetch rankings', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter rankings by target position and search
  const filteredRankings = teacherRankings.filter(r => {
    if (r.target_position !== targetPos) return false;
    if (search && !r.teacherName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Calculate some basic stats
  const activeCount = filteredRankings.filter(r => r.status !== "Completed").length;
  const completedCount = filteredRankings.filter(r => r.status === "Completed").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8f9fa", overflowY: "auto", fontFamily: "'Inter', sans-serif" }}>
      {/* HEADER BAND */}
      {!inTab && (
        <div style={{ background: C.m800, padding: "24px 32px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8, marginBottom: 6 }}>Teacher Evaluation Management</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Fraunces', serif" }}>Teacher Ranking</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <FileText size={16} /> DepEd Guidelines
            </button>
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: "#C8860A", color: C.m900, border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              <Plus size={16} /> Create Evaluation
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: inTab ? 0 : 32, display: "flex", flexDirection: "column", gap: 24, maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        
        {/* If inTab, show actions here */}
        {inTab && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: `1px solid ${C.borderMed}`, color: C.t2, padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              <FileText size={16} /> DepEd Guidelines
            </button>
            <button style={{ display: "flex", alignItems: "center", gap: 6, background: C.m800, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              <Plus size={16} /> Create Evaluation
            </button>
          </div>
        )}
        
        {/* FILTERS & STATS */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 16 }}>
            {/* Target Position Dropdown */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Target Position</div>
              <div style={{ position: "relative" }}>
                <select 
                  value={targetPos}
                  onChange={e => setTargetPos(e.target.value)}
                  style={{ appearance: "none", width: 220, padding: "10px 16px", paddingRight: 36, fontSize: 14, fontWeight: 600, color: C.t1, background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 4, cursor: "pointer" }}
                >
                  {TEACHER_POSITIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <ChevronDown size={16} color={C.t3} style={{ position: "absolute", right: 12, top: 11, pointerEvents: "none" }} />
              </div>
            </div>

            {/* Search */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase", marginBottom: 6 }}>Search Candidate</div>
              <div style={{ position: "relative", width: 260 }}>
                <Search size={16} color={C.t3} style={{ position: "absolute", left: 12, top: 11 }} />
                <input 
                  type="text" 
                  placeholder="Search name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: "100%", padding: "10px 16px 10px 36px", fontSize: 14, border: `1px solid ${C.borderMed}`, borderRadius: 4 }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, padding: "12px 20px", borderRadius: 4, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Active Evaluations</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.m700 }}>{activeCount}</div>
            </div>
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, padding: "12px 20px", borderRadius: 4, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Completed ({targetPos})</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.m700 }}>{completedCount}</div>
            </div>
          </div>
        </div>

        {/* LIST */}
        <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden" }}>
          {filteredRankings.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8f9fa", borderBottom: `1px solid ${C.borderMed}` }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Candidate</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Current Pos.</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Evaluation Period</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Total Score</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRankings.sort((a,b) => b.total_score - a.total_score).map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderMed}` }} onMouseEnter={e => e.currentTarget.style.background = "#f8f9fa"} onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600, color: C.t1, fontSize: 14 }}>{r.teacherName}</div>
                      <div style={{ fontSize: 11, color: C.t3 }}>ID: {r.teacher_id}</div>
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: C.t2 }}>{r.current_position}</td>
                    <td style={{ padding: "14px 16px", fontSize: 13, color: C.t2, textAlign: "center" }}>{r.evaluationPeriod}</td>
                    <td style={{ padding: "14px 16px", fontSize: 15, fontWeight: 700, color: C.m700, textAlign: "center" }}>
                      {r.total_score > 0 ? r.total_score : "--"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ 
                        fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 4,
                        background: r.status === "Completed" ? C.greenBg : r.status === "Under Review" ? C.blueBg : C.amberBg,
                        color: r.status === "Completed" ? C.green : r.status === "Under Review" ? C.blue : C.amber
                      }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <button 
                        onClick={() => setSelectedRecord(r)}
                        style={{ background: "#fff", border: `1px solid ${C.borderMed}`, padding: "6px 12px", borderRadius: 4, fontSize: 12, fontWeight: 600, color: C.t2, cursor: "pointer" }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 48, textAlign: "center", color: C.t3, fontSize: 13 }}>No candidates found for {targetPos}.</div>
          )}
        </div>
      </div>

      {selectedRecord && (
        <RankingDetailModal 
          record={selectedRecord}
          onClose={() => {
            setSelectedRecord(null);
            fetchRankings();
          }}
        />
      )}
    </div>
  );
}
