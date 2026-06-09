/* =============================================
   ALMOXARIFADO — Controle de usuário e permissões
   Usuario.js
   ============================================= */

/* ---------- Login ---------- */

async function loginAdmin() {
  const usuario = prompt("Usuário:");
  if (!usuario) return;
  const senha = prompt("Senha:");
  if (!senha) return;

  const { data, error } = await db
    .from('administradores')
    .select('*')
    .eq('usuario', usuario)
    .eq('senha', senha)
    .eq('ativo', true)
    .single();

  if (error || !data) {
    alert("Usuário ou senha inválidos.");
    return;
  }

  localStorage.setItem("admin_logado", "true");
  localStorage.setItem("admin_nome", data.nome);

  aplicarPermissoes();
  atualizarUsuarioLogado();
  alert(`Bem-vindo, ${data.nome}!`);
}

/* ---------- Usuário logado ---------- */

function atualizarUsuarioLogado() {
  const div   = document.getElementById("usuario-logado");
  if (!div) return;

  const admin = verificarAdmin();

  if (!admin) {
    div.innerHTML = `
      <button id="btn-login" onclick="loginAdmin()">
        <i class="ti ti-lock"></i>
      </button>
    `;
  } else {
    const nome = localStorage.getItem("admin_nome") || "Admin";
    div.innerHTML = `
      <span style="font-size:13px; color:var(--text-secondary); margin-right:8px;">
        👤 ${nome}
      </span>
      <button onclick="logoutAdmin()">
        <i class="ti ti-logout"></i>Sair
      </button>
    `;
  }
}

/* ---------- Logout ---------- */

function logoutAdmin() {
  if (!confirm("Deseja realmente sair?")) return;
  localStorage.removeItem("admin_logado");
  localStorage.removeItem("admin_nome");
  location.reload();
}

/* ---------- Permissões ---------- */

function aplicarPermissoes() {
  const admin = verificarAdmin();

  // ── Navegação entre páginas — só admin vê ──
  const navAdmin = document.getElementById('nav-admin');
  if (navAdmin) {
    navAdmin.style.display = admin ? 'flex' : 'none';
  }

  // ── Aba de cadastro — só admin vê (scanner.html) ──
  const btnCadastro = document.getElementById('tab-btn-cadastro');
  if (btnCadastro) {
    btnCadastro.style.display = admin ? '' : 'none';
  }
}

function verificarAdmin() {
  return localStorage.getItem("admin_logado") === "true";
}

/* ---------- Inicialização ---------- */

document.addEventListener("DOMContentLoaded", () => {
  aplicarPermissoes();
  atualizarUsuarioLogado();
});
