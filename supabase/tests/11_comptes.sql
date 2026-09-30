-- 11. Comptes : supprimer un compte qui a créé d'autres comptes (bug users.created_by).
-- La suppression passe par auth.users (API d'administration), le profil suit en cascade.
begin;
\ir _fixture.sql
select * from no_plan();

-- ed1 a créé le compte de com1.
update users set created_by = tests.id('ed1') where id = tests.id('com1');

select lives_ok($$delete from auth.users where id = tests.id('ed1')$$,
                'supprimer un compte qui a créé d''autres comptes est possible');
select is((select count(*)::int from users where id = tests.id('ed1')), 0,
          'le profil du compte supprimé est parti (cascade)');
select is((select count(*)::int from users where id = tests.id('com1')), 1,
          'le compte qu''il avait créé reste');
select is((select created_by from users where id = tests.id('com1')), null::uuid,
          'la trace du créateur est effacée (created_by = null)');

select * from finish();
rollback;
