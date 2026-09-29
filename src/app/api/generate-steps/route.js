import { NextResponse } from 'next/server';
import { authorized, unauthorized } from '@/lib/auth';
import { generateSteps } from '@/lib/claude-ai';

export async function POST(request) {
  if (!authorized(request)) return unauthorized();
  const { text } = await request.json();
  if (!text?.trim()) return NextResponse.json({ error: 'Texto do roteiro é obrigatório.' }, { status: 400 });
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ error: 'Configure GEMINI_API_KEY ou ANTHROPIC_API_KEY no .env para gerar passos com IA.' }, { status: 503 });
  }
  try {
    return NextResponse.json(await generateSteps(text));
  } catch (e) {
    return NextResponse.json({ error: `Falha ao gerar passos: ${e.message}` }, { status: 502 });
  }
}
