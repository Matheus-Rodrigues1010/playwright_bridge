// Conhecimento do Hub Educacional levantado navegando no QA (perfil Administrador, 29/09/2026).
// O robô usa o mapa para ir direto à página; o gerador usa páginas, filtros e textos para escrever passos prontos.
// ponytail: mapa estático; se o Hub mudar rotas, atualize aqui (o passo cai em clique por texto quando a página não existe no mapa).

export const HUB_PAGES = {
  'Inicial': '/home',
  'Minha escola': '/my-school',
  'Implantação e cadastro': '/my-school/customer-dashboard',
  'Marketing': '/my-school/marketing',
  'Serviços': '/my-school/services',
  'Planos de uso': '/my-school/usage-plans',
  'Financeiro': '/my-school/billing',
  'Documentos úteis': '/my-school/useful-documents',
  'Relatórios': '/reports',
  'Avaliações': '/assessments',
  'Minhas avaliações': '/assessments/my-assessments',
  'Minhas questões': '/assessments/my-questions',
  'Banco de avaliações': '/assessments/assessment-bank',
  'Banco de questões': '/assessments/question-bank',
  'Nova avaliação': '/assessments/form',
  'Avaliações aplicadas': '/assessments/applied-assessments',
  'Gerenciamento de dados': '/data-management',
  'Meus usuários': '/data-management/my-users',
  'Níveis de ensino e turmas': '/data-management/levels-and-classes',
  'Minhas importações': '/data-management/my-imports',
  'Minhas exportações': '/data-management/my-exports',
  'Configuração de acesso': '/data-management/access-configuration',
  'Configuração de segurança': '/data-management/security-configuration',
  'Acompanhamento de cadastros': '/data-management/onboarding',
  'Vitrine': '/data-management/banner',
  'Notificações personalizadas': '/data-management/notification',
  'Monitoora': '/monitoora',
  'Mesa Educacional': '/mesa-educacional/overview',
};

// Filtros do Banco de questões: rótulo do campo → opções reais (amostra). O padrão "Selecione" já encontra esses campos.
export const HUB_FILTERS = {
  'Banco de questões': {
    'banco': ['Todas as questões', 'Questões da minha escola', 'Questões do Educacional'],
    'tipo de questão': ['Todos os tipos', 'Resposta única', 'Resposta múltipla', 'Dissertativa'],
    'grau de facilidade': ['Fácil', 'Médio', 'Difícil', 'Muito difícil', 'Todos os graus'],
    'disciplina': ['Biologia', 'Ciências', 'Educação Física', 'Filosofia', 'Física'],
    'ano escolar': ['1º ano', '2º ano', '5º ano', '9º ano', '1ª Série', '3ª Série'],
  },
  'Minhas questões': {
    'tipo de questão': ['Todos os tipos', 'Resposta única', 'Resposta múltipla', 'Dissertativa'],
  },
  'Meus usuários': {
    'perfil': ['Administrador', 'Professor', 'Estudante'],
  },
};

// Filtros que a página guarda na URL: o robô abre o endereço já filtrado em vez de usar o campo.
// Só valores confirmados no QA; o que não estiver aqui usa o campo normalmente.
export const HUB_URL_FILTERS = {
  '/assessments/question-bank': {
    search: 'search',
    'grau de facilidade': { param: 'difficultyLevel', values: { 'Fácil': '1' } },
  },
};

// Ações dos cartões de questão: os ícones não têm nome acessível, então o robô localiza pela posição no cartão.
// Banco de questões: 1 ícone (atribuir). Minhas questões (questões da própria escola): atribuir e remover.
export const HUB_CARD_ACTIONS = { atribuir: 'first', remover: 'last', excluir: 'last' };

// Textos reais de tela, úteis nas verificações
export const HUB_TEXTS = {
  'Banco de questões · busca sem resultado': 'Não há resultados para esta busca!',
  'Atribuir questão · título do modal': 'Atribuir questão em uma avaliação',
  'Atribuir questão · confirmar': 'Aplicar avaliação',
  'Atribuir questão · campo': 'Selecione a avaliação',
  'Remover questão · título do diálogo': 'Remover Questão',
  'Remover questão · confirmar': 'Sim, quero remover',
};

// Comportamentos observados que afetam cenários
export const HUB_NOTES = [
  'Remover só existe para questões da própria escola, em "Minhas questões" (não no Banco de questões).',
  'Atribuir lista só avaliações não publicadas; em 29/09/2026 todas as avaliações do QA estavam publicadas, então a lista vinha "Sem opções".',
  'Avaliações exige tela grande (o robô roda em 1920x1080).',
  'Perfil Estudante não acessa Avaliações/Banco de questões: o Hub mostra "Sem permissão para acessar o recurso" e uma lista vazia. Cenários de Avaliações precisam de professor ou administrador.',
  'Filtros do Banco de questões vão para a URL: ?search=, ?difficultyLevel= (Fácil=1), ?disciplineCode=, &page=.',
];

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const BY_NORM = Object.fromEntries(Object.entries(HUB_PAGES).map(([name, path]) => [norm(name), path]));

// "banco de questoes" → "/assessments/question-bank"; null se desconhecida
export const hubPath = name => BY_NORM[norm(name)] ?? null;

// Bloco de conhecimento para o prompt do gerador
export const HUB_KNOWLEDGE_PROMPT = `Conhecimento do Hub Educacional (use para escrever passos concretos em vez de [informe: ...]):
- Páginas que o robô abre direto com o passo Acesse "<página>": ${Object.keys(HUB_PAGES).join(', ')}.
- Filtros do Banco de questões (use Selecione "<opção>" no campo "<filtro>"): ${Object.entries(HUB_FILTERS['Banco de questões']).map(([f, o]) => `${f}: ${o.join(' / ')}`).join('; ')}.
- Filtros de outras páginas: ${Object.entries(HUB_FILTERS).filter(([p]) => p !== 'Banco de questões').map(([p, fs]) => `${p} → ${Object.entries(fs).map(([f, o]) => `${f}: ${o.join(' / ')}`).join('; ')}`).join(' | ')}.
- Ações em um cartão de questão (ícones sem texto): escreva exatamente Na primeira questão, clique em "Atribuir" ou Na primeira questão, clique em "Remover" (troque "primeira" por segunda, terceira...).
- Textos reais de tela: ${Object.entries(HUB_TEXTS).map(([k, v]) => `${k} = "${v}"`).join('; ')}.
- Observações: ${HUB_NOTES.join(' ')}`;
