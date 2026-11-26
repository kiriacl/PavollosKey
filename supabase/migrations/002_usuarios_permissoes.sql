BEGIN;

SET LOCAL search_path = '';

-- Confere as dependências antes de abrir qualquer privilégio.
DO $preflight$
DECLARE
    v_usuarios regclass := pg_catalog.to_regclass('public.usuarios');
    v_auth_users regclass := pg_catalog.to_regclass('auth.users');
    v_tipo_papel regtype := pg_catalog.to_regtype('public.papel_usuario');
    v_perfil_id smallint;
    v_auth_id smallint;
BEGIN
    IF v_usuarios IS NULL OR v_auth_users IS NULL OR v_tipo_papel IS NULL
        OR pg_catalog.to_regprocedure('auth.uid()') IS NULL THEN
        RAISE EXCEPTION 'Esquema inicial de perfis ou Supabase Auth indisponível.';
    END IF;

    IF (SELECT pg_catalog.array_agg(e.enumlabel::text ORDER BY e.enumlabel::text COLLATE "C")
        FROM pg_catalog.pg_enum AS e WHERE e.enumtypid = v_tipo_papel)
        IS DISTINCT FROM ARRAY['auxiliar', 'proprietario', 'tecnico'] THEN
        RAISE EXCEPTION 'Os valores de public.papel_usuario divergem do DDL esperado.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (VALUES
            ('id', 'uuid'::regtype),
            ('nome', 'text'::regtype),
            ('papel', v_tipo_papel),
            ('ativo', 'boolean'::regtype)
        ) AS esperado(coluna, tipo)
        LEFT JOIN pg_catalog.pg_attribute AS a
          ON a.attrelid = v_usuarios AND a.attname = esperado.coluna
          AND a.atttypid = esperado.tipo AND a.attnotnull AND NOT a.attisdropped
        WHERE a.attnum IS NULL
    ) OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_attribute AS a
        WHERE a.attrelid = v_usuarios AND a.attnum > 0 AND NOT a.attisdropped
          AND a.attname NOT IN ('id', 'nome', 'papel', 'ativo')
          AND a.attnotnull AND NOT a.atthasdef AND a.attidentity = '' AND a.attgenerated = ''
    ) THEN
        RAISE EXCEPTION 'As colunas de public.usuarios divergem do contrato de vínculo.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (VALUES
            ('id', 'uuid'::regtype),
            ('invited_at', 'timestamptz'::regtype),
            ('email_confirmed_at', 'timestamptz'::regtype),
            ('deleted_at', 'timestamptz'::regtype)
        ) AS esperado(coluna, tipo)
        LEFT JOIN pg_catalog.pg_attribute AS a
          ON a.attrelid = v_auth_users AND a.attname = esperado.coluna
          AND a.atttypid = esperado.tipo AND NOT a.attisdropped
        WHERE a.attnum IS NULL
    ) THEN
        RAISE EXCEPTION 'As colunas de auth.users necessárias ao vínculo divergem do esperado.';
    END IF;

    SELECT a.attnum INTO v_perfil_id
    FROM pg_catalog.pg_attribute AS a
    WHERE a.attrelid = v_usuarios AND a.attname = 'id' AND NOT a.attisdropped;
    SELECT a.attnum INTO v_auth_id
    FROM pg_catalog.pg_attribute AS a
    WHERE a.attrelid = v_auth_users AND a.attname = 'id' AND NOT a.attisdropped;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint AS c
        WHERE c.conrelid = v_usuarios AND c.contype = 'p' AND c.convalidated
          AND c.conkey = ARRAY[v_perfil_id]
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint AS c
        WHERE c.conrelid = v_usuarios AND c.contype = 'f' AND c.convalidated
          AND c.conkey = ARRAY[v_perfil_id] AND c.confrelid = v_auth_users
          AND c.confkey = ARRAY[v_auth_id] AND c.confdeltype IN ('a', 'r')
    ) THEN
        RAISE EXCEPTION 'A PK de perfis ou a FK para auth.users não corresponde ao contrato.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class AS c
        WHERE c.oid = v_usuarios AND c.relkind = 'r' AND c.relrowsecurity
          AND c.relowner = (SELECT r.oid FROM pg_catalog.pg_roles AS r WHERE r.rolname = CURRENT_USER)
    ) OR pg_catalog.row_security_active(v_usuarios)
      OR pg_catalog.row_security_active(v_auth_users) THEN
        RAISE EXCEPTION 'Use o papel administrativo dono de public.usuarios, com RLS ativa para a aplicação.';
    END IF;

    LOCK TABLE public.usuarios IN SHARE ROW EXCLUSIVE MODE;

    IF EXISTS (SELECT 1 FROM pg_catalog.pg_policy AS p WHERE p.polrelid = v_usuarios)
      OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_trigger AS t
        WHERE t.tgrelid = v_usuarios AND NOT t.tgisinternal AND t.tgenabled <> 'D'
    ) THEN
        RAISE EXCEPTION 'Revise as políticas ou os gatilhos já presentes em public.usuarios.';
    END IF;

    IF NOT pg_catalog.has_schema_privilege(CURRENT_USER, 'auth', 'USAGE')
      OR EXISTS (
        SELECT 1
        FROM (VALUES ('id'), ('invited_at'), ('email_confirmed_at'), ('deleted_at')) AS esperado(coluna)
        WHERE NOT pg_catalog.has_column_privilege(CURRENT_USER, v_auth_users, esperado.coluna, 'SELECT')
    ) THEN
        RAISE EXCEPTION 'O executor da migração precisa ler os campos de convite do Supabase Auth.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_roles AS r
        WHERE r.rolname IN ('anon', 'authenticated')
          AND (r.rolsuper OR r.rolbypassrls OR pg_catalog.pg_has_role(r.oid, CURRENT_USER, 'MEMBER'))
    ) THEN
        RAISE EXCEPTION 'Os papéis da aplicação não podem contornar a RLS ou assumir o papel administrativo.';
    END IF;
END;
$preflight$;

-- O schema administrativo fica fora dos schemas expostos pela Data API.
CREATE SCHEMA pavollos_admin;
REVOKE ALL PRIVILEGES ON SCHEMA pavollos_admin FROM PUBLIC, anon, authenticated;

CREATE TABLE pavollos_admin.usuarios_auditoria (
    id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    acao text NOT NULL,
    ator_id uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    alvo_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    papel public.papel_usuario NOT NULL,
    operador_admin text,
    ocorrido_em timestamptz NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT usuarios_auditoria_acao_check CHECK (
        (acao = 'vincular_colaborador' AND ator_id IS NOT NULL AND ator_id <> alvo_id
            AND papel IN ('auxiliar', 'tecnico') AND operador_admin IS NULL)
        OR
        (acao = 'bootstrap_proprietario' AND ator_id IS NULL AND papel = 'proprietario'
            AND operador_admin IS NOT NULL AND operador_admin ~ '[^[:space:]]')
    )
);

ALTER TABLE pavollos_admin.usuarios_auditoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE pavollos_admin.usuarios_auditoria FROM PUBLIC, anon, authenticated;

-- A leitura explícita das quatro colunas é filtrada pelo UUID e pela situação atual.
REVOKE ALL PRIVILEGES ON TABLE public.usuarios FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, nome, papel, ativo) ON TABLE public.usuarios TO authenticated;

CREATE POLICY usuarios_ler_proprio_ativo
ON public.usuarios
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()) AND ativo);

-- A escrita administrativa precisa de privilégio porque a aplicação só pode ler a tabela.
CREATE FUNCTION pavollos_admin.vincular_colaborador(
    p_usuario_id uuid,
    p_nome text,
    p_papel public.papel_usuario
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $vinculo$
DECLARE
    v_ator uuid := auth.uid();
    v_alvo uuid;
BEGIN
    -- O bloqueio do perfil serializa a autorização com uma eventual desativação.
    PERFORM 1 FROM public.usuarios AS u
    WHERE u.id = v_ator AND u.ativo AND u.papel = 'proprietario'
    FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Operação não autorizada.';
    END IF;

    IF p_papel IS NULL OR p_papel NOT IN ('auxiliar', 'tecnico') THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Papel não autorizado para vínculo.';
    END IF;

    IF p_usuario_id IS NULL OR p_nome IS NULL OR p_nome !~ '[^[:space:]]' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Dados de vínculo inválidos.';
    END IF;

    -- O aceite e a origem da conta são conferidos no Auth pelo UUID.
    IF NOT EXISTS (
        SELECT 1 FROM auth.users AS a
        WHERE a.id = p_usuario_id AND a.invited_at IS NOT NULL
          AND a.email_confirmed_at IS NOT NULL AND a.deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Conta convidada e confirmada necessária.';
    END IF;

    INSERT INTO public.usuarios (id, nome, papel, ativo)
    VALUES (p_usuario_id, pg_catalog.btrim(p_nome), p_papel, true)
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO v_alvo;

    IF v_alvo IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Já existe um perfil vinculado a esta conta.';
    END IF;

    INSERT INTO pavollos_admin.usuarios_auditoria (acao, ator_id, alvo_id, papel)
    VALUES ('vincular_colaborador', v_ator, v_alvo, p_papel);

    RETURN v_alvo;
END;
$vinculo$;

-- A assinatura exposta usa os privilégios do chamador e delega à implementação privada.
CREATE FUNCTION public.vincular_colaborador(
    p_usuario_id uuid,
    p_nome text,
    p_papel public.papel_usuario
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $rpc$
    SELECT pavollos_admin.vincular_colaborador(p_usuario_id, p_nome, p_papel);
$rpc$;

REVOKE ALL PRIVILEGES ON FUNCTION pavollos_admin.vincular_colaborador(uuid, text, public.papel_usuario)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.vincular_colaborador(uuid, text, public.papel_usuario)
    FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA pavollos_admin TO authenticated;
GRANT EXECUTE ON FUNCTION pavollos_admin.vincular_colaborador(uuid, text, public.papel_usuario)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_colaborador(uuid, text, public.papel_usuario)
    TO authenticated;

-- A verificação efetiva detecta privilégios herdados além das concessões explícitas.
DO $privilegios$
DECLARE
    v_coluna record;
    v_papel name;
    v_privilegio_tabela constant text := CASE
        WHEN pg_catalog.current_setting('server_version_num')::integer >= 170000 THEN
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'
        ELSE
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    END;
BEGIN
    FOREACH v_papel IN ARRAY ARRAY['anon'::name, 'authenticated'::name] LOOP
        IF pg_catalog.has_table_privilege(v_papel, 'public.usuarios', v_privilegio_tabela)
          OR pg_catalog.has_any_column_privilege(v_papel, 'public.usuarios', 'INSERT, UPDATE, REFERENCES')
          OR pg_catalog.has_table_privilege(v_papel, 'pavollos_admin.usuarios_auditoria', v_privilegio_tabela)
          OR pg_catalog.has_any_column_privilege(v_papel, 'pavollos_admin.usuarios_auditoria', 'SELECT, INSERT, UPDATE, REFERENCES')
          OR pg_catalog.has_schema_privilege(v_papel, 'pavollos_admin', 'CREATE') THEN
            RAISE EXCEPTION 'Privilégio direto ou herdado incompatível para %.', v_papel;
        END IF;
    END LOOP;

    IF pg_catalog.has_any_column_privilege('anon', 'public.usuarios', 'SELECT')
      OR pg_catalog.has_schema_privilege('anon', 'pavollos_admin', 'USAGE')
      OR pg_catalog.has_function_privilege('anon', 'public.vincular_colaborador(uuid,text,public.papel_usuario)', 'EXECUTE')
      OR pg_catalog.has_function_privilege('anon', 'pavollos_admin.vincular_colaborador(uuid,text,public.papel_usuario)', 'EXECUTE') THEN
        RAISE EXCEPTION 'O papel anon recebeu acesso indevido.';
    END IF;

    IF NOT pg_catalog.has_function_privilege('authenticated', 'auth.uid()', 'EXECUTE')
      OR pg_catalog.has_schema_privilege('authenticated', 'pavollos_admin', 'USAGE WITH GRANT OPTION')
      OR pg_catalog.has_function_privilege('authenticated',
          'public.vincular_colaborador(uuid,text,public.papel_usuario)', 'EXECUTE WITH GRANT OPTION')
      OR pg_catalog.has_function_privilege('authenticated',
          'pavollos_admin.vincular_colaborador(uuid,text,public.papel_usuario)', 'EXECUTE WITH GRANT OPTION') THEN
        RAISE EXCEPTION 'Privilégios de execução incompatíveis para authenticated.';
    END IF;

    FOR v_coluna IN
        SELECT a.attname FROM pg_catalog.pg_attribute AS a
        WHERE a.attrelid = 'public.usuarios'::regclass AND a.attnum > 0 AND NOT a.attisdropped
    LOOP
        IF pg_catalog.has_column_privilege('authenticated', 'public.usuarios', v_coluna.attname::text, 'SELECT')
          IS DISTINCT FROM (v_coluna.attname IN ('id', 'nome', 'papel', 'ativo'))
          OR pg_catalog.has_column_privilege('authenticated', 'public.usuarios',
              v_coluna.attname::text, 'SELECT WITH GRANT OPTION') THEN
            RAISE EXCEPTION 'Privilégio de leitura incompatível em public.usuarios.%', v_coluna.attname;
        END IF;
    END LOOP;
END;
$privilegios$;

COMMIT;
