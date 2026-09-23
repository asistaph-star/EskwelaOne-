import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { SubjectGrade } from '../../shared/utils/gradesService';
import { PDFHeaderBar, PDFStamp, pdfColors, pdfStyles } from '../../shared/components/pdf/PDFPrimitives';

export interface Form138Student {
  name: string;
  lrn: string;
  grade: number | string;
  section: string;
  adviser: string;
  gender: string;
}

export interface Form138Attendance {
  daysOfSchool: number;
  daysPresent: number;
  daysAbsent: number;
}

export interface Form138Props {
  student?: Form138Student;
  subjects?: SubjectGrade[];
  attendance?: Form138Attendance;
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  
  // Student Info Bar
  infoBar: {
    backgroundColor: pdfColors.m50,
    borderBottomWidth: 1.5,
    borderBottomColor: pdfColors.m700,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  infoCol: { flex: 1, paddingRight: 4 },
  infoColLarge: { flex: 1.2, paddingRight: 4 },
  infoColSmall: { flex: 0.8, paddingRight: 4 },
  infoLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: pdfColors.t3, textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: pdfColors.t1 },

  // Table
  table: { width: '100%', borderBottomWidth: 1, borderBottomColor: pdfColors.border },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: pdfColors.m700,
  },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: pdfColors.border },
  tableRowAlt: { backgroundColor: pdfColors.paper },
  
  // Table Cells
  cellSubject: { flex: 2.8, paddingVertical: 6, paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' },
  cellTerm: { flex: 1, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' },
  cellFinal: { flex: 1.2, paddingVertical: 6, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.3)' },
  cellRemarks: { flex: 1.5, paddingVertical: 6, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  
  // Table Body Cells override border color for dark borders
  cellSubjectBody: { flex: 2.8, paddingVertical: 6, paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: pdfColors.border },
  cellTermBody: { flex: 1, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: pdfColors.border },
  cellFinalBody: { flex: 1.2, paddingVertical: 6, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: pdfColors.border },
  
  thText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: pdfColors.white, textTransform: 'uppercase' },
  tdTextSubject: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: pdfColors.t1 },
  tdTextTermGreen: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: pdfColors.greenScore },
  tdTextTermBlue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: pdfColors.m700 },
  tdTextTermNormal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: pdfColors.t1 },
  
  // GWA Row
  gwaRow: {
    flexDirection: 'row',
    backgroundColor: pdfColors.m900,
  },
  gwaLabelCell: { flex: 5.8, paddingVertical: 8, paddingHorizontal: 16, justifyContent: 'center' },
  gwaValueCell: { flex: 1.2, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' },
  gwaRemarksCell: { flex: 1.5, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  gwaLabelText: { fontSize: 10, fontFamily: 'Times-Bold', color: pdfColors.white },
  gwaValueText: { fontSize: 12, fontFamily: 'Times-Bold', color: pdfColors.gold },

  // Footer Section
  footerSection: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: pdfColors.white,
    justifyContent: 'space-between'
  },
  footerColLeft: { flex: 1.2, paddingRight: 10, borderRightWidth: 1, borderRightColor: pdfColors.border },
  footerColMid: { flex: 1.2, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: pdfColors.borderMed },
  footerColRight: { flex: 1.6, paddingLeft: 10 },
  
  footerTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: pdfColors.m700, textTransform: 'uppercase', marginBottom: 6 },
  
  // Attendance Box
  attBox: { borderWidth: 1, borderColor: pdfColors.border, borderRadius: 6, padding: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  attItem: { alignItems: 'center' },
  attLabel: { fontSize: 6, color: pdfColors.t3, marginBottom: 2 },
  attValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: pdfColors.t1 },
  attValueGreen: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: pdfColors.greenScore },
  attValueBlue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: pdfColors.m700 },

  // Descriptors Box
  descBox: { borderWidth: 1, borderColor: pdfColors.borderMed, borderRadius: 6, padding: 6 },
  descText: { fontSize: 6, color: pdfColors.t1, marginBottom: 2 },

  // Signatures
  sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  sigBlock: { alignItems: 'center', width: '45%' },
  sigLine: { width: '100%', borderBottomWidth: 1, borderBottomColor: pdfColors.t1, marginBottom: 4 },
  sigName: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: pdfColors.t1 },
  sigRole: { fontSize: 6, color: pdfColors.t3 },

  footerBottom: {
    backgroundColor: pdfColors.paper,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: pdfColors.border,
  },
  footerBottomText: { fontSize: 6, color: pdfColors.t3 }
});

const getGradeColor = (grade?: number) => {
  if (!grade) return styles.tdTextTermNormal;
  if (grade >= 90) return styles.tdTextTermGreen;
  if (grade >= 85) return styles.tdTextTermBlue;
  return styles.tdTextTermNormal;
};

export function Form138PDFDocument({ student, subjects, attendance }: Form138Props) {
  // GUARD: if any required prop is missing, render a visible error page
  if (!student || !subjects || subjects.length === 0) {
    return (
      <Document>
        <Page size="LETTER" style={styles.page}>
          <Text style={{ color: 'red', fontSize: 16 }}>Error: Missing student or subject data.</Text>
        </Page>
      </Document>
    );
  }

  // Calculate Subject Averages
  function calcSubAvg(sg: any) {
    const terms = [sg.term1, sg.term2, sg.term3].filter((t): t is number => typeof t === 'number' && t > 0);
    if (terms.length === 0) return 0;
    const sum = terms.reduce((a, b) => a + b, 0);
    return Math.round((sum / terms.length) * 10) / 10;
  }

  // Calculate General Average
  const allAvgs = subjects.map(s => calcSubAvg(s)).filter(a => a > 0);
  const genAvg = allAvgs.length > 0 ? (Math.round((allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) * 10) / 10).toFixed(1) : '0.0';
  const isPassed = parseFloat(genAvg) >= 75;

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={pdfStyles.cardContainer}>

          
          <PDFHeaderBar 
            title="Learner's Official Progress Report Card" 
            subtitle="School Year 2025–2026"
            documentId="DepEd Form 138 / SF9-JHS"
          />

          {/* Student Profile Row */}
          <View style={styles.infoBar}>
            <View style={styles.infoColLarge}>
              <Text style={styles.infoLabel}>Full Name</Text>
              <Text style={styles.infoValue}>{student.name}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Grade & Section</Text>
              <Text style={styles.infoValue}>Grade {student.grade} - {student.section}</Text>
            </View>
            <View style={styles.infoColSmall}>
              <Text style={styles.infoLabel}>LRN</Text>
              <Text style={styles.infoValue}>{student.lrn || 'N/A'}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Gender / Track</Text>
              <Text style={styles.infoValue}>{student.gender ? (student.gender.toLowerCase() === 'female' ? 'Female' : 'Male') : 'N/A'} · Academic</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Class Adviser</Text>
              <Text style={styles.infoValue}>{student.adviser}</Text>
            </View>
          </View>

          {/* Subjects Table */}
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeaderRow}>
              <View style={styles.cellSubject}>
                <Text style={styles.thText}>Learning Area / Subject</Text>
              </View>
              <View style={styles.cellTerm}><Text style={styles.thText}>Term 1</Text></View>
              <View style={styles.cellTerm}><Text style={styles.thText}>Term 2</Text></View>
              <View style={styles.cellTerm}><Text style={styles.thText}>Term 3</Text></View>
              <View style={styles.cellFinal}><Text style={[styles.thText, { color: pdfColors.gold }]}>Final Rating</Text></View>
              <View style={styles.cellRemarks}><Text style={styles.thText}>Remarks</Text></View>
            </View>

            {/* Table Rows */}
            {subjects.map((subj, idx) => {
              const subjFinal = calcSubAvg(subj);
              const hasFinal = subjFinal > 0;
              const passed = hasFinal && subjFinal >= 75;
              return (
                <View key={subj.name} style={[styles.tableRow, idx % 2 !== 0 && styles.tableRowAlt]}>
                  <View style={styles.cellSubjectBody}>
                    <Text style={styles.tdTextSubject}>{subj.name}</Text>
                  </View>
                  <View style={styles.cellTermBody}><Text style={getGradeColor(subj.term1)}>{subj.term1 || '-'}</Text></View>
                  <View style={styles.cellTermBody}><Text style={getGradeColor(subj.term2)}>{subj.term2 || '-'}</Text></View>
                  <View style={styles.cellTermBody}><Text style={getGradeColor(subj.term3)}>{subj.term3 || '-'}</Text></View>
                  <View style={styles.cellFinalBody}>
                    <Text style={getGradeColor(subjFinal)}>{hasFinal ? subjFinal.toFixed(1) : '-'}</Text>
                  </View>
                  <View style={styles.cellRemarks}>
                    {hasFinal ? (
                      <PDFStamp label={passed ? 'PASSED' : 'FAILED'} passed={passed} />
                    ) : (
                      <Text style={styles.tdTextTermNormal}>-</Text>
                    )}
                  </View>
                </View>
              );
            })}

            {/* General Average Row */}
            <View style={styles.gwaRow}>
              <View style={styles.gwaLabelCell}>
                <Text style={styles.gwaLabelText}>GENERAL AVERAGE (GPA)</Text>
              </View>
              <View style={styles.gwaValueCell}>
                <Text style={styles.gwaValueText}>{genAvg}</Text>
              </View>
              <View style={styles.gwaRemarksCell}>
                {allAvgs.length > 0 ? (
                  <PDFStamp label={isPassed ? 'PROMOTED' : 'RETAINED'} gold />
                ) : (
                  <Text style={styles.tdTextTermNormal}>-</Text>
                )}
              </View>
            </View>
          </View>

          {/* Footer Section */}
          <View style={styles.footerSection}>
            <View style={styles.footerColLeft}>
              <Text style={styles.footerTitle}>Attendance Summary (SY 2025–2026)</Text>
              <View style={styles.attBox}>
                <View style={styles.attItem}>
                  <Text style={styles.attLabel}>DAYS</Text>
                  <Text style={styles.attValue}>{attendance?.daysOfSchool || 0}</Text>
                </View>
                <View style={styles.attItem}>
                  <Text style={styles.attLabel}>PRESENT</Text>
                  <Text style={styles.attValueGreen}>{attendance?.daysPresent || 0}</Text>
                </View>
                <View style={styles.attItem}>
                  <Text style={styles.attLabel}>ABSENT</Text>
                  <Text style={styles.attValue}>{attendance?.daysAbsent || 0}</Text>
                </View>
                <View style={styles.attItem}>
                  <Text style={styles.attLabel}>RATE</Text>
                  <Text style={styles.attValueBlue}>
                    {attendance?.daysOfSchool ? ((attendance.daysPresent / attendance.daysOfSchool) * 100).toFixed(1) + '%' : '0%'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.footerColMid}>
              <Text style={styles.footerTitle}>Descriptors & Grading Scale</Text>
              <View style={styles.descBox}>
                <Text style={styles.descText}><Text style={{fontFamily: 'Helvetica-Bold'}}>90–100:</Text> Outstanding · <Text style={{fontFamily: 'Helvetica-Bold'}}>85–89:</Text> Very Satisfactory</Text>
                <Text style={styles.descText}><Text style={{fontFamily: 'Helvetica-Bold'}}>80–84:</Text> Satisfactory · <Text style={{fontFamily: 'Helvetica-Bold'}}>75–79:</Text> Fairly Satisfactory · <Text style={{fontFamily: 'Helvetica-Bold'}}>&lt;75:</Text> Failed</Text>
              </View>
            </View>

            <View style={styles.footerColRight}>
              <Text style={styles.footerTitle}>Official Signatures & Certification</Text>
              <View style={styles.sigRow}>
                <View style={styles.sigBlock}>
                  <View style={styles.sigLine} />
                  <Text style={styles.sigName}>{student.adviser}</Text>
                  <Text style={styles.sigRole}>Class Adviser</Text>
                </View>
                <View style={styles.sigBlock}>
                  <View style={styles.sigLine} />
                  <Text style={styles.sigName}>Dr. Roberto Santos</Text>
                  <Text style={styles.sigRole}>School Principal</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Footer Bottom Bar */}
          <View style={styles.footerBottom}>
            <Text style={styles.footerBottomText}>Official DepEd Form 138-JHS (SF9) · Calulut Integrated School · DigiSkwela Security Verified</Text>
            <Text style={styles.footerBottomText}>LRN: {student.lrn || ''}    Date Issued: Aug 21, 2026</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
