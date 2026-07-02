import { QKey, QData } from '../types';

export const SECTION_GRADES: Record<string, {id:number,surname:string,first:string,subject:string,avg:number,status:string}[]> = {
  "Rizal (Gr.8)": [
    {id:1, surname:"Aguilar",      first:"Liza Marie",   subject:"Mathematics 8",  avg:88.1, status:"Passed"},
    {id:5, surname:"Espino",       first:"Hannah Grace",  subject:"Mathematics 8",  avg:68.5, status:"Failing"},
    {id:2, surname:"Bondoc",       first:"Ramon Jr.",     subject:"Mathematics 8",  avg:73.8, status:"At Risk"},
    {id:8, surname:"Hernandez",    first:"Mark Ryan",     subject:"Mathematics 8",  avg:71.0, status:"Failing"},
    {id:5, surname:"Espino",       first:"Hannah Grace",  subject:"Science 8",      avg:72.1, status:"At Risk"},
    {id:3, surname:"Cruz",         first:"Trisha Ann",    subject:"Mathematics 8",  avg:93.1, status:"Passed"},
    {id:6, surname:"Ferrer",       first:"Joshua",        subject:"Mathematics 8",  avg:90.3, status:"Passed"},
  ],
};

export const Q_SEED: Record<QKey, QData> = {
  Q1: {
    wwItems: [{id:"ww1",label:"WW 1",max:50},{id:"ww2",label:"WW 2",max:30},{id:"ww3",label:"WW 3",max:25}],
    ptItems: [{id:"pt1",label:"PT 1",max:100},{id:"pt2",label:"PT 2",max:60}],
    qaMax: 100,
    grades: {
      1:{ww1:"46",ww2:"28",ww3:"22", pt1:"91",pt2:"54", qa:"88"},
      2:{ww1:"36",ww2:"18",ww3:"16", pt1:"72",pt2:"40", qa:"70"},
      3:{ww1:"49",ww2:"29",ww3:"24", pt1:"96",pt2:"58", qa:"95"},
      4:{ww1:"42",ww2:"24",ww3:"20", pt1:"83",pt2:"48", qa:"82"},
      5:{ww1:"28",ww2:"14",ww3:"12", pt1:"64",pt2:"35", qa:"65"},
      6:{ww1:"45",ww2:"26",ww3:"21", pt1:"90",pt2:"52", qa:"90"},
      7:{ww1:"38",ww2:"20",ww3:"18", pt1:"78",pt2:"42", qa:"78"},
      8:{ww1:"32",ww2:"16",ww3:"14", pt1:"70",pt2:"38", qa:"70"}
    }
  },
  Q2: { wwItems: [], ptItems: [], qaMax: 100, grades: {} },
  Q3: { wwItems: [], ptItems: [], qaMax: 100, grades: {} }
};

export const GB_ROSTER = [
  { id:1,  surname:"Aguilar",      first:"Liza Marie"   },
  { id:2,  surname:"Bondoc",       first:"Ramon Jr."    },
  { id:3,  surname:"Cruz",         first:"Trisha Ann"   },
  { id:4,  surname:"Delos Reyes",  first:"Daniel"       },
  { id:5,  surname:"Espino",       first:"Hannah Grace" },
  { id:6,  surname:"Ferrer",       first:"Joshua"       },
  { id:7,  surname:"Gomez",        first:"Angelica"     },
  { id:8,  surname:"Hernandez",    first:"Mark Ryan"    },
];

export const CERTS = [
  { title:"Regional Training on 21st Century Teaching",level:"Regional",  hours:16, date:"Mar 2025", points:4 },
  { title:"Division LAC — Numeracy Intervention",     level:"Division",  hours:8,  date:"Feb 2025", points:2 },
  { title:"School-based INSET — ICT Integration",     level:"School",    hours:6,  date:"Jan 2025", points:1.5 },
  { title:"National Summit on K-12 Curriculum",       level:"National",  hours:24, date:"Nov 2024", points:6 },
  { title:"District Science Fair Juror",              level:"District",  hours:8,  date:"Sep 2024", points:2 },
];

export const SEMINARS = [
  { date:"Jun 17", title:"Regional ICT Tools Seminar",   level:"Regional", status:"confirmed" },
  { date:"Jun 13", title:"LAC Session — Numeracy",       level:"School",   status:"confirmed" },
  { date:"Jul 3",  title:"Division Summer Reading Camp", level:"Division", status:"pending"   },
  { date:"Jul 15", title:"National Teachers Conference", level:"National", status:"pending"   },
];

export const ATT_DATES = [2,3,4,5,6,9,10,11,12,13,16,17,18,19,20,23,24,25,26,27,30,31];

export const ATT_STATUS_SEED: Record<number,Record<number,"P"|"A"|"L">> = {
  1:{2:"P",3:"P",4:"P",5:"P",6:"P",9:"P",10:"P",11:"L",12:"P",13:"P",16:"P",17:"P",18:"P",19:"P",20:"P",23:"P",24:"P",25:"P",26:"P",27:"P",30:"P",31:"P"},
  2:{2:"P",3:"P",4:"A",5:"P",6:"P",9:"P",10:"P",11:"P",12:"P",13:"P",16:"P",17:"A",18:"P",19:"P",20:"P",23:"P",24:"P",25:"P",26:"P",27:"P",30:"P",31:"P"},
  3:{2:"P",3:"P",4:"P",5:"P",6:"P",9:"P",10:"P",11:"P",12:"P",13:"P",16:"P",17:"P",18:"P",19:"P",20:"P",23:"P",24:"P",25:"P",26:"P",27:"P",30:"P",31:"P"},
  4:{2:"P",3:"P",4:"P",5:"L",6:"P",9:"P",10:"P",11:"P",12:"P",13:"P",16:"P",17:"P",18:"P",19:"P",20:"P",23:"P",24:"P",25:"P",26:"P",27:"P",30:"P",31:"P"},
  5:{2:"P",3:"A",4:"A",5:"A",6:"P",9:"L",10:"P",11:"P",12:"P",13:"P",16:"A",17:"P",18:"L",19:"P",20:"P",23:"P",24:"P",25:"A",26:"P",27:"P",30:"P",31:"P"},
  6:{2:"P",3:"P",4:"P",5:"P",6:"P",9:"P",10:"P",11:"P",12:"P",13:"P",16:"P",17:"P",18:"P",19:"P",20:"P",23:"P",24:"P",25:"P",26:"P",27:"P",30:"P",31:"P"},
  7:{2:"P",3:"P",4:"P",5:"P",6:"P",9:"P",10:"P",11:"L",12:"P",13:"P",16:"P",17:"P",18:"P",19:"A",20:"P",23:"P",24:"P",25:"P",26:"P",27:"P",30:"P",31:"P"},
  8:{2:"L",3:"P",4:"P",5:"P",6:"P",9:"L",10:"P",11:"P",12:"P",13:"P",16:"P",17:"P",18:"P",19:"P",20:"P",23:"P",24:"P",25:"P",26:"P",27:"A",30:"P",31:"P"},
};

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
  { name:"Filipino",                      short:"Filipino",  q1:85, q2:88, q3:86 },
  { name:"English",                       short:"English",   q1:88, q2:90, q3:87 },
  { name:"Mathematics",                   short:"Math",      q1:74, q2:78, q3:71 },
  { name:"Science",                       short:"Science",   q1:91, q2:93, q3:90 },
  { name:"Araling Panlipunan",            short:"A.P.",      q1:90, q2:92, q3:91 },
  { name:"Technology & Livelihood Educ.", short:"TLE",       q1:88, q2:90, q3:87 },
  { name:"MAPEH",                         short:"MAPEH",     q1:92, q2:94, q3:93 },
  { name:"Edukasyon sa Pagpapakatao",     short:"EsP",       q1:95, q2:96, q3:94 },
];

export const QR_LOG = [
  { time:"7:05 AM", name:"Cruz, Trisha Ann",      lrn:"200003", type:"Tap in",  status:"P" as const },
  { time:"7:08 AM", name:"Ferrer, Joshua",         lrn:"200006", type:"Tap in",  status:"P" as const },
  { time:"7:12 AM", name:"Gomez, Angelica",        lrn:"200007", type:"Tap in",  status:"P" as const },
  { time:"7:19 AM", name:"Aguilar, Liza Marie",    lrn:"200001", type:"Tap in",  status:"P" as const },
  { time:"7:23 AM", name:"Delos Reyes, Daniel",    lrn:"200004", type:"Tap in",  status:"P" as const },
  { time:"7:38 AM", name:"Hernandez, Mark Ryan",   lrn:"200008", type:"Tap in",  status:"L" as const },
  { time:"7:45 AM", name:"Kabiling, Sheena Mae",   lrn:"200011", type:"Tap in",  status:"L" as const },
  { time:"7:51 AM", name:"Lim, Michael",           lrn:"200012", type:"Tap in",  status:"L" as const },
  { time:"8:02 AM", name:"Ibarra, Camille",        lrn:"200009", type:"Tap in",  status:"P" as const },
];

export const P_TEACHERS = [
  { name:"Navarro, Pedro M.",   rank:"Master Teacher II", years:2, grade:7,  sections:["7-Makulay","7-Matapat"],  subjects:["Mathematics 7","Science 7"],  advisory:"7-Makulay",  status:"amber" },
  { name:"Batac, Lara B.",      rank:"Teacher III",       years:3, grade:7,  sections:["7-Masaya"],               subjects:["Filipino 7","EsP 7"],          advisory:null,         status:"red"   },
  { name:"Soriano, Ana R.",     rank:"Teacher I",         years:1, grade:8,  sections:["8-Rizal"],                subjects:["Filipino 8","MAPEH 8"],        advisory:"8-Rizal",    status:"green" },
  { name:"Panlilio, Jose L.",   rank:"Teacher II",        years:2, grade:8,  sections:["8-Rizal","8-Aguinaldo"],  subjects:["Mathematics 8"],               advisory:null,         status:"amber" },
  { name:"Santiago, Ramon F.",  rank:"Teacher III",       years:1, grade:9,  sections:["9-Einstein"],             subjects:["Science 9","Mathematics 9"],   advisory:"9-Einstein", status:"green" },
  { name:"Reyes, Maria C.",     rank:"Teacher II",        years:3, grade:9,  sections:["9-Einstein","9-Newton"],  subjects:["English 9","AP 9"],            advisory:null,         status:"red"   },
  { name:"Dela Cruz, Cynthia",  rank:"Master Teacher I",  years:3, grade:10, sections:["10-Pilot"],               subjects:["English 10","AP 10"],          advisory:"10-Pilot",   status:"red"   },
  { name:"Santos, Dr. Maria",   rank:"Teacher III",       years:2, grade:10, sections:["10-Pilot","10-Horizon"],  subjects:["Mathematics 10"],              advisory:null,         status:"amber" },
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
  { name:"Ocampo, Renz Adrian",   section:"10-Pilot",   reason:"Academic",   type:"Behavior",  urgency:"urgent",    status:"Under investigation" },
  { name:"Espino, Hannah Grace",  section:"8-Rizal",    reason:"Attendance", type:"Guidance",  urgency:"monitoring", status:"Referral pending" },
  { name:"Bondoc, Ramon Jr.",     section:"8-Rizal",    reason:"Academic",   type:"Guidance",  urgency:"monitoring", status:"Counseling" },
  { name:"Reyes, Carlo Jose",     section:"9-Einstein", reason:"Academic",   type:"Behavior",  urgency:"urgent",    status:"Parent notified" },
];

export const P_INVENTORY = [
  { item:"Desktop Computers",     cat:"ICT",    qty:42,  cond:"Functional",    loc:"Computer Lab",   status:"Good" },
  { item:"Projectors",            cat:"ICT",    qty:8,   cond:"Functional",    loc:"Various rooms",  status:"Good" },
  { item:"Science Lab Equipment", cat:"Science",qty:1,   cond:"Under Repair",  loc:"Science Lab",    status:"Repair" },
  { item:"Library Books",         cat:"Library",qty:1240,cond:"Mixed",         loc:"Library",        status:"Good" },
  { item:"Office Printer",        cat:"Office", qty:1,   cond:"Under Repair",  loc:"Principal Office",status:"Repair"},
  { item:"Sports Equipment Set",  cat:"PE",     qty:3,   cond:"Borrowed",      loc:"Brgy. Council",  status:"Borrowed"},
];
