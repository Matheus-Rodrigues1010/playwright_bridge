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

### Login padrão

Escrever só `faça login` (ou `faço o login`, `efetue o login`) usa `QA_USER`/`QA_PASS` do `.env`. O gerador com IA faz o mesmo quando o roteiro pede login sem informar credenciais. Se o site pedir escola depois do usuário e senha, defina `QA_ESCOLA` no `.env` e o login padrão a escolhe sozinho. No login por e-mail o campo de escola não aparece, e esse passo é pulado automaticamente, mesmo com `QA_ESCOLA` definido.

### Histórias de usuário com vários cenários

Colou uma história com critérios de aceite ("Cenário 1 — …", Dado/Quando/Então)? O **✨ Organizar com IA** separa cada cenário e marca o status: **Pronto**, **Precisa de dados** (os valores que faltam aparecem como `[informe: …]` e o botão de rodar fica bloqueado até você preencher) ou **Não suportado** (cenários com upload/importação ou download/exportação de arquivo). O campo "Antes de cada cenário" guarda o login e o caminho até a tela, e é colocado na frente do cenário escolhido.

Na API, `POST /api/generate-steps` devolve `{ scenarios: [{ title, status, steps, notes }], warnings, steps }`; `steps` só vem preenchido quando há um único cenário (o n8n manda um cenário por vez).

## Conhecimento do Hub (sem IA)

[`src/lib/hub-knowledge.js`](src/lib/hub-knowledge.js) guarda o que foi levantado navegando no QA: o mapa de páginas (menu → rota), as opções reais dos filtros do Banco de questões e textos de tela usados em verificações.

- `Acesse "Banco de questões"` (ou `vá para`, `abra`, `navegue até`) vai direto para a rota; `Acesse /caminho` também funciona.
- `Dado que o usuário esteja no Banco de Questões` vira navegação nativa quando a página está no mapa.
- O organizador com IA recebe esse conhecimento e usa páginas, opções e textos reais em vez de `[informe: …]`.

Se o Hub mudar uma rota, atualize o mapa; página fora do mapa cai em clique pelo texto do menu.

### Robustez da execução

- **Esperas reais:** em vez de tempos fixos, cada passo espera o carregamento, a rede ociosa (máx. 4s) e o fim do "Buscando…" dos autocompletes. O login espera sair da tela de login (ou o pedido de escola) e a verificação de URL aguarda o redirecionamento por até 15s.
- **Opções de lista no popup:** a opção é clicada dentro do popup/lista, nunca num texto igual em outro ponto da página.
- **Filtros pela URL:** em páginas que guardam filtros no endereço (`HUB_URL_FILTERS` em `hub-knowledge.js`), busca e filtros conhecidos abrem a URL já filtrada.
- **Sem permissão = falha:** se o Hub avisar "Sem permissão" ao abrir uma página, o passo falha na hora, em vez de seguir e passar por engano numa tela vazia.
