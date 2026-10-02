# Hub Educacional (QA): mapa do site

Levantamento feito navegando em `https://qa-hub.educacional.com` entre 24/09 e 30/09/2026. A maior parte foi vista com um perfil **Administrador** da escola de teste "Escola do Bernardino QA"; o perfil **Estudante** foi visto com o usuário de teste do robô.

Nada foi salvo, enviado ou removido durante o levantamento. Diálogos de ação (atribuir, remover) foram abertos e cancelados.

> **Legenda:** ✅ visto e confirmado · 🔎 hipótese a partir do comportamento observado · ⬜ existe, mas não foi explorado por dentro.

O mesmo conhecimento, em formato que o robô usa, está em [`src/lib/hub-knowledge.js`](../src/lib/hub-knowledge.js).

---

## 1. Visão geral

- **App de página única (SPA):** os menus são botões, não links (`<a href>`). Trocar de página muda a URL sem recarregar.
- **Ambientes:** QA em `qa-hub.educacional.com`, produção em `hub.educacional.com`. O fluxo de login é o mesmo nos dois.
- **Título da aba:** segue o padrão `<Página> | Hub Educacional` (ex.: `Login | Hub Educacional`, `Inicial | Hub Educacional`, `Meus usuários | Hub Educacional`).
- **Tela mínima:** algumas áreas (ex.: Avaliações) mostram *"Você pode apenas visualizar em telas maiores · Este recurso não está disponível nesta resolução de tela"* em janelas estreitas. ✅
- **Banner de cookies:** aparece no rodapé em todas as telas até ser respondido, com os botões **RECUSAR COOKIES** e **ENTENDI**.
- **Rodapé:** "Hub Educacional | Verificador de requisitos do sistema | Termos de Uso | Privacidade".

---

## 2. Login (`/`)

Título: **"Para continuar, insira seu login"**.

| Elemento | Detalhes |
|---|---|
| **E-mail ou Usuário de Acesso \*** | Campo de texto. Aceita usuário ou e-mail. |
| **Senha \*** | Campo de senha, com ícone de olho para mostrar/ocultar. |
| **Que escola você quer acessar?** | Autocomplete com ícone de lupa (campo `name="organizationId"`). **Só aparece para alguns usuários**, depois de usuário e senha. É obrigatório quando aparece ("Este campo é obrigatório"). Busca no servidor: mostra *"Buscando…"* e depois as opções, ou *"Sem opções"*. ✅ |
| **Esqueci minha senha** | Botão secundário. ⬜ |
| **Avançar** | Botão principal (`type="submit"`). Fica desabilitado enquanto falta a escola. Mostra um spinner durante o envio. ✅ |
| **Logins alternativos** | Continue com Google · Continue com Microsoft · Acesso via QR Code · Acesso Rápido. ⬜ |

**Comportamentos observados:**
- **Escola depende do tipo de login:** com **usuário**, a escola é pedida depois da senha; com **e-mail**, o login segue direto, sem esse campo. ✅
- **Lista de escolas por usuário:** a lista de escolas é específica de cada usuário, e um usuário sem escola vinculada naquele ambiente vê "Sem opções". ✅
- **Destino:** depois do login, a URL vai para `/home` e o título para `Inicial | Hub Educacional`. ✅

---

## 3. Estrutura comum (após o login)

### Menu lateral (perfil Administrador) ✅

| Item | Rota |
|---|---|
| Inicial | `/home` |
| Minha escola | `/my-school` |
| Relatórios | `/reports` |
| Avaliações | `/assessments` |
| Gerenciamento de dados | `/data-management` |
| Monitoora | `/monitoora` |
| Mesa Educacional | `/mesa-educacional/overview` |

- **Recolher menu:** o botão **Contrair menu** recolhe o menu lateral.
- **Cartão do usuário:** no rodapé do menu aparecem nome, perfil (ex.: "Administrador", "Estudante") e escola atual, com as ações **Configurações**, **Notificações** e **Sair**. ⬜
- **Perfil Estudante:** o menu mostra só **Inicial**, e em produção também "Minhas avaliações". ✅

### Cabeçalho

- **Título:** título da página, com seta de voltar nas subpáginas.
- **Busca de aplicativos:** campo "Nome do Aplicativo" (na Inicial).
- **Filtro:** "Ano escolar" (padrão "Todos os anos", na Inicial).
- **Notificações:** sino, com indicador de novidade.
- **Login Suporte:** botão no topo das páginas internas. Contém um reCAPTCHA. ⬜ Não explorado, por ser acesso de suporte.

---

## 4. Inicial (`/home`) ✅

- **Saudação:** *"Olá, <Nome>! Seja bem-vindo(a) ao Hub Educacional!"* e a data por extenso ("24 de setembro de 2026").
- **Carrossel:** banners com setas ‹ ›. O conteúdo vem de **Vitrine**, em Gerenciamento de dados.
- **Aplicações Integradas:** cartões de aplicativo com nome e descrição curta. No QA, com Administrador:
  - **Ferramentas:** MyLab, Colab, StoryLab, IdeaLab, MediaLab.
  - **Plataformas educacionais:** AgendaEdu Alunos, Aprimora QA, Central Aprimora QA, Code Builder, LearnLab, Maria SESI, Nexis, Pense+ DEV, Pense+ QA.
  - **Outros:** POC – Professor Digital, Robomind By Hub, Robotis QA, Teste, Web builder, Write and Read.
- **Novidades Hub:** seção de novidades. ⬜
- **Perfil Estudante:** vê outros cartões (ex.: em produção, "Nexis" e "Robotis 2025").

---

## 5. Minha escola (`/my-school`) ✅

Página de cartões. Cada cartão leva a uma subpágina:

| Cartão | Descrição no cartão | Rota |
|---|---|---|
| Implantação e cadastro | Acompanhe a liberação de acessos e a disposição… | `/my-school/customer-dashboard` |
| Marketing | Acesse materiais e conteúdos sobre as aplicações da escola. | `/my-school/marketing` |
| Serviços | Acompanhe ou solicite visitas, formações e eventos… | `/my-school/services` |
| Planos de uso | Crie metas de uso para as aplicações e acompanhe o engajamento… | `/my-school/usage-plans` |
| Financeiro | Consulte faturas e baixe os boletos de pagamento dos serviços… | `/my-school/billing` |
| Documentos úteis | Baixe documentos sobre serviços e aplicações contratadas… | `/my-school/useful-documents` |

O conteúdo interno das subpáginas não foi explorado. ⬜

---

## 6. Relatórios (`/reports`) ✅

- **Abas:** **Visão Geral**, **Acessos** e **Gerencial**. Trocar de aba **não muda a URL**: tudo fica em `/reports`.
- **Conteúdo:** os gráficos e filtros de cada aba não foram catalogados. ⬜

---

## 7. Avaliações (`/assessments`) ✅

Página de cartões. **Exige tela grande.**

| Cartão | Descrição | Rota |
|---|---|---|
| Minhas avaliações | Monte, edite e acompanhe as avaliações que você criou. | `/assessments/my-assessments` |
| Minhas questões | Consulte e gerencie as questões que você criou. | `/assessments/my-questions` |
| Banco de avaliações | Explore avaliações compartilhadas por outros professores. | `/assessments/assessment-bank` |
| Banco de questões | Explore questões compartilhadas por outros professores. | `/assessments/question-bank` |
| Avaliações aplicadas | Acompanhe as avaliações já aplicadas às turmas. | `/assessments/applied-assessments` |

O **perfil Estudante não acessa** esta área. O Hub mostra um aviso amarelo, *"Sem permissão para acessar o recurso: Listar avaliações"* (ou *"…Listar habilidades da BNCC"*), e uma lista vazia. ✅

### 7.1 Banco de questões (`/assessments/question-bank`) ✅

- **Topo:** título "Banco de questões" e o botão **Criar nova questão** ⬜.
- **Opções de filtragem:** todos os filtros são autocompletes; o valor padrão aparece já preenchido.

| Filtro (rótulo) | Valor padrão | Opções observadas |
|---|---|---|
| Selecionar por banco | Todas as questões | Todas as questões · Questões da minha escola · Questões do Educacional |
| Selecionar por tipo de questão | Todos os tipos | Todos os tipos · Resposta única · Resposta múltipla · Dissertativa |
| Selecionar por disciplina | "Todos as escola" (sic) | ~20 disciplinas cadastradas no QA (ex.: Biologia, Ciências, Educação Física, Filosofia, Física, Cálculo 1/2/3…) |
| Selecionar por Habilidade BNCC | (vazio) | Lista longa de habilidades da BNCC, com o texto completo |
| Selecionar por ano escolar | "Todos as escola" (sic) | Grupo 1–5 · 1º–9º ano · 1ª–3ª Série · EJA EF 1/EF 2/EM · versões "Esp" (Grupo 1 Esp…, 1º ano Esp…) |
| Selecionar por grau de facilidade | Todos os graus | Fácil · Médio · Difícil · Muito difícil · Todos os graus |
| Buscar... | (vazio) | Busca por texto. Dispara com **Enter**. |

O rótulo padrão **"Todos as escola"** em disciplina e ano escolar parece um erro de texto do produto.

- **Filtros na URL:** a URL guarda os filtros, o que permite abrir a página já filtrada. ✅

  | Parâmetro | Exemplo | Confirmado |
  |---|---|---|
  | `search` | `?search=zzz-sem-resultado-teste` | ✅ |
  | `difficultyLevel` | `?difficultyLevel=1` (Fácil) | ✅ só para Fácil |
  | `disciplineCode` | código interno da disciplina | ✅ existe; valores não mapeados |
  | `page` | `&page=1` | ✅ |

- **Listagem:** seção "Questões", com cartões paginados (1, 2, 3, 4, 5, …, 9).
  - **Título do cartão:** "Questão N" ou "Questão com IA N".
  - **Conteúdo:** enunciado e alternativas A, B, C, D. A correta aparece destacada em verde, com check.
  - **Ícone:** um único ícone no canto superior direito, **Atribuir questão**.
- **Estado vazio:** *"Não há resultados para esta busca!"*, com a ilustração de um robô. ✅
- **Atribuir questão** (ícone do cartão), modal ✅:
  - **Título:** *"Atribuir questão em uma avaliação"*.
  - **Texto:** nome da questão e *"Indique qual avaliação deseja incluir esta questão."*
  - **Campo:** autocomplete **"Selecione a avaliação"**.
  - **Botões:** **Cancelar** · **Aplicar avaliação**.
  - **Lista "Sem opções":** no QA, todas as avaliações existentes estavam *Publicadas*. 🔎 O modal deve listar só avaliações não publicadas (rascunho).
- **Remover questão:** **não existe** no Banco de questões. A ação fica em "Minhas questões".

### 7.2 Minhas questões (`/assessments/my-questions`) ✅

- **Topo:** **Criar nova questão**.
- **Filtros:** **Selecionar por tipo de questão** e **Buscar...**.
- **Cartões:** mesmo formato do Banco de questões (título, enunciado, alternativas), mas com **dois ícones**:
  1. **Primeiro ícone: Atribuir.** Abre o mesmo modal "Atribuir questão em uma avaliação".
  2. **Último ícone: Remover.** Abre a confirmação abaixo.
- **Diálogo de remover:**
  - **Título:** **"Remover Questão"**.
  - **Texto:** *"Tem certeza que deseja remover a questão <título>"*.
  - **Botões:** **Cancelar** · **Sim, quero remover**.

### 7.3 Minhas avaliações (`/assessments/my-assessments`) ✅

- **Topo:** **Montar nova avaliação**.
- **Filtros:** **Filtrar por status**, **Selecionar ordenação** e **Buscar...**.
- **Tabela:** colunas **Avaliação · Disciplina · Criado em · Status**. No QA, as 3 avaliações estavam com status "Publicado".

### 7.4 Nova avaliação (`/assessments/form`) ✅

Assistente em 3 etapas: **1 Configurações gerais → 2 Questões → 3 Pré-visualização**. A navegação no topo diz "Visão geral › Nova avaliação". Botões: **Cancelar** e **Próximo**.

Etapa 1 (Configurações gerais), com "\* Campo de preenchimento obrigatório":

| Campo | Obrigatório | Observação |
|---|---|---|
| Título | ✔ | texto |
| Descrição da avaliação | — | texto |
| Selecione uma disciplina | ✔ | autocomplete, mesma lista de disciplinas do Banco de questões |
| Guardar no banco de avaliações | — | opção liga/desliga |
| **Configurações de tempo da avaliação:** | | |
| Adicionar tempo de avaliação | — | liga os campos de tempo |
| Insira o tempo da avaliação | ✔ | lista de tempos, ativa com a opção acima |
| Tempo de leitura (opcional) | — | |
| Exibir aviso quando o tempo da atividade estiver próximo do final | — | opção |
| Selecione o tempo de aviso antes do final | ✔ | ativa com a opção acima |
| Permitir pausar a avaliação | — | opção |
| Exibir aviso de inatividade após tempo de ociosidade | — | opção |
| Selecione o tempo de inatividade | ✔ | ativa com a opção acima |

As etapas 2 e 3 não foram exploradas, porque exigiriam preencher e avançar. ⬜

### 7.5 Banco de avaliações e Avaliações aplicadas ⬜

Rotas conhecidas (`/assessments/assessment-bank`, `/assessments/applied-assessments`); conteúdo não explorado.

---

## 8. Gerenciamento de dados (`/data-management`) ✅

Página de cartões:

| Cartão | Descrição | Rota |
|---|---|---|
| Meus usuários | Gerencie seus usuários | `/data-management/my-users` |
| Níveis de ensino e turmas | Defina o ano letivo, disciplinas e turmas… | `/data-management/levels-and-classes` |
| Minhas importações | Envie arquivos de planilhas para cadastros em massa | `/data-management/my-imports` |
| Minhas exportações | Baixe arquivos de planilhas de cadastros de usuário… | `/data-management/my-exports` |
| Configuração de acesso | Distribua acessos e permissões | `/data-management/access-configuration` |
| Configuração de Segurança | Defina o nível de permissões e restrições… | `/data-management/security-configuration` |
| Acompanhamento de Cadastros | Acompanhamento de escolas e redes… | `/data-management/onboarding` |
| Vitrine | Crie e gerencie os destaques da tela inicial do Hub… | `/data-management/banner` |
| Notificações personalizadas | Crie mensagens para notificar os usuários… | `/data-management/notification` |

### 8.1 Meus usuários (`/data-management/my-users`) ✅

- **Topo:** **Novo usuário** ⬜. Navegação: "Visão geral › Meus usuários".
- **Filtros:** **Selecionar perfil** (Administrador · Professor · Estudante, entre outros possíveis), **Vínculos de usuários** e **Buscar...**.
- **Tabela:** colunas **Nome do usuário · Código/Matrícula · Uso de imagem · Perfis**. Valores de "Uso de imagem" vistos: "Permite". Paginação longa (até 120 páginas no QA).

Os dados pessoais dos usuários listados não foram registrados.

As demais subpáginas de Gerenciamento de dados não foram exploradas por dentro. ⬜

---

## 9. Monitoora (`/monitoora`) ⬜

Rota confirmada. Mostra só a estrutura padrão (cabeçalho, Login Suporte); o conteúdo não foi catalogado.

## 10. Mesa Educacional (`/mesa-educacional/overview`) ✅

- **Título:** o título da aba aparece como "Monitoora | Hub Educacional".
- **Abas:** **Visão Geral** · **Engajamento** · **Estudantes**.
- **Filtros de período:** **Data de início \*** (`startDate`) e **Data de término \*** (`endDate`).

---

## 11. Perfis e permissões observados

| Perfil | O que foi visto |
|---|---|
| **Administrador** | Menu completo (seção 3). Acessa Avaliações, Banco de questões, Gerenciamento de dados etc. |
| **Estudante** | Menu reduzido (Inicial). Em Avaliações e Banco de questões aparece "Sem permissão para acessar o recurso: …" e a tela fica vazia. |
| **Professor** | Existe (aparece na tabela de usuários), mas não foi navegado. ⬜ |

**Atenção para testes:** a tela vazia exibida por falta de permissão é **igual** ao estado vazio de uma busca sem resultado. Um teste que só verifica o texto vazio pode passar por engano. O robô do projeto já trata isso: falha quando aparece "Sem permissão".

---

## 12. Notas técnicas para automação

| Característica | Impacto | Como o robô lida |
|---|---|---|
| Menus são botões, sem `href` | Não dá para extrair rotas dos links | Mapa de rotas fixo em `hub-knowledge.js` |
| Rótulos sem `for`: o `<label>` é irmão do `<input>` | `getByLabel` não encontra os campos | Busca o input no menor bloco que contém o texto do rótulo |
| Opções de autocomplete em popup `Portal-PopperWrapper`, sem `role="option"` | Clicar por texto pode acertar outro elemento igual | Clique restrito ao popup |
| Autocompletes que buscam no servidor ("Buscando…") | Clicar cedo demais falha | Espera o "Buscando…" sumir |
| Busca dispara só com Enter | Preencher o campo não basta | Pressiona Enter, ou usa `?search=` na URL |
| **Ícones de ação sem nome acessível** (sem `aria-label`/`title`) | Impossível clicar por texto; também prejudica leitores de tela | Localiza pela posição no cartão (1º = atribuir, último = remover) |
| `data-testid` em alguns componentes (ex.: `TextField-Input-organizationId`, `IconButton-Container-AppBar-GoBack`) | Bons pontos de apoio para seletores estáveis | Ainda não usados |
| Placeholders vazios (`placeholder=" "`) | Seletores por placeholder não funcionam | Usa o rótulo |
| Avisos (toasts) de permissão no canto superior direito | Indicam falta de acesso sem mudar a URL | Detectados após a navegação |
| Requisito de tela grande em Avaliações | Testes em telas pequenas falham | O robô roda em 1920×1080 |

**Sugestões para o time do Hub:**
1. Adicionar `aria-label` aos botões de ícone (atribuir, remover, voltar), o que melhora a acessibilidade e a automação.
2. Ligar os `<label>` aos campos (`for`/`id`).
3. Usar `role="option"` nas opções dos autocompletes.
4. Corrigir o texto padrão "Todos as escola" nos filtros de disciplina e ano escolar.

---

## 13. O que ainda não foi explorado

- **Login:** Esqueci minha senha e os logins alternativos (Google, Microsoft, QR Code, Acesso Rápido).
- **Criar nova questão:** o formulário inteiro.
- **Nova avaliação:** as etapas 2 e 3.
- **Avaliações:** Banco de avaliações e Avaliações aplicadas.
- **Minha escola:** as subpáginas por dentro.
- **Relatórios:** as abas por dentro.
- **Gerenciamento de dados:** as subpáginas além de Meus usuários (importações e exportações envolvem arquivos).
- **Monitoora:** a página por dentro.
- **Mesa Educacional:** as abas Engajamento e Estudantes.
- **Cartão do usuário:** Configurações, Notificações e troca de escola/perfil.
- **Ação "reportar questão":** citada nos critérios da história do Banco de Questões, mas **não encontrada** em nenhum cartão com o perfil Administrador.
- **Valores dos filtros na URL:** os de `difficultyLevel` além de Fácil, `disciplineCode` e os parâmetros de banco, tipo e ano escolar.
