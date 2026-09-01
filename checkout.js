const PRO_CHECKOUT_URL='https://hazlafactura.lemonsqueezy.com/checkout/buy/a412031e-fe04-455a-89b8-e2ad1e7e86c0';

function checkoutNotice(text){
  let notice=document.querySelector('.checkout-notice');
  if(!notice){notice=document.createElement('p');notice.className='checkout-notice';notice.setAttribute('role','status');document.body.appendChild(notice)}
  notice.textContent=text;notice.hidden=false;setTimeout(()=>notice.hidden=true,6000);
}

async function openProCheckout(){
  for(let attempt=0;attempt<20;attempt++){
    if(window.LemonSqueezy?.Url?.Open){window.LemonSqueezy.Url.Open(PRO_CHECKOUT_URL);return}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  checkoutNotice('No se ha podido cargar el pago integrado. Revisa tu conexión e inténtalo de nuevo.');
}

document.querySelectorAll('.checkout-button').forEach(button=>button.addEventListener('click',openProCheckout));
window.addEventListener('load',()=>{
  if(!window.LemonSqueezy?.Setup)return;
  window.LemonSqueezy.Setup({eventHandler(event){
    if(event.event==='Checkout.Success')document.querySelectorAll('.checkout-success').forEach(message=>message.hidden=false);
  }});
});
