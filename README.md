# Caseirão Equipe

Aplicativo interno da equipe, Central ADM, mesas, produção, caixa e entregas do O Caseirão Burger.

## Estrutura ativa

- `index.html`: entrada única do aplicativo.
- `css/base.css`: estrutura visual compartilhada.
- `css/admin.css`: interface operacional e administrativa.
- `js/config.js`: endereço das funções do sistema.
- `js/foundation.js`: inicialização, API e utilidades compartilhadas.
- `js/admin.js`: autenticação, pedidos e cadastros administrativos.
- `js/tables.js`: mesas, comandas e pagamentos locais.
- `js/team.js`: acesso e rotinas dos funcionários.
- `js/delivery.js`: Central de Entregas e entregadores.
- `js/operations.js`: pedidos, produção, mesas e entregas.
- `js/management.js`: caixa, relatórios, fidelidade e configurações.
- `js/runtime-bridge.js`: ligação controlada com a interface administrativa.
- `js/printing.js`: conexão, fila e impressão Bluetooth.
- `js/admin-ui.js`: composição visual da Central ADM.
- `sw.js`: instalação e atualização do PWA.

Arquivos antigos, cópias repetidas e versões que não eram carregadas pelo `index.html` foram retirados deste pacote.
