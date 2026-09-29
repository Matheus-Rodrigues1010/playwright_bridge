// node src/lib/steps.test.mjs
import assert from 'node:assert/strict';
import { classifyStep as c, splitSteps, hideSecrets, restoreSecrets } from './steps.js';

// Senhas nunca vão ao Claude: escondidas e restauradas
{
  const { hidden, secrets } = hideSecrets('logar com usuario usuario.teste senha Fict1cia@9 depois senha: "abc def" e senha e clique');
  assert.equal(hidden, 'logar com usuario usuario.teste senha "__SENHA_0__" depois senha: "__SENHA_1__" e senha e clique');
  assert.deepEqual(secrets, ['Fict1cia@9', 'abc def']);
  assert.equal(restoreSecrets('usuário "usuario.teste" e senha "__SENHA_0__"', secrets), 'usuário "usuario.teste" e senha "Fict1cia@9"');
}

assert.deepEqual(c('Preencha os campos de login com usuário "usuario.teste" e senha "Fict1cia@9" e clique em Avançar'), { kind: 'login', user: 'usuario.teste', pass: 'Fict1cia@9' });
assert.deepEqual(c('Selecione "Escola do Matheus Teste" no campo "escola"'), { kind: 'select', value: 'Escola do Matheus Teste', field: 'escola' });
assert.equal(c('Clique no botão "Avançar"').text, 'Avançar');
assert.equal(c('Busque por "termo"').term, 'termo');
assert.deepEqual(c('Verifique se o título da página contém "Inicial"'), { kind: 'verifyText', title: true, value: 'Inicial' });
assert.equal(c('Verifique se o texto "Olá" está sendo exibido').title, false);
assert.equal(c('Verifique se a tela /dashboard está sendo exibida').path, '/dashboard');
assert.equal(c('Preencha um CPF válido no campo "documento"').field, 'documento');
assert.equal(c('Abra o menu Minhas avaliações').kind, 'ai');
// Gherkin (1ª pessoa + palavras-chave), como o n8n envia
assert.deepEqual(c('Quando preencho usuário "usuario.teste" e senha "Fict1cia@9" e clico em Avançar'), { kind: 'login', user: 'usuario.teste', pass: 'Fict1cia@9' });
assert.equal(c('Quando preencho e-mail "a@b.com" e senha "x"').user, 'a@b.com');
assert.deepEqual(c('E seleciono "Escola do Matheus Teste" no campo "escola"'), { kind: 'select', value: 'Escola do Matheus Teste', field: 'escola' });
assert.equal(c('E clico em "Avançar"').text, 'Avançar');
assert.equal(c('Quando busco por "termo"').term, 'termo');
assert.deepEqual(c('Então vejo o texto "Seja bem-vindo(a)"'), { kind: 'verifyText', title: false, value: 'Seja bem-vindo(a)' });
assert.equal(c('Então vejo o título "Inicial"').title, true);
assert.equal(c('Dado que estou na página de login').kind, 'ai');
assert.equal(c('Então vejo a tela de seleção de escola').kind, 'ai');
assert.equal(c('Entre no sistema').kind, 'ai'); // "E" só é palavra-chave seguida de espaço

assert.deepEqual(splitSteps('a | b\r\nc\n\n'), ['a', 'b', 'c']);
console.log('ok');
