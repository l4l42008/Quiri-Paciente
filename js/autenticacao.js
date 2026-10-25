const { autenticacao } = require("../firebase");

// cadastra um novo usuario na autenticacao do firebase
async function cadastrarUsuario(email, senha, nome) {
    
    // cria o usuário usando e-mail, senha e nome
    const usuario = await autenticacao.createUser({
        email: email,
        password: senha,
        displayName: nome
    });

    // retorna os dados do usuario criado
    return usuario;
}

module.exports = {
    cadastrarUsuario
};