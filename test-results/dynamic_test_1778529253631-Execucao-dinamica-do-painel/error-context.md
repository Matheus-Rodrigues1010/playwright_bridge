# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dynamic_test_1778529253631.spec.js >> Execucao dinamica do painel
- Location: dynamic_test_1778529253631.spec.js:32:5

# Error details

```
TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('text=Administrador').first() to be visible

```

# Test source

```ts
  18  |     
  19  |     // Fecha a página para finalizar o arquivo de vídeo
  20  |     const videoObj = page.video();
  21  |     await page.close();
  22  |     
  23  |     if (videoObj) {
  24  |       const videoPath = await videoObj.path();
  25  |       require('fs').writeFileSync("C:\\Users\\Matheus\\Desktop\\Files\\Automation Positivo\\AI\\dashboard-ia\\video_info_1778529253631.txt", videoPath, 'utf8');
  26  |     }
  27  |   } catch (e) {
  28  |     console.error("Falha ao gerar evidencia no afterEach", e);
  29  |   }
  30  | });
  31  | 
  32  | test('Execucao dinamica do painel', async ({ page }) => {
  33  |   test.setTimeout(300000); // 5 minutos
  34  |   const aiArgs = { page, test };
  35  | 
  36  |   await test.step('Acessar URL Base', async () => {
  37  |     await page.goto('https://hub.educacional.com', { waitUntil: 'domcontentloaded' });
  38  |   });
  39  |   
  40  |     await test.step('Passo 1 - Login', async () => {
  41  |       try {
  42  |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  43  |         
  44  |         const emailField = page.locator('input[type="email"], input[type="text"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[placeholder*="email" i], input[placeholder*="usu" i], input[placeholder*="acesso" i]').first();
  45  |         await emailField.waitFor({ state: 'visible', timeout: 15000 });
  46  |         await emailField.click();
  47  |         await emailField.fill("mrsantos@positivo.com.br ");
  48  |         
  49  |         const passField = page.locator('input[type="password"]').first();
  50  |         await passField.waitFor({ state: 'visible', timeout: 5000 });
  51  |         await passField.click();
  52  |         await passField.fill("Positivo@Cits25");
  53  |         
  54  |         const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar"), button:has-text("Avançar"), button:has-text("Sign in"), button:has-text("Continuar")').first();
  55  |         await submitBtn.click();
  56  |         
  57  |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  58  |         await page.waitForTimeout(3000);
  59  |       } finally {
  60  |         try {
  61  |           await page.waitForTimeout(1000);
  62  |           await page.screenshot({ path: "C:\\Users\\Matheus\\Desktop\\Files\\Automation Positivo\\AI\\dashboard-ia\\evidencia_1778529253631_0.png", fullPage: true });
  63  |         } catch (e) { console.error("Falha evidencia", e); }
  64  |       }
  65  |     });
  66  | 
  67  |     await test.step('Passo 2 - Busca', async () => {
  68  |       try {
  69  |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  70  |         await page.waitForTimeout(2000);
  71  |         
  72  |         let searchField = null;
  73  |         
  74  |         // Estratégia 1: campos com atributos de busca
  75  |         const specificSearch = page.locator('input[type="search"], input[placeholder*="busc" i], input[placeholder*="pesquis" i], input[placeholder*="filtr" i], input[placeholder*="search" i], input[role="searchbox"]').first();
  76  |         if (await specificSearch.isVisible().catch(() => false)) {
  77  |           searchField = specificSearch;
  78  |         }
  79  |         
  80  |         // Estratégia 2: qualquer input de texto visível (exceto senha)
  81  |         if (!searchField) {
  82  |           const textInputs = page.locator('input[type="text"]:visible, input:not([type]):visible').filter({ hasNot: page.locator('[type="password"], [type="hidden"], [type="email"]') });
  83  |           const count = await textInputs.count();
  84  |           if (count > 0) {
  85  |             searchField = textInputs.first();
  86  |           }
  87  |         }
  88  |         
  89  |         // Estratégia 3: qualquer textbox via role
  90  |         if (!searchField) {
  91  |           const roleTextbox = page.getByRole('textbox').first();
  92  |           if (await roleTextbox.isVisible().catch(() => false)) {
  93  |             searchField = roleTextbox;
  94  |           }
  95  |         }
  96  |         
  97  |         if (searchField) {
  98  |           await searchField.click();
  99  |           await searchField.fill("Escola de Qualidade");
  100 |           await page.waitForTimeout(2000);
  101 |         } else {
  102 |           throw new Error('Não foi possível encontrar o campo de busca na página.');
  103 |         }
  104 |       } finally {
  105 |         try {
  106 |           await page.waitForTimeout(1000);
  107 |           await page.screenshot({ path: "C:\\Users\\Matheus\\Desktop\\Files\\Automation Positivo\\AI\\dashboard-ia\\evidencia_1778529253631_1.png", fullPage: true });
  108 |         } catch (e) { console.error("Falha evidencia", e); }
  109 |       }
  110 |     });
  111 | 
  112 |     await test.step('Passo 3 - Clique', async () => {
  113 |       try {
  114 |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  115 |         await page.waitForTimeout(1000);
  116 |         
  117 |         const target = page.locator('text=Administrador').first();
> 118 |         await target.waitFor({ state: 'visible', timeout: 10000 });
      |                      ^ TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
  119 |         await target.scrollIntoViewIfNeeded();
  120 |         await target.click();
  121 |         
  122 |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  123 |         await page.waitForTimeout(2000);
  124 |       } finally {
  125 |         try {
  126 |           await page.waitForTimeout(1000);
  127 |           await page.screenshot({ path: "C:\\Users\\Matheus\\Desktop\\Files\\Automation Positivo\\AI\\dashboard-ia\\evidencia_1778529253631_2.png", fullPage: true });
  128 |         } catch (e) { console.error("Falha evidencia", e); }
  129 |       }
  130 |     });
  131 | 
  132 |     await test.step('Passo 4 - Verificação', async () => {
  133 |       try {
  134 |         await page.waitForTimeout(3000);
  135 |         
  136 |         const currentUrl = page.url();
  137 |         if (!currentUrl.includes("/home")) {
  138 |           throw new Error('Esperava URL contendo "/home" mas encontrou: ' + currentUrl);
  139 |         }
  140 |       } finally {
  141 |         try {
  142 |           await page.waitForTimeout(1000);
  143 |           await page.screenshot({ path: "C:\\Users\\Matheus\\Desktop\\Files\\Automation Positivo\\AI\\dashboard-ia\\evidencia_1778529253631_3.png", fullPage: true });
  144 |         } catch (e) { console.error("Falha evidencia", e); }
  145 |       }
  146 |     });
  147 | 
  148 |     await test.step('Passo 5 - Clique', async () => {
  149 |       try {
  150 |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  151 |         await page.waitForTimeout(1000);
  152 |         
  153 |         const target = page.locator('text=Gerenciamento de dados').first();
  154 |         await target.waitFor({ state: 'visible', timeout: 10000 });
  155 |         await target.scrollIntoViewIfNeeded();
  156 |         await target.click();
  157 |         
  158 |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  159 |         await page.waitForTimeout(2000);
  160 |       } finally {
  161 |         try {
  162 |           await page.waitForTimeout(1000);
  163 |           await page.screenshot({ path: "C:\\Users\\Matheus\\Desktop\\Files\\Automation Positivo\\AI\\dashboard-ia\\evidencia_1778529253631_4.png", fullPage: true });
  164 |         } catch (e) { console.error("Falha evidencia", e); }
  165 |       }
  166 |     });
  167 | 
  168 |     await test.step('Passo 6 - IA', async () => {
  169 |       try {
  170 |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  171 |         await page.waitForTimeout(1000);
  172 |         await ai("Clique em \"Meus usuários\"", aiArgs);
  173 |       } finally {
  174 |         try {
  175 |           await page.waitForTimeout(1000);
  176 |           await page.screenshot({ path: "C:\\Users\\Matheus\\Desktop\\Files\\Automation Positivo\\AI\\dashboard-ia\\evidencia_1778529253631_5.png", fullPage: true });
  177 |         } catch (e) { console.error("Falha evidencia", e); }
  178 |       }
  179 |     });
  180 | 
  181 |     await test.step('Passo 7 - IA', async () => {
  182 |       try {
  183 |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  184 |         await page.waitForTimeout(1000);
  185 |         await ai("Clique em \"Novo usuário\"", aiArgs);
  186 |       } finally {
  187 |         try {
  188 |           await page.waitForTimeout(1000);
  189 |           await page.screenshot({ path: "C:\\Users\\Matheus\\Desktop\\Files\\Automation Positivo\\AI\\dashboard-ia\\evidencia_1778529253631_6.png", fullPage: true });
  190 |         } catch (e) { console.error("Falha evidencia", e); }
  191 |       }
  192 |     });
  193 | 
  194 |     await test.step('Passo 8 - IA', async () => {
  195 |       try {
  196 |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  197 |         await page.waitForTimeout(1000);
  198 |         await ai("Clique em \"Atribuir perfil\"", aiArgs);
  199 |       } finally {
  200 |         try {
  201 |           await page.waitForTimeout(1000);
  202 |           await page.screenshot({ path: "C:\\Users\\Matheus\\Desktop\\Files\\Automation Positivo\\AI\\dashboard-ia\\evidencia_1778529253631_7.png", fullPage: true });
  203 |         } catch (e) { console.error("Falha evidencia", e); }
  204 |       }
  205 |     });
  206 | 
  207 |     await test.step('Passo 9 - IA', async () => {
  208 |       try {
  209 |         await page.waitForLoadState('domcontentloaded').catch(() => {});
  210 |         await page.waitForTimeout(1000);
  211 |         await ai("Clique em \"Estudante\"", aiArgs);
  212 |       } finally {
  213 |         try {
  214 |           await page.waitForTimeout(1000);
  215 |           await page.screenshot({ path: "C:\\Users\\Matheus\\Desktop\\Files\\Automation Positivo\\AI\\dashboard-ia\\evidencia_1778529253631_8.png", fullPage: true });
  216 |         } catch (e) { console.error("Falha evidencia", e); }
  217 |       }
  218 |     });
```