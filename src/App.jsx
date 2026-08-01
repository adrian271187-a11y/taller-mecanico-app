import React, { useState, useMemo, useEffect } from "react";
import { db, auth, functions } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
} from "firebase/firestore";
import {
  signInAnonymously, onAuthStateChanged, signOut,
} from "firebase/auth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import emailjs from "@emailjs/browser";
import { httpsCallable } from "firebase/functions";
import { DEJAVU_SANS_REGULAR_BASE64 } from "./fonts_dejavu";
import {
  Wrench, Users, Car, Calendar, Package, Truck, Receipt,
  BarChart3, ClipboardCheck, Plus, X, Search, Phone, Mail,
  ChevronRight, Trash2, Edit2, Send, AlertTriangle, LogOut, Lock,
  FileText, Printer,
} from "lucide-react";

// Usuario local del panel de administración (no requiere correo real)
const LOCAL_USERNAME = "TallerAdmin";
const LOCAL_PASSWORD = "Taller2026$";

const NAV = [
  { id: "dashboard", label: "Panel", icon: BarChart3 },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "vehiculos", label: "Vehículos", icon: Car },
  { id: "agenda", label: "Agenda", icon: Calendar },
  { id: "ordenes", label: "Órdenes de trabajo", icon: Wrench },
  { id: "revisiones", label: "Revisión E/S", icon: ClipboardCheck },
  { id: "inventario", label: "Inventario", icon: Package },
  { id: "proveedores", label: "Proveedores", icon: Truck },
  { id: "facturacion", label: "Facturación", icon: Receipt },
  { id: "estadisticas", label: "Estadísticas", icon: BarChart3 },
];

const COLORS = {
  bg: "#0e1114", surface: "#1C2226", surfaceRaised: "#242B30", border: "#2E363B",
  textPrimary: "#EDEFF0", textSecondary: "#8B96A0", accent: "#FF6A2E",
  accentBlue: "#4A90C2", success: "#4CAF6D", danger: "#D8564A",
};

// Imagen de fondo por módulo (una por cada vista del panel + login)
// Nota: se evitan deliberadamente las fotos de muy baja resolución para que no se vean pixeladas.
const BACKGROUNDS = {
  login: "/backgrounds/login.jpg",
  dashboard: "/backgrounds/dashboard.jpg",
  clientes: "/backgrounds/clientes.jpg",
  vehiculos: "/backgrounds/vehiculos.jpg",
  agenda: "/backgrounds/agenda.jpg",
  ordenes: "/backgrounds/ordenes.jpg",
  revisiones: "/backgrounds/revisiones.jpg",
  inventario: "/backgrounds/inventario.jpg",
  proveedores: "/backgrounds/proveedores.jpg",
  facturacion: "/backgrounds/facturacion.jpg",
  estadisticas: "/backgrounds/estadisticas.jpg",
};

// Overlay oscuro para la pantalla de login (imagen de buena resolución, cubre bien sin perder nitidez)
function moduleBackgroundStyle(key) {
  const img = BACKGROUNDS[key];
  if (!img) return {};
  return {
    backgroundImage: `linear-gradient(rgba(14,17,20,0.72), rgba(14,17,20,0.85)), url(${img})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
}

// Panel lateral con la foto del módulo: se muestra a su tamaño real (no estirada a pantalla completa)
// para que no se vea pixelada, con un degradado que la funde hacia el fondo oscuro del panel.
function ModulePhotoPanel({ view }) {
  const img = BACKGROUNDS[view];
  if (!img) return null;
  return (
    <div style={{
      position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
      overflow: "hidden", pointerEvents: "none", zIndex: 0,
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: "44%", minWidth: 300, maxWidth: 620,
        backgroundImage: `url(${img})`,
        backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
      }} />
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: "44%", minWidth: 300, maxWidth: 620,
        background: `linear-gradient(to right, ${COLORS.bg} 0%, rgba(14,17,20,0.55) 30%, rgba(14,17,20,0.28) 65%, rgba(14,17,20,0.35) 100%)`,
      }} />
    </div>
  );
}

function TicketBadge({ n }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textSecondary, letterSpacing: "0.05em" }}>
      #{String(n).padStart(4, "0")}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,12,14,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, width: wide ? 560 : 420, maxWidth: "100%", padding: 24, maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, color: COLORS.textPrimary, fontWeight: 600 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.textSecondary }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <label style={{ display: "block", fontSize: 12, color: COLORS.textSecondary, marginBottom: 5, fontFamily: "'Inter', sans-serif" }}>{children}</label>;
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", background: "#14181B", border: `1px solid ${COLORS.border}`,
  borderRadius: 6, padding: "9px 11px", color: COLORS.textPrimary, fontSize: 14, fontFamily: "'Inter', sans-serif",
  marginBottom: 14, outline: "none",
};

const btnPrimary = {
  background: COLORS.accent, color: "#1C0D04", border: "none", borderRadius: 6,
  padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  fontFamily: "'Inter', sans-serif", width: "100%",
};

const btnGhost = {
  background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 6,
  cursor: "pointer", color: COLORS.textSecondary,
};

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
      <div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, margin: "0 0 4px" }}>{title}</h2>
        <p style={{ color: COLORS.textSecondary, fontSize: 13.5, margin: 0 }}>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function money(n) {
  const v = Number(n) || 0;
  // toLocaleString("es-CR") separa los miles con un espacio "duro" (U+00A0) que puede no existir
  // en fuentes recortadas (como la del PDF); lo cambiamos por un espacio normal para evitar problemas.
  return "₡" + v.toLocaleString("es-CR", { maximumFractionDigits: 0 }).replace(/\u00A0/g, " ");
}

const PDF_FONT = "DejaVuSans";

// Registra en el documento jsPDF la fuente que sí incluye el símbolo ₡ y los acentos en español
// (las fuentes estándar de PDF como Helvetica no tienen esos glifos y los muestran como "¡").
// Se usa un único archivo de fuente (sin negrita real) registrado tanto para "normal" como para
// "bold", para mantener el PDF lo más liviano posible (clave para el límite de adjuntos de EmailJS).
function registrarFuentePDF(docPdf) {
  docPdf.addFileToVFS("DejaVuSans.ttf", DEJAVU_SANS_REGULAR_BASE64);
  docPdf.addFont("DejaVuSans.ttf", PDF_FONT, "normal");
  docPdf.addFont("DejaVuSans.ttf", PDF_FONT, "bold");
  docPdf.setFont(PDF_FONT, "normal");
}

export default function App() {
  const [view, setView] = useState("dashboard");
  const [user, setUser] = useState(undefined); // undefined = cargando, null = sin sesión
  const [loginUsuario, setLoginUsuario] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      // Solo se considera "con sesión" si además pasó la validación local
      const sesionLocal = localStorage.getItem("taller_admin_session") === "1";
      setUser(u && sesionLocal ? u : null);
    });
    return () => unsub();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    if (loginUsuario !== LOCAL_USERNAME || loginPassword !== LOCAL_PASSWORD) {
      setLoginError("Usuario o contraseña incorrectos.");
      return;
    }
    try {
      await signInAnonymously(auth);
      localStorage.setItem("taller_admin_session", "1");
      setUser(auth.currentUser);
    } catch (err) {
      setLoginError("No se pudo iniciar sesión. Intenta de nuevo.");
    }
  }
  async function handleLogout() {
    localStorage.removeItem("taller_admin_session");
    await signOut(auth);
    setUser(null);
  }

  // Colecciones
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [citas, setCitas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [repuestos, setRepuestos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [revisiones, setRevisiones] = useState([]);
  const [facturas, setFacturas] = useState([]);

  useEffect(() => {
    if (!user) return;
    const subs = [
      onSnapshot(collection(db, "clientes"), (s) => setClientes(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "vehiculos"), (s) => setVehiculos(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "citas"), (s) => setCitas(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "servicios"), (s) => setServicios(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "repuestos"), (s) => setRepuestos(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "proveedores"), (s) => setProveedores(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "ordenes"), (s) => setOrdenes(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "revisiones"), (s) => setRevisiones(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "facturas"), (s) => setFacturas(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
    ];
    return () => subs.forEach((u) => u());
  }, [user]);

  // ---------- Clientes ----------
  const [search, setSearch] = useState("");
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [clienteForm, setClienteForm] = useState({ nombre: "", telefono: "", correo: "" });

  const filteredClientes = useMemo(() => {
    const q = search.toLowerCase();
    return clientes.filter((c) => c.nombre?.toLowerCase().includes(q) || c.telefono?.includes(q));
  }, [clientes, search]);

  const vehiculosByCliente = (clienteId) => vehiculos.filter((v) => v.clienteId === clienteId);

  function openNewCliente() { setSaveError(""); setEditingCliente(null); setClienteForm({ nombre: "", telefono: "", correo: "" }); setShowClienteModal(true); }
  function openEditCliente(c) { setSaveError(""); setEditingCliente(c.id); setClienteForm({ nombre: c.nombre, telefono: c.telefono, correo: c.correo || "" }); setShowClienteModal(true); }
  async function saveCliente() {
    if (!clienteForm.nombre.trim()) return;
    setSaveError("");
    try {
      if (editingCliente) await updateDoc(doc(db, "clientes", editingCliente), clienteForm);
      else await addDoc(collection(db, "clientes"), clienteForm);
      setShowClienteModal(false);
      setEditingCliente(null);
      setClienteForm({ nombre: "", telefono: "", correo: "" });
    } catch (err) {
      console.error("Error al guardar cliente:", err);
      setSaveError(err.message || "No se pudo guardar el cliente.");
    }
  }
  async function deleteCliente(id) {
    await deleteDoc(doc(db, "clientes", id));
    await Promise.all(vehiculos.filter((v) => v.clienteId === id).map((v) => deleteDoc(doc(db, "vehiculos", v.id))));
  }

  // ---------- Vehículos ----------
  const [showVehiculoModal, setShowVehiculoModal] = useState(false);
  const [editingVehiculo, setEditingVehiculo] = useState(null);
  const [vehiculoForm, setVehiculoForm] = useState({ clienteId: "", placa: "", marca: "", modelo: "", anio: "", km: "" });

  function openNewVehiculo(clienteId) { setSaveError(""); setEditingVehiculo(null); setVehiculoForm({ clienteId: clienteId || "", placa: "", marca: "", modelo: "", anio: "", km: "" }); setShowVehiculoModal(true); }
  function openEditVehiculo(v) { setSaveError(""); setEditingVehiculo(v.id); setVehiculoForm({ clienteId: v.clienteId, placa: v.placa, marca: v.marca, modelo: v.modelo, anio: v.anio, km: v.km }); setShowVehiculoModal(true); }
  async function saveVehiculo() {
    if (!vehiculoForm.placa.trim() || !vehiculoForm.clienteId) return;
    setSaveError("");
    try {
      if (editingVehiculo) await updateDoc(doc(db, "vehiculos", editingVehiculo), vehiculoForm);
      else await addDoc(collection(db, "vehiculos"), vehiculoForm);
      setShowVehiculoModal(false);
      setEditingVehiculo(null);
      setVehiculoForm({ clienteId: "", placa: "", marca: "", modelo: "", anio: "", km: "" });
    } catch (err) {
      console.error("Error al guardar vehículo:", err);
      setSaveError(err.message || "No se pudo guardar el vehículo.");
    }
  }
  async function deleteVehiculo(id) { await deleteDoc(doc(db, "vehiculos", id)); }

  // ---------- Agenda ----------
  const [showCitaModal, setShowCitaModal] = useState(false);
  const [editingCita, setEditingCita] = useState(null);
  const [citaForm, setCitaForm] = useState({ clienteId: "", vehiculoId: "", fecha: "", hora: "", servicio: "", estado: "pendiente" });

  const citasOrdenadas = useMemo(() => [...citas].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)), [citas]);

  function openNewCita() { setSaveError(""); setEditingCita(null); setCitaForm({ clienteId: "", vehiculoId: "", fecha: "", hora: "", servicio: "", estado: "pendiente" }); setShowCitaModal(true); }
  function openEditCita(c) { setSaveError(""); setEditingCita(c.id); setCitaForm({ clienteId: c.clienteId, vehiculoId: c.vehiculoId, fecha: c.fecha, hora: c.hora, servicio: c.servicio, estado: c.estado || "pendiente" }); setShowCitaModal(true); }
  async function saveCita() {
    if (!citaForm.clienteId || !citaForm.fecha || !citaForm.hora) return;
    setSaveError("");
    try {
      if (editingCita) await updateDoc(doc(db, "citas", editingCita), citaForm);
      else await addDoc(collection(db, "citas"), citaForm);
      setShowCitaModal(false);
      setEditingCita(null);
      setCitaForm({ clienteId: "", vehiculoId: "", fecha: "", hora: "", servicio: "", estado: "pendiente" });
    } catch (err) {
      console.error("Error al guardar cita:", err);
      setSaveError(err.message || "No se pudo guardar la cita.");
    }
  }
  async function deleteCita(id) { await deleteDoc(doc(db, "citas", id)); }
  async function toggleEstadoCita(c) {
    const siguiente = c.estado === "confirmada" ? "completada" : c.estado === "completada" ? "pendiente" : "confirmada";
    await updateDoc(doc(db, "citas", c.id), { estado: siguiente });
  }

  // ---------- Proveedores ----------
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [proveedorForm, setProveedorForm] = useState({ nombre: "", contacto: "", telefono: "", suministra: "" });

  function openNewProveedor() { setSaveError(""); setEditingProveedor(null); setProveedorForm({ nombre: "", contacto: "", telefono: "", suministra: "" }); setShowProveedorModal(true); }
  function openEditProveedor(p) { setSaveError(""); setEditingProveedor(p.id); setProveedorForm({ nombre: p.nombre, contacto: p.contacto || "", telefono: p.telefono || "", suministra: p.suministra || "" }); setShowProveedorModal(true); }
  async function saveProveedor() {
    if (!proveedorForm.nombre.trim()) return;
    setSaveError("");
    try {
      if (editingProveedor) await updateDoc(doc(db, "proveedores", editingProveedor), proveedorForm);
      else await addDoc(collection(db, "proveedores"), proveedorForm);
      setShowProveedorModal(false);
      setEditingProveedor(null);
      setProveedorForm({ nombre: "", contacto: "", telefono: "", suministra: "" });
    } catch (err) {
      console.error("Error al guardar proveedor:", err);
      setSaveError(err.message || "No se pudo guardar el proveedor.");
    }
  }
  async function deleteProveedor(id) { await deleteDoc(doc(db, "proveedores", id)); }

  // ---------- Inventario (repuestos) ----------
  const [showRepuestoModal, setShowRepuestoModal] = useState(false);
  const [editingRepuesto, setEditingRepuesto] = useState(null);
  const [repuestoForm, setRepuestoForm] = useState({ nombre: "", stock: "", precioCompra: "", precioVenta: "", proveedorId: "" });

  function openNewRepuesto() { setSaveError(""); setEditingRepuesto(null); setRepuestoForm({ nombre: "", stock: "", precioCompra: "", precioVenta: "", proveedorId: "" }); setShowRepuestoModal(true); }
  function openEditRepuesto(r) { setSaveError(""); setEditingRepuesto(r.id); setRepuestoForm({ nombre: r.nombre, stock: r.stock, precioCompra: r.precioCompra, precioVenta: r.precioVenta, proveedorId: r.proveedorId || "" }); setShowRepuestoModal(true); }
  async function saveRepuesto() {
    if (!repuestoForm.nombre.trim()) return;
    setSaveError("");
    try {
      const payload = { ...repuestoForm, stock: Number(repuestoForm.stock) || 0, precioCompra: Number(repuestoForm.precioCompra) || 0, precioVenta: Number(repuestoForm.precioVenta) || 0 };
      if (editingRepuesto) await updateDoc(doc(db, "repuestos", editingRepuesto), payload);
      else await addDoc(collection(db, "repuestos"), payload);
      setShowRepuestoModal(false);
      setEditingRepuesto(null);
      setRepuestoForm({ nombre: "", stock: "", precioCompra: "", precioVenta: "", proveedorId: "" });
    } catch (err) {
      console.error("Error al guardar repuesto:", err);
      setSaveError(err.message || "No se pudo guardar el repuesto.");
    }
  }
  async function deleteRepuesto(id) { await deleteDoc(doc(db, "repuestos", id)); }

  // ---------- Catálogo de servicios ----------
  const [nuevoServicioNombre, setNuevoServicioNombre] = useState("");
  const [nuevoServicioPrecio, setNuevoServicioPrecio] = useState("");
  async function agregarServicio() {
    if (!nuevoServicioNombre.trim()) return;
    await addDoc(collection(db, "servicios"), { nombre: nuevoServicioNombre, precio: Number(nuevoServicioPrecio) || 0 });
    setNuevoServicioNombre(""); setNuevoServicioPrecio("");
  }
  async function eliminarServicio(id) { await deleteDoc(doc(db, "servicios", id)); }

  // ---------- Órdenes de trabajo ----------
  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [editingOrden, setEditingOrden] = useState(null);
  const [ordenForm, setOrdenForm] = useState({ vehiculoId: "", items: [], manoObra: "", estado: "abierta", fecha: "" });
  const [itemTipo, setItemTipo] = useState("servicio");
  const [itemSeleccionId, setItemSeleccionId] = useState("");
  const [itemCantidad, setItemCantidad] = useState("1");

  const costoOrdenActual = useMemo(() => {
    const itemsTotal = ordenForm.items.reduce((sum, it) => sum + it.precio * it.cantidad, 0);
    return itemsTotal + (Number(ordenForm.manoObra) || 0);
  }, [ordenForm.items, ordenForm.manoObra]);

  function openNewOrden() {
    setSaveError("");
    setEditingOrden(null);
    setOrdenForm({ vehiculoId: "", items: [], manoObra: "", estado: "abierta", fecha: new Date().toISOString().slice(0, 10) });
    setShowOrdenModal(true);
  }
  function openEditOrden(o) {
    setSaveError("");
    setEditingOrden(o.id);
    setOrdenForm({ vehiculoId: o.vehiculoId, items: o.items || [], manoObra: o.manoObra || "", estado: o.estado || "abierta", fecha: o.fecha || "" });
    setShowOrdenModal(true);
  }
  function agregarItemOrden() {
    if (!itemSeleccionId) return;
    const cantidad = Number(itemCantidad) || 1;
    if (itemTipo === "servicio") {
      const s = servicios.find((x) => x.id === itemSeleccionId);
      if (!s) return;
      setOrdenForm({ ...ordenForm, items: [...ordenForm.items, { tipo: "servicio", refId: s.id, nombre: s.nombre, precio: s.precio, cantidad }] });
    } else {
      const r = repuestos.find((x) => x.id === itemSeleccionId);
      if (!r) return;
      setOrdenForm({ ...ordenForm, items: [...ordenForm.items, { tipo: "repuesto", refId: r.id, nombre: r.nombre, precio: r.precioVenta, cantidad }] });
    }
    setItemSeleccionId(""); setItemCantidad("1");
  }
  function quitarItemOrden(idx) {
    setOrdenForm({ ...ordenForm, items: ordenForm.items.filter((_, i) => i !== idx) });
  }
  async function saveOrden() {
    if (!ordenForm.vehiculoId) return;
    setSaveError("");
    try {
      const vehiculo = vehiculos.find((v) => v.id === ordenForm.vehiculoId);
      const payload = { ...ordenForm, clienteId: vehiculo?.clienteId || "", costoTotal: costoOrdenActual };
      if (editingOrden) {
        await updateDoc(doc(db, "ordenes", editingOrden), payload);
      } else {
        await addDoc(collection(db, "ordenes"), payload);
        // Descuenta stock de repuestos usados
        for (const it of ordenForm.items) {
          if (it.tipo === "repuesto") {
            const r = repuestos.find((x) => x.id === it.refId);
            if (r) await updateDoc(doc(db, "repuestos", r.id), { stock: Math.max(0, (Number(r.stock) || 0) - it.cantidad) });
          }
        }
      }
      setShowOrdenModal(false);
      setEditingOrden(null);
      setOrdenForm({ vehiculoId: "", items: [], manoObra: "", estado: "abierta", fecha: "" });
    } catch (err) {
      console.error("Error al guardar orden:", err);
      setSaveError(err.message || "No se pudo guardar la orden.");
    }
  }
  async function deleteOrden(id) { await deleteDoc(doc(db, "ordenes", id)); }
  async function cambiarEstadoOrden(o, estado) { await updateDoc(doc(db, "ordenes", o.id), { estado }); }

  // ---------- Revisión E/S ----------
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const CHECKLIST_ITEMS = ["Luces", "Llantas", "Frenos", "Fluidos", "Carrocería", "Batería"];
  const [revisionForm, setRevisionForm] = useState({ ordenId: "", tipo: "entrada", km: "", notas: "", checklist: {} });

  function openNewRevision() {
    setSaveError("");
    setRevisionForm({ ordenId: "", tipo: "entrada", km: "", notas: "", checklist: {} });
    setShowRevisionModal(true);
  }
  function toggleChecklistItem(item) {
    setRevisionForm({ ...revisionForm, checklist: { ...revisionForm.checklist, [item]: !revisionForm.checklist[item] } });
  }
  async function saveRevision() {
    if (!revisionForm.ordenId) return;
    setSaveError("");
    try {
      await addDoc(collection(db, "revisiones"), revisionForm);
      setShowRevisionModal(false);
      setRevisionForm({ ordenId: "", tipo: "entrada", km: "", notas: "", checklist: {} });
    } catch (err) {
      console.error("Error al guardar revisión:", err);
      setSaveError(err.message || "No se pudo guardar la revisión.");
    }
  }
  async function deleteRevision(id) { await deleteDoc(doc(db, "revisiones", id)); }

  // ---------- Facturación ----------
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [facturaForm, setFacturaForm] = useState({ ordenId: "", monto: "", estadoEnvio: "pendiente" });

  // Datos del taller que aparecen en el encabezado de la factura (edítalos con los datos reales del negocio).
  // "correo" también se usa como remitente al enviar por MailerSend, por eso debe ser una dirección
  // de un dominio verificado ahí — por ahora usa el dominio de prueba de MailerSend (mientras no
  // verifiques tu propio dominio), así que también sale así en el PDF. Cuando verifiques tu dominio
  // real (ej. tutaller.com), cambia esto a algo como "facturas@tutaller.com".
  const DATOS_TALLER = {
    nombre: "Taller Mecánico",
    cedulaJuridica: "3-101-000000",
    direccion: "San José, Costa Rica",
    telefono: "8888-1234",
    correo: "facturas@test-dnvo4d9vymrg5r86.mlsender.net",
  };

  // Configuración de EmailJS para el envío automático de la factura por correo.
  // Crea una cuenta gratuita en emailjs.com, un "Service" (tu Gmail, por ejemplo) y una
  // plantilla ("Template") con estas variables: {{to_email}} {{to_name}} {{numero_factura}}
  // {{monto}} {{fecha}} {{taller_nombre}} — y pega aquí los 3 valores que te da EmailJS.
  // Mientras estos 3 campos digan "TU_..." el sistema usa automáticamente el respaldo manual
  // (descarga el PDF y abre un borrador de correo) en vez de fallar en silencio.
  const EMAILJS_SERVICE_ID = "service_b9wd9s9";
  const EMAILJS_TEMPLATE_ID = "template_9olimrp";
  const EMAILJS_PUBLIC_KEY = "1FTwMiRXWwu15F_2e";
  const emailjsConfigurado =
    !EMAILJS_SERVICE_ID.startsWith("TU_") && !EMAILJS_TEMPLATE_ID.startsWith("TU_") && !EMAILJS_PUBLIC_KEY.startsWith("TU_");

  function formatoNumeroFactura(n) {
    return `FA-${String(n || 0).padStart(4, "0")}`;
  }

  function siguienteNumeroFactura() {
    const maxNumero = facturas.reduce((max, f) => Math.max(max, Number(f.numero) || 0), 0);
    return maxNumero + 1;
  }

  function openNewFactura() { setSaveError(""); setFacturaForm({ ordenId: "", monto: "", estadoEnvio: "pendiente" }); setShowFacturaModal(true); }
  function seleccionarOrdenFactura(ordenId) {
    const o = ordenes.find((x) => x.id === ordenId);
    setFacturaForm({ ordenId, monto: o ? o.costoTotal : "", estadoEnvio: "pendiente" });
  }

  // Genera el PDF de la factura (comprobante interno del taller — no es una factura electrónica de Hacienda).
  // Diseño profesional y sobrio: tipografía clara, una sola franja de color de marca, tabla limpia
  // con líneas finas (sin cuadrícula pesada), y un bloque de totales bien jerarquizado.
  const ACCENT_RGB = [30, 58, 95]; // azul corporativo — cámbialo si prefieres el naranja de marca u otro color
  const GRIS_TEXTO = [55, 65, 81];
  const GRIS_CLARO = [148, 163, 184];

  function generarFacturaPDF(f) {
    const o = ordenes.find((x) => x.id === f.ordenId);
    const vehiculo = o ? vehiculos.find((v) => v.id === o.vehiculoId) : null;
    const cliente = clientes.find((c) => c.id === f.clienteId);
    const numeroTexto = formatoNumeroFactura(f.numero);

    const docPdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    registrarFuentePDF(docPdf);

    // ---- Franja superior de marca (único acento de color, sobrio) ----
    docPdf.setFillColor(...ACCENT_RGB);
    docPdf.rect(0, 0, 210, 4, "F");

    // ---- Encabezado: logotipo tipo monograma + datos del taller (izquierda) ----
    const iniciales = DATOS_TALLER.nombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
    docPdf.setFillColor(...ACCENT_RGB);
    docPdf.roundedRect(14, 16, 14, 14, 2, 2, "F");
    docPdf.setFont(PDF_FONT, "bold");
    docPdf.setFontSize(12);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text(iniciales || "T", 21, 25, { align: "center" });

    docPdf.setFont(PDF_FONT, "bold");
    docPdf.setFontSize(13.5);
    docPdf.setTextColor(20, 24, 33);
    docPdf.text(DATOS_TALLER.nombre, 32, 22);
    docPdf.setFont(PDF_FONT, "normal");
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(...GRIS_TEXTO);
    docPdf.text(DATOS_TALLER.direccion, 32, 27);
    docPdf.text(`Tel: ${DATOS_TALLER.telefono}  ·  ${DATOS_TALLER.correo}`, 32, 31.5);

    // ---- "FACTURA" y metadatos (derecha) ----
    docPdf.setFont(PDF_FONT, "bold");
    docPdf.setFontSize(20);
    docPdf.setTextColor(20, 24, 33);
    docPdf.text("FACTURA", 196, 22, { align: "right" });
    docPdf.setFont(PDF_FONT, "normal");
    docPdf.setFontSize(9);
    docPdf.setTextColor(...GRIS_TEXTO);
    docPdf.text(`No. ${numeroTexto}`, 196, 28, { align: "right" });
    docPdf.text(`Fecha: ${f.fecha || ""}`, 196, 32.5, { align: "right" });

    docPdf.setDrawColor(226, 232, 240);
    docPdf.setLineWidth(0.3);
    docPdf.line(14, 40, 196, 40);

    // ---- Bloque "Facturar a" (cliente) y "Vehículo" ----
    docPdf.setFont(PDF_FONT, "bold");
    docPdf.setFontSize(8);
    docPdf.setTextColor(...GRIS_CLARO);
    docPdf.text("FACTURAR A", 14, 49);
    docPdf.text("VEHÍCULO", 112, 49);

    docPdf.setFont(PDF_FONT, "bold");
    docPdf.setFontSize(10.5);
    docPdf.setTextColor(20, 24, 33);
    docPdf.text(cliente?.nombre || "Cliente", 14, 55.5);
    const vehiculoTitulo = vehiculo ? `${vehiculo.marca || ""} ${vehiculo.modelo || ""}`.trim() || "—" : "—";
    docPdf.text(vehiculoTitulo, 112, 55.5);

    docPdf.setFont(PDF_FONT, "normal");
    docPdf.setFontSize(9);
    docPdf.setTextColor(...GRIS_TEXTO);
    docPdf.text(`Tel: ${cliente?.telefono || "—"}`, 14, 61);
    docPdf.text(`Correo: ${cliente?.correo || "—"}`, 14, 66);

    docPdf.text(`Placa: ${vehiculo?.placa || "—"}`, 112, 61);
    docPdf.text(`Año: ${vehiculo?.anio || "—"}  ·  Km: ${vehiculo?.km || "—"}`, 112, 66);

    // ---- Tabla de servicios y repuestos ----
    const items = o?.items || [];
    const rows = items.map((it) => [
      `${it.nombre}`,
      it.tipo === "servicio" ? "Servicio" : "Repuesto",
      String(it.cantidad),
      money(it.precio),
      money(it.precio * it.cantidad),
    ]);
    if (Number(o?.manoObra) > 0) {
      rows.push(["Mano de obra", "Servicio", "1", money(o.manoObra), money(o.manoObra)]);
    }
    if (rows.length === 0) rows.push(["Servicio realizado", "Servicio", "—", money(f.monto), money(f.monto)]);

    autoTable(docPdf, {
      startY: 75,
      head: [["Descripción", "Tipo", "Cant.", "Precio unitario", "Total"]],
      body: rows,
      styles: { font: PDF_FONT, fontSize: 9, textColor: GRIS_TEXTO, cellPadding: { top: 3, bottom: 3, left: 3, right: 3 } },
      headStyles: { font: PDF_FONT, fontStyle: "bold", fillColor: [245, 247, 250], textColor: [20, 24, 33], lineWidth: { bottom: 0.5 }, lineColor: ACCENT_RGB },
      bodyStyles: { lineWidth: { bottom: 0.15 }, lineColor: [230, 232, 236] },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" } },
      margin: { left: 14, right: 14 },
      tableLineWidth: 0,
    });

    // ---- Totales, alineados a la derecha ----
    const finalY = docPdf.lastAutoTable.finalY + 10;
    const total = Number(f.monto) || 0;
    const subtotal = total / 1.13;
    const iva = total - subtotal;

    docPdf.setFont(PDF_FONT, "normal");
    docPdf.setFontSize(9.5);
    docPdf.setTextColor(...GRIS_TEXTO);
    docPdf.text("Subtotal", 150, finalY);
    docPdf.text(money(subtotal), 196, finalY, { align: "right" });
    docPdf.text("IVA (13%)", 150, finalY + 6.5);
    docPdf.text(money(iva), 196, finalY + 6.5, { align: "right" });

    docPdf.setFillColor(...ACCENT_RGB);
    docPdf.rect(140, finalY + 11, 56, 11, "F");
    docPdf.setFont(PDF_FONT, "bold");
    docPdf.setFontSize(11);
    docPdf.setTextColor(255, 255, 255);
    docPdf.text("Total", 145, finalY + 18.3);
    docPdf.text(money(total), 191, finalY + 18.3, { align: "right" });

    // ---- Términos de pago (izquierda, a la altura del bloque de totales) ----
    docPdf.setFont(PDF_FONT, "bold");
    docPdf.setFontSize(9);
    docPdf.setTextColor(20, 24, 33);
    docPdf.text("Términos y condiciones", 14, finalY);
    docPdf.setFont(PDF_FONT, "normal");
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(...GRIS_TEXTO);
    const terminos = docPdf.splitTextToSize(
      "El taller garantiza la mano de obra por 30 días. Los repuestos instalados mantienen la garantía del fabricante.",
      110
    );
    docPdf.text(terminos, 14, finalY + 6);

    docPdf.setFont(PDF_FONT, "bold");
    docPdf.setFontSize(9);
    docPdf.setTextColor(20, 24, 33);
    docPdf.text("Forma de pago", 14, finalY + 18);
    docPdf.setFont(PDF_FONT, "normal");
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(...GRIS_TEXTO);
    docPdf.text(`SINPE Móvil / Tel: ${DATOS_TALLER.telefono}  ·  Cédula jurídica: ${DATOS_TALLER.cedulaJuridica}`, 14, finalY + 23.5);

    // ---- Pie de página ----
    const pageHeight = docPdf.internal.pageSize.getHeight();
    docPdf.setDrawColor(226, 232, 240);
    docPdf.setLineWidth(0.3);
    docPdf.line(14, pageHeight - 20, 196, pageHeight - 20);
    docPdf.setFont(PDF_FONT, "bold");
    docPdf.setFontSize(9);
    docPdf.setTextColor(...ACCENT_RGB);
    docPdf.text("Gracias por su preferencia", 14, pageHeight - 14);
    docPdf.setFont(PDF_FONT, "normal");
    docPdf.setFontSize(7.5);
    docPdf.setTextColor(...GRIS_CLARO);
    docPdf.text(
      `${DATOS_TALLER.nombre} · ${DATOS_TALLER.direccion} · ${DATOS_TALLER.telefono}  —  Comprobante interno de servicio, no es factura electrónica de Hacienda.`,
      14, pageHeight - 9
    );

    return docPdf;
  }

  // Abre el PDF en una pestaña nueva, lista para imprimir o guardar
  function verFacturaPDF(f) {
    const docPdf = generarFacturaPDF(f);
    docPdf.output("dataurlnewwindow");
  }
  // Descarga el PDF al equipo (útil para adjuntarlo manualmente en el correo)
  function descargarFacturaPDF(f) {
    const docPdf = generarFacturaPDF(f);
    docPdf.save(`Factura-${formatoNumeroFactura(f.numero)}.pdf`);
  }


  async function saveFactura() {
    if (!facturaForm.ordenId) return;
    setSaveError("");
    try {
      const o = ordenes.find((x) => x.id === facturaForm.ordenId);
      const numero = siguienteNumeroFactura();
      const nuevaFactura = { ...facturaForm, clienteId: o?.clienteId || "", fecha: new Date().toISOString().slice(0, 10), numero };
      await addDoc(collection(db, "facturas"), nuevaFactura);
      setShowFacturaModal(false);
      setFacturaForm({ ordenId: "", monto: "", estadoEnvio: "pendiente" });
    } catch (err) {
      console.error("Error al guardar factura:", err);
      setSaveError(err.message || "No se pudo guardar la factura.");
    }
  }
  async function deleteFactura(id) { await deleteDoc(doc(db, "facturas", id)); }

  // Envío por correo, en orden de preferencia:
  // 1) Cloud Function propia usando MailerSend — envío 100% automático con el PDF ya adjunto
  //    (a diferencia de EmailJS, MailerSend sí soporta adjuntos en su plan gratuito).
  // 2) EmailJS solo texto (sin adjunto, ya que el adjunto está bloqueado en el plan de EmailJS
  //    salvo que pagues su plan) — al menos avisa al cliente si la Cloud Function no está lista.
  // 3) Respaldo manual — descarga el PDF y abre un borrador de correo para adjuntarlo a mano.
  async function marcarEnviada(f) {
    const cliente = clientes.find((c) => c.id === f.clienteId);
    const numeroTexto = formatoNumeroFactura(f.numero);
    setSaveError("");

    if (!cliente?.correo) {
      setSaveError("Este cliente no tiene correo registrado; agrégaselo en Clientes para poder enviarle la factura.");
      return;
    }

    // 1) Cloud Function propia (MailerSend): genera el PDF en base64 y lo envía adjunto desde el servidor.
    try {
      const docPdf = generarFacturaPDF(f);
      const pdfBase64 = docPdf.output("datauristring").split(",")[1];
      const enviarFacturaCorreo = httpsCallable(functions, "enviarFacturaCorreo");
      await enviarFacturaCorreo({
        to: cliente.correo,
        nombreCliente: cliente.nombre || "",
        numeroFactura: numeroTexto,
        monto: money(f.monto),
        fecha: f.fecha || "",
        tallerNombre: DATOS_TALLER.nombre,
        remitenteCorreo: DATOS_TALLER.correo,
        remitenteNombre: DATOS_TALLER.nombre,
        pdfBase64,
      });
      await updateDoc(doc(db, "facturas", f.id), { estadoEnvio: "enviada" });
      return;
    } catch (err) {
      console.error("Error al enviar por la Cloud Function (¿está desplegada y con el dominio verificado en MailerSend?):", err);
      // Si la función no está lista o falla, sigue con las siguientes opciones en vez de detenerse aquí.
    }

    // 2) EmailJS solo texto (sin adjunto — bloqueado en el plan gratuito de EmailJS).
    if (emailjsConfigurado) {
      try {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            to_email: cliente.correo,
            to_name: cliente.nombre || "",
            numero_factura: numeroTexto,
            monto: money(f.monto),
            fecha: f.fecha || "",
            taller_nombre: DATOS_TALLER.nombre,
          },
          EMAILJS_PUBLIC_KEY
        );
        await updateDoc(doc(db, "facturas", f.id), { estadoEnvio: "enviada" });
        return;
      } catch (err) {
        console.error("Error al enviar correo con EmailJS:", err);
      }
    }

    // 3) Respaldo manual: descarga el PDF y abre el correo ya redactado para adjuntarlo.
    descargarFacturaPDF(f);
    const asunto = encodeURIComponent(`Factura ${numeroTexto} - ${DATOS_TALLER.nombre}`);
    const cuerpo = encodeURIComponent(
      `Hola ${cliente?.nombre || ""},\n\nAdjunto la factura ${numeroTexto} por los servicios realizados en su vehículo (se acaba de descargar a su computadora, solo debe adjuntarla a este correo).\n\nGracias por su preferencia.\n\n${DATOS_TALLER.nombre}`
    );
    window.open(`mailto:${cliente?.correo || ""}?subject=${asunto}&body=${cuerpo}`, "_blank");
    await updateDoc(doc(db, "facturas", f.id), { estadoEnvio: "enviada" });
  }

  // ---------- Estadísticas ----------
  const stats = useMemo(() => {
    const ingresos = facturas.reduce((sum, f) => sum + (Number(f.monto) || 0), 0);
    const ordenesCompletadas = ordenes.filter((o) => o.estado === "completada").length;
    const conteoServicios = {};
    ordenes.forEach((o) => (o.items || []).forEach((it) => {
      if (it.tipo === "servicio") conteoServicios[it.nombre] = (conteoServicios[it.nombre] || 0) + 1;
    }));
    const topServicios = Object.entries(conteoServicios).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxConteo = topServicios.length ? topServicios[0][1] : 1;
    return { ingresos, ordenesCompletadas, topServicios, maxConteo };
  }, [facturas, ordenes]);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: COLORS.bg, minHeight: "100vh", display: "flex", color: COLORS.textPrimary }}>
      {user === undefined && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13.5, color: COLORS.textSecondary }}>
          Cargando...
        </div>
      )}

      {user === null && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", ...moduleBackgroundStyle("login") }}>
          <form onSubmit={handleLogin} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 28, width: 340 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: 7, background: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wrench size={17} color="#1C0D04" />
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Panel del taller</div>
            </div>
            <FieldLabel>Usuario</FieldLabel>
            <input required style={inputStyle} value={loginUsuario} onChange={(e) => setLoginUsuario(e.target.value)} placeholder="TallerAdmin" />
            <FieldLabel>Contraseña</FieldLabel>
            <input type="password" required style={inputStyle} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="••••••••" />
            {loginError && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 12 }}>{loginError}</div>}
            <button type="submit" style={{ ...btnPrimary, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Lock size={14} /> Iniciar sesión
            </button>
          </form>
        </div>
      )}

      {user && (
      <>
      
      <div style={{ width: 216, background: "#191F23", borderRight: `1px solid ${COLORS.border}`, padding: "20px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px 22px", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: COLORS.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Wrench size={16} color="#1C0D04" />
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14.5, lineHeight: 1.1 }}>Taller</div>
            <div style={{ fontSize: 10.5, color: COLORS.textSecondary, letterSpacing: "0.06em" }}>SISTEMA DE GESTIÓN</div>
          </div>
        </div>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <div key={item.id} onClick={() => setView(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6, cursor: "pointer", marginBottom: 2, fontSize: 13.5,
                background: active ? COLORS.surfaceRaised : "transparent", color: active ? COLORS.textPrimary : "#9AA3A8",
                borderLeft: active ? `2px solid ${COLORS.accent}` : "2px solid transparent" }}>
              <Icon size={16} />
              {item.label}
            </div>
          );
        })}
        <div onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6, cursor: "pointer", marginTop: 14, fontSize: 13.5, color: COLORS.textSecondary, borderTop: `1px solid ${COLORS.border}`, paddingTop: 14 }}>
          <LogOut size={16} /> Cerrar sesión
        </div>
      </div>

      <div style={{ flex: 1, padding: "22px 28px", overflow: "auto", position: "relative" }}>
        <ModulePhotoPanel view={view} />
        <div style={{ position: "relative", zIndex: 1 }}>

        {view === "dashboard" && (
          <div>
            <PageHeader title="Panel general" subtitle="Resumen del taller hoy" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Vehículos registrados", value: vehiculos.length },
                { label: "Citas agendadas", value: citas.length },
                { label: "Clientes registrados", value: clientes.length },
                { label: "Órdenes abiertas", value: ordenes.filter((o) => o.estado !== "completada").length },
              ].map((s, i) => (
                <div key={i} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: 16 }}>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 25, fontWeight: 600 }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: 16 }}>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>Ingresos totales facturados</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600 }}>{money(stats.ingresos)}</div>
              </div>
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: 16 }}>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>Órdenes completadas</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600 }}>{stats.ordenesCompletadas}</div>
              </div>
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: 16 }}>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>Repuestos con bajo stock</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, color: repuestos.some(r => Number(r.stock) < 5) ? COLORS.danger : COLORS.textPrimary }}>
                  {repuestos.filter((r) => Number(r.stock) < 5).length}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "clientes" && (
          <div>
            <PageHeader title="Clientes" subtitle={`${clientes.length} clientes registrados`}
              action={<button onClick={openNewCliente} style={{ ...btnPrimary, width: "auto", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Nuevo cliente</button>} />
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: COLORS.textSecondary }} />
              <input placeholder="Buscar por nombre o teléfono..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: 34, marginBottom: 0 }} />
            </div>
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredClientes.map((c, i) => (
                <div key={c.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: COLORS.surfaceRaised, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13.5, color: COLORS.accent }}>
                      {c.nombre?.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 500 }}>{c.nombre}</div>
                      <div style={{ display: "flex", gap: 14, marginTop: 3 }}>
                        <span style={{ fontSize: 12.5, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} /> {c.telefono}</span>
                        {c.correo && <span style={{ fontSize: 12.5, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: 4 }}><Mail size={11} /> {c.correo}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#5D6870", marginTop: 4 }}>
                        {vehiculosByCliente(c.id).length} vehículo{vehiculosByCliente(c.id).length !== 1 ? "s" : ""}{vehiculosByCliente(c.id).map((v) => ` · ${v.placa}`).join("")}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <TicketBadge n={i + 1} />
                    <button onClick={() => openNewVehiculo(c.id)} title="Agregar vehículo" style={{ ...btnGhost, marginLeft: 8 }}><Car size={14} /></button>
                    <button onClick={() => openEditCliente(c)} title="Editar" style={btnGhost}><Edit2 size={14} /></button>
                    <button onClick={() => deleteCliente(c.id)} title="Eliminar" style={{ ...btnGhost, color: COLORS.danger }}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {filteredClientes.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 13.5, padding: 20, textAlign: "center" }}>No se encontraron clientes.</div>}
            </div>
          </div>
        )}

        {view === "vehiculos" && (
          <div>
            <PageHeader title="Vehículos" subtitle={`${vehiculos.length} vehículos registrados`}
              action={<button onClick={() => openNewVehiculo(null)} style={{ ...btnPrimary, width: "auto", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Nuevo vehículo</button>} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {vehiculos.map((v, i) => {
                const cliente = clientes.find((c) => c.id === v.clienteId);
                return (
                  <div key={v.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 500, background: COLORS.surfaceRaised, padding: "4px 9px", borderRadius: 5, letterSpacing: "0.04em" }}>{v.placa}</div>
                      <TicketBadge n={i + 1} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>{v.marca} {v.modelo}</div>
                    <div style={{ fontSize: 12.5, color: COLORS.textSecondary, marginBottom: 10 }}>Año {v.anio} · {v.km} km</div>
                    <div style={{ borderTop: `1px dashed ${COLORS.border}`, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 12.5, color: "#9AA3A8", display: "flex", alignItems: "center", gap: 5 }}><Users size={12} /> {cliente ? cliente.nombre : "Sin cliente"}</div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => openEditVehiculo(v)} style={btnGhost}><Edit2 size={13} /></button>
                        <button onClick={() => deleteVehiculo(v.id)} style={{ ...btnGhost, color: COLORS.danger }}><Trash2 size={13} /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {vehiculos.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 13.5, padding: 20, textAlign: "center", gridColumn: "1 / -1" }}>No hay vehículos registrados todavía.</div>}
            </div>
          </div>
        )}

        {view === "agenda" && (
          <div>
            <PageHeader title="Agenda" subtitle={`${citas.length} citas registradas`}
              action={<button onClick={openNewCita} style={{ ...btnPrimary, width: "auto", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Nueva cita</button>} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {citasOrdenadas.map((c) => {
                const cliente = clientes.find((x) => x.id === c.clienteId);
                const vehiculo = vehiculos.find((x) => x.id === c.vehiculoId);
                const estadoColor = c.estado === "confirmada" ? COLORS.accentBlue : c.estado === "completada" ? COLORS.success : COLORS.textSecondary;
                return (
                  <div key={c.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ textAlign: "center", minWidth: 54 }}>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15 }}>{c.hora || "--:--"}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, fontFamily: "'IBM Plex Mono', monospace" }}>{c.fecha}</div>
                      </div>
                      <div style={{ width: 1, height: 34, background: COLORS.border }} />
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 500 }}>{c.servicio || "Servicio sin especificar"}</div>
                        <div style={{ fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 }}>{cliente ? cliente.nombre : "Sin cliente"}{vehiculo ? ` · ${vehiculo.placa}` : ""}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span onClick={() => toggleEstadoCita(c)} style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, cursor: "pointer", color: estadoColor, border: `1px solid ${estadoColor}`, textTransform: "capitalize" }}>{c.estado || "pendiente"}</span>
                      <button onClick={() => openEditCita(c)} style={btnGhost}><Edit2 size={14} /></button>
                      <button onClick={() => deleteCita(c.id)} style={{ ...btnGhost, color: COLORS.danger }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
              {citasOrdenadas.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 13.5, padding: 20, textAlign: "center" }}>No hay citas agendadas todavía.</div>}
            </div>
          </div>
        )}

        {view === "ordenes" && (
          <div>
            <PageHeader title="Órdenes de trabajo" subtitle={`${ordenes.length} órdenes registradas`}
              action={<button onClick={openNewOrden} style={{ ...btnPrimary, width: "auto", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Nueva orden</button>} />

            <div style={{ background: COLORS.surface, border: `1px dashed ${COLORS.border}`, borderRadius: 9, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, color: COLORS.textSecondary, marginBottom: 10 }}>Catálogo de servicios del taller</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {servicios.map((s) => (
                  <span key={s.id} style={{ fontSize: 12, background: COLORS.surfaceRaised, borderRadius: 20, padding: "5px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                    {s.nombre} · {money(s.precio)}
                    <X size={11} style={{ cursor: "pointer", color: COLORS.textSecondary }} onClick={() => eliminarServicio(s.id)} />
                  </span>
                ))}
                {servicios.length === 0 && <span style={{ fontSize: 12.5, color: COLORS.textSecondary }}>Aún no has agregado servicios.</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input autoComplete="off" placeholder="Nombre del servicio" value={nuevoServicioNombre} onChange={(e) => setNuevoServicioNombre(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 2 }} />
                <input autoComplete="off" placeholder="Precio" value={nuevoServicioPrecio} onChange={(e) => setNuevoServicioPrecio(e.target.value)} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                <button onClick={agregarServicio} style={{ ...btnPrimary, width: "auto", padding: "0 14px" }}>Agregar</button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ordenes.map((o, i) => {
                const vehiculo = vehiculos.find((v) => v.id === o.vehiculoId);
                const cliente = clientes.find((c) => c.id === o.clienteId);
                const estadoColor = o.estado === "completada" ? COLORS.success : o.estado === "en_progreso" ? COLORS.accentBlue : COLORS.textSecondary;
                return (
                  <div key={o.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5 }}>{vehiculo?.placa || "—"}</span>
                          <TicketBadge n={i + 1} />
                        </div>
                        <div style={{ fontSize: 13.5, color: COLORS.textSecondary, marginTop: 4 }}>{cliente?.nombre || "Sin cliente"} · {o.fecha}</div>
                        <div style={{ fontSize: 12.5, color: "#7A848C", marginTop: 4 }}>{(o.items || []).length} ítem(s)</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600 }}>{money(o.costoTotal)}</div>
                        <select value={o.estado} onChange={(e) => cambiarEstadoOrden(o, e.target.value)}
                          style={{ marginTop: 6, fontSize: 11.5, background: "transparent", color: estadoColor, border: `1px solid ${estadoColor}`, borderRadius: 20, padding: "3px 8px" }}>
                          <option value="abierta">Abierta</option>
                          <option value="en_progreso">En progreso</option>
                          <option value="completada">Completada</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginTop: 10, borderTop: `1px dashed ${COLORS.border}`, paddingTop: 8 }}>
                      <button onClick={() => openEditOrden(o)} style={btnGhost}><Edit2 size={13} /></button>
                      <button onClick={() => deleteOrden(o.id)} style={{ ...btnGhost, color: COLORS.danger }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
              {ordenes.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 13.5, padding: 20, textAlign: "center" }}>No hay órdenes de trabajo todavía.</div>}
            </div>
          </div>
        )}

        {view === "revisiones" && (
          <div>
            <PageHeader title="Revisión de entrada y salida" subtitle={`${revisiones.length} revisiones registradas`}
              action={<button onClick={openNewRevision} style={{ ...btnPrimary, width: "auto", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Nueva revisión</button>} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {revisiones.map((r) => {
                const o = ordenes.find((x) => x.id === r.ordenId);
                const vehiculo = vehiculos.find((v) => v.id === o?.vehiculoId);
                const items = Object.entries(r.checklist || {}).filter(([, v]) => v).map(([k]) => k);
                return (
                  <div key={r.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 20, border: `1px solid ${COLORS.accent}`, color: COLORS.accent, textTransform: "capitalize" }}>{r.tipo}</span>
                        <div style={{ fontSize: 14, fontWeight: 500, marginTop: 8 }}>{vehiculo?.placa || "Vehículo no asociado"}</div>
                        <div style={{ fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 }}>Kilometraje: {r.km || "—"}</div>
                        {items.length > 0 && <div style={{ fontSize: 12, color: "#7A848C", marginTop: 4 }}>Verificado: {items.join(", ")}</div>}
                        {r.notas && <div style={{ fontSize: 12.5, color: COLORS.textSecondary, marginTop: 6, fontStyle: "italic" }}>"{r.notas}"</div>}
                      </div>
                      <button onClick={() => deleteRevision(r.id)} style={{ ...btnGhost, color: COLORS.danger, height: 28 }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
              {revisiones.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 13.5, padding: 20, textAlign: "center" }}>No hay revisiones registradas todavía.</div>}
            </div>
          </div>
        )}

        {view === "inventario" && (
          <div>
            <PageHeader title="Inventario de repuestos" subtitle={`${repuestos.length} repuestos registrados`}
              action={<button onClick={openNewRepuesto} style={{ ...btnPrimary, width: "auto", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Nuevo repuesto</button>} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {repuestos.map((r) => {
                const proveedor = proveedores.find((p) => p.id === r.proveedorId);
                const bajoStock = Number(r.stock) < 5;
                return (
                  <div key={r.id} style={{ background: COLORS.surface, border: `1px solid ${bajoStock ? COLORS.danger : COLORS.border}`, borderRadius: 9, padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 500 }}>{r.nombre}</div>
                        <div style={{ fontSize: 12.5, color: COLORS.textSecondary, marginTop: 4 }}>Compra {money(r.precioCompra)} · Venta {money(r.precioVenta)}</div>
                        {proveedor && <div style={{ fontSize: 12, color: "#7A848C", marginTop: 4 }}>Proveedor: {proveedor.nombre}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: bajoStock ? COLORS.danger : COLORS.textPrimary, display: "flex", alignItems: "center", gap: 5 }}>
                          {bajoStock && <AlertTriangle size={14} />} {r.stock}
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>en stock</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginTop: 10, borderTop: `1px dashed ${COLORS.border}`, paddingTop: 8 }}>
                      <button onClick={() => openEditRepuesto(r)} style={btnGhost}><Edit2 size={13} /></button>
                      <button onClick={() => deleteRepuesto(r.id)} style={{ ...btnGhost, color: COLORS.danger }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
              {repuestos.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 13.5, padding: 20, textAlign: "center", gridColumn: "1 / -1" }}>No hay repuestos registrados todavía.</div>}
            </div>
          </div>
        )}

        {view === "proveedores" && (
          <div>
            <PageHeader title="Proveedores" subtitle={`${proveedores.length} proveedores registrados`}
              action={<button onClick={openNewProveedor} style={{ ...btnPrimary, width: "auto", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Nuevo proveedor</button>} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {proveedores.map((p) => (
                <div key={p.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 500 }}>{p.nombre}</div>
                    <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                      {p.contacto && <span style={{ fontSize: 12.5, color: COLORS.textSecondary }}>{p.contacto}</span>}
                      {p.telefono && <span style={{ fontSize: 12.5, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: 4 }}><Phone size={11} /> {p.telefono}</span>}
                    </div>
                    {p.suministra && <div style={{ fontSize: 12, color: "#7A848C", marginTop: 4 }}>Suministra: {p.suministra}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => openEditProveedor(p)} style={btnGhost}><Edit2 size={14} /></button>
                    <button onClick={() => deleteProveedor(p.id)} style={{ ...btnGhost, color: COLORS.danger }}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {proveedores.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 13.5, padding: 20, textAlign: "center" }}>No hay proveedores registrados todavía.</div>}
            </div>
          </div>
        )}

        {view === "facturacion" && (
          <div>
            <PageHeader title="Facturación" subtitle={`${facturas.length} facturas emitidas`}
              action={<button onClick={openNewFactura} style={{ ...btnPrimary, width: "auto", display: "flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Generar factura</button>} />
            {saveError && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 14, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px" }}>{saveError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {facturas.map((f, i) => {
                const cliente = clientes.find((c) => c.id === f.clienteId);
                return (
                  <div key={f.id} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textSecondary, letterSpacing: "0.05em" }}>{formatoNumeroFactura(f.numero)}</div>
                      <div>
                        <div style={{ fontSize: 14.5, fontWeight: 500 }}>{cliente?.nombre || "Cliente"}</div>
                        <div style={{ fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 }}>{f.fecha}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600 }}>{money(f.monto)}</div>
                      <span style={{ fontSize: 11.5, padding: "4px 10px", borderRadius: 20, color: f.estadoEnvio === "enviada" ? COLORS.success : COLORS.textSecondary, border: `1px solid ${f.estadoEnvio === "enviada" ? COLORS.success : COLORS.border}` }}>{f.estadoEnvio}</span>
                      <button onClick={() => verFacturaPDF(f)} title="Ver / imprimir factura (PDF)" style={btnGhost}><FileText size={14} /></button>
                      {f.estadoEnvio !== "enviada" && (
                        <button onClick={() => marcarEnviada(f)} title="Enviar por correo" style={btnGhost}><Send size={14} /></button>
                      )}
                      <button onClick={() => deleteFactura(f.id)} style={{ ...btnGhost, color: COLORS.danger }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
              {facturas.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 13.5, padding: 20, textAlign: "center" }}>No hay facturas generadas todavía.</div>}
            </div>
          </div>
        )}

        {view === "estadisticas" && (
          <div>
            <PageHeader title="Estadísticas" subtitle="Ingresos y desempeño del taller" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: 16 }}>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>Ingresos totales facturados</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 600 }}>{money(stats.ingresos)}</div>
              </div>
              <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: 16 }}>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 }}>Órdenes completadas</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 600 }}>{stats.ordenesCompletadas}</div>
              </div>
            </div>
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: 18 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 14 }}>Servicios más solicitados</div>
              {stats.topServicios.map(([nombre, count]) => (
                <div key={nombre} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span>{nombre}</span><span style={{ color: COLORS.textSecondary }}>{count}</span>
                  </div>
                  <div style={{ height: 6, background: COLORS.surfaceRaised, borderRadius: 4 }}>
                    <div style={{ height: 6, width: `${(count / stats.maxConteo) * 100}%`, background: COLORS.accent, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
              {stats.topServicios.length === 0 && <div style={{ color: COLORS.textSecondary, fontSize: 13 }}>Aún no hay suficientes datos de órdenes.</div>}
            </div>
          </div>
        )}
        </div>
      </div>

      {showClienteModal && (
        <Modal title={editingCliente ? "Editar cliente" : "Nuevo cliente"} onClose={() => setShowClienteModal(false)}>
          <FieldLabel>Nombre completo</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={clienteForm.nombre} onChange={(e) => setClienteForm({ ...clienteForm, nombre: e.target.value })} placeholder="Ej. Marco Jiménez" />
          <FieldLabel>Teléfono</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={clienteForm.telefono} onChange={(e) => setClienteForm({ ...clienteForm, telefono: e.target.value })} placeholder="8888-1234" />
          <FieldLabel>Correo (opcional)</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={clienteForm.correo} onChange={(e) => setClienteForm({ ...clienteForm, correo: e.target.value })} placeholder="correo@ejemplo.com" />
          {saveError && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{saveError}</div>}
          <button style={btnPrimary} onClick={saveCliente}>Guardar cliente</button>
        </Modal>
      )}

      {showVehiculoModal && (
        <Modal title={editingVehiculo ? "Editar vehículo" : "Nuevo vehículo"} onClose={() => setShowVehiculoModal(false)}>
          <FieldLabel>Cliente</FieldLabel>
          <select style={inputStyle} value={vehiculoForm.clienteId} onChange={(e) => setVehiculoForm({ ...vehiculoForm, clienteId: e.target.value })}>
            <option value="">Seleccionar cliente</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <FieldLabel>Placa</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={vehiculoForm.placa} onChange={(e) => setVehiculoForm({ ...vehiculoForm, placa: e.target.value.toUpperCase() })} placeholder="CAB123" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><FieldLabel>Marca</FieldLabel><input autoComplete="off" style={inputStyle} value={vehiculoForm.marca} onChange={(e) => setVehiculoForm({ ...vehiculoForm, marca: e.target.value })} placeholder="Toyota" /></div>
            <div><FieldLabel>Modelo</FieldLabel><input autoComplete="off" style={inputStyle} value={vehiculoForm.modelo} onChange={(e) => setVehiculoForm({ ...vehiculoForm, modelo: e.target.value })} placeholder="Hilux" /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><FieldLabel>Año</FieldLabel><input autoComplete="off" style={inputStyle} value={vehiculoForm.anio} onChange={(e) => setVehiculoForm({ ...vehiculoForm, anio: e.target.value })} placeholder="2019" /></div>
            <div><FieldLabel>Kilometraje</FieldLabel><input autoComplete="off" style={inputStyle} value={vehiculoForm.km} onChange={(e) => setVehiculoForm({ ...vehiculoForm, km: e.target.value })} placeholder="82,400" /></div>
          </div>
          {saveError && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{saveError}</div>}
          <button style={btnPrimary} onClick={saveVehiculo}>Guardar vehículo</button>
        </Modal>
      )}

      {showCitaModal && (
        <Modal title={editingCita ? "Editar cita" : "Nueva cita"} onClose={() => setShowCitaModal(false)}>
          <FieldLabel>Cliente</FieldLabel>
          <select style={inputStyle} value={citaForm.clienteId} onChange={(e) => setCitaForm({ ...citaForm, clienteId: e.target.value, vehiculoId: "" })}>
            <option value="">Seleccionar cliente</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <FieldLabel>Vehículo</FieldLabel>
          <select style={inputStyle} value={citaForm.vehiculoId} onChange={(e) => setCitaForm({ ...citaForm, vehiculoId: e.target.value })}>
            <option value="">Seleccionar vehículo</option>
            {vehiculos.filter((v) => v.clienteId === citaForm.clienteId).map((v) => <option key={v.id} value={v.id}>{v.placa} · {v.marca} {v.modelo}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><FieldLabel>Fecha</FieldLabel><input type="date" style={inputStyle} value={citaForm.fecha} onChange={(e) => setCitaForm({ ...citaForm, fecha: e.target.value })} /></div>
            <div><FieldLabel>Hora</FieldLabel><input type="time" style={inputStyle} value={citaForm.hora} onChange={(e) => setCitaForm({ ...citaForm, hora: e.target.value })} /></div>
          </div>
          <FieldLabel>Servicio</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={citaForm.servicio} onChange={(e) => setCitaForm({ ...citaForm, servicio: e.target.value })} placeholder="Ej. Cambio de aceite" />
          {saveError && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{saveError}</div>}
          <button style={btnPrimary} onClick={saveCita}>Guardar cita</button>
        </Modal>
      )}

      {showProveedorModal && (
        <Modal title={editingProveedor ? "Editar proveedor" : "Nuevo proveedor"} onClose={() => setShowProveedorModal(false)}>
          <FieldLabel>Nombre de la empresa</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={proveedorForm.nombre} onChange={(e) => setProveedorForm({ ...proveedorForm, nombre: e.target.value })} placeholder="Ej. Repuestos del Valle" />
          <FieldLabel>Persona de contacto</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={proveedorForm.contacto} onChange={(e) => setProveedorForm({ ...proveedorForm, contacto: e.target.value })} placeholder="Nombre del contacto" />
          <FieldLabel>Teléfono</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={proveedorForm.telefono} onChange={(e) => setProveedorForm({ ...proveedorForm, telefono: e.target.value })} placeholder="8888-1234" />
          <FieldLabel>Qué suministra</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={proveedorForm.suministra} onChange={(e) => setProveedorForm({ ...proveedorForm, suministra: e.target.value })} placeholder="Ej. Frenos, filtros, aceites" />
          {saveError && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{saveError}</div>}
          <button style={btnPrimary} onClick={saveProveedor}>Guardar proveedor</button>
        </Modal>
      )}

      {showRepuestoModal && (
        <Modal title={editingRepuesto ? "Editar repuesto" : "Nuevo repuesto"} onClose={() => setShowRepuestoModal(false)}>
          <FieldLabel>Nombre del repuesto</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={repuestoForm.nombre} onChange={(e) => setRepuestoForm({ ...repuestoForm, nombre: e.target.value })} placeholder="Ej. Filtro de aceite" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><FieldLabel>Stock</FieldLabel><input autoComplete="off" style={inputStyle} value={repuestoForm.stock} onChange={(e) => setRepuestoForm({ ...repuestoForm, stock: e.target.value })} placeholder="10" /></div>
            <div><FieldLabel>Proveedor</FieldLabel>
              <select style={inputStyle} value={repuestoForm.proveedorId} onChange={(e) => setRepuestoForm({ ...repuestoForm, proveedorId: e.target.value })}>
                <option value="">Sin proveedor</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><FieldLabel>Precio de compra</FieldLabel><input autoComplete="off" style={inputStyle} value={repuestoForm.precioCompra} onChange={(e) => setRepuestoForm({ ...repuestoForm, precioCompra: e.target.value })} placeholder="5000" /></div>
            <div><FieldLabel>Precio de venta</FieldLabel><input autoComplete="off" style={inputStyle} value={repuestoForm.precioVenta} onChange={(e) => setRepuestoForm({ ...repuestoForm, precioVenta: e.target.value })} placeholder="8000" /></div>
          </div>
          {saveError && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{saveError}</div>}
          <button style={btnPrimary} onClick={saveRepuesto}>Guardar repuesto</button>
        </Modal>
      )}

      {showOrdenModal && (
        <Modal title={editingOrden ? "Editar orden de trabajo" : "Nueva orden de trabajo"} onClose={() => setShowOrdenModal(false)} wide>
          <FieldLabel>Vehículo</FieldLabel>
          <select style={inputStyle} value={ordenForm.vehiculoId} onChange={(e) => setOrdenForm({ ...ordenForm, vehiculoId: e.target.value })}>
            <option value="">Seleccionar vehículo</option>
            {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.placa} · {v.marca} {v.modelo}</option>)}
          </select>
          <FieldLabel>Fecha</FieldLabel>
          <input type="date" style={inputStyle} value={ordenForm.fecha} onChange={(e) => setOrdenForm({ ...ordenForm, fecha: e.target.value })} />

          <FieldLabel>Agregar servicio o repuesto</FieldLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <select style={{ ...inputStyle, marginBottom: 0, flex: 1 }} value={itemTipo} onChange={(e) => { setItemTipo(e.target.value); setItemSeleccionId(""); }}>
              <option value="servicio">Servicio</option>
              <option value="repuesto">Repuesto</option>
            </select>
            <select style={{ ...inputStyle, marginBottom: 0, flex: 2 }} value={itemSeleccionId} onChange={(e) => setItemSeleccionId(e.target.value)}>
              <option value="">Seleccionar...</option>
              {(itemTipo === "servicio" ? servicios : repuestos).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
            <input autoComplete="off" style={{ ...inputStyle, marginBottom: 0, width: 60 }} value={itemCantidad} onChange={(e) => setItemCantidad(e.target.value)} placeholder="Cant." />
            <button onClick={agregarItemOrden} style={{ ...btnPrimary, width: "auto", padding: "0 14px" }}>+</button>
          </div>

          <div style={{ marginBottom: 14 }}>
            {ordenForm.items.map((it, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <span>{it.cantidad}× {it.nombre} <span style={{ color: COLORS.textSecondary, fontSize: 11 }}>({it.tipo})</span></span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>{money(it.precio * it.cantidad)}
                  <X size={13} style={{ cursor: "pointer", color: COLORS.danger }} onClick={() => quitarItemOrden(idx)} />
                </span>
              </div>
            ))}
            {ordenForm.items.length === 0 && <div style={{ fontSize: 12.5, color: COLORS.textSecondary }}>Sin ítems agregados.</div>}
          </div>

          <FieldLabel>Mano de obra</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={ordenForm.manoObra} onChange={(e) => setOrdenForm({ ...ordenForm, manoObra: e.target.value })} placeholder="0" />

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            <span>Total</span><span>{money(costoOrdenActual)}</span>
          </div>
          {saveError && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{saveError}</div>}
          <button style={btnPrimary} onClick={saveOrden}>Guardar orden</button>
        </Modal>
      )}

      {showRevisionModal && (
        <Modal title="Nueva revisión" onClose={() => setShowRevisionModal(false)}>
          <FieldLabel>Orden de trabajo</FieldLabel>
          <select style={inputStyle} value={revisionForm.ordenId} onChange={(e) => setRevisionForm({ ...revisionForm, ordenId: e.target.value })}>
            <option value="">Seleccionar orden</option>
            {ordenes.map((o) => {
              const v = vehiculos.find((x) => x.id === o.vehiculoId);
              return <option key={o.id} value={o.id}>{v?.placa} · {o.fecha}</option>;
            })}
          </select>
          <FieldLabel>Tipo</FieldLabel>
          <select style={inputStyle} value={revisionForm.tipo} onChange={(e) => setRevisionForm({ ...revisionForm, tipo: e.target.value })}>
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
          </select>
          <FieldLabel>Kilometraje</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={revisionForm.km} onChange={(e) => setRevisionForm({ ...revisionForm, km: e.target.value })} placeholder="82,400" />
          <FieldLabel>Checklist</FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {CHECKLIST_ITEMS.map((item) => (
              <label key={item} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, background: "#14181B", border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 9px", cursor: "pointer" }}>
                <input type="checkbox" checked={!!revisionForm.checklist[item]} onChange={() => toggleChecklistItem(item)} /> {item}
              </label>
            ))}
          </div>
          <FieldLabel>Notas</FieldLabel>
          <textarea autoComplete="off" style={{ ...inputStyle, minHeight: 60 }} value={revisionForm.notas} onChange={(e) => setRevisionForm({ ...revisionForm, notas: e.target.value })} placeholder="Observaciones adicionales..." />
          {saveError && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{saveError}</div>}
          <button style={btnPrimary} onClick={saveRevision}>Guardar revisión</button>
        </Modal>
      )}

      {showFacturaModal && (
        <Modal title="Generar factura" onClose={() => setShowFacturaModal(false)}>
          <FieldLabel>Orden de trabajo</FieldLabel>
          <select style={inputStyle} value={facturaForm.ordenId} onChange={(e) => seleccionarOrdenFactura(e.target.value)}>
            <option value="">Seleccionar orden</option>
            {ordenes.map((o) => {
              const v = vehiculos.find((x) => x.id === o.vehiculoId);
              return <option key={o.id} value={o.id}>{v?.placa} · {money(o.costoTotal)}</option>;
            })}
          </select>
          <FieldLabel>Monto</FieldLabel>
          <input autoComplete="off" style={inputStyle} value={facturaForm.monto} onChange={(e) => setFacturaForm({ ...facturaForm, monto: e.target.value })} placeholder="0" />
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 14 }}>Se generará como <strong>{formatoNumeroFactura(siguienteNumeroFactura())}</strong>. Después de guardar, podrás ver e imprimir el PDF desde la lista.</div>
          {saveError && <div style={{ color: COLORS.danger, fontSize: 12.5, marginBottom: 10 }}>{saveError}</div>}
          <button style={btnPrimary} onClick={saveFactura}>Guardar factura</button>
        </Modal>
      )}
      </>
      )}
    </div>
  );
}
