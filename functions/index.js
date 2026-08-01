const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const nodemailer = require("nodemailer");

// Credenciales del correo remitente, guardadas como "secrets" de Firebase (no van en el código).
// Se configuran una sola vez con:
//   firebase functions:secrets:set GMAIL_USER
//   firebase functions:secrets:set GMAIL_APP_PASSWORD
const gmailUser = defineSecret("GMAIL_USER");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

// Función invocable desde la app (httpsCallable) que envía la factura por correo con el PDF adjunto.
// Solo acepta llamadas de usuarios autenticados (la app ya usa inicio de sesión anónimo de Firebase).
exports.enviarFacturaCorreo = onCall(
  { secrets: [gmailUser, gmailAppPassword], region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión para enviar facturas.");
    }

    const { to, nombreCliente, numeroFactura, monto, fecha, tallerNombre, pdfBase64 } = request.data || {};

    if (!to || !pdfBase64 || !numeroFactura) {
      throw new HttpsError("invalid-argument", "Faltan datos para enviar la factura (correo, número o PDF).");
    }

    const user = gmailUser.value();
    const pass = gmailAppPassword.value();
    if (!user || !pass) {
      throw new HttpsError(
        "failed-precondition",
        "El correo remitente no está configurado en el servidor (faltan los secrets GMAIL_USER / GMAIL_APP_PASSWORD)."
      );
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    const nombreNegocio = tallerNombre || "Taller";
    const asunto = `Factura ${numeroFactura} - ${nombreNegocio}`;
    const cuerpo =
      `Hola ${nombreCliente || ""},\n\n` +
      `Adjunto la factura ${numeroFactura}` +
      (monto ? ` por un monto de ${monto}` : "") +
      ` correspondiente a los servicios realizados en su vehículo` +
      (fecha ? ` el ${fecha}.` : ".") +
      `\n\nGracias por su preferencia.\n\n${nombreNegocio}`;

    try {
      await transporter.sendMail({
        from: `"${nombreNegocio}" <${user}>`,
        to,
        subject: asunto,
        text: cuerpo,
        attachments: [
          {
            filename: `Factura-${numeroFactura}.pdf`,
            content: pdfBase64,
            encoding: "base64",
          },
        ],
      });
    } catch (err) {
      console.error("Error al enviar el correo:", err);
      throw new HttpsError("internal", "No se pudo enviar el correo. Intenta de nuevo más tarde.");
    }

    return { ok: true };
  }
);
