const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ids=['invoiceNumber','invoiceDate','dueDate','currency','issuerName','issuerTax','issuerAddress','issuerEmail','clientName','clientTax','clientAddress','clientEmail','vat','irpf','discount','notes'];
const state={items:[{description:'Servicios profesionales',quantity:1,price:1000}]};
const currencySymbols={EUR:'€',USD:'$',GBP:'£'};

function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function money(value){const code=$('#currency').value;return new Intl.NumberFormat('es-ES',{style:'currency',currency:code}).format(value||0)}
function formatDate(value){if(!value)return '';return new Intl.DateTimeFormat('es-ES').format(new Date(value+'T12:00:00'))}
function party(prefix){return [$('#'+prefix+'Name').value,$('#'+prefix+'Tax').value,$('#'+prefix+'Address').value,$('#'+prefix+'Email').value].filter(Boolean).join('\n')}

function renderItems(){
  $('#items').innerHTML=state.items.map((item,i)=>`<div class="item-row"><label>Descripción<input data-i="${i}" data-k="description" value="${escapeHtml(item.description)}" placeholder="Servicio o producto"></label><label>Cantidad<input type="number" min="0" step="0.01" data-i="${i}" data-k="quantity" value="${item.quantity}"></label><label>Precio<input type="number" min="0" step="0.01" data-i="${i}" data-k="price" value="${item.price}"></label><button data-remove="${i}" title="Eliminar">×</button></div>`).join('');
  $$('[data-i]').forEach(el=>el.addEventListener('input',e=>{const i=+e.target.dataset.i,k=e.target.dataset.k;state.items[i][k]=k==='description'?e.target.value:(+e.target.value||0);update()}));
  $$('[data-remove]').forEach(el=>el.addEventListener('click',e=>{if(state.items.length>1){state.items.splice(+e.currentTarget.dataset.remove,1);renderItems();update()}}));
}
function update(){
  const subtotal=state.items.reduce((sum,x)=>sum+x.quantity*x.price,0),discountRate=+$('#discount').value||0,discount=subtotal*discountRate/100,base=subtotal-discount,vatRate=+$('#vat').value,irpfRate=+$('#irpf').value,vat=base*vatRate/100,irpf=base*irpfRate/100,total=base+vat-irpf;
  $('#pIssuerName').textContent=$('#issuerName').value||'TU NEGOCIO'; $('#pInvoiceNumber').textContent=$('#invoiceNumber').value; $('#pInvoiceDate').textContent=`Fecha: ${formatDate($('#invoiceDate').value)}${$('#dueDate').value?' · Vence: '+formatDate($('#dueDate').value):''}`;
  $('#pIssuer').textContent=party('issuer')||'Añade tus datos'; $('#pClient').textContent=party('client')||'Añade los datos del cliente';
  $('#pItems').innerHTML=state.items.map(x=>`<tr><td>${escapeHtml(x.description)||'—'}</td><td>${x.quantity}</td><td>${money(x.price)}</td><td>${money(x.quantity*x.price)}</td></tr>`).join('');
  $('#pSubtotal').textContent=money(subtotal); $('#pDiscount').textContent='− '+money(discount); $('#pDiscountRow').hidden=!discount; $('#pVatLabel').textContent=`IVA (${vatRate}%)`; $('#pVat').textContent=money(vat); $('#pIrpfLabel').textContent=`IRPF (${irpfRate}%)`; $('#pIrpf').textContent='− '+money(irpf); $('#pIrpfRow').hidden=!irpf; $('#pTotal').textContent=money(total); $('#pNotes').textContent=$('#notes').value||'Gracias por tu confianza.';
  save();
}
function snapshot(){const values={};ids.forEach(id=>values[id]=$('#'+id).value);return {version:1,values,items:state.items}}
function save(){localStorage.setItem('hazlafactura',JSON.stringify(snapshot()));$('#saveState').textContent='Guardado localmente'}
function load(data){if(!data)return;Object.entries(data.values||{}).forEach(([id,v])=>{if($('#'+id))$('#'+id).value=v});if(Array.isArray(data.items)&&data.items.length)state.items=data.items;renderItems();update()}
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}

const today=new Date(),due=new Date(Date.now()+30*864e5);$('#invoiceDate').value=today.toISOString().slice(0,10);$('#dueDate').value=due.toISOString().slice(0,10);$('#invoiceNumber').value=`HLF-${today.getFullYear()}-001`;
ids.forEach(id=>$('#'+id).addEventListener('input',update));$('#addItem').addEventListener('click',()=>{state.items.push({description:'',quantity:1,price:0});renderItems();update()});$('#printBtn').addEventListener('click',()=>window.print());$('#exportBtn').addEventListener('click',()=>download(`factura-${$('#invoiceNumber').value}.json`,JSON.stringify(snapshot(),null,2),'application/json'));$('#importFile').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{load(JSON.parse(reader.result))}catch{alert('El archivo no es una copia válida de Haz la Factura.')}};reader.readAsText(file)});$('#clearBtn').addEventListener('click',()=>{if(confirm('¿Borrar todos los datos guardados en este navegador?')){localStorage.removeItem('hazlafactura');localStorage.removeItem('facturalista');location.reload()}});
const stored=localStorage.getItem('hazlafactura')||localStorage.getItem('facturalista');if(stored){try{load(JSON.parse(stored))}catch{renderItems();update()}}else{renderItems();update()}
