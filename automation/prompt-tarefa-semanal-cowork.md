# Tarefa agendada semanal — curadoria de pré-candidatos (Aba 1)

**Onde roda:** Claude Cowork (Desktop), como Scheduled Task, toda segunda-feira
às ~8h. Requer plano Pro ou superior.

**O que faz:** pesquisa na web a situação de pré-candidatura à reeleição de
cada um dos 27 estados e devolve um arquivo `.xlsx` pronto para revisão
humana antes de ser colado na aba `aba1_situacao_por_estado` da planilha.

**Por que não é uma chamada de API dentro do Apps Script:** essa etapa depende
de julgamento qualitativo sobre notícias e contexto político — o tipo de
tarefa em que vale manter um humano revisando antes de qualquer dado entrar
na planilha (ver seção "Decisões técnicas" no README). Rodar como Scheduled
Task usa a cota do plano de assinatura em vez de gerar uma cobrança de API
separada, e não exige guardar nenhuma chave nem dar acesso de escrita à
planilha.

**Como reproduzir:** abra o Claude Desktop → Cowork → Scheduled → New Task →
cole o prompt abaixo → defina a cadência.

---

```
Toda segunda-feira, pesquise na web a situação política de cada um dos 27
estados brasileiros (26 UFs + Distrito Federal) para as eleições estaduais
de 2026.

Para cada estado, levante estas informações:

Estado | Governador atual / Grupo situação | Partido | Elegível reeleição | Nome a buscar nas pesquisas | Confiança do nome | Observação

Regras de preenchimento de cada coluna:

- Estado: sigla de 2 letras (AC, AL, AP, AM, BA, CE, DF, ES, GO, MA, MT, MS,
  MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO)

- Governador atual / Grupo situação: nome do governador(a) em exercício.
  Se assumiu no meio do mandato, indique entre parênteses: "(assumiu após
  saída de [nome anterior])". Se não houver titular, descreva a situação
  entre parênteses.

- Partido: sigla do partido do governador atual. Se não tiver partido
  declarado, escreva "sem partido"

- Elegível reeleição: use exatamente um destes valores —
  "Sim", "Não", "Não vai concorrer", "Não se aplica (sucessão)", "Eleição suplementar"

- Nome a buscar nas pesquisas: nome do pré-candidato da situação. Se ainda
  não houver nome, escreva "A confirmar"

- Confiança do nome: use exatamente um destes valores —
  "Provável", "Especulativo", "Indefinido", "Imprevisível"

- Observação: nota curta (até 20 palavras) com o fato mais relevante

Mantenha a ordem dos estados de A a Z pela sigla.

IMPORTANTE — entrega: não descreva a tabela apenas na resposta de texto.
Use a ferramenta de criação de arquivos para gerar um arquivo Excel real
(.xlsx) chamado "aba1_situacao_por_estado.xlsx", com uma linha de cabeçalho
e as 27 linhas de dados, uma coluna por campo na ordem acima. O arquivo
precisa aparecer na pasta de trabalho da tarefa, disponível para download.
Confirme ao final que o arquivo foi criado e informe o nome exato do arquivo.
```

---

**Exemplo de saída real** (execução de validação, antes da primeira revisão
semanal) em `exemplo-saida/`:
- `aba1_situacao_por_estado.xlsx` — arquivo gerado pela tarefa
- `build_xlsx.py` — script que o próprio agente escreveu na hora (usando a
  habilidade `xlsx`) para montar e formatar o arquivo; incluído aqui como
  evidência de como a tarefa resolve a entrega, não como algo destinado a
  rodar manualmente
