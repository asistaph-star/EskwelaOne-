import React from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { Form138PDFDocument } from './components/Form138PDFDocument';

export function PDFTestScreen() {
  const mockStudent = {
    name: 'Santos, Juan Miguel',
    lrn: '123456789012',
    grade: 10,
    section: 'Pilot',
    adviser: 'Ana R. Soriano',
    gender: 'Male'
  };

  const mockSubjects = [
    { subject: 'Filipino', term1: 90, term2: 91, term3: 88, term4: 92, final: 90 },
    { subject: 'English', term1: 85, term2: 88, term3: 86, term4: 87, final: 87 },
    { subject: 'Mathematics', term1: 95, term2: 94, term3: 96, term4: 95, final: 95 },
    { subject: 'Science', term1: 92, term2: 93, term3: 90, term4: 91, final: 92 },
  ];

  const mockAttendance = {
    daysOfSchool: 200,
    daysPresent: 195,
    daysAbsent: 5
  };

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 20, background: '#f8f9fa', borderBottom: '1px solid #ddd' }}>
        <h2>PDF Isolation Test Route</h2>
        <p>This route is used to verify the PDF template renders cleanly in the browser before wiring up the download logic.</p>
      </div>
      <PDFViewer width="100%" height="100%" style={{ border: 'none' }}>
        <Form138PDFDocument 
          student={mockStudent} 
          subjects={mockSubjects as any} 
          attendance={mockAttendance} 
        />
      </PDFViewer>
    </div>
  );
}
