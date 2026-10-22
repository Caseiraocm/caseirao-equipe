# O Caseirão Burger — Central V7 (21/10/2026)

## Adicionar itens a pedidos

Na aba **Pedidos**, abra ou localize qualquer pedido ainda ativo e use **+ ADICIONAR ITENS AO PEDIDO**. Funciona para **entrega, retirada, balcão e consumo no local/mesas**. Os produtos e adicionais são escolhidos a partir do cardápio atual, com busca, quantidades e observações por unidade. Os valores são calculados e gravados no **mesmo número de pedido**. Itens anteriores, adicionais antigos, entrega, cupom e cashback são mantidos.

Para Pix já criado ou pago, o valor dos novos itens precisa de **pagamento complementar**: cobre a diferença separadamente e use **Confirmar recebimento do complemento** **somente depois de conferir o comprovante/recebimento**. O QR Code anterior NÃO é alterado nem volta a cobrar o valor integral. A Central impede o avanço da produção e exclui esse valor pendente do caixa até a confirmação. Para reimprimir a comanda atualizada, use o botão de impressão do pedido depois de salvar.

Pedidos entregues, cancelados e arquivados não aceitam novos itens. A gravação é transacional, com autenticação da Central ADM, validação dos preços no servidor e proteção contra duplicação de tentativas.

## Integração Supabase

Esta versão utiliza as alterações aplicadas ao **projeto Supabase já conectado ao Caseirão**:
- Edge Function `caseirao-order-items` (ação `append` e ação `settle_extra`);
- Banco: coluna `orders.additional_payment_due`, funções `caseirao_append_order_items` e `caseirao_settle_order_extra`, gatilho `caseirao_pix_progress_guard`;
- `admin-api`: fechamento do caixa não inclui Pix com diferença pendente.

A Edge Function exige o PIN administrativo; as funções de banco não são executáveis por usuários anônimos. Se instalar este ZIP em outro projeto Supabase, essas funções e alterações de banco terão de ser reproduzidas naquele projeto.

## Publicação

Substitua a versão anterior do repositório do painel administrativo pelo conteúdo desta pasta, **mantendo o banco atual**. Publique novamente no serviço de hospedagem. A versão de cache PWA foi alterada para facilitar a atualização do aplicativo instalado. **Não execute arquivos antigos de alterações de banco nem substitua funções Supabase por versões anteriores.**

## Verificações

Validação estática de JavaScript e integridade do ZIP realizadas. O teste completo com pedidos e pagamentos reais deve ser feito no sistema publicado, preferencialmente primeiro em pedido de teste fora do horário de funcionamento.
