import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request) {
  try {
    const { url, steps } = await request.json();

    if (!url || !steps || steps.length === 0) {
      return NextResponse.json({ success: false, error: 'URL e passos são obrigatórios.' }, { status: 400 });
    }

    // Gerar o código do teste dinâmico
    const testId = Date.now();
    const tempTestFile = path.join(process.cwd(), `dynamic_test_${testId}.spec.js`);
    const evidenceFile = path.join(process.cwd(), `evidencia_${testId}.png`);
    const videoInfoFile = path.join(process.cwd(), `video_info_${testId}.txt`);

    // ========== DETECÇÃO INTELIGENTE DE PADRÕES ==========
    
    // Detecta credenciais de login
    function extractLogin(text) {
      const match = text.match(/usu[aá]rio\s+["']([^"']+)["']\s+e\s+senha\s+["']([^"']+)["']/i);
      if (match) return { user: match[1], pass: match[2] };
      return null;
    }
    
    // Detecta "busque/pesquise/digite por X no campo"
    function extractSearch(text) {
      const match = text.match(/(?:busque|pesquise|procure|digite|filtre)\s+(?:por\s+)?["']([^"']+)["']/i);
      if (match) return match[1];
      return null;
    }
    
    // Detecta "clique no texto/botão/link X"
    function extractClickText(text) {
      const match = text.match(/clique\s+(?:n[oa]\s+)?(?:texto|bot[aã]o|link|op[cç][aã]o)?\s*["']([^"']+)["']/i);
      if (match) return match[1];
      return null;
    }
    
    // Detecta "verifique se a tela/página X está sendo exibida"
    function extractVerifyUrl(text) {
      const match = text.match(/verifique\s+se\s+.*?(\/\w[\w/]*)/i);
      if (match) return match[1];
      return null;
    }

    // Detecta intenção de gerar um CPF válido e o nome do campo (opcional)
    function extractCpfGen(text) {
      const match = text.match(/cpf\s+v[aá]lido(?:.*?campo\s+["']([^"']+)["']|.*?em\s+["']([^"']+)["'])?/i);
      if (match) return match[1] || match[2] || "cpf";
      return null;
    }

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
      const login = extractLogin(step);
      const searchTerm = !login ? extractSearch(step) : null;
      const clickText = !login && !searchTerm ? extractClickText(step) : null;
      const verifyUrl = !login && !searchTerm && !clickText ? extractVerifyUrl(step) : null;
      const cpfField = !login && !searchTerm && !clickText && !verifyUrl ? extractCpfGen(step) : null;
      
      if (login) {
        // ===== LOGIN NATIVO (0 créditos) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - Login', async () => {
      try {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        
        const emailField = page.locator('input[type="email"], input[type="text"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[placeholder*="email" i], input[placeholder*="usu" i], input[placeholder*="acesso" i]').first();
        await emailField.waitFor({ state: 'visible', timeout: 15000 });
        await emailField.click();
        await emailField.fill(${JSON.stringify(login.user)});
        
        const passField = page.locator('input[type="password"]').first();
        await passField.waitFor({ state: 'visible', timeout: 5000 });
        await passField.click();
        await passField.fill(${JSON.stringify(login.pass)});
        
        const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar"), button:has-text("Avançar"), button:has-text("Sign in"), button:has-text("Continuar")').first();
        await submitBtn.click();
        
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(3000);
      } finally {
        try {
          await page.waitForTimeout(1000);
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (searchTerm) {
        // ===== BUSCA NATIVA (0 créditos) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - Busca', async () => {
      try {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(2000);
        
        let searchField = null;
        
        // Estratégia 1: campos com atributos de busca
        const specificSearch = page.locator('input[type="search"], input[placeholder*="busc" i], input[placeholder*="pesquis" i], input[placeholder*="filtr" i], input[placeholder*="search" i], input[role="searchbox"]').first();
        if (await specificSearch.isVisible().catch(() => false)) {
          searchField = specificSearch;
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
          await searchField.fill(${JSON.stringify(searchTerm)});
          await page.waitForTimeout(2000);
        } else {
          throw new Error('Não foi possível encontrar o campo de busca na página.');
        }
      } finally {
        try {
          await page.waitForTimeout(1000);
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (clickText) {
        // ===== CLIQUE EM TEXTO NATIVO (0 créditos) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - Clique', async () => {
      try {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(1000);
        
        const target = page.locator('text=${clickText.replace(/'/g, "\\'")}').first();
        await target.waitFor({ state: 'visible', timeout: 10000 });
        await target.scrollIntoViewIfNeeded();
        await target.click();
        
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(2000);
      } finally {
        try {
          await page.waitForTimeout(1000);
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (verifyUrl) {
        // ===== VERIFICAÇÃO DE URL NATIVA (0 créditos) =====
        stepsCode += `
    await test.step('Passo ${index + 1} - Verificação', async () => {
      try {
        await page.waitForTimeout(3000);
        
        const currentUrl = page.url();
        if (!currentUrl.includes(${JSON.stringify(verifyUrl)})) {
          throw new Error('Esperava URL contendo "${verifyUrl}" mas encontrou: ' + currentUrl);
        }
      } finally {
        try {
          await page.waitForTimeout(1000);
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;

      } else if (cpfField) {
        // ===== GERAÇÃO DE CPF VÁLIDO (0 créditos + fallback IA) =====
        const generatedCpf = generateValidCPF();
        stepsCode += `
    await test.step('Passo ${index + 1} - Gerar e Preencher CPF', async () => {
      try {
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(1000);
        
        const targetField = page.locator(\`input[placeholder*="\${'${cpfField}'}" i], input[name*="\${'${cpfField}'}" i], input[id*="\${'${cpfField}'}" i]\`).first();
        
        if (await targetField.isVisible().catch(() => false)) {
          await targetField.scrollIntoViewIfNeeded();
          await targetField.click();
          await targetField.fill('${generatedCpf}');
          await page.waitForTimeout(1000);
        } else {
          // Força o erro para cair no fallback se não achar via locator nativo
          throw new Error('Campo não encontrado nativamente');
        }
      } catch (e) {
        // Fallback: Usa o ZeroStep IA para preencher o CPF *já gerado*, garantindo a matemática correta
        await ai(\`Preencha exatamente o valor "${generatedCpf}" no campo ${cpfField}\`, aiArgs);
      } finally {
        try {
          await page.waitForTimeout(1000);
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
        await page.waitForTimeout(1000);
        await ai(${JSON.stringify(step)}, aiArgs);
      } finally {
        try {
          await page.waitForTimeout(1000);
          await page.screenshot({ path: ${JSON.stringify(stepEvidencePath)}, fullPage: true });
        } catch (e) { console.error("Falha evidencia", e); }
      }
    });\n`;
      }
    });

    const specContent = `
import { test, expect } from '@playwright/test';
import { ai } from '@zerostep/playwright';
import dotenv from 'dotenv';
dotenv.config();

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
    
    if (videoObj) {
      const videoPath = await videoObj.path();
      require('fs').writeFileSync(${JSON.stringify(videoInfoFile)}, videoPath, 'utf8');
    }
  } catch (e) {
    console.error("Falha ao gerar evidencia no afterEach", e);
  }
});

test('Execucao dinamica do painel', async ({ page }) => {
  test.setTimeout(300000); // 5 minutos
  const aiArgs = { page, test };

  await test.step('Acessar URL Base', async () => {
    await page.goto('${url}', { waitUntil: 'domcontentloaded' });
  });
  ${stepsCode}
  // Passo de relatório removido: O ZeroStep cobraria 1 crédito adicional só para gerar esse texto. 
  // Alterado para um log fixo para economia extrema.
  await test.step('Gerar Relatorio Natural', async () => {
    const relatorio = 'Teste executado. Para visualizar os resultados, olhe a evidência visual logo abaixo.';
    console.log('AI_REPORT_START\\n' + relatorio + '\\nAI_REPORT_END');
  });
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
      const { stdout, stderr } = await execAsync("npx playwright test " + testFileName);
      commandOutput = stdout + '\\n' + stderr;
    } catch (error) {
      // O teste falhou
      success = false;
      commandOutput = error.stdout + '\\n' + error.stderr + '\\n' + error.message;
    }

    // Extrair o relatório natural
    let naturalReport = null;
    const reportMatch = commandOutput.match(/AI_REPORT_START\n([\s\S]*?)\nAI_REPORT_END/);
    if (reportMatch) {
      naturalReport = reportMatch[1].trim();
    }

    // Extrair o vídeo gerado de forma robusta via arquivo temporário
    let videoUrl = null;
    try {
      const originalVideoPath = await fs.readFile(videoInfoFile, 'utf8');
      if (originalVideoPath) {
        const publicVideoDir = path.join(process.cwd(), 'public', 'evidences');
        await fs.mkdir(publicVideoDir, { recursive: true });
        
        const newVideoName = `video_${testId}.webm`;
        const newVideoPath = path.join(publicVideoDir, newVideoName);
        
        await fs.copyFile(originalVideoPath.trim(), newVideoPath);
        videoUrl = `/evidences/${newVideoName}`;
      }
      await fs.unlink(videoInfoFile); // limpar temporário
    } catch (e) {
      // Arquivo de vídeo não encontrado ou falha ao copiar
    }

    // Tentar ler as evidências
    let evidencesBase64 = [];

    // Ler evidências de cada passo
    for (let i = 0; i < steps.length; i++) {
      const stepEvidencePath = path.join(process.cwd(), `evidencia_${testId}_${i}.png`);
      try {
        const imageBuffer = await fs.readFile(stepEvidencePath);
        evidencesBase64.push(imageBuffer.toString('base64'));
        await fs.unlink(stepEvidencePath);
      } catch (e) {
        // ignora
      }
    }

    // Ler evidência final do afterEach (capturada em falhas ou no final)
    try {
      const imageBuffer = await fs.readFile(evidenceFile);
      evidencesBase64.push(imageBuffer.toString('base64'));
      await fs.unlink(evidenceFile);
    } catch (e) {
      // console.error("Evidência final não encontrada:", e);
    }

    // Limpar o arquivo de teste
    try {
      await fs.unlink(tempTestFile);
    } catch (e) {
      // Ignorar
    }

    return NextResponse.json({
      success,
      output: commandOutput,
      naturalReport,
      evidencesBase64,
      videoUrl,
      error: success ? null : commandOutput
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
