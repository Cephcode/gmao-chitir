-- 3. Entretien : échéance = dernier + fréquence, « noter l'entretien », changement de fréquence.
-- (Statut À jour / En retard calculé côté page : tests/maintenance.test.ts)
begin;
\ir _fixture.sql
select * from no_plan();

-- next_due_date
select is(next_due_date('mensuel', '2026-09-15'), '2026-10-15'::date, 'mensuel : +1 mois');
select is(next_due_date('trimestriel', '2026-09-15'), '2026-12-15'::date, 'trimestriel : +3 mois');
select is(next_due_date('semestriel', '2026-09-15'), '2027-03-15'::date, 'semestriel : +6 mois');
select is(next_due_date('annuel', '2026-09-15'), '2027-09-15'::date, 'annuel : +1 an');
select is(next_due_date('mensuel', '2026-01-31'), '2026-02-28'::date, 'mensuel depuis le 31 janvier : fin février');
select is(next_due_date('annuel', '2028-02-29'), '2029-02-28'::date, 'annuel depuis un 29 février : 28 février');
select is(next_due_date('mensuel', '2026-12-15'), '2027-01-15'::date, 'mensuel : passage d''année');
select is(next_due_date(null, '2026-09-15'), null::date, 'fréquence non définie : pas d''échéance');
select is(next_due_date('mensuel', null), null::date, 'sans date de départ : pas d''échéance');

-- Noter l'entretien (commentateur) sur E1 (plan mensuel en retard)
select tests.se_connecter('com1');
select lives_ok($$ select noter_entretien_fait(tests.id('E1'), current_date, 'Huile changée') $$, 'commentateur : noter l''entretien accepté');
select tests.se_deconnecter();
select is((select last_done_at from maintenance_plans where equipment_id = tests.id('E1')), current_date, 'noter : dernier entretien = aujourd''hui');
select is((select next_due_at from maintenance_plans where equipment_id = tests.id('E1')), (current_date + interval '1 month')::date,
          'noter : prochaine échéance = aujourd''hui + 1 mois');
select ok((select next_due_at >= current_date from maintenance_plans where equipment_id = tests.id('E1')), 'noter : la machine n''est plus en retard');
select is((select count(*)::int from maintenance_logs l join maintenance_plans p on p.id = l.plan_id
           where l.equipment_id = tests.id('E1') and l.done_by = tests.id('com1') and l.notes = 'Huile changée'), 1,
          'noter : journal d''entretien relié au plan');
select is((select count(*)::int from equipment_events where equipment_id = tests.id('E1') and type = 'entretien'), 1,
          'noter : fiche de vie « Entretien effectué »');

-- Date passée explicite
select tests.se_connecter('ed1');
select noter_entretien_fait(tests.id('E1'), '2026-06-10');
select tests.se_deconnecter();
select is((select next_due_at from maintenance_plans where equipment_id = tests.id('E1')), '2026-07-10'::date,
          'noter avec date passée : échéance = date + fréquence');

-- Machine sans plan (E3) : journal sans plan, aucun plan créé
select tests.se_connecter('com1');
select lives_ok($$ select noter_entretien_fait(tests.id('E3')) $$, 'noter sur machine sans plan accepté');
select tests.se_deconnecter();
select is((select count(*)::int from maintenance_plans where equipment_id = tests.id('E3')), 0, 'machine sans plan : aucun plan créé');
select is((select count(*)::int from maintenance_logs where equipment_id = tests.id('E3') and plan_id is null), 1,
          'machine sans plan : entretien journalisé');

-- Refus
select is(tests.essai('lec1', $$ select 1 from (select noter_entretien_fait(tests.id('E1'))) s $$), 'refusé', 'lecteur : noter l''entretien refusé');
select is(tests.essai('com1', $$ select 1 from (select noter_entretien_fait(tests.id('E2'))) s $$), 'refusé', 'commentateur R1 : noter sur R2 refusé');
select is(tests.essai('anon', $$ select 1 from (select noter_entretien_fait(tests.id('E1'))) s $$), 'refusé', 'anonyme : noter refusé');
select tests.se_connecter('com1');
select throws_ok($$ select noter_entretien_fait(gen_random_uuid()) $$, 'P0002', null, 'équipement inconnu : erreur « introuvable »');
select tests.se_deconnecter();

-- Plan créé à l'enregistrement d'une machine : première échéance = aujourd'hui + fréquence
select tests.se_connecter('ed1');
create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;
insert into ctx values ('N', enregistrer_equipement(null, tests.id('R1'), 'Four neuf', null, 'operationnel',
                                                    p_frequency => 'trimestriel', p_task => 'Détartrer'));
select tests.se_deconnecter();
select is((select coalesce(last_done_at::text, '-') || ' ' || next_due_at from maintenance_plans where equipment_id = (select v from ctx)),
          '- ' || (current_date + interval '3 months')::date, 'nouvelle machine : pas de dernier entretien, échéance = aujourd''hui + 3 mois');
select matches((select code from equipments where id = (select v from ctx)), '^TSTA-EQP-[0-9]{2}$', 'nouvelle machine : code généré TSTA-EQP-nn');

-- Changement de fréquence : échéance recalculée depuis le dernier entretien
update maintenance_plans set last_done_at = '2026-08-01', next_due_at = '2026-09-01' where equipment_id = tests.id('E1');
select tests.se_connecter('ed1');
select enregistrer_equipement(tests.id('E1'), tests.id('R1'), 'Friteuse test', 'TSTA-FRI-01', 'operationnel',
                              p_frequency => 'semestriel', p_task => 'Vidanger l''huile');
select tests.se_deconnecter();
select is((select next_due_at from maintenance_plans where equipment_id = tests.id('E1')), '2027-02-01'::date,
          'fréquence mensuel -> semestriel : échéance = dernier (1er août) + 6 mois');
select is((select last_done_at from maintenance_plans where equipment_id = tests.id('E1')), '2026-08-01'::date,
          'changement de fréquence : dernier entretien conservé');

-- Même fréquence, tâche modifiée : échéance inchangée
update maintenance_plans set next_due_at = '2026-12-24' where equipment_id = tests.id('E1');
select tests.se_connecter('ed1');
select enregistrer_equipement(tests.id('E1'), tests.id('R1'), 'Friteuse test', 'TSTA-FRI-01', 'operationnel',
                              p_frequency => 'semestriel', p_task => 'Autre tâche');
select tests.se_deconnecter();
select is((select next_due_at::text || ' ' || task from maintenance_plans where equipment_id = tests.id('E1')), '2026-12-24 Autre tâche',
          'même fréquence : échéance inchangée, tâche mise à jour');

-- Changement de fréquence sans dernier entretien : depuis aujourd'hui
select is(tests.essai('ed1', $$ select 1 from (select enregistrer_equipement(tests.id('E2'), tests.id('R2'), 'Friteuse B', 'TSTB-FRI-01',
          'operationnel', p_frequency => 'mensuel')) s $$), 'refusé', 'éditeur R1 : modifier une machine de R2 refusé');
update maintenance_plans set last_done_at = null, next_due_at = null where equipment_id = tests.id('E2');
select tests.se_connecter('ed2');
select enregistrer_equipement(tests.id('E2'), tests.id('R2'), 'Friteuse B', 'TSTB-FRI-01', 'operationnel', p_frequency => 'annuel');
select tests.se_deconnecter();
select is((select next_due_at from maintenance_plans where equipment_id = tests.id('E2')), (current_date + interval '1 year')::date,
          'sans dernier entretien ni échéance : échéance = aujourd''hui + fréquence');

-- Éditeur R1 ne peut pas déplacer sa machine vers R2
select is(tests.essai('ed1', $$ select 1 from (select enregistrer_equipement(tests.id('E1'), tests.id('R2'), 'Friteuse test', 'TSTA-FRI-01',
          'operationnel')) s $$), 'refusé', 'éditeur R1 : déplacer une machine vers R2 refusé');

select * from finish();
rollback;
