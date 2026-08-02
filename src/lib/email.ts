// Phase 11 — Email notifications (Resend, opt-in via env).
//
// Everything here is best-effort: with no RESEND_API_KEY / EMAIL_FROM set the
// app runs exactly as before (in-app reminders feed only). Emails never throw —
// send failures are logged and swallowed so the automation drain can't fail on
// a delivery hiccup.

import { Resend } from "resend";

import { log } from "@/lib/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Send one email. No-op when not configured; never throws. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!isEmailConfigured()) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM!,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
  } catch (err) {
    log("error", "email send failed", { error: (err as Error).message });
  }
}

const wrap = (body: string) =>
  `<!doctype html><html><body style="margin:0;padding:32px 0;background:#f6f6f8;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a1d23;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e8ec;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 28px;background:#101736;color:#ffffff;font-size:15px;font-weight:600;">EngineerOS</div>
      <div style="padding:24px 28px;font-size:14px;line-height:1.6;">${body}</div>
    </div>
  </body></html>`;

/**
 * Resolve an app-relative path against NEXT_PUBLIC_APP_URL. Returns null when
 * the origin is unset, so emails never emit a useless relative href.
 */
function appUrl(path: string): string | null {
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) return null;
  return `${origin.replace(/\/$/, "")}${path}`;
}

/** One in-app reminder surfaced — mirror it in the inbox. */
export function renderReminderEmail(title: string, taskPath: string, fireAt: string): string {
  const when = new Date(fireAt).toLocaleString();
  const url = appUrl(taskPath);
  const link = url
    ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:#101736;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;">Open task</a>`
    : `<p style="margin:0;color:#9ca3af;">Set NEXT_PUBLIC_APP_URL to receive clickable links.</p>`;
  return wrap(
    `<p style="margin:0 0 8px;color:#6b7280;">Reminder · ${when}</p>
     <h2 style="margin:0 0 16px;font-size:18px;">${escapeHtml(title)}</h2>
     ${link}`,
  );
}

/** Weekly summary email. */
export function renderDigestEmail(args: {
  completedTasks: { title: string }[];
  newNotes: { title: string }[];
}): string {
  const list = (title: string, items: { title: string }[], empty: string) =>
    `<h3 style="margin:24px 0 8px;font-size:14px;color:#374151;">${title}</h3>` +
    (items.length === 0
      ? `<p style="margin:0;color:#9ca3af;">${empty}</p>`
      : `<ul style="margin:0;padding-left:20px;">${items
          .map((i) => `<li style="margin:4px 0;">${escapeHtml(i.title)}</li>`)
          .join("")}</ul>`);

  return wrap(
    `<p style="margin:0 0 4px;color:#6b7280;">Your weekly digest</p>
     <h2 style="margin:0 0 8px;font-size:18px;">Here's what happened this week</h2>
     ${list("Completed tasks", args.completedTasks, "No tasks completed this week.")}
     ${list("New notes", args.newNotes, "No notes created this week.")}`,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
