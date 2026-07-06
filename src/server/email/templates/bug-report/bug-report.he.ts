/**
 * Bug Report Email Template — Hebrew
 *
 * @fileType email-template
 * @domain email
 * @pattern bug-report
 * @ai-summary Hebrew bug report email body sent to the office inbox when a user files a report.
 */

import type { BugReportEmailData } from './bug-report.en'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function preserveWhitespace(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br />')
}

export function buildBugReportEmailHE(data: BugReportEmailData): string {
  const { description, contactEmail, pageUrl, userAgent, submittedAt, userId, userEmail } = data

  const authRow =
    userId || userEmail
      ? `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">משתמש מחובר</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: left;">${
            userEmail ? escapeHtml(userEmail) : '—'
          }${userId ? `<span style="color: #6b7280; font-size: 12px;"> (מזהה: ${escapeHtml(userId)})</span>` : ''}</td>
        </tr>`
      : `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">משתמש מחובר</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; text-align: left;">אנונימי</td>
        </tr>`

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charSet="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>דיווח על תקלה — ${escapeHtml(submittedAt)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <table width="100%" cellPadding="0" cellSpacing="0" style="background-color: #f5f5f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellPadding="0" cellSpacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color: #b91c1c; padding: 24px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: bold;">דיווח חדש על תקלה</h1>
              <p style="margin: 8px 0 0; color: #fee2e2; font-size: 13px;">התקבל ב-${escapeHtml(submittedAt)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px; font-weight: bold;">תיאור התקלה</h2>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; color: #111827; font-size: 14px; line-height: 1.6; white-space: normal;">${preserveWhitespace(description)}</div>

              <h2 style="margin: 24px 0 12px; color: #111827; font-size: 18px; font-weight: bold;">פרטים</h2>
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">דוא&quot;ל ליצירת קשר</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: left;">${
                      contactEmail ? escapeHtml(contactEmail) : '—'
                    }</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">כתובת הדף</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: left; word-break: break-all;">${escapeHtml(pageUrl)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">סוג הדפדפן</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: left; word-break: break-all;">${escapeHtml(userAgent)}</td>
                  </tr>
                  ${authRow}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">A-Guy — דיווח תקלה שהועבר דרך הווידג&apos;ט באפליקציה.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildBugReportEmailHEPlainText(data: BugReportEmailData): string {
  const lines = [
    'דיווח חדש על תקלה',
    `התקבל ב: ${data.submittedAt}`,
    '',
    'תיאור התקלה:',
    data.description,
    '',
    'פרטים:',
    `דוא"ל ליצירת קשר: ${data.contactEmail ?? '—'}`,
    `כתובת הדף: ${data.pageUrl}`,
    `סוג הדפדפן: ${data.userAgent}`,
    `משתמש מחובר: ${data.userEmail ?? 'אנונימי'}${data.userId ? ` (מזהה: ${data.userId})` : ''}`,
  ]
  return lines.join('\n')
}
