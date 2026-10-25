// guarda os elementos principais do formulario
const formularioLogin = document.getElementById("formLogin");
const campoLogin = document.getElementById("login");
const campoSenha = document.getElementById("password");
const mensagemErro = document.getElementById("err-login");
const botaoMostrarSenha = document.getElementById("togglePass");

// controla a exibicao da senha
botaoMostrarSenha.addEventListener("click", function () {
    const senhaOculta = campoSenha.type === "password";

    campoSenha.type = senhaOculta ? "text" : "password";

    botaoMostrarSenha.setAttribute(
        "aria-pressed",
        String(senhaOculta)
    );

    botaoMostrarSenha.setAttribute(
        "aria-label",
        senhaOculta ? "Ocultar senha" : "Mostrar senha"
    );

    botaoMostrarSenha.innerHTML = senhaOculta
        ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>'
        : '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
});

// envia os dados do login
formularioLogin.addEventListener("submit", async function (evento) {
    evento.preventDefault();

    // recupera os dados preenchidos no formulario
    const email = campoLogin.value.trim();
    const senha = campoSenha.value;

    // limpa as mensagens de erro anteriores
    mensagemErro.textContent = "";
    mensagemErro.classList.remove("show");

    campoLogin.closest(".field-wrap").classList.remove("input-error");
    campoSenha.closest(".field-wrap").classList.remove("input-error");

    // recupera o botao de entrar
    const botaoEntrar = formularioLogin.querySelector(
        'button[type="submit"]'
    );

    // bloqueia o botao durante o login
    botaoEntrar.disabled = true;

    try {
        // envia os dados do login para a api
        const resposta = await fetch("/api/paciente/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                senha: senha
            })
        });

        const resultado = await resposta.json();

        // mostra a mensagem qnd os dados do login sao invalidos
        if (!resposta.ok) {
            mensagemErro.textContent =
                resultado.mensagem || "Não foi possível entrar.";

            mensagemErro.classList.add("show");

            campoLogin.closest(".field-wrap").classList.add("input-error");
            campoSenha.closest(".field-wrap").classList.add("input-error");

            return;
        }

        // salva o uid do paciente para as outras paginas
        localStorage.setItem("uidPaciente", resultado.uid);

        // redireciona para o painel do paciente
        window.location.href = "dashboard.html";
    } catch (erro) {
        // registra o erro ocorrido durante o login
        console.error("Erro ao fazer login:", erro);

        // mostra uma mensagem qnd ocorre um erro de conexao
        mensagemErro.textContent = "Erro ao conectar com o servidor.";
        mensagemErro.classList.add("show");
    } finally {
        // restaura o botao apos a tentativa de login
        botaoEntrar.disabled = false;
        botaoEntrar.textContent = "ENTRAR";
    }
});