const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ids=['invoiceNumber','invoiceDate','dueDate','currency','issuerName','issuerTax','issuerAddress','issuerEmail','clientName','clientTax','clientAddress','clientEmail','vat','irpf','discount','notes'];
const state={items:[{description:'Servicios profesionales',quantity:1,price:1000}],pro:{active:false,documentType:'invoice',template:'classic',brandColor:'#1f654a',logo:''}};
const LICENSE_API='https://api.lemonsqueezy.com/v1/licenses';

function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
function money(value){return new Intl.NumberFormat('es-ES',{style:'currency',currency:$('#currency').value}).format(value||0)}
function formatDate(value){if(!value)return '';return new Intl.DateTimeFormat('es-ES').format(new Date(value+'T12:00:00'))}
function party(prefix){return [$('#'+prefix+'Name').value,$('#'+prefix+'Tax').value,$('#'+prefix+'Address').value,$('#'+prefix+'Email').value].filter(Boolean).join('\n')}
function nextNumber(type='invoice'){
  const year=new Date().getFullYear(),prefix=type==='estimate'?'PRE':'HLF',key=`hlf-sequence-${type}-${year}`;
  return `${prefix}-${year}-${String((+localStorage.getItem(key)||0)+1).padStart(3,'0')}`;
}
function commitNumber(type='invoice'){const year=new Date().getFullYear(),key=`hlf-sequence-${type}-${year}`;localStorage.setItem(key,String((+localStorage.getItem(key)||0)+1))}

function renderItems(){
  $('#items').innerHTML=state.items.map((item,i)=>`<div class="item-row"><label>Descripción<input data-i="${i}" data-k="description" value="${escapeHtml(item.description)}" placeholder="Servicio o producto"></label><label>Cantidad<input type="number" min="0" step="0.01" data-i="${i}" data-k="quantity" value="${item.quantity}"></label><label>Precio<input type="number" min="0" step="0.01" data-i="${i}" data-k="price" value="${item.price}"></label><button data-remove="${i}" title="Eliminar" aria-label="Eliminar concepto">×</button></div>`).join('');
  $$('[data-i]').forEach(el=>el.addEventListener('input',e=>{const i=+e.target.dataset.i,k=e.target.dataset.k;state.items[i][k]=k==='description'?e.target.value:(+e.target.value||0);update()}));
  $$('[data-remove]').forEach(el=>el.addEventListener('click',e=>{if(state.items.length>1){state.items.splice(+e.currentTarget.dataset.remove,1);renderItems();update()}}));
}
function applyProAppearance(){
  const invoice=$('#invoicePreview');
  invoice.classList.remove('template-classic','template-minimal','template-bold');
  invoice.classList.add(`template-${state.pro.template}`);
  invoice.style.setProperty('--brand-color',state.pro.brandColor);
  $('#pDocumentTitle').textContent=state.pro.documentType==='estimate'?'PRESUPUESTO':'FACTURA';
  $('#convertEstimateBtn').hidden=state.pro.documentType!=='estimate';
  const img=$('#pLogoImage'),fallback=$('#pLogo span');
  img.hidden=!state.pro.logo;fallback.hidden=!!state.pro.logo;if(state.pro.logo)img.src=state.pro.logo;
}
function update(){
  const subtotal=state.items.reduce((sum,x)=>sum+x.quantity*x.price,0),discountRate=+$('#discount').value||0,discount=subtotal*discountRate/100,base=subtotal-discount,vatRate=+$('#vat').value,irpfRate=+$('#irpf').value,vat=base*vatRate/100,irpf=base*irpfRate/100,total=base+vat-irpf;
  $('#pIssuerName').textContent=$('#issuerName').value||'TU NEGOCIO';$('#pInvoiceNumber').textContent=$('#invoiceNumber').value;$('#pInvoiceDate').textContent=`Fecha: ${formatDate($('#invoiceDate').value)}${$('#dueDate').value?' · Vence: '+formatDate($('#dueDate').value):''}`;
  $('#pIssuer').textContent=party('issuer')||'Añade tus datos';$('#pClient').textContent=party('client')||'Añade los datos del cliente';
  $('#pItems').innerHTML=state.items.map(x=>`<tr><td>${escapeHtml(x.description)||'—'}</td><td>${x.quantity}</td><td>${money(x.price)}</td><td>${money(x.quantity*x.price)}</td></tr>`).join('');
  $('#pSubtotal').textContent=money(subtotal);$('#pDiscount').textContent='− '+money(discount);$('#pDiscountRow').hidden=!discount;$('#pVatLabel').textContent=`IVA (${vatRate}%)`;$('#pVat').textContent=money(vat);$('#pIrpfLabel').textContent=`IRPF (${irpfRate}%)`;$('#pIrpf').textContent='− '+money(irpf);$('#pIrpfRow').hidden=!irpf;$('#pTotal').textContent=money(total);$('#pNotes').textContent=$('#notes').value||'Gracias por tu confianza.';
  applyProAppearance();save();
}
function snapshot(){const values={};ids.forEach(id=>values[id]=$('#'+id).value);return {version:2,values,items:state.items,pro:{documentType:state.pro.documentType,template:state.pro.template,brandColor:state.pro.brandColor,logo:state.pro.logo}}}
function save(){localStorage.setItem('hazlafactura',JSON.stringify(snapshot()));$('#saveState').textContent='Guardado localmente'}
function load(data){if(!data)return;Object.entries(data.values||{}).forEach(([id,v])=>{if($('#'+id))$('#'+id).value=v});if(Array.isArray(data.items)&&data.items.length)state.items=data.items;if(data.pro)Object.assign(state.pro,data.pro);syncProInputs();renderItems();update()}
function download(name,content,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}

function setProActive(active){
  state.pro.active=active;$('#proControls').hidden=!active;$('#historyPanel').hidden=!active;$('#proAccessBtn').textContent=active?'Pro activo':'Activar licencia';$('#proStatus').textContent=active?'Licencia activa en este navegador. Tus datos siguen siendo locales.':'Personalización, presupuestos, historial y numeración automática.';
  $('#freeWatermark').hidden=active;
  if(active){syncProInputs();renderHistory()}
}
function syncProInputs(){if(!state.pro.active)return;$('#documentType').value=state.pro.documentType;$('#template').value=state.pro.template;$('#brandColor').value=state.pro.brandColor}
async function validateLicense(){
  const key=$('#licenseKey').value.trim(),message=$('#licenseMessage'),button=$('#validateLicenseBtn');if(!key){message.textContent='Introduce una clave de licencia.';return}
  button.disabled=true;button.textContent='Validando…';message.textContent='Conectando con Lemon Squeezy…';
  try{
    const storedKey=localStorage.getItem('hlf-pro-license'),storedInstance=localStorage.getItem('hlf-pro-instance');
    const reusingInstance=storedKey===key&&storedInstance;
    const body=new URLSearchParams({license_key:key});
    if(reusingInstance)body.set('instance_id',storedInstance);else body.set('instance_name',`Haz la Factura · ${navigator.platform||'navegador'}`);
    const action=reusingInstance?'validate':'activate';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    const response=await fetch(`${LICENSE_API}/${action}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:controller.signal});clearTimeout(timeout);const data=await response.json();
    const product=String(data.meta?.product_name||'').toLowerCase();
    const accepted=reusingInstance?data.valid:data.activated;
    if(!response.ok||!accepted||!product.includes('haz la factura'))throw new Error(data.error||'La clave no corresponde a Haz la Factura Pro o no se ha podido activar.');
    localStorage.setItem('hlf-pro-license',key);if(data.instance?.id)localStorage.setItem('hlf-pro-instance',data.instance.id);localStorage.setItem('hlf-pro-license-check',String(Date.now()));setProActive(true);$('#licenseDialog').close();update();
  }catch(error){message.textContent=error.name==='AbortError'?'La validación está tardando demasiado. Comprueba la conexión y vuelve a intentarlo.':(error.message||'No se pudo validar la licencia. Revisa la conexión e inténtalo de nuevo.')}finally{button.disabled=false;button.textContent='Validar y activar'}
}
async function restoreLicense(){
  const key=localStorage.getItem('hlf-pro-license'),instance=localStorage.getItem('hlf-pro-instance');if(!key||!instance)return;
  const last=+localStorage.getItem('hlf-pro-license-check')||0;if(Date.now()-last<7*864e5){setProActive(true);return}
  try{const body=new URLSearchParams({license_key:key,instance_id:instance});const response=await fetch(`${LICENSE_API}/validate`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const data=await response.json();if(data.valid&&String(data.meta?.product_name||'').toLowerCase().includes('haz la factura')){localStorage.setItem('hlf-pro-license-check',String(Date.now()));setProActive(true)}else{localStorage.removeItem('hlf-pro-license');localStorage.removeItem('hlf-pro-instance')}}catch{setProActive(true)}
}
function history(){try{return JSON.parse(localStorage.getItem('hlf-pro-history'))||[]}catch{return[]}}
function renderHistory(){const list=history();$('#historyList').innerHTML=list.length?list.map((doc,i)=>`<div class="history-row"><span><strong>${escapeHtml(doc.values.invoiceNumber)}</strong> · ${doc.pro.documentType==='estimate'?'Presupuesto':'Factura'} · ${escapeHtml(doc.values.clientName||'Sin cliente')}</span><button class="secondary" data-load-history="${i}">Abrir</button><button class="danger-text" data-delete-history="${i}">Eliminar</button></div>`).join(''):'<p class="history-empty">Aún no has guardado documentos.</p>';$$('[data-load-history]').forEach(b=>b.onclick=()=>load(history()[+b.dataset.loadHistory]));$$('[data-delete-history]').forEach(b=>b.onclick=()=>{const list=history();list.splice(+b.dataset.deleteHistory,1);localStorage.setItem('hlf-pro-history',JSON.stringify(list));renderHistory()})}
function saveToHistory(){const list=history(),doc=snapshot(),existing=list.findIndex(x=>x.values.invoiceNumber===doc.values.invoiceNumber);if(existing>=0)list[existing]=doc;else list.unshift(doc);localStorage.setItem('hlf-pro-history',JSON.stringify(list.slice(0,100)));if($('#autoNumber').checked&&existing<0){commitNumber(state.pro.documentType);$('#invoiceNumber').value=nextNumber(state.pro.documentType)}renderHistory();update()}

const today=new Date(),due=new Date(Date.now()+30*864e5);$('#invoiceDate').value=today.toISOString().slice(0,10);$('#dueDate').value=due.toISOString().slice(0,10);$('#invoiceNumber').value=nextNumber();
ids.forEach(id=>$('#'+id).addEventListener('input',update));$('#addItem').onclick=()=>{state.items.push({description:'',quantity:1,price:0});renderItems();update()};$('#printBtn').onclick=()=>window.print();$('#exportBtn').onclick=()=>download(`${state.pro.documentType==='estimate'?'presupuesto':'factura'}-${$('#invoiceNumber').value}.json`,JSON.stringify(snapshot(),null,2),'application/json');$('#importFile').onchange=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{load(JSON.parse(reader.result))}catch{alert('El archivo no es una copia válida de Haz la Factura.')}};reader.readAsText(file)};$('#clearBtn').onclick=()=>{if(confirm('¿Borrar los datos de la factura guardados en este navegador?')){localStorage.removeItem('hazlafactura');localStorage.removeItem('facturalista');location.reload()}};
$('#proAccessBtn').onclick=()=>state.pro.active?$('#proControls').scrollIntoView({behavior:'smooth'}):$('#licenseDialog').showModal();$('#validateLicenseBtn').addEventListener('click',validateLicense);$('#licenseDialog form').addEventListener('submit',event=>{if(event.submitter?.classList.contains('dialog-close'))return;event.preventDefault();validateLicense()});
$('#documentType').onchange=e=>{state.pro.documentType=e.target.value;if($('#autoNumber').checked)$('#invoiceNumber').value=nextNumber(state.pro.documentType);update()};$('#template').onchange=e=>{state.pro.template=e.target.value;update()};$('#brandColor').oninput=e=>{state.pro.brandColor=e.target.value;update()};$('#brandLogo').onchange=e=>{const file=e.target.files[0];if(!file)return;if(file.size>600000){alert('El logo debe ocupar menos de 600 KB.');return}const reader=new FileReader();reader.onload=()=>{state.pro.logo=reader.result;update()};reader.readAsDataURL(file)};$('#saveDocumentBtn').onclick=saveToHistory;$('#convertEstimateBtn').onclick=()=>{state.pro.documentType='invoice';$('#documentType').value='invoice';$('#invoiceNumber').value=nextNumber('invoice');update()};
const stored=localStorage.getItem('hazlafactura')||localStorage.getItem('facturalista');if(stored){try{load(JSON.parse(stored))}catch{renderItems();update()}}else{renderItems();update()}restoreLicense();
