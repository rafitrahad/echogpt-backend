import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends email through SMTP when SMTP_HOST is configured.
 * Without SMTP (local development), the email is printed to the console instead,
 * so every feature still works with zero setup.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM') || 'EchoGPT <no-reply@echogpt.local>';
    const host = config.get<string>('SMTP_HOST');

    if (host) {
      const port = Number(config.get('SMTP_PORT') ?? 587);
      this.transporter = createTransport({
        host,
        port,
        secure: port === 465, // 465 = TLS from the start, 587 = STARTTLS
        auth: config.get<string>('SMTP_USER')
          ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASS') }
          : undefined,
      });
    } else {
      this.transporter = null;
      this.logger.warn('SMTP_HOST not set: emails will be printed to the console');
    }
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`\n──── EMAIL (console mode) ────\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n──────────────────────────────`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}