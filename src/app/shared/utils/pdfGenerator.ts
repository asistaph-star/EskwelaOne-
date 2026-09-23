import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SubjectGrade } from './gradesService';

export interface ReportCardPDFProps {
  student: {
    name: string;
    lrn: string;
    grade: number;
    section: string;
    adviser: string;
    gender?: string;
  };
  subjects: SubjectGrade[];
  schoolYear?: string;
}

/**
 * Generates and downloads an official DepEd Form 138 / SF9-JHS Report Card PDF in Portrait format.
 */
export async function generateReportCardPDF({
  student,
  subjects,
  schoolYear = "2025–2026"
}: ReportCardPDFProps): Promise<void> {
  const element = document.getElementById('form138-print-root') || document.getElementById('printable-report-card');
  const safeFilename = `SF9_Form138_ReportCard_${(student.name || 'Student').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

  if (element) {
    try {
      const canvas = await html2canvas(element, {
        scale: 2.5, // High-definition rendering
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();   // 210 mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297 mm
      const margin = 10;
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);

      let imgWidth = availableWidth;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = (canvas.width * imgHeight) / canvas.height;
      }

      const x = (pdfWidth - imgWidth) / 2;
      const y = Math.max(margin, (pdfHeight - imgHeight) / 2);

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight, undefined, 'FAST');
      pdf.save(safeFilename);
      return;
    } catch (err) {
      console.warn("html2canvas PDF generation fallback:", err);
    }
  }

  // Standalone vector fallback
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  doc.setDrawColor(139, 30, 30);
  doc.setLineWidth(0.8);
  doc.rect(margin - 2, margin - 2, pageWidth - (margin * 2) + 4, pageHeight - (margin * 2) + 4);

  doc.setFillColor(74, 10, 16);
  doc.rect(margin, y, pageWidth - (margin * 2), 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CALULUT INTEGRATED SCHOOL', pageWidth / 2, y + 10, { align: 'center' });

  doc.save(safeFilename);
}
