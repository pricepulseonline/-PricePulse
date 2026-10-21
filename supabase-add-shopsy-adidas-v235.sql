-- V235: add Shopsy (store) + Adidas (brand and store). Safe to run more than once.
insert into public.pp_catalog_stores(slug,name,domain,logo_url,active)
select 'shopsy','Shopsy','shopsy.in',null,true
where not exists (select 1 from public.pp_catalog_stores where slug='shopsy' or lower(name)=lower('Shopsy'));

insert into public.pp_catalog_stores(slug,name,domain,logo_url,active)
select 'adidas','Adidas','adidas.co.in',null,true
where not exists (select 1 from public.pp_catalog_stores where slug='adidas' or lower(name)=lower('Adidas'));

insert into public.pp_catalog_brands(slug,name,active)
select 'adidas','Adidas',true
where not exists (select 1 from public.pp_catalog_brands where slug='adidas' or lower(name)=lower('Adidas'));
