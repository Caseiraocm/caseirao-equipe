# Tela de pedidos organizada

Esta versão inclui a aba Aparência e reorganiza exclusivamente a apresentação da página Pedidos no ADM:

- Cabeçalho compacto e um único botão visível de novo pedido.
- Busca com identificação acessível e controle de alertas ao lado.
- Filtros com contagens do expediente, preservando os critérios originais.
- Indicadores em uma faixa discreta em vez de quatro caixas grandes.
- Exportação, sincronização, impressora e sons dentro de Mais opções.
- Controles e indicadores preservados ao pesquisar e filtrar, com seus eventos originais.
- Ajustes para tablet e celular; estilos limitados à tela do ADM, sem aplicação à impressão.

Os cards de pedidos e suas ações permanecem como estavam. A configuração de cores continua funcionando.

## Atualizar
Publique todo o conteúdo desta pasta mantendo as subpastas. Atualize também index.html e sw.js. Feche e reabra o aplicativo com internet após a publicação.

## Validação
Testada a aplicação completa em DOM: abrir a tela, quantidade dos filtros, pedidos de exemplo, busca, filtro, redesenho, recolhimento das ferramentas, preservação dos elementos com seus comandos e funcionamento da aba Aparência. Todos os scripts originais continuam idênticos byte a byte ao ZIP enviado; foram adicionados módulos isolados, além das referências em index.html e dos arquivos no cache em sw.js.

Não foram realizados testes visuais em navegador, impressão em equipamento físico ou pagamentos Pix reais. Não houve alteração de banco de dados.

## Sua logo em JPG
A imagem enviada foi incluída sem alterações em assets/logo-caseirao.jpg e configurada na entrada do ADM e na tela inicial. Inclua a pasta assets ao publicar. O cache foi atualizado para distribuir a correção. A logo antiga usada na impressão permanece inalterada.

## Mouse no tablet e botões de status
A Central ADM agora possui um controle horizontal acima das colunas: arraste o puxador com o mouse ou use as setas esquerda e direita. O controle acompanha a posição das colunas e fica no topo da área durante a rolagem. Os filtros deixam de ficar sobre os cards. Uma barra horizontal nativa também está configurada na base do quadro, conforme suporte do navegador.

Os botões de correção de status foram alinhados em duas colunas, mantendo o cancelamento em uma linha inteira. Todos usam os mesmos comandos originais. As ações principais, WhatsApp, Bluetooth, Pix, configuração de cores e logo permanecem preservados.

Atualize index.html e sw.js na pasta principal; orders-layout.js dentro de js; orders-layout.css dentro de css. O ZIP contém o aplicativo completo, incluindo sua logo.

Validação local em DOM: arrastar o controle, setas, limites, sincronização ao rolar, redimensionamento, filtros, busca, restauração da aparência e referências da logo. Confirmado que as rotinas originais de pedidos, pagamentos e impressão permanecem idênticas à versão anterior. Não houve teste visual em navegador nem teste com mouse físico no tablet, impressora ou pagamento real.
