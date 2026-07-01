import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// We use the service role client because this is called by n8n backend without user session
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY || "fallback_key");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, type, channel, clientPhone, clientEmail, data } = body;

    if (!projectId || !type || !channel) {
      return NextResponse.json({ success: false, error: "Faltan parámetros requeridos (projectId, type, channel)" }, { status: 400 });
    }

    // 1. Obtener datos de la empresa
    const { data: project } = await supabase
      .from("projects")
      .select("company_name, company_cuit, owner_phone, address, agency_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ success: false, error: "Proyecto no encontrado" }, { status: 404 });
    }

    const { data: agencySettings } = await supabase
      .from("agency_settings")
      .select("waha_url, waha_api_key")
      .eq("agency_id", project.agency_id)
      .single();

    const companyName = project.company_name || "Nuestra Empresa";
    const companyCuit = project.company_cuit || "Consumidor Final";
    const companyPhone = project.owner_phone || "";
    const companyAddress = project.address || "Dirección no especificada";

    // 2. Generar el documento (PDF o Texto)
    let base64Pdf = "";
    let textMessage = "";

    if (channel === "whatsapp" && type === "reserva") {
      // Para reservas/visitas por whatsapp, el usuario mencionó "o en el caso de visitas solo una confirmacion por wapp" (texto simple)
      textMessage = `✅ *Confirmación de Reserva/Turno*\n\nEmpresa: ${companyName}\nFecha: ${data.date || 'A confirmar'}\nDetalle: ${data.details || ''}\n\n¡Te esperamos!`;
    } else {
      // Para presupuestos, facturas o turnos por mail/pdf
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.text(companyName, 14, 22);
      doc.setFontSize(10);
      doc.text(`CUIT: ${companyCuit}`, 14, 30);
      doc.text(`Tel: +${companyPhone}`, 14, 35);
      doc.text(`Dirección: ${companyAddress}`, 14, 40);

      const today = new Date().toLocaleDateString("es-AR");

      if (type === "presupuesto") {
        doc.setFontSize(16);
        doc.text("PRESUPUESTO", 150, 22);
        doc.setFontSize(10);
        doc.text(`Fecha: ${today}`, 150, 30);

        doc.text(`Cliente: ${data.clientName || 'Consumidor Final'}`, 14, 55);

        if (data.items && Array.isArray(data.items)) {
          const tableData = data.items.map((item: any) => [
            item.description || item.name || '',
            item.quantity || 1,
            `$${item.price || 0}`,
            `$${(item.quantity || 1) * (item.price || 0)}`
          ]);

          autoTable(doc, {
            startY: 65,
            head: [['Descripción', 'Cant.', 'Precio Unit.', 'Subtotal']],
            body: tableData,
          });
        }

        const finalY = (doc as any).lastAutoTable?.finalY || 65;
        doc.text(`Total estimado: $${data.total || 0}`, 14, finalY + 10);
      } 
      else if (type === "turno" || type === "reserva") {
        doc.setFontSize(16);
        doc.text(type === "turno" ? "COMPROBANTE DE TURNO" : "COMPROBANTE DE RESERVA", 120, 22);
        doc.setFontSize(10);
        doc.text(`Fecha Emisión: ${today}`, 120, 30);

        doc.text(`Detalles de la Reserva/Turno:`, 14, 55);
        doc.text(`Cliente: ${data.clientName || 'Consumidor Final'}`, 14, 65);
        doc.text(`Fecha pactada: ${data.date || 'A confirmar'}`, 14, 75);
        doc.text(`Detalles adicionales: ${data.details || 'Sin detalles'}`, 14, 85);
      }
      else if (type === "factura") {
        // En factura, asumimos que viene un link de la AFIP, o se genera el comprobante acá. 
        // Si AFIP devuelve PDF base64 (o podemos generarlo). Por ahora armamos un recibo/factura proforma.
        doc.setFontSize(16);
        doc.text("FACTURA C / RECIBO", 130, 22);
        doc.setFontSize(10);
        doc.text(`Fecha: ${today}`, 130, 30);
        
        doc.text(`Comprobante no válido como factura a menos que posea CAE`, 14, 50);
        doc.text(`Detalle: ${data.details || 'Servicios/Productos varios'}`, 14, 65);
        doc.text(`Total abonado: $${data.total || 0}`, 14, 75);
      }

      base64Pdf = doc.output("datauristring").split(',')[1];
    }

    // 3. Enviar el documento
    if (channel === "whatsapp" && agencySettings?.waha_url) {
      const wahaUrl = agencySettings.waha_url.replace(/\/$/, "");
      
      if (textMessage) {
        // Enviar solo texto
        await fetch(`${wahaUrl}/api/sendText`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": agencySettings.waha_api_key || ""
          },
          body: JSON.stringify({
            chatId: `${clientPhone}@c.us`,
            text: textMessage,
            session: projectId
          })
        });
      } else if (base64Pdf) {
        // Enviar archivo PDF por WAHA
        await fetch(`${wahaUrl}/api/sendFile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": agencySettings.waha_api_key || ""
          },
          body: JSON.stringify({
            chatId: `${clientPhone}@c.us`,
            file: {
              mimetype: "application/pdf",
              filename: `${type}_${companyName.replace(/ /g, "_")}.pdf`,
              data: base64Pdf
            },
            caption: `Adjunto tu ${type} de ${companyName}.`,
            session: projectId
          })
        });
      }

      return NextResponse.json({ success: true, message: "Enviado por WhatsApp correctamente." });

    } else if (channel === "email" && clientEmail) {
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ success: false, error: "RESEND_API_KEY no configurado en el servidor." }, { status: 500 });
      }

      const { data: resendData, error } = await resend.emails.send({
        from: `Notificaciones <onboarding@resend.dev>`, // Reemplazar con dominio verificado luego si es necesario
        to: [clientEmail],
        subject: `Tu ${type} de ${companyName}`,
        html: `<p>Hola,</p><p>Adjuntamos el documento (${type}) solicitado de parte de <strong>${companyName}</strong>.</p><p>Saludos.</p>`,
        attachments: [
          {
            filename: `${type}_${companyName.replace(/ /g, "_")}.pdf`,
            content: base64Pdf,
          }
        ]
      });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Enviado por Email correctamente.", id: resendData?.id });
    }

    return NextResponse.json({ success: false, error: "Canal inválido o falta email/teléfono." }, { status: 400 });

  } catch (error: any) {
    console.error("Error sending document:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
