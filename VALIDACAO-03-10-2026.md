# Caseirão Equipe — versão profissional

## Alterações principais

- Estrutura visual do ADM separada em cabeçalho, resumo, navegação operacional, gestão e conteúdo.
- Correção da compactação causada pelo conteúdo inserido dentro da barra de navegação.
- Menu operacional direto para visão geral, pedidos, mesas, produção e entregas.
- Menu de gestão recolhível com caixa, cashback, fidelidade, relatórios, produtos e configurações.
- Interface responsiva para celular, tablet e notebook.
- Tela inicial e login reorganizados.
- Cache do PWA atualizado e padronizado para evitar código antigo após publicação.
- Regras de negócio, endpoints, impressão, Pix, mesas, entregas e histórico preservados.
- Pedidos, busca e filtros reposicionados no topo da área de trabalho.
- Impressora, resumo da fila, exportação, sincronização e indicadores movidos para baixo.
- Contraste reforçado em nomes, textos secundários, filtros, campos e cartões.

## Validações executadas

- Sintaxe de todos os arquivos JavaScript.
- Integridade do HTML e existência dos arquivos referenciados.
- Resposta do endpoint `catalog` do Supabase: HTTP 200.
- Estrutura do catálogo: configurações, produtos, adicionais, bairros e cupons.

## Publicação

Publicar o conteúdo desta pasta mantendo `index.html` em letras minúsculas. Após atualizar, fechar as abas antigas e abrir novamente para que o novo cache seja ativado.
