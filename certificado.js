import { supabase } from './supabaseClient.js';

export async function generarCertificadoPDF(cursoSeleccionado, nota) {
  const user = await supabase.auth.getUser();
  if (!user.data.user) {
    alert("Usuario no autenticado");
    return;
  }

  const email = user.data.user.email;
  const curso = cursoSeleccionado.nombre;
  const nombreArchivo = `certificado_${cursoSeleccionado.id}_${Date.now()}.pdf`;

  // Crear PDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(22);
  doc.text("Certificado de Capacitación", 20, 30);
  doc.setFontSize(14);
  doc.text(`Otorgado a: ${email}`, 20, 50);
  doc.text(`Por haber aprobado el curso: ${curso}`, 20, 65);
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 80);

  const pdfBlob = doc.output("blob");

  // Subir a Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("certificados")
    .upload(nombreArchivo, pdfBlob, {
      contentType: "application/pdf"
    });

  if (uploadError) {
    alert("❌ Error al subir certificado: " + uploadError.message);
    return;
  }

  // Obtener URL pública
  const { data: publicData } = supabase
    .storage
    .from("certificados")
    .getPublicUrl(nombreArchivo);

  const publicURL = publicData.publicUrl;

  // Enviar correo con Function
  const response = await fetch("https://eevijzdfqmhzuptwbkpw.functions.supabase.co/enviar-certificado", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: email,
      curso: curso,
      url_certificado: publicURL
    })
  });

  if (!response.ok) {
    const result = await response.json();
    alert("❌ Error al enviar certificado por correo");
    console.error(result);
    return;
  }

  // Registrar en la tabla "registros"
  const { error: insertError } = await supabase
    .from("registros")
    .insert([{
      email: email,
      nota: nota,
      fecha: new Date(),
      curso: curso,
      certificado_url: publicURL
    }]);

  if (insertError) {
    alert("⚠️ Certificado enviado, pero no se pudo registrar en la base de datos.");
    console.error(insertError);
    return;
  }

  alert("✅ Certificado generado, enviado por correo y registrado con éxito.");
}