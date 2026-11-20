/* Opções de bebidas incluídas. O estoque continua sendo conferido no banco. */
(() => {
  'use strict';
  const choices = [
    ['cace1a00-0000-4000-8000-000000000001','0617c866-311a-496b-87f4-d8a24dd880b9','Guaraná Antarctica'],
    ['cace1a00-0000-4000-8000-000000000002','fc3c9091-d690-4257-85ca-3a06df28969e','Fanta Laranja'],
    ['cace1a00-0000-4000-8000-000000000003','ee1be6b4-5f94-4862-bcd3-7fc32e22226d','Fanta Uva'],
    ['cace1a00-0000-4000-8000-000000000004','ed33c76f-9e1c-4333-9cca-49122124c5c9','Pepsi']
  ];
  const includes = id => choices.some(([addonId]) => addonId === String(id));
  function options(catalog, productId) {
    const linked = new Set((catalog.product_addons || []).filter(link => String(link.product_id) === String(productId))
      .map(link => String(link.addon_id)));
    return choices.filter(([id]) => linked.has(id)).map(([id, drinkId, name]) => {
      const addon = (catalog.addons || []).find(item => String(item.id) === id);
      const drink = (catalog.products || []).find(item => String(item.id) === drinkId);
      return {id, name, addon, available: Boolean(addon && addon.active !== false && !addon.sold_out &&
        drink && drink.active !== false && !drink.sold_out)};
    });
  }
  const defaultId = choices[0][0];
  function fields(options, quantity, selected = []) {
    return Array.from({length:quantity}, (_, index) => {
      const preferred = selected[index] ?? defaultId;
      const value = options.some(option => option.id === preferred && option.available) ? preferred : '';
      return `<label class="field comboDrinkField"><span>${quantity===1?'Refrigerante do combo':'Refrigerante do combo '+(index+1)}</span>
        <select class="sel comboDrinkSelect" data-combo-drink="${index}" required>
          <option value="" ${value?'':'selected'}>Escolha o refrigerante</option>
          ${options.map(option => `<option value="${option.id}" ${option.available?'':'disabled'} ${option.id===value?'selected':''}>${option.name}${option.available?'':' · esgotado'}</option>`).join('')}
        </select></label>`;
    }).join('');
  }
  window.CaseiraoComboDrinks = Object.freeze({includes, options, fields});
})();
