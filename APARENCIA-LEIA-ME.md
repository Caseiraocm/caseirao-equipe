# Aparência da Central ADM

Depois de atualizar os arquivos da aplicação, entre no ADM e abra **Aparência**, ao final do menu lateral. No celular, abra o menu pelo botão ☰.

1. Escolha um tema pronto ou toque nos seletores de cores.
2. Confira a prévia ilustrativa.
3. Toque em **Salvar cores** para aplicar ao administrativo.

**Descartar alterações** volta às cores salvas. **Restaurar cores originais** remove a personalização e recupera o visual original exato.

As preferências ficam somente neste navegador/aparelho. Limpar os dados do navegador remove as preferências. Outros aparelhos mantêm seu próprio visual. As alterações não modificam o cardápio de clientes nem as áreas da equipe. As cores que identificam status e alertas permanecem como antes.

## Instalação
Substitua os arquivos existentes pelos arquivos desta pasta, mantendo a estrutura `css/` e `js/`. Este ZIP contém a aplicação completa. Não publique apenas os dois novos arquivos: o `index.html` e o `sw.js` também precisam ser atualizados. Depois, feche e reabra o aplicativo com internet para receber a atualização.

## Escopo e conferência
Adicionados `js/appearance.js`, `css/appearance.css` e este guia. No `index.html`, adicionadas apenas as referências aos arquivos novos. No `sw.js`, atualizado o nome do cache e incluídos os dois arquivos novos no cache, sem alterar sua lógica.

Todos os arquivos JavaScript originais foram comparados com o ZIP enviado e permanecem idênticos byte a byte. Não houve alteração de banco de dados, Pix, pedidos ou impressão. A funcionalidade nova foi validada em ambiente DOM com a aplicação completa: navegação, prévia isolada, salvamento, descarte, restauração, persistência, dados inválidos e armazenamento bloqueado. Não foi possível realizar verificação visual em navegador neste ambiente. Impressora física e transações Pix reais não foram acionadas.
