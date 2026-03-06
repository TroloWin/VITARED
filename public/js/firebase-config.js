/**
 * VITARED - Configuración de Firebase
 * Versión completa con todas las funciones necesarias
 */

// ===========================================
// CONFIGURACIÓN DE FIREBASE
// ===========================================
const firebaseConfig = {
    apiKey: "AIzaSyApJXIHmAwUOdb3yXbiUP9gqLitWwRU32U",
    authDomain: "vitared-ecead.firebaseapp.com",
    projectId: "vitared-ecead",
    storageBucket: "vitared-ecead.firebasestorage.app",
    messagingSenderId: "768420386049",
    appId: "1:768420386049:web:f74a101dfef11a93a6b700"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Configurar Firestore para usar Timestamps
db.settings({ timestampsInSnapshots: true });

// ===========================================
// FUNCIONES DE AUTENTICACIÓN
// ===========================================

/**
 * REGISTRO DE DONANTE (usuario normal)
 * @param {Object} datos - Datos del formulario de registro
 * @returns {Promise<Object>} Resultado de la operación
 */
async function registrarDonante(datos) {
    console.log("🔵 INICIANDO REGISTRO...", datos.email);
    
    try {
        // 1. Crear usuario en Authentication
        const userCredential = await auth.createUserWithEmailAndPassword(
            datos.email, 
            datos.password
        );
        const user = userCredential.user;
        console.log("✅ Usuario creado en Auth:", user.uid);
        
        // 2. Actualizar perfil con nombre
        await user.updateProfile({
            displayName: datos.nombre
        });
        console.log("✅ Perfil actualizado");
        
        // 3. Guardar EN FIRESTORE
        const userData = {
            nombre: datos.nombre,
            email: datos.email,
            telefono: datos.telefono,
            fechaNacimiento: datos.fechaNacimiento,
            peso: datos.peso,
            tipoSangre: datos.tipoSangre,
            localidad: datos.localidad,
            esAdmin: false,
            puedeDonar: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            ultimaDonacion: null,
            donacionesRealizadas: 0
        };
        
        console.log("📝 Guardando en Firestore:", userData);
        await db.collection('users').doc(user.uid).set(userData);
        console.log("✅ Usuario guardado en Firestore");
        
        // 4. Verificar requisitos
        await verificarRequisitosDonante(user.uid);
        
        return { success: true, userId: user.uid };
        
    } catch (error) {
        console.error("❌ ERROR EN REGISTRO:", error);
        return { success: false, error: error.message };
    }
}

/**
 * INICIAR SESIÓN
 * @param {string} email - Correo electrónico
 * @param {string} password - Contraseña
 * @returns {Promise<Object>} Resultado de la operación
 */
async function iniciarSesion(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("❌ Error en login:", error);
        return { success: false, error: error.message };
    }
}

/**
 * CERRAR SESIÓN
 * @returns {Promise<Object>} Resultado de la operación
 */
async function cerrarSesion() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        console.error("❌ Error en logout:", error);
        return { success: false, error: error.message };
    }
}

// ===========================================
// FUNCIONES DE USUARIOS
// ===========================================

/**
 * VERIFICAR ROL DE USUARIO
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object>} Información del rol
 */
async function verificarRolUsuario(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            console.log("⚠️ Usuario no encontrado en Firestore");
            return { esAdmin: false, existe: false };
        }
        
        const userData = userDoc.data();
        console.log("✅ Usuario encontrado en Firestore:", userData.email);
        
        return {
            esAdmin: userData.esAdmin || false,
            existe: true,
            datos: userData
        };
    } catch (error) {
        console.error("❌ Error verificando rol:", error);
        return { esAdmin: false, existe: false };
    }
}

/**
 * VALIDAR REQUISITOS DEL DONANTE
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} True si puede donar
 */
async function verificarRequisitosDonante(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) return false;
        
        const userData = userDoc.data();
        const fechaNac = new Date(userData.fechaNacimiento);
        const edad = calcularEdad(fechaNac);
        
        const puedeDonar = edad >= 18 && edad <= 65 && userData.peso >= 50;
        
        await db.collection('users').doc(userId).update({
            puedeDonar: puedeDonar,
            validacionRequisitos: {
                edad: edad,
                peso: userData.peso,
                fechaValidacion: firebase.firestore.FieldValue.serverTimestamp()
            }
        });
        
        return puedeDonar;
    } catch (error) {
        console.error("❌ Error validando requisitos:", error);
        return false;
    }
}

/**
 * OBTENER TODOS LOS USUARIOS (solo admin)
 * @returns {Promise<Array>} Lista de usuarios
 */
async function obtenerUsuarios() {
    try {
        const snapshot = await db.collection('users').get();
        const usuarios = [];
        snapshot.forEach(doc => {
            usuarios.push({ id: doc.id, ...doc.data() });
        });
        return usuarios;
    } catch (error) {
        console.error("❌ Error obteniendo usuarios:", error);
        return [];
    }
}

// ===========================================
// FUNCIONES DE CAMPAÑAS
// ===========================================

/**
 * CREAR CAMPAÑA (solo admin)
 * @param {Object} datos - Datos de la campaña
 * @returns {Promise<Object>} Resultado de la operación
 */
async function crearCampana(datos) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("No autenticado");
        
        // Verificar que es admin
        const rol = await verificarRolUsuario(user.uid);
        if (!rol.esAdmin) throw new Error("No autorizado");
        
        const campanaData = {
            titulo: datos.titulo,
            descripcion: datos.descripcion,
            ubicacion: datos.ubicacion,
            fecha: firebase.firestore.Timestamp.fromDate(new Date(datos.fecha)),
            hora: datos.hora || '',
            cupoMaximo: datos.cupoMaximo || 50,
            cupoActual: 0,
            imagen: datos.imagen || 'campana-default.jpg',
            activa: datos.activa !== undefined ? datos.activa : true,
            destacada: datos.destacada || false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: user.uid
        };
        
        const docRef = await db.collection('campanas').add(campanaData);
        console.log("✅ Campaña creada:", docRef.id);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("❌ Error creando campaña:", error);
        return { success: false, error: error.message };
    }
}

/**
 * OBTENER TODAS LAS CAMPAÑAS
 * @param {boolean} activas - Si solo obtener activas
 * @returns {Promise<Array>} Lista de campañas
 */
async function obtenerCampanas(activas = true) {
    console.log("🔵 Obteniendo campañas...");
    try {
        let query = db.collection('campanas');
        
        if (activas) {
            query = query.where('activa', '==', true);
        }
        
        query = query.orderBy('fecha', 'asc');
        
        const snapshot = await query.get();
        const campanas = [];
        
        snapshot.forEach(doc => {
            campanas.push({ 
                id: doc.id, 
                ...doc.data() 
            });
        });
        
        console.log(`✅ Se encontraron ${campanas.length} campañas`);
        return campanas;
    } catch (error) {
        console.error("❌ Error obteniendo campañas:", error);
        return [];
    }
}

/**
 * OBTENER CAMPAÑAS DESTACADAS (para index)
 * @returns {Promise<Array>} Lista de campañas destacadas (máx 3)
 */
async function obtenerCampanasDestacadas() {
    console.log("🔵 Obteniendo campañas destacadas...");
    try {
        const snapshot = await db.collection('campanas')
            .where('activa', '==', true)
            .where('destacada', '==', true)
            .orderBy('fecha', 'asc')
            .limit(3)
            .get();
        
        const campanas = [];
        snapshot.forEach(doc => {
            campanas.push({ 
                id: doc.id, 
                ...doc.data() 
            });
        });
        
        console.log(`✅ Se encontraron ${campanas.length} campañas destacadas`);
        return campanas;
    } catch (error) {
        console.error("❌ Error obteniendo campañas destacadas:", error);
        return [];
    }
}

/**
 * ACTUALIZAR CAMPAÑA (solo admin)
 * @param {string} campanaId - ID de la campaña
 * @param {Object} datos - Nuevos datos
 * @returns {Promise<Object>} Resultado de la operación
 */
async function actualizarCampana(campanaId, datos) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("No autenticado");
        
        // Verificar que es admin
        const rol = await verificarRolUsuario(user.uid);
        if (!rol.esAdmin) throw new Error("No autorizado");
        
        const updateData = {
            titulo: datos.titulo,
            descripcion: datos.descripcion,
            ubicacion: datos.ubicacion,
            fecha: firebase.firestore.Timestamp.fromDate(new Date(datos.fecha)),
            hora: datos.hora || '',
            cupoMaximo: datos.cupoMaximo || 50,
            imagen: datos.imagen || 'campana-default.jpg',
            activa: datos.activa,
            destacada: datos.destacada || false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('campanas').doc(campanaId).update(updateData);
        console.log("✅ Campaña actualizada:", campanaId);
        return { success: true };
    } catch (error) {
        console.error("❌ Error actualizando campaña:", error);
        return { success: false, error: error.message };
    }
}

/**
 * ELIMINAR CAMPAÑA (solo admin)
 * @param {string} campanaId - ID de la campaña
 * @returns {Promise<Object>} Resultado de la operación
 */
async function eliminarCampana(campanaId) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("No autenticado");
        
        // Verificar que es admin
        const rol = await verificarRolUsuario(user.uid);
        if (!rol.esAdmin) throw new Error("No autorizado");
        
        await db.collection('campanas').doc(campanaId).delete();
        console.log("✅ Campaña eliminada:", campanaId);
        return { success: true };
    } catch (error) {
        console.error("❌ Error eliminando campaña:", error);
        return { success: false, error: error.message };
    }
}

// ===========================================
// FUNCIONES DE CENTROS Y CITAS
// ===========================================

/**
 * OBTENER CENTROS DE DONACIÓN
 * @returns {Promise<Array>} Lista de centros
 */
async function obtenerCentrosDonacion() {
    try {
        const snapshot = await db.collection('centros').get();
        const centros = [];
        snapshot.forEach(doc => {
            centros.push({ id: doc.id, ...doc.data() });
        });
        
        // Si no hay centros, devolver algunos por defecto
        if (centros.length === 0) {
            return [
                { id: 'centro-transfusion',
                    nombre: 'Centro Estatal de la Transfusión Sanguínea CETS Durango',
                    direccion: 'Blvd. José María Patoni 403, 34217 Durango, Durango',
                    telefono: '618-137-3160',
                    horario: 'Lun-Vie 8am-6pm'
                }
            ];
        }
        
        return centros;
    } catch (error) {
        console.error("❌ Error obteniendo centros:", error);
        return [];
    }
}

/**
 * OBTENER DISPONIBILIDAD DE CENTRO
 * @param {string} centroId - ID del centro
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @returns {Promise<Object>} Horarios disponibles y ocupados
 */
async function obtenerDisponibilidadCentro(centroId, fecha) {
    try {
        const inicioDia = new Date(fecha);
        inicioDia.setHours(0, 0, 0, 0);
        
        const finDia = new Date(fecha);
        finDia.setHours(23, 59, 59, 999);
        
        const citasSnapshot = await db.collection('citas')
            .where('centroId', '==', centroId)
            .where('fecha', '>=', inicioDia)
            .where('fecha', '<=', finDia)
            .get();
        
        const horarios = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
        const horariosOcupados = [];
        
        citasSnapshot.forEach(doc => {
            const cita = doc.data();
            const hora = new Date(cita.fecha.seconds * 1000).toLocaleTimeString('es-MX', {
                hour: '2-digit', minute: '2-digit', hour12: false
            });
            horariosOcupados.push(hora);
        });
        
        return {
            disponibles: horarios.filter(h => !horariosOcupados.includes(h)),
            ocupados: horariosOcupados
        };
    } catch (error) {
        console.error("❌ Error obteniendo disponibilidad:", error);
        return { disponibles: [], ocupados: [] };
    }
}

/**
 * AGENDAR CITA
 * @param {string} userId - ID del usuario
 * @param {string} centroId - ID del centro
 * @param {string} fecha - Fecha YYYY-MM-DD
 * @param {string} hora - Hora HH:MM
 * @returns {Promise<Object>} Resultado de la operación
 */
async function agendarCita(userId, centroId, fecha, hora) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        if (!userData.puedeDonar) {
            return { success: false, error: "No cumples con los requisitos para donar" };
        }
        
        const fechaHora = new Date(fecha);
        const [horas, minutos] = hora.split(':');
        fechaHora.setHours(parseInt(horas), parseInt(minutos), 0, 0);
        
        await db.collection('citas').add({
            userId: userId,
            centroId: centroId,
            fecha: firebase.firestore.Timestamp.fromDate(fechaHora),
            estado: 'pendiente',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===========================================
// FUNCIONES DE DONACIONES
// ===========================================

/**
 * REGISTRAR DONACIÓN (solo admin)
 * @param {Object} datosDonacion - Datos de la donación
 * @returns {Promise<Object>} Resultado de la operación
 */
async function registrarDonacion(datosDonacion) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("No autenticado");
        
        const donacionRef = await db.collection('donaciones').add({
            userId: datosDonacion.userId,
            centroId: datosDonacion.centroId,
            fecha: firebase.firestore.Timestamp.fromDate(new Date()),
            tipoSangre: datosDonacion.tipoSangre,
            cantidad: datosDonacion.cantidad || '450ml',
            atendidoPor: datosDonacion.atendidoPor || 'Admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await db.collection('users').doc(datosDonacion.userId).update({
            ultimaDonacion: firebase.firestore.Timestamp.fromDate(new Date()),
            donacionesRealizadas: firebase.firestore.FieldValue.increment(1)
        });
        
        // Generar comprobante
        const comprobanteUrl = await generarComprobante(donacionRef.id);
        
        return { success: true, donacionId: donacionRef.id, comprobanteUrl };
    } catch (error) {
        console.error("❌ Error registrando donación:", error);
        return { success: false, error: error.message };
    }
}

/**
 * GENERAR COMPROBANTE DE DONACIÓN
 * @param {string} donacionId - ID de la donación
 * @returns {Promise<string>} URL o ID del comprobante
 */
async function generarComprobante(donacionId) {
    try {
        const donacionDoc = await db.collection('donaciones').doc(donacionId).get();
        const donacion = donacionDoc.data();
        
        const userDoc = await db.collection('users').doc(donacion.userId).get();
        const user = userDoc.data();
        
        const centroDoc = await db.collection('centros').doc(donacion.centroId).get();
        const centro = centroDoc.exists ? centroDoc.data() : { nombre: 'Centro no especificado' };
        
        const comprobante = {
            folio: `DON-${donacionId.substring(0,8).toUpperCase()}`,
            donante: user.nombre,
            fecha: new Date().toLocaleDateString('es-MX'),
            centro: centro.nombre || 'Centro de Donación',
            cantidad: donacion.cantidad,
            tipoSangre: donacion.tipoSangre
        };
        
        await db.collection('comprobantes').doc(donacionId).set(comprobante);
        return `#comprobante-${donacionId}`;
    } catch (error) {
        console.error("❌ Error generando comprobante:", error);
        return null;
    }
}

// ===========================================
// FUNCIONES AUXILIARES
// ===========================================

/**
 * CALCULAR EDAD
 * @param {Date} fechaNacimiento - Fecha de nacimiento
 * @returns {number} Edad en años
 */
function calcularEdad(fechaNacimiento) {
    const hoy = new Date();
    let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
    const mes = hoy.getMonth() - fechaNacimiento.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacimiento.getDate())) {
        edad--;
    }
    return edad;
}

/**
 * RECUPERAR USUARIO EN FIRESTORE (para usuarios existentes)
 * @returns {Promise<Object>} Resultado de la operación
 */
async function recuperarUsuarioEnFirestore() {
    const user = auth.currentUser;
    if (!user) return { success: false, error: "No hay usuario autenticado" };
    
    try {
        const userData = {
            nombre: user.displayName || "Usuario",
            email: user.email,
            telefono: "",
            fechaNacimiento: "1990-01-01",
            peso: 70,
            tipoSangre: "O+",
            localidad: "No especificada",
            esAdmin: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            recuperado: true
        };
        
        await db.collection('users').doc(user.uid).set(userData);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}



// ===========================================
// CONTROL DE ACCESO POR ROL
// ===========================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log("👤 Usuario autenticado:", user.email);
        const pathActual = window.location.pathname;
        
        try {
            // Verificar si existe en Firestore
            const rol = await verificarRolUsuario(user.uid);
            
            // Si no existe en Firestore, intentar recuperar
            if (!rol.existe) {
                console.log("⚠️ Usuario no encontrado en Firestore. Intentando recuperar...");
                await recuperarUsuarioEnFirestore();
            }
            
            // Redirecciones basadas en rol
            if (pathActual.includes('/login/')) {
                if (rol.esAdmin) {
                    window.location.href = '../admin/dashboard.html';
                } else {
                    window.location.href = '../index.html?logged=true';
                }
                return;
            }
            
            // Proteger páginas de admin
            if (pathActual.includes('/admin/')) {
                // Perfil de admin es accesible solo para admins
                if (!rol.esAdmin) {
                    window.location.href = '../index.html?error=unauthorized';
                }
            }
            
            // Si es admin y está en perfil de usuario, redirigir a admin/perfil.html
            if (pathActual.includes('perfil.html') && !pathActual.includes('/admin/') && rol.esAdmin) {
                window.location.href = 'admin/perfil.html';
            }
            
        } catch (error) {
            console.error("❌ Error en verificación de acceso:", error);
        }
        
    } else {
        console.log("👤 No hay usuario autenticado");
        
        // Proteger páginas que requieren autenticación
        const pathActual = window.location.pathname;
        if (pathActual.includes('/admin/') || 
            (pathActual.includes('perfil.html') && !pathActual.includes('/admin/'))) {
            window.location.href = 'login/login.html';
        }
    }
});
// ===========================================
// INSCRIPCIÓN A CAMPAÑAS (FORMULARIO DONACIÓN)
// ===========================================

async function registrarInscripcion(datos) {
    try {

        const inscripcion = {
            nombre: datos.nombre,
            correo: datos.correo,
            telefono: datos.telefono,
            tipoSangre: datos.tipoSangre,
            edad: datos.edad,
            peso: datos.peso,
            campana: datos.campana,
            fechaDisponible: datos.fechaDisponible,
            comentarios: datos.comentarios || "",
            estado: "pendiente",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection("inscripciones").add(inscripcion);

        console.log("✅ Inscripción guardada correctamente");

        return { success: true };

    } catch (error) {

        console.error("❌ Error guardando inscripción:", error);

        return { success: false, error: error.message };

    }
}

// ===========================================
// EXPORTAR FUNCIONES GLOBALES
// ===========================================
window.registrarDonante = registrarDonante;
window.iniciarSesion = iniciarSesion;
window.cerrarSesion = cerrarSesion;
window.verificarRolUsuario = verificarRolUsuario;
window.obtenerUsuarios = obtenerUsuarios;
window.crearCampana = crearCampana;
window.obtenerCampanas = obtenerCampanas;
window.obtenerCampanasDestacadas = obtenerCampanasDestacadas;
window.actualizarCampana = actualizarCampana;
window.eliminarCampana = eliminarCampana;
window.obtenerCentrosDonacion = obtenerCentrosDonacion;
window.obtenerDisponibilidadCentro = obtenerDisponibilidadCentro;
window.agendarCita = agendarCita;
window.registrarDonacion = registrarDonacion;
window.recuperarUsuarioEnFirestore = recuperarUsuarioEnFirestore;
window.crearPrimerAdmin = crearPrimerAdmin;
window.registrarInscripcion = registrarInscripcion;

console.log("✅ Firebase config cargado correctamente");