/**
 * Coleta pesquisas eleitorais para governador de todos os 27 estados
 * brasileiros a partir da Wikipédia (páginas "Pesquisas eleitorais para
 * a eleição estadual de 2026 em [Estado]") e grava os dados brutos na
 * aba "Pesquisas Brutas".
 *
 * Cadência: gatilho semanal (time-driven trigger) configurado direto
 * no editor de Apps Script da planilha.
 */
function atualizarPesquisasTodosEstados() {
  const SHEET_NAME = 'Pesquisas Brutas';

  const ESTADOS = [
    'Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará',
    'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso',
    'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná',
    'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte',
    'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina',
    'São Paulo', 'Sergipe', 'Tocantins'
  ];

  function normalizar(txt) {
    return txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function buscarPesquisaWikipedia(nomeEstado) {
    try {
      const urlBusca = 'https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=' +
        encodeURIComponent('Pesquisas eleitorais eleição estadual 2026 ' + nomeEstado) +
        '&format=json&formatversion=2&srlimit=10';
      const respBusca = UrlFetchApp.fetch(urlBusca, { muteHttpExceptions: true });
      const jsonBusca = JSON.parse(respBusca.getContentText('UTF-8'));
      if (!jsonBusca.query || jsonBusca.query.search.length === 0) return { erro: 'página não encontrada' };

      const nomeEstadoNorm = normalizar(nomeEstado);
      const candidatoValido = jsonBusca.query.search.find(function (r) {
        const tituloNorm = normalizar(r.title);
        const comecaCorreto = tituloNorm.indexOf('pesquisas eleitorais') === 0;
        const terminaExato = tituloNorm.endsWith(nomeEstadoNorm);
        return comecaCorreto && terminaExato;
      });
      if (!candidatoValido) return { erro: 'nenhuma página de pesquisas eleitorais bate exatamente com este estado' };
      const tituloPagina = candidatoValido.title;

      const urlParse = 'https://pt.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&page=' +
        encodeURIComponent(tituloPagina);
      const respParse = UrlFetchApp.fetch(urlParse, { muteHttpExceptions: true });
      const jsonParse = JSON.parse(respParse.getContentText('UTF-8'));
      if (!jsonParse.parse) return { erro: 'falha ao carregar página' };
      let html = jsonParse.parse.text;
      html = html.replace(/<style[\s\S]*?<\/style>/gi, '');

      let matchSecao = html.match(/primeiro turno\s*\(governador\)/i);
      if (!matchSecao) matchSecao = html.match(/governador\s*\(turno único\)/i);
      if (!matchSecao) matchSecao = html.match(/>\s*governador\s*</i);
      if (!matchSecao) return { erro: 'seção governador não encontrada' };
      const inicioSecao = matchSecao.index;
      const fimSecao = html.indexOf('<h2', inicioSecao + 100);
      const secaoGovernador = html.substring(inicioSecao, fimSecao !== -1 ? fimSecao : html.length);

      function limparCelula(html) {
        return html
          .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&#160;|&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Pega TODAS as sub-tabelas da seção (a Wikipédia às vezes quebra por período: "Agosto-Outubro", "Abril-Julho" etc.)
      const tabelasEncontradas = secaoGovernador.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/g) || [];
      if (tabelasEncontradas.length === 0) return { erro: 'tabela não encontrada' };

      let nomesCandidatos = [];
      let linhaDados = null;

      // Testa cada sub-tabela até achar uma com dado real — pula as que ainda estão vazias (período futuro sem pesquisa ainda)
      for (let t = 0; t < tabelasEncontradas.length && !linhaDados; t++) {
        const linhas = tabelasEncontradas[t].match(/<tr[\s\S]*?<\/tr>/g) || [];
        const linhasProcessadas = linhas.map(function (linha) {
          const celulas = linha.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || [];
          return celulas.map(limparCelula);
        });

        const nomesTemp = linhasProcessadas[1] || [];
        const qtd = nomesTemp.length;
        if (qtd === 0) continue;

        for (let i = 2; i < linhasProcessadas.length; i++) {
          const linha = linhasProcessadas[i];
          if (linha.length > qtd && linha[0] && linha[0].trim().length > 0) {
            nomesCandidatos = nomesTemp;
            linhaDados = linha;
            break;
          }
        }
      }

      if (!linhaDados) return { erro: 'nenhuma sub-tabela com dado real encontrada' };

      const qtdCandidatos = nomesCandidatos.length;
      const inicioPercentuais = 5;
      const percentuais = linhaDados.slice(inicioPercentuais, inicioPercentuais + qtdCandidatos);

      const candidatos = nomesCandidatos.map(function (nome, i) {
        return nome + ': ' + (percentuais[i] || 'não encontrado');
      });

      return {
        fonte: linhaDados[0] || '',
        data: linhaDados[1] || '',
        candidatos: candidatos.join(' | ')
      };
    } catch (e) {
      return { erro: e.message };
    }
  }

  const resultados = [];

  ESTADOS.forEach(function (estado) {
    const r = buscarPesquisaWikipedia(estado);
    if (r.erro) {
      resultados.push([estado, '', '', 'ERRO: ' + r.erro]);
    } else {
      resultados.push([estado, r.fonte, r.data, r.candidatos]);
    }
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.clear();
  sheet.getRange(1, 1, 1, 4).setValues([['Estado', 'Instituto/Fonte', 'Data', 'Candidatos encontrados']]);
  resultados.forEach(function (linha, i) {
    sheet.getRange(i + 2, 1, 1, linha.length).setValues([linha]);
  });

  Logger.log('Processados ' + resultados.length + ' estados.');
}
