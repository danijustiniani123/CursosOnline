import { supabase } from './supabaseClient.js';
import { generarCertificadoPDF } from './certificado.js';

// 🎯 CONSTANTES Y CONFIGURACIÓN
const CONFIG = {
    pasosCurso: ['material', 'video', 'asistencia', 'encuesta', 'examen', 'eficacia'],
    titulosPasos: {
        'material': '📚 Material del Curso',
        'video': '🎥 Video del Curso', 
        'asistencia': '📝 Registro de Asistencia',
        'encuesta': '📊 Encuesta de Satisfacción',
        'examen': '🧠 Examen del Curso',
        'eficacia': '🎯 Examen de Eficacia'
    }
};

// 🎯 ELEMENTOS DEL DOM
const elementos = {
    loginSection: document.getElementById('login-section'),
    cursosDisponiblesSection: document.getElementById('cursos-disponibles'),
    cursoSection: document.getElementById('curso-section'),
    certificadoSection: document.getElementById('certificado-section'),
    tituloCurso: document.getElementById('titulo-curso'),
    videoCurso: document.getElementById('video-curso'),
    seccionNota: document.getElementById('seccion-nota'),
    listaCursos: document.getElementById('lista-cursos'),
    adminPanel: document.getElementById('admin-panel')
};

// 🎯 ESTADO DE LA APLICACIÓN
const estado = {
    cursoSeleccionado: null,
    pasoActual: 0,
    usuario: null
};

// 🎯 UTILIDADES
class Utilidades {
    static obtenerURLparaIframe(url) {
        if (!url) return "";

        // OneDrive (1drv.ms)
        if (url.includes("1drv.ms")) {
            return "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(url);
        }

        // OneDrive (onedrive.live.com)
        if (url.includes("onedrive.live.com")) {
            const residMatch = url.match(/resid=([^&]+)/);
            const authkeyMatch = url.match(/authkey=([^&]+)/);
            const resid = residMatch ? residMatch[1] : "";
            const authkey = authkeyMatch ? authkeyMatch[1] : "";
            return `https://onedrive.live.com/embed?resid=${resid}&authkey=${authkey}&em=2`;
        }

        // Google Drive
        if (url.includes("drive.google.com/file/d/")) {
            const id = url.match(/[-\w]{25,}/);
            return `https://drive.google.com/file/d/${id}/preview`;
        }

        return url;
    }

    static obtenerTituloPaso(paso) {
        return CONFIG.titulosPasos[paso] || 'Paso del Curso';
    }
}

// 🎯 CONTROLADOR DE NAVEGACIÓN
class NavegacionController {
    static pasoAnterior() {
        if (estado.pasoActual > 0) {
            estado.pasoActual--;
            CursoController.mostrarPasoActual();
        }
    }

    static siguientePaso() {
        if (estado.pasoActual < CONFIG.pasosCurso.length - 1) {
            estado.pasoActual++;
            CursoController.mostrarPasoActual();
        } else {
            CursoController.mostrarSeccionNota();
        }
    }
}

// 🎯 CONTROLADOR DE CURSOS
class CursoController {
    static async cargarCursos() {
        const { data: cursos, error } = await supabase
            .from('cursos')
            .select('*');

        if (error) {
            console.error("❌ Error al cargar cursos:", error);
            alert("❌ Error al cargar cursos: " + error.message);
            return;
        }

        elementos.listaCursos.innerHTML = '';
        cursos.forEach(curso => {
            const btn = document.createElement('button');
            btn.textContent = curso.nombre;
            btn.className = 'btn-curso';
            btn.onclick = () => CursoController.mostrarCurso(curso);
            elementos.listaCursos.appendChild(btn);
        });
    }

    static async mostrarCurso(curso) {
        estado.cursoSeleccionado = curso;
        estado.pasoActual = 0;

        elementos.tituloCurso.textContent = curso.nombre;
        elementos.cursoSection.style.display = 'block';
        elementos.cursosDisponiblesSection.style.display = 'none';
        elementos.certificadoSection.style.display = 'none';
        elementos.seccionNota.style.display = 'none';

        // Registrar asistencia automáticamente
        await CursoController.registrarAsistencia(curso);

        await this.mostrarPasoActual();
    }

    static async registrarAsistencia(curso) {
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
    }

    static async mostrarPasoActual() {
        const paso = CONFIG.pasosCurso[estado.pasoActual];
        const tieneContenido = estado.cursoSeleccionado[`url_${paso}`] && estado.cursoSeleccionado[`url_${paso}`].trim() !== '';
        
        let contenidoHTML = '';
        let tituloPaso = '';
        
        if (tieneContenido) {
            switch(paso) {
                case 'material':
                    tituloPaso = '📚 Material del Curso';
                    const urlMaterialEmbed = Utilidades.obtenerURLparaIframe(estado.cursoSeleccionado.url_material);
                    contenidoHTML = `
                        <iframe 
                            src="${urlMaterialEmbed}" 
                            width="100%" 
                            height="600px" 
                            style="border:none; border-radius:8px;">
                        </iframe>
                        <p style="text-align:center; margin-top:10px;">
                            <a href="${estado.cursoSeleccionado.url_material}" target="_blank" style="color:#007bff; text-decoration:none;">
                                🔗 Abrir PDF en nueva pestaña
                            </a>
                        </p>
                    `;
                    break;
                    
                case 'video':
                    tituloPaso = '🎥 Video del Curso';
                    if (estado.cursoSeleccionado.url_video.includes("youtube") || estado.cursoSeleccionado.url_video.includes("youtu.be")) {
                        const videoUrl = estado.cursoSeleccionado.url_video.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
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
                        const videoUrlEmbed = Utilidades.obtenerURLparaIframe(estado.cursoSeleccionado.url_video);
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
                    tituloPaso = Utilidades.obtenerTituloPaso(paso);
                    const urlPasoEmbed = Utilidades.obtenerURLparaIframe(estado.cursoSeleccionado[`url_${paso}`]);
                    contenidoHTML = `
                        <iframe 
                            src="${urlPasoEmbed}" 
                            width="100%" 
                            height="600px" 
                            style="border:none; border-radius:8px;">
                        </iframe>
                        <p style="text-align:center; margin-top:10px;">
                            <a href="${estado.cursoSeleccionado[`url_${paso}`]}" target="_blank" style="color:#007bff; text-decoration:none;">
                                🔗 Abrir formulario en nueva pestaña
                            </a>
                            <br>
                            <small style="color:#dc3545; font-weight:bold;">
                                ⚠️ Completa este formulario antes de continuar
                            </small>
                        </p>
                    `;
                    break;
            }
        } else {
            tituloPaso = Utilidades.obtenerTituloPaso(paso);
            contenidoHTML = `
                <div style="text-align:center; padding:40px; color:#666;">
                    <p>❌ ${tituloPaso} no disponible</p>
                    <p><small>Este contenido no está disponible para este curso.</small></p>
                </div>
            `;
        }
        
        // 🎯 NAVEGACIÓN CON BOTÓN "SIGUIENTE" SIEMPRE ACTIVO
        const navegacionHTML = `
            <div style="margin:30px 0; display:flex; justify-content:space-between; align-items:center;">
                <!-- BOTÓN ANTERIOR -->
                <button 
                    onclick="pasoAnterior()" 
                    style="
                        padding:10px 20px; 
                        background:${estado.pasoActual === 0 ? '#ccc' : '#007bff'}; 
                        color:white; 
                        border:none; 
                        border-radius:5px; 
                        cursor:${estado.pasoActual === 0 ? 'not-allowed' : 'pointer'};
                        font-weight:bold;
                    " 
                    ${estado.pasoActual === 0 ? 'disabled' : ''}>
                    ← Anterior
                </button>
                
                <!-- INFORMACIÓN DEL PASO -->
                <div style="text-align:center;">
                    <div style="font-weight:bold; color:#002855; font-size:1.1rem;">${tituloPaso}</div>
                    <div style="color:#666; font-size:0.9rem; margin-top:5px;">
                        Paso ${estado.pasoActual + 1} de ${CONFIG.pasosCurso.length}
                    </div>
                </div>
                
                <!-- BOTÓN SIGUIENTE - SIEMPRE ACTIVO -->
                <button 
                    onclick="siguientePaso()" 
                    style="
                        padding:10px 20px; 
                        background:#28a745; 
                        color:white; 
                        border:none; 
                        border-radius:5px; 
                        cursor:pointer;
                        font-weight:bold;
                    ">
                    ${estado.pasoActual === CONFIG.pasosCurso.length - 1 ? '🎓 Finalizar' : 'Siguiente →'}
                </button>
            </div>
        `;

        elementos.videoCurso.innerHTML = `
            <div style="background:white; padding:20px; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                ${navegacionHTML}
                <div style="margin:20px 0;">
                    ${contenidoHTML}
                </div>
                ${navegacionHTML}
            </div>
        `;

        // Mostrar sección de nota solo en el último paso
        elementos.seccionNota.style.display = estado.pasoActual === CONFIG.pasosCurso.length - 1 ? 'block' : 'none';
    }

    static mostrarSeccionNota() {
        elementos.seccionNota.style.display = 'block';
        elementos.seccionNota.scrollIntoView({ 
            behavior: 'smooth' 
        });
    }

    static volverACursos() {
        elementos.cursoSection.style.display = 'none';
        elementos.cursosDisponiblesSection.style.display = 'block';
        elementos.certificadoSection.style.display = 'none';
        elementos.seccionNota.style.display = 'none';
        estado.pasoActual = 0;
    }
}

// 🎯 CONTROLADOR DE AUTENTICACIÓN
class AuthController {
    static async login() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            console.error("❌ Error de login:", error);
            alert("❌ Error al iniciar sesión: " + error.message);
            return;
        }

        elementos.loginSection.style.display = 'none';
        elementos.cursosDisponiblesSection.style.display = 'block';

        await CursoController.cargarCursos();
        await this.verificarRolAdmin();
    }

    static async verificarRolAdmin() {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        const { data: perfil, error: errorPerfil } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', userId)
            .single();

        if (!errorPerfil && perfil?.rol === 'admin') {
            elementos.adminPanel.style.display = 'block';
        }
    }
}

// 🎯 CONTROLADOR DE NOTAS Y CERTIFICADOS
class CertificadoController {
    static async enviarNota() {
        const nota = parseFloat(document.getElementById('nota').value);
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;

        if (!user) {
            alert("❌ Usuario no autenticado");
            return;
        }

        if (!estado.cursoSeleccionado) {
            alert("❌ Selecciona un curso primero");
            return;
        }

        if (isNaN(nota) || nota < 0 || nota > 20) {
            alert("❌ Ingresa una nota válida entre 0 y 20");
            return;
        }

        const { error } = await supabase
            .from('notas')
            .insert([{
                correo: user.email,
                nota: nota,
                id_curso: estado.cursoSeleccionado.id
            }]);

        if (error) {
            alert("❌ Error al guardar nota: " + error.message);
            return;
        }

        if (nota >= 14) {
            elementos.certificadoSection.style.display = 'block';
            alert("✅ ¡Felicidades! Has aprobado el curso.");
            elementos.certificadoSection.scrollIntoView({ 
                behavior: 'smooth' 
            });
        } else {
            alert("❌ Nota insuficiente para aprobar. Puedes intentarlo nuevamente.");
        }
    }

    static async generarCertificado() {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;

        if (!user || !estado.cursoSeleccionado) {
            alert("❌ Usuario o curso no válido");
            return;
        }

        const nota = parseFloat(document.getElementById('nota').value);
        await generarCertificadoPDF(estado.cursoSeleccionado, nota);
    }
}

// 🎯 FUNCIONES GLOBALES SIMPLES PARA NAVEGACIÓN
function pasoAnterior() {
    NavegacionController.pasoAnterior();
}

function siguientePaso() {
    NavegacionController.siguientePaso();
}

// 🎯 INICIALIZACIÓN Y EXPORTACIÓN GLOBAL
window.login = AuthController.login;
window.volverACursos = CursoController.volverACursos;
window.enviarNota = CertificadoController.enviarNota;
window.generarCertificado = CertificadoController.generarCertificado;
window.pasoAnterior = pasoAnterior;
window.siguientePaso = siguientePaso;
