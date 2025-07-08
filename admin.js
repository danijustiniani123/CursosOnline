import { supabase } from './supabaseClient.js';

// 🔐 Validar que el usuario actual sea admin
(async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert("⚠️ No autenticado.");
    window.location.href = "index.html";
    return;
  }

  const { data: perfil, error } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (error || perfil?.rol !== "admin") {
    alert("Acceso denegado. Solo administradores.");
    window.location.href = "index.html";
  }
})();

// 👥 Crear nuevo usuario
window.crearUsuario = async function () {
  const email = document.getElementById("nuevo-email").value.trim();
  const dni = document.getElementById("nuevo-dni").value.trim();
  const rol = document.getElementById("rol").value;

  if (!email || !dni || !rol) {
    alert("Completa todos los campos.");
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: dni,
    email_confirm: true,
  });

  if (error) {
    alert("❌ Error al crear usuario: " + error.message);
    return;
  }

  const userId = data.user.id;
  await supabase.from("profiles").insert({
    id: userId,
    nombre: email,
    rol: rol
  });

  alert(`✅ Usuario creado como ${rol}.`);
};

// 📚 Subir nuevo curso
window.subirCurso = async function () {
  const nombre = document.getElementById("titulo-curso").value.trim();
  const url_video = document.getElementById("url-video").value.trim();
  const url_material = document.getElementById("url-material").value.trim();

  if (!nombre || !url_video || !url_material) {
    alert("Completa todos los campos.");
    return;
  }

  const { error } = await supabase.from("cursos").insert([
    { nombre, url_video, url_material, activo: true }
  ]);

  if (error) {
    alert("❌ Error al subir curso: " + error.message);
  } else {
    alert("✅ Curso subido correctamente.");
  }
};

// 📋 Mostrar registros de notas
window.cargarRegistros = async function () {
  const { data, error } = await supabase
    .from("notas")
    .select("correo, nota, fecha, cursos(nombre)")
    .order("fecha", { ascending: false });

  if (error) {
    alert("❌ Error al cargar registros: " + error.message);
    return;
  }

  const tbody = document.querySelector("#tabla-registros tbody");
  tbody.innerHTML = "";

  data.forEach(reg => {
    const aprobado = reg.nota >= 14;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${reg.correo}</td>
      <td>${reg.cursos?.nombre || "Curso eliminado"}</td>
      <td>${reg.nota}</td>
      <td>${new Date(reg.fecha).toLocaleDateString()}</td>
      <td style="color: ${aprobado ? "green" : "red"}">
        ${aprobado ? "✅ Aprobado" : "❌ No"}
      </td>
    `;
    tbody.appendChild(tr);
  });
};

// 🔐 Resetear contraseña por correo
window.resetearContrasena = async function () {
  const email = document.getElementById("email-reset").value.trim();

  if (!email) {
    alert("Ingresa el correo.");
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://cvglobal-group.com/cambiar-clave.html" // Cambia esto por tu dominio real
  });

  if (error) {
    alert("❌ Error: " + error.message);
  } else {
    alert("✅ Enlace enviado. Revisa el correo.");
  }
};