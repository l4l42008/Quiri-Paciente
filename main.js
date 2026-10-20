// importa o express, q cuida das rotas e das requisições do servidor
const express = require("express");

// importa o path, usado pra montar os caminhos dos arquivos
const path = require("path");

// importa o banco de dados e o sistema de autenticação do firebase
const { banco, autenticacao } = require("./firebase.js");

// cria a aplicação do servidor
const app = express();

// define a porta em q o servidor vai rodar
const PORTA = process.env.PORT || 5000;

// guarda a chave usada pra acessar a api de autenticação do firebase
const chaveApiFirebase = "AIzaSyBePTAawgoODCrupD5pbi7CYAhl0U991QE";

// permite q o servidor receba dados no formato json
app.use(express.json());

// libera o acesso aos arquivos html
app.use(express.static(path.join(__dirname, "html")));

// libera os arquivos de estilo
app.use("/style", express.static(path.join(__dirname, "style")));

// libera os arquivos javascript do front-end
app.use("/js", express.static(path.join(__dirname, "js")));

// libera as imagens do projeto
app.use("/imagens", express.static(path.join(__dirname, "imagens")));

// rota inicial, q abre a página principal do site
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "html", "index.html"));
});

// transforma diferentes formatos de data em uma string no padrão ano-mês-dia
function formatarDataDieta(valor) {
    // se n tiver data, retorna null
    if (!valor) return null;

    let data;

    // converte datas do firebase pro formato padrão do javascript
    if (typeof valor.toDate === "function") {
        data = valor.toDate();

    // converte timestamps q possuem o campo seconds
    } else if (typeof valor.seconds === "number") {
        data = new Date(valor.seconds * 1000);

    // trata timestamps q usam o campo _seconds
    } else if (typeof valor._seconds === "number") {
        data = new Date(valor._seconds * 1000);

    // mantém o valor caso ele já seja uma data
    } else if (valor instanceof Date) {
        data = valor;

    // verifica se o valor recebido é uma string
    } else if (typeof valor === "string") {
        // se já estiver no formato ano-mês-dia, retorna sem alterar
        if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;

        // tenta converter a string em uma data
        data = new Date(valor);

    // retorna null se o formato n for reconhecido
    } else {
        return null;
    }

    // verifica se a data convertida é válida
    if (Number.isNaN(data.getTime())) return null;

    // separa ano, mês e dia pra montar a data no formato esperado
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
}

// busca os registros de um paciente em uma coleção do firestore
async function buscarRegistrosDoPaciente(colecao, uidPaciente) {
    // verifica os possíveis nomes usados pra identificar o paciente
    const campos = ["id_paciente", "uid_paciente", "pacienteId"];

    // usa um map pra evitar registros duplicados
    const encontrados = new Map();

    // pesquisa o paciente usando cada um dos campos possíveis
    for (const campo of campos) {
        const resultado = await banco.collection(colecao)
            .where(campo, "==", uidPaciente)
            .get();

        // guarda os registros encontrados usando o id como chave
        resultado.docs.forEach(doc => {
            encontrados.set(doc.id, { id: doc.id, ...doc.data() });
        });
    }

    // retorna todos os registros encontrados sem duplicatas
    return [...encontrados.values()];
}

// busca o nome do nutricionista pelo id
async function buscarNomeNutricionista(idNutricionista) {
    // retorna uma mensagem caso n exista nutricionista vinculado
    if (!idNutricionista) return "Nenhum nutricionista vinculado";

    const colecao = banco.collection("nutricionistas");

    // tenta encontrar o nutricionista diretamente pelo id do documento
    const documento = await colecao.doc(idNutricionista).get();

    if (documento.exists) {
        return documento.data().nome || "Não informado";
    }

    // caso n encontre, pesquisa pelo campo id_nutricionista
    const resultado = await colecao
        .where("id_nutricionista", "==", idNutricionista)
        .limit(1)
        .get();

    // retorna o nome encontrado ou uma mensagem padrão
    return resultado.empty
        ? "Não informado"
        : resultado.docs[0].data().nome || "Não informado";
}

// verifica se o nutricionista existe e pode ser selecionado
async function buscarNutricionistaDisponivel(id) {
    const documento = await banco.collection("nutricionistas").doc(id).get();

    // retorna null se o documento n existir
    if (!documento.exists) return null;

    const dados = documento.data();

    // impede a seleção de nutricionistas inativos ou n aprovados
    return dados.ativo === false || dados.aprovado === false
        ? null
        : dados;
}

// rota responsável por fazer o login do paciente
app.post("/api/paciente/login", async (req, res) => {
    // recebe o e-mail e a senha enviados pelo front-end
    const email = String(req.body.email || "").trim().toLowerCase();
    const senha = String(req.body.senha || "");

    // verifica se os campos obrigatórios foram preenchidos
    if (!email || !senha) {
        return res.status(400).json({
            mensagem: "Informe o e-mail e a senha."
        });
    }

    try {
        // envia os dados pro firebase verificar as credenciais
        const resposta = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${chaveApiFirebase}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    password: senha,
                    returnSecureToken: true
                })
            }
        );

        const resultado = await resposta.json();

        // trata os erros retornados pelo firebase
        if (!resposta.ok) {
            // relaciona cada código de erro com uma mensagem pro usuário
            const mensagens = {
                EMAIL_NOT_FOUND: "E-mail não cadastrado.",
                INVALID_PASSWORD: "Senha incorreta.",
                INVALID_LOGIN_CREDENTIALS: "E-mail ou senha inválidos.",
                USER_DISABLED: "Esta conta foi desativada.",
                INVALID_EMAIL: "O e-mail informado é inválido.",
                API_KEY_INVALID: "A chave de API do Firebase é inválida.",
                OPERATION_NOT_ALLOWED: "O login por e-mail e senha não está habilitado no Firebase.",
                TOO_MANY_ATTEMPTS_TRY_LATER: "Muitas tentativas. Tente novamente mais tarde."
            };

            // pega o código do erro pra escolher a mensagem correta
            const codigo = resultado.error?.message;

            // mostra os detalhes do erro no terminal pra ajudar na identificação do problema
            console.error("Erro Firebase Login:", resultado);

            // retorna um status adequado de acordo com o erro recebido
            return res.status(
                codigo === "API_KEY_INVALID" ? 500 :
                codigo === "OPERATION_NOT_ALLOWED" ? 400 : 401
            ).json({
                mensagem: mensagens[codigo] || "Não foi possível realizar o login."
            });
        }

        // busca o cadastro do paciente usando o uid retornado pelo firebase
        const documento = await banco.collection("pacientes")
            .doc(resultado.localId)
            .get();

        // impede o acesso se a conta n estiver cadastrada como paciente
        if (!documento.exists) {
            return res.status(403).json({
                mensagem: "Esta conta não está cadastrada como paciente."
            });
        }

        // retorna os dados necessários pra confirmar o login
        return res.json({
            mensagem: "Login realizado com sucesso.",
            uid: resultado.localId,
            token: resultado.idToken
        });

    } catch (erro) {
        // registra o erro no terminal pra facilitar a análise
        console.error("Erro no login:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível realizar o login. Verifique o terminal do servidor."
        });
    }
});

// rota responsável por cadastrar um novo paciente
app.post("/api/paciente/cadastro", async (req, res) => {
    // guarda o usuário criado pra permitir a limpeza caso algo dê errado
    let usuarioCriado = null;

    try {
        // recebe os dados enviados pelo formulário de cadastro
        const {
            nome, cpf, nascimento, telefone, email, senha, id_nutricionista
        } = req.body;

        // verifica se os campos obrigatórios foram preenchidos corretamente
        if (
            typeof nome !== "string" || !nome.trim() ||
            typeof cpf !== "string" || !cpf.trim() ||
            !nascimento ||
            typeof telefone !== "string" || !telefone.trim() ||
            typeof email !== "string" || !email.trim() ||
            typeof senha !== "string" || !senha
        ) {
            return res.status(400).json({
                mensagem: "Preencha todos os campos obrigatórios."
            });
        }

        // remove os caracteres q n são números do cpf e do telefone
        const cpfNumeros = cpf.replace(/\D/g, "");
        const telefoneNumeros = telefone.replace(/\D/g, "");

        // remove espaços do e-mail e deixa tudo em minúsculo
        const emailNormalizado = email.trim().toLowerCase();

        // verifica se o cpf possui 11 números
        if (cpfNumeros.length !== 11) {
            return res.status(400).json({ mensagem: "Digite um CPF válido." });
        }

        // verifica se o telefone possui 10 ou 11 números
        if (telefoneNumeros.length < 10 || telefoneNumeros.length > 11) {
            return res.status(400).json({ mensagem: "Digite um telefone válido." });
        }

        // exige uma senha com pelo menos 6 caracteres
        if (senha.length < 6) {
            return res.status(400).json({
                mensagem: "A senha deve ter pelo menos 6 caracteres."
            });
        }

        // confere se a data de nascimento está no formato esperado
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) {
            return res.status(400).json({
                mensagem: "Data de nascimento inválida."
            });
        }

        // converte a data de nascimento pra um objeto de data
        const dataNascimento = new Date(`${nascimento}T12:00:00-03:00`);

        // verifica se a data é válida e se n está no futuro
        if (
            Number.isNaN(dataNascimento.getTime()) ||
            dataNascimento > new Date() ||
            dataNascimento.toISOString().slice(0, 10) !== nascimento
        ) {
            return res.status(400).json({
                mensagem: "A data de nascimento é inválida ou está no futuro."
            });
        }

        // verifica se o nutricionista escolhido existe e está disponível
        if (id_nutricionista && !(await buscarNutricionistaDisponivel(id_nutricionista))) {
            return res.status(400).json({
                mensagem: "Nutricionista não encontrado ou indisponível."
            });
        }

        // busca os pacientes cadastrados pra verificar se o cpf já está em uso
        const pacientes = await banco.collection("pacientes").get();
        const cpfJaExiste = pacientes.docs.some(doc =>
            String(doc.data().cpf || "").replace(/\D/g, "") === cpfNumeros
        );

        // impede o cadastro se já existir outro paciente com o mesmo cpf
        if (cpfJaExiste) {
            return res.status(409).json({
                mensagem: "Esse CPF já está cadastrado."
            });
        }

        // cria a conta do paciente no sistema de autenticação do firebase
        usuarioCriado = await autenticacao.createUser({
            email: emailNormalizado,
            password: senha,
            displayName: nome.trim(),
            emailVerified: false
        });

        // salva os dados do paciente no firestore usando o uid como id
        await banco.collection("pacientes").doc(usuarioCriado.uid).set({
            nome: nome.trim(),
            cpf: cpfNumeros,
            nascimento: dataNascimento,
            telefone: telefone.trim(),
            email: emailNormalizado,
            id_nutricionista: id_nutricionista || null
        });

        // confirma q o cadastro foi concluído
        return res.status(201).json({
            mensagem: "Conta criada com sucesso!",
            uid: usuarioCriado.uid
        });

    } catch (erro) {
        // mostra o erro no terminal caso o cadastro falhe
        console.error("Erro no cadastro:", erro);

        // remove os dados criados caso o cadastro n tenha sido concluído
        if (usuarioCriado) {
            try {
                await banco.collection("pacientes").doc(usuarioCriado.uid).delete();
                await autenticacao.deleteUser(usuarioCriado.uid);
            } catch (erroLimpeza) {
                // registra caso a limpeza do cadastro tbm falhe
                console.error("Erro ao limpar cadastro incompleto:", erroLimpeza);
            }
        }

        // trata o caso em q o e-mail já está cadastrado
        if (erro.code === "auth/email-already-exists") {
            return res.status(409).json({
                mensagem: "Esse e-mail já está cadastrado."
            });
        }

        // trata o caso em q o e-mail informado é inválido
        if (erro.code === "auth/invalid-email") {
            return res.status(400).json({
                mensagem: "Digite um e-mail válido."
            });
        }

        return res.status(500).json({
            mensagem: "Não foi possível criar a conta. Verifique o terminal do servidor."
        });
    }
});

// rota q lista os nutricionistas disponíveis pra seleção
app.get("/api/nutricionistas", async (req, res) => {
    try {
        // busca os documentos cadastrados na coleção de nutricionistas
        const snapshot = await banco.collection("nutricionistas").get();

        // mantém apenas os nutricionistas ativos e aprovados
        const nutricionistas = snapshot.docs
            .filter(doc => {
                const dados = doc.data();
                return dados.ativo !== false && dados.aprovado !== false;
            })

            // organiza os dados q serão enviados pro front-end
            .map(doc => {
                const dados = doc.data();
                return {
                    id: doc.id,
                    nome: dados.nome || "",
                    crn: dados.crn || dados.CRN || ""
                };
            })

            // coloca os nomes em ordem alfabética
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

        // envia a lista de nutricionistas em formato json
        return res.json({ nutricionistas });

    } catch (erro) {
        // registra o erro caso n seja possível carregar a lista
        console.error("Erro ao listar nutricionistas:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível carregar os nutricionistas."
        });
    }
});

// rota q reúne os dados necessários pro painel do paciente
app.get("/api/paciente/dashboard", async (req, res) => {
    // recebe o uid do paciente enviado no cabeçalho da requisição
    const uidPaciente = req.get("x-paciente-uid");

    // verifica se o uid foi enviado
    if (!uidPaciente) {
        return res.status(401).json({
            mensagem: "Sessão do paciente não encontrada. Entre novamente."
        });
    }

    try {
        // busca o cadastro do paciente pelo uid
        const documento = await banco.collection("pacientes")
            .doc(uidPaciente)
            .get();

        // verifica se o cadastro existe
        if (!documento.exists) {
            return res.status(404).json({
                mensagem: "Cadastro de paciente não encontrado."
            });
        }

        const paciente = documento.data();

        // pega o id do nutricionista vinculado ao paciente
        const nutricionistaId = paciente.id_nutricionista || null;

        // busca os registros do paciente em paralelo pra agilizar a consulta
        const [dietas, consultas, feedbacks, relatorios] = await Promise.all([
            buscarRegistrosDoPaciente("dietas", uidPaciente),
            buscarRegistrosDoPaciente("consultas", uidPaciente),
            buscarRegistrosDoPaciente("feedbacks", uidPaciente),
            buscarRegistrosDoPaciente("relatorio", uidPaciente)
        ]);

        // busca o nome do nutricionista e prepara os dados das dietas
        const [nomeNutricionista, dietasComNutricionista] = await Promise.all([
            buscarNomeNutricionista(nutricionistaId),

            // adiciona as informações necessárias em cada dieta
            Promise.all(dietas.map(async dieta => ({
                id: dieta.id,
                titulo: dieta.titulo || "Dieta sem título",
                descricao: dieta.descricao || "",
                data_inicio: formatarDataDieta(dieta.data_inicio),
                data_fim: formatarDataDieta(dieta.data_fim),
                id_paciente: dieta.id_paciente || "",
                id_nutricionista: dieta.id_nutricionista || "",

                // busca o nome do nutricionista responsável por essa dieta
                nomeNutricionista: await buscarNomeNutricionista(dieta.id_nutricionista)
            })))
        ]);

        // devolve os dados do paciente e os registros encontrados
        return res.json({
            paciente: {
                nome: paciente.nome || "",
                cpf: paciente.cpf || "",
                nascimento: formatarDataDieta(paciente.nascimento),
                email: paciente.email || "",
                telefone: paciente.telefone || "",
                id_nutricionista: nutricionistaId,
                nomeNutricionista
            },
            dietas: dietasComNutricionista,
            consultas,
            feedbacks,
            relatorios
        });

    } catch (erro) {
        // mostra o erro caso o painel n consiga carregar os dados
        console.error("Erro ao carregar dashboard:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível carregar os dados do dashboard."
        });
    }
});

// rota q recebe a avaliação do paciente sobre uma dieta
app.post("/api/paciente/feedback", async (req, res) => {
    // recebe os dados enviados pra registrar o feedback
    const { uidPaciente, id_dieta, nota, comentario } = req.body;

    // verifica se o paciente, a dieta e uma nota válida foram informados
    if (
        !uidPaciente || !id_dieta ||
        !Number.isInteger(nota) || nota < 1 || nota > 5
    ) {
        return res.status(400).json({
            mensagem: "Informe a dieta e uma nota de 1 a 5."
        });
    }

    try {
        // busca o cadastro do paciente e a dieta ao mesmo tempo
        const [pacienteDoc, dietaDoc] = await Promise.all([
            banco.collection("pacientes").doc(uidPaciente).get(),
            banco.collection("dietas").doc(id_dieta).get()
        ]);

        // verifica se o paciente existe
        if (!pacienteDoc.exists) {
            return res.status(404).json({ mensagem: "Paciente não encontrado." });
        }

        // verifica se a dieta existe
        if (!dietaDoc.exists) {
            return res.status(404).json({ mensagem: "Dieta não encontrada." });
        }

        const dieta = dietaDoc.data();

        // confere se a dieta está vinculada ao paciente q enviou a avaliação
        const pertenceAoPaciente = [
            dieta.id_paciente,
            dieta.uid_paciente,
            dieta.pacienteId
        ].includes(uidPaciente);

        // impede q o paciente avalie uma dieta q n pertence a ele
        if (!pertenceAoPaciente) {
            return res.status(403).json({
                mensagem: "Esta dieta não pertence ao paciente conectado."
            });
        }

        // salva a avaliação na coleção de feedbacks
        await banco.collection("feedbacks").add({
            id_paciente: uidPaciente,
            id_dieta,
            id_nutricionista: dieta.id_nutricionista || pacienteDoc.data().id_nutricionista || "",
            nota,
            comentario: String(comentario || "").trim().slice(0, 1000),
            data_criacao: new Date()
        });

        // confirma q o feedback foi salvo
        return res.status(201).json({
            mensagem: "Feedback enviado com sucesso."
        });

    } catch (erro) {
        // registra o erro caso n seja possível salvar a avaliação
        console.error("Erro ao salvar feedback:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível salvar o feedback."
        });
    }
});

// rota q permite atualizar os dados do perfil do paciente
app.put("/api/paciente/perfil", async (req, res) => {
    try {
        // recebe o uid do paciente enviado no cabeçalho
        const uidPaciente = req.get("x-paciente-uid");

        // verifica se o paciente foi identificado
        if (!uidPaciente) {
            return res.status(401).json({
                mensagem: "Paciente não identificado."
            });
        }

        // recebe os dados q podem ser alterados no perfil
        const { nome, nascimento, telefone } = req.body;

        // verifica se os campos obrigatórios foram preenchidos
        if (
            typeof nome !== "string" || !nome.trim() ||
            !nascimento ||
            typeof telefone !== "string" || !telefone.trim()
        ) {
            return res.status(400).json({
                mensagem: "Preencha todos os campos obrigatórios."
            });
        }

        // busca o documento do paciente no firestore
        const referencia = banco.collection("pacientes").doc(uidPaciente);
        const paciente = await referencia.get();

        // verifica se o cadastro existe
        if (!paciente.exists) {
            return res.status(404).json({ mensagem: "Paciente não encontrado." });
        }

        // prepara os dados q serão atualizados no perfil
        const dadosAtualizados = {
            nome: nome.trim(),
            nascimento,
            telefone: telefone.trim()
        };

        // verifica se a requisição tbm enviou uma alteração de nutricionista
        if (Object.prototype.hasOwnProperty.call(req.body, "id_nutricionista")) {
            const id = req.body.id_nutricionista;

            // permite remover o vínculo com o nutricionista
            if (id === null || id === "") {
                dadosAtualizados.id_nutricionista = null;
            } else {
                // só aceita um nutricionista válido e disponível
                if (typeof id !== "string" || !(await buscarNutricionistaDisponivel(id))) {
                    return res.status(400).json({
                        mensagem: "Nutricionista não encontrado ou indisponível."
                    });
                }

                dadosAtualizados.id_nutricionista = id;
            }
        }

        // salva as alterações no cadastro do paciente
        await referencia.update(dadosAtualizados);

        // confirma q o perfil foi atualizado
        return res.json({ mensagem: "Perfil atualizado com sucesso." });

    } catch (erro) {
        // registra o erro caso a atualização falhe
        console.error("Erro ao atualizar perfil:", erro);

        return res.status(500).json({
            mensagem: "Não foi possível salvar as alterações."
        });
    }
});

// inicia o servidor
app.listen(PORTA, "0.0.0.0", () => {
    console.log("Servidor iniciado");
    console.log(`Porta utilizada: ${PORTA}`);
});
