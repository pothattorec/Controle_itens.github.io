/* ---------- Login de administrador ---------- */

async function loginAdmin() {

    const usuario = prompt("Usuário:");
    if (!usuario) return;

    const senha = prompt("Senha:");
    if (!senha) return;

    const { data, error } = await db
        .from('administradores')
        .select('*')
        .eq('usuario', usuario.trim())
        .eq('senha', senha.trim());

    console.log(data);
    console.log(error);

    if (error) {

        alert("Erro: " + error.message);
        return;

    }

    if (!data || data.length === 0) {

        alert("Usuário ou senha inválidos.");
        return;

    }

    const admin = data[0];

    localStorage.setItem(
        "admin_logado",
        "true"
    );

    localStorage.setItem(
        "admin_nome",
        admin.nome
    );

    atualizarUsuarioLogado();
    aplicarPermissoes();

    alert(
        `Bem-vindo ${admin.nome}`
    );
}
/* ---------- ADM logado ---------- */

function atualizarUsuarioLogado() {

    const div = document.getElementById("usuario-logado");

    const admin =
        localStorage.getItem("admin_logado") === "true";

    if (!admin) {

        div.innerHTML = `
            <button id="btn-login" onclick="loginAdmin()">
                <i class="ti ti-lock"></i>
                Login Admin
            </button>
        `;

        return;
    }

    const nome =
        localStorage.getItem("admin_nome");

    div.innerHTML = `
        <span style="margin-right:10px;">
            👤 ${nome}
        </span>

        <button onclick="logoutAdmin()">
            <i class="ti ti-logout"></i>
            Sair
        </button>
    `;
}

/* ---------- Sair do ADM ---------- */

function logoutAdmin() {

    if (!confirm("Deseja realmente sair?"))
        return;

    localStorage.removeItem(
        "admin_logado"
    );

    localStorage.removeItem(
        "usuario_logado"
    );

    location.reload();
}

/* ---------- Controle de permissões ---------- */

function aplicarPermissoes() {

    const admin =
        localStorage.getItem("admin_logado") === "true";

    const btnScanner =
        document.querySelector('[onclick*="scanner"]');

    const btnCadastro =
        document.querySelector('[onclick*="cadastro"]');

    if (!admin) {

        if (btnScanner)
            btnScanner.style.display = "none";

        if (btnCadastro)
            btnCadastro.style.display = "none";

    }

}

function verificarAdmin() {

    return localStorage.getItem(
        "admin_logado"
    ) === "true";
}

/* ---------- Inicialização ---------- */

document.addEventListener(
    "DOMContentLoaded",
    aplicarPermissoes
);

document.addEventListener(
    "DOMContentLoaded",
    () => {

        aplicarPermissoes();
        atualizarUsuarioLogado();

    }
);