# Caseirão Burger — Modelo 2 Cabeçalho Vibrante

Atualização de 12/11/2026 a partir do ZIP oficial.

## Instalação
Substitua os arquivos na raiz do repositório caseirao-equipe pelo conteúdo deste pacote. Mantenha as pastas css, js e assets ao lado do index.html. O CNAME original está preservado. Aguarde a atualização do GitHub Pages e reabra o aplicativo com internet.

## Entregue
- Cards com cabeçalhos por status, preservando colunas e controles existentes.
- WhatsApp do cliente e impressão no topo, inclusive com pedido recolhido.
- Login claro, logo oficial à esquerda e formulário à direita; adaptação para celular.
- Visual claro e novos acabamentos em produção, despachante e entregas.
- Cache PWA atualizado com todos os novos arquivos.
- Corrigida falha antiga da ponte do ADM: tentativa de redefinir função global não configurável.

## Rota automática — já ativa no banco
A confirmação de PRONTO em pedidos de entrega passa para EM ROTA e inicia a rota da atribuição existente. A distribuição automática de entregador continua usando a regra original. Retirada, balcão e consumo local permanecem PRONTO. É necessário entregador ativo. O bloqueio de Pix não quitado foi preservado.

## Validação realizada
- Sintaxe de todos os scripts ativos e referências locais do HTML.
- Testes transacionais no banco: entrega em rota com atribuição route; retirada, balcão e local em pronto; Pix pendente bloqueado. Todos os registros de teste foram desfeitos por rollback.
- Prévia no navegador: login, contraste, colunas, atalhos com card recolhido e comanda gerada pelo botão de impressão.
- Não foi realizado pagamento real, envio de mensagem, autenticação com PIN real nem impressão em impressora física.
- O visual deste pacote ainda precisa ser enviado ao GitHub Pages; o banco já recebeu a regra de rota automática.

As integrações e funções anteriores foram mantidas. Não há alteração de dados do Giro Prime ou do sistema de treinos.
