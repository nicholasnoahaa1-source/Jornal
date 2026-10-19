// Matéria própria, análise de confiabilidade e ilustração via API do Gemini.
// Funções puras devolvem { status, headers, body }, para servir tanto a Vercel quanto o servidor local.
const crypto = require('crypto');

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const textModel = () => process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const imageModel = () => process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const VERDICTS = ['confiavel', 'parcial', 'pouco_confiavel', 'nao_verificado'];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function cleanQuery(q) {
  const title = String(q.title || '').trim().slice(0, 300);
  const source = String(q.source || '').trim().slice(0, 100);
  const date = String(q.date || '').trim().slice(0, 40);
  const link = String(q.link || '').trim().slice(0, 800);
  if (title.length < 8) throw new HttpError(400, 'Manchete ausente ou curta demais.');
  if (link && !/^https?:\/\//i.test(link)) throw new HttpError(400, 'Link inválido.');
  return { title, source, date, link };
}

function articlePrompt({ title, source, date, link }) {
  return `Você é editor de um jornal brasileiro. Uma manchete chegou de um feed público e você vai apurar a história.

Manchete: ${title}
Veículo: ${source || 'desconhecido'}
Publicada em: ${date || 'data desconhecida'}
Link: ${link || 'não informado'}

Faça, nesta ordem:
1. Leia a matéria no link, se conseguir, e pesquise na web o mesmo assunto em outros veículos.
2. Cruze as versões. Veja se os veículos concordam nos fatos, se há fonte primária citada (documento, órgão oficial, pessoa nomeada), se a manchete exagera o que o texto diz e se há sinais de boato, sátira ou conteúdo requentado.
3. Escreva uma matéria nova, com suas palavras, usando só o que foi confirmado. Não invente aspas, números, nomes nem datas. Se algo não foi confirmado, diga isso no texto.
4. Julgue a confiabilidade da notícia, com palavras e razões, sem nota numérica.

Responda SOMENTE com um objeto JSON, sem markdown, neste formato:
{
  "titulo": "manchete própria, direta, sem exagero",
  "linhaFina": "uma frase que resume o fato",
  "corpo": ["parágrafo 1", "parágrafo 2", "...de 4 a 7 parágrafos"],
  "veredito": "confiavel | parcial | pouco_confiavel | nao_verificado",
  "resumoVeredito": "duas frases explicando o veredito",
  "motivos": ["razão concreta 1", "razão concreta 2"],
  "alertas": ["ponto de atenção, se houver; lista vazia se não houver"],
  "leituraDaMateria": "leu a matéria original por completo | leu parte | não conseguiu abrir o link",
  "imagem": "descrição de uma ilustração editorial para a matéria, sem pessoas reais identificáveis, sem texto escrito na imagem",
  "legendaImagem": "legenda curta"
}

Regras de escrita: português do Brasil, tom de jornal, frases curtas. Não use travessão. Use "confiavel" só quando fontes independentes e confiáveis concordam. Use "nao_verificado" se não achou nada além da própria manchete.`;
}

function extractJson(text) {
  const s = String(text || '').replace(/```json|```/gi, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('Resposta sem JSON.');
  return JSON.parse(s.slice(a, b + 1));
}

function normalizeArticle(raw) {
  const arr = v => (Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : []);
  const corpo = arr(raw.corpo);
  if (!raw.titulo || !corpo.length) throw new Error('Matéria incompleta.');
  return {
    titulo: String(raw.titulo).trim(),
    linhaFina: String(raw.linhaFina || '').trim(),
    corpo,
    veredito: VERDICTS.includes(raw.veredito) ? raw.veredito : 'nao_verificado',
    resumoVeredito: String(raw.resumoVeredito || '').trim(),
    motivos: arr(raw.motivos),
    alertas: arr(raw.alertas),
    leituraDaMateria: String(raw.leituraDaMateria || '').trim(),
    imagem: String(raw.imagem || '').trim().slice(0, 500),
    legendaImagem: String(raw.legendaImagem || '').trim()
  };
}

// Fontes reais: as páginas que o Gemini consultou na busca, e não links escritos pelo modelo.
function extractSources(candidate, original) {
  const out = [], seen = new Set();
  const add = (title, uri) => {
    if (!uri || seen.has(uri)) return;
    seen.add(uri); out.push({ title: title || uri, uri });
  };
  if (original.link) add(original.source ? `${original.source} (matéria de origem)` : 'Matéria de origem', original.link);
  for (const c of candidate?.groundingMetadata?.groundingChunks || []) add(c.web?.title, c.web?.uri);
  return out.slice(0, 10);
}

function sign(text) {
  return crypto.createHmac('sha256', process.env.GEMINI_API_KEY || '').update(text).digest('hex').slice(0, 32);
}

async function generate(model, body, fetchImpl) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(503, 'Defina a variável GEMINI_API_KEY para gerar matérias.');
  const r = await fetchImpl(`${BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(50000)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(r.status === 429 ? 429 : 502, data.error?.message || `Gemini respondeu ${r.status}`);
  return data;
}

async function handleArticle(query, fetchImpl = fetch) {
  const json = (status, obj, headers = {}) => ({
    status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers }, body: JSON.stringify(obj)
  });
  try {
    const q = cleanQuery(query);
    const base = { contents: [{ parts: [{ text: articlePrompt(q) }] }], generationConfig: { temperature: 0.3 } };
    let data;
    try {
      data = await generate(textModel(), { ...base, tools: [{ google_search: {} }, { url_context: {} }] }, fetchImpl);
    } catch (e) {
      if (e.status !== 502) throw e;
      data = await generate(textModel(), { ...base, tools: [{ google_search: {} }] }, fetchImpl);
    }
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts || []).map(p => p.text || '').join('');
    const article = normalizeArticle(extractJson(text));
    const imageUrl = article.imagem
      ? `/api/image?p=${encodeURIComponent(article.imagem)}&sig=${sign(article.imagem)}` : '';
    return json(200, {
      article, imageUrl, sources: extractSources(cand, q),
      model: textModel(), generatedAt: new Date().toISOString()
    }, { 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' });
  } catch (e) {
    const status = e.status || 502;
    const msg = e instanceof HttpError ? e.message : 'Não consegui montar a matéria agora.';
    return json(status, { error: msg });
  }
}

async function handleImage(query, fetchImpl = fetch) {
  const err = (status, message) => ({ status, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: message });
  try {
    const prompt = String(query.p || '').slice(0, 500);
    if (prompt.length < 10) return err(400, 'Prompt ausente.');
    const given = String(query.sig || '');
    const want = sign(prompt);
    if (given.length !== want.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(want))) {
      return err(403, 'Assinatura inválida.');
    }
    const styled = `Ilustração editorial para jornal impresso: ${prompt}. Paleta restrita a vermelho, preto e branco, traço gráfico, composição forte, sem texto, sem letras, sem logotipos, sem rosto de pessoa real.`;
    const data = await generate(imageModel(), {
      contents: [{ parts: [{ text: styled }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    }, fetchImpl);
    const part = (data.candidates?.[0]?.content?.parts || []).find(p => p.inlineData || p.inline_data);
    const inline = part && (part.inlineData || part.inline_data);
    if (!inline?.data) return err(502, 'O Gemini não devolveu imagem.');
    return {
      status: 200,
      headers: {
        'content-type': inline.mimeType || inline.mime_type || 'image/png',
        'cache-control': 'public, max-age=31536000, immutable'
      },
      body: Buffer.from(inline.data, 'base64')
    };
  } catch (e) {
    return err(e.status || 502, e instanceof HttpError ? e.message : 'Falha ao gerar a imagem.');
  }
}

module.exports = { handleArticle, handleImage, cleanQuery, extractJson, normalizeArticle, extractSources, sign, HttpError };
