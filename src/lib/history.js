// Histórico de execuções (interface e n8n): uma linha JSON por teste.
import fs from 'fs/promises';
import path from 'path';

const FILE = path.join(process.cwd(), 'data', 'history.jsonl');

export async function addRun(run) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.appendFile(FILE, JSON.stringify(run) + '\n', 'utf-8');
}

// ponytail: lê o arquivo inteiro a cada consulta; trocar por SQLite se passar de dezenas de milhares de execuções.
export async function listRuns(limit = 200) {
  const text = await fs.readFile(FILE, 'utf-8').catch(() => '');
  return text.split('\n').filter(Boolean).slice(-limit).reverse().flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; } // ignora linha corrompida
  });
}
