export type DocumentRequirement = {
  documentType: string;
  description: string;
  instructions?: string;
  attachmentRequired: boolean;
  attachmentLabel?: string;
  acceptedFileTypes?: string[];
  maxFileSizeMB?: number;
  
  // New fields for Phase 4C Routing
  responsibleRole: "TEACHER" | "REGISTRAR" | "RECORDS_CUSTODIAN" | "GUIDANCE";
  responsibleOffice: string;
  requiredFields: string[]; // e.g., ["receivingSchoolName"]
  optionalAttachments?: string[];
  notes?: string;
  requiresPrincipalApproval: boolean; // Configurable Principal Signature flag
  sourceReferences?: Array<{
    title: string;
    url: string;
    checkedAt: string;
  }>;
};

export const DOCUMENT_REQUIREMENTS: Record<string, DocumentRequirement> = {
  "Certificate of Good Moral": {
    documentType: "Certificate of Good Moral",
    description: "This document certifies your good moral character during your enrollment.",
    instructions: "Please attach a Valid ID (if required by school policy) or upload the request form.",
    attachmentRequired: false, 
    optionalAttachments: ["Valid ID", "Parent/Guardian Authorization"],
    responsibleRole: "REGISTRAR", 
    responsibleOffice: "Registrar / Guidance Office",
    requiredFields: ["purpose"],
    requiresPrincipalApproval: true,
    notes: "Certificate of Good Moral Character is no longer a required document for DepEd enrollment (DepEd Order No. 54, s. 2016), but may be required for college admissions or scholarships.",
    sourceReferences: [
      {
        title: "DepEd Order No. 54, s. 2016",
        url: "https://www.deped.gov.ph",
        checkedAt: new Date().toISOString()
      }
    ]
  },
  "Certificate of Enrollment": {
    documentType: "Certificate of Enrollment",
    description: "This document verifies your current enrollment status.",
    attachmentRequired: false,
    optionalAttachments: ["Parent/Student ID"],
    responsibleRole: "REGISTRAR",
    responsibleOffice: "Registrar / Records Office",
    requiredFields: ["purpose"],
    requiresPrincipalApproval: false,
    notes: "Enrollment certificates are generally prepared and signed by the Registrar without requiring Principal signature.",
  },
  "Form 137 (Permanent Record)": {
    documentType: "Form 137 (Permanent Record)",
    description: "Official School Form 10 (SF10) request.",
    instructions: "Per DepEd Order No. 54, s. 2016, Form 137 (SF10) is an official school-to-school transfer record. The learner/parent is NOT permitted to hand-carry this document. Please upload the official request letter from the receiving school if initiating an early transfer.",
    attachmentRequired: true,
    attachmentLabel: "Receiving School Request Letter",
    acceptedFileTypes: ["application/pdf", "image/jpeg", "image/png"],
    maxFileSizeMB: 10,
    responsibleRole: "REGISTRAR",
    responsibleOffice: "Registrar / Records Office",
    requiredFields: [
      "purpose", 
      "receivingSchoolName", 
      "receivingSchoolAddress", 
      "receivingSchoolOfficial", 
      "receivingSchoolOfficialEmail"
    ],
    requiresPrincipalApproval: false,
    notes: "Form 137 is processed directly between the originating and receiving schools. Internal school requests for simulation purposes are permitted here.",
    sourceReferences: [
      {
        title: "DepEd Order No. 54, s. 2016 - Guidelines on the Request and Transfer of Learner's School Records",
        url: "https://www.deped.gov.ph",
        checkedAt: new Date().toISOString()
      }
    ]
  },
  "Diploma Copy": {
    documentType: "Diploma Copy",
    description: "A certified true copy or replacement of your diploma.",
    attachmentRequired: false,
    optionalAttachments: ["Affidavit of Loss (if replacing)"],
    responsibleRole: "REGISTRAR",
    responsibleOffice: "Registrar / Records Office",
    requiredFields: ["purpose"],
    requiresPrincipalApproval: true,
    notes: "Affidavit or loss documentation may be required depending on school policy. Authorization documents required for representatives.",
  },
  "Honorable Dismissal": {
    documentType: "Honorable Dismissal",
    description: "A clearance/transfer request (primarily for Higher Ed, adapted here per school policy).",
    instructions: "This request may require school clearance and settlement of financial obligations where applicable.",
    attachmentRequired: false,
    optionalAttachments: ["Clearance Form"],
    responsibleRole: "REGISTRAR",
    responsibleOffice: "Registrar / Records Office",
    requiredFields: ["purpose"],
    requiresPrincipalApproval: true,
    notes: "Honorable Dismissal is generally a higher-education term. DepEd basic education uses SF9 and SF10 for transfer. School-specific clearance rules apply.",
  }
};
