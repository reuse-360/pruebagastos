import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function parsearTransferencia(texto: string): { monto: number; destinatario: string; comentario: string | null } | null {
  // Extraer monto: "$ 80.000" o "$ 1.234.567"
  const montoMatch = texto.match(/Monto transferido\s*\$\s*([\d.]+)/i);
  if (!montoMatch) return null;
  const monto = parseInt(montoMatch[1].replace(/\./g, ""));
  if (isNaN(monto)) return null;

  // Extraer destinatario
  const destMatch = texto.match(/Datos de destino\s*Nombre\s*([^\n]+)/i);
  const destinatario = destMatch ? destMatch[1].trim() : "Transferencia";

  // Extraer comentario
  const comentarioMatch = texto.match(/Comentario\s+([^\n]+)/i);
  const comentario = comentarioMatch ? comentarioMatch[1].trim() : null;

  return { monto, destinatario, comentario };
}

export async function POST(request: NextRequest) {
  // Protección: mismo token que la app
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
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    // Buscar correos de Santander con ese asunto, no vistos aún
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

    for await (const msg of client.fetch(uids as number[], { source: true })) {
      try {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source as Buffer);
        const texto = (parsed as { text?: string }).text ?? "";

        const datos = parsearTransferencia(texto);
        if (!datos) continue;

        const { error } = await supabase.from("sugerencias").insert({
          comercio: datos.destinatario,
          monto: datos.monto,
          texto_original: texto.slice(0, 500),
          ...(datos.comentario ? { comentario: datos.comentario } : {}),
        });

        if (error) {
          errores.push(error.message);
        } else {
          // Marcar como leído para no procesarlo de nuevo
          await client.messageFlagsAdd(msg.seq, ["\\Seen"]);
          nuevas++;
        }
      } catch {
        // ignorar correos que no se puedan parsear
      }
    }

    await client.logout();
    return NextResponse.json({ ok: true, nuevas, errores: errores.length > 0 ? errores : undefined });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
