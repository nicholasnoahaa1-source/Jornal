const now = Date.now();
const d = h => new Date(now - h * 3600e3).toUTCString();
const item = (title, source, url, h) => `<item><title>${title} - ${source}</title><link>https://news.google.com/rss/articles/x${Math.random()}</link><pubDate>${d(h)}</pubDate><source url="${url}">${source}</source></item>`;
module.exports = `<?xml version="1.0"?><rss><channel>
${item('Neymar é alvo de boato de morte nas redes; assessoria desmente', 'g1', 'https://g1.globo.com', 3)}
${item('É falso que Neymar morreu, mostra checagem', 'Aos Fatos', 'https://www.aosfatos.org', 5)}
${item('Neymar morreu? Entenda o boato que viralizou', 'Folha de S.Paulo', 'https://www.folha.uol.com.br', 8)}
${item('Assessoria de Neymar nega morte do jogador', 'UOL', 'https://www.uol.com.br', 9)}
${item('Neymar treina e se prepara para o próximo jogo', 'ge', 'https://ge.globo.com', 30)}
${item('Neymar morreu em acidente, diz site', 'Notícias do Dia Já', 'https://noticiasdiaja.example', 2)}
${item('Sensacionalista: Neymar morre de tanto rolar', 'Sensacionalista', 'https://www.sensacionalista.com.br', 20)}
${item('Time anuncia reforço para a temporada', 'Lance!', 'https://www.lance.com.br', 400)}
</channel></rss>`;
