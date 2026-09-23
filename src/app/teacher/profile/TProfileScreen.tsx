import React from 'react';
import { C } from '../../shared/constants/tokens';
import { User, Award, BookOpen, AlertCircle, CheckCircle, Clock, Camera, Lock } from 'lucide-react';
import { useAppContext } from '../../shared/AppContext';
export function TProfileScreen() {
  const { currentUser, updateUser, addNotification, getGenericDocument, saveGenericDocument } = useAppContext();
  const [photoUrl, setPhotoUrl] = React.useState<string|null>(null);
  const [pwInput, setPwInput] = React.useState('');


  React.useEffect(() => {
    if (currentUser?.photoDocId) {
      getGenericDocument(currentUser.photoDocId).then(doc => {
        if (doc && doc.blob) setPhotoUrl(URL.createObjectURL(doc.blob as Blob));
      });
    }
  }, [currentUser?.photoDocId]);
  
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !currentUser) return;
    const file = e.target.files[0];
    const docId = "photo-" + Date.now();
    await saveGenericDocument({
      id: docId,
      blob: file,
      filename: file.name
    });
    setPhotoUrl(URL.createObjectURL(file));
    await updateUser(currentUser.id, { photoDocId: docId });
    addNotification({
      id: "notif-photo-" + Date.now(),
      recipientId: currentUser.id,
      title: "Profile Updated",
      body: "Your profile picture has been updated.",
      timestamp: "Just now",
      isRead: false,
      iconType: "alert"
    });
  };

  const handlePasswordChange = async () => {
    if (!pwInput) return;
    if (currentUser) {
      // We would normally hash this, but for prototype we just store it in the user object or just show success
      await updateUser(currentUser.id, { password: pwInput } as any);
      addNotification({
        id: "notif-pw-" + Date.now(),
        recipientId: currentUser.id,
        title: "Security Update",
        body: "Your password has been changed successfully.",
        timestamp: "Just now",
        isRead: false,
        iconType: "alert"
      });
      setPwInput('');
      alert("Password updated successfully.");
    }
  };

  const teacher = {
    name: currentUser?.name || "Teacher User",
    age: 34,
    address: "B12 L4, Villa Rosario, Sindalan, San Fernando, Pampanga",
    position: currentUser?.section ? `Adviser, ${currentUser.section}` : currentUser?.role || "Teacher",
    course: "BSED Major in Mathematics",
    rank: currentUser?.role || "Teacher II",
    lastPromoted: "2023-11-15", // yyyy-mm-dd
  };

  const trainings = [
    { title: "National Seminar on 21st Century Math", year: 2025, duration: "3 days", category: "National Level" },
    { title: "Regional Training for E-Learning Integration", year: 2024, duration: "5 days", category: "Regional Level" },
    { title: "INSET: Action Research Writing Workshop", year: 2024, duration: "2 days", category: "School Level" },
  ];

  // Date-diff logic
  const now = new Date();
  const promotedDate = new Date(teacher.lastPromoted);
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
    <div style={{ flex: 1, padding: 32, overflowY: "auto", background: "transparent", display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* HEADER */}
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces',serif", margin: "0 0 4px" }}>My Profile</h2>
        <div style={{ fontSize: 13, color: C.t3 }}>Personal Data Sheet and Promotion Tracking</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        
        {/* LEFT COLUMN: PDS & Trainings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Personal Data Sheet */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={16} color={C.m700} />
                </div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.t1 }}>Personal Data Sheet</h3>
              </div>
              <label style={{ cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <div style={{ width:64, height:64, borderRadius:32, background:C.m50, border:`2px solid ${C.borderMed}`, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                  {photoUrl ? <img src={photoUrl} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <User size={24} color={C.m700} />}
                  <div style={{ position:"absolute", bottom:0, width:"100%", height:20, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Camera size={12} color="#fff" />
                  </div>
                </div>
                <span style={{ fontSize:9, fontWeight:600, color:C.m700, textTransform:"uppercase" }}>Update Photo</span>
                <input type="file" style={{ display:"none" }} accept="image/*" onChange={handlePhotoUpload} />
              </label>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 16px" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Full Name</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{teacher.name}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Age</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{teacher.age} years old</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Address</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{teacher.address}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Current Position</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{teacher.position}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Educational Course</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{teacher.course}</div>
              </div>
            </div>
          </div>

          {/* Training & Seminars */}
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.borderMed}`, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={16} color={C.m700} />
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.t1 }}>Trainings & Seminars Attended</h3>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.m50 }}>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Title</th>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Year</th>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Duration</th>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase" }}>Category</th>
                </tr>
              </thead>
              <tbody>
                {trainings.map((t, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.borderMed}` }}>
                    <td style={{ padding: "14px 24px", fontSize: 12, fontWeight: 600, color: C.t1 }}>{t.title}</td>
                    <td style={{ padding: "14px 24px", fontSize: 12, color: C.t2 }}>{t.year}</td>
                    <td style={{ padding: "14px 24px", fontSize: 12, color: C.t2 }}>{t.duration}</td>
                    <td style={{ padding: "14px 24px", fontSize: 12, color: C.t2 }}>
                      <span style={{ padding: "4px 8px", background: t.category.includes("National") ? C.m50 : C.paper, border: `1px solid ${C.borderMed}`, borderRadius: 4, fontWeight: 600 }}>{t.category}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        {/* RIGHT COLUMN: Promotion Tracker */}
        <div>
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 24, position: "sticky", top: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Award size={16} color={C.m700} />
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.t1 }}>Promotion Status</h3>
            </div>

            <div style={{ padding: 16, borderRadius: 8, background: promoBgColor, border: `1px solid ${promoStatusColor}40`, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {promoIcon}
                <div style={{ fontSize: 13, fontWeight: 700, color: promoStatusColor }}>{promoText}</div>
              </div>
              <div style={{ fontSize: 11, color: C.t2, marginLeft: 26 }}>
                Time since last promotion: <strong>{formatYearsMonths(diffYears)}</strong>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Teacher Name</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{teacher.name}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Current Rank</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{teacher.rank}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Last Year Promoted</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
                  {new Date(teacher.lastPromoted).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>
            
          </div>
        </div>
          <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 24, marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Lock size={16} color={C.m700} />
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.t1 }}>Security</h3>
            </div>
            <div style={{ fontSize: 11, color: C.t2, marginBottom: 12 }}>Change your account password</div>
            <input type="password" placeholder="New Password" value={pwInput} onChange={e=>setPwInput(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 4, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, marginBottom: 12, boxSizing: "border-box" }} />
            <button onClick={handlePasswordChange} style={{ width: "100%", padding: "8px", background: C.m700, color: "#fff", border: "none", borderRadius: 4, fontWeight: 700, cursor: "pointer" }}>Update Password</button>
          </div>


      </div>
    </div>
  );
}
