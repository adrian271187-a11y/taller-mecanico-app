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
- **Login del panel** — protegido con Firebase Authentication (correo/contraseña), con cuentas de Administrador y Mecánico (ver sección de roles más abajo)
- **Historial de actividad** — registra quién hizo qué y cuándo (crear, editar, eliminar, enviar factura, inicio de sesión); solo el administrador puede verlo

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
El panel usa cuentas locales definidas directamente en el código (`src/App.jsx`, constante `CUENTAS`), no correos reales. Aun así, necesitas activar el método **Anónimo** en Firebase para que la app pueda conectarse a Firestore de forma segura:
1. Firebase Console → **Authentication** → **Sign-in method** → activa **Anonymous**
2. Eso es todo — no necesitas crear ningún usuario en la pestaña "Users"

**Cuentas y roles:** hay 5 cuentas configuradas por defecto en la constante `CUENTAS` de `src/App.jsx`:

| Usuario | Contraseña | Rol | Permisos |
|---|---|---|---|
| `TallerAdmin` | `Taller2026$` | Administrador | Acceso completo — puede crear, editar y eliminar en todos los módulos |
| `Mecanico` | `Mecanico2026$` | Mecánico | Puede crear registros (clientes, vehículos, citas, órdenes, revisiones, proveedores, repuestos, facturas), pero no puede editar ni eliminar lo ya creado sin autorización del admin |
| `Meca1` | `Meca$` | Mecánico | Igual que arriba |
| `Meca2` | `Meca$` | Mecánico | Igual que arriba |
| `Meca3` | `Meca$` | Mecánico | Igual que arriba |

En Facturación, un mecánico puede **generar** una factura nueva, y libremente **ver, imprimir y enviar por correo** cualquier factura — pero **eliminarla** sí pide autorización del admin. En el resto de módulos, editar o eliminar cualquier registro (o cambiar el estado de una cita/orden) también pide esa autorización.

Cuando un mecánico intenta hacer algo restringido, la app le muestra un cuadro pidiendo el usuario y la contraseña del administrador — si los ingresa correctamente, la acción se ejecuta esa vez; si no, se cancela. Esto se maneja con la función `conAutorizacion(...)` que envuelve cada botón de editar/eliminar.

Para cambiar las contraseñas, agregar más cuentas, o cambiar qué puede hacer cada rol, edita el arreglo `CUENTAS` (y la lógica de `conAutorizacion` si quieres afinar permisos módulo por módulo) en `src/App.jsx` y vuelve a publicar. **Cambia las contraseñas por defecto antes de darle la app a tu equipo.**

**Historial de actividad:** cada vez que alguien crea, edita, elimina, envía una factura por correo o inicia sesión, queda un registro en la colección `historial` de Firestore (usuario, rol, acción, módulo, detalle y fecha/hora). Solo aparece la pestaña "Historial" en el menú, y solo se consulta esa información, cuando el usuario conectado es Administrador — un mecánico no la ve ni la descarga desde la app. Como se explicó arriba, esta restricción es a nivel de la app (mismo modelo de seguridad que el resto del sistema), no a nivel de las reglas de Firestore.

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

**Envío 100% automático con PDF adjunto (Cloud Function + MailerSend):** ya está implementado en `functions/index.js`. Cuando le das clic a "Enviar por correo", la app intenta primero esta función — si está desplegada y MailerSend configurado, el cliente recibe el correo con el PDF ya adjunto, sin abrir ninguna ventana ni pedirte hacer nada más. Se eligió MailerSend (en vez de EmailJS) porque su plan gratuito sí soporta adjuntos como función normal — en EmailJS los adjuntos están bloqueados detrás de un plan de pago, sin importar cómo se le mande el archivo desde el código.

**Cómo desplegarlo:**

1. **Activa el plan Blaze** (pago por uso) en tu proyecto de Firebase — es obligatorio para que las Cloud Functions puedan conectarse a internet. Tiene una capa gratuita amplia; para el volumen de un taller normalmente no genera cobro, pero sí pide una tarjeta asociada. Se activa en Firebase Console → ⚙️ (Configuración del proyecto) → Uso y facturación → Modificar plan.

2. **Crea una cuenta gratuita en [mailersend.com](https://www.mailersend.com)** y verifica un dominio de correo:
   - Ve a **Domains** → agrega tu dominio (por ejemplo `tutaller.com`)
   - MailerSend te va a pedir agregar unos registros DNS (SPF, DKIM) — esto se hace donde compraste el dominio (Namecheap, GoDaddy, etc.)
   - Sin un dominio propio verificado, MailerSend solo deja enviar de prueba a tu propio correo — si no tienes dominio, dime y vemos alternativas (usar un dominio que ya tengas, o un subdominio gratuito)
   - Una vez verificado, en `src/App.jsx` cambia `DATOS_TALLER.correo` para que sea una dirección de ese dominio verificado (por ejemplo `facturas@tutaller.com`), ya que MailerSend solo deja enviar **desde** un dominio verificado

3. **Genera tu API Key** en MailerSend: **Integrations** → **API tokens** → crea uno nuevo con permiso de envío ("Full access" o al menos "Email send")

4. **En la terminal**, dentro de la carpeta del proyecto (donde está `firebase.json`):
```
firebase login
firebase use taller-automotriz-ab5ca
cd functions
npm install
cd ..
```

5. **Guarda la API Key como "secret"** (no queda visible en el código):
```
firebase functions:secrets:set MAILERSEND_API_KEY
```
Te va a pedir el valor — pega ahí el API token que generaste en MailerSend.

6. **Despliega la función:**
```
firebase deploy --only functions
```

Después de esto, el botón "Enviar por correo" ya envía la factura automáticamente con el PDF adjunto. Puedes ver los registros con `cd functions && npm run logs` si algo falla (por ejemplo, si MailerSend rechaza el envío por un dominio sin verificar, ahí vas a ver el detalle exacto).

**Respaldo automático si algo falla:** si la Cloud Function no está desplegada, o falla por cualquier motivo, el sistema cae automáticamente a EmailJS (solo texto, sin adjunto, si lo configuraste) y, si eso también falla, al respaldo manual (descarga el PDF y abre un borrador de correo para adjuntarlo a mano) — así nunca se queda sin enviar nada.

**Sobre EmailJS (opcional, solo como respaldo de texto):** si quieres mantenerlo como aviso de texto (sin PDF) mientras configuras MailerSend, sigue estos pasos:
1. Crea una cuenta gratuita en [emailjs.com](https://www.emailjs.com)
2. Conecta un "Service" (por ejemplo tu Gmail)
3. Crea un "Template" con estas variables: `{{to_email}}` `{{to_name}}` `{{numero_factura}}` `{{monto}}` `{{fecha}}` `{{taller_nombre}}` — recuerda poner `{{to_email}}` en el campo "To Email" de la configuración de la plantilla (no en el cuerpo del mensaje), o el correo no le va a llegar a nadie
4. Ve a tu ícono de cuenta → **"Account"** → copia tu **Public Key**
5. En `src/App.jsx`, busca las constantes `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID` y `EMAILJS_PUBLIC_KEY`, y reemplázalas con los valores que te dio EmailJS

Mientras esas 3 constantes digan `"TU_..."`, ese paso simplemente se salta y el sistema usa el respaldo manual — así que la app funciona igual la hayas configurado o no.

## Pendiente para siguientes pasos (opcional)
- Fotos en la revisión de entrada/salida (Firebase Storage)
- Filtro de fechas y exportación de estadísticas
- Múltiples usuarios administradores con distintos niveles de permiso
