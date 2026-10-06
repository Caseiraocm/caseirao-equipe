# Validação — Controle de Destaques

- O banco já possui `products.featured boolean default false`.
- A Edge Function `admin-api` já recebe/salva `featured` em `upsert_product`.
- A Edge Function `catalog` já retorna `products` com `select=*`, incluindo `featured`.
- O ADM agora deixa explícito quais produtos estão no carrossel e orienta usar de 3 a 8 itens.
- Não foi criada coluna/tabela duplicada e nenhuma estrutura existente foi removida.
- Cache do Equipe atualizado para propagar a nova interface.
