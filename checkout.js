const PRO_CHECKOUT_URL='https://asierreguero.lemonsqueezy.com/checkout/buy/a412031e-fe04-455a-89b8-e2ad1e7e86c0';

function openProCheckout(){
  if(window.LemonSqueezy?.Url?.Open){window.LemonSqueezy.Url.Open(PRO_CHECKOUT_URL);return}
  window.location.assign(PRO_CHECKOUT_URL);
}

document.querySelectorAll('.checkout-button').forEach(button=>button.addEventListener('click',openProCheckout));
window.addEventListener('load',()=>{
  if(!window.LemonSqueezy?.Setup)return;
  window.LemonSqueezy.Setup({eventHandler(event){
    if(event.event==='Checkout.Success')document.querySelectorAll('.checkout-success').forEach(message=>message.hidden=false);
  }});
});
