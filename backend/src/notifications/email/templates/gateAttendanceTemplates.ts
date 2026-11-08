/**
 * Minimal, mobile-responsive HTML and plain-text templates for DigiSkwela Gate Attendance.
 * Fully compliant with DepEd Calulut Integrated School standards (School ID: 500146).
 * Preserves student privacy (no full LRNs, grades, or unrelated personal info).
 */

export interface GateTemplateData {
  studentName: string;
  attendanceDate: string; // e.g. "November 9, 2026"
  timeStr: string; // e.g. "7:15 AM" or "3:45 PM"
  punctualityStatus?: 'On Time' | 'Late' | null;
}

export interface RenderedTemplate {
  subject: string;
  htmlContent: string;
  textContent: string;
}

export function renderTimeInTemplate(data: GateTemplateData): RenderedTemplate {
  const subject = 'CIS Attendance: Student Arrival Notification — Campus Entry Recorded';

  // Plain-text alternative
  let textContent = `Calulut Integrated School\n\n`;
  textContent += `Student: ${data.studentName}\n`;
  textContent += `Date: ${data.attendanceDate}\n`;
  textContent += `Entry Time: ${data.timeStr}\n`;
  if (data.punctualityStatus) {
    textContent += `Status: ${data.punctualityStatus}\n`;
  }
  textContent += `\nThis is an automated notification confirming that a student ID scan was recorded at the school gate. This entry was recorded at the perimeter gate and does not confirm classroom attendance.`;

  // Status HTML block (ONLY shown when valid rule exists)
  const statusHtml = data.punctualityStatus
    ? `
      <div style="margin-bottom: 10px;">
        <span style="color: #64748b; font-size: 13px; font-weight: 500;">Status:</span>
        <span style="display: inline-block; margin-left: 6px; padding: 2px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.3px; color: ${
          data.punctualityStatus === 'On Time' ? '#166534' : '#991b1b'
        }; background-color: ${
          data.punctualityStatus === 'On Time' ? '#dcfce7' : '#fee2e2'
        };">
          ${data.punctualityStatus}
        </span>
      </div>`
    : '';

  // Minimal, mobile-responsive HTML
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);" border="0" cellspacing="0" cellpadding="0">
          <!-- Institutional Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 18px 24px;">
              <h2 style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600; letter-spacing: 0.4px;">Calulut Integrated School</h2>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 24px;">
              <h1 style="color: #0f172a; margin: 0 0 18px 0; font-size: 18px; font-weight: 700; letter-spacing: -0.2px;">Campus Entry Recorded</h1>
              
              <div style="font-size: 14px; line-height: 1.6; color: #1e293b; background-color: #f8fafc; padding: 16px 20px; border-radius: 6px; border: 1px solid #f1f5f9; margin-bottom: 20px;">
                <div style="margin-bottom: 8px;"><strong style="color: #475569;">Student:</strong> <span style="font-weight: 600;">${data.studentName}</span></div>
                <div style="margin-bottom: 8px;"><strong style="color: #475569;">Date:</strong> <span>${data.attendanceDate}</span></div>
                <div style="margin-bottom: ${data.punctualityStatus ? '8px' : '0'};"><strong style="color: #475569;">Entry Time:</strong> <span>${data.timeStr}</span></div>
                ${statusHtml}
              </div>

              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                This is an automated notification confirming that a student ID scan was recorded at the school gate. This entry was recorded at the perimeter gate and does not confirm classroom attendance.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, htmlContent, textContent };
}

export function renderTimeOutTemplate(data: GateTemplateData): RenderedTemplate {
  const subject = 'CIS Attendance: Student Departure Notification — Campus Exit Recorded';

  // Plain-text alternative
  let textContent = `Calulut Integrated School\n\n`;
  textContent += `Student: ${data.studentName}\n`;
  textContent += `Date: ${data.attendanceDate}\n`;
  textContent += `Exit Time: ${data.timeStr}\n\n`;
  textContent += `This is an automated notification confirming that a student ID scan was recorded at the school gate. This exit was recorded at the perimeter gate and does not confirm arrival at home.`;

  // Minimal, mobile-responsive HTML
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 480px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);" border="0" cellspacing="0" cellpadding="0">
          <!-- Institutional Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 18px 24px;">
              <h2 style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600; letter-spacing: 0.4px;">Calulut Integrated School</h2>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 24px;">
              <h1 style="color: #0f172a; margin: 0 0 18px 0; font-size: 18px; font-weight: 700; letter-spacing: -0.2px;">Campus Exit Recorded</h1>
              
              <div style="font-size: 14px; line-height: 1.6; color: #1e293b; background-color: #f8fafc; padding: 16px 20px; border-radius: 6px; border: 1px solid #f1f5f9; margin-bottom: 20px;">
                <div style="margin-bottom: 8px;"><strong style="color: #475569;">Student:</strong> <span style="font-weight: 600;">${data.studentName}</span></div>
                <div style="margin-bottom: 8px;"><strong style="color: #475569;">Date:</strong> <span>${data.attendanceDate}</span></div>
                <div><strong style="color: #475569;">Exit Time:</strong> <span>${data.timeStr}</span></div>
              </div>

              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                This is an automated notification confirming that a student ID scan was recorded at the school gate. This exit was recorded at the perimeter gate and does not confirm arrival at home.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, htmlContent, textContent };
}

