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

  tituloCurso.textContent = curso.nombre;
  linkMaterial.href = curso.url_material;
  linkMaterial.textContent = "📥 Descargar material";

  if (curso.url_video.includes("youtube")) {
    videoCurso.innerHTML = `
      <iframe width="100%" height="315"
        src="${curso.url_video.replace("watch?v=", "embed/")}"
        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>`;
  } else {
    videoCurso.innerHTML = "<p>No se puede mostrar este video</p>";
  }

  cursoSection.style.display = 'block';
  certificadoSection.style.display = 'none';

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
  } else {
    alert("❌ Nota insuficiente para aprobar");
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