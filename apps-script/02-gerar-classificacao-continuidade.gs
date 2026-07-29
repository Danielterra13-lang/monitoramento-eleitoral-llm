/**
 * Cruza a curadoria de pré-candidatos por estado (aba
 * "aba1_situacao_por_estado", alimentada semanalmente por uma tarefa
 * agendada de IA — ver automation/prompt-tarefa-semanal-cowork.md) com
 * as pesquisas brutas coletadas da Wikipédia (aba "Pesquisas Brutas"),
 * calcula o gap entre o candidato da situação e o maior concorrente, e
 * classifica o nível de continuidade de cada estado na aba
 * "Classificação de Continuidade".
 *
 * Cadência: gatilho semanal (time-driven trigger), encadeado após
 * atualizarPesquisasTodosEstados().
 */
function gerarClassificacaoContinuidade() {
  const SHEET_ABA1 = 'aba1_situacao_por_estado';
  const SHEET_ABA2 = 'Pesquisas Brutas';
  const SHEET_ABA3 = 'Classificação de Continuidade';

  const MAPA_UF = {
    'Acre': 'AC', 'Alagoas': 'AL', 'Amapá': 'AP', 'Amazonas': 'AM', 'Bahia': 'BA',
    'Ceará': 'CE', 'Distrito Federal': 'DF', 'Espírito Santo': 'ES', 'Goiás': 'GO',
    'Maranhão': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG',
    'Pará': 'PA', 'Paraíba': 'PB', 'Paraná': 'PR', 'Pernambuco': 'PE', 'Piauí': 'PI',
    'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS',
    'Rondônia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC', 'São Paulo': 'SP',
    'Sergipe': 'SE', 'Tocantins': 'TO'
  };

  const ESPECTRO_PARTIDO = {
    'PT': 'Esquerda', 'PSOL': 'Esquerda', 'PCdoB': 'Esquerda', 'PSTU': 'Esquerda',
    'UP': 'Esquerda', 'PCB': 'Esquerda', 'PCO': 'Esquerda',
    'PDT': 'Centro-esquerda', 'PSB': 'Centro-esquerda', 'Rede': 'Centro-esquerda', 'PV': 'Centro-esquerda',
    'MDB': 'Centro', 'PSD': 'Centro', 'PSDB': 'Centro', 'Cidadania': 'Centro',
    'Solidariedade': 'Centro', 'Avante': 'Centro', 'Podemos': 'Centro', 'PRD': 'Centro',
    'Agir': 'Centro', 'PMN': 'Centro', 'Mobiliza': 'Centro', 'Missão': 'Centro',
    'PP': 'Centro-direita', 'União Brasil': 'Centro-direita', 'UNIÃO': 'Centro-direita', 'PTB': 'Centro-direita',
    'Republicanos': 'Direita', 'REP': 'Direita', 'PL': 'Direita', 'Novo': 'Direita', 'PSC': 'Direita', 'DC': 'Direita'
  };

  function normalizar(txt) {
    return (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function classificarEspectro(partido) {
    if (!partido) return 'N/D';
    return ESPECTRO_PARTIDO[partido.trim()] || 'N/D';
  }

  function parseCandidatos(texto) {
    if (!texto) return [];
    return texto.split('|').map(function (parte) {
      // Formato 1: "Nome (PARTIDO): NN%"
      const comPartido = parte.match(/^(.+?)\(([^)]*)\)\s*:\s*([\d,]+)%/);
      if (comPartido) {
        return { nome: comPartido[1].trim(), partido: comPartido[2].trim(), percentual: parseFloat(comPartido[3].replace(',', '.')) };
      }
      // Formato 2: "Nome PARTIDO: NN%" (sem parênteses — partido em maiúsculas antes dos dois-pontos)
      const semParenteses = parte.match(/^(.+?)\s+([A-ZÀ-ÚÇÕÃ]{2,}(?:\s[A-ZÀ-ÚÇÕÃ]{2,}){0,2})\s*:\s*([\d,]+)%/);
      if (semParenteses) {
        return { nome: semParenteses[1].trim(), partido: semParenteses[2].trim(), percentual: parseFloat(semParenteses[3].replace(',', '.')) };
      }
      // Formato 3: sem partido identificável
      const semPartido = parte.match(/^(.*):\s*([\d,]+)%/);
      if (semPartido) {
        return { nome: semPartido[1].trim(), partido: '', percentual: parseFloat(semPartido[2].replace(',', '.')) };
      }
      return null;
    }).filter(function (c) { return c && c.nome && !isNaN(c.percentual); });
  }

  function classificar(gap, temDadoValido) {
    if (!temDadoValido) return 'Imprevisível';
    if (gap >= 10) return 'Favorável';
    if (gap >= 6) return 'Em Risco';
    if (Math.abs(gap) < 0.05) return 'Disputa competitiva';
    if (gap > 0) return 'Disputa competitiva — vantagem situação';
    if (gap >= -6) return 'Disputa competitiva — vantagem oposição';
    return 'Desfavorável';
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheet1 = ss.getSheetByName(SHEET_ABA1);
  const dados1 = sheet1.getDataRange().getValues();
  const header1 = dados1[0];
  const idxEstado1 = header1.indexOf('Estado');
  const idxNomeBuscar = header1.indexOf('Nome a buscar nas pesquisas');
  const idxConfianca = header1.indexOf('Confiança do nome');
  const idxObservacao = header1.indexOf('Observação');

  const situacaoPorUF = {};
  for (let i = 1; i < dados1.length; i++) {
    const uf = dados1[i][idxEstado1];
    situacaoPorUF[uf] = {
      nomeBuscar: dados1[i][idxNomeBuscar],
      confianca: dados1[i][idxConfianca],
      observacao: idxObservacao !== -1 ? dados1[i][idxObservacao] : ''
    };
  }

  const sheet2 = ss.getSheetByName(SHEET_ABA2);
  const dados2 = sheet2.getDataRange().getValues();
  const header2 = dados2[0];
  const idxEstado2 = header2.indexOf('Estado');
  const idxCandidatos = header2.indexOf('Candidatos encontrados');
  const idxFonte = header2.indexOf('Instituto/Fonte');
  const idxData = header2.indexOf('Data');

  // Ordem final das 13 colunas:
  // 0 UF | 1 Estado | 2 Candidato Situação | 3 % Situação | 4 Partido Situação |
  // 5 Maior Concorrente | 6 % Concorrente | 7 Partido Concorrente | 8 Gap |
  // 9 Classificação | 10 Confiança do nome | 11 Fonte | 12 Observação

  const resultados = [];

  for (let i = 1; i < dados2.length; i++) {
    const nomeEstadoCompleto = dados2[i][idxEstado2];
    const uf = MAPA_UF[nomeEstadoCompleto];
    if (!uf) continue;

    const situacao = situacaoPorUF[uf];
    const observacao = situacao ? situacao.observacao : '';
    const confiancaAba1 = situacao ? (situacao.confianca || 'N/D') : 'N/D';
    const candidatos = parseCandidatos(dados2[i][idxCandidatos]);

    if (!situacao || !situacao.nomeBuscar || candidatos.length === 0) {
      resultados.push([
        uf, nomeEstadoCompleto, situacao ? situacao.nomeBuscar : '',
        '', '', '', '', '', '',
        'Imprevisível', confiancaAba1, 'Dado insuficiente', observacao
      ]);
      continue;
    }

    const nomeBuscarNorm = normalizar(situacao.nomeBuscar);
    const candidatoSituacao = candidatos.find(function (c) {
      const nomeCandNorm = normalizar(c.nome);
      return nomeCandNorm.length > 0 && (nomeCandNorm.indexOf(nomeBuscarNorm) !== -1 || nomeBuscarNorm.indexOf(nomeCandNorm) !== -1);
    });

    if (!candidatoSituacao) {
      resultados.push([
        uf, nomeEstadoCompleto, situacao.nomeBuscar,
        '', '', '', '', '', '',
        'Imprevisível', confiancaAba1, 'Candidato da situação não encontrado nesta pesquisa', observacao
      ]);
      continue;
    }

    const demaisCandidatos = candidatos.filter(function (c) { return c !== candidatoSituacao; });
    const concorrente = demaisCandidatos.reduce(function (maior, atual) {
      return (!maior || atual.percentual > maior.percentual) ? atual : maior;
    }, null);

    const espectroSituacao = classificarEspectro(candidatoSituacao.partido);

    if (!concorrente) {
      resultados.push([
        uf, nomeEstadoCompleto, candidatoSituacao.nome, candidatoSituacao.percentual + '%',
        (candidatoSituacao.partido || 'N/D') + ' (' + espectroSituacao + ')',
        '', '', '', '',
        'Imprevisível', confiancaAba1, 'Sem concorrente identificado', observacao
      ]);
      continue;
    }

    const gap = candidatoSituacao.percentual - concorrente.percentual;
    const classificacao = classificar(gap, true);
    const espectroConcorrente = classificarEspectro(concorrente.partido);

    resultados.push([
      uf,
      nomeEstadoCompleto,
      candidatoSituacao.nome,
      candidatoSituacao.percentual + '%',
      (candidatoSituacao.partido || 'N/D') + ' (' + espectroSituacao + ')',
      concorrente.nome,
      concorrente.percentual + '%',
      (concorrente.partido || 'N/D') + ' (' + espectroConcorrente + ')',
      gap.toFixed(1) + ' p.p.',
      classificacao,
      confiancaAba1,
      dados2[i][idxFonte] + ' — ' + dados2[i][idxData],
      observacao
    ]);
  }

  let sheet3 = ss.getSheetByName(SHEET_ABA3);
  if (!sheet3) sheet3 = ss.insertSheet(SHEET_ABA3);
  sheet3.clear();
  sheet3.getRange(1, 1, 1, 13).setValues([[
    'UF', 'Estado', 'Candidato Situação', '% Situação', 'Partido Situação', 'Maior Concorrente', '% Concorrente', 'Partido Concorrente', 'Gap', 'Classificação', 'Confiança do nome', 'Fonte', 'Observação'
  ]]);
  resultados.forEach(function (linha, i) {
    sheet3.getRange(i + 2, 1, 1, linha.length).setValues([linha]);
  });

  Logger.log('Classificação gerada para ' + resultados.length + ' estados.');
}
