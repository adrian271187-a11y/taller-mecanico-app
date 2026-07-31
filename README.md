# Taller Mecánico — Sistema de gestión

Sistema completo conectado a Firebase (Firestore) con los siguientes módulos funcionando:

- **Clientes** — registro y búsqueda
- **Vehículos** — vinculados a cada cliente
- **Agenda** — citas con estado (pendiente / confirmada / completada)
- **Órdenes de trabajo** — servicios + repuestos + mano de obra, con cálculo automático del costo total; descuenta stock de repuestos automáticamente
- **Revisión de entrada/salida** — checklist, kilometraje y notas por orden
- **Inventario** — repuestos con alerta de bajo stock (menos de 5 unidades)
- **Proveedores** — contacto y qué suministran
- **Facturación** — se genera desde una orden de trabajo, con botón de "enviar por correo" (ver sección de EmailJS abajo)
- **Estadísticas** — ingresos totales, órdenes completadas, servicios más solicitados

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
En la consola de Firebase → Authentication → método de correo/contraseña → crear tu usuario administrador.

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

### 6. Envío de facturas por correo (EmailJS)
El botón "Enviar por correo" de Facturación está listo para conectarse, pero necesita tu propia cuenta de EmailJS (emailjs.com):
1. Crea una cuenta y un servicio de correo (Gmail, etc.)
2. Crea una plantilla de correo para la factura
3. En `src/App.jsx`, dentro de la función `marcarEnviada`, agrega:
```js
import emailjs from '@emailjs/browser';
// ...
await emailjs.send('TU_SERVICE_ID', 'TU_TEMPLATE_ID', {
  cliente_nombre: cliente?.nombre,
  cliente_correo: cliente?.correo,
  monto: f.monto,
}, 'TU_PUBLIC_KEY');
```

## Pendiente para siguientes pasos (opcional)
- Login del panel de administración con Firebase Authentication (como en Kyomu Nails)
- Fotos en la revisión de entrada/salida (Firebase Storage)
- Filtro de fechas y exportación de estadísticas
