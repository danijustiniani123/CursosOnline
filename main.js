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

    static crearElemento(tag, atributos = {}, contenido = '') {
        const elemento = document.createElement(tag);
        Object.keys(atributos).forEach(key => {
            if (key === 'style') {
                Object.assign(elemento.style, atributos[key]);
            } else {
                elemento[key] = atributos[key];
            }
        });
        if (contenido) elemento.innerHTML = contenido;
        return elemento;
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
            const btn = Utilidades.createElement('button', {
                className: 'btn-curso',
                onclick: () => CursoController.mostrarCurso(curso)
            }, curso.nombre);
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
        const tieneContenido = estado.cursoSeleccionado[`url_${paso}`]?.trim() !== '';
        
        const contenidoHTML = tieneContenido 
            ? this.generarContenidoPaso(paso)
            : this.generarPasoNoDisponible(paso);

        const navegacionHTML = this.generarNavegacion();

        elementos.videoCurso.innerHTML = `
            <div class="contenedor-paso">
                ${navegacionHTML}
                <div class="contenido-paso">
                    ${contenidoHTML}
                </div>
                ${navegacionHTML}
            </div>
        `;
    }

    static generarContenidoPaso(paso) {
        const url = estado.cursoSeleccionado[`url_${paso}`];
        const urlEmbed = Utilidades.obtenerURLparaIframe(url);

        switch(paso) {
            case 'material':
                return `
                    <iframe 
                        src="${urlEmbed}" 
                        width="100%" 
                        height="600px" 
                        class="iframe-contenido">
                    </iframe>
                    <div class="enlace-externo">
                        <a href="${url}" target="_blank">
                            🔗 Abrir PDF en nueva pestaña
                        </a>
                    </div>
                `;
                
            case 'video':
                if (url.includes("youtube") || url.includes("youtu.be")) {
                    const videoUrl = url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
                    return `
                        <iframe 
                            width="100%" 
                            height="400" 
                            src="${videoUrl}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen 
                            class="video-iframe">
                        </iframe>
                    `;
                } else {
                    return `
                        <video width="100%" height="400" controls class="video-elemento">
                            <source src="${urlEmbed}" type="video/mp4">
                            Tu navegador no soporta el elemento video.
                        </video>
                    `;
                }
                
            default:
                return `
                    <iframe 
                        src="${urlEmbed}" 
                        width="100%" 
                        height="600px" 
                        class="iframe-contenido">
                    </iframe>
                    <div class="enlace-externo">
                        <a href="${url}" target="_blank">
                            🔗 Abrir formulario en nueva pestaña
                        </a>
                        <br>
                        <small class="advertencia-formulario">
                            ⚠️ Completa este formulario antes de continuar
                        </small>
                    </div>
                `;
        }
    }

    static generarPasoNoDisponible(paso) {
        const tituloPaso = Utilidades.obtenerTituloPaso(paso);
        return `
            <div class="paso-no-disponible">
                <p>❌ ${tituloPaso} no disponible</p>
                <p><small>Este contenido no está disponible para este curso.</small></p>
            </div>
        `;
    }

    static generarNavegacion() {
        const tituloPaso = Utilidades.obtenerTituloPaso(CONFIG.pasosCurso[estado.pasoActual]);
        const esPrimerPaso = estado.pasoActual === 0;
        const esUltimoPaso = estado.pasoActual === CONFIG.pasosCurso.length - 1;

        return `
            <div class="paso-navegacion">
                <button 
                    onclick="NavegacionController.pasoAnterior()" 
                    class="btn-navegacion btn-anterior"
                    ${esPrimerPaso ? 'disabled' : ''}>
                    ← Anterior
                </button>
                
                <div class="info-paso">
                    <div class="titulo-paso">${tituloPaso}</div>
                    <div class="contador-paso">
                        Paso ${estado.pasoActual + 1} de ${CONFIG.pasosCurso.length}
                    </div>
                </div>
                
                <button 
                    onclick="NavegacionController.siguientePaso()" 
                    class="btn-navegacion btn-siguiente">
                    ${esUltimoPaso ? '🎓 Finalizar' : 'Siguiente →'}
                </button>
            </div>
        `;
    }

    static mostrarSeccionNota() {
        elementos.seccionNota.style.display = 'block';
        elementos.seccionNota.scrollIntoView({ 
            behavior: 'smooth' 
        });
    }

    static volverACursos() {
        elementos.cursoSection.style.display = 'none';
        elementos.certificadoSection.style.display = 'none';
        elementos.cursosDisponiblesSection.style.display = 'block';
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

// 🎯 INICIALIZACIÓN Y EXPORTACIÓN GLOBAL
window.login = AuthController.login;
window.volverACursos = CursoController.volverACursos;
window.enviarNota = CertificadoController.enviarNota;
window.generarCertificado = CertificadoController.generarCertificado;

// ✅ EXPORTAR CONTROLADORES DE NAVEGACIÓN (IMPORTANTE)
window.NavegacionController = NavegacionController;
