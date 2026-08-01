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

### 6. Factura en PDF y envío por correo
Cada factura se genera con un número consecutivo automático (FA-0001, FA-0002...) y un botón de "Ver / imprimir factura" que abre el PDF en una pestaña nueva (desde ahí se puede imprimir o guardar con el botón de descarga del navegador).

Los datos del taller que aparecen en el encabezado del PDF (nombre, cédula jurídica, dirección, teléfono, correo) están en la constante `DATOS_TALLER` dentro de `src/App.jsx` — edítalos con los datos reales de tu negocio.

**Importante:** este PDF es un comprobante interno del taller (recibo/factura de servicio), no una factura electrónica autorizada por el Ministerio de Hacienda. Si necesitas facturación electrónica oficial en Costa Rica, se requiere integrarse con un proveedor autorizado (ATV/Hacienda), lo cual es un desarrollo aparte.

El botón "Enviar por correo" descarga el PDF automáticamente y abre un borrador de correo (con el cliente y asunto ya llenos) para que solo adjuntes el PDF descargado y le des enviar. Esto es así porque enviar el correo de forma 100% automática con el PDF ya adjunto requiere conectar EmailJS (plan de pago, ya que el plan gratuito no permite adjuntos) o un backend propio con un servicio de correo (SendGrid, etc.) — avísame si quieres que conectemos alguna de estas dos opciones más adelante.

## Pendiente para siguientes pasos (opcional)
- Fotos en la revisión de entrada/salida (Firebase Storage)
- Filtro de fechas y exportación de estadísticas
- Múltiples usuarios administradores con distintos niveles de permiso
