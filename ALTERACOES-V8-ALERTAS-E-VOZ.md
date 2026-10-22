# Caseirão Equipe — Alertas sonoros V8

Esta versão parte da Central V7 (adicionar itens e controle Pix) e conserva as demais telas/fluxos. Alterações exclusivamente no aplicativo interno **Caseirão Equipe / Central ADM / Despachante**. Não é necessário trocar o ZIP do cardápio delivery.

## Alertas diferenciados

- Pedido novo: campainha forte de quatro repetições, reproduzindo a síntese aprovada na prévia “Volume máximo”.
- Pedido confirmado: duas notas digitais ascendentes.
- Pedido no ponto: três bipes crescentes mais aviso por voz em português brasileiro.
- Saiu para entrega: dois tons de despacho.
- Pedido entregue/finalizado: sequência curta de conclusão.

Ao detectar uma transição real de status, a Central apresenta o alerta correspondente. No caso de pedido pronto, lê o nome e número do pedido, com frase adaptada para entrega, retirada, balcão, mesa ou consumo local. Na área da despachante, após sucesso da ação “PEDIDO NO PONTO”, o aparelho dela também anuncia o pedido.

## Como ativar

1. Publique este ZIP no repositório/projeto **caseirao-equipe** que já funciona. Não substitua o cardápio delivery.
2. Na Central, entre no ADM, clique em **ATIVAR ALERTAS**, deixe a tela ativa e pressione os botões de teste de cada evento.
3. Em **TESTAR VOZ**, confira a voz de português instalada no tablet; ajuste o volume.
4. No login da despachante, entre na área Embalagem e use **TESTAR VOZ**. Por padrão a fala está ativada, mas pode ser desligada localmente.

## Limitações importantes

O leitor de voz usa a Web Speech API (speechSynthesis) disponibilizada pelo navegador/aparelho. Qualidade da voz e disponibilidade variam conforme o tablet e o idioma instalado; não requer API paga de voz. O navegador pode impedir reprodução automática até a primeira interação, silenciar abas em segundo plano ou suspender o PWA com a tela bloqueada. Para funcionamento durante o expediente, mantenha a Central aberta e o volume de **mídia** habilitado. Se os alertas forem essenciais com a tela bloqueada, uma solução nativa/push seria necessária.

A função de fala e os efeitos são gerados localmente e não modificam pedidos no banco. Os outros recursos da V7 são preservados.
