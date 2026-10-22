# Caseirão ADM — V10: voz de pedido pronto por modalidade

- **Entrega:** informa que o pedido é de entrega e chama o entregador para buscar e sair em rota.
- **Retirada:** informa que o pedido é para retirada e orienta avisar o cliente para buscar no Caseirão.
- **Consumo na mesa:** anuncia o número da mesa e pede ao atendimento para levar o pedido até ela.
- **Balcão:** orienta a chamar o cliente para retirar no balcão.
- **Consumo no salão, sem mesa registrada:** pede ao atendimento para servir o pedido no salão.
- Para tipos desconhecidos, solicita conferir o destino, sem dar instruções incorretas.
- Na Central e no despacho, os controles de teste oferecem exemplos de entrega, retirada, mesa e balcão.
- Campainha forte de pedido novo, alertas de demais etapas, barra recolhida e outras funções preservados.
- Não modifica banco Supabase nem cardápio Delivery.

## Publicação
Substitua os arquivos do projeto da Central/Equipe pelos do ZIP. Faça a atualização no tablet após publicar; a versão do cache PWA foi alterada para V10. Teste os botões de prévia de voz no próprio dispositivo, pois a qualidade da voz depende do leitor de português instalado e do desbloqueio de áudio pelo Chrome.
