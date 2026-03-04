/**
 * admin.js - Scripts auxiliares para el panel de administración de VITARED
 * Versión 1.0
 */

// ===========================================
// UTILIDADES GENERALES
// ===========================================

/**
 * Formatea una fecha de Firebase Timestamp a string local
 * @param {Object} timestamp - Timestamp de Firebase o Date
 * @returns {string} Fecha formateada
 */
function formatFirebaseDate(timestamp) {
    if (!timestamp) return '—';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        console.error('Error formateando fecha:', error);
        return 'Fecha inválida';
    }
}

/**
 * Muestra una notificación temporal en la esquina superior derecha
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de alerta: 'success', 'danger', 'warning', 'info'
 */
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.style.boxShadow = '0 5px 15px rgba(0,0,0,0.2)';
    notification.style.animation = 'slideIn 0.3s ease';
    
    // Iconos según tipo
    const icons = {
        success: 'fa-check-circle',
        danger: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas ${icons[type] || 'fa-bell'} me-2 fa-lg"></i>
            <span>${message}</span>
            <button type="button" class="btn-close ms-3" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) notification.remove();
            }, 300);
        }
    }, 5000);
}

/**
 * Confirmación personalizada antes de eliminar
 * @param {string} message - Mensaje de confirmación
 * @returns {boolean} Confirmación del usuario
 */
function confirmDelete(message = '¿Estás seguro de eliminar este elemento? Esta acción no se puede deshacer.') {
    return confirm(message);
}

/**
 * Exporta una tabla HTML a archivo CSV
 * @param {string} tableId - ID de la tabla a exportar
 * @param {string} filename - Nombre del archivo CSV
 */
function exportTableToCSV(tableId, filename = 'datos.csv') {
    const table = document.getElementById(tableId);
    if (!table) {
        showNotification('Tabla no encontrada', 'danger');
        return;
    }
    
    try {
        const rows = table.querySelectorAll('tr');
        const csv = [];
        
        // Procesar cada fila
        rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            const rowData = [];
            cells.forEach(cell => {
                // Limpiar texto y escapar comillas
                let text = cell.innerText.trim().replace(/"/g, '""');
                rowData.push(`"${text}"`);
            });
            csv.push(rowData.join(','));
        });
        
        const csvContent = csv.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification(`Archivo ${filename} exportado correctamente`, 'success');
    } catch (error) {
        console.error('Error exportando CSV:', error);
        showNotification('Error al exportar el archivo', 'danger');
    }
}

/**
 * Configura filtro en tiempo real para una tabla
 * @param {string} inputId - ID del campo de búsqueda
 * @param {string} tableId - ID de la tabla a filtrar
 */
function setupTableFilter(inputId, tableId) {
    const input = document.getElementById(inputId);
    const table = document.getElementById(tableId);
    
    if (!input || !table) {
        console.error('No se encontró el input o la tabla');
        return;
    }
    
    input.addEventListener('keyup', function() {
        const filter = this.value.toLowerCase();
        const rows = table.querySelectorAll('tbody tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const matches = text.includes(filter);
            row.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });
        
        // Mostrar contador de resultados
        const counter = document.getElementById('filterCounter');
        if (counter) {
            counter.textContent = `${visibleCount} resultados encontrados`;
        }
    });
}

/**
 * Carga opciones en un select desde Firebase
 * @param {string} selectId - ID del elemento select
 * @param {string} collection - Nombre de la colección en Firebase
 * @param {string} valueField - Campo para el valor (opcional)
 * @param {string} textField - Campo para el texto visible
 * @param {string} defaultText - Texto por defecto
 * @returns {Promise} Promesa con el resultado
 */
async function loadSelectOptions(selectId, collection, valueField = null, textField, defaultText = 'Selecciona...') {
    const select = document.getElementById(selectId);
    if (!select) {
        console.error(`Select con ID ${selectId} no encontrado`);
        return;
    }
    
    select.innerHTML = `<option value="">${defaultText}</option>`;
    
    try {
        const snapshot = await db.collection(collection).orderBy(textField).get();
        
        if (snapshot.empty) {
            select.innerHTML += `<option value="" disabled>No hay opciones disponibles</option>`;
            return;
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = valueField ? data[valueField] : doc.id;
            option.textContent = data[textField] || '—';
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error cargando opciones:', error);
        showNotification('Error cargando opciones: ' + error.message, 'danger');
    }
}

/**
 * Valida un formulario y muestra errores
 * @param {HTMLFormElement} form - Formulario a validar
 * @param {Array} requiredFields - Array de IDs de campos requeridos
 * @returns {boolean} True si el formulario es válido
 */
function validateForm(form, requiredFields = []) {
    let isValid = true;
    const errors = [];
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field && !field.value.trim()) {
            field.classList.add('is-invalid');
            errors.push(`El campo ${field.previousElementSibling?.textContent || fieldId} es requerido`);
            isValid = false;
        } else if (field) {
            field.classList.remove('is-invalid');
        }
    });
    
    // Validar email si existe campo de email
    const emailField = document.getElementById('email');
    if (emailField && emailField.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailField.value)) {
            emailField.classList.add('is-invalid');
            errors.push('El correo electrónico no es válido');
            isValid = false;
        }
    }
    
    if (errors.length > 0) {
        showNotification(errors[0], 'warning');
    }
    
    return isValid;
}

/**
 * Limpia los mensajes de error de un formulario
 * @param {HTMLFormElement} form - Formulario a limpiar
 */
function clearFormErrors(form) {
    form.querySelectorAll('.is-invalid').forEach(field => {
        field.classList.remove('is-invalid');
    });
}

/**
 * Genera un ID único
 * @returns {string} ID único
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Trunca un texto a una longitud máxima
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} Texto truncado
 */
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Formatea número con separadores de miles
 * @param {number} number - Número a formatear
 * @returns {string} Número formateado
 */
function formatNumber(number) {
    return new Intl.NumberFormat('es-MX').format(number || 0);
}

/**
 * Obtiene el color según el estado
 * @param {string} estado - Estado del elemento
 * @returns {string} Clase CSS del color
 */
function getStatusColor(estado) {
    const colors = {
        'activa': 'success',
        'inactiva': 'secondary',
        'pendiente': 'warning',
        'cumplida': 'success',
        'cancelada': 'danger',
        'aprobado': 'success',
        'rechazado': 'danger',
        'Sí': 'success',
        'No': 'secondary'
    };
    
    return colors[estado?.toLowerCase()] || 'info';
}

/**
 * Inicializa tooltips de Bootstrap
 */
function initTooltips() {
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    if (tooltips.length > 0 && typeof bootstrap !== 'undefined') {
        tooltips.forEach(el => new bootstrap.Tooltip(el));
    }
}

/**
 * Inicializa popovers de Bootstrap
 */
function initPopovers() {
    const popovers = document.querySelectorAll('[data-bs-toggle="popover"]');
    if (popovers.length > 0 && typeof bootstrap !== 'undefined') {
        popovers.forEach(el => new bootstrap.Popover(el));
    }
}

// ===========================================
// ESTADÍSTICAS Y GRÁFICAS
// ===========================================

/**
 * Inicializa gráfica de donaciones (requiere Chart.js)
 * @param {string} canvasId - ID del canvas
 * @param {Array} labels - Etiquetas para el eje X
 * @param {Array} data - Datos de la gráfica
 */
function initDonationsChart(canvasId, labels = [], data = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') {
        console.warn('Chart.js no está disponible');
        return;
    }
    
    // Destruir gráfica existente si la hay
    if (canvas.chart) {
        canvas.chart.destroy();
    }
    
    canvas.chart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels.length ? labels : ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
            datasets: [{
                label: 'Donaciones',
                data: data.length ? data : [12, 19, 15, 17, 24, 23],
                borderColor: '#8B0000',
                backgroundColor: 'rgba(139, 0, 0, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#8B0000',
                pointBorderColor: '#fff',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#ddd'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Inicializa gráfica de pastel para tipos de sangre
 * @param {string} canvasId - ID del canvas
 * @param {Array} data - Datos de la gráfica
 */
function initBloodTypeChart(canvasId, data = []) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    
    if (canvas.chart) canvas.chart.destroy();
    
    canvas.chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'],
            datasets: [{
                data: data.length ? data : [30, 8, 25, 7, 15, 5, 7, 3],
                backgroundColor: [
                    '#8B0000', '#B22222', '#DC143C', '#CD5C5C',
                    '#F08080', '#E9967A', '#FA8072', '#FFA07A'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 15
                    }
                }
            },
            cutout: '60%'
        }
    });
}

// ===========================================
// EXPORTACIÓN DE FUNCIONES
// ===========================================

// Exportar todas las funciones para uso global
window.adminUtils = {
    // Utilidades generales
    formatFirebaseDate,
    showNotification,
    confirmDelete,
    exportTableToCSV,
    setupTableFilter,
    loadSelectOptions,
    validateForm,
    clearFormErrors,
    generateUniqueId,
    truncateText,
    formatNumber,
    getStatusColor,
    
    // Inicialización
    initTooltips,
    initPopovers,
    
    // Gráficas
    initDonationsChart,
    initBloodTypeChart
};

// Inicializar tooltips automáticamente cuando carga el DOM
document.addEventListener('DOMContentLoaded', function() {
    initTooltips();
    initPopovers();
});

// ===========================================
// ESTILOS ANIMACIÓN (agregados dinámicamente)
// ===========================================

// Agregar estilos de animación al head
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .fade-enter {
        opacity: 0;
        transform: scale(0.9);
    }
    
    .fade-enter-active {
        opacity: 1;
        transform: scale(1);
        transition: opacity 300ms, transform 300ms;
    }
    
    .fade-exit {
        opacity: 1;
        transform: scale(1);
    }
    
    .fade-exit-active {
        opacity: 0;
        transform: scale(0.9);
        transition: opacity 300ms, transform 300ms;
    }
`;

document.head.appendChild(style);

console.log('✅ admin.js cargado correctamente - Utilidades de admin disponibles en window.adminUtils');