document.querySelectorAll('.menu-toggle').forEach((button)=>{
  const nav=document.getElementById(button.getAttribute('aria-controls'));
  if(!nav)return;
  button.addEventListener('click',()=>{
    const open=button.getAttribute('aria-expanded')!=='true';
    button.setAttribute('aria-expanded',String(open));
    nav.dataset.open=String(open);
  });
  nav.addEventListener('click',(event)=>{
    if(event.target.closest('a')){
      button.setAttribute('aria-expanded','false');
      nav.dataset.open='false';
    }
  });
});

const path=location.pathname.replace(/index\.html$/,'');
if(localStorage.getItem('hlf-pro-license')&&localStorage.getItem('hlf-pro-instance'))document.body.classList.add('pro-active');
document.querySelectorAll('.site-nav a').forEach((link)=>{
  const href=link.getAttribute('href');
  if(!href||href.startsWith('mailto:')||href.includes('#'))return;
  const linkPath=new URL(link.href,location.href).pathname.replace(/index\.html$/,'');
  if(linkPath===path)link.setAttribute('aria-current','page');
});

function scrollWithoutHash(id){
  const target=document.getElementById(id);
  if(!target)return;
  target.scrollIntoView({behavior:'smooth',block:'start'});
  if(target.matches('main,[tabindex]')){target.setAttribute('tabindex','-1');target.focus({preventScroll:true})}
}
document.querySelectorAll('a[href^="#"]').forEach((link)=>link.addEventListener('click',(event)=>{
  const id=link.getAttribute('href').slice(1);if(!id)return;
  event.preventDefault();scrollWithoutHash(id);
  if(location.hash)history.replaceState(null,'',location.pathname+location.search);
}));
document.querySelectorAll('[data-scroll-target]').forEach((link)=>link.addEventListener('click',(event)=>{
  const id=link.dataset.scrollTarget,linkPath=new URL(link.href,location.href).pathname.replace(/index\.html$/,'');
  if(linkPath===path){event.preventDefault();scrollWithoutHash(id);if(location.hash)history.replaceState(null,'',location.pathname+location.search)}
  else sessionStorage.setItem('hlf-scroll-target',id);
}));
const pendingScroll=sessionStorage.getItem('hlf-scroll-target');
if(pendingScroll){sessionStorage.removeItem('hlf-scroll-target');requestAnimationFrame(()=>scrollWithoutHash(pendingScroll))}
if(location.hash){const legacyTarget=location.hash.slice(1);history.replaceState(null,'',location.pathname+location.search);requestAnimationFrame(()=>scrollWithoutHash(legacyTarget))}

const testCheckoutEnabled=new URLSearchParams(location.search).get('test-checkout')==='1';
if(testCheckoutEnabled){
  const checkoutUrl='https://hazlafactura.lemonsqueezy.com/checkout/buy/a412031e-fe04-455a-89b8-e2ad1e7e86c0';
  const checkoutButtons=[document.getElementById('proPrimaryCta'),document.getElementById('proSecondaryCta')].filter(Boolean);
  checkoutButtons.forEach((button)=>{
    button.href=checkoutUrl;
    button.textContent='Abrir checkout de prueba';
    button.classList.add('lemonsqueezy-button');
  });
  const notice=document.getElementById('testCheckoutNote');
  if(notice)notice.hidden=false;
  if(checkoutButtons.length){
    const script=document.createElement('script');
    script.src='https://app.lemonsqueezy.com/js/lemon.js';
    script.defer=true;
    script.onload=()=>window.createLemonSqueezy?.();
    document.head.appendChild(script);
  }
}
