import { prisma } from '@/lib/db';

/**
 * Notification Adapter (§30)。
 * MVP はメール (SMTP) とコンソール。Slack へも同じ interface で差し替えられる。
 * 送信内容は notification_logs に必ず残し、監査・再送を可能にする。
 */

export type NotificationMessage = {
  to: string;
  subject: string;
  body: string;
  refType?: string;
  refId?: string;
};

export interface NotificationProvider {
  readonly name: string;
  send(message: NotificationMessage): Promise<void>;
}

/** 開発既定。実送信せずログのみ (§42)。 */
class ConsoleNotificationProvider implements NotificationProvider {
  readonly name = 'console';
  async send(message: NotificationMessage) {
    console.info(`[notify:console] to=${message.to} subject=${message.subject}`);
  }
}

/**
 * SMTP 送信。nodemailer を任意依存にし、未インストールでも
 * アプリがビルド/起動できるよう動的 import する。
 */
class SmtpNotificationProvider implements NotificationProvider {
  readonly name = 'smtp';
  async send(message: NotificationMessage) {
    // nodemailer は任意依存。未インストールでもビルド・起動できるよう動的解決する。
    const mod = (await import(/* webpackIgnore: true */ 'nodemailer' as string).catch(() => null)) as
      | { default: { createTransport: (options: unknown) => { sendMail: (mail: unknown) => Promise<unknown> } } }
      | null;
    if (!mod) {
      console.warn('[notify:smtp] nodemailer 未インストールのため送信をスキップしました');
      return;
    }
    const transport = mod.default.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: message.to,
      subject: message.subject,
      text: message.body,
    });
  }
}

class SlackNotificationProvider implements NotificationProvider {
  readonly name = 'slack';
  async send(message: NotificationMessage) {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) throw new Error('SLACK_WEBHOOK_URL が未設定です');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `*${message.subject}*\n${message.body}` }),
    });
    if (!res.ok) throw new Error(`Slack 送信失敗: ${res.status}`);
  }
}

let cached: NotificationProvider | null = null;

export function getNotificationProvider(): NotificationProvider {
  if (cached) return cached;
  const kind = (process.env.NOTIFICATION_PROVIDER ?? 'console').toLowerCase();
  if (kind === 'smtp' && process.env.SMTP_HOST) cached = new SmtpNotificationProvider();
  else if (kind === 'slack' && process.env.SLACK_WEBHOOK_URL) cached = new SlackNotificationProvider();
  else cached = new ConsoleNotificationProvider();
  return cached;
}

export function resetNotificationProvider() {
  cached = null;
}

/** 送信 + ログ記録。送信失敗でも呼び出し元の処理は止めない。 */
export async function notify(message: NotificationMessage): Promise<boolean> {
  const provider = getNotificationProvider();
  try {
    await provider.send(message);
    await prisma.notificationLog.create({
      data: {
        channel: provider.name,
        recipient: message.to,
        subject: message.subject,
        body: message.body,
        refType: message.refType,
        refId: message.refId,
        status: 'sent',
      },
    });
    return true;
  } catch (error) {
    await prisma.notificationLog.create({
      data: {
        channel: provider.name,
        recipient: message.to,
        subject: message.subject,
        body: message.body,
        refType: message.refType,
        refId: message.refId,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return false;
  }
}
