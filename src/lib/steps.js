import { hubPath } from './hub-knowledge.js';

export const DEFAULT_LOGIN = { user: '{{QA_USER}}', pass: '{{QA_PASS}}' };
// Forma legível do login padrão; classifyStep a entende como login com QA_USER/QA_PASS.
export const DEFAULT_LOGIN_STEP = 'Faça login com o usuário padrão';

// Marcador do gerador para valor que o usuário precisa completar: [informe: disciplina]
export const NEEDS_DATA = /\[informe[^\]]*\]/i;

// Classifica um passo em linguagem natural. Usado pela API (gera o código) e pela UI (prévia antes de rodar).
// A ordem dos testes define a prioridade entre padrões.
// Aceita imperativo ("clique") e a 1ª pessoa do Gherkin ("clico"); palavras-chave Gherkin são ignoradas.
export function classifyStep(step) {
  step = step.replace(/^\s*(?:dado\s+que|dado|quando|ent[aã]o|e|mas|given|when|then|and|but)\s+/i, '');
  let m;
  if ((m = step.match(/selecion[eao]\s+["']([^"']+)["']\s+no\s+campo\s+["']([^"']+)["']/i))) return { kind: 'select', value: m[1], field: m[2] };
  if ((m = step.match(/(?:usu[aá]rio|e-?mail|login)\s+["']([^"']+)["']\s+e\s+senha\s+["']([^"']+)["']/i))) return { kind: 'login', user: m[1], pass: m[2] };
  // Ação em cartão de questão do Hub (ícone sem texto): 'Na primeira questão, clique em "Remover"'
  if ((m = step.match(/^(?:n[ao]|em)\s+(primeir[ao]|segund[ao]|terceir[ao]|quart[ao]|quint[ao]|\d+)[ªº]?\s+quest[aã]o,?\s+cli(?:que|co)\s+em\s+["']?(atribuir|remover|excluir)["']?\s*[.!]?$/i))) {
    const ORD = { primeir: 0, segund: 1, terceir: 2, quart: 3, quint: 4 };
    const index = /^\d/.test(m[1]) ? Number(m[1]) - 1 : ORD[m[1].toLowerCase().slice(0, -1)];
    return { kind: 'cardAction', action: m[2].toLowerCase(), index };
  }
  // Navegação: 'Acesse "Banco de questões"', 'Acesse /assessments/question-bank', 'estou/esteja no Banco de Questões' (página conhecida)
  if ((m = step.match(/^(?:acess[ea]|abr[ae]|v[aá]\s+(?:para|at[eé])|naveg(?:ue|o)\s+(?:para|at[eé])|entr[ae]\s+(?:em|n[oa]))\s+(?:(?:a|o)\s+)?(?:(?:p[aá]gina|tela|menu|url)\s+)?(?:(?:de|do|da)\s+)?["']([^"']+)["']\s*[.!]?$/i))) return { kind: 'goto', page: m[1] };
  if ((m = step.match(/^(?:acess[ea]|abr[ae]|v[aá]\s+para)\s+(?:(?:a|o)\s+)?(?:(?:p[aá]gina|tela|url|endere[çc]o)\s+)?(\/[\w\-/?=&.%]*)\s*$/i))) return { kind: 'goto', path: m[1] };
  if ((m = step.match(/^(?:(?:o\s+)?usu[aá]rio\s+)?(?:estou|esteja|est[aá])\s+(?:n[oa]|em)\s+(?:p[aá]gina\s+(?:de|do|da)\s+|tela\s+(?:de|do|da)\s+)?["']?([^"'.!]+?)["']?\s*[.!]?$/i)) && hubPath(m[1])) return { kind: 'goto', page: m[1] };
  // Linha com duas ações ("faça login e verifique...", "clique em X e depois em Y"): um padrão só engoliria a outra
  // ação em silêncio, então vai inteira para a IA. Texto entre aspas é ignorado nessa checagem.
  if (/\s(?:e|depois|ent[aã]o|,)\s+(?:(?:em\s+seguida|depois)\s+)?(?:verifi|confir|cli[cq]|selecion|busc|busq|pesquis|preench|digit|abr[ae]|acess|entr[ae]|fa[çc]a|v[eê]\s|vej)/i
    .test(step.replace(/"[^"]*"|'[^']*'/g, '""'))) return { kind: 'ai' };
  // "Faça login" sem credenciais → usuário de teste padrão do .env (QA_USER / QA_PASS).
  // Só a linha inteira (aceita "no sistema"/"no hub"); com mais ações ("e verifique...") não é login puro.
  if (/^(?:fa[çc][ao]|fazer|efetu[aeo]|realiz[aeo])\s+(?:o\s+)?login(?:\s+com\s+(?:o\s+)?usu[aá]rio\s+padr[aã]o)?(?:\s+(?:n[oa]|em)(?:\s+[\wÀ-ú-]+){1,3})?\s*[.!]?$/i.test(step)) return { kind: 'login', ...DEFAULT_LOGIN };
  if ((m = step.match(/(?:busque|busco|pesquise|pesquiso|procure|procuro|digite|digito|filtre|filtro)\s+(?:por\s+)?["']([^"']+)["']/i))) return { kind: 'search', term: m[1] };
  if ((m = step.match(/cli(?:que|co)\s+(?:(?:n[oa]|em)\s+)?(?:texto|bot[aã]o|link|op[cç][aã]o)?\s*["']([^"']+)["']/i))) return { kind: 'click', text: m[1] };
  if ((m = step.match(/(?:verifique\s+se|vejo|visualizo|deve\s+(?:ver|exibir|aparecer))\s+(.*?)["']([^"']+)["']/i))) return { kind: 'verifyText', title: /t[ií]tulo/i.test(m[1]), value: m[2] };
  if ((m = step.match(/verifique\s+se\s+.*?(\/\w[\w/]*)/i))) return { kind: 'verifyUrl', path: m[1] };
  if ((m = step.match(/cpf\s+v[aá]lido(?:.*?campo\s+["']([^"']+)["']|.*?em\s+["']([^"']+)["'])?/i))) return { kind: 'cpf', field: m[1] || m[2] || 'cpf' };
  return { kind: 'ai' };
}

export const STEP_LABELS = {
  select: 'Seleção', login: 'Login', search: 'Busca', click: 'Clique', goto: 'Navegação', cardAction: 'Ação na questão',
  verifyText: 'Verificação', verifyUrl: 'Verificação', cpf: 'CPF', ai: 'Claude',
};

// Modelos canônicos de cada padrão nativo (0 tokens): atalhos da interface e referência para o gerador de passos.
export const TEMPLATES = [
  ['Login', DEFAULT_LOGIN_STEP],
  ['Login (outro usuário)', 'Preencha os campos de login com usuário "usuario" e senha "senha" e clique em Entrar'],
  ['Ir para página', 'Acesse "Banco de questões"'],
  ['Seleção', 'Selecione "Opção" no campo "Campo"'],
  ['Clique', 'Clique no botão "Texto"'],
  ['Busca', 'Busque por "termo"'],
  ['Ver. texto', 'Verifique se o texto "Texto esperado" está sendo exibido'],
  ['Ver. título', 'Verifique se o título da página contém "Título"'],
  ['Ver. URL', 'Verifique se a tela /caminho está sendo exibida'],
  ['CPF', 'Preencha um CPF válido no campo "cpf"'],
];

// Troca senhas por marcadores antes de mandar texto ao Claude; restoreSecrets devolve os valores.
// Pega senha entre aspas, ou sem aspas quando tem dígito/símbolo (evita confundir "senha e clique").
export function hideSecrets(text) {
  const secrets = [];
  const hidden = text.replace(/(senha\s*[:=]?\s*)(?:(["'])([^"']+)\2|([^\s"',]*[\d@#$%!&*][^\s"',]*))/gi,
    (_, pre, _q, quoted, bare) => `${pre}"__SENHA_${secrets.push(quoted ?? bare) - 1}__"`);
  return { hidden, secrets };
}
export const restoreSecrets = (text, secrets) => text.replace(/__SENHA_(\d+)__/g, (m, i) => secrets[i] ?? m);

export const maskPassword = text => text.replace(/(senha\s+["'])[^"']+(["'])/i, '$1••••••$2');

// Exibição amigável: senha mascarada e placeholders {{QA_*}} por extenso. O texto editável continua cru.
export const prettyStep = text => maskPassword(text)
  .replace(/usu[aá]rio\s+["']\{\{QA_USER\}\}["']/i, 'usuário padrão')
  .replace(/senha\s+["']••••••["']/i, 'senha ••••••')
  .replace(/["']\{\{(QA_[A-Z0-9_]+)\}\}["']/g, '$1 (do .env)');

// Vírgulas NÃO quebram, permitindo agrupar ações no mesmo passo.
export const splitSteps = text => text.split(/[|\n]+/).map(s => s.trim()).filter(Boolean);
