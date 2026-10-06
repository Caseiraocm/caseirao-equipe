# Validação — Despachante + atualização automática do PWA

Data: 05/10/2026

## Alterações
- Área da Despachante agora recebe `customer_name` por uma função dedicada (`dispatcher-api`).
- Card da embalagem destaca: número do pedido, nome do cliente e destino/tipo (Entrega, Retirada, Consumo no local, Balcão ou Mesa).
- Itens, adicionais, observações e botão "Pedido no ponto" foram preservados.
- `dispatcher-api` usa o mesmo token de sessão do funcionário e aceita apenas função `embalagem`.
- Service worker passou a buscar arquivos com `cache: no-store`, mantendo cache apenas como fallback offline.
- Cache usa chave normalizada sem query string, evitando acumular versões antigas.
- Registro do service worker usa `updateViaCache: none`, força `registration.update()` no carregamento e quando o app volta ao primeiro plano.
- Quando um novo service worker assume o controle, a página recarrega uma vez para usar os arquivos novos.

## Verificações técnicas
- `node --check js/team.js`: OK.
- `node --check sw.js`: OK.
- Todos os arquivos listados no APP_SHELL existem: OK.
- Edge Function `dispatcher-api` implantada no Supabase e marcada como ACTIVE: OK.
- Consulta de pedidos confirma a existência de `customer_name`, `type` e `table_number`: OK.

## Observação
O código da função implantada está preservado em `supabase/functions/dispatcher-api/index.ts` dentro deste pacote.
