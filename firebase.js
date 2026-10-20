// importa a funcao pra inicia o firebase
const { initializeApp, cert } = require("firebase-admin/app");

// importa a funcao pra acessar o firestore
const { getFirestore } = require("firebase-admin/firestore");

// importa a funcao pra acessar o autentication
const { getAuth } = require("firebase-admin/auth");

// carrega a chave do firebase
const chaveFirebase = require("./firebase-key.json");

// inicia o firebase usando a chave do projeto
initializeApp({
    credential: cert(chaveFirebase)
});

// conecta com o firestore
const banco = getFirestore();

// conecta com o firebase autentication
const autenticacao = getAuth();

module.exports = {
    banco,
    autenticacao
};