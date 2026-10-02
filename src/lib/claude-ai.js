// Substituto do ZeroStep: executa um passo em linguagem natural usando Claude + tool use.
// Também gera passos a partir de texto livre (generateSteps).
import Anthropic from '@anthropic-ai/sdk';
import { DEFAULT_LOGIN, DEFAULT_LOGIN_STEP, NEEDS_DATA, TEMPLATES, classifyStep, hideSecrets, restoreSecrets } from './steps.js';
import { geminiJSON } from './gemini.js';
import { HUB_KNOWLEDGE_PROMPT } from './hub-knowledge.js';

let client; // lazy: passos nativos não exigem ANTHROPIC_API_KEY
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
const MAX_TURNS = 15;

const ref = { type: 'integer', description: 'Número [n] do elemento na lista' };
const tools = [
  { name: 'click', description: 'Clica em um elemento da lista.', input_schema: { type: 'object', properties: { ref }, required: ['ref'], additionalProperties: false } },
  { name: 'fill', description: 'Limpa e preenche um campo de texto.', input_schema: { type: 'object', properties: { ref, text: { type: 'string' } }, required: ['ref', 'text'], additionalProperties: false } },
  { name: 'press', description: 'Pressiona uma tecla (ex: Enter, Tab, Escape).', input_schema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'], additionalProperties: false } },
  { name: 'scroll', description: 'Rola a página.', input_schema: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] } }, required: ['direction'], additionalProperties: false } },
  { name: 'done', description: 'Finaliza o passo. success=false se a instrução não pôde ser cumprida ou a verificação falhou.', input_schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } }, required: ['success', 'message'], additionalProperties: false } },
].map(t => ({ ...t, strict: true }));

const SYSTEM = `Você é um robô de testes E2E controlando um navegador via Playwright.
Recebe uma instrução de teste, a lista de elementos interativos visíveis (com [n]) e um print da tela.
Use as ferramentas para cumprir a instrução e chame "done" ao terminar. Se for uma verificação, apenas observe e responda com done.
Não invente dados além dos que a instrução fornece. Responda a mensagem de done em português.`;

// Marca os elementos interativos visíveis com data-ai-ref e devolve texto + print para o Claude.
async function snapshot(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  const elements = await page.evaluate(() => {
    const sel = 'a,button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=option],[role=checkbox],[role=radio],[onclick],[contenteditable=true]';
    document.querySelectorAll('[data-ai-ref]').forEach(e => e.removeAttribute('data-ai-ref'));
    const out = [];
    let i = 0;
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (!r.width || !r.height || s.visibility === 'hidden' || s.display === 'none' || el.type === 'hidden') continue;
      el.setAttribute('data-ai-ref', ++i);
      const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || el.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      out.push(`[${i}] <${el.tagName.toLowerCase()}${el.type ? ` type=${el.type}` : ''}> ${label}`);
    }
    return out.join('\n');
  });
  const shot = await page.screenshot({ type: 'jpeg', quality: 60 });
  return [
    { type: 'text', text: `URL: ${page.url()}\nTítulo: ${await page.title()}\nElementos:\n${elements || '(nenhum)'}` },
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: shot.toString('base64') } },
  ];
}

async function run(page, name, input) {
  const el = () => page.locator(`[data-ai-ref="${input.ref}"]`);
  if (name === 'click') await el().click({ timeout: 10000 });
  else if (name === 'fill') await el().fill(input.text, { timeout: 10000 });
  else if (name === 'press') await page.keyboard.press(input.key);
  else if (name === 'scroll') await page.mouse.wheel(0, input.direction === 'down' ? 600 : -600);
  await page.waitForTimeout(1500);
}

export async function ai(instruction, { page }) {
  client ??= new Anthropic();
  const messages = [{ role: 'user', content: [{ type: 'text', text: `Instrução: ${instruction}` }, ...(await snapshot(page))] }];

  // ponytail: histórico guarda todos os prints (custo cresce com o nº de turnos); podar imagens antigas se os passos ficarem longos.
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      tools,
      messages,
    });
    if (res.stop_reason === 'refusal') throw new Error('Claude recusou a instrução: ' + instruction);
    messages.push({ role: 'assistant', content: res.content });

    const calls = res.content.filter(b => b.type === 'tool_use');
    if (!calls.length) throw new Error('Claude parou sem chamar "done": ' + instruction);

    const results = [];
    for (const call of calls) {
      if (call.name === 'done') {
        console.log(`[claude] ${call.input.success ? 'OK' : 'FALHA'}: ${call.input.message}`);
        if (!call.input.success) throw new Error(call.input.message);
        return call.input.message;
      }
      try {
        await run(page, call.name, call.input);
        results.push({ type: 'tool_result', tool_use_id: call.id, content: 'ok' });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: call.id, content: e.message.slice(0, 500), is_error: true });
      }
    }
    // Estado novo da página vai junto dos resultados, na mesma mensagem.
    messages.push({ role: 'user', content: [...results, ...(await snapshot(page))] });
  }
  throw new Error(`Passo não concluído em ${MAX_TURNS} turnos: ${instruction}`);
}

// ===== Gerador de passos: texto livre ou história de usuário → cenários com passos nos padrões nativos =====

const GEN_SYSTEM = `Você converte roteiros de teste escritos livremente (com erros de digitação, abreviações, ordem confusa ou Gherkin) e histórias de usuário com critérios de aceite em cenários de teste executáveis por um robô Playwright.
Cada passo deve seguir exatamente um destes modelos, trocando apenas os valores entre aspas duplas:
${TEMPLATES.map(([, t]) => `- ${t}`).join('\n')}

Cenários:
A. Se o texto tiver vários cenários (ex.: "Cenário 1 — ...", vários blocos Dado/Quando/Então), devolva um item em scenarios para cada um, com o título dele. Um roteiro simples vira um único cenário com title "Roteiro".
B. Contexto, história, escopo e regras de negócio não viram passos; use-os só para entender os cenários.
C. Não escreva login (é configurado à parte), a menos que o texto descreva o login explicitamente. Quando o texto diz "Dado que o usuário esteja em X" e X é uma página conhecida (lista abaixo), comece o cenário com Acesse "X"; se X não for conhecida, não invente navegação.
C2. Quando faltar um valor e existir opção conhecida para aquele campo (lista abaixo), use uma opção real (ex.: Selecione "Fácil" no campo "grau de facilidade") e registre em notes qual opção escolheu. Só use [informe: ...] quando não houver opção conhecida.
D. status de cada cenário:
   - "ready": todos os passos têm valores concretos.
   - "needs_data": falta algum valor (qual filtro, qual item, qual avaliação...). Escreva o passo mesmo assim, com o marcador [informe: o que falta] no lugar do valor (ex.: Selecione "[informe: disciplina]" no campo "Disciplina"), e explique em notes.
   - "unsupported": o cenário exige enviar arquivo (upload, importação) ou verificar arquivo baixado (download, exportação). Deixe steps vazio e explique em notes.
E. Para cenários negativos, como uma busca sem resultado, você pode criar um termo de teste claramente inexistente (ex.: "zzz-sem-resultado-teste"). Isso é dado de teste, não credencial.

Regras dos passos:
1. Um passo por ação, na ordem descrita.
2. Preserve literalmente usuários, senhas, marcadores como __SENHA_0__ ou {{QA_USER}} e textos de tela citados (ex.: mensagens entre aspas nos critérios). Nunca invente credenciais nem textos de tela.
3. Textos de botões, menus e links vão entre aspas duplas, como aparecem na tela. Corrija erros óbvios de digitação e de acentuação do português (ex.: "admnistrador" → "Administrador", "instituiçao" → "Instituição") e registre cada correção em warnings. Não altere nomes próprios, códigos ou logins.
3b. Navegação encadeada ("A > B", "A e depois B", "menu A, opção B") vira um passo de clique por item, na ordem.
4. Se uma ação não couber em nenhum modelo, escreva-a como instrução clara em português (ela será executada por IA) e registre em notes.
5. Login sem usuário ou senha informados: escreva exatamente "${DEFAULT_LOGIN_STEP}" e registre em warnings que usou o login padrão. Nunca deixe aspas vazias.
Escreva warnings e notes em português, curtos.

${HUB_KNOWLEDGE_PROMPT}`;

const GEN_SCHEMA = {
  type: 'object',
  properties: {
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          status: { type: 'string', enum: ['ready', 'needs_data', 'unsupported'] },
          steps: { type: 'array', items: { type: 'string' } },
          notes: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'status', 'steps', 'notes'],
        additionalProperties: false,
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['scenarios', 'warnings'],
  additionalProperties: false,
};

// Formato de schema do Gemini (subconjunto OpenAPI)
const GEN_SCHEMA_GEMINI = {
  type: 'OBJECT',
  properties: {
    scenarios: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          status: { type: 'STRING', enum: ['ready', 'needs_data', 'unsupported'] },
          steps: { type: 'ARRAY', items: { type: 'STRING' } },
          notes: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['title', 'status', 'steps', 'notes'],
      },
    },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['scenarios', 'warnings'],
};

// Gemini quando GEMINI_API_KEY existe; senão Claude.
// Retorna { scenarios, warnings, steps }; steps = passos do cenário único (contrato usado pelo n8n, que manda um cenário por vez).
export async function generateSteps(text) {
  const { hidden, secrets } = hideSecrets(text); // senhas não saem desta máquina
  const out = process.env.GEMINI_API_KEY
    ? await geminiJSON(GEN_SYSTEM, hidden, GEN_SCHEMA_GEMINI)
    : await claudeJSON(hidden);
  // Rede de segurança (regra 5): login com aspas vazias ou com os placeholders padrão vira a forma legível
  const isDefaultLogin = s => {
    const k = classifyStep(s);
    return /usu[aá]rio\s+""/i.test(s) || (k.kind === 'login' && k.user === DEFAULT_LOGIN.user && k.pass === DEFAULT_LOGIN.pass);
  };
  // Modelos às vezes prefixam o rótulo do modelo ("Ver. texto: ..."); remove para o passo casar com o padrão
  const unlabel = s => TEMPLATES.reduce((acc, [name]) => (acc.startsWith(`${name}:`) ? acc.slice(name.length + 1).trim() : acc), s);
  const clean = s => { const t = unlabel(restoreSecrets(s, secrets)); return isDefaultLogin(t) ? DEFAULT_LOGIN_STEP : t; };

  const scenarios = out.scenarios.map(sc => {
    const steps = sc.status === 'unsupported' ? [] : sc.steps.map(clean);
    // Status coerente com os passos, independente do que o modelo disse
    const status = sc.status === 'unsupported' ? 'unsupported' : steps.some(s => NEEDS_DATA.test(s)) ? 'needs_data' : steps.length ? 'ready' : 'needs_data';
    return { title: sc.title, status, steps, notes: sc.notes };
  });
  const single = scenarios.length === 1 ? scenarios[0] : null;
  // Cenário único: notes entram em warnings, como antes (o n8n mostra warnings no ClickUp)
  return { scenarios, warnings: single ? [...out.warnings, ...single.notes] : out.warnings, steps: single ? single.steps : [] };
}

async function claudeJSON(hidden) {
  client ??= new Anthropic();
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: GEN_SCHEMA } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: GEN_SYSTEM,
    messages: [{ role: 'user', content: hidden }],
  });
  if (res.stop_reason === 'refusal') throw new Error('Claude recusou gerar os passos.');
  if (res.stop_reason === 'max_tokens') throw new Error('Resposta do Claude cortada (max_tokens).');
  return JSON.parse(res.content.find(b => b.type === 'text').text);
}
