# PROJECT STATUS — Automação de Testes E2E com n8n + Playwright + ClickUp

**Última atualização:** 2026-10-05  
**Status:** ✅ Fase de integração completa  
**Branch:** `master` (pronto para deploy)

---

## 📋 Visão Geral do Projeto

Sistema automatizado de testes end-to-end que conecta:
```
ClickUp → n8n → Next.js API → Playwright → ClickUp
```

**Objetivo:** Eliminar testes manuais. Gerar BDD cenários automaticamente, executá-los com Playwright e reportar resultados de volta no ClickUp com comentários, tags e evidências.

---

## 🏗️ Arquitetura

### Componentes Principais

1. **Next.js API** (`src/app/api/run-test/route.js`)
   - Endpoint: `POST /api/run-test`
   - Autenticação: `RUN_TEST_TOKEN` (Bearer token)
   - Recebe: `{ url, steps, source }`
   - Retorna: `{ success, failedStep, stepEvidences, error }`
   - Executa testes com Playwright dinamicamente
   - Classifica passos em padrões nativos vs fallback IA

2. **Frontend Dashboard** (`src/app/page.js`)
   - URL presets: QA Hub, Produção Hub, Outro endereço
   - Parser de passos (texto livre → passos estruturados)
   - Histórico de testes (filtrado por origem)
   - Geração com IA (Claude/Gemini)
   - Organização de histórias com múltiplos cenários

3. **n8n Workflow**
   - 4 branches paralelas (uma por squad/time)
   - Webhook ClickUp: dispara ao adicionar tarefa com label `qa-test`
   - Fluxo: Parse → Generate BDD → Validate Steps → Run E2E → Report
   - Pós-processamento: extrai credenciais reais e injeta nos passos

4. **ClickUp Integration**
   - Posta comentários com resultados
   - Atualiza status da tarefa (`completed` se OK, `open` se falhar)
   - Adiciona tags (`QA-PASSED` ou `QA-FAILED`)
   - *(Pendente)* Anexa evidências (prints, vídeos)

---

## 🔧 Configuração Necessária

### Variáveis de Ambiente (`.env`)

```env
# Segurança
RUN_TEST_TOKEN=d7f0416463516586641fe4bf769de7a8e47a56e38907b551b2a286d63e906ad3

# IA (opcional — testes nativos funcionam sem)
ANTHROPIC_API_KEY=sk-ant-...  # para fallback Claude
GEMINI_API_KEY=AQ.Ab8RN...    # preferência para geração BDD

# Credenciais QA
QA_USER=Eva001
QA_PASS=Teste@25
QA_ESCOLA=Instituição do Matheus - vinculada
```

### Dependências

```bash
npm install
npx playwright install chromium
```

### Gerar token forte (para deploy)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🎯 Padrões Nativos Suportados

Cada padrão **custa 0 créditos de token**, pois é executado via Playwright puro (sem IA):

| Tipo | Exemplo | Custo |
|---|---|---|
| **Login** | `Preencha os campos de login com usuário "Eva001" e senha "Teste@25" e clique em Entrar` | ✅ 0 |
| **Seleção** | `Selecione "Opção" no campo "Campo"` | ✅ 0 |
| **Clique** | `Clique no botão "Avançar"` | ✅ 0 |
| **Busca** | `Busque por "termo"` | ✅ 0 |
| **Verificar texto** | `Verifique se o texto "Bem-vindo" está sendo exibido` | ✅ 0 |
| **Verificar título** | `Verifique se o título da página contém "Hub"` | ✅ 0 |
| **Verificar URL** | `Verifique se a tela /inicial está sendo exibida` | ✅ 0 |
| **Navegação Hub** | `Acesse "Banco de questões"` | ✅ 0 |
| **Ação em card** | `Clique em "Remover" na questão 2` | ✅ 0 |
| **CPF válido** | `Preencha um CPF válido no campo "cpf"` | ✅ 0 |
| **Fallback IA** | *(qualquer texto que não case acima)* | ⚠️ 1+ |

### Credenciais Seguras (sem expor no log)

Use `{{QA_*}}` em vez de valores literais. O runner resolve só na execução:

```
Preencha os campos de login com usuário "{{QA_USER}}" e senha "{{QA_PASS}}" e clique em Entrar
```

Valor real **nunca** entra no código, logs ou histórico. Válido em: usuário, senha, busca, seleção.

### Login Padrão

Escreva apenas `faça login` e o runner usa `QA_USER`/`QA_PASS` + `QA_ESCOLA` automaticamente.

---

## 🔄 n8n Workflow — Estrutura Completa

### Trigger
- **Webhook ClickUp:** dispara ao criar/editar tarefa com label `qa-test`
- Payload: task ID, descrição, assignado, labels

### Branch 1: Parse & Classify
```
ClickUp Webhook 
  → Extract Task (nome, descrição, URL)
  → Text Split (separa passos por `|` ou quebra de linha)
  → Filter Dado/Quando/Então (remove linhas de contexto)
  → Output: array de passos puros
```

### Branch 2: Generate BDD (IA)
```
Input: descrição da tarefa
  → Prompt Claude/Gemini: "Gere cenário BDD em Gherkin"
  → Post-processing Code Node: "Validate & Inject Steps"
      • Extrai credenciais reais da descrição
      • Valida padrões contra classifyStep()
      • Injeta {{QA_USER}}, {{QA_PASS}}, {{QA_ESCOLA}} onde faltam
      • Mapeia páginas pelo hub-knowledge.js
  → Output: passos validados, prontos para execução
```

### Branch 3: Run E2E Test
```
Input: URL, array de passos
  → HTTP POST (com Bearer token)
     • URL: https://360d-201-58-72-230.ngrok-free.app/api/run-test
     • Header: Authorization: Bearer d7f0416...
     • Body: { url, steps, source: "n8n" }
  → Parse Response: { success, failedStep, stepEvidences, error }
  → Timeout: 180s (Playwright timeout dentro de cada passo)
  → Output: resultado com evidências (URLs dos prints)
```

### Branch 4: Post Result to ClickUp
```
If success == true:
  → Comment: "✅ Testes passaram! 🎉"
  → Update Status: completed
  → Add Tag: QA-PASSED
Else:
  → Comment: "❌ Falha no passo X: [erro]"
  → Update Status: open
  → Add Tag: QA-FAILED

*(Pendente)*
  → Upload evidências (vídeo do passo X + prints)
```

---

## 🌐 ngrok — Exposição Pública

**URL atual:** `https://360d-201-58-72-230.ngrok-free.app`

### Configuração Necessária

```bash
# Instalar ngrok (primeira vez)
npm install -g ngrok
# ou
choco install ngrok  # Windows

# Rodar servidor Next.js
npm run dev  # escuta em http://localhost:3000

# Em outro terminal, expor com ngrok
ngrok http 3000 --skip-browser-warning
```

**⚠️ Importante:**
- ngrok gera URL **única a cada restart**
- Quando URL mudar, **atualizar em n8n**: `HTTP POST` → body URL
- Autorização já dada para fazer isso (standing OK)
- Frontend não precisa de ngrok quando em rede local

---

## 🔐 Autenticação — RUN_TEST_TOKEN

### Sem Token (Desenvolvimento Local)
API aceita requisições sem `Authorization`. Padrão quando `.env` não tem `RUN_TEST_TOKEN`.

### Com Token (Deploy / n8n Remoto)
Token obrigatório em todas as requisições:

```
Authorization: Bearer d7f0416463516586641fe4bf769de7a8e47a56e38907b551b2a286d63e906ad3
```

**Resposta sem token:**
```json
{
  "error": "Não autorizado: envie o header Authorization: Bearer <RUN_TEST_TOKEN>.",
  "status": 401
}
```

---

## 📊 Histórico de Testes

### Armazenamento
- Arquivo: `data/history.jsonl` (append-only)
- Campos: timestamp, url, steps (com senhas mascaradas), result, source (ui/n8n/api)
- Formato: 1 JSON por linha

### Acesso
- **Endpoint:** `GET /api/history`
- **Autenticação:** Bearer token (mesmo do `/api/run-test`)
- **Filtro:** por origem (todos / ui / n8n)
- **Interface:** Dashboard → Histórico de testes

### Evidências
- **Prints:** `public/evidences/evidencia_<testId>_<stepIndex>.png`
- **Vídeos:** `public/evidences/video_<testId>.webm` (Playwright test mode)
- **Retenção:** permanente (limpeza manual se necessário)

---

## 🛠️ Frontend — Dashboard (src/app/page.js)

### Funcionalidades Principais

1. **URL Presets**
   ```javascript
   const URL_PRESETS = [
     { label: 'QA Hub', value: 'https://qa-hub.educacional.com/' },
     { label: 'Produção Hub', value: 'https://hub.educacional.com/' },
     { label: 'Outro endereço', value: '' },
   ];
   ```

2. **Parser de Passos**
   - Separa por `|` ou quebra de linha
   - Classifica cada passo com `classifyStep()`
   - Mostra status: Pronto (nativo) / Precisa de dados / Não suportado

3. **Geração com IA** (`POST /api/generate-steps`)
   - Input: texto livre ou Gherkin
   - Output: passos reescritos nos padrões nativos
   - Warnings: oque foi corrigido, oque falta
   - Modelo: Gemini Flash (fallback: Claude)

4. **Organização de Histórias**
   - Separa cenários múltiplos
   - Marca status cada um (Pronto/Precisa dados/Não suportado)
   - Campo "Antes de cada cenário": login + navegação até tela

5. **Histórico Filtrado**
   - Mostra ultimas 50 execuções
   - Filtro: todos / interface / n8n
   - Re-executa teste selecionando una execução anterior

---

## 📝 API Endpoints

### `POST /api/run-test`

**Requisição:**
```json
{
  "url": "https://qa-hub.educacional.com/",
  "steps": [
    "Preencha os campos de login com usuário \"{{QA_USER}}\" e senha \"{{QA_PASS}}\" e clique em Entrar",
    "Selecione \"Instituição do Matheus - vinculada\" no campo \"escola\"",
    "Clique no botão \"Avançar\"",
    "Verifique se o texto \"Seja bem-vindo(a) ao Hub Educacional\" está sendo exibido"
  ],
  "source": "n8n"
}
```

**Resposta (sucesso):**
```json
{
  "success": true,
  "failedStep": null,
  "stepEvidences": [
    "evidencia_1234567890_0.png",
    "evidencia_1234567890_1.png",
    "evidencia_1234567890_2.png",
    "evidencia_1234567890_3.png"
  ],
  "duration": 15.3
}
```

**Resposta (falha):**
```json
{
  "success": false,
  "failedStep": 2,
  "error": "Timeout waiting for text 'Bem-vindo'",
  "stepEvidences": [
    "evidencia_1234567890_0.png",
    "evidencia_1234567890_1.png"
  ],
  "duration": 8.7
}
```

### `GET /api/history`

**Query params:**
- `filter=todos|ui|n8n` (default: todos)

**Resposta:**
```json
{
  "runs": [
    {
      "timestamp": "2026-10-05T14:30:00.000Z",
      "url": "https://qa-hub.educacional.com/",
      "source": "n8n",
      "success": true,
      "failedStep": null,
      "duration": 15.3,
      "steps": ["[passo 1]", "[passo 2]", "..."]
    }
  ]
}
```

### `POST /api/generate-steps`

**Requisição:**
```json
{
  "text": "Cenário 1: Fazer login\nDado que estou na tela de login\nQuando preencho usuário e senha\nEntão vejo o Hub",
  "url": "https://qa-hub.educacional.com/",
  "lang": "pt-BR"
}
```

**Resposta:**
```json
{
  "scenarios": [
    {
      "title": "Fazer login",
      "status": "ready",
      "steps": ["Preencha os campos de login..."],
      "notes": []
    }
  ],
  "warnings": ["Passo 'Quando...' foi reescrito"],
  "steps": ["Preencha os campos de login..."]
}
```

---

## ⚙️ Internals — Como Funciona

### Classificação de Passos (`src/lib/steps.js`)

```javascript
classifyStep(stepText) → {
  kind: 'login' | 'select' | 'click' | 'search' | 'verifyText' | 'verifyTitle' | 'goto' | 'cardAction' | 'cpf' | 'fallback',
  field?: string,
  value?: string,
  user?: string,
  pass?: string,
  title?: boolean,
  page?: string,
  action?: string,
  ...
}
```

Cada padrão possui regex específicos em `PATTERNS` objeto. Regex com `i` (case-insensitive) + lookahead/lookbehind para maior robustez.

### Geração Dinâmica de Teste (`src/app/api/run-test/route.js`)

1. Classifica cada passo
2. Gera código Playwright no template de cada `kind`
3. Injeta valores de `{{QA_*}}` via função `envValue()`
4. Cria arquivo temporário `dynamic_test_<testId>.spec.js`
5. Executa com `playwright test --reporter=list`
6. Coleta prints em `evidencia_<testId>_<stepIndex>.png`
7. Limpa arquivo temporário
8. Retorna resultado

### Conhecimento do Hub (`src/lib/hub-knowledge.js`)

Mapeia URLs e filtros do QA Hub (levantamento manual):

```javascript
HUB_ROUTES = {
  'Banco de Questões': '/banco-de-questoes',
  'Histórico': '/historico',
  ...
}

HUB_URL_FILTERS = {
  '/banco-de-questoes': ['search', 'subject', 'level', 'type']
}
```

Se passo menciona página conhecida, abre URL diretamente. Senão, clica no menu.

---

## 📈 Status Atual — O que Funciona

✅ **100% Funcional:**
- [x] API de teste (`/api/run-test`) com autenticação
- [x] Padrões nativos (9 tipos = 0 custo)
- [x] Frontend dashboard com parser
- [x] Histórico persistente em `data/history.jsonl`
- [x] ngrok + URL pública
- [x] RUN_TEST_TOKEN bearer authentication
- [x] Pós-processamento básico no n8n (validate & inject)
- [x] Código commitado e pushado ao git

⚠️ **Em Andamento:**
- [ ] Attachment uploads (vídeo/prints) para ClickUp
- [ ] Retry automático para falhas transientes
- [ ] Squad Classifier determinístico em n8n
- [ ] Teste de ponta a ponta com dados reais do QA

---

## 🚀 Próximos Passos

### Curto Prazo (esta semana)
1. **Testar n8n com dados reais** (Eva001 no QA Hub, 7:30-10:00)
2. **Implementar anexação de evidências** no ClickUp comment
3. **Validar fluxo completo** (ClickUp → n8n → teste → resultado)

### Médio Prazo (próximas semanas)
1. **Generalizar para múltiplos usuários** (não só Eva001)
2. **Implementar retry com exponential backoff**
3. **Criar dashboard de métricas** (taxa de sucesso, tempo médio)
4. **Documentar manual de uso** para time de QA

### Deploy (quando pronto)
```bash
# Render.com (como está no Docker agora)
git push origin master  # já feito ✅
# Deploy de ClickUp + n8n também necessário

# SSL/HTTPS obrigatório (ngrok atual é free + HTTP)
```

---

## 📂 Estrutura de Arquivos Importante

```
playwright_bridge/
├── .env                              # Credenciais (RUN_TEST_TOKEN, QA_*)
├── .claude/
│   ├── launch.json                   # Config dev server
│   └── settings.local.json           # Preferências locais
├── src/
│   ├── app/
│   │   ├── page.js                   # Frontend dashboard
│   │   ├── globals.css               # Estilos
│   │   └── api/
│   │       ├── run-test/route.js     # Executor Playwright
│   │       ├── history/route.js      # Histórico
│   │       └── generate-steps/route.js # Geração com IA
│   └── lib/
│       ├── steps.js                  # Padrões nativos + classifyStep()
│       ├── hub-knowledge.js          # Mapa do Hub QA
│       ├── auth.js                   # Validação Bearer token
│       ├── history.js                # Gravação histórico
│       └── claude-ai.js              # Fallback IA
├── data/
│   └── history.jsonl                 # Arquivo de histórico
├── public/
│   └── evidences/                    # Screenshots + vídeos
├── dynamic_test_*.spec.js            # Testes temporários (Playwright)
└── package.json
```

---

## 🔗 Integração n8n — URLs e Tokens

### Credenciais n8n Necessárias

1. **ClickUp Account Credential** (`Educacional`)
   - Token: gerado em ClickUp team settings
   - Usado em nodes: "Webhook", "Build QA Comment", "Post QA Comment", "Tag QA Result"

2. **Header Auth Credential** (Bearer token)
   - Value: `d7f0416463516586641fe4bf769de7a8e47a56e38907b551b2a286d63e906ad3`
   - Usado em: "Run E2E Test" HTTP POST node

3. **ngrok URL** (muda a cada restart)
   - Endpoint: `https://360d-201-58-72-230.ngrok-free.app/api/run-test`
   - Quando mudar, atualizar em n8n HTTP POST node

### n8n Webhook ClickUp

- Trigger: `task.updated` + filter label = `qa-test`
- Body: contem task ID, descrição, URL (em task name ou descrição)
- Webhook URL: registrada em ClickUp → Automations

---

## 💡 Dicas de Debug

### Teste API local sem n8n
```bash
curl -X POST http://localhost:3000/api/run-test \
  -H "Authorization: Bearer d7f0416463516586641fe4bf769de7a8e47a56e38907b551b2a286d63e906ad3" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://qa-hub.educacional.com/",
    "steps": [
      "Preencha os campos de login com usuário \"Eva001\" e senha \"Teste@25\" e clique em Entrar"
    ],
    "source": "curl-test"
  }'
```

### Ver logs do Playwright
```bash
# Nos logs da API
tail -f /path/to/next-logs.txt | grep playwright

# Ou rodar teste manualmente
npx playwright test dynamic_test_1234567890.spec.js --headed
```

### Validar padrão nativo
```javascript
// No console do navegador:
import { classifyStep } from '/lib/steps.js';
classifyStep("Preencha os campos de login com usuário \"Eva001\" e senha \"Teste@25\" e clique em Entrar");
// → { kind: 'login', user: 'Eva001', pass: 'Teste@25', ... }
```

---

## 📞 Contatos & Referências

- **Usuário QA:** Eva001 / Teste@25
- **Escola QA:** Instituição do Matheus - vinculada
- **Ambiente QA:** https://qa-hub.educacional.com (online 7:30-18:00)
- **Ambiente PRD:** https://hub.educacional.com/
- **ClickUp Workspace:** [seu workspace]
- **n8n Instance:** [URL n8n, se cloud]
- **GitHub:** https://github.com/Matheus-Rodrigues1010/playwright_bridge

---

## ✅ Checklist para Continuar em Outro Computador

- [ ] Clone repositório: `git clone ...`
- [ ] Instalar dependências: `npm install && npx playwright install chromium`
- [ ] Copiar `.env` do primeiro computador (contém RUN_TEST_TOKEN + credenciais)
- [ ] Instalar ngrok: `npm install -g ngrok`
- [ ] Rodar servidor: `npm run dev`
- [ ] Expor com ngrok: `ngrok http 3000 --skip-browser-warning`
- [ ] **ATUALIZAR ngrok URL em n8n** (standing authorization)
- [ ] Testar endpoint com curl (vide dicas de debug)
- [ ] Acessar http://localhost:3000 no navegador
- [ ] Verficar histórico: `GET /api/history`
- [ ] Pronto! 🚀

---

**Documentação compilada por:** Claude Haiku 4.5  
**Próxima revisão:** Após primeiro teste com n8n em QA real
