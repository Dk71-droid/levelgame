async function handleLogin() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert("Login gagal: " + error.message);
    return;
  }

  const { user } = data;
  const { data: profile } = await supabase.from("users").select("role").eq("email", email).single();

  if (profile.role === "admin") {
    window.location.href = "admin.html";
  } else {
    localStorage.setItem("userEmail", email);
    document.getElementById("authSection").classList.add("hidden");
    document.getElementById("welcomeSection").classList.remove("hidden");
  }
}

async function handleRegister() {
  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    alert("Registrasi gagal: " + error.message);
    return;
  }

  await supabase.from("users").insert([{ email, name, role: "student" }]);
  alert("Akun berhasil dibuat! Silakan login.");
  toggleAuthForm();
}

function toggleAuthForm() {
  document.getElementById("registerForm").classList.toggle("hidden");
}
