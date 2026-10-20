// guarda os elementos principais do formulario
const formulario = document.getElementById("formCadastroPaciente");
const listaNutricionistas = document.getElementById("lista-nutricionistas");
const statusNutricionistas = document.getElementById("status-nutricionistas");
const toast = document.getElementById("toast");
const botaoCadastrar = document.getElementById("btn-cadastrar");

// mostra uma mensagem na pagina
function mostrarMensagem(texto, erro = false) {
    toast.textContent = texto;
    toast.style.background = erro ? "#2D6A4F" : "#2D6A4F";
    toast.classList.add("show");
}

// esconde a mensagem da pagina
function limparMensagem() {
    toast.classList.remove("show");
}

// controla a exibicao das senhas
document.querySelectorAll(".toggle-pass").forEach(botao => {
    botao.addEventListener("click", () => {
        const campo = document.getElementById(botao.dataset.target);
        const mostrar = campo.type === "password";

        campo.type = mostrar ? "text" : "password";

        botao.setAttribute(
            "aria-label",
            mostrar ? "Ocultar senha" : "Mostrar senha"
        );

        botao.innerHTML = mostrar
            ? '<i class="fa-solid fa-eye-slash" aria-hidden="true"></i>'
            : '<i class="fa-solid fa-eye" aria-hidden="true"></i>';
    });
});

// atualiza a barra de forca da senha
document.getElementById("cad-senha").addEventListener("input", evento => {
    const tamanho = evento.target.value.length;
    const barra = document.getElementById("pw-bar");

    barra.style.width = `${Math.min(tamanho / 12 * 100, 100)}%`;

    barra.style.background = tamanho < 6
        ? "#2D6A4F"
        : tamanho < 10
            ? "#F5EFE0"
            : "#2D6A4F";
});

// carrega a lista de nutricionistas disponiveis
async function carregarNutricionistas() {
    listaNutricionistas.replaceChildren();

    // cria a opcao para continuar sem nutricionista
    const labelNenhum = document.createElement("label");
    labelNenhum.className = "nutri-option";

    const radioNenhum = document.createElement("input");
    radioNenhum.type = "radio";
    radioNenhum.name = "id_nutricionista";
    radioNenhum.value = "";

    const informacoesNenhum = document.createElement("span");
    informacoesNenhum.className = "nutri-info";

    const nomeNenhum = document.createElement("span");
    nomeNenhum.className = "nutri-nome";
    nomeNenhum.textContent = "Nenhum nutricionista";

    const descricaoNenhum = document.createElement("span");
    descricaoNenhum.className = "nutri-crn";

    // organiza as informacoes da opcao sem nutricionista
    informacoesNenhum.append(nomeNenhum, descricaoNenhum);
    labelNenhum.append(radioNenhum, informacoesNenhum);
    listaNutricionistas.appendChild(labelNenhum);

    try {
        // busca os nutricionistas na api
        const resposta = await fetch("/api/nutricionistas");
        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(
                resultado.mensagem ||
                "Não foi possível carregar os nutricionistas."
            );
        }

        const nutricionistas = resultado.nutricionistas || [];

        // informa qnd nao existem nutricionistas disponiveis
        if (nutricionistas.length === 0) {
            statusNutricionistas.textContent =
                "Nenhum profissional disponível no momento.";
            return;
        }

        statusNutricionistas.textContent =
            "Selecione um profissional ou continue sem vínculo.";

        // cria uma opcao para cada nutricionista encontrado
        nutricionistas.forEach(nutri => {
            const label = document.createElement("label");
            label.className = "nutri-option";

            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "id_nutricionista";
            radio.value = nutri.id;

            const informacoes = document.createElement("span");
            informacoes.className = "nutri-info";

            const nome = document.createElement("span");
            nome.className = "nutri-nome";
            nome.textContent = nutri.nome || "Nome não informado";

            const crn = document.createElement("span");
            crn.className = "nutri-crn";
            crn.textContent = `CRN: ${nutri.crn || "Não informado"}`;

            // organiza as informacoes do nutricionista
            informacoes.append(nome, crn);
            label.append(radio, informacoes);
            listaNutricionistas.appendChild(label);
        });
    } catch (erro) {
        // mostra uma mensagem qnd ocorre um erro ao carregar a lista
        statusNutricionistas.textContent =
            "Não foi possível carregar a lista de nutricionistas.";

        mostrarMensagem(erro.message, true);
    }
}

// valida e envia os dados do cadastro
formulario.addEventListener("submit", async evento => {
    evento.preventDefault();
    limparMensagem();

    // recupera os dados preenchidos no formulario
    const nome = document.getElementById("cad-nome").value.trim();
    const cpf = document.getElementById("cad-cpf").value.trim();
    const nascimento = document.getElementById("cad-nascimento").value;
    const telefone = document.getElementById("cad-telefone").value.trim();
    const email = document.getElementById("cad-email").value.trim();
    const senha = document.getElementById("cad-senha").value;
    const confirmarSenha = document.getElementById("cad-senha2").value;

    // recupera o nutricionista selecionado
    const radioSelecionado = formulario.querySelector(
        'input[name="id_nutricionista"]:checked'
    );

    const idNutricionista = radioSelecionado?.value || "";

    // limpa as mensagens de validacao anteriores
    document.getElementById("err-senha").classList.remove("show");
    document.getElementById("err-nutricionista").classList.remove("show");

    // verifica se o cpf possui onze numeros
    if (cpf.replace(/\D/g, "").length !== 11) {
        mostrarMensagem("Digite um CPF com 11 números.", true);
        return;
    }

    // verifica se o telefone e valido
    if (telefone.replace(/\D/g, "").length < 10) {
        mostrarMensagem("Digite um telefone válido.", true);
        return;
    }

    // impede o cadastro com data de nascimento futura
    if (nascimento > new Date().toLocaleDateString("en-CA")) {
        mostrarMensagem(
            "A data de nascimento não pode estar no futuro.",
            true
        );
        return;
    }

    // verifica o tamanho minimo da senha
    if (senha.length < 6) {
        mostrarMensagem(
            "A senha deve ter pelo menos 6 caracteres.",
            true
        );
        return;
    }

    // verifica se as senhas digitadas sao iguais
    if (senha !== confirmarSenha) {
        document.getElementById("err-senha").classList.add("show");
        return;
    }

    // bloqueia o botao durante o cadastro
    botaoCadastrar.disabled = true;
    botaoCadastrar.textContent = "Criando conta...";

    try {
        // envia os dados do paciente para a api
        const resposta = await fetch("/api/paciente/cadastro", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nome,
                cpf,
                nascimento,
                telefone,
                email,
                senha,
                id_nutricionista: idNutricionista || null
            })
        });

        const resultado = await resposta.json();

        // verifica se o servidor retornou algum erro
        if (!resposta.ok) {
            throw new Error(
                resultado.mensagem ||
                "Não foi possível criar a conta."
            );
        }

        // informa q o cadastro foi realizado
        mostrarMensagem("Conta criada com sucesso!");

        // redireciona para a pagina de confirmacao
        setTimeout(() => {
            const destino = new URL(
                "/auth-pendente.html",
                window.location.origin
            );

            destino.searchParams.set("email", email);
            window.location.href = destino.toString();
        }, 1200);
    } catch (erro) {
        // mostra uma mensagem qnd ocorre um erro no cadastro
        mostrarMensagem(
            erro.message || "Erro ao conectar com o servidor.",
            true
        );
    } finally {
        // restaura o botao apos o envio do cadastro
        botaoCadastrar.disabled = false;
        botaoCadastrar.textContent = "Criar minha conta";
    }
});

// carrega os nutricionistas ao abrir a pagina
carregarNutricionistas();