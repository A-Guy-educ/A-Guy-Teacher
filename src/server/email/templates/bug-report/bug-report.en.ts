/**
 * Bug Report Email Template — English
 *
 * @fileType email-template
 * @domain email
 * @pattern bug-report
 * @ai-summary English bug report email body sent to the office inbox when a user files a report.
 */

export interface BugReportEmailData {
  description: string
  contactEmail?: string | null
  pageUrl: string
  userAgent: string
  submittedAt: string
  userId?: string | null
  userEmail?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function preserveWhitespace(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br />')
}

export function buildBugReportEmailEN(data: BugReportEmailData): string {
  const { description, contactEmail, pageUrl, userAgent, submittedAt, userId, userEmail } = data

  const authRow =
    userId || userEmail
      ? `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Authenticated user</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right;">${
            userEmail ? escapeHtml(userEmail) : '—'
          }${userId ? `<span style="color: #6b7280; font-size: 12px;"> (id: ${escapeHtml(userId)})</span>` : ''}</td>
        </tr>`
      : `<tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Authenticated user</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px; text-align: right;">Anonymous</td>
        </tr>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charSet="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bug report — ${escapeAttr(submittedAt)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <table width="100%" cellPadding="0" cellSpacing="0" style="background-color: #f5f5f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellPadding="0" cellSpacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color: #b91c1c; padding: 24px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: bold;">New bug report</h1>
              <p style="margin: 8px 0 0; color: #fee2e2; font-size: 13px;">Submitted ${escapeHtml(submittedAt)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px; font-weight: bold;">Description</h2>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; color: #111827; font-size: 14px; line-height: 1.6; white-space: normal;">${preserveWhitespace(description)}</div>

              <h2 style="margin: 24px 0 12px; color: #111827; font-size: 18px; font-weight: bold;">Details</h2>
              <table width="100%" cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Contact email</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right;">${
                      contactEmail ? escapeHtml(contactEmail) : '—'
                    }</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Page URL</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; word-break: break-all;">${escapeHtml(pageUrl)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">User agent</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px; text-align: right; word-break: break-all;">${escapeHtml(userAgent)}</td>
                  </tr>
                  ${authRow}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">A-Guy — bug report forwarded by the in-app widget.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildBugReportEmailENPlainText(data: BugReportEmailData): string {
  const lines = [
    'New bug report',
    `Submitted: ${data.submittedAt}`,
    '',
    'Description:',
    data.description,
    '',
    'Details:',
    `Contact email: ${data.contactEmail ?? '—'}`,
    `Page URL: ${data.pageUrl}`,
    `User agent: ${data.userAgent}`,
    `Authenticated user: ${data.userEmail ?? 'Anonymous'}${
      data.userId ? ` (id: ${data.userId})` : ''
    }`,
  ]
  return lines.join('\n')
}
