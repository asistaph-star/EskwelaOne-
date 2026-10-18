import { TermKey, TermData, ClinicStudent, ClinicVisit } from '../types';

export const SECTION_GRADES: Record<string, {id:number,surname:string,first:string,subject:string,avg:number,status:string}[]> = {
  "Rizal (Gr.8)": [
    {id:1, surname:"Aguilar",      first:"Liza Marie",   subject:"Mathematics 8",  avg:88.1, status:"Passed"},
    {id:2, surname:"Bondoc",       first:"Ramon Jr.",    subject:"Mathematics 8",  avg:76.8, status:"At Risk"},
    {id:3, surname:"Cruz",         first:"Trisha Ann",   subject:"Mathematics 8",  avg:93.1, status:"Passed"},
    {id:4, surname:"Delos Reyes",  first:"Daniel",       subject:"Mathematics 8",  avg:89.0, status:"Passed"},
    {id:5, surname:"Espino",       first:"Hannah Grace", subject:"Mathematics 8",  avg:68.5, status:"Failing"},
    {id:6, surname:"Ferrer",       first:"Joshua",       subject:"Mathematics 8",  avg:90.3, status:"Passed"},
    {id:7, surname:"Gomez",        first:"Angelica",     subject:"Mathematics 8",  avg:91.2, status:"Passed"},
    {id:8, surname:"Hernandez",    first:"Mark Ryan",    subject:"Mathematics 8",  avg:71.0, status:"Failing"},
  ],
  "Einstein (Gr.9)": [
    {id:9,  surname:"Mendoza",      first:"Kevin",        subject:"Science 9",      avg:77.5, status:"At Risk"},
    {id:10, surname:"Tolentino",    first:"Bianca",       subject:"Science 9",      avg:85.0, status:"Passed"},
    {id:11, surname:"Bautista",     first:"Paulo",        subject:"Science 9",      avg:69.2, status:"Failing"},
    {id:12, surname:"Navarro",      first:"Chloe",        subject:"Science 9",      avg:91.5, status:"Passed"},
  ],
  "Pilot (Gr.10)": [
    {id:13, surname:"Garcia",       first:"Ana Kristine", subject:"Filipino 10",    avg:95.2, status:"Passed"},
    {id:14, surname:"Santos",       first:"Juan Miguel",  subject:"Filipino 10",    avg:89.5, status:"Passed"},
    {id:15, surname:"Ocampo",       first:"Renz Adrian",  subject:"Filipino 10",    avg:75.2, status:"At Risk"},
    {id:16, surname:"Rivera",       first:"Miguel",       subject:"Filipino 10",    avg:68.0, status:"Failing"},
  ]
};



export const CERTS = [
  { title:"Regional Training on 21st Century Teaching",level:"Regional",  hours:16, date:"Mar 2025", points:4 },
  { title:"Division LAC - Numeracy Intervention",     level:"Division",  hours:8,  date:"Feb 2025", points:2 },
  { title:"School-based INSET - ICT Integration",     level:"School",    hours:6,  date:"Jan 2025", points:1.5 },
  { title:"National Summit on K-12 Curriculum",       level:"National",  hours:24, date:"Nov 2024", points:6 },
  { title:"District Science Fair Juror",              level:"District",  hours:8,  date:"Sep 2024", points:2 },
];

export const SEMINARS = [
  { date:"Jun 17", title:"Regional ICT Tools Seminar",   level:"Regional", status:"confirmed" },
  { date:"Jun 13", title:"LAC Session - Numeracy",       level:"School",   status:"confirmed" },
  { date:"Jul 3",  title:"Division Summer Reading Camp", level:"Division", status:"pending"   },
  { date:"Jul 15", title:"National Teachers Conference", level:"National", status:"pending"   },
];

// Mock constants moved/removed

export const BAR_DATA = [
  { subject:"Math",avg:82}, {subject:"Science",avg:88}, {subject:"English",avg:86},
  {subject:"Filipino",avg:83}, {subject:"AP",avg:89}, {subject:"MAPEH",avg:91},
];

export const PIE_DATA = [
  { name:"Passed (≥75)", value:28, color: "hsl(142, 76%, 36%)" },
  { name:"Conditional",  value:5,  color: "hsl(38, 92%, 50%)" },
  { name:"Failed (<75)", value:6,  color: "hsl(0, 84%, 60%)" },
];

export const TREND_DATA = [
  {week:"Wk1",att:92},{week:"Wk2",att:94},{week:"Wk3",att:89},
  {week:"Wk4",att:95},{week:"Wk5",att:91},{week:"Wk6",att:96},
];

export const RC_SUBJECTS = [
  { name:"Filipino",                      short:"Filipino",  term1:85, term2:88, term3:86 },
  { name:"English",                       short:"English",   term1:88, term2:90, term3:87 },
  { name:"Mathematics",                   short:"Math",      term1:74, term2:78, term3:71 },
  { name:"Science",                       short:"Science",   term1:91, term2:93, term3:90 },
  { name:"Araling Panlipunan",            short:"A.P.",      term1:90, term2:92, term3:91 },
  { name:"Technology & Livelihood Educ.", short:"TLE",       term1:88, term2:90, term3:87 },
  { name:"MAPEH",                         short:"MAPEH",     term1:92, term2:94, term3:93 },
  { name:"Edukasyon sa Pagpapakatao",     short:"EsP",       term1:95, term2:96, term3:94 },
];

export const P_TEACHERS = [
  { name:"Navarro, Pedro M.",   rank:"Master Teacher II", years:2, grade:7,  sections:["7 Makulay","7 Matapat"],  subjects:["Mathematics 7","Science 7"],  advisory:"7 Makulay",  status:"amber" },
  { name:"Batac, Lara B.",      rank:"Teacher III",       years:3, grade:7,  sections:["7 Masaya"],               subjects:["Filipino 7","EsP 7"],          advisory:null,         status:"red"   },
  { name:"Soriano, Ana R.",     rank:"Teacher I",         years:1, grade:8,  sections:["8 Rizal"],                subjects:["Filipino 8","MAPEH 8"],        advisory:"8 Rizal",    status:"green" },
  { name:"Panlilio, Jose L.",   rank:"Teacher II",        years:2, grade:8,  sections:["8 Rizal","8 Aguinaldo"],  subjects:["Mathematics 8"],               advisory:null,         status:"amber" },
  { name:"Santiago, Ramon F.",  rank:"Teacher III",       years:1, grade:9,  sections:["9 Einstein"],             subjects:["Science 9","Mathematics 9"],   advisory:"9 Einstein", status:"green" },
  { name:"Reyes, Maria C.",     rank:"Teacher II",        years:3, grade:9,  sections:["9 Einstein","9 Newton"],  subjects:["English 9","AP 9"],            advisory:null,         status:"red"   },
  { name:"Dela Cruz, Cynthia",  rank:"Master Teacher I",  years:3, grade:10, sections:["10 Pilot"],               subjects:["English 10","AP 10"],          advisory:"10 Pilot",   status:"red"   },
  { name:"Santos, Dr. Maria",   rank:"Teacher III",       years:2, grade:10, sections:["10 Pilot","10 Horizon"],  subjects:["Mathematics 10"],              advisory:null,         status:"amber" },
];

export const P_GATE_LOG = [
  { name:"Santos, Juan Miguel",     section:"Gr.10 Pilot",   time:"7:05 AM", dir:"In"  },
  { name:"Garcia, Ana Kristine",    section:"Gr.10 Pilot",   time:"7:08 AM", dir:"In"  },
  { name:"Aguilar, Liza Marie",     section:"Gr.8 Rizal",    time:"7:11 AM", dir:"In"  },
  { name:"Cruz, Trisha Ann",        section:"Gr.8 Rizal",    time:"7:14 AM", dir:"In"  },
  { name:"Espino, Hannah Grace",    section:"Gr.8 Rizal",    time:"7:38 AM", dir:"In",  late:true },
  { name:"Bondoc, Ramon Jr.",       section:"Gr.8 Rizal",    time:"7:41 AM", dir:"In",  late:true },
  { name:"Torres, Bea Angelica",    section:"Gr.9 Einstein", time:"7:19 AM", dir:"In"  },
  { name:"Hernandez, Mark Ryan",    section:"Gr.8 Rizal",    time:"11:42 AM",dir:"Out" },
  { name:"Ferrer, Joshua",          section:"Gr.8 Rizal",    time:"3:25 PM", dir:"Out" },
];

export const P_WELFARE = [
  { name:"Ocampo, Renz Adrian",   section:"10 Pilot",   reason:"Academic",   type:"Behavior",  urgency:"urgent",    status:"Under investigation" },
  { name:"Espino, Hannah Grace",  section:"8 Rizal",    reason:"Attendance", type:"Guidance",  urgency:"monitoring", status:"Referral pending" },
  { name:"Bondoc, Ramon Jr.",     section:"8 Rizal",    reason:"Academic",   type:"Guidance",  urgency:"monitoring", status:"Counseling" },
  { name:"Reyes, Carlo Jose",     section:"9 Einstein", reason:"Academic",   type:"Behavior",  urgency:"urgent",    status:"Parent notified" },
];

export const CLINIC_STUDENTS: ClinicStudent[] = [
  { id: "S-001", name: "Aguilar, Liza Marie", grade: "8", section: "Rizal", bloodType: "O+", allergies: "Peanuts", emergencyContact: "Maria Aguilar (0917-123-4567)", medicalConditions: "None" },
  { id: "S-002", name: "Bondoc, Ramon Jr.", grade: "8", section: "Rizal", bloodType: "A+", allergies: "None", emergencyContact: "Ramon Bondoc Sr. (0918-987-6543)", medicalConditions: "Asthma" },
  { id: "S-003", name: "Cruz, Trisha Ann", grade: "8", section: "Rizal", bloodType: "B+", allergies: "Dust", emergencyContact: "Elena Cruz (0920-111-2222)", medicalConditions: "None" },
  { id: "S-004", name: "Delos Reyes, Daniel", grade: "8", section: "Rizal", bloodType: "AB+", allergies: "None", emergencyContact: "Pedro Delos Reyes (0919-333-4444)", medicalConditions: "None" },
  { id: "S-005", name: "Espino, Hannah Grace", grade: "8", section: "Rizal", bloodType: "O-", allergies: "Seafood", emergencyContact: "Grace Espino (0921-555-6666)", medicalConditions: "Anemia" },
  { id: "S-006", name: "Santos, Juan Miguel", grade: "10", section: "Pilot", bloodType: "A+", allergies: "None", emergencyContact: "Miguel Santos (0917-777-8888)", medicalConditions: "None" },
  { id: "S-007", name: "Garcia, Ana Kristine", grade: "10", section: "Pilot", bloodType: "O+", allergies: "Aspirin", emergencyContact: "Ana Garcia (0918-999-0000)", medicalConditions: "Migraines" },
];

export const CLINIC_VISITS_SEED: ClinicVisit[] = [
  {
    id: "V-1001",
    studentId: "S-002",
    date: "2026-06-25",
    time: "10:30 AM",
    symptoms: "Shortness of breath, wheezing",
    diagnoses: "Mild Asthma Attack",
    medications: "Salbutamol Nebulizer",
    treatments: "15 mins nebulization, observed for 30 mins",
    vitalSigns: { temperature: "36.8°C", bloodPressure: "110/70", heartRate: "98 bpm" },
    notes: "Patient responded well to nebulization. Instructed to rest."
  },
  {
    id: "V-1002",
    studentId: "S-005",
    date: "2026-06-26",
    time: "01:15 PM",
    symptoms: "Dizziness, pale skin",
    diagnoses: "Suspected Anemia fatigue",
    medications: "None",
    treatments: "Given water and allowed to rest on the clinic bed for 1 hour.",
    vitalSigns: { temperature: "36.5°C", bloodPressure: "90/60", heartRate: "72 bpm" },
    notes: "Mother was called to fetch the student. Advised to take iron supplements."
  },
  {
    id: "V-1003",
    studentId: "S-007",
    date: "2026-07-02",
    time: "09:45 AM",
    symptoms: "Throbbing headache, sensitivity to light",
    diagnoses: "Migraine",
    medications: "Paracetamol 500mg",
    treatments: "Cold compress on forehead, rested in dark room.",
    vitalSigns: { temperature: "36.7°C", bloodPressure: "120/80", heartRate: "80 bpm" },
    notes: "Student felt better after 45 mins. Returned to class."
  }
];
