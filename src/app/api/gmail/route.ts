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

  if (payload.body?.data) {
    const decoded = decodeBase64(payload.body.data);
    return payload.mimeType === "text/html" ? stripHtml(decoded) : decoded;
  }

  // Prefer HTML (Santander's text/plain sometimes starts with CSS)
  const html = findPart(payload.parts, "text/html");
  if (html) return stripHtml(html);

  return findPart(payload.parts, "text/plain") ?? "";
}

// Devuelve el texto desde donde empieza el contenido real del correo
function extractRelevantSection(texto: string): string {
  const markers = ["con fecha", "Estimado", "Te informamos", "Monto transferido", "Numero de Transaccion", "Fecha - Hora"];
  for (const m of markers) {
    const idx = texto.toLowerCase().indexOf(m.toLowerCase());
    if (idx > 0) return texto.slice(Math.max(0, idx - 30), idx + 1500);
  }
  return texto.slice(0, 1500);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
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
  async function query(q: string): Promise<GmailMessage[]> {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json() as { messages?: GmailMessage[] };
    return data.messages ?? [];
  }
  const [santander, itau] = await Promise.all([
    query('from:mensajeria@santander.cl subject:"Comprobante Transferencia de fondos" is:unread'),
    query('from:transferencias@itau.cl is:unread'),
  ]);
  return [...santander, ...itau];
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
  // ── Monto ──────────────────────────────────────────────────────────────────
  // Itaú: "Monto:      $35.000"
  // Santander: "Monto transferido ... $ 80.000"
  const montoMatch =
    texto.match(/Monto:\s*\$\s*([\d.]+)/i) ??
    texto.match(/Monto transferido[\s\S]{0,80}\$\s*([\d.]+)/i);
  if (!montoMatch) return null;
  const monto = parseInt(montoMatch[1].replace(/\./g, ""));
  if (isNaN(monto)) return null;

  // ── Fecha ───────────────────────────────────────────────────────────────────
  // Itaú format 1: "Fecha - Hora    14/06/2026-HH:MM:SS"
  // Itaú format 2/3 & Santander: "con fecha DD/MM/YYYY"
  // Santander outgoing: "realizada el DD/MM/YYYY"
  const fechaMatch = texto.match(/(?:Fecha - Hora|con fecha|realizada el)\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  let fecha: string | null = null;
  if (fechaMatch) {
    const [d, m, y] = fechaMatch[1].split("/");
    fecha = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // ── Comercio ────────────────────────────────────────────────────────────────
  // Santander incoming: "nuestro cliente NAME realizó"
  const santanderIncomingMatch = texto.match(/nuestro cliente\s+(.+?)\s+realizó/i);
  // Itaú format 2/3 titular (recipient): "Titular Cuenta:      NAME"
  const itauTitularMatch = texto.match(/Titular Cuenta:\s*([^\n\r]*?)(?=\s*(?:Monto:|Banco:|Rut\b|N[uú]mero|\s{2,})|[\n\r]|$)/i);
  // Itaú format 2/3 sender: "nuestro(a) cliente NAME ,"
  const itauClienteMatch = texto.match(/nuestro\(a\) cliente\s+(.+?)\s*,/i);
  // Itaú format 1: "Nombre NAME" in destination section
  const itauDestinoMatch = texto.match(/Datos de la Cuenta de Destino[\s\S]{0,300}Nombre\s+(.*?)(?:\s+Rut|\s+E-mail|\s+Banco)/i);
  // Santander outgoing: "Datos de destino Nombre NAME RUT"
  const santanderDestinoMatch = texto.match(/Datos de destino\s+Nombre\s+(.*?)\s+RUT/i);

  const comercio =
    santanderIncomingMatch?.[1]?.trim() ??
    itauTitularMatch?.[1]?.trim() ??
    itauClienteMatch?.[1]?.trim() ??
    itauDestinoMatch?.[1]?.trim() ??
    santanderDestinoMatch?.[1]?.trim() ??
    "Transferencia";

  return { monto, comercio, fecha };
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Acepta key como header o como query param para abrirlo directo desde el browser
  const auth = request.headers.get("x-api-key") ?? new URL(request.url).searchParams.get("key");
  if (auth !== process.env.AUTH_PASSWORD) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const token = await getAccessToken();
    async function queryAndFetch(q: string) {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json() as { messages?: GmailMessage[] };
      const msgs = data.messages ?? [];
      const texts: string[] = [];
      for (const m of msgs) {
        const full = await getMessage(token, m.id);
        const raw = extractText(full.payload);
        texts.push(raw.slice(0, 2000));
      }
      return { query: q, count: msgs.length, texts };
    }
    const [santander, itauExacto, itauSubject, itauBroad] = await Promise.all([
      queryAndFetch('from:mensajeria@santander.cl subject:"Comprobante Transferencia de fondos" is:unread'),
      queryAndFetch('from:transferencias@itau.cl is:unread'),
      queryAndFetch('subject:"Itau informa" is:unread'),
      queryAndFetch('itau transferencia is:unread newer_than:60d'),
    ]);
    return NextResponse.json({ santander, itauExacto, itauSubject, itauBroad });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

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

        // Dedup: mismo monto + fecha + comercio = misma transferencia (Itaú manda 2 emails por transferencia)
        const { data: existing } = await supabase
          .from("sugerencias")
          .select("id")
          .eq("monto", datos.monto)
          .eq("comercio", datos.comercio)
          .eq("fecha", datos.fecha ?? "")
          .in("estado", ["pendiente", "guardado"])
          .limit(1);

        if (existing && existing.length > 0) {
          await markAsRead(token, msg.id);
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
