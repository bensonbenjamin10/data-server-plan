import { Resend } from "resend";
import { logger } from "../lib/logger.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@finjoe.app";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

interface EmailResult {
  success: boolean;
  error?: string;
}

async function send(to: string, subject: string, html: string): Promise<EmailResult> {
  try {
    const { error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    if (error) {
      logger.error({ error }, "Email send failed");
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    logger.error({ err }, "Email send error");
    return { success: false, error: String(err) };
  }
}

function layout(body: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
      <div style="margin-bottom: 32px;">
        <strong style="font-size: 18px; color: #111;">Org Storage</strong>
      </div>
      ${body}
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888;">
        This email was sent by Org Storage. If you didn't expect this, you can safely ignore it.
      </div>
    </div>
  `;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display: inline-block; padding: 12px 28px; background-color: #6366f1; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">${label}</a>`;
}

export async function sendInviteEmail(
  email: string,
  inviterEmail: string,
  orgName: string,
  token: string
): Promise<EmailResult> {
  const link = `${FRONTEND_URL}/accept-invite?token=${token}`;
  return send(
    email,
    `You've been invited to join ${orgName}`,
    layout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">You're invited!</h2>
      <p style="color: #444; line-height: 1.6;">
        <strong>${inviterEmail}</strong> has invited you to join <strong>${orgName}</strong> on Org Storage.
      </p>
      <p style="margin: 24px 0;">${button(link, "Accept Invitation")}</p>
      <p style="color: #888; font-size: 13px;">This invitation expires in 7 days. If the button doesn't work, copy this link:<br/>
        <a href="${link}" style="color: #6366f1; word-break: break-all;">${link}</a>
      </p>
    `)
  );
}

export async function sendVerificationEmail(email: string, token: string): Promise<EmailResult> {
  const link = `${FRONTEND_URL}/verify-email?token=${token}`;
  return send(
    email,
    "Verify your email address",
    layout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">Verify your email</h2>
      <p style="color: #444; line-height: 1.6;">
        Please confirm your email address to get full access to Org Storage.
      </p>
      <p style="margin: 24px 0;">${button(link, "Verify Email")}</p>
      <p style="color: #888; font-size: 13px;">This link expires in 24 hours. If the button doesn't work, copy this link:<br/>
        <a href="${link}" style="color: #6366f1; word-break: break-all;">${link}</a>
      </p>
    `)
  );
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<EmailResult> {
  const link = `${FRONTEND_URL}/reset-password?token=${token}`;
  return send(
    email,
    "Reset your password",
    layout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">Reset your password</h2>
      <p style="color: #444; line-height: 1.6;">
        We received a request to reset your password. Click the button below to choose a new one.
      </p>
      <p style="margin: 24px 0;">${button(link, "Reset Password")}</p>
      <p style="color: #888; font-size: 13px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.<br/>
        <a href="${link}" style="color: #6366f1; word-break: break-all;">${link}</a>
      </p>
    `)
  );
}

export async function sendAccessRequestNotification(
  adminEmails: string[],
  requesterEmail: string,
  orgName: string
): Promise<EmailResult> {
  const link = `${FRONTEND_URL}/organization`;
  const results = await Promise.all(
    adminEmails.map((to) =>
      send(
        to,
        `New access request for ${orgName}`,
        layout(`
          <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">New access request</h2>
          <p style="color: #444; line-height: 1.6;">
            <strong>${requesterEmail}</strong> has requested to join <strong>${orgName}</strong>.
          </p>
          <p style="margin: 24px 0;">${button(link, "Review Request")}</p>
        `)
      )
    )
  );
  return results.every((r) => r.success)
    ? { success: true }
    : { success: false, error: "Some notification emails failed" };
}

export async function sendAccessApprovedEmail(email: string, orgName: string): Promise<EmailResult> {
  const link = `${FRONTEND_URL}/`;
  return send(
    email,
    `Your access request for ${orgName} was approved`,
    layout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">Access approved!</h2>
      <p style="color: #444; line-height: 1.6;">
        Your request to join <strong>${orgName}</strong> has been approved. You can now access the organization.
      </p>
      <p style="margin: 24px 0;">${button(link, "Go to Dashboard")}</p>
    `)
  );
}

export async function sendAccessDeniedEmail(email: string, orgName: string): Promise<EmailResult> {
  return send(
    email,
    `Your access request for ${orgName} was denied`,
    layout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">Access request denied</h2>
      <p style="color: #444; line-height: 1.6;">
        Your request to join <strong>${orgName}</strong> has been denied by an administrator.
        If you believe this was a mistake, please contact the organization admin.
      </p>
    `)
  );
}
