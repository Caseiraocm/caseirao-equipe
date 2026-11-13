# Caseirão — cards e Bluetooth

Correção de 13/11/2026.

- Cabeçalhos com amarelo, laranja, verde e azul por etapa; corpo branco e botões de ação com cores fortes.
- Cabeçalho próprio para número e status; nome e total em uma linha independente, com quebra para nomes longos.
- Atalhos WhatsApp e Bluetooth no topo, inclusive com o card recolhido.
- Impressão de pedido direcionada ao fluxo Bluetooth ESC/POS existente. Se não estiver conectado, o atalho do topo abre a conexão antes de imprimir.
- Removida a opção duplicada de impressão pelo navegador nos cards.
- Cache atualizado.

Substitua o conteúdo do repositório pelos arquivos desta pasta, mantendo css, js e assets ao lado do index.html.

Validação: sintaxe dos scripts ativos, referências locais e teste simulado do fluxo Bluetooth (conectar, conexão existente e falha). Não foi possível renderizar o aplicativo no navegador deste ambiente; a prévia interativa usa os mesmos estilos dos cards. Impressão física não testada.
