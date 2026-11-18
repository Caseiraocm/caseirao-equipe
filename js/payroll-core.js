(function(root){
 'use strict';
 const WIDTH=1440,HEIGHT=576; // Conteúdo de 180 x 72 mm; gira para a bobina de 80 mm.
 const money=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const date=s=>s?String(s).slice(0,10).split('-').reverse().join('/'):'—';
 const cnpj=v=>String(v||'').replace(/\D/g,'').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
 const cpf=v=>String(v||'').replace(/\D/g,'').replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');
 function parseMoney(value){let s=String(value??'').replace(/^R\$\s*/,'').trim();if(!s)return 0;if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s))s=s.replace(/\./g,'');if(!/^\d+([.,]\d{1,2})?$/.test(s))return null;const n=Math.round(Number(s.replace(',','.'))*100);return Number.isSafeInteger(n)&&n>=0?n:null;}
 function paymentDefaults(member,paidOn){
  const weekly=member.payment_frequency==='weekly',finish=String(paidOn).slice(0,10);
  const begin=new Date(finish+'T12:00:00Z');begin.setUTCDate(begin.getUTCDate()-6);
  const initial=weekly?begin.toISOString().slice(0,10):finish.slice(0,8)+'01';
  const label=weekly?'Pagamento semanal':member.payment_frequency==='monthly'?'Pagamento mensal':'Pagamento';
  return {start:initial,end:finish,reference:label+' · '+date(initial)+' a '+date(finish),base:member.payment_base_cents==null?'':(Number(member.payment_base_cents)/100).toFixed(2).replace('.',','),label};
 }
 function calculate(d){const gross=Number(d.base_cents||0)+Number(d.extra_cents||0),discount=Number(d.other_discount_cents||0)+Number(d.staff_discount_cents||0);return {gross,discount,net:gross-discount};}
 const code=r=>r.receipt_number?'RP-'+String(r.paid_on).slice(0,4)+'-'+String(r.receipt_number).padStart(6,'0'):'PRÉVIA';
 function validCnpj(value){const s=String(value||'').replace(/\D/g,'');if(s.length!==14||/^(\d)\1{13}$/.test(s))return false;for(let len=12;len<=13;len++){let sum=0,w=len-7;for(let i=0;i<len;i++){sum+=Number(s[i])*w;if(--w<2)w=9;}const digit=sum%11<2?0:11-sum%11;if(digit!==Number(s[len]))return false;}return true;}
 function logicalCanvas(r,create){
  const canvas=create();canvas.width=WIDTH;canvas.height=HEIGHT;const c=canvas.getContext('2d'),company=r.company_snapshot||{};
  c.fillStyle='#fff';c.fillRect(0,0,WIDTH,HEIGHT);c.fillStyle='#000';c.textBaseline='alphabetic';
  const text=(value,x,y,size=21,bold=false,max=WIDTH-x-26,align='left')=>{let t=String(value??''),font=size;c.textAlign=align;c.font=(bold?'bold ':'')+font+'px Arial';while(c.measureText(t).width>max&&font>14){font--;c.font=(bold?'bold ':'')+font+'px Arial';}while(c.measureText(t).width>max&&t.length>1)t=t.slice(0,-2)+'…';c.fillText(t,x,y);};
  const line=(x1,y,x2)=>{c.beginPath();c.moveTo(x1,y);c.lineTo(x2,y);c.lineWidth=2;c.strokeStyle='#000';c.stroke();};
  text(company.trade_name||'O Caseirão Burger',26,40,32,true,850);
  text(company.legal_name||'',26,69,20,false,850);text('CNPJ '+cnpj(company.cnpj),26,96,20,true,850);
  text(company.address||'',26,122,17,false,WIDTH-52);
  text(r.net_cents===0&&!r.draft?'RECIBO DE ACERTO':'RECIBO DE PAGAMENTO',WIDTH-26,39,24,true,520,'right');text(code(r),WIDTH-26,69,21,true,500,'right');text('Data: '+date(r.paid_on),WIDTH-26,97,19,false,500,'right');line(26,138,WIDTH-26);
  text('Funcionário: '+(r.employee_name||'Nome do funcionário'),26,174,25,true,860);text('CPF: '+(r.employee_cpf?cpf(r.employee_cpf):'não informado'),26,203,19,false,860);
  text('Referência: '+(r.reference||''),26,234,21,true,860);text('Período: '+date(r.period_start)+' a '+date(r.period_end),26,263,20,false,860);text('Forma de pagamento: '+(r.payment_method||''),26,292,20,false,860);
  const values=[['Valor base',r.base_cents],['Adicionais',r.extra_cents],['Outros descontos',r.other_discount_cents],['Desconto da ficha',r.staff_discount_cents]];
  values.forEach(([label,value],i)=>{text(label,950,170+i*30,19,false,270);text(money(value),WIDTH-26,170+i*30,21,true,220,'right');});
  text('LÍQUIDO PAGO',950,313,20,true,300);text(money(r.net_cents),WIDTH-26,350,38,true,470,'right');
  if(r.extra_cents>0)text('Adicional: '+(r.extra_description||''),26,326,16,false,860);
  if(r.other_discount_cents>0)text('Desconto: '+(r.other_discount_description||''),26,350,16,false,860);
  text('Ficha: saldo anterior '+money(r.balance_before_cents)+' · desconto '+money(r.staff_discount_cents)+' · saldo restante '+money(r.balance_after_cents),26,382,18,false,WIDTH-52);
  const statement=r.draft?'PRÉVIA PARA CONFERÊNCIA — SEM PAGAMENTO REGISTRADO':r.cancellation?'REGISTRO CANCELADO — ESTE DOCUMENTO NÃO COMPROVA PAGAMENTO':r.net_cents===0?'Declaro realizado o acerto discriminado neste recibo, sem entrega de valor líquido.':'Declaro ter recebido da empresa acima o valor líquido discriminado, referente ao pagamento indicado.';
  text(statement,26,417,18,false,WIDTH-52);
  text((company.city||'Campo Maior - PI')+', '+date(r.paid_on),26,447,18,false,860);
  if(r.note)text('Obs.: '+r.note,950,386,15,false,WIDTH-976);
  line(26,518,860);line(950,518,WIDTH-26);
  text('Assinatura do funcionário',443,544,19,true,800,'center');text('Responsável pelo pagamento',1182,544,18,false,470,'center');
  text('Recibo '+code(r)+' · valores informados pela empresa · colher assinatura no papel',26,568,12,false,WIDTH-52);
  if(r.draft||r.cancellation){c.save();c.globalAlpha=.12;c.translate(WIDTH/2,HEIGHT/2);c.rotate(-.13);c.font='bold 105px Arial';c.textAlign='center';c.fillText(r.cancellation?'CANCELADO':'PRÉVIA',0,0);c.restore();}
  return canvas;
 }
 function rotatedCanvas(logical,create){const out=create();out.width=logical.height;out.height=logical.width;const c=out.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,out.width,out.height);c.translate(out.width,0);c.rotate(Math.PI/2);c.drawImage(logical,0,0);return out;}
 function join(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;parts.forEach(p=>{out.set(p,at);at+=p.length;});return out;}
 function rasterBytes(canvas){
  if(canvas.width>576||canvas.width%8!==0)throw new Error('Largura incompatível com a impressora de 80 mm.');
  const {data}=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height),rowBytes=canvas.width/8,parts=[new Uint8Array([27,64,27,97,0])];
  for(let top=0;top<canvas.height;top+=48){const h=Math.min(48,canvas.height-top),bits=new Uint8Array(rowBytes*h);let black=false;
   for(let y=0;y<h;y++)for(let x=0;x<canvas.width;x++){const at=((top+y)*canvas.width+x)*4;if(data[at+3]>128&&(data[at]*.299+data[at+1]*.587+data[at+2]*.114)<170){bits[y*rowBytes+(x>>3)]|=128>>(x%8);black=true;}}
   if(black){parts.push(new Uint8Array([29,118,48,0,rowBytes&255,rowBytes>>8,h&255,h>>8]),bits);}else parts.push(new Uint8Array([27,74,h]));
  }
  parts.push(new Uint8Array([27,100,4]));return join(parts);
 }
 function plain(r){
  const company=r.company_snapshot||{};
  let statement='Recebi o valor líquido discriminado neste recibo.';
  if(r.net_cents===0)statement='Acerto realizado sem valor líquido.';
  if(r.cancellation)statement='REGISTRO CANCELADO. Este documento não comprova pagamento.';
  if(r.draft)statement='PRÉVIA PARA CONFERÊNCIA. Pagamento ainda não registrado.';
  return [
   company.trade_name||'O Caseirão Burger',company.legal_name,'CNPJ '+cnpj(company.cnpj),
   [company.address,company.city].filter(Boolean).join(' - '),
   '',r.net_cents===0&&!r.draft?'RECIBO DE ACERTO':'RECIBO DE PAGAMENTO',code(r),
   ...(r.cancellation?['*** CANCELADO ***']:[]),
   ...(r.draft?['*** PRÉVIA ***']:[]),
   'Funcionário: '+(r.employee_name||''),r.employee_cpf?'CPF '+cpf(r.employee_cpf):null,
   r.reference,'Período: '+date(r.period_start)+' a '+date(r.period_end),
   'Data: '+date(r.paid_on)+(r.payment_method?' - '+r.payment_method:''),
   '', 'Valor base: '+money(r.base_cents),
   'Adicionais: '+money(r.extra_cents),r.extra_description||null,
   'Outros descontos: '+money(r.other_discount_cents),r.other_discount_description||null,
   'Desconto da ficha: '+money(r.staff_discount_cents),
   'LÍQUIDO PAGO: '+money(r.net_cents),
   'Saldo anterior da ficha: '+money(r.balance_before_cents),
   'Saldo restante da ficha: '+money(r.balance_after_cents),
   '',statement,r.note?'Obs.: '+r.note:null,
   '','','________________________________','Assinatura do funcionário',
   '','','________________________________','Responsável pelo pagamento'
  ].filter(value=>value!=null).join('\n');
 }
 function thermalTextBytes(lines,width){
  const normal='\x1d\x21\x00';
  const tall='\x1d\x21\x01';
  const doubleSize='\x1d\x21\x11';
  const boldOn='\x1b\x45\x01';
  const boldOff='\x1b\x45\x00';
  const doubleWidth=Math.floor(width/2);
  const content=lines.map(line=>{
   const text=stripAccents(line)
    .replace(/[×]/g,'x').replace(/[·•]/g,' - ').replace(/−/g,'-')
    .replace(/\s/g,' ').replace(/[^\x20-\x7e]/g,'?');
   const emphasized=/^(RECIBO DE (VENDA|PAGAMENTO|ACERTO)$|TOTAL PAGO |LIQUIDO PAGO: )/.test(text);
   const large=emphasized&&text.length<=doubleWidth;
   const wrapped=wrapReceipt(text,large?doubleWidth:width).join('\n');
   return emphasized?boldOn+(large?doubleSize:tall)+wrapped+'\n'+boldOff+tall:wrapped+'\n';
  });
  return new TextEncoder().encode('\x1b@'+tall+content.join('')+normal+'\n\n\n');
 }
 function pdfPage(canvas,pageWidthMm,pageHeightMm,imageWidthMm,imageHeightMm){
  const binary=atob(canvas.toDataURL('image/jpeg',.97).split(',')[1]),image=Uint8Array.from(binary,c=>c.charCodeAt(0)),encoder=new TextEncoder();
  const pageW=pageWidthMm*72/25.4,pageH=pageHeightMm*72/25.4,imgW=imageWidthMm*72/25.4,imgH=imageHeightMm*72/25.4,x=(pageW-imgW)/2,y=(pageH-imgH)/2;
  const content=`q ${imgW.toFixed(3)} 0 0 ${imgH.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /Im0 Do Q\n`;
  const parts=[encoder.encode('%PDF-1.4\n%Caseirao\n')],offsets=[0];let length=parts[0].length;
  const addObject=(n,body)=>{offsets[n]=length;const bytes=join([encoder.encode(n+' 0 obj\n'),...(Array.isArray(body)?body:[encoder.encode(body)]),encoder.encode('\nendobj\n')]);parts.push(bytes);length+=bytes.length;};
  addObject(1,'<< /Type /Catalog /Pages 2 0 R >>');addObject(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  addObject(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(3)} ${pageH.toFixed(3)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  addObject(4,`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
  addObject(5,[encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),image,encoder.encode('\nendstream')]);
  const xref=length;parts.push(encoder.encode('xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF'));return join(parts);
 }
 function pdf(canvas){return pdfPage(canvas,80,(canvas.height/8)+10,canvas.width/8,canvas.height/8);}
 function pdfA4(canvas){return pdfPage(canvas,297,210,180,72);}
 const api={WIDTH,HEIGHT,parseMoney,paymentDefaults,calculate,validCnpj,cnpj,cpf,date,money,code,logicalCanvas,rotatedCanvas,rasterBytes,pdf,pdfA4,plain,thermalTextBytes};root.CaseiraoPayroll=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
