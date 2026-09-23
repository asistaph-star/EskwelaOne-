import { TermKey, TermData, GbItem, GbGrades, SubjectHistory, GradeRecord } from '../types';
import { gradeAvg } from './helpers';

export interface SubjectGrade {
  name: string;
  short: string;
  classId: string;
  term1: number;
  term2: number;
  term3: number;
  term4?: number;
}

export interface QuizScoreItem {
  s: string;
  q: string;
  score: string;
  pct: number;
}

export const GRADE10_SUBJECT_DEFS = [
  { id: "filipino", name: "Filipino", short: "Filipino", classId: "3" },
  { id: "english", name: "English", short: "English", classId: "class-10-english" },
  { id: "math", name: "Mathematics", short: "Mathematics", classId: "class-10-math" },
  { id: "science", name: "Science", short: "Science", classId: "class-10-science" },
  { id: "ap", name: "Araling Panlipunan", short: "Araling Panlipunan", classId: "class-10-ap" },
  { id: "tle", name: "Technology & Livelihood Educ.", short: "TLE", classId: "class-10-tle" },
  { id: "mapeh", name: "MAPEH", short: "MAPEH", classId: "class-10-mapeh" },
  { id: "esp", name: "Edukasyon sa Pagpapakatao", short: "EsP", classId: "class-10-esp" },
];

/**
 * Initial standard Grade 10 gradebooks seed dataset.
 * Contains authentic Written Work (WW), Performance Tasks (PT), and Assessment (QA)
 * for student canonical ID 's-juan' (and legacy ID 14).
 */
export const INITIAL_GRADE10_GRADEBOOKS: Record<string, Record<TermKey, TermData>> = {
  // Filipino 10 (Class ID 3)
  "3": {
    T1: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: El Filibusterismo", max: 15 },
        { id: "ww2", label: "WW 2: Sanaysay at Talumpati", max: 30 },
        { id: "ww3", label: "WW 3: Balarila at Bokabularyo", max: 25 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Pagsulat ng Maikling Kwento", max: 100 },
        { id: "pt2", label: "PT 2: Masining na Pagbigkas", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "15", ww2: "28", ww3: "22", pt1: "91", pt2: "54", qa: "88" },
        "14": { ww1: "15", ww2: "28", ww3: "22", pt1: "91", pt2: "54", qa: "88" }
      }
    },
    T2: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Panitikan ng Mediterranean", max: 30 },
        { id: "ww2", label: "WW 2: Pagsusuri ng Akda", max: 25 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Dula-dulaan", max: 100 },
        { id: "pt2", label: "PT 2: Pangkatang Gawain", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "28", ww2: "24", pt1: "92", pt2: "56", qa: "90" },
        "14": { ww1: "28", ww2: "24", pt1: "92", pt2: "56", qa: "90" }
      }
    },
    T3: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Nobela at Tula", max: 30 },
        { id: "ww2", label: "WW 2: Pagsulat ng Editoryal", max: 25 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Portfolio ng mga Akda", max: 100 },
        { id: "pt2", label: "PT 2: Sabayang Pagbigkas", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "27", ww2: "23", pt1: "90", pt2: "55", qa: "89" },
        "14": { ww1: "27", ww2: "23", pt1: "90", pt2: "55", qa: "89" }
      }
    },
    T4: { wwItems: [], ptItems: [], qaMax: 100, grades: {} }
  },

  // English 10
  "class-10-english": {
    T1: {
      wwItems: [
        { id: "ww1", label: "Pop Quiz: Grammar & Syntax", max: 10 },
        { id: "ww2", label: "WW 2: Literary Elements Analysis", max: 30 },
        { id: "ww3", label: "WW 3: Argumentative Structure", max: 25 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Persuasive Speech Delivery", max: 100 },
        { id: "pt2", label: "PT 2: Research Draft", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "9", ww2: "28", ww3: "23", pt1: "90", pt2: "55", qa: "89" },
        "14": { ww1: "9", ww2: "28", ww3: "23", pt1: "90", pt2: "55", qa: "89" }
      }
    },
    T2: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: World Literature", max: 10 },
        { id: "ww2", label: "WW 2: Expository Writing", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Group Debate Session", max: 100 },
        { id: "pt2", label: "PT 2: Term Essay", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "10", ww2: "29", pt1: "91", pt2: "56", qa: "91" },
        "14": { ww1: "10", ww2: "29", pt1: "91", pt2: "56", qa: "91" }
      }
    },
    T3: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Public Speaking Skills", max: 10 },
        { id: "ww2", label: "WW 2: Critique Paper", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Panel Presentation", max: 100 },
        { id: "pt2", label: "PT 2: Final Portfolio", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "9", ww2: "27", pt1: "88", pt2: "54", qa: "88" },
        "14": { ww1: "9", ww2: "27", pt1: "88", pt2: "54", qa: "88" }
      }
    },
    T4: { wwItems: [], ptItems: [], qaMax: 100, grades: {} }
  },

  // Mathematics 10
  "class-10-math": {
    T1: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Algebra & Polynomials", max: 20 },
        { id: "ww2", label: "WW 2: Arithmetic Sequences", max: 30 },
        { id: "ww3", label: "WW 3: Geometric Sequences", max: 25 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Real-life Sequence Modeling", max: 100 },
        { id: "pt2", label: "PT 2: Problem Solving Portfolio", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "18", ww2: "24", ww3: "20", pt1: "82", pt2: "48", qa: "82" },
        "14": { ww1: "18", ww2: "24", ww3: "20", pt1: "82", pt2: "48", qa: "82" }
      }
    },
    T2: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Polynomial Functions", max: 20 },
        { id: "ww2", label: "WW 2: Circles & Coordinate Geometry", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Geometric Proof Construction", max: 100 },
        { id: "pt2", label: "PT 2: Applied Geometry Project", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "19", ww2: "26", pt1: "85", pt2: "52", qa: "84" },
        "14": { ww1: "19", ww2: "26", pt1: "85", pt2: "52", qa: "84" }
      }
    },
    T3: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Combinatorics & Permutations", max: 20 },
        { id: "ww2", label: "WW 2: Probability Concepts", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Statistical Probability Survey", max: 100 },
        { id: "pt2", label: "PT 2: Math Investigation Report", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "18", ww2: "25", pt1: "83", pt2: "50", qa: "81" },
        "14": { ww1: "18", ww2: "25", pt1: "83", pt2: "50", qa: "81" }
      }
    },
    T4: { wwItems: [], ptItems: [], qaMax: 100, grades: {} }
  },

  // Science 10
  "class-10-science": {
    T1: {
      wwItems: [
        { id: "ww1", label: "Quiz 2: Physics & Electromagnetism", max: 25 },
        { id: "ww2", label: "WW 2: Plate Tectonics & Earthquakes", max: 30 },
        { id: "ww3", label: "WW 3: Mountain Formation & Volcanism", max: 25 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Disaster Preparedness Map", max: 100 },
        { id: "pt2", label: "PT 2: Laboratory Experiment Report", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "24", ww2: "29", ww3: "24", pt1: "95", pt2: "58", qa: "94" },
        "14": { ww1: "24", ww2: "29", ww3: "24", pt1: "95", pt2: "58", qa: "94" }
      }
    },
    T2: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Electromagnetic Spectrum", max: 25 },
        { id: "ww2", label: "WW 2: Light and Optics", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Optical Instrument Model", max: 100 },
        { id: "pt2", label: "PT 2: Ray Diagram Analysis", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "25", ww2: "30", pt1: "97", pt2: "59", qa: "96" },
        "14": { ww1: "25", ww2: "30", pt1: "97", pt2: "59", qa: "96" }
      }
    },
    T3: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Hormonal System & Feedback", max: 25 },
        { id: "ww2", label: "WW 2: Heredity & Genetic Mutations", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: DNA Model & Transcription", max: 100 },
        { id: "pt2", label: "PT 2: Ecology Capstone Proposal", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "24", ww2: "29", pt1: "94", pt2: "57", qa: "93" },
        "14": { ww1: "24", ww2: "29", pt1: "94", pt2: "57", qa: "93" }
      }
    },
    T4: { wwItems: [], ptItems: [], qaMax: 100, grades: {} }
  },

  // Araling Panlipunan 10
  "class-10-ap": {
    T1: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Kontemporaryong Isyu", max: 25 },
        { id: "ww2", label: "WW 2: Suliraning Pangkapaligiran", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Disaster Risk Action Plan", max: 100 },
        { id: "pt2", label: "PT 2: Case Study Analysis", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "24", ww2: "28", pt1: "95", pt2: "58", qa: "93" },
        "14": { ww1: "24", ww2: "28", pt1: "95", pt2: "58", qa: "93" }
      }
    },
    T2: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Globalisasyon at Ekonomiya", max: 25 },
        { id: "ww2", label: "WW 2: Isyu sa Paggawa at Migrasyon", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Documentary Critique", max: 100 },
        { id: "pt2", label: "PT 2: Policy Recommendation", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "25", ww2: "29", pt1: "96", pt2: "59", qa: "95" },
        "14": { ww1: "25", ww2: "29", pt1: "96", pt2: "59", qa: "95" }
      }
    },
    T3: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Karapatang Pantao at Gender", max: 25 },
        { id: "ww2", label: "WW 2: Pagkamamamayan at Sibika", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Community Advocacy Project", max: 100 },
        { id: "pt2", label: "PT 2: Civic Engagement Portfolio", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "24", ww2: "28", pt1: "94", pt2: "57", qa: "93" },
        "14": { ww1: "24", ww2: "28", pt1: "94", pt2: "57", qa: "93" }
      }
    },
    T4: { wwItems: [], ptItems: [], qaMax: 100, grades: {} }
  },

  // Technology & Livelihood Educ. (TLE) 10
  "class-10-tle": {
    T1: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: ICT & Computer Programming", max: 25 },
        { id: "ww2", label: "WW 2: Software Tools & Networking", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Web Development Project", max: 100 },
        { id: "pt2", label: "PT 2: Hardware Assembly Demo", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "23", ww2: "27", pt1: "92", pt2: "55", qa: "91" },
        "14": { ww1: "23", ww2: "27", pt1: "92", pt2: "55", qa: "91" }
      }
    },
    T2: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Database Management", max: 25 },
        { id: "ww2", label: "WW 2: Systems Administration", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Database Implementation", max: 100 },
        { id: "pt2", label: "PT 2: Technical Troubleshooting", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "24", ww2: "28", pt1: "94", pt2: "57", qa: "93" },
        "14": { ww1: "24", ww2: "28", pt1: "94", pt2: "57", qa: "93" }
      }
    },
    T3: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Cybersecurity Basics", max: 25 },
        { id: "ww2", label: "WW 2: Network Security Protocols", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Capstone Technical Portfolio", max: 100 },
        { id: "pt2", label: "PT 2: Practical Skills Assessment", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "23", ww2: "27", pt1: "93", pt2: "56", qa: "92" },
        "14": { ww1: "23", ww2: "27", pt1: "93", pt2: "56", qa: "92" }
      }
    },
    T4: { wwItems: [], ptItems: [], qaMax: 100, grades: {} }
  },

  // MAPEH 10
  "class-10-mapeh": {
    T1: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: 20th Century Music & Arts", max: 25 },
        { id: "ww2", label: "WW 2: Lifestyle and Weight Management", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Music Composition Performance", max: 100 },
        { id: "pt2", label: "PT 2: Physical Fitness Routine", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "25", ww2: "29", pt1: "96", pt2: "58", qa: "95" },
        "14": { ww1: "25", ww2: "29", pt1: "96", pt2: "58", qa: "95" }
      }
    },
    T2: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Afro-Latin American Music", max: 25 },
        { id: "ww2", label: "WW 2: Contemporary Dance Forms", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Dance Routine Performance", max: 100 },
        { id: "pt2", label: "PT 2: Health Trends & Issues Analysis", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "25", ww2: "30", pt1: "98", pt2: "60", qa: "96" },
        "14": { ww1: "25", ww2: "30", pt1: "98", pt2: "60", qa: "96" }
      }
    },
    T3: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Contemporary Philippine Music", max: 25 },
        { id: "ww2", label: "WW 2: Global Health Initiatives", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Mini Theatrical Production", max: 100 },
        { id: "pt2", label: "PT 2: Community Health Project", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "24", ww2: "29", pt1: "95", pt2: "58", qa: "94" },
        "14": { ww1: "24", ww2: "29", pt1: "95", pt2: "58", qa: "94" }
      }
    },
    T4: { wwItems: [], ptItems: [], qaMax: 100, grades: {} }
  },

  // Edukasyon sa Pagpapakatao (EsP) 10
  "class-10-esp": {
    T1: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Mataas na Gamit ng Isip at Kilos-Loob", max: 25 },
        { id: "ww2", label: "WW 2: Ang Dignidad ng Tao", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Paggawa ng Moral Decision Matrix", max: 100 },
        { id: "pt2", label: "PT 2: Pagninilay at Journal", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "25", ww2: "30", pt1: "98", pt2: "60", qa: "97" },
        "14": { ww1: "25", ww2: "30", pt1: "98", pt2: "60", qa: "97" }
      }
    },
    T2: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Paggalang sa Buhay at Sekswalidad", max: 25 },
        { id: "ww2", label: "WW 2: Pananagutan sa Kapwa", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Advocacy Video on Human Dignity", max: 100 },
        { id: "pt2", label: "PT 2: Social Action Plan", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "25", ww2: "30", pt1: "99", pt2: "60", qa: "98" },
        "14": { ww1: "25", ww2: "30", pt1: "99", pt2: "60", qa: "98" }
      }
    },
    T3: {
      wwItems: [
        { id: "ww1", label: "Quiz 1: Pagmamahal sa Diyos at Bayan", max: 25 },
        { id: "ww2", label: "WW 2: Pangangalaga sa Kalikasan", max: 30 }
      ],
      ptItems: [
        { id: "pt1", label: "PT 1: Environmental Stewardship Campaign", max: 100 },
        { id: "pt2", label: "PT 2: Comprehensive Life Plan", max: 60 }
      ],
      qaMax: 100,
      grades: {
        "s-juan": { ww1: "25", ww2: "29", pt1: "97", pt2: "59", qa: "96" },
        "14": { ww1: "25", ww2: "29", pt1: "97", pt2: "59", qa: "96" }
      }
    },
    T4: { wwItems: [], ptItems: [], qaMax: 100, grades: {} }
  }
};

/**
 * Historical academic records for student 's-juan' across Grade 7, Grade 8, Grade 9.
 */
export const JUAN_HISTORICAL_ACADEMIC_RECORDS: SubjectHistory[] = [
  { 
    name: "Filipino",
    gr7: { term1: 88, term2: 86, term3: 89, term4: 87, curriculum: "old" },
    gr8: { term1: 89, term2: 90, term3: 88, curriculum: "new" },
    gr9: { term1: 91, term2: 92, term3: 90, curriculum: "new" }
  },
  { 
    name: "English",
    gr7: { term1: 85, term2: 84, term3: 86, term4: 88, curriculum: "old" },
    gr8: { term1: 87, term2: 88, term3: 87, curriculum: "new" },
    gr9: { term1: 88, term2: 90, term3: 89, curriculum: "new" }
  },
  { 
    name: "Mathematics",
    gr7: { term1: 74, term2: 76, term3: 73, term4: 75, curriculum: "old" },
    gr8: { term1: 76, term2: 78, term3: 75, curriculum: "new" },
    gr9: { term1: 78, term2: 80, term3: 79, curriculum: "new" }
  },
  { 
    name: "Science",
    gr7: { term1: 91, term2: 90, term3: 92, term4: 93, curriculum: "old" },
    gr8: { term1: 92, term2: 93, term3: 91, curriculum: "new" },
    gr9: { term1: 93, term2: 94, term3: 95, curriculum: "new" }
  },
  { 
    name: "Araling Panlipunan",
    gr7: { term1: 90, term2: 89, term3: 91, term4: 90, curriculum: "old" },
    gr8: { term1: 91, term2: 92, term3: 90, curriculum: "new" },
    gr9: { term1: 92, term2: 93, term3: 94, curriculum: "new" }
  },
  { 
    name: "Technology & Livelihood Educ.",
    gr7: { term1: 88, term2: 87, term3: 89, term4: 88, curriculum: "old" },
    gr8: { term1: 89, term2: 90, term3: 88, curriculum: "new" },
    gr9: { term1: 90, term2: 91, term3: 92, curriculum: "new" }
  },
  { 
    name: "MAPEH",
    gr7: { term1: 92, term2: 91, term3: 93, term4: 94, curriculum: "old" },
    gr8: { term1: 93, term2: 94, term3: 92, curriculum: "new" },
    gr9: { term1: 94, term2: 95, term3: 96, curriculum: "new" }
  },
  { 
    name: "Edukasyon sa Pagpapakatao",
    gr7: { term1: 95, term2: 94, term3: 96, term4: 95, curriculum: "old" },
    gr8: { term1: 96, term2: 97, term3: 95, curriculum: "new" },
    gr9: { term1: 97, term2: 98, term3: 96, curriculum: "new" }
  }
];

export function psFor(sid: number | string, items: GbItem[], g: GbGrades): number {
  if (!items || items.length === 0 || !g) return 0;
  const sg = g[sid] ?? g[sid.toString()] ?? {};
  const sumS = items.reduce((s, it) => s + (parseFloat(sg[it.id]) || 0), 0);
  const sumM = items.reduce((s, it) => s + it.max, 0);
  return sumM > 0 ? Math.round((sumS / sumM) * 1000) / 10 : 0;
}

export function computeTermGrade(
  sid: number | string,
  d?: TermData,
  weights = { ww: 25, pt: 50, qa: 25 }
): number {
  if (!d || !d.grades) return 0;
  const sg = d.grades[sid] ?? d.grades[sid.toString()] ?? {};
  const wwPS = psFor(sid, d.wwItems || [], d.grades);
  const ptPS = psFor(sid, d.ptItems || [], d.grades);
  const qaVal = parseFloat(sg.qa) || 0;
  const qaPS = d.qaMax > 0 ? Math.round((qaVal / d.qaMax) * 1000) / 10 : 0;
  return Math.round((wwPS * (weights.ww / 100) + ptPS * (weights.pt / 100) + qaPS * (weights.qa / 100)) * 10) / 10;
}

/**
 * Computes all current subject grades for a student using actual gradebook state.
 */
export function getStudentSubjectGrades(
  studentId: string,
  gradebooks: Record<string, Record<TermKey, TermData>>
): SubjectGrade[] {
  const sid = studentId || "s-juan";

  return GRADE10_SUBJECT_DEFS.map(subDef => {
    // Check if gradebook for this class exists in state, fallback to seed
    const classGb = gradebooks[subDef.classId] || INITIAL_GRADE10_GRADEBOOKS[subDef.classId];

    let t1 = 0;
    let t2 = 0;
    let t3 = 0;
    let t4: number | undefined = undefined;

    if (classGb) {
      t1 = computeTermGrade(sid, classGb.T1);
      t2 = computeTermGrade(sid, classGb.T2);
      t3 = computeTermGrade(sid, classGb.T3);
      if (classGb.T4 && (classGb.T4.wwItems?.length > 0 || Object.keys(classGb.T4.grades || {}).length > 0)) {
        t4 = computeTermGrade(sid, classGb.T4);
      }
    }

    return {
      name: subDef.name,
      short: subDef.short,
      classId: subDef.classId,
      term1: t1,
      term2: t2,
      term3: t3,
      term4: t4
    };
  });
}

/**
 * Builds the full 4-year academic history (Grade 7 - 10) for the student.
 */
export function getStudentFullAcademicHistory(
  studentId: string,
  gradebooks: Record<string, Record<TermKey, TermData>>
): SubjectHistory[] {
  const currentGrades = getStudentSubjectGrades(studentId, gradebooks);

  return JUAN_HISTORICAL_ACADEMIC_RECORDS.map(historyItem => {
    const curr = currentGrades.find(cg => cg.name.toLowerCase() === historyItem.name.toLowerCase());
    const gr10Record: GradeRecord = {
      term1: curr?.term1 || 0,
      term2: curr?.term2 || 0,
      term3: curr?.term3 || 0,
      term4: curr?.term4,
      curriculum: "new"
    };

    return {
      name: historyItem.name,
      gr7: historyItem.gr7,
      gr8: historyItem.gr8,
      gr9: historyItem.gr9,
      gr10: gr10Record
    };
  });
}

/**
 * Computes the real yearly general averages for the line trend chart.
 */
export function getStudentGradeTrend(
  academicHistory: SubjectHistory[]
): { name: string; avg: number }[] {
  const calculateYearAvg = (key: "gr7" | "gr8" | "gr9" | "gr10") => {
    const recs = academicHistory.map(s => s[key]).filter(Boolean) as GradeRecord[];
    if (recs.length === 0) return 0;
    const total = recs.reduce((sum, r) => sum + gradeAvg(r), 0);
    return Math.round((total / recs.length) * 10) / 10;
  };

  return [
    { name: "Grade 7", avg: calculateYearAvg("gr7") },
    { name: "Grade 8", avg: calculateYearAvg("gr8") },
    { name: "Grade 9", avg: calculateYearAvg("gr9") },
    { name: "Grade 10", avg: calculateYearAvg("gr10") }
  ];
}

/**
 * Extracts the student's real quiz/written work assessments from the active gradebooks.
 */
export function getStudentRecentQuizzes(
  studentId: string,
  gradebooks: Record<string, Record<TermKey, TermData>>
): QuizScoreItem[] {
  const sid = studentId || "s-juan";
  const quizzes: QuizScoreItem[] = [];

  for (const subDef of GRADE10_SUBJECT_DEFS) {
    const classGb = gradebooks[subDef.classId] || INITIAL_GRADE10_GRADEBOOKS[subDef.classId];
    if (!classGb) continue;

    // Check T1 first (active term)
    const t1 = classGb.T1;
    if (t1 && t1.wwItems && t1.grades) {
      const studentGrades = t1.grades[sid] ?? t1.grades[sid.toString()] ?? {};
      for (const item of t1.wwItems) {
        const rawScore = studentGrades[item.id];
        if (rawScore !== undefined && rawScore !== "") {
          const numScore = parseFloat(rawScore) || 0;
          const pct = item.max > 0 ? Math.round((numScore / item.max) * 100) : 0;
          quizzes.push({
            s: subDef.short,
            q: item.label,
            score: `${numScore}/${item.max}`,
            pct
          });
        }
      }
    }
  }

  // Return the first 4 most relevant quizzes
  return quizzes.slice(0, 4);
}

/**
 * Calculates the student's ranking and track recommendation from real grade averages.
 */
export function getStudentRankAndStanding(
  currentGenAvg: number
): { rank: number; totalStudents: number; track: string } {
  // In Grade 10 Section Pilot (38 students), section averages range between 75 and 96
  // A student with ~92 average places in Rank 4
  const rank = currentGenAvg >= 95 ? 1 : currentGenAvg >= 93 ? 2 : currentGenAvg >= 91 ? 4 : currentGenAvg >= 88 ? 7 : 12;
  const track = currentGenAvg >= 85 ? "STEM Track" : currentGenAvg >= 80 ? "ABM Track" : "HUMSS Track";

  return {
    rank,
    totalStudents: 38,
    track
  };
}
