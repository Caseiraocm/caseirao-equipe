# Caseirão Delivery

Cardápio público e acompanhamento de pedidos do O Caseirão Burger.

Versão visual: **Premium 3.0**.

## Estrutura ativa

- `index.html`: entrada do cardápio.
- `css/app.css`: interface do cliente.
- `js/app.js`: catálogo, carrinho, checkout, Pix e acompanhamento.
- `sw.js`: instalação e atualização do PWA.

O envio usa um identificador único persistente. Se a internet cair ou a geração do Pix falhar depois da gravação, o mesmo pedido é recuperado sem criar outro.
