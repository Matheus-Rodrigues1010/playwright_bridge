# AI Test Flow Builder

Testes E2E em linguagem natural. Cada passo vira código Playwright: padrões conhecidos rodam nativamente (0 tokens), o resto é executado pelo Claude.

## Rodar

```bash
npm install
npx playwright install chromium
npm run dev
```

Abra http://localhost:3000.

## `.env` (opcional)

Só é necessário para passos que caem no Claude:

```
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus-5   # opcional
```

Sem a chave, testes 100% nativos funcionam normalmente; a prévia na tela mostra antes de rodar quais passos usam o Claude.

## Autenticação (`RUN_TEST_TOKEN`)

Sem a variável, `POST /api/run-test` é aberto (uso local). Ao expor a API (deploy, n8n remoto), defina no `.env` um token forte:

```
RUN_TEST_TOKEN=<gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

e envie `Authorization: Bearer <token>` em cada chamada; sem ele a resposta é `401`.

Na interface, informe o mesmo token no campo "Token de acesso" (fica salvo só no seu navegador).

## Histórico

Toda execução (interface ou n8n/API) é gravada em `data/history.jsonl`, com a senha mascarada, e aparece na seção "Histórico de testes" da interface, com filtro por origem. A API é `GET /api/history`, protegida pelo mesmo token. Prints não são guardados; o vídeo de cada execução fica em `public/evidences/`.

## Padrões nativos

Um passo por linha (ou separados por `|`). Os padrões ficam em [`src/lib/steps.js`](src/lib/steps.js).

| Tipo | Exemplo |
|---|---|
| Login | `Preencha os campos de login com usuário "user" e senha "pass" e clique em Entrar` |
| Seleção | `Selecione "Opção" no campo "Campo"` |
| Clique | `Clique no botão "Texto"` |
| Busca | `Busque por "termo"` |
| Verificar texto | `Verifique se o texto "Texto" está sendo exibido` |
| Verificar título | `Verifique se o título da página contém "Título"` |
| Verificar URL | `Verifique se a tela /caminho está sendo exibida` |
| CPF | `Preencha um CPF válido no campo "cpf"` |

Não precisa escrever nos padrões: o botão **✨ Gerar passos com IA** reescreve texto livre nesses modelos (`POST /api/generate-steps`; usa `GEMINI_API_KEY` se existir, senão `ANTHROPIC_API_KEY`; modelo em `GEMINI_MODEL`, padrão `gemini-flash-latest` com fallback para o Lite), com avisos sobre o que corrigiu ou faltou. As senhas são trocadas por marcadores antes do envio.

Qualquer outro texto vai para o Claude ([`src/lib/claude-ai.js`](src/lib/claude-ai.js)).

## Credenciais de teste sem expor senha (`{{QA_*}}`)

Em vez do valor literal, os passos podem usar placeholders que o runner resolve pelo `.env` só no momento de preencher o campo:

```
QA_USER=...
QA_PASS=...
```

```
Preencha os campos de login com usuário "{{QA_USER}}" e senha "{{QA_PASS}}" e clique em Entrar
```

Vale para usuário, senha, busca e seleção. O valor real não entra no código gerado, no log, na resposta da API nem no histórico. Só variáveis com prefixo `QA_` são resolvidas; se faltar alguma, o passo falha com "Variável QA_X não definida".
