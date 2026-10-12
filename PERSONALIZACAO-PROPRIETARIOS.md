# ROMÁRIO & JEYCIANE — Personalização do cabeçalho do ADM

Esta atualização inclui uma assinatura dourada no espaço preto entre "Central Caseirão" e o indicador de "Loja aberta/Loja fechada".

## Como alterar os nomes

1. Abra a **Central ADM**.
2. Clique ou toque na assinatura **ROMÁRIO & JEYCIANE** no topo do painel, ou abra **Loja e expediente** > **Assinatura dos proprietários** > **Alterar nomes**.
3. Digite os dois nomes e escolha **Salvar nomes**.

O padrão é **ROMÁRIO & JEYCIANE** e o subtítulo é **PROPRIETÁRIOS • O CASEIRÃO BURGER**.

## Onde a alteração fica salva

Os nomes personalizados ficam salvos no `localStorage` do navegador/aparelho em que forem editados. Portanto, em outro celular ou tablet, os nomes padrão serão mostrados até serem personalizados nesse outro aparelho. Não há gravação dessa personalização no banco de dados.

## Arquivos alterados/adicionados

- `index.html`: inclusão dos arquivos da personalização e nova identificação de versão.
- `sw.js`: nova versão de cache e inclusão dos arquivos de personalização.
- `css/owner-header.css`: aparência dourada e ajustes para celular, tablet e computador.
- `js/owner-header.js`: assinatura, edição e salvamento local dos nomes.

Nenhum arquivo de pedidos, produção, pagamento, despacho, relatórios ou impressora foi modificado.
