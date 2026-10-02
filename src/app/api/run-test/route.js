import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { classifyStep, DEFAULT_LOGIN, maskPassword } from '@/lib/steps';
import { HUB_CARD_ACTIONS, HUB_URL_FILTERS, hubPath } from '@/lib/hub-knowledge';
import { authorized, unauthorized } from '@/lib/auth';
import { addRun } from '@/lib/history';

const execAsync = promisify(exec);

export async function POST(request) {
  if (!authorized(request)) return unauthorized();
  try {
    const { url, steps, source } = await request.json();

    if (!/^https?:\/\//i.test(url || '') || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ success: false, error: 'URL (http/https) e passos são obrigatórios.' }, { status: 400 });
    }

    // Gerar o código do teste dinâmico
    const testId = Date.now();
    const tempTestFile = path.join(process.cwd(), `dynamic_test_${testId}.spec.js`);
    const evidenceFile = path.join(process.cwd(), `evidencia_${testId}.png`);
    const videoFile = path.join(process.cwd(), 'public', 'evidences', `video_${testId}.webm`);

    // "{{QA_X}}" → process.env.QA_X lido pelo spec em execução: o valor real não entra no código gerado,
    // no log nem na resposta. Só QA_* para um passo não conseguir digitar outras chaves do .env num site.
    const valueExpr = v => {
      const m = v.match(/^\{\{(QA_[A-Z0-9_]+)\}\}$/);
      return m ? `envValue(${JSON.stringify(m[1])})` : JSON.stringify(v);
    };

    function generateValidCPF() {
      const randomDigit = () => Math.floor(Math.random() * 10);
      const n = Array.from({length: 9}, randomDigit);
      let d1 = n.reduce((t, num, idx) => t + (num * (10 - idx)), 0);
      d1 = 11 - (d1 % 11);
      if (d1 >= 10) d1 = 0;
      let d2 = d1 * 2 + n.reduce((t, num, idx) => t + (num * (11 - idx)), 0);
      d2 = 11 - (d2 % 11);
      if (d2 >= 10) d2 = 0;
      return n.join('') + d1 + d2;
    }

    let stepsCode = '';
    steps.forEach((step, index) => {
      const stepEvidencePath = path.join(process.cwd(), `evidencia_${testId}_${index}.png`);
      const s = classifyStep(step);

      if (s.kind === 'select') {
        // ===== SELEÇÃO NATIVA EM LISTA/AUTOCOMPLETE (0 créditos) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - Seleção', async () => {
      try {
        const f = ${JSON.stringify(s.field)}, v = ${valueExpr(s.value)};
        // Filtro que a página guarda na URL (ex.: grau de facilidade → ?difficultyLevel=1): abre o endereço já filtrado
        if (await viaUrl(f, v)) return;
        // Label ligado ao input, ou o input do menor bloco que contém o texto do label (labels sem "for")
        const byBlock = page.locator('div').filter({ has: page.getByText(f) }).filter({ has: page.locator('input:visible, select:visible') }).last().locator('input:visible, select:visible').first();
        const field = page.getByLabel(f).or(page.getByPlaceholder(f)).or(page.getByRole('combobox', { name: f })).first().or(byBlock).first();
        await field.click({ timeout: 10000 });
        if (await field.evaluate(e => e.tagName === 'SELECT')) {
          await field.selectOption({ label: v });
        } else {
          await field.fill(v);
          await pickOption(v);
        }
        await settle();
      } finally {
        try {
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (s.kind === 'goto') {
        // ===== NAVEGAÇÃO PELO MAPA DO HUB (0 créditos) =====
        const target = s.path || hubPath(s.page);
        stepsCode += `
    await test.step('Passo ${index + 1} - Navegação', async () => {
      try {
        ${target
          ? `await page.goto(new URL(${JSON.stringify(target)}, page.url()).href, { waitUntil: 'domcontentloaded' });`
          : `await page.getByText(${JSON.stringify(s.page)}).first().click({ timeout: 10000 }); // fora do mapa: clica no menu`}
        await settle();
        // Hub avisa falta de permissão num toast e mostra a tela vazia; sem isto, verificações seguintes passariam por engano
        const denied = page.getByText(/sem permiss[aã]o/i).first();
        if (await denied.isVisible().catch(() => false)) {
          throw new Error('Sem permissão nesta página para o usuário de teste: ' + (await denied.innerText()).trim());
        }
      } finally {
        try {
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (s.kind === 'cardAction') {
        // ===== AÇÃO EM CARTÃO DE QUESTÃO DO HUB (0 créditos) =====
        // ponytail: ícones sem nome acessível → posição no cartão (HUB_CARD_ACTIONS). Se o Hub ganhar aria-label, trocar por getByRole.
        stepsCode += `
    await test.step('Passo ${index + 1} - Ação na questão', async () => {
      try {
        await settle();
        const title = page.getByText(/^Questão/).nth(${s.index});
        await title.waitFor({ state: 'visible', timeout: 15000 });
        const card = title.locator('xpath=ancestor::*[.//*[contains(@class, "IconButton-Container")]][1]');
        const icons = card.locator('.IconButton-Container');
        ${s.action !== 'atribuir' ? `if (await icons.count() < 2) throw new Error('Esta questão não tem a ação "${s.action}". Remover só existe em "Minhas questões", para questões da própria escola.');` : ''}
        await icons.${HUB_CARD_ACTIONS[s.action]}().click({ timeout: 10000 });
        await settle();
      } finally {
        try {
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (s.kind === 'verifyText') {
        // ===== VERIFICAÇÃO DE TEXTO/TÍTULO NATIVA (0 créditos) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - Verificação', async () => {
      try {
        ${s.title
          ? `await expect.poll(() => page.title(), { timeout: 15000 }).toContain(${JSON.stringify(s.value)});`
          : `await expect(page.getByText(${JSON.stringify(s.value)}).first()).toBeVisible({ timeout: 15000 });`}
      } finally {
        try {
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (s.kind === 'login') {
        // ===== LOGIN NATIVO (0 créditos) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - Login', async () => {
      try {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        
        const emailField = page.locator('input[type="email"], input[type="text"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[placeholder*="email" i], input[placeholder*="usu" i], input[placeholder*="acesso" i]').first();
        await emailField.waitFor({ state: 'visible', timeout: 15000 });
        await emailField.click();
        await emailField.fill(${valueExpr(s.user)});
        
        const passField = page.locator('input[type="password"]').first();
        await passField.waitFor({ state: 'visible', timeout: 5000 });
        await passField.click();
        await passField.fill(${valueExpr(s.pass)});
        
        const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar"), button:has-text("Avançar"), button:has-text("Sign in"), button:has-text("Continuar")').first();
        await submitBtn.click();

        // Sinal real do fim do envio: saiu do login (senha some) ou o Hub pediu escola, o que vier primeiro
        await Promise.race([
          passField.waitFor({ state: 'hidden', timeout: 20000 }),
          page.getByText(/escola você quer acessar/i).first().waitFor({ state: 'visible', timeout: 20000 }),
        ]).catch(() => {});
        await settle();
${s.user === DEFAULT_LOGIN.user ? `
        // Login padrão: se o site pedir escola e QA_ESCOLA existir no .env, escolhe e avança sozinho
        if (process.env.QA_ESCOLA && await passField.isVisible().catch(() => false)) {
          const escola = process.env.QA_ESCOLA;
          const field = page.locator('div').filter({ has: page.getByText('escola') }).filter({ has: page.locator('input:visible') }).last().locator('input:visible').first();
          if (await field.isVisible().catch(() => false)) {
            await field.fill(escola);
            await pickOption(escola);
            await submitBtn.click();
            await passField.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
            await settle();
          }
        }` : ''}
${index === steps.length - 1 ? `
        // Formulário ainda na tela (ex: campo extra "escola") e nenhum passo seguinte → Claude conclui o login.
        if (await passField.isVisible().catch(() => false)) {
          await ai('O login foi iniciado mas não concluído. Preencha os campos obrigatórios que faltam (em listas, escolha a primeira opção disponível), sem alterar usuário e senha, clique no botão de avançar/entrar e confirme que saiu da tela de login.', aiArgs);
        }` : ''}
      } finally {
        try {
          await settle();
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (s.kind === 'search') {
        // ===== BUSCA NATIVA (0 créditos) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - Busca', async () => {
      try {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await settle();
        
        // Página que guarda a busca na URL (ex.: Banco de questões ?search=): abre o endereço já buscado
        if (await viaUrl('search', ${valueExpr(s.term)})) return;

        let searchField = null;

        // Estratégia 1: campos com atributos de busca, ou cujo rótulo diz "Buscar"/"Pesquisar" (Hub: label sem placeholder)
        const byLabel = page.locator('div').filter({ has: page.getByText(/^(buscar|pesquisar|procurar|search)/i) }).filter({ has: page.locator('input:visible') }).last().locator('input:visible').first();
        const specificSearch = page.locator('input[type="search"], input[placeholder*="busc" i], input[placeholder*="pesquis" i], input[placeholder*="filtr" i], input[placeholder*="search" i], input[role="searchbox"]').first();
        if (await specificSearch.isVisible().catch(() => false)) {
          searchField = specificSearch;
        } else if (await byLabel.isVisible().catch(() => false)) {
          searchField = byLabel;
        }
        
        // Estratégia 2: qualquer input de texto visível (exceto senha)
        if (!searchField) {
          const textInputs = page.locator('input[type="text"]:visible, input:not([type]):visible').filter({ hasNot: page.locator('[type="password"], [type="hidden"], [type="email"]') });
          const count = await textInputs.count();
          if (count > 0) {
            searchField = textInputs.first();
          }
        }
        
        // Estratégia 3: qualquer textbox via role
        if (!searchField) {
          const roleTextbox = page.getByRole('textbox').first();
          if (await roleTextbox.isVisible().catch(() => false)) {
            searchField = roleTextbox;
          }
        }
        
        if (searchField) {
          await searchField.click();
          await searchField.fill(${valueExpr(s.term)});
          await searchField.press('Enter'); // buscas que só disparam no Enter (Hub)
          await settle();
        } else {
          throw new Error('Não foi possível encontrar o campo de busca na página.');
        }
      } finally {
        try {
          await settle();
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (s.kind === 'click') {
        // ===== CLIQUE EM TEXTO NATIVO (0 créditos) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - Clique', async () => {
      try {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await settle();
        
        const target = page.getByText(${JSON.stringify(s.text)}).first();
        await target.waitFor({ state: 'visible', timeout: 10000 });
        await target.scrollIntoViewIfNeeded();
        await target.click();
        
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await settle();
      } finally {
        try {
          await settle();
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (s.kind === 'verifyUrl') {
        // ===== VERIFICAÇÃO DE URL NATIVA (0 créditos) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - Verificação', async () => {
      try {
        await settle();
        // Redirecionamentos (ex.: após login) podem demorar: confere por até 15s antes de falhar
        await page.waitForURL(u => u.href.includes(${JSON.stringify(s.path)}), { timeout: 15000 }).catch(() => {});
        const currentUrl = page.url();
        if (!currentUrl.includes(${JSON.stringify(s.path)})) {
          throw new Error(${JSON.stringify(`Esperava URL contendo "${s.path}" mas encontrou: `)} + currentUrl);
        }
      } finally {
        try {
          await settle();
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (s.kind === 'cpf') {
        // ===== GERAÇÃO DE CPF VÁLIDO (0 créditos + fallback IA) =====
        const generatedCpf = generateValidCPF();
        stepsCode += `
    await test.step('Passo ${index + 1} - Gerar e Preencher CPF', async () => {
      try {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await settle();
        
        const f = ${JSON.stringify(s.field)};
        const targetField = page.locator(\`input[placeholder*="\${f}" i], input[name*="\${f}" i], input[id*="\${f}" i]\`).first();
        
        if (await targetField.isVisible().catch(() => false)) {
          await targetField.scrollIntoViewIfNeeded();
          await targetField.click();
          await targetField.fill('${generatedCpf}');
          await settle();
        } else {
          // Força o erro para cair no fallback se não achar via locator nativo
          throw new Error('Campo não encontrado nativamente');
        }
      } catch (e) {
        // Fallback: Usa o ZeroStep IA para preencher o CPF *já gerado*, garantindo a matemática correta
        await ai(${JSON.stringify(`Preencha exatamente o valor "${generatedCpf}" no campo ${s.field}`)}, aiArgs);
      } finally {
        try {
          await settle();
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else {
        // ===== FALLBACK: ZEROSTEP IA (1 crédito) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - IA', async () => {
      try {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await settle();
        await ai(${JSON.stringify(step)}, aiArgs);
      } finally {
        try {
          await settle();
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;
      }
    });

    const specContent = `
import { test, expect } from '@playwright/test';
import { ai } from './src/lib/claude-ai.js';
import dotenv from 'dotenv';
// quiet: o aviso do dotenv saía antes do erro real e o escondia no log
dotenv.config({ quiet: true });

const envValue = name => {
  if (!process.env[name]) throw new Error('Variável ' + name + ' não definida no .env do runner.');
  return process.env[name];
};

test.use({ 
  video: { mode: 'on', size: { width: 1280, height: 720 } },
  viewport: { width: 1920, height: 1080 },
  launchOptions: { args: ['--disable-gpu'] }
});

// Garante que o print seja tirado mesmo se o teste falhar
test.afterEach(async ({ page }, testInfo) => {
  try {
    await page.waitForTimeout(1000);
    await page.screenshot({ path: ${JSON.stringify(evidenceFile)}, fullPage: true });
    
    // Fecha a página para finalizar o arquivo de vídeo
    const videoObj = page.video();
    await page.close();
    
    if (videoObj) await videoObj.saveAs(${JSON.stringify(videoFile)});
  } catch (e) {
    console.error("Falha ao gerar evidencia no afterEach", e);
  }
});

test('Execucao dinamica do painel', async ({ page }) => {
  // Espera real em vez de tempo fixo: carregamento, rede ociosa (máx. 4s, SPAs fazem polling) e autocomplete sem "Buscando…"
  const settle = async () => {
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    await page.getByText(/^Buscando/).first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  };
  // Opção de lista/autocomplete: procura no popup (Hub: Portal-PopperWrapper) para não clicar no mesmo texto em outro
  // ponto da página; a página inteira só como último recurso (popups ficam no fim do DOM, por isso .last()).
  const pickOption = async v => {
    await settle();
    const popup = page.locator('[class*="PopperWrapper"]:visible, [role="listbox"]:visible');
    const scoped = page.getByRole('option', { name: v, exact: true }).or(popup.getByText(v, { exact: true })).first();
    await scoped.click({ timeout: 10000 }).catch(() => page.getByText(v, { exact: true }).last().click({ timeout: 5000 }));
  };
  // Filtro/busca que a página atual guarda na URL (HUB_URL_FILTERS): navega já filtrado. false = usar o campo.
  const URL_FILTERS = ${JSON.stringify(HUB_URL_FILTERS)};
  const norm = s => String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
  const viaUrl = async (field, value) => {
    const here = new URL(page.url());
    const rules = URL_FILTERS[here.pathname];
    const rule = rules && Object.entries(rules).find(([k]) => norm(field).includes(norm(k)) || norm(k).includes(norm(field)))?.[1];
    if (!rule) return false;
    const param = typeof rule === 'string' ? rule : rule.param;
    const val = typeof rule === 'string' ? value : rule.values[Object.keys(rule.values).find(o => norm(o) === norm(value))];
    if (val == null) return false;
    here.searchParams.set(param, val);
    here.searchParams.set('page', '1');
    await page.goto(here.href, { waitUntil: 'domcontentloaded' });
    await settle();
    return true;
  };

  test.setTimeout(300000); // 5 minutos
  const aiArgs = { page, test };

  await test.step('Acessar URL Base', async () => {
    await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded' });
  });
  ${stepsCode}
});
`;

    // Escrever o arquivo
    await fs.writeFile(tempTestFile, specContent, 'utf-8');

    // Executar o teste via child_process
    // Como estamos na pasta dashboard-ia, e instalamos o playwright aqui, podemos usar o npx
    let success = true;
    let commandOutput = '';
    try {
      // Usar apenas o nome do arquivo para evitar bugs do Playwright com caminhos absolutos no Windows
      const testFileName = path.basename(tempTestFile);
      const { stdout, stderr } = await execAsync("npx playwright test " + testFileName, { env: { ...process.env, FORCE_COLOR: '0' } });
      commandOutput = stdout + '\n' + stderr;
    } catch (error) {
      // O teste falhou
      success = false;
      commandOutput = error.stdout + '\n' + error.stderr + '\n' + error.message;
    }
    // FORCE_COLOR=0 não cobre as mensagens do expect; remove cores ANSI para log, histórico e ClickUp
    commandOutput = commandOutput.replace(/\x1b\[[0-9;]*m/g, '');

    // O afterEach salva o vídeo direto em public/evidences
    const videoUrl = await fs.access(videoFile).then(() => `/evidences/${path.basename(videoFile)}`, () => null);

    // Lê e apaga um print; null se o passo não chegou a rodar
    const takeEvidence = async file => {
      try {
        const b64 = (await fs.readFile(file)).toString('base64');
        await fs.unlink(file);
        return b64;
      } catch { return null; }
    };
    // Alinhado por índice do passo
    const stepEvidences = await Promise.all(steps.map((_, i) => takeEvidence(path.join(process.cwd(), `evidencia_${testId}_${i}.png`))));
    const finalEvidence = await takeEvidence(evidenceFile);

    // Ex: "1) dynamic_test_x.spec.js:29:5 › Execucao dinamica do painel › Passo 2 - Clique ───"
    const failedStepMatch = !success && commandOutput.match(/› Passo (\d+) -/);
    const failedStep = failedStepMatch ? Number(failedStepMatch[1]) : null;
    const errorSummary = success ? null : (commandOutput.match(/^\s*(\w*Error: .+)$/m)?.[1] || 'O teste falhou ou estourou o tempo limite.').trim();

    // Limpar o arquivo de teste
    try {
      await fs.unlink(tempTestFile);
    } catch (e) {
      // Ignorar
    }

    // Histórico: senha mascarada; prints não são guardados (a gravação cobre a evidência visual)
    await addRun({
      id: testId,
      at: new Date(testId).toISOString(),
      source: source === 'ui' ? 'interface' : 'n8n',
      url,
      steps: steps.map(maskPassword),
      success,
      failedStep,
      error: errorSummary,
      durationMs: Date.now() - testId,
      videoUrl,
      evidenced: stepEvidences.map(Boolean),
    }).catch(e => console.error('Falha ao salvar histórico', e));

    return NextResponse.json({
      success,
      output: commandOutput,
      stepEvidences,
      finalEvidence,
      failedStep,
      videoUrl,
      error: errorSummary
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
