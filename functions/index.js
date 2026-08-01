const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// Clave de API de MailerSend, guardada como "secret" de Firebase (no va en el código).
// Se configura una sola vez con:
//   firebase functions:secrets:set MAILERSEND_API_KEY
const mailerSendApiKey = defineSecret("MAILERSEND_API_KEY");

// Función invocable desde la app (httpsCallable) que envía la factura por correo con el PDF
// adjunto, usando la API de MailerSend. Solo acepta llamadas de usuarios autenticados
// (la app ya usa inicio de sesión anónimo de Firebase).
exports.enviarFacturaCorreo = onCall(
  { secrets: [mailerSendApiKey], region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para enviar facturas.");
    }

    const {
      to,
      nombreCliente,
      numeroFactura,
      monto,
      fecha,
      tallerNombre,
      remitenteCorreo,
      remitenteNombre,
      pdfBase64,
    } = request.data || {};

    if (!to || !pdfBase64 || !numeroFactura) {
      throw new HttpsError("invalid-argument", "Faltan datos para enviar la factura (correo, número o PDF).");
    }

    const apiKey = mailerSendApiKey.value();
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "Falta configurar el secret MAILERSEND_API_KEY en el servidor."
      );
    }
    if (!remitenteCorreo) {
      throw new HttpsError(
        "invalid-argument",
        "Falta el correo remitente (debe ser un correo verificado en MailerSend)."
      );
    }

    const nombreNegocio = tallerNombre || "Taller";
    const asunto = `Factura ${numeroFactura} - ${nombreNegocio}`;
    const cuerpoTexto =
      `Hola ${nombreCliente || ""},\n\n` +
      `Adjunto la factura ${numeroFactura}` +
      (monto ? ` por un monto de ${monto}` : "") +
      ` correspondiente a los servicios realizados en su vehículo` +
      (fecha ? ` el ${fecha}.` : ".") +
      `\n\nGracias por su preferencia.\n\n${nombreNegocio}`;
    const cuerpoHtml = cuerpoTexto.replace(/\n/g, "<br>");

    const payload = {
      from: { email: remitenteCorreo, name: remitenteNombre || nombreNegocio },
      to: [{ email: to, name: nombreCliente || undefined }],
      subject: asunto,
      text: cuerpoTexto,
      html: cuerpoHtml,
      attachments: [
        {
          content: pdfBase64,
          filename: `Factura-${numeroFactura}.pdf`,
          disposition: "attachment",
        },
      ],
    };

    let resp;
    try {
      resp = await fetch("https://api.mailersend.com/v1/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Error de red al llamar a MailerSend:", err);
      throw new HttpsError("internal", "No se pudo contactar a MailerSend. Intenta de nuevo más tarde.");
    }

    if (!resp.ok) {
      const textoError = await resp.text().catch(() => "");
      console.error("MailerSend rechazó el envío:", resp.status, textoError);
      throw new HttpsError(
        "internal",
        `MailerSend rechazó el envío (código ${resp.status}). Revisa los logs del servidor para el detalle exacto.`
      );
    }

    return { ok: true };
  }
);
