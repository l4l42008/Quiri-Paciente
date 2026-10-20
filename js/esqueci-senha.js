import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
    getAuth,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// configuracoes do firebase usadas nessa pagina
const firebaseConfig = {
    apiKey: "AIzaSyBePTAawgoODCrupD5pbi7CYAhl0U991QE",
    authDomain: "quiri-9f2b9.firebaseapp.com",
    projectId: "quiri-9f2b9",
    storageBucket: "quiri-9f2b9.firebasestorage.app",
    messagingSenderId: "224279968242",
    appId: "1:224279968242:web:064ab8de879d60245bd36b",
    measurementId: "G-ZWNHSBJQNP"
  };

// inicializa o firebase e pega o servico de autenticacao
const app =
    initializeApp(firebaseConfig);
const auth =
    getAuth(app);

// pega os elementos do formulario pra usar no codigo
const formulario =
    document.getElementById(
        "formRedefinirSenha"
    );

const campoEmail =
    document.getElementById(
        "email"
    );

const erroEmail =
    document.getElementById(
        "err-email"
    );

// qdo o formulario for enviado tenta mandar o email de redefinicao
formulario.addEventListener(
    "submit",
    async function (evento) {
        evento.preventDefault();
        const email =
            campoEmail.value.trim();


        // verifica se o campo de email foi prenchido
        if (!email) {
            erroEmail.textContent =
                "Digite seu e-mail.";

            erroEmail.style.display =
                "block";
            return;
        }

        // esconde a mensagem de erro antes de tentar enviar
        erroEmail.style.display =
            "none";

        try {
            // manda o email de redefinicao de senha pelo firebose
            await sendPasswordResetEmail(
                auth,
                email
            );


            // avisa q o link foi enviado
            alert(
                "Link para redefinir sua senha enviado para seu e-mail."
            );

            // limpa o campo depois do envio
            campoEmail.value = "";

        } catch (erro) {
            // mostra no console caso aconteca algum erro no envio
            console.error(
                "Erro ao redefinir senha:",
                erro
            );

            // verifica qual erro aconteceu e mostra
            if (
                erro.code ===
                "auth/user-not-found"
            ) {
                erroEmail.textContent =
                    "Não encontramos uma conta com esse e-mail.";

            } else if (
                erro.code ===
                "auth/invalid-email"
            ) {
                erroEmail.textContent =
                    "Digite um e-mail válido.";

            } else {
                erroEmail.textContent =
                    "Não foi possível enviar o e-mail de redefinição.";
            }

            // mostra mensagem de erro na tela
            erroEmail.style.display =
                "block";
        }
    }
);