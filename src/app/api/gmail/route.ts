import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

function parsearTransferencia(texto: string): { monto: number; destinatario: string; comentario: string | null } | null {
  // "Monto transferido" puede ir seguido de saltos de línea antes del $
  const montoMatch = texto.match(/Monto transferido[\s\S]{0,80}\$\s*([\d.]+)/i);
  if (!montoMatch) return null;
  const monto = parseInt(montoMatch[1].replace(/\./g, ""));
  if (isNaN(monto)) return null;

  // "Datos de destino" luego "Nombre" luego el nombre (puede haber varias líneas entre ellos)
  const destMatch = texto.match(/Datos de destino[\s\S]{0,300}Nombre[\s\r\n\t ]*([^\r\n]+)/i);
  const destinatario = destMatch ? destMatch[1].trim() : "Transferencia";

  const comentarioMatch = texto.match(/Comentario[\r\n\t ]+([^\r\n]+)/i);
  const comentario = comentarioMatch ? comentarioMatch[1].trim() : null;

  return { monto, destinatario, comentario };
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("x-api-key");
  if (auth !== process.env.AUTH_PASSWORD) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ error: "Gmail no configurado" }, { status: 500 });
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    logger: false,
    connectionTimeout: 8000,
    socketTimeout: 8000,
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    const uids = await client.search({
      from: "mensajeria@santander.cl",
      subject: "Comprobante Transferencia de fondos",
      seen: false,
    }) as number[];

    if (!uids || uids.length === 0) {
      await client.logout();
      return NextResponse.json({ ok: true, nuevas: 0 });
    }

    let nuevas = 0;
    const errores: string[] = [];
    const debugItems: string[] = [];

    for await (const msg of client.fetch(uids as number[], { source: true })) {
      try {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source as Buffer);

        // Preferir texto plano; si está vacío, derivar del HTML
        let texto = (parsed as { text?: string }).text ?? "";
        let fuenteTexto = "text";
        if (!texto.trim() && (parsed as { html?: string }).html) {
          texto = stripHtml((parsed as { html?: string }).html!);
          fuenteTexto = "html_stripped";
        }

        const datos = parsearTransferencia(texto);
        if (!datos) {
          debugItems.push(JSON.stringify({ fuente: fuenteTexto, preview: texto.slice(0, 1200) }));
          continue;
        }

        const { error } = await supabase.from("sugerencias").insert({
          comercio: datos.destinatario,
          monto: datos.monto,
          texto_original: texto.slice(0, 500),
          ...(datos.comentario ? { comentario: datos.comentario } : {}),
        });

        if (error) {
          errores.push(error.message);
        } else {
          await client.messageFlagsAdd(msg.seq, ["\\Seen"]);
          nuevas++;
        }
      } catch (e) {
        errores.push(String(e));
      }
    }

    await client.logout();

    if (debugItems.length > 0) {
      return NextResponse.json({ ok: false, nuevas, debug: debugItems });
    }
    return NextResponse.json({ ok: true, nuevas, errores: errores.length > 0 ? errores : undefined });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
