// Classifica um passo em linguagem natural. Usado pela API (gera o código) e pela UI (prévia antes de rodar).
// A ordem dos testes define a prioridade entre padrões.
// Aceita imperativo ("clique") e a 1ª pessoa do Gherkin ("clico"); palavras-chave Gherkin são ignoradas.
export function classifyStep(step) {
  step = step.replace(/^\s*(?:dado\s+que|dado|quando|ent[aã]o|e|mas|given|when|then|and|but)\s+/i, '');
  let m;
  if ((m = step.match(/selecion[eao]\s+["']([^"']+)["']\s+no\s+campo\s+["']([^"']+)["']/i))) return { kind: 'select', value: m[1], field: m[2] };
  if ((m = step.match(/(?:usu[aá]rio|e-?mail|login)\s+["']([^"']+)["']\s+e\s+senha\s+["']([^"']+)["']/i))) return { kind: 'login', user: m[1], pass: m[2] };
  if ((m = step.match(/(?:busque|busco|pesquise|pesquiso|procure|procuro|digite|digito|filtre|filtro)\s+(?:por\s+)?["']([^"']+)["']/i))) return { kind: 'search', term: m[1] };
  if ((m = step.match(/cli(?:que|co)\s+(?:(?:n[oa]|em)\s+)?(?:texto|bot[aã]o|link|op[cç][aã]o)?\s*["']([^"']+)["']/i))) return { kind: 'click', text: m[1] };
  if ((m = step.match(/(?:verifique\s+se|vejo|visualizo|deve\s+(?:ver|exibir|aparecer))\s+(.*?)["']([^"']+)["']/i))) return { kind: 'verifyText', title: /t[ií]tulo/i.test(m[1]), value: m[2] };
  if ((m = step.match(/verifique\s+se\s+.*?(\/\w[\w/]*)/i))) return { kind: 'verifyUrl', path: m[1] };
  if ((m = step.match(/cpf\s+v[aá]lido(?:.*?campo\s+["']([^"']+)["']|.*?em\s+["']([^"']+)["'])?/i))) return { kind: 'cpf', field: m[1] || m[2] || 'cpf' };
  return { kind: 'ai' };
}

export const STEP_LABELS = {
  select: 'Seleção', login: 'Login', search: 'Busca', click: 'Clique',
  verifyText: 'Verificação', verifyUrl: 'Verificação', cpf: 'CPF', ai: 'Claude',
};

// Modelos canônicos de cada padrão nativo (0 tokens): atalhos da interface e referência para o gerador de passos.
export const TEMPLATES = [
  ['Login', 'Preencha os campos de login com usuário "usuario" e senha "senha" e clique em Entrar'],
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

// Vírgulas NÃO quebram, permitindo agrupar ações no mesmo passo.
export const splitSteps = text => text.split(/[|\n]+/).map(s => s.trim()).filter(Boolean);
