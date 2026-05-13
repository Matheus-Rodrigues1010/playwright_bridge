'use client';
import { useState } from 'react';

export default function Dashboard() {
  const [url, setUrl] = useState('https://qa-hub.educacional.com');
  const [freeText, setFreeText] = useState('');
  const [status, setStatus] = useState('idle'); // idle, running, success, error
  const [logs, setLogs] = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState([]);
  const [videoUrl, setVideoUrl] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleRunTest = async () => {
    setStatus('running');
    setLogs('Iniciando o teste dinâmico...\nPor favor aguarde, a Inteligência Artificial está navegando na página.');
    setEvidenceUrls([]);
    setVideoUrl(null);
    setCurrentImageIndex(0);

    try {
      // Quebra o texto pelo separador | ou por quebra de linha.
      // Vírgulas NÃO quebram, permitindo agrupar ações no mesmo passo para economizar créditos.
      const stepsArray = freeText.trim()
        ? freeText.split(/[|\n]+/).map(s => s.trim()).filter(s => s.length > 0)
        : [];

      const res = await fetch('/api/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, steps: stepsArray })
      });

      const data = await res.json();
      
      let urls = [];
      if (data.evidencesBase64 && data.evidencesBase64.length > 0) {
        urls = data.evidencesBase64.map(b64 => `data:image/png;base64,${b64}`);
      } else if (data.evidenceBase64) {
        urls = [`data:image/png;base64,${data.evidenceBase64}`];
      }
      
      if (data.success) {
        setStatus('success');
        const reportText = data.naturalReport ? data.naturalReport : "Relatório gerado com sucesso.";
        setLogs('Teste finalizado com sucesso!\\n\\n📋 Relatório do Teste:\\n\\n' + reportText);
        setEvidenceUrls(urls);
        setVideoUrl(data.videoUrl || null);
      } else {
        setStatus('error');
        setLogs(`O teste falhou ou estourou o tempo limite.\nDetalhes do erro:\n${data.error}\n\nMesmo com erro, as evidências foram capturadas (se disponíveis).`);
        setEvidenceUrls(urls);
        setVideoUrl(data.videoUrl || null);
      }
    } catch (err) {
      setStatus('error');
      setLogs(`Erro de rede ou servidor: ${err.message}`);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>AI Test Flow Builder</h1>
        <p>Crie e execute testes E2E em linguagem natural usando ZeroStep</p>
      </header>

      <main className="dashboard-grid">
        <section className="glass-panel" style={{ padding: '2rem' }}>
          <h2 className="section-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Configuração do Teste
          </h2>
          
          <div className="form-group">
            <label>URL Inicial</label>
            <input 
              type="url" 
              value={url} 
              onChange={e => setUrl(e.target.value)}
              placeholder="https://sua-aplicacao.com" 
            />
          </div>

          <div className="form-group">
            <label>Como estruturar seu teste</label>
            <div className="example-box" style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ marginTop: 0, marginBottom: '0.5rem', fontWeight: 'bold' }}>Dicas para o Modo Rápido (0 Créditos):</p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
                <li style={{ marginBottom: '0.5rem' }}><strong>Login:</strong> <code>Preencha os campos de login com usuário "teste@email.com" e senha "suasenha" e clique em Entrar</code></li>
                <li style={{ marginBottom: '0.5rem' }}><strong>Busca:</strong> <code>Busque por "termo" no campo de pesquisa</code></li>
                <li style={{ marginBottom: '0.5rem' }}><strong>Clique:</strong> <code>Clique no texto "Opção Desejada"</code></li>
                <li style={{ marginBottom: '0.5rem' }}><strong>CPF Válido:</strong> <code>Preencha um CPF válido no campo "Documento"</code></li>
                <li><strong>Verificação:</strong> <code>Verifique se a tela inicial /dashboard está sendo exibida</code></li>
              </ul>
            </div>
          </div>

          <div className="form-group">
            <label>Instruções do Teste (Digitação Livre)</label>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              Use <strong style={{ color: '#a78bfa' }}>|</strong> (barra vertical) para separar os passos. O robô usará execução nativa sempre que reconhecer os padrões acima.
            </p>
            <textarea 
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder='Preencha os campos de login com usuário "demo@email.com" e senha "senha123" e clique em Entrar | Busque por "Relatórios" | Clique no texto "Exportar" | Verifique se a tela /exportacao está sendo exibida'
              rows={5}
              style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', resize: 'vertical', fontSize: '1rem', fontFamily: 'inherit' }}
            />
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleRunTest}
            disabled={status === 'running'}
          >
            {status === 'running' ? 'Executando Teste...' : 'Executar Teste com IA'}
          </button>
        </section>

        <section className="glass-panel result-viewer" style={{ padding: '2rem' }}>
          <h2 className="section-title">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            Evidência (Resultado)
          </h2>
          
          <div className="evidence-container">
            {status === 'idle' && (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                <p>Nenhum teste executado ainda.<br/>Configure os passos e clique em Executar.</p>
              </div>
            )}
            
            {status === 'running' && (
              <div className="empty-state">
                <div className="spinner"></div>
                <p>O robô com Inteligência Artificial está<br/>navegando no site. Isso pode levar alguns minutos...</p>
              </div>
            )}

            {(status === 'success' || status === 'error') && evidenceUrls.length === 0 && (
              <div className="empty-state">
                <p>O teste finalizou, mas não foi possível carregar as evidências.</p>
              </div>
            )}

            {(status === 'success' || status === 'error') && videoUrl && (
              <div style={{ marginBottom: '2rem', width: '100%', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '1rem', color: '#e2e8f0', fontSize: '1.1rem' }}>🎥 Gravação do Teste</h3>
                <video 
                  controls 
                  src={videoUrl} 
                  style={{ width: '100%', maxWidth: '800px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Seu navegador não suporta a tag de vídeo.
                </video>
              </div>
            )}

            {(status === 'success' || status === 'error') && evidenceUrls.length > 0 && (
              <div className="gallery">
                <h3 style={{ marginBottom: '1rem', color: '#e2e8f0', fontSize: '1.1rem', textAlign: 'center' }}>📸 Último Estado da Tela</h3>
                <div className="gallery-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%', height: '100%' }}>
                  <button 
                    className="gallery-nav prev"
                    onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : prev)}
                    disabled={currentImageIndex === 0}
                    style={{ position: 'absolute', left: '10px', zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.5rem', cursor: 'pointer', opacity: currentImageIndex === 0 ? 0.3 : 1 }}
                  >
                    &lt;
                  </button>
                  <img 
                    src={evidenceUrls[currentImageIndex]} 
                    alt={`Evidência Passo ${currentImageIndex + 1}`} 
                    className="evidence-img" 
                  />
                  <button 
                    className="gallery-nav next"
                    onClick={() => setCurrentImageIndex(prev => prev < evidenceUrls.length - 1 ? prev + 1 : prev)}
                    disabled={currentImageIndex === evidenceUrls.length - 1}
                    style={{ position: 'absolute', right: '10px', zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '1.5rem', cursor: 'pointer', opacity: currentImageIndex === evidenceUrls.length - 1 ? 0.3 : 1 }}
                  >
                    &gt;
                  </button>
                </div>
                <div className="gallery-indicator" style={{ textAlign: 'center', marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                  Passo {currentImageIndex + 1} de {evidenceUrls.length}
                </div>
              </div>
            )}
          </div>

          {logs && (
            <div className="status-log" style={{ color: status === 'error' ? '#ef4444' : '#38bdf8' }}>
              {logs}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
