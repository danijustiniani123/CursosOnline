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

// ✅ FUNCIÓN para convertir automáticamente URLs según origen
function obtenerURLparaIframe(url) {
  if (!url) return "";

  // 🟢 Caso 1: OneDrive (1drv.ms)
  if (url.includes("1drv.ms")) {
    return "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(url);
  }

  // 🟢 Caso 2: OneDrive (onedrive.live.com)
  if (url.includes("onedrive.live.com")) {
    // Convertir de formato /view.aspx?resid=... a /embed?resid=...
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

window.login = login;

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

// 🆕 FUNCIÓN PARA MOSTRAR PASO ACTUAL
async function mostrarPasoActual() {
  const paso = pasosCurso[pasoActual];
  const tieneContenido = cursoSeleccionado[`url_${paso}`] && cursoSeleccionado[`url_${paso}`].trim() !== '';
  
  let contenidoHTML = '';
  let tituloPaso = '';
  
  if (tieneContenido) {
    switch(paso) {
      case 'material':
  tituloPaso = '📚 Material del Curso';
  // ✅ Generar el enlace de vista correcta para OneDrive o Google Drive
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
            <iframe width="100%" height="400" src="${videoUrl}" frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen style="border-radius:8px;"></iframe>
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
          <iframe src="${urlPasoEmbed}" width="100%" height="600px" style="border:none; border-radius:8px;"></iframe>
          <p style="text-align:center; margin-top:10px;">
            <a href="${cursoSeleccionado[`url_${paso}`]}" target="_blank" style="color:#007bff; text-decoration:none;">🔗 Abrir formulario en nueva pestaña</a>
          </p>
        `;
        break;
    }
  } else {
    tituloPaso = obtenerTituloPaso(paso);
    contenidoHTML = `<div style="text-align:center; padding:40px; color:#666;">
      <p>❌ ${tituloPaso} no disponible</p>
      <p><small>Este contenido no está disponible para este curso.</small></p>
    </div>`;
  }
  
  const navegacionHTML = `
    <div style="margin:30px 0; display:flex; justify-content:space-between; align-items:center;">
      <button onclick="pasoAnterior()" style="padding:10px 20px; background:${pasoActual===0?'#ccc':'#007bff'}; color:white; border:none; border-radius:5px; cursor:${pasoActual===0?'not-allowed':'pointer'};" ${pasoActual===0?'disabled':''}>← Anterior</button>
      <div style="text-align:center;">
        <div style="font-weight:bold; color:#002855;">${tituloPaso}</div>
        <div style="color:#666; font-size:0.9rem;">Paso ${pasoActual+1} de ${pasosCurso.length}</div>
      </div>
      <button onclick="siguientePaso()" style="padding:10px 20px; background:${pasoActual===pasosCurso.length-1?'#ccc':'#28a745'}; color:white; border:none; border-radius:5px; cursor:${pasoActual===pasosCurso.length-1?'not-allowed':'pointer'};" ${pasoActual===pasosCurso.length-1?'disabled':''}>${pasoActual===pasosCurso.length-1?'Finalizado':'Siguiente →'}</button>
    </div>
  `;

  videoCurso.innerHTML = `
    <div style="background:white; padding:20px; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
      ${navegacionHTML}
      <div style="margin:20px 0;">${contenidoHTML}</div>
      ${navegacionHTML}
    </div>
  `;

  document.querySelector('#curso-section h3').style.display = pasoActual === pasosCurso.length - 1 ? 'block' : 'none';
  document.querySelector('#curso-section input[type="number"]').style.display = pasoActual === pasosCurso.length - 1 ? 'block' : 'none';
  document.querySelector('#curso-section button[onclick="enviarNota()"]').style.display = pasoActual === pasosCurso.length - 1 ? 'block' : 'none';
}

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
  }
}

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

function volverACursos() {
  cursoSection.style.display = 'none';
  cursosDisponiblesSection.style.display = 'block';
  pasoActual = 0;
}
window.volverACursos = volverACursos;

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

  const { error } = await supabase
    .from('notas')
    .insert([{ correo: user.email, nota: nota, id_curso: cursoSeleccionado.id }]);

  if (error) {
    alert("❌ Error al guardar nota: " + error.message);
    return;
  }

  if (nota >= 14) {
    certificadoSection.style.display = 'block';
    alert("✅ ¡Felicidades! Has aprobado el curso.");
  } else {
    alert("❌ Nota insuficiente para aprobar. Puedes intentarlo nuevamente.");
  }
}
window.enviarNota = enviarNota;

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
window.generarCertificado = generarCertificado;
