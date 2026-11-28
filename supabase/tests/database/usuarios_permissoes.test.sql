-- Execute apenas em um Supabase local descartável com o DDL revisado.
-- Os perfis de teste e as contas fictícias são descartados com ROLLBACK.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = pg_catalog, extensions, public;

SELECT plan(34);

INSERT INTO auth.users (id, email, aud, role, invited_at, email_confirmed_at)
VALUES
    ('5eba0000-0000-4000-8000-000000000001', 'proprietario@example.invalid', 'authenticated', 'authenticated', now(), now()),
    ('5eba0000-0000-4000-8000-000000000002', 'auxiliar@example.invalid', 'authenticated', 'authenticated', now(), now()),
    ('5eba0000-0000-4000-8000-000000000003', 'tecnico@example.invalid', 'authenticated', 'authenticated', now(), now()),
    ('5eba0000-0000-4000-8000-000000000004', 'inativo@example.invalid', 'authenticated', 'authenticated', now(), now()),
    ('5eba0000-0000-4000-8000-000000000005', 'sem-perfil@example.invalid', 'authenticated', 'authenticated', now(), now()),
    ('5eba0000-0000-4000-8000-000000000006', 'convite-auxiliar@example.invalid', 'authenticated', 'authenticated', now(), now()),
    ('5eba0000-0000-4000-8000-000000000007', 'convite-tecnico@example.invalid', 'authenticated', 'authenticated', now(), now()),
    ('5eba0000-0000-4000-8000-000000000008', 'sem-convite@example.invalid', 'authenticated', 'authenticated', NULL, now()),
    ('5eba0000-0000-4000-8000-000000000009', 'sem-confirmacao@example.invalid', 'authenticated', 'authenticated', now(), NULL);

INSERT INTO public.usuarios (id, nome, papel, ativo)
VALUES
    ('5eba0000-0000-4000-8000-000000000001', 'Proprietário sintético', 'proprietario', true),
    ('5eba0000-0000-4000-8000-000000000002', 'Auxiliar sintético', 'auxiliar', true),
    ('5eba0000-0000-4000-8000-000000000003', 'Técnico sintético', 'tecnico', true),
    ('5eba0000-0000-4000-8000-000000000004', 'Perfil inativo sintético', 'tecnico', false);

-- Verifique privilégios independentes da avaliação da política.
SELECT ok(
    (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid = 'public.usuarios'::regclass),
    'usuarios tem RLS habilitada'
);
SELECT ok(
    NOT has_table_privilege('authenticated', 'public.usuarios', 'SELECT')
    AND has_column_privilege('authenticated', 'public.usuarios', 'id', 'SELECT')
    AND has_column_privilege('authenticated', 'public.usuarios', 'nome', 'SELECT')
    AND has_column_privilege('authenticated', 'public.usuarios', 'papel', 'SELECT')
    AND has_column_privilege('authenticated', 'public.usuarios', 'ativo', 'SELECT')
    AND NOT has_column_privilege('authenticated', 'public.usuarios', 'criado_em', 'SELECT')
    AND NOT has_column_privilege('authenticated', 'public.usuarios', 'atualizado_em', 'SELECT'),
    'authenticated lê apenas as quatro colunas previstas'
);
SELECT ok(
    NOT has_any_column_privilege('authenticated', 'public.usuarios', 'INSERT')
    AND NOT has_any_column_privilege('authenticated', 'public.usuarios', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.usuarios', 'DELETE'),
    'authenticated não tem privilégios diretos de escrita'
);
SELECT ok(
    NOT has_function_privilege(
        'anon', 'public.vincular_colaborador(uuid,text,public.papel_usuario)', 'EXECUTE'
    )
    AND NOT has_function_privilege(
        'anon', 'pavollos_admin.vincular_colaborador(uuid,text,public.papel_usuario)', 'EXECUTE'
    ),
    'anon não tem EXECUTE nas funções de vínculo'
);

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claim.sub" = '';
SET LOCAL "request.jwt.claims" = '{"role":"anon"}';
SELECT throws_ok(
    $query$SELECT id FROM public.usuarios$query$,
    '42501', NULL, 'anon não pode consultar perfis'
);
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000006', 'Convite auxiliar', 'auxiliar')$query$,
    '42501', NULL, 'anon não pode vincular colaboradores'
);

SET LOCAL ROLE authenticated;

SET LOCAL "request.jwt.claim.sub" = '5eba0000-0000-4000-8000-000000000005';
SET LOCAL "request.jwt.claims" = '{"sub":"5eba0000-0000-4000-8000-000000000005","role":"authenticated","user_metadata":{"papel":"proprietario"}}';
SELECT is((SELECT count(id) FROM public.usuarios), 0::bigint, 'sessão sem perfil não vê usuários');
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000006', 'Convite auxiliar', 'auxiliar')$query$,
    '42501', NULL, 'metadados de uma sessão sem perfil não conferem papel'
);


SET LOCAL "request.jwt.claim.sub" = '5eba0000-0000-4000-8000-000000000002';
SET LOCAL "request.jwt.claims" = '{"sub":"5eba0000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"papel":"proprietario"}}';
SELECT results_eq(
    'SELECT id FROM public.usuarios',
    ARRAY['5eba0000-0000-4000-8000-000000000002'::uuid],
    'auxiliar ativo vê apenas o próprio perfil'
);
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000005', 'Sem perfil', 'tecnico')$query$,
    '42501', NULL, 'auxiliar não pode vincular colaboradores'
);
SELECT throws_ok(
    $query$SELECT pavollos_admin.vincular_colaborador('5eba0000-0000-4000-8000-000000000005', 'Sem perfil', 'tecnico')$query$,
    '42501', NULL, 'a implementação privada também nega a chamada direta de um auxiliar'
);


SET LOCAL "request.jwt.claim.sub" = '5eba0000-0000-4000-8000-000000000003';
SET LOCAL "request.jwt.claims" = '{"sub":"5eba0000-0000-4000-8000-000000000003","role":"authenticated"}';
SELECT results_eq(
    'SELECT id FROM public.usuarios',
    ARRAY['5eba0000-0000-4000-8000-000000000003'::uuid],
    'técnico ativo vê apenas o próprio perfil'
);
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000005', 'Sem perfil', 'auxiliar')$query$,
    '42501', NULL, 'técnico não pode vincular colaboradores'
);


SET LOCAL "request.jwt.claim.sub" = '5eba0000-0000-4000-8000-000000000004';
SET LOCAL "request.jwt.claims" = '{"sub":"5eba0000-0000-4000-8000-000000000004","role":"authenticated"}';
SELECT is((SELECT count(id) FROM public.usuarios), 0::bigint, 'perfil inativo não consegue ler usuários');
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000005', 'Sem perfil', 'tecnico')$query$,
    '42501', NULL, 'perfil inativo não pode vincular colaboradores'
);


SET LOCAL "request.jwt.claim.sub" = '5eba0000-0000-4000-8000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub":"5eba0000-0000-4000-8000-000000000001","role":"authenticated"}';
SELECT results_eq(
    'SELECT id, nome, papel::text, ativo FROM public.usuarios',
    $$VALUES ('5eba0000-0000-4000-8000-000000000001'::uuid, 'Proprietário sintético'::text, 'proprietario'::text, true)$$,
    'proprietário ativo vê apenas seus campos permitidos'
);
SELECT throws_ok(
    $query$SELECT atualizado_em FROM public.usuarios$query$,
    '42501', NULL, 'coluna fora da concessão não pode ser lida'
);
SELECT throws_ok(
    $query$SELECT alvo_id FROM pavollos_admin.usuarios_auditoria$query$,
    '42501', NULL, 'auditoria é privada mesmo para proprietário'
);
SELECT throws_ok(
    $query$INSERT INTO public.usuarios (id, nome, papel) VALUES ('5eba0000-0000-4000-8000-000000000005', 'Sem perfil', 'auxiliar')$query$,
    '42501', NULL, 'proprietário não pode inserir perfis diretamente'
);
SELECT throws_ok(
    $query$UPDATE public.usuarios SET papel = 'tecnico' WHERE id = '5eba0000-0000-4000-8000-000000000001'$query$,
    '42501', NULL, 'proprietário não pode alterar papel diretamente'
);
SELECT throws_ok(
    $query$UPDATE public.usuarios SET ativo = true WHERE id = '5eba0000-0000-4000-8000-000000000004'$query$,
    '42501', NULL, 'proprietário não pode reativar diretamente'
);
SELECT throws_ok(
    $query$DELETE FROM public.usuarios WHERE id = '5eba0000-0000-4000-8000-000000000001'$query$,
    '42501', NULL, 'proprietário não pode excluir perfis diretamente'
);
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000006', 'Convite auxiliar', 'proprietario')$query$,
    '42501', NULL, 'vínculo não permite atribuir proprietário'
);
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000008', 'Sem convite', 'auxiliar')$query$,
    '22023', NULL, 'conta confirmada sem convite não é vinculável'
);
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000009', 'Sem confirmação', 'tecnico')$query$,
    '22023', NULL, 'convite ainda não confirmado não é vinculável'
);
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000004', 'Perfil inativo', 'auxiliar')$query$,
    '23505', NULL, 'vínculo não pode reativar ou trocar o papel de perfil existente'
);

SELECT is(
    public.vincular_colaborador('5eba0000-0000-4000-8000-000000000006', 'Convite auxiliar', 'auxiliar'),
    '5eba0000-0000-4000-8000-000000000006'::uuid,
    'proprietário ativo pode vincular auxiliar confirmado'
);
SELECT is(
    public.vincular_colaborador('5eba0000-0000-4000-8000-000000000007', 'Convite técnico', 'tecnico'),
    '5eba0000-0000-4000-8000-000000000007'::uuid,
    'proprietário ativo pode vincular técnico confirmado'
);
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000006', 'Convite auxiliar', 'tecnico')$query$,
    '23505', NULL, 'repetir o vínculo não sobrescreve o perfil'
);


SET LOCAL "request.jwt.claim.sub" = '5eba0000-0000-4000-8000-000000000006';
SET LOCAL "request.jwt.claims" = '{"sub":"5eba0000-0000-4000-8000-000000000006","role":"authenticated"}';
SELECT results_eq(
    'SELECT id, nome, papel::text, ativo FROM public.usuarios',
    $$VALUES ('5eba0000-0000-4000-8000-000000000006'::uuid, 'Convite auxiliar'::text, 'auxiliar'::text, true)$$,
    'conta vinculada lê seu próprio perfil ativo com papel aprovado'
);

RESET ROLE;
SELECT results_eq(
    $$SELECT alvo_id, ator_id, acao::text, papel::text
      FROM pavollos_admin.usuarios_auditoria
      WHERE ator_id = '5eba0000-0000-4000-8000-000000000001'
      ORDER BY alvo_id$$,
    $$VALUES
        ('5eba0000-0000-4000-8000-000000000006'::uuid, '5eba0000-0000-4000-8000-000000000001'::uuid, 'vincular_colaborador'::text, 'auxiliar'::text),
        ('5eba0000-0000-4000-8000-000000000007'::uuid, '5eba0000-0000-4000-8000-000000000001'::uuid, 'vincular_colaborador'::text, 'tecnico'::text)$$,
    'cada vínculo aceito é auditado e as tentativas negadas não gravam eventos'
);
SELECT results_eq(
    $$SELECT papel::text, ativo FROM public.usuarios WHERE id = '5eba0000-0000-4000-8000-000000000004'$$,
    $$VALUES ('tecnico'::text, false)$$,
    'a tentativa de vínculo preservou o papel e a inativação'
);

-- Confirme que o banco consulta o estado atual mesmo com a identidade do proprietário.
UPDATE public.usuarios SET ativo = false WHERE id = '5eba0000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;

SET LOCAL "request.jwt.claim.sub" = '5eba0000-0000-4000-8000-000000000001';
SET LOCAL "request.jwt.claims" = '{"sub":"5eba0000-0000-4000-8000-000000000001","role":"authenticated"}';
SELECT is((SELECT count(id) FROM public.usuarios), 0::bigint, 'proprietário desativado perde leitura');
SELECT throws_ok(
    $query$SELECT public.vincular_colaborador('5eba0000-0000-4000-8000-000000000005', 'Sem perfil', 'auxiliar')$query$,
    '42501', NULL, 'proprietário desativado perde autorização administrativa'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
