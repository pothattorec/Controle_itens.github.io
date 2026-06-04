/* ---------- Login de administrador ---------- */

async function loginAdmin() {

    const usuario = prompt("Usuário");
    const senha = prompt("Senha");

    if (
        usuario === "admin" &&
        senha === "243414"
    ) {

        localStorage.setItem(
            "admin_logado",
            "true"
        );

        localStorage.setItem(
            "usuario_logado",
            usuario
        );

        aplicarPermissoes();
        atualizarUsuarioLogado();

        alert("Login realizado com sucesso!");

    } else {

        alert("Usuário ou senha inválidos.");

    }
}

function atualizarUsuarioLogado() {

    const nome =
        localStorage.getItem(
            "usuario_logado"
        );

    const area =
        document.getElementById(
            "usuario-logado"
        );

    if (!area) return;

    if (nome) {

        area.innerHTML = `
            <div style="
                display:flex;
                align-items:center;
                gap:10px;
            ">

                <span>
                    <i class="ti ti-user"></i>
                    ${nome}
                </span>

                <button
                    onclick="logoutAdmin()"
                >
                    <i class="ti ti-logout"></i>
                    Sair
                </button>

            </div>
        `;

    } else {

        area.innerHTML = `
            <button
                onclick="loginAdmin()"
            >
                <i class="ti ti-lock"></i>
                Login Admin
            </button>
        `;
    }
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