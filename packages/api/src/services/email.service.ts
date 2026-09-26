import { sendAuthEmail } from '../lib/auth-email.js'

export type SendEmailParams = {
  to: string
  subject: string
  text: string
  html?: string
}

export const emailService = {
  sendAuthEmail,
  async sendEmail(params: SendEmailParams): Promise<void> {
    await sendAuthEmail({
      kind: 'verify-email',
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html ?? `<p>${params.text}</p>`,
    })
  },
}
