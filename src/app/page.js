'use client';
import { useEffect, useRef, useState } from 'react';
import { classifyStep, maskPassword, splitSteps, STEP_LABELS, TEMPLATES } from '@/lib/steps';

const URL_PRESETS = [
  { label: 'QA Hub', value: 'https://qa-hub.educacional.com/' },
  { label: 'Produção Hub', value: 'https://hub.educacional.com/' },
  { label: 'Outro endereço', value: '' },
];

const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "Hoje, 08:47" / "Ontem, 13:25" / "25/09/2026, 14:30"
function fmtWhen(iso) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const days = Math.round((new Date(new Date().toDateString()) - new Date(d.toDateString())) / 864e5);
  return days === 0 ? `Hoje, ${time}` : days === 1 ? `Ontem, ${time}` : `${d.toLocaleDateString('pt-BR')}, ${time}`;
}

// Traduz os erros mais comuns para algo que dá para agir; o detalhe técnico continua visível abaixo.
function friendlyError(error = '') {
  if (/Não autorizado/.test(error)) return 'Falta o token de acesso. Informe em "Configurações de acesso".';
  if (/Could not resolve authentication|ANTHROPIC_API_KEY/.test(error)) return 'Esse passo precisou de IA, mas a chave da Anthropic não está configurada no servidor.';
  if (/ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/.test(error)) return 'Não consegui abrir esse endereço. Confira se a URL está certa.';
  if (/Esperava URL contendo/.test(error)) return 'A página que abriu não era a esperada.';
  if (/Timeout|toBeVisible|waitFor/.test(error)) return 'Não encontrei o que esse passo procura na tela a tempo. Confira se o texto está escrito igual ao do site.';
  return null;
}

function stepStatus(result, i) {
  if (result.success) return 'passed';
  if (result.failedStep) return i + 1 < result.failedStep ? 'passed' : i + 1 === result.failedStep ? 'failed' : 'skipped';
  return result.stepEvidences?.[i] ? 'passed' : 'skipped';
}

const STATUS_ICON = { passed: '✓', failed: '✕', skipped: '·' };
const STATUS_LABEL = { passed: 'deu certo', failed: 'não deu certo', skipped: 'não chegou a rodar' };

function ErrorExplained({ error }) {
  const human = friendlyError(error);
  return (
    <div className="error-box">
      {human && <p>{human}</p>}
      <code className={human ? 'raw-error' : ''}>{error}</code>
    </div>
  );
}

export default function Dashboard() {
  const [url, setUrl] = useState('https://qa-hub.educacional.com/');
  const [selectedPreset, setSelectedPreset] = useState('https://qa-hub.educacional.com/');
  const [freeText, setFreeText] = useState('');
  const [status, setStatus] = useState('idle'); // idle, running, done
  const [result, setResult] = useState(null);
  const [ranSteps, setRanSteps] = useState([]);
  const [selected, setSelected] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState({ runs: [], error: null });
  const [historyFilter, setHistoryFilter] = useState('todos');
  const [openRun, setOpenRun] = useState(null);
  const [gen, setGen] = useState({ loading: false, warnings: [], error: null, previous: null });

  // Token: lido do campo na hora de enviar; localStorage só lembra neste navegador. A API valida.
  const tokenRef = useRef(null);
  const authHeaders = () => {
    const t = tokenRef.current?.value;
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history', { headers: authHeaders() });
      const data = await res.json();
      if (res.status === 401) return { runs: [], error: 'Para ver o histórico, informe o token em "Configurações de acesso".' };
      return res.ok ? { runs: data.runs, error: null } : { runs: [], error: data.error };
    } catch (err) {
      return { runs: [], error: `Não consegui carregar o histórico (${err.message}).` };
    }
  };
  const loadHistory = () => fetchHistory().then(setHistory);

  useEffect(() => {
    try { tokenRef.current.value = localStorage.getItem('runTestToken') || ''; } catch {}
    fetchHistory().then(setHistory);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveToken = t => {
    try { localStorage.setItem('runTestToken', t); } catch {}
  };

  const handleUrlPresetChange = e => {
    setSelectedPreset(e.target.value);
    if (e.target.value) setUrl(e.target.value);
  };

  const steps = splitSteps(freeText);
  const aiCount = steps.filter(s => classifyStep(s).kind === 'ai').length;

  useEffect(() => {
    if (status !== 'running') return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Texto livre → passos nos padrões nativos, via IA. Guarda o texto anterior para desfazer.
  const handleGenerate = async () => {
    if (!freeText.trim() || gen.loading) return;
    setGen({ loading: true, warnings: [], error: null, previous: null });
    try {
      const res = await fetch('/api/generate-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text: freeText }),
      });
      const data = await res.json();
      if (!res.ok) return setGen({ loading: false, warnings: [], error: data.error, previous: null });
      setGen({ loading: false, warnings: data.warnings, error: null, previous: freeText });
      setFreeText(data.steps.join('\n'));
    } catch (err) {
      setGen({ loading: false, warnings: [], error: `Erro de rede: ${err.message}`, previous: null });
    }
  };

  const undoGenerate = () => {
    setFreeText(gen.previous);
    setGen({ loading: false, warnings: [], error: null, previous: null });
  };

  const addTemplate = t => setFreeText(prev => (prev.trim() ? prev.trimEnd() + '\n' : '') + t);

  const handleRunTest = async () => {
    if (!steps.length || status === 'running') return;
    setStatus('running');
    setElapsed(0);
    setResult(null);
    setRanSteps(steps);
    try {
      const res = await fetch('/api/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ url, steps, source: 'ui' }),
      });
      const data = await res.json();
      setResult(data);
      // Abre no passo que falhou, ou na tela final
      setSelected(data.failedStep ? data.failedStep - 1 : steps.length);
    } catch (err) {
      setResult({ success: false, error: `Erro de rede ou servidor: ${err.message}` });
      setSelected(0);
    }
    setStatus('done');
    loadHistory();
  };

  const visibleRuns = history.runs.filter(r => historyFilter === 'todos' || r.source === historyFilter);

  // Galeria: um item por passo + tela final
  const shots = result ? [...ranSteps.map((_, i) => result.stepEvidences?.[i]), result.finalEvidence] : [];
  const shotLabel = i => (i === ranSteps.length ? 'Tela final' : `Passo ${i + 1} · ${STEP_LABELS[classifyStep(ranSteps[i]).kind]}`);
  const passedCount = result ? ranSteps.filter((_, i) => stepStatus(result, i) === 'passed').length : 0;
  const failedText = result?.failedStep ? maskPassword(ranSteps[result.failedStep - 1] || '') : null;

  return (
    <div className="container">
      <header className="header">
        <span className="brand"><span className="brand-mark" aria-hidden="true" />Test Flow · Hub Educacional</span>
        <h1>Vamos testar alguma coisa?</h1>
        <p>Descreva o que uma pessoa faria no site, passo a passo. A gente executa num navegador de verdade e te mostra o que aconteceu.</p>
      </header>

      <main className="dashboard-grid">
        {/* ===== ANTES: configuração ===== */}
        <section className="panel">
          <div className="form-group">
            <h2 className="section-title"><span className="section-num">1</span>Onde vamos testar?</h2>
            <label htmlFor="environment">Ambiente</label>
            <select id="environment" value={selectedPreset} onChange={handleUrlPresetChange}>
              {URL_PRESETS.map(preset => (
                <option key={preset.label} value={preset.value}>{preset.label}</option>
              ))}
            </select>
            <label htmlFor="url" className="label-spaced">Endereço de início</label>
            <input id="url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://sua-aplicacao.com" />
          </div>

          <div className="form-group">
            <h2 className="section-title"><span className="section-num">2</span>O que devemos fazer?</h2>
            <textarea
              id="steps"
              aria-label="Passos do teste"
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleRunTest(); }}
              placeholder={'Um passo por linha, do jeito que você explicaria para alguém.\nEx.: entrar com o usuário de teste e clicar em "Avançar"'}
              rows={6}
            />
            <div className="gen-bar">
              <button type="button" className="btn btn-secondary" onClick={handleGenerate} disabled={gen.loading || !freeText.trim()}>
                {gen.loading ? 'Organizando…' : '✨ Organizar com IA'}
              </button>
              {gen.previous !== null && <button type="button" className="chip" onClick={undoGenerate}>↶ Voltar ao meu texto</button>}
            </div>
            <p className="hint">Escreveu do seu jeito? A IA reorganiza nos formatos que o robô entende, e você revisa antes de rodar. Senhas não saem daqui.</p>
            {gen.error && <ErrorExplained error={gen.error} />}
            {gen.warnings.length > 0 && (
              <div className="gen-warnings">
                <strong>O que eu ajustei:</strong>
                <ul>{gen.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}

            <details className="snippets">
              <summary>Prefere escrever no formato exato? Use um modelo</summary>
              <div className="chips">
                {TEMPLATES.map(([name, t]) => (
                  <button key={name} type="button" className="chip" onClick={() => addTemplate(t)}>+ {name}</button>
                ))}
              </div>
            </details>
          </div>

          {steps.length > 0 && (
            <div className="preview">
              <div className="preview-head">
                <span>Entendi assim ({plural(steps.length, 'passo', 'passos')}):</span>
                <span className={aiCount ? 'tag tag-ai' : 'tag tag-native'}>
                  {aiCount ? `${plural(aiCount, 'passo precisa', 'passos precisam')} de IA` : 'Nenhum passo depende de IA'}
                </span>
              </div>
              <ol className="step-list">
                {steps.map((s, i) => {
                  const kind = classifyStep(s).kind;
                  return (
                    <li key={i} className="step-row">
                      <span className="step-number">{i + 1}</span>
                      <span className="step-text">{maskPassword(s)}</span>
                      <span className={kind === 'ai' ? 'tag tag-ai' : 'tag tag-native'}>{kind === 'ai' ? 'IA' : STEP_LABELS[kind]}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <details className="settings">
            <summary>Configurações de acesso</summary>
            <label htmlFor="token">Token de acesso</label>
            <input
              id="token"
              type="password"
              ref={tokenRef}
              onChange={e => saveToken(e.target.value)}
              onBlur={() => loadHistory()}
              placeholder="Só se o servidor pedir (RUN_TEST_TOKEN)"
              autoComplete="off"
            />
            <p className="hint">Fica guardado só neste navegador.</p>
          </details>

          <button className="btn btn-primary" onClick={handleRunTest} disabled={status === 'running' || !steps.length}>
            {status === 'running' ? `Testando… ${fmtTime(elapsed)}` : 'Começar o teste'}
          </button>
          <p className="hint center">ou <kbd>Ctrl</kbd> + <kbd>Enter</kbd> no campo de passos</p>
        </section>

        {/* ===== DEPOIS: resultado ===== */}
        <section className="panel result-viewer" aria-live="polite">
          {status === 'idle' && (
            <div className="empty-state">
              <svg width="96" height="72" viewBox="0 0 96 72" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="88" height="60" rx="10" stroke="currentColor" strokeWidth="2.5" />
                <path d="M4 18h88" stroke="currentColor" strokeWidth="2.5" />
                <circle cx="14" cy="11" r="2.5" fill="currentColor" /><circle cx="22" cy="11" r="2.5" fill="currentColor" />
                <path d="M34 38c4 5 12 5 16 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="35" cy="30" r="2.5" fill="currentColor" /><circle cx="49" cy="30" r="2.5" fill="currentColor" />
                <path d="M66 40l12 8-6 1.5-2.5 6z" fill="var(--warm)" />
              </svg>
              <h2>Pronto quando você estiver</h2>
              <p className="hint">Assim que o teste começar, eu mostro aqui cada passo, com prints e a gravação da tela.</p>
            </div>
          )}

          {status === 'running' && (
            <div className="empty-state">
              <div className="spinner" />
              <h2>Estou navegando no site…</h2>
              <p className="timer">{fmtTime(elapsed)}</p>
              <p className="hint">Seguindo {plural(ranSteps.length, 'passo', 'passos')}, com calma. Costuma levar um ou dois minutos.</p>
            </div>
          )}

          {status === 'done' && result && (
            <>
              <div className={`summary ${result.success ? 'summary-ok' : 'summary-fail'}`}>
                <div className="summary-icon" aria-hidden="true">{result.success ? '✓' : '!'}</div>
                <div>
                  <strong>{result.success ? 'Deu tudo certo!' : 'Algo não saiu como esperado'}</strong>
                  <span>
                    {result.success
                      ? `${ranSteps.length === 1 ? 'O passo funcionou' : `Os ${ranSteps.length} passos funcionaram`} em ${fmtTime(elapsed)}.`
                      : failedText
                        ? `Parou no passo ${result.failedStep} de ${ranSteps.length}: ${failedText}`
                        : `${passedCount} de ${ranSteps.length} passos funcionaram.`}
                  </span>
                </div>
              </div>
              {!result.success && result.error && <ErrorExplained error={result.error} />}

              {shots.some(Boolean) && (
                <figure className="viewer">
                  {shots[selected]
                    ? <img src={`data:image/png;base64,${shots[selected]}`} alt={shotLabel(selected)} className="evidence-img" />
                    : <div className="empty-state">Esse passo não chegou a rodar, então não tem print.</div>}
                  <figcaption>{shotLabel(selected)}</figcaption>
                </figure>
              )}

              <ol className="timeline">
                {ranSteps.map((s, i) => {
                  const st = stepStatus(result, i);
                  return (
                    <li key={i}>
                      <button type="button" className={`timeline-item ${st} ${selected === i ? 'active' : ''}`} onClick={() => setSelected(i)}>
                        <span className={`status-dot ${st}`} aria-label={STATUS_LABEL[st]}>{STATUS_ICON[st]}</span>
                        <span className="step-text">{maskPassword(s)}</span>
                        {shots[i] && <img src={`data:image/png;base64,${shots[i]}`} alt="" className="thumb" />}
                      </button>
                    </li>
                  );
                })}
                {result.finalEvidence && (
                  <li>
                    <button type="button" className={`timeline-item ${selected === ranSteps.length ? 'active' : ''}`} onClick={() => setSelected(ranSteps.length)}>
                      <span className="status-dot final" aria-hidden="true">■</span>
                      <span className="step-text">Como a tela ficou no final</span>
                      <img src={`data:image/png;base64,${result.finalEvidence}`} alt="" className="thumb" />
                    </button>
                  </li>
                )}
              </ol>

              {result.videoUrl && (
                <details className="details">
                  <summary>Assistir à gravação</summary>
                  <video controls src={result.videoUrl} />
                </details>
              )}
              {result.output && (
                <details className="details">
                  <summary>Ver o log técnico</summary>
                  <pre className="status-log">{result.output}</pre>
                </details>
              )}
            </>
          )}
        </section>
      </main>

      {/* ===== HISTÓRICO: interface + n8n ===== */}
      <section className="panel history">
        <div className="history-head">
          <h2 className="section-title">O que já foi testado</h2>
          <div className="chips">
            {[['todos', 'Tudo'], ['interface', 'Feitos aqui'], ['n8n', 'Vindos do n8n']].map(([f, label]) => (
              <button key={f} type="button" className={`chip ${historyFilter === f ? 'chip-active' : ''}`} onClick={() => setHistoryFilter(f)} aria-pressed={historyFilter === f}>
                {label}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => loadHistory()}>↻ Atualizar</button>
          </div>
        </div>

        {history.error && <ErrorExplained error={history.error} />}
        {!history.error && visibleRuns.length === 0 && <p className="hint">Nada por aqui ainda. Seu primeiro teste vai aparecer nesta lista.</p>}

        <ol className="history-list">
          {visibleRuns.map(run => {
            const open = openRun === run.id;
            const st = i => stepStatus({ success: run.success, failedStep: run.failedStep, stepEvidences: run.evidenced }, i);
            const passed = run.steps.filter((_, i) => st(i) === 'passed').length;
            return (
              <li key={run.id}>
                <button type="button" className={`history-row ${open ? 'active' : ''}`} onClick={() => setOpenRun(open ? null : run.id)} aria-expanded={open}>
                  <span className={`status-dot ${run.success ? 'passed' : 'failed'}`} aria-label={run.success ? 'passou' : 'falhou'}>{run.success ? '✓' : '✕'}</span>
                  <span className="history-date">{fmtWhen(run.at)}</span>
                  <span className={`tag ${run.source === 'n8n' ? 'tag-ai' : 'tag-native'}`}>{run.source === 'n8n' ? 'n8n · ClickUp' : 'Você'}</span>
                  <span className="step-text">{run.url}</span>
                  <span className="history-meta">{passed}/{run.steps.length} passos · {fmtTime(Math.round(run.durationMs / 1000))}</span>
                </button>
                {open && (
                  <div className="history-detail">
                    {!run.success && run.error && <ErrorExplained error={run.error} />}
                    <ol className="timeline">
                      {run.steps.map((s, i) => (
                        <li key={i} className="timeline-item static">
                          <span className={`status-dot ${st(i)}`} aria-label={STATUS_LABEL[st(i)]}>{STATUS_ICON[st(i)]}</span>
                          <span className="step-text">{s}</span>
                        </li>
                      ))}
                    </ol>
                    {run.videoUrl && <video controls preload="none" src={run.videoUrl} />}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
