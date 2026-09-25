# Revisão profissional

## Correções aplicadas

- Remoção das pastas e cópias que não eram carregadas pelo aplicativo.
- Reposicionamento do motor final de impressão dentro do núcleo da Central.
- Remoção dos dois motores antigos de fila e da implementação Bluetooth intermediária.
- Uma única fila persistente de impressão, com proteção contra repetição.
- Pedido Pix somente entra na impressão automática quando confirmado.
- Impressão aguarda a sincronização completa dos itens do pedido.
- Atualização do cache e dos arquivos essenciais do PWA.
- Identificação de build unificada em HTML, JavaScript e service worker.
- Divisão do antigo `app.js` em módulos por responsabilidade operacional.

## Limite técnico

As regras de banco continuam nas funções já publicadas no Supabase. Este pacote organiza e corrige o código do navegador sem alterar tabelas ou funções remotas.
