-- Données de départ : les 2 restaurants, les 6 catégories et les 49 équipements
-- existants (extraits de « GMAO CHITIR CHICKEN V3 LOGO.xlsx », feuille Équipements).
-- Les codes machines sont conservés tels quels. État initial : opérationnel.
-- Pas de plan d'entretien (fréquence « À définir » dans le fichier).

insert into restaurants (name, short_code) values
  ('Chitir Chicken Ouaga 2000', 'CTR1'),
  ('Chitir Chicken Kamboinsin', 'CTR2');

insert into categories (name, code) values
  ('Réfrigération', 'REF'),
  ('Cuisson', 'CUI'),
  ('Climatisation', 'CLI'),
  ('Vitrine', 'VIT'),
  ('Ventilation', 'VEN'),
  ('Boissons', 'BOI');

-- Équipements : jointure sur le restaurant (short_code) et la catégorie (code).
insert into equipments (restaurant_id, code, name, category_id, state)
select r.id, d.code, d.name, c.id, 'operationnel'::equipment_state
from (values
  ('CTR1-FRG-01', 'Grand frigo 1', 'CTR1', 'REF'),
  ('CTR1-FRG-02', 'Grand frigo 2', 'CTR1', 'REF'),
  ('CTR1-FRG-03', 'Grand frigo 3', 'CTR1', 'REF'),
  ('CTR1-FRG-04', 'Grand frigo 4', 'CTR1', 'REF'),
  ('CTR1-CNG-01', 'Congélateur', 'CTR1', 'REF'),
  ('CTR1-PFR-01', 'Petit frigo', 'CTR1', 'REF'),
  ('CTR1-GLC-01', 'Machine à glace', 'CTR1', 'REF'),
  ('CTR1-FRT-01', 'Grande friteuse 2 portes', 'CTR1', 'CUI'),
  ('CTR1-MPA-01', 'Machine à pain grandes ailes', 'CTR1', 'CUI'),
  ('CTR1-MPA-02', 'Machine à pain petites ailes', 'CTR1', 'CUI'),
  ('CTR1-MPL-01', 'Machine à poulet électrique petite', 'CTR1', 'CUI'),
  ('CTR1-MPL-02', 'Machine à poulet électrique grande', 'CTR1', 'CUI'),
  ('CTR1-MPG-01', 'Machine à poulet gaz', 'CTR1', 'CUI'),
  ('CTR1-VTP-01', 'Vitrine à poulet', 'CTR1', 'VIT'),
  ('CTR1-VTF-01', 'Vitrine à friteuse', 'CTR1', 'VIT'),
  ('CTR1-BOI-01', 'Machine à boissons', 'CTR1', 'BOI'),
  ('CTR1-HOT-01', 'Hotte', 'CTR1', 'VEN'),
  ('CTR1-FIL-01', 'Filtres hotte', 'CTR1', 'VEN'),
  ('CTR1-CLI-01', 'Clim 1', 'CTR1', 'CLI'),
  ('CTR1-CLI-02', 'Clim 2', 'CTR1', 'CLI'),
  ('CTR1-CLI-03', 'Clim 3', 'CTR1', 'CLI'),
  ('CTR1-CLI-04', 'Clim 4', 'CTR1', 'CLI'),
  ('CTR1-CPC-01', 'Clim plafonnée cuisine', 'CTR1', 'CLI'),
  ('CTR1-CLC-01', 'Clim call center', 'CTR1', 'CLI'),
  ('CTR1-PAN-01', 'Machine à panée', 'CTR1', 'CUI'),
  ('CTR2-ICE-01', 'Machine à glace 1', 'CTR2', 'REF'),
  ('CTR2-ICE-02', 'Machine à glace 2', 'CTR2', 'REF'),
  ('CTR2-FRG-01', 'Congélateur 1', 'CTR2', 'REF'),
  ('CTR2-FRG-02', 'Congélateur 2', 'CTR2', 'REF'),
  ('CTR2-FRG-03', 'Congélateur 3', 'CTR2', 'REF'),
  ('CTR2-FRG-04', 'Congélateur 4', 'CTR2', 'REF'),
  ('CTR2-FRG-05', 'Congélateur 5', 'CTR2', 'REF'),
  ('CTR2-PFR-01', 'Petit frigo', 'CTR2', 'REF'),
  ('CTR2-GFR-01', 'Grand frigo', 'CTR2', 'REF'),
  ('CTR2-CRM-01', 'Machine crème glacée', 'CTR2', 'REF'),
  ('CTR2-POU-01', 'Poulet électrique 1', 'CTR2', 'CUI'),
  ('CTR2-POU-02', 'Poulet électrique 2', 'CTR2', 'CUI'),
  ('CTR2-FRT-01', 'Petite friteuse', 'CTR2', 'CUI'),
  ('CTR2-FRT-02', 'Grande friteuse', 'CTR2', 'CUI'),
  ('CTR2-STK-01', 'Steak grande machine', 'CTR2', 'CUI'),
  ('CTR2-STK-02', 'Steak petite machine', 'CTR2', 'CUI'),
  ('CTR2-PAI-01', 'Machine pain à l''ail', 'CTR2', 'CUI'),
  ('CTR2-VTF-01', 'Vitrine friteuse', 'CTR2', 'VIT'),
  ('CTR2-VTP-01', 'Vitrine poulet', 'CTR2', 'VIT'),
  ('CTR2-BOI-01', 'Machine boissons', 'CTR2', 'BOI'),
  ('CTR2-CLI-01', 'Clim Boréal 1', 'CTR2', 'CLI'),
  ('CTR2-CLI-02', 'Clim Boréal 2', 'CTR2', 'CLI'),
  ('CTR2-HOT-01', 'Hotte 1', 'CTR2', 'VEN'),
  ('CTR2-HOT-02', 'Hotte 2', 'CTR2', 'VEN')
) as d(code, name, site, catcode)
join restaurants r on r.short_code = d.site
join categories c on c.code = d.catcode;
