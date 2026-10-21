# Caseirão ADM — Signature UI 6.0

## Escopo
Reformulação exclusivamente visual do aplicativo interno: portal de acesso, login da Central ADM, cabeçalho, menu lateral, indicadores, central de pedidos, vendas, financeiro/caixa, cards, filtros, formulários, relatórios e telas secundárias.

## Integridade operacional
**Nenhum arquivo JavaScript operacional foi alterado.** As funções de produção, pedidos, impressão, login, caixa, Supabase, entregadores e status continuam com a mesma implementação do arquivo enviado.

Arquivos acrescentados ou modificados:
- `css/caseirao-signature-60.css`: nova identidade visual, carregada por último.
- `index.html`: apenas inclui o novo CSS, altera tema visual e a etiqueta da versão.
- `sw.js`: muda nome de cache e adiciona o novo arquivo visual no cache do aplicativo (evita ficar preso na aparência antiga).

## Publicação
1. Faça backup do site atual.
2. Publique o conteúdo da pasta do projeto na Vercel (ou substitua no repositório GitHub conectado).
3. No tablet/celular, feche e reabra o app instalado e recarregue uma vez após a publicação.
4. Valide com dados reais: login, alternância de abas, atualização de pedidos, impressão, produção, caixa, vendas e entregas.

**Observação:** a camada visual foi revisada estaticamente, mas integrações com seu ambiente Supabase e hardware de impressão não podem ser exercitadas aqui. Faça a validação operacional antes de usar durante o expediente.
