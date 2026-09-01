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
document.querySelectorAll('.site-nav a').forEach((link)=>{
  const href=link.getAttribute('href');
  if(!href||href.startsWith('mailto:')||href.includes('#'))return;
  const linkPath=new URL(link.href,location.href).pathname.replace(/index\.html$/,'');
  if(linkPath===path)link.setAttribute('aria-current','page');
});
