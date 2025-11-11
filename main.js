import { supabase } from './supabaseClient.js';
import { generarCertificadoPDF } from './certificado.js';

const loginSection = document.getElementById('login-section');
const cursosDisponiblesSection = document.getElementById('cursos-disponibles');
const cursoSection = document.getElementById('curso-section');
const certificadoSection = document.getElementById('certificado-section');
const tituloCurso = document.getElementById('titulo-curso');
const videoCurso = document.getElementById('video-curso');
const linkMaterial = document.getElementById('link-material');

let cursoSeleccionado = null;
let pasoActual = 0;
const pasosCurso = ['material', 'video', 'asistencia', 'encuesta', 'examen', 'eficacia'];

// 🎯 CONFIGURACIÓN PARA MICROSOFT FORMS
const CONFIG_FORMS = {
    tiempoVerificacion: 3000,
    intentosMaximos: 20,
    mensajes: {
        esperando: '⏳ Validando formulario...',
        completado: '✅ Formulario completado correctamente',
        error: '❌ Debes completar el formulario antes de continuar',
        noDisponible: '⚠️ No se puede verificar este formulario automáticamente'
    }
};

// ✅ FUNCIÓN para convertir automáticamente URLs según origen
function obtenerURLparaIframe(url) {
  if (!url) return "";

  // 🟢 Caso 1: OneDrive (1drv.ms)
  if (url.includes("1drv.ms")) {
    return "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(url);
  }

  // 🟢 Caso 2: OneDrive (onedrive.live.com)
  if (url.includes("onedrive.live.com")) {
    const residMatch = url.match(/resid=([^&]+)/);
    const authkeyMatch = url.match(/authkey=([^&]+)/);
    const resid = residMatch ? residMatch[1] : "";
    const authkey = authkeyMatch ? authkeyMatch[1] : "";
    return `https://onedrive.live.com/embed?resid=${resid}&authkey=${authkey}&em=2`;
  }

  // 🟢 Caso 3: Google Drive
  if (url.includes("drive.google.com/file/d/")) {
    const id = url.match(/[-\w]{25,}/);
    return `https://drive.google.com/file/d/${id}/preview`;
  }

  // 🟢 Caso 4: Cualquier otro enlace directo (Supabase, Dropbox, etc.)
  return url;
}

// 🎯 DETECTOR DE TIPO DE FORMULARIO
function detectarTipoFormulario(url) {
    if (url.includes('forms.office.com') || url.includes('microsoftforms.com')) {
        return 'microsoft_forms';
    }
    return 'otro';
}

// 🎯 MODAL DE CONFIRMACIÓN MANUAL
function mostrarModalConfirmacion(urlFormulario, callback) {
    const modalHTML = `
        <div id="modal-forms" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        ">
            <div style="
                background: white;
                padding: 30px;
                border-radius: 15px;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            ">
                <h3 style="color: #005a9e; margin-bottom: 20px;">📋 Verificación Requerida</h3>
                <p style="margin-bottom: 20px; line-height: 1.5;">
                    <strong>Para continuar debes completar el formulario:</strong>
                </p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <a href="${urlFormulario}" target="_blank" style="
                        color: #0078d4; 
                        text-decoration: none; 
                        font-weight: bold;
                        font-size: 16px;
                    ">
                        🔗 Abrir Formulario de Microsoft
                    </a>
                </div>
                <p style="color: #666; font-size: 14px; margin-bottom: 25px;">
                    ⚠️ <strong>Importante:</strong> Abre el formulario en una nueva pestaña, complétalo completamente y luego regresa aquí para continuar.
                </p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button onclick="cerrarModalYContinuar(false)" style="
                        padding: 12px 25px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    ">
                        ❌ Cancelar
                    </button>
                    <button onclick="cerrarModalYContinuar(true)" style="
                        padding: 12px 25px;
                        background: #107c10;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    ">
                        ✅ Ya completé el formulario
                    </button>
                </div>
            </div>
        </div>
    `;

    // Agregar modal al DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer);

    // Guardar callback en variable global
    window.modalFormsCallback = callback;
}

// 🎯 FUNCIONES GLOBALES PARA EL MODAL
window.cerrarModalYContinuar = function(completado) {
    const modal = document.getElementById('modal-forms');
    if (modal) {
        modal.remove();
    }
    
    if (window.modalFormsCallback) {
        window.modalFormsCallback(completado);
        window.modalFormsCallback = null;
    }
};

// 🎯 VERIFICACIÓN PARA MICROSOFT FORMS
async function verificarMicrosoftForms(urlFormulario, emailUsuario) {
    return new Promise((resolve) => {
        mostrarModalConfirmacion(urlFormulario, resolve);
    });
}

// 🎯 SISTEMA DE BOTONES INTELIGENTES
function crearBotonSiguienteInteligente(paso, urlFormulario) {
    const esPasoConFormulario = ['asistencia', 'encuesta', 'examen', 'eficacia'].includes(paso);
    const tieneContenido = cursoSeleccionado && cursoSeleccionado[`url_${paso}`] && cursoSeleccionado[`url_${paso}`].trim() !== '';
    
    if (esPasoConFormulario && tieneContenido) {
        // Botón desactivado hasta completar formulario
        return `
            <button 
                id="btn-siguiente-${paso}" 
                onclick="solicitarVerificacionFormulario('${paso}', '${urlFormulario}')" 
                style="
                    padding: 10px 20px; 
                    background: #6c757d; 
                    color: white; 
                    border: none; 
                    border-radius: 5px; 
                    cursor: pointer;
                    font-weight: bold;
                ">
                🔒 Verificar formulario para continuar
            </button>
        `;
    } else {
        // Botón normal para otros pasos
        return `
            <button 
                onclick="siguientePaso()" 
                style="
                    padding: 10px 20px; 
                    background: #28a745; 
                    color: white; 
                    border: none; 
                    border-radius: 5px; 
                    cursor: pointer;
                    font-weight: bold;
                ">
                ${pasoActual === pasosCurso.length - 1 ? '🎓 Finalizar' : 'Siguiente →'}
            </button>
        `;
    }
}

// 🎯 SOLICITAR VERIFICACIÓN DE FORMULARIO
async function solicitarVerificacionFormulario(paso, urlFormulario) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    
    if (!user) {
        alert('❌ Debes iniciar sesión primero');
        return;
    }

    const tipoFormulario = detectarTipoFormulario(urlFormulario);
    
    if (tipoFormulario === 'microsoft_forms') {
        const completado = await verificarMicrosoftForms(urlFormulario, user.email);
        
        if (completado) {
            // Habilitar botón siguiente
            const btnSiguiente = document.getElementById(`btn-siguiente-${paso}`);
            if (btnSiguiente) {
                btnSiguiente.innerHTML = '✅ Continuar →';
                btnSiguiente.style.background = '#28a745';
                btnSiguiente.onclick = () => siguientePaso();
            }
            
            // Registrar completado en base de datos
            await registrarFormularioCompletado(paso, user.email);
        } else {
            alert('❌ Debes completar el formulario para continuar');
        }
    } else {
        // Para otros tipos de formularios, permitir continuar directamente
        siguientePaso();
    }
}

// 🎯 REGISTRAR FORMULARIO COMPLETADO
async function registrarFormularioCompletado(tipoFormulario, email) {
    try {
        const { error } = await supabase
            .from('formularios_completados')
            .insert([{
                email: email,
                tipo_formulario: tipoFormulario,
                id_curso: cursoSeleccionado.id,
                completado_en: new Date().toISOString()
            }]);

        if (error) {
            console.warn('⚠️ Error registrando formulario:', error);
        } else {
            console.log('✅ Formulario registrado como completado');
        }
    } catch (error) {
        console.warn('⚠️ Error en registro de formulario:', error);
    }
}

// 🎯 FUNCIÓN PARA MOSTRAR PASO ACTUAL (MODIFICADA)
async function mostrarPasoActual() {
    const paso = pasosCurso[pasoActual];
    const tieneContenido = cursoSeleccionado[`url_${paso}`] && cursoSeleccionado[`url_${paso}`].trim() !== '';
    
    let contenidoHTML = '';
    let tituloPaso = '';
    
    if (tieneContenido) {
        switch(paso) {
            case 'material':
                tituloPaso = '📚 Material del Curso';
                const urlMaterialEmbed = obtenerURLparaIframe(cursoSeleccionado.url_material);
                contenidoHTML = `
                    <iframe 
                        src="${urlMaterialEmbed}" 
                        width="100%" 
                        height="600px" 
                        style="border:none; border-radius:8px;">
                    </iframe>
                    <p style="text-align:center; margin-top:10px;">
                        <a href="${cursoSeleccionado.url_material}" target="_blank" style="color:#007bff; text-decoration:none;">
                            🔗 Abrir PDF en nueva pestaña
                        </a>
                    </p>
                `;
                break;
                
            case 'video':
                tituloPaso = '🎥 Video del Curso';
                if (cursoSeleccionado.url_video.includes("youtube") || cursoSeleccionado.url_video.includes("youtu.be")) {
                    const videoUrl = cursoSeleccionado.url_video.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
                    contenidoHTML = `
                        <iframe 
                            width="100%" 
                            height="400" 
                            src="${videoUrl}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen 
                            style="border-radius:8px;">
                        </iframe>
                    `;
                } else {
                    const videoUrlEmbed = obtenerURLparaIframe(cursoSeleccionado.url_video);
                    contenidoHTML = `
                        <video width="100%" height="400" controls style="border-radius:8px;">
                            <source src="${videoUrlEmbed}" type="video/mp4">
                            Tu navegador no soporta el elemento video.
                        </video>
                    `;
                }
                break;
                
            case 'asistencia':
            case 'encuesta':
            case 'examen':
            case 'eficacia':
                tituloPaso = obtenerTituloPaso(paso);
                const urlPasoEmbed = obtenerURLparaIframe(cursoSeleccionado[`url_${paso}`]);
                contenidoHTML = `
                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
                        <strong>⚠️ Requerido:</strong> Debes completar este formulario para continuar con el curso.
                        <br><small>Haz clic en "Verificar formulario para continuar" cuando lo hayas completado.</small>
                    </div>
                    <iframe 
                        src="${urlPasoEmbed}" 
                        width="100%" 
                        height="600px" 
                        style="border:none; border-radius:8px;">
                    </iframe>
                    <p style="text-align:center; margin-top:10px;">
                        <a href="${cursoSeleccionado[`url_${paso}`]}" target="_blank" style="color:#007bff; text-decoration:none;">
                            🔗 Abrir formulario en nueva pestaña
                        </a>
                    </p>
                `;
                break;
        }
    } else {
        tituloPaso = obtenerTituloPaso(paso);
        contenidoHTML = `
            <div style="text-align:center; padding:40px; color:#666;">
                <p>❌ ${tituloPaso} no disponible</p>
                <p><small>Este contenido no está disponible para este curso.</small></p>
            </div>
        `;
    }
    
    // 🎯 NAVEGACIÓN INTELIGENTE
    const urlFormularioActual = cursoSeleccionado ? cursoSeleccionado[`url_${paso}`] : '';
    const botonSiguiente = crearBotonSiguienteInteligente(paso, urlFormularioActual);
    
    const navegacionHTML = `
        <div style="margin:30px 0; display:flex; justify-content:space-between; align-items:center;">
            <!-- BOTÓN ANTERIOR -->
            <button 
                onclick="pasoAnterior()" 
                style="
                    padding:10px 20px; 
                    background:${pasoActual === 0 ? '#ccc' : '#007bff'}; 
                    color:white; 
                    border:none; 
                    border-radius:5px; 
                    cursor:${pasoActual === 0 ? 'not-allowed' : 'pointer'};
                    font-weight:bold;
                " 
                ${pasoActual === 0 ? 'disabled' : ''}>
                ← Anterior
            </button>
            
            <!-- INFORMACIÓN DEL PASO -->
            <div style="text-align:center;">
                <div style="font-weight:bold; color:#002855; font-size:1.1rem;">${tituloPaso}</div>
                <div style="color:#666; font-size:0.9rem; margin-top:5px;">
                    Paso ${pasoActual + 1} de ${pasosCurso.length}
                </div>
            </div>
            
            <!-- BOTÓN SIGUIENTE INTELIGENTE -->
            ${botonSiguiente}
        </div>
    `;

    videoCurso.innerHTML = `
        <div style="background:white; padding:20px; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
            ${navegacionHTML}
            <div style="margin:20px 0;">
                ${contenidoHTML}
            </div>
            ${navegacionHTML}
        </div>
    `;

    // Mostrar sección de nota solo en el último paso
    document.getElementById('seccion-nota').style.display = pasoActual === pasosCurso.length - 1 ? 'block' : 'none';
}

// 📝 HELPER PARA TÍTULOS DE PASOS
function obtenerTituloPaso(paso) {
    const titulos = {
        'material': 'Material del Curso',
        'video': 'Video del Curso', 
        'asistencia': 'Registro de Asistencia',
        'encuesta': 'Encuesta de Satisfacción',
        'examen': 'Examen del Curso',
        'eficacia': 'Examen de Eficacia'
    };
    return titulos[paso];
}

// 🧭 FUNCIONES DE NAVEGACIÓN
function pasoAnterior() {
    if (pasoActual > 0) {
        pasoActual--;
        mostrarPasoActual();
    }
}

function siguientePaso() {
    if (pasoActual < pasosCurso.length - 1) {
        pasoActual++;
        mostrarPasoActual();
    } else {
        // Si es el último paso, mostrar sección de nota
        document.getElementById('seccion-nota').style.display = 'block';
        
        // Scroll suave a la sección de nota
        document.getElementById('seccion-nota').scrollIntoView({ 
            behavior: 'smooth' 
        });
    }
}

// 🔄 FUNCIONES ORIGINALES (MANTENER)
async function login() {
    console.log("🔐 Login() ejecutado");

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("❌ Error de login:", error);
        alert("❌ Error al iniciar sesión: " + error.message);
        return;
    }

    loginSection.style.display = 'none';
    cursosDisponiblesSection.style.display = 'block';

    await cargarCursos();

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    const { data: perfil, error: errorPerfil } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', userId)
        .single();

    if (errorPerfil) {
        console.warn("⚠️ Error obteniendo perfil:", errorPerfil.message);
    } else if (perfil?.rol === 'admin') {
        document.getElementById('admin-panel').style.display = 'block';
    }
}

async function cargarCursos() {
    const { data: cursos, error } = await supabase
        .from('cursos')
        .select('*');

    console.log("Cursos sin filtro:", cursos);

    if (error) {
        alert("❌ Error al cargar cursos: " + error.message);
        return;
    }

    const listaCursos = document.getElementById('lista-cursos');
    listaCursos.innerHTML = '';

    cursos.forEach(curso => {
        const btn = document.createElement('button');
        btn.textContent = curso.nombre;
        btn.onclick = () => mostrarCurso(curso);
        listaCursos.appendChild(btn);
    });
}

async function mostrarCurso(curso) {
    cursoSeleccionado = curso;
    pasoActual = 0;

    tituloCurso.textContent = curso.nombre;
    cursoSection.style.display = 'block';
    cursosDisponiblesSection.style.display = 'none';
    certificadoSection.style.display = 'none';

    // Ocultar sección de nota al inicio
    document.getElementById('seccion-nota').style.display = 'none';

    // Registrar asistencia automáticamente
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (user) {
        const { error } = await supabase.from('asistencias').insert([{
            email: user.email,
            id_curso: curso.id
        }]);

        if (error) {
            console.warn("⚠️ Error registrando asistencia:", error.message);
        } else {
            console.log("✅ Asistencia registrada");
        }
    }

    await mostrarPasoActual();
}

function volverACursos() {
    cursoSection.style.display = 'none';
    cursosDisponiblesSection.style.display = 'block';
    certificadoSection.style.display = 'none';
    pasoActual = 0;
}

async function enviarNota() {
    const nota = parseFloat(document.getElementById('nota').value);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user) {
        alert("❌ Usuario no autenticado");
        return;
    }

    if (!cursoSeleccionado) {
        alert("❌ Selecciona un curso primero");
        return;
    }

    if (isNaN(nota) || nota < 0 || nota > 20) {
        alert("❌ Ingresa una nota válida entre 0 y 20");
        return;
    }

    console.log("Insertando en notas:", {
        correo: user.email,
        nota: nota,
        id_curso: cursoSeleccionado.id
    });

    const { error } = await supabase
        .from('notas')
        .insert([{
            correo: user.email,
            nota: nota,
            id_curso: cursoSeleccionado.id
        }]);

    if (error) {
        alert("❌ Error al guardar nota: " + error.message);
        return;
    }

    if (nota >= 14) {
        certificadoSection.style.display = 'block';
        alert("✅ ¡Felicidades! Has aprobado el curso.");
        
        // Scroll suave al certificado
        certificadoSection.scrollIntoView({ 
            behavior: 'smooth' 
        });
    } else {
        alert("❌ Nota insuficiente para aprobar. Puedes intentarlo nuevamente.");
    }
}

async function generarCertificado() {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    if (!user || !cursoSeleccionado) {
        alert("❌ Usuario o curso no válido");
        return;
    }

    const nota = parseFloat(document.getElementById('nota').value);

    await generarCertificadoPDF(cursoSeleccionado, nota);
}

// 🎯 EXPORTAR FUNCIONES GLOBALES
window.login = login;
window.volverACursos = volverACursos;
window.enviarNota = enviarNota;
window.generarCertificado = generarCertificado;
window.pasoAnterior = pasoAnterior;
window.siguientePaso = siguientePaso;
window.solicitarVerificacionFormulario = solicitarVerificacionFormulario;
window.cerrarModalYContinuar = cerrarModalYContinuar;
