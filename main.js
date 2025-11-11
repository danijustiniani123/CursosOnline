import { supabase } from './supabaseClient.js';
import { generarCertificadoPDF } from './certificado.js';

// === SECCIONES DEL DOM ===
const loginSection = document.getElementById('login-section');
const cursosDisponiblesSection = document.getElementById('cursos-disponibles');
const cursoSection = document.getElementById('curso-section');
const certificadoSection = document.getElementById('certificado-section');
const tituloCurso = document.getElementById('titulo-curso');
const videoCurso = document.getElementById('video-curso');

// === VARIABLES GLOBALES ===
let cursoSeleccionado = null;
let pasoActual = 0;
const pasosCurso = ['material', 'video', 'asistencia', 'encuesta', 'examen', 'eficacia'];

// === LOGIN ===
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

// === CARGAR CURSOS DESDE SUPABASE ===
async function cargarCursos() {
  const { data: cursos, error } = await supabase.from('cursos').select('*');

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

// === MOSTRAR CURSO SELECCIONADO ===
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

    if (error) console.warn("⚠️ Error registrando asistencia:", error.message);
    else console.log("✅ Asistencia registrada");
  }

  await mostrarPasoActual();
}

// === MOSTRAR PASO ACTUAL ===
async function mostrarPasoActual() {
  const paso = pasosCurso[pasoActual];
  const url = cursoSeleccionado[`url_${paso}`];
  const tieneContenido = url && url.trim() !== '';

  let contenidoHTML = '';
  let tituloPaso = obtenerTituloPaso(paso);

  if (tieneContenido) {
    switch (paso) {
      case 'material':
        contenidoHTML = `
          <iframe src="${url}#toolbar=0" width="100%" height="600px" 
            style="border: 1px solid #ddd; border-radius: 8px;"></iframe>
          <p style="text-align: center; margin-top: 10px;">
            <a href="${url}" target="_blank" style="color:#007bff; text-decoration:none;">🔗 Abrir PDF en nueva pestaña</a>
          </p>`;
        break;

      case 'video':
        if (url.includes("youtube") || url.includes("youtu.be")) {
          const videoUrl = url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/");
          contenidoHTML = `
            <iframe width="100%" height="400" src="${videoUrl}" frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen style="border-radius: 8px;"></iframe>`;
        } else if (url.endsWith(".mp4") || url.endsWith(".webm")) {
          contenidoHTML = `
            <video width="100%" height="400" controls style="border-radius: 8px;">
              <source src="${url}" type="video/mp4">
              Tu navegador no soporta el elemento video.
            </video>`;
        } else {
          contenidoHTML = `<p>🔗 <a href="${url}" target="_blank">Abrir video externo</a></p>`;
        }
        break;

      default:
        contenidoHTML = `
          <iframe src="${url}" width="100%" height="600px" 
            style="border: 1px solid #ddd; border-radius: 8px;"></iframe>
          <p style="text-align: center; margin-top: 10px;">
            <a href="${url}" target="_blank" style="color:#007bff; text-decoration:none;">🔗 Abrir formulario</a>
          </p>`;
        break;
    }
  } else {
    contenidoHTML = `
      <div style="text-align:center; padding:40px; color:#666;">
        <p>❌ ${tituloPaso} no disponible</p>
        <p><small>Este contenido no está disponible para este curso.</small></p>
      </div>`;
  }

  // === NAVEGACIÓN ===
  const navegacionHTML = `
    <div style="margin: 30px 0; display:flex; justify-content:space-between; align-items:center;">
      <button onclick="pasoAnterior()" 
        style="padding:10px 20px; background:${pasoActual===0?'#ccc':'#007bff'}; color:white; border:none; border-radius:5px;"
        ${pasoActual===0?'disabled':''}>← Anterior</button>

      <div style="text-align:center;">
        <div style="font-weight:bold; color:#002855;">${tituloPaso}</div>
        <div style="color:#666; font-size:0.9rem;">Paso ${pasoActual+1} de ${pasosCurso.length}</div>
      </div>

      <button onclick="siguientePaso()" 
        style="padding:10px 20px; background:${pasoActual===pasosCurso.length-1?'#ccc':'#28a745'}; color:white; border:none; border-radius:5px;"
        ${pasoActual===pasosCurso.length-1?'disabled':''}>
        ${pasoActual===pasosCurso.length-1?'Finalizado':'Siguiente →'}
      </button>
    </div>`;

  videoCurso.innerHTML = `
    <div style="background:white; padding:20px; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,0.1);">
      ${navegacionHTML}
      <div style="margin:20px 0;">${contenidoHTML}</div>
      ${navegacionHTML}
    </div>`;

  // Mostrar campos de nota solo en el último paso
  document.querySelector('#curso-section h3').style.display = pasoActual === pasosCurso.length - 1 ? 'block' : 'none';
  document.querySelector('#curso-section input[type="number"]').style.display = pasoActual === pasosCurso.length - 1 ? 'block' : 'none';
  document.querySelector('#curso-section button[onclick="enviarNota()"]').style.display = pasoActual === pasosCurso.length - 1 ? 'block' : 'none';
}

// === NAVEGACIÓN ENTRE PASOS ===
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

window.pasoAnterior = pasoAnterior;
window.siguientePaso = siguientePaso;

// === OBTENER TÍTULOS ===
function obtenerTituloPaso(paso) {
  const titulos = {
    material: 'Material del Curso',
    video: 'Video del Curso',
    asistencia: 'Registro de Asistencia',
    encuesta: 'Encuesta de Satisfacción',
    examen: 'Examen del Curso',
    eficacia: 'Examen de Eficacia'
  };
  return titulos[paso] || 'Paso';
}

// === VOLVER A CURSOS ===
function volverACursos() {
  cursoSection.style.display = 'none';
  cursosDisponiblesSection.style.display = 'block';
  pasoActual = 0;
}

window.volverACursos = volverACursos;

// === ENVIAR NOTA ===
async function enviarNota() {
  const nota = parseFloat(document.getElementById('nota').value);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) return alert("❌ Usuario no autenticado");
  if (!cursoSeleccionado) return alert("❌ Selecciona un curso primero");
  if (isNaN(nota) || nota < 0 || nota > 20) return alert("❌ Ingresa una nota válida (0-20)");

  const { error } = await supabase.from('notas').insert([{
    correo: user.email,
    nota,
    id_curso: cursoSeleccionado.id
  }]);

  if (error) return alert("❌ Error al guardar nota: " + error.message);

  if (nota >= 14) {
    certificadoSection.style.display = 'block';
    alert("✅ ¡Felicidades! Has aprobado el curso.");
  } else {
    alert("❌ Nota insuficiente para aprobar. Puedes intentarlo nuevamente.");
  }
}

window.enviarNota = enviarNota;

// === GENERAR CERTIFICADO ===
async function generarCertificado() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  const nota = parseFloat(document.getElementById('nota').value);

  if (!user || !cursoSeleccionado) return alert("❌ Usuario o curso no válido");

  await generarCertificadoPDF(cursoSeleccionado, nota);
}

window.generarCertificado = generarCertificado;
