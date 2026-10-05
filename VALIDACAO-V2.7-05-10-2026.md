# O Caseirão Burger — Validação V2.7

Base: V2.6 Central sem recarga.

## Alteração principal
Central de pedidos híbrida inspirada em operação Kanban: visual limpo, 4 etapas, ação principal por card, busca e filtros rápidos.

## Preservado
- Mesmas funções de atualização de status da V2.6.
- Mesmas chamadas do backend/Supabase já usadas pelo sistema.
- Impressão web/Bluetooth existente.
- WhatsApp do cliente e do entregador.
- Pix e status de pagamento já existentes.
- Rastreamento e módulos administrativos existentes.

## Novo na Central
- Colunas: Novos / Em preparo / Prontos / Entrega-Retirada.
- Finalizados recolhidos em uma área separada.
- Busca por pedido, cliente ou telefone.
- Filtros: Todos, Entrega, Retirada, Mesa/local, Pix pendente e Atrasados.
- Botão único de próxima ação diretamente no card.
- Indicadores de tempo com atenção a partir de 25 min e atraso a partir de 35 min.
- Mudança de etapa sem recarregar a central, reaproveitando a lógica V2.6.

## Verificações executadas
- Sintaxe de todos os arquivos JavaScript: OK.
- Referências de CSS/JS no index.html: OK.
- Servidor HTTP local e carregamento dos novos assets: HTTP 200.
