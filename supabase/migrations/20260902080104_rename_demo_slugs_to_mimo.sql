update public.organizations
set
  slug = regexp_replace(slug, '^arboleda-demo-', 'mimo-demo-'),
  name = regexp_replace(name, '^Clínica Veterinaria Arboleda', 'Mimo Veterinary Care')
where slug ~ '^arboleda-demo-[0-9]{2}$';

update public.sites
set slug = regexp_replace(slug, '^arboleda-', 'mimo-')
where slug ~ '^arboleda-[0-9]{2}$';
