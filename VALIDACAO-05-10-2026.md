# Validação completa — 05/10/2026

## Aplicação

- Todos os JavaScripts carregados pelo `index.html` passaram na validação de sintaxe.
- A Central de Pedidos foi compactada sem remover impressão, WhatsApp, Pix, entregas, mesas ou controles de status.
- O cartão alterado permanece aberto, recebe destaque e volta ao centro da tela.
- O cache do PWA foi atualizado para incluir os novos arquivos da central.
- O envio do motivo de cancelamento foi alinhado ao campo esperado pela API.
- A troca de status passou a atualizar somente o cartão selecionado, sem reconstruir a lista, fechar o pedido ou alterar a rolagem.
- O fluxo exibe apenas uma ação principal por etapa; correção e cancelamento ficam no menu de ações.
- A Central passou a usar um Kanban em quatro etapas: Recebidos, Em preparo, Prontos e Entrega/Final.
- Busca e filtros continuam funcionando sem recarregar a tela, com contadores por coluna.
- Ao mudar o status, o cartão vai para a coluna correta mantendo-se aberto e sem perder a posição da tela.

## Supabase

- Projeto conferido: `jhvtjhjzlljqfzdccrxc`.
- Projeto ativo e saudável.
- Todas as funções chamadas pelo JavaScript existem e estão ativas.
- Catálogo testado três vezes com resposta HTTP 200.
- Proteções de login do ADM e da equipe responderam corretamente a credenciais inválidas.
- Banco conferido com 789 pedidos: nenhum pedido incompleto, valor negativo, status inválido ou tipo inválido.
- Nenhum item de pedido, adicional ou entrega órfã encontrado.
- Registro único de configurações encontrado.
- Nenhum erro HTTP 4xx/5xx das Edge Functions encontrado na janela recente consultada após os testes.
- A regra real da coluna `orders.status` e a ação `update_status` da API foram reconferidas com os sete estados usados pela interface.

## Integridade do pacote

- `index.html` permanece em letras minúsculas na raiz do projeto.
- ZIP validado sem erros de compactação.
