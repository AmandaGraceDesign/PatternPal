import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Nodemailer needs the Node.js runtime (not edge).
export const runtime = "nodejs";

// Vercel caps the request body at ~4.5MB. Keep the screenshot under 4MB.
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(request: Request) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const to = process.env.SUPPORT_TO || user;

  if (!user || !pass) {
    console.error("support: GMAIL_USER / GMAIL_APP_PASSWORD not configured");
    return NextResponse.json(
      { error: "Support email isn't configured yet." },
      { status: 500 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const message = (form.get("message") as string | null)?.trim() ?? "";
  const email = (form.get("email") as string | null)?.trim() ?? "";
  const device = (form.get("device") as string | null)?.trim() ?? "Unknown";
  const browser = (form.get("browser") as string | null)?.trim() ?? "Unknown";
  const screenSize = (form.get("screenSize") as string | null)?.trim() ?? "Unknown";
  const signedIn = (form.get("signedIn") as string | null)?.trim() ?? "Unknown";
  const userAgent = (form.get("userAgent") as string | null)?.trim() ?? "Unknown";

  if (!message) {
    return NextResponse.json(
      { error: "Please tell us what's happening." },
      { status: 400 }
    );
  }
  if (!email) {
    return NextResponse.json(
      { error: "Please add your email so we can reply." },
      { status: 400 }
    );
  }

  // Optional screenshot attachment.
  const attachments: { filename: string; content: Buffer }[] = [];
  const file = form.get("screenshot");
  if (file && file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Attachment must be an image." },
        { status: 400 }
      );
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        { error: "Screenshot is too large (max 4MB)." },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    attachments.push({ filename: file.name || "screenshot.png", content: buffer });
  }

  const rows: [string, string][] = [
    ["From", email],
    ["Device", device],
    ["Browser", browser],
    ["Screen", screenSize],
    ["Signed in", signedIn],
    ["User agent", userAgent],
  ];

  const textBody = [
    "PatternPal Pro — problem report",
    "",
    message,
    "",
    "—".repeat(20),
    ...rows.map(([k, v]) => `${k}: ${v}`),
  ].join("\n");

  const htmlBody = [
    `<p style="white-space:pre-wrap;font-size:15px;line-height:1.5">${escapeHtml(message)}</p>`,
    `<hr style="border:none;border-top:1px solid #ddd;margin:16px 0" />`,
    `<table style="font-size:13px;color:#444;border-collapse:collapse">`,
    ...rows.map(
      ([k, v]) =>
        `<tr><td style="padding:2px 12px 2px 0;font-weight:600">${escapeHtml(
          k
        )}</td><td style="padding:2px 0">${escapeHtml(v)}</td></tr>`
    ),
    `</table>`,
  ].join("");

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass: pass.replace(/\s+/g, "") },
    });

    await transporter.sendMail({
      from: `"PatternPal Support" <${user}>`,
      to,
      replyTo: email,
      subject: `PatternPal Pro support — ${device} / ${browser}`,
      text: textBody,
      html: htmlBody,
      attachments,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("support: sendMail failed", error);
    return NextResponse.json(
      { error: "Couldn't send right now. Please try again." },
      { status: 502 }
    );
  }
}
