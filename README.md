# Taller Mecánico — Sistema de gestión

Sistema completo conectado a Firebase (Firestore) con los siguientes módulos funcionando:

- **Clientes** — registro y búsqueda
- **Vehículos** — vinculados a cada cliente
- **Agenda** — citas con estado (pendiente / confirmada / completada)
- **Órdenes de trabajo** — servicios + repuestos + mano de obra, con cálculo automático del costo total; descuenta stock de repuestos automáticamente
- **Revisión de entrada/salida** — checklist, kilometraje y notas por orden
- **Inventario** — repuestos con alerta de bajo stock (menos de 5 unidades)
- **Proveedores** — contacto y qué suministran
- **Facturación** — se genera desde una orden de trabajo, con **número consecutivo automático** (FA-0001, FA-0002...), botón para **ver/imprimir la factura en PDF** y botón de "enviar por correo" (ver sección de PDF y correo abajo)
- **Estadísticas** — ingresos totales, órdenes completadas, servicios más solicitados
- **Login del panel** — protegido con Firebase Authentication (correo/contraseña)

## Cómo subirlo (mismo flujo que Kyomu Nails)

### 1. Probarlo localmente (opcional)
```
npm install
npm run dev
```

### 2. Subir a GitHub
```
git init
git add .
git commit -m "Sistema completo: todos los módulos"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/taller-mecanico-app.git
git push -u origin main
```

### 3. Publicar en Railway
1. Entra a [railway.app](https://railway.app) y crea un nuevo proyecto
2. Elige "Deploy from GitHub repo" y selecciona este repositorio
3. En Settings, configura:
   - **Build command**: `npm install && npm run build`
   - **Start command**: `npm run preview`
4. Railway te dará una URL pública

### 4. Activar Authentication en Firebase (para el panel admin)
El panel usa un usuario local (`TallerAdmin`) definido directamente en el código (`src/App.jsx`, constantes `LOCAL_USERNAME` y `LOCAL_PASSWORD`), no un correo real. Aun así, necesitas activar el método **Anónimo** en Firebase para que la app pueda conectarse a Firestore de forma segura:
1. Firebase Console → **Authentication** → **Sign-in method** → activa **Anonymous**
2. Eso es todo — no necesitas crear ningún usuario en la pestaña "Users"

Para cambiar el usuario o la contraseña del panel más adelante, edita esas dos constantes en `src/App.jsx` y vuelve a publicar.

### 5. Reglas de seguridad de Firestore
En Firebase → Firestore Database → Reglas:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 6. Factura en PDF y envío automático por correo
Cada factura se genera con un número consecutivo automático (FA-0001, FA-0002...) y un botón de "Ver / imprimir factura" que abre el PDF en una pestaña nueva (desde ahí se puede imprimir o guardar con el botón de descarga del navegador). El diseño incluye encabezado de marca, tarjetas de cliente/vehículo, tabla de servicios/repuestos, desglose de Subtotal + IVA (13%) + Total, y una marca de agua sutil de engranaje. El símbolo ₡ se dibuja con una fuente embebida (`src/fonts_dejavu.js`) porque las fuentes estándar de PDF no lo incluyen.

Los datos del taller que aparecen en el encabezado (nombre, cédula jurídica, dirección, teléfono, correo) están en la constante `DATOS_TALLER` dentro de `src/App.jsx` — edítalos con los datos reales de tu negocio.

**Importante:** este PDF es un comprobante interno del taller (recibo/factura de servicio), no una factura electrónica autorizada por el Ministerio de Hacienda. Si necesitas facturación electrónica oficial en Costa Rica, se requiere integrarse con un proveedor autorizado (ATV/Hacienda), lo cual es un desarrollo aparte.

**Envío automático por correo (EmailJS):** el botón "Enviar por correo" ya está conectado para enviar el correo automáticamente al cliente, con el PDF adjunto, sin abrir ninguna ventana ni pedirte adjuntar nada a mano. Para activarlo:
1. Crea una cuenta gratuita en [emailjs.com](https://www.emailjs.com)
2. Conecta un "Service" (por ejemplo tu Gmail)
3. Crea un "Template" con estas variables: `{{to_email}}` `{{to_name}}` `{{numero_factura}}` `{{monto}}` `{{fecha}}` `{{taller_nombre}}` — recuerda poner `{{to_email}}` en el campo "To Email" de la configuración de la plantilla (no en el cuerpo del mensaje), o el correo no le va a llegar a nadie
4. **Para que el PDF vaya adjunto:** dentro del editor de la plantilla, busca la pestaña/sección **"Attachments"** (a veces aparece como un ícono de clip 📎) y agrega un adjunto que apunte al campo `attachment` — así es como referencia el archivo que la app manda en un `<input type="file" name="attachment">` oculto
5. Ve a tu ícono de cuenta → **"Account"** → copia tu **Public Key**
6. En `src/App.jsx`, busca las constantes `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID` y `EMAILJS_PUBLIC_KEY`, y reemplázalas con los valores que te dio EmailJS

Mientras esas 3 constantes digan `"TU_..."`, el sistema usa automáticamente un respaldo manual (descarga el PDF y abre un borrador de correo para adjuntarlo) en vez de fallar en silencio — así que la app funciona igual antes y después de configurar EmailJS.

Este método de adjuntar el PDF (formulario oculto con un archivo simulado) funciona en el plan gratuito de EmailJS porque usa el mismo mecanismo que un formulario HTML normal — a diferencia de mandar el adjunto directamente por su API, que si requiere plan de pago. Si por alguna razón EmailJS cambia esto y deja de funcionar, prueba primero sin el paso 4 (el correo igual llega, solo que sin el PDF) y usa la Cloud Function de abajo para el adjunto garantizado.

**Envío 100% automático con PDF adjunto (Cloud Function propia):** también está implementado en `functions/index.js`, como alternativa más robusta a EmailJS (no depende de límites de un plan gratuito de terceros). Cuando le das clic a "Enviar por correo", la app intenta primero esta función — si está desplegada, el cliente recibe el correo con el PDF ya adjunto. Si no está desplegada, cae automáticamente a EmailJS (si lo configuraste) o al respaldo manual, así que nada se rompe mientras la despliegas.

**Cómo desplegar la Cloud Function:**

1. **Activa el plan Blaze** (pago por uso) en tu proyecto de Firebase — es obligatorio para que las Cloud Functions puedan conectarse a internet (enviar el correo). El plan Blaze igual incluye una capa gratuita generosa; para el volumen de un taller esto normalmente no genera cobros, pero sí necesitas una tarjeta asociada. Se activa en Firebase Console → ⚙️ (Configuración del proyecto) → Uso y facturación → Modificar plan.

2. **Crea una "Contraseña de aplicación" de Gmail** (la cuenta de correo desde la que se enviarán las facturas):
   - Activa la verificación en 2 pasos en esa cuenta de Gmail (myaccount.google.com/security)
   - Ve a myaccount.google.com/apppasswords y genera una contraseña de aplicación (16 caracteres) — **no uses tu contraseña normal de Gmail**

3. **En la terminal**, dentro de la carpeta del proyecto (donde está `firebase.json`):
```
firebase login
firebase use taller-automotriz-ab5ca
cd functions
npm install
cd ..
```

4. **Guarda las credenciales de correo como "secrets"** (no quedan visibles en el código):
```
firebase functions:secrets:set GMAIL_USER
firebase functions:secrets:set GMAIL_APP_PASSWORD
```
Te va a pedir el valor de cada uno — pega el correo de Gmail en el primero, y la contraseña de aplicación de 16 caracteres en el segundo.

5. **Despliega la función:**
```
firebase deploy --only functions
```

Después de esto, el botón "Enviar por correo" ya envía la factura automáticamente con el PDF adjunto. Puedes ver los registros con `cd functions && npm run logs` si algo falla.

## Pendiente para siguientes pasos (opcional)
- Fotos en la revisión de entrada/salida (Firebase Storage)
- Filtro de fechas y exportación de estadísticas
- Múltiples usuarios administradores con distintos niveles de permiso
