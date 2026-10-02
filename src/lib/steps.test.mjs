// node src/lib/steps.test.mjs
import assert from 'node:assert/strict';
import { classifyStep as c, splitSteps, hideSecrets, restoreSecrets, prettyStep, NEEDS_DATA } from './steps.js';
import { hubPath } from './hub-knowledge.js';

assert.ok(NEEDS_DATA.test('Selecione "[informe: disciplina]" no campo "Disciplina"'));
assert.ok(!NEEDS_DATA.test('Clique no botão "[Salvar]"'));

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
// Login sem credenciais → usuário padrão do .env
assert.deepEqual(c('faça login'), { kind: 'login', user: '{{QA_USER}}', pass: '{{QA_PASS}}' });
assert.deepEqual(c('Quando faço o login no sistema'), { kind: 'login', user: '{{QA_USER}}', pass: '{{QA_PASS}}' });
assert.equal(c('Verifique se o login "x" aparece').kind, 'verifyText'); // não confunde verificação com login
assert.equal(c('faça login no hub educacional').kind, 'login');
assert.deepEqual(c('Faça login com o usuário padrão'), { kind: 'login', user: '{{QA_USER}}', pass: '{{QA_PASS}}' });
assert.equal(c('faça login e verifique se redireciona pra url /home').kind, 'ai'); // mais ações: não engolir a verificação
assert.equal(c('Clique em "Relatórios" e depois clique em "Exportar"').kind, 'ai');
assert.equal(c('Clique no botão "Clique e verifique"').kind, 'click'); // conectivo dentro de aspas não conta
assert.equal(prettyStep('Preencha os campos de login com usuário "{{QA_USER}}" e senha "{{QA_PASS}}" e clique em Entrar'), 'Preencha os campos de login com usuário padrão e senha •••••• e clique em Entrar');
assert.equal(prettyStep('Selecione "{{QA_ESCOLA}}" no campo "escola"'), 'Selecione QA_ESCOLA (do .env) no campo "escola"');
// Navegação pelo mapa do Hub (src/lib/hub-knowledge.js)
assert.deepEqual(c('Acesse "Banco de questões"'), { kind: 'goto', page: 'Banco de questões' });
assert.deepEqual(c('vá para a página "Meus usuários"'), { kind: 'goto', page: 'Meus usuários' });
assert.deepEqual(c('Acesse /assessments/question-bank'), { kind: 'goto', path: '/assessments/question-bank' });
assert.deepEqual(c('Dado que o usuário esteja no Banco de Questões'), { kind: 'goto', page: 'Banco de Questões' });
assert.equal(c('Dado que o usuário esteja numa tela qualquer').kind, 'ai'); // página desconhecida: não inventa navegação
assert.equal(hubPath('banco de questoes'), '/assessments/question-bank'); // sem acento e minúsculo
// Ações em cartão de questão
assert.deepEqual(c('Na primeira questão, clique em "Remover"'), { kind: 'cardAction', action: 'remover', index: 0 });
assert.deepEqual(c('na 3ª questão clique em atribuir'), { kind: 'cardAction', action: 'atribuir', index: 2 });
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
