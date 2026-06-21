import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── OAuth helpers ───────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`OAuth error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Gmail API helpers ───────────────────────────────────────────────────────

interface GmailMessage { id: string; threadId: string }
interface GmailMessageFull {
  id: string;
  payload: {
    mimeType: string;
    body?: { data?: string };
    parts?: GmailPart[];
  };
}
interface GmailPart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function decodeBase64(b64: string): string {
  // Gmail uses URL-safe base64
  const standard = b64.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(standard, "base64").toString("utf-8");
}

function extractText(payload: GmailMessageFull["payload"]): string {
  function findPart(parts: GmailPart[] | undefined, mime: string): string | null {
    if (!parts) return null;
    for (const p of parts) {
      if (p.mimeType === mime && p.body?.data) return decodeBase64(p.body.data);
      const nested = findPart(p.parts, mime);
      if (nested) return nested;
    }
    return null;
  }

  if (payload.body?.data) return decodeBase64(payload.body.data);

  // Prefer HTML (Santander's text/plain sometimes starts with CSS)
  const html = findPart(payload.parts, "text/html");
  if (html) return stripHtml(html);

  return findPart(payload.parts, "text/plain") ?? "";
}

// Devuelve el texto desde donde empieza el contenido real del correo
function extractRelevantSection(texto: string): string {
  const markers = ["con fecha", "Estimado", "Te informamos", "Monto transferido"];
  for (const m of markers) {
    const idx = texto.toLowerCase().indexOf(m.toLowerCase());
    if (idx > 0) return texto.slice(Math.max(0, idx - 30), idx + 1500);
  }
  return texto.slice(0, 1500);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function searchMessages(token: string): Promise<GmailMessage[]> {
  const q = encodeURIComponent(
    'from:mensajeria@santander.cl subject:"Comprobante Transferencia de fondos" is:unread'
  );
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json() as { messages?: GmailMessage[] };
  return data.messages ?? [];
}

async function getMessage(token: string, id: string): Promise<GmailMessageFull> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return await res.json() as GmailMessageFull;
}

async function markAsRead(token: string, id: string): Promise<void> {
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
    }
  );
}

// ── Parser ──────────────────────────────────────────────────────────────────

function parsearTransferencia(texto: string): { monto: number; comercio: string; fecha: string | null } | null {
  const montoMatch = texto.match(/Monto transferido[\s\S]{0,80}\$\s*([\d.]+)/i);
  if (!montoMatch) return null;
  const monto = parseInt(montoMatch[1].replace(/\./g, ""));
  if (isNaN(monto)) return null;

  // Preferir sender ("nuestro cliente NAME realizó") como comercio
  const origenMatch = texto.match(/nuestro cliente\s+(.+?)\s+realizó/i);
  // Fallback: nombre destino cortando antes de "RUT"
  const destMatch = texto.match(/Datos de destino\s+Nombre\s+(.*?)\s+RUT/i);
  const comercio = origenMatch
    ? origenMatch[1].trim()
    : (destMatch ? destMatch[1].trim() : "Transferencia");

  // "con fecha DD/MM/YYYY" (incoming) o "realizada el DD/MM/YYYY" (outgoing)
  const fechaMatch = texto.match(/(?:con fecha|realizada el)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  let fecha: string | null = null;
  if (fechaMatch) {
    const [d, m, y] = fechaMatch[1].split("/");
    fecha = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return { monto, comercio, fecha };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = request.headers.get("x-api-key");
  if (auth !== process.env.AUTH_PASSWORD) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const missingVars = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"].filter(
    (v) => !process.env[v]
  );
  if (missingVars.length > 0) {
    return NextResponse.json({ error: `Faltan variables: ${missingVars.join(", ")}` }, { status: 500 });
  }

  try {
    const token = await getAccessToken();
    const messages = await searchMessages(token);

    if (messages.length === 0) {
      return NextResponse.json({ ok: true, nuevas: 0 });
    }

    let nuevas = 0;
    const errores: string[] = [];
    const debugItems: string[] = [];

    for (const msg of messages) {
      try {
        const full = await getMessage(token, msg.id);
        const texto = extractText(full.payload);

        const datos = parsearTransferencia(texto);
        if (!datos) {
          debugItems.push(texto.slice(0, 1200));
          continue;
        }

        const { error } = await supabase.from("sugerencias").insert({
          comercio: datos.comercio,
          monto: datos.monto,
          texto_original: extractRelevantSection(texto),
          ...(datos.fecha ? { fecha: datos.fecha } : {}),
        });

        if (error) {
          errores.push(error.message);
        } else {
          await markAsRead(token, msg.id);
          nuevas++;
        }
      } catch (e) {
        errores.push(String(e));
      }
    }

    if (debugItems.length > 0) {
      return NextResponse.json({ ok: false, nuevas, debug: debugItems });
    }
    return NextResponse.json({ ok: true, nuevas, errores: errores.length > 0 ? errores : undefined });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
