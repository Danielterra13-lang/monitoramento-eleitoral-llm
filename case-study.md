# Monitoramento eleitoral com LLM

Dashboard de cenário político estadual que combina automação determinística
(scraping + regra de classificação) com um agente de IA fazendo curadoria
qualitativa semanal. Publicado como terceiro case do portfólio, depois do
pipeline de ETL e do dashboard de Feedback CS.

Repositório: [link do GitHub]
Dashboard ao vivo: `dashboard-eleitoral.html` (abre direto no navegador)

## Contexto

Acompanhar cenário eleitoral estadual manualmente (abrir pesquisas de 27
estados, cruzar com quem é o candidato da situação, e formar uma visão de
"quem tende a se manter no poder") é um trabalho de curadoria que eu já
fazia periodicamente. O problema não era falta de dado público (as
pesquisas existem, agregadas na Wikipédia); era o tempo gasto compilando e
a inconsistência de critério de uma semana pra outra sobre o que conta como
"favorável" ou "em risco".

## Decisão técnica e por quê

O ponto central do projeto não foi "automatizar tudo com IA", foi decidir
**onde** um LLM ajuda e onde ele só adiciona custo e risco:

- **Classificação do gap eleitoral: regra fixa, não LLM.** Comparar % do
  candidato da situação com % do maior concorrente e aplicar um corte (favor
  ≥ +10 p.p., risco entre +6 e +10 p.p., etc.) é aritmética, não julgamento.
  Um LLM aqui seria mais lento, mais caro e, pior, poderia classificar o
  mesmo gap de formas diferentes em execuções diferentes. Fica em Apps
  Script, determinístico e auditável.

- **Identificar quem é "o candidato da situação" em cada estado: LLM com
  busca web, com humano no loop.** Isso não é aritmética: governadores
  renunciam pra disputar Senado ou Presidência, sucessores mudam de nome de
  uma semana pra outra, alguns casos têm disputa judicial em aberto (Rio de
  Janeiro e Roraima, neste ciclo). É exatamente o tipo de julgamento
  qualitativo em que um LLM com acesso à web ajuda de verdade, mas eu não
  queria que ele escrevesse direto na planilha sem alguém checar.

- **Onde rodar o LLM: Scheduled Task do Claude, não API dentro do Apps
  Script.** Cheguei a desenhar a versão "tudo automatizado": uma terceira
  função Apps Script chamando a API da Anthropic direto, com a chave guardada
  no Properties Service. Funcionaria. Mas decidi não fazer: geraria custo de
  API recorrente pra um ganho de automação que eu não precisava (só preciso
  do resultado uma vez por semana, e já reviso antes de usar). A Scheduled
  Task do Cowork resolve isso usando a cota do plano de assinatura, sem
  cobrança extra, e devolve um arquivo pra eu revisar antes de qualquer coisa
  entrar na planilha.

## Arquitetura

```
Cowork (Scheduled Task, toda segunda)
   → pesquisa web + gera .xlsx
   → revisão humana
   → cola em "aba1_situacao_por_estado"
          │
          ▼
Apps Script #1 (Wikipédia, scraping)
   → "Pesquisas Brutas"
          │
          ▼
Apps Script #2 (gap + classificação por regra)
   → "Classificação de Continuidade"
          │
          ▼
dashboard-eleitoral.html
   → lê a planilha ao vivo via Google Visualization API (gviz/tq)
   → tabela + KPIs + mapa do Brasil por classificação
```

Três sistemas, três gatilhos semanais, nenhum backend próprio. A planilha é
o banco de dados, o Apps Script é o orquestrador determinístico, e o Cowork
entra só na etapa que precisa de julgamento.

## Resultado

- Compilação semanal do cenário dos 27 estados sai em minutos de revisão em
  vez de uma tarde inteira de pesquisa manual.
- Critério de classificação consistente entre semanas: a régua de corte
  (p.p. de gap) é a mesma sempre, porque é regra, não interpretação.
- O mapa deu ao dashboard um jeito de "ler o Brasil inteiro" num golpe de
  vista, que a tabela sozinha não entregava, e virou o elemento mais forte
  visualmente do case.

## O que eu faria diferente hoje

- Deixaria a etapa de curadoria (Aba 1) com um campo explícito de "mudou em
  relação à semana passada". Hoje a comparação é manual, na cabeça, quando
  eu reviso o `.xlsx`. Dava pra manter isso simples sem precisar dar acesso
  de escrita à planilha para o agente: bastaria eu anexar a versão da semana
  anterior como referência no próprio prompt.
- Testaria também a variante "Claude Code na nuvem" pra essa tarefa
  agendada, em vez de só Cowork no Desktop. Evitaria a dependência de
  computador ligado, mesmo custando um pouco mais de setup inicial.
- Documentaria desde o início, não só depois de já estar rodando, que a
  Aba 1 é a fonte de verdade de "elegibilidade à reeleição". O dashboard
  atual ainda tem esse dado fixo no JavaScript, herdado da primeira versão;
  o ideal é ele também vir da planilha, pra não ter duas fontes de verdade
  sobre a mesma informação.
