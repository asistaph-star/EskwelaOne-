import React from 'react';
import { View, Text, StyleSheet, Svg, Path, Polyline } from '@react-pdf/renderer';

export const pdfColors = {
  m900: "#0A192F",
  m800: "#112240", // Navy header
  m700: "#1D4ED8", // Blue table header
  m600: "#2563EB",
  m50: "#EFF6FF", // Student info bg
  gold: "#F59E0B",
  goldBg: "#FEF3C7",
  paper: "#F8FAFC",
  border: "#E2E8F0",
  borderMed: "rgba(29,78,216,0.28)",
  t1: "#0F172A",
  t3: "#64748B",
  green: "#155E36",
  greenBg: "#DCFCE7",
  greenScore: "#15803D",
  white: "#ffffff",
};

export const pdfStyles = StyleSheet.create({
  cardContainer: {
    borderWidth: 1,
    borderColor: pdfColors.m800,
    borderRadius: 8,
    overflow: 'hidden',
    width: '100%',
  },
  headerBar: {
    backgroundColor: pdfColors.m800,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: pdfColors.gold,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTextRep: { color: 'rgba(255,255,255,0.75)', fontSize: 7, textTransform: 'uppercase', marginBottom: 1, fontFamily: 'Helvetica' },
  headerTextSchool: { color: pdfColors.white, fontSize: 13, fontFamily: 'Times-Bold', marginBottom: 1 },
  headerTextAddress: { color: 'rgba(255,255,255,0.65)', fontSize: 7, fontFamily: 'Helvetica' },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerTextForm: { color: 'rgba(255,255,255,0.65)', fontSize: 7, textTransform: 'uppercase', marginBottom: 1, fontFamily: 'Helvetica' },
  headerTextTitle: { color: pdfColors.gold, fontSize: 11, fontFamily: 'Times-Bold', marginBottom: 1 },
  headerTextYear: { color: 'rgba(255,255,255,0.8)', fontSize: 8, fontFamily: 'Helvetica' },
});

export const BookIcon = () => (
  <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={pdfColors.gold} strokeWidth="2">
    <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    <Polyline points="10 2 10 10 13 7 16 10 16 2" />
  </Svg>
);

export const PDFHeaderBar = ({ title, subtitle, documentId }: { title: string; subtitle?: string; documentId?: string }) => (
  <View style={pdfStyles.headerBar}>
    <View style={pdfStyles.headerLeft}>
      <View style={pdfStyles.logoBox}>
        <BookIcon />
      </View>
      <View>
        <Text style={pdfStyles.headerTextRep}>Republic of the Philippines · Department of Education · Region III</Text>
        <Text style={pdfStyles.headerTextSchool}>Calulut Integrated School</Text>
        <Text style={pdfStyles.headerTextAddress}>Sindalan, City of San Fernando, Pampanga · Division of San Fernando City · School ID: 300941</Text>
      </View>
    </View>
    <View style={pdfStyles.headerRight}>
      <Text style={pdfStyles.headerTextForm}>{documentId || "DepEd Form 138 / SF9-JHS"}</Text>
      <Text style={pdfStyles.headerTextTitle}>{title}</Text>
      {subtitle && <Text style={pdfStyles.headerTextYear}>{subtitle}</Text>}
    </View>
  </View>
);

export const PDFStamp = ({ label, passed, gold }: { label: string; passed?: boolean; gold?: boolean }) => {
  let bg = passed ? pdfColors.greenBg : pdfColors.goldBg;
  let color = passed ? pdfColors.green : pdfColors.m800;
  let border = passed ? 'rgba(21,94,54,0.3)' : 'transparent';
  
  if (gold) {
    bg = pdfColors.gold;
    color = pdfColors.m800;
    border = 'transparent';
  }

  return (
    <View style={{
      backgroundColor: bg,
      borderWidth: border !== 'transparent' ? 1 : 0,
      borderColor: border,
      borderRadius: 3,
      paddingVertical: 3,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color }}>{label}</Text>
    </View>
  );
};
