import React from 'react';
import { C } from '../../shared/constants/tokens';
import { User, Award, BookOpen, AlertCircle, CheckCircle, Clock, X } from 'lucide-react';

export function TeacherProfileModal({ teacherUser, img, onClose }: { teacherUser: any, img?: string, onClose: () => void }) {
  // Map real data from User and Teacher profile
  const teacher = {
    name: `${teacherUser.first_name} ${teacherUser.last_name}`,
    email: teacherUser.email || "No Email provided",
    department: teacherUser.teacher?.department || "General",
    position: teacherUser.teacher?.position || "Teacher I",
    specialization: teacherUser.teacher?.specialization || "General Education",
    dateHired: teacherUser.teacher?.date_hired || new Date().toISOString(),
  };

  const now = new Date();
  const promotedDate = new Date(teacher.dateHired);
  const diffTime = Math.abs(now.getTime() - promotedDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffYears = diffDays / 365.25;

  let promoStatusColor = C.t1;
  let promoBgColor = C.paper;
  let promoIcon = <CheckCircle size={18} color={C.green} />;
  let promoText = "On Track";

  if (diffYears >= 2.5) { // 2 yrs 6 mos+
    promoStatusColor = C.red;
    promoBgColor = C.redBg;
    promoIcon = <AlertCircle size={18} color={C.red} />;
    promoText = "Promotion Overdue (2 yrs 6+ mos)";
  } else if (diffYears >= 2.25) { // 2 yrs 3 mos
    promoStatusColor = "#B45309"; // Amber/warning
    promoBgColor = "#FEF3C7";
    promoIcon = <Clock size={18} color="#B45309" />;
    promoText = "Eligible for Promotion Soon (2 yrs 3+ mos)";
  }

  const formatYearsMonths = (yearsDec: number) => {
    const y = Math.floor(yearsDec);
    const m = Math.floor((yearsDec - y) * 12);
    return `${y} yr${y !== 1 ? 's' : ''} ${m} mo${m !== 1 ? 's' : ''}`;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(15,8,8,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      
      <div style={{ background: C.paper, borderRadius: 8, width: "100%", maxWidth: 1000, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 60px rgba(74,10,16,0.3)" }}>
        
        {/* HEADER */}
        <div style={{ background: C.m800, padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -40, top: -40, opacity: 0.1 }}>
            <User size={200} color="#fff" />
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center", zIndex: 1 }}>
            {img ? (
              <img src={img} style={{ width: 120, height: 120, borderRadius: 16, border: "4px solid #fff", objectFit: "cover", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }} alt={teacher.name} />
            ) : (
              <div style={{ width: 120, height: 120, borderRadius: 16, background: "rgba(255,255,255,0.1)", border: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
                <User size={50} color="#fff" />
              </div>
            )}
            <div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Faculty Profile</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "'Fraunces',serif" }}>{teacher.name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ zIndex: 1, width: 32, height: 32, borderRadius: 6, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: 24, overflowY: "auto", display: "flex", gap: 24 }}>
          
          {/* LEFT COLUMN: PDS & Trainings */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* Personal Data Sheet */}
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={14} color={C.m700} />
                </div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.t1 }}>Personal Data Sheet</h3>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Email</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{teacher.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Department</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{teacher.department}</div>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Specialization</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{teacher.specialization}</div>
                </div>
              </div>
            </div>

            {/* Training & Seminars */}
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BookOpen size={14} color={C.m700} />
                </div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.t1 }}>Trainings & Seminars Attended</h3>
              </div>
              <div style={{ padding: "20px", textAlign: "center", fontSize: 12, color: C.t3, background: C.paper, borderRadius: 6 }}>
                Training history records are currently unavailable.
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Promotion Tracker */}
          <div style={{ width: 320, flexShrink: 0 }}>
            <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Award size={14} color={C.m700} />
                </div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: C.t1 }}>Promotion Status</h3>
              </div>

              <div style={{ padding: 14, borderRadius: 8, background: promoBgColor, border: `1px solid ${promoStatusColor}40`, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {promoIcon}
                  <div style={{ fontSize: 12, fontWeight: 700, color: promoStatusColor }}>{promoText}</div>
                </div>
                <div style={{ fontSize: 10, color: C.t2, marginLeft: 26 }}>
                  Time since last promotion: <strong>{formatYearsMonths(diffYears)}</strong>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Current Position</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{teacher.position}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Date Hired</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.t1 }}>{new Date(teacher.dateHired).toLocaleDateString()}</div>
                </div>
              </div>
              
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
