-- P?vollosKeys. Pr?-requisito: migra??o 002 aplicada.
-- No SQL Editor, execute um bloco completo de BEGIN a COMMIT por vez.
-- Fa?a a auditoria ap?s cada bloco conforme supabase/deploy/README.md.

-- 003_clientes_atendimentos.sql (SHA-256 do arquivo de origem: 18905f97a811673916b28b2112827e2029397a1da84cd5e59298177e89b0be6f)
BEGIN;

SET LOCAL search_path = '';

-- As RPCs trabalham sobre o banco existente. Rejeite tabelas fora da configuração
-- esperada e privilégios efetivos que permitiriam acesso direto aos dados.
DO $preflight$
DECLARE
    v_nome text;
    v_tabela regclass;
    v_papel name;
BEGIN
    FOREACH v_nome IN ARRAY ARRAY[
        'clientes', 'atendimentos', 'cotacoes', 'orcamentos',
        'itens_orcamento', 'ordens_servico', 'historico_status'
    ] LOOP
        v_tabela := pg_catalog.to_regclass('public.' || v_nome);
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_class AS c
            WHERE c.oid = v_tabela AND c.relkind = 'r' AND c.relrowsecurity
              AND c.relowner = (SELECT r.oid FROM pg_catalog.pg_roles AS r WHERE r.rolname = CURRENT_USER)
        ) OR pg_catalog.row_security_active(v_tabela) THEN
            RAISE EXCEPTION 'Confira a tabela public.% e o papel administrativo executor.', v_nome;
        END IF;

        FOREACH v_papel IN ARRAY ARRAY['anon'::name, 'authenticated'::name] LOOP
            IF pg_catalog.has_table_privilege(
                v_papel, v_tabela, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
            ) OR pg_catalog.has_any_column_privilege(
                v_papel, v_tabela, 'SELECT, INSERT, UPDATE, REFERENCES'
            ) THEN
                RAISE EXCEPTION 'Confira privilégios diretos ou herdados de % sobre public.%.', v_papel, v_nome;
            END IF;
        END LOOP;
    END LOOP;
END;
$preflight$;

-- As funções abaixo são internas e usam os privilégios da RPC que as chama.
CREATE FUNCTION pavollos_admin.exigir_perfil(p_papeis text[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $perfil$
DECLARE
    v_ator uuid := auth.uid();
BEGIN
    PERFORM 1 FROM public.usuarios AS u
    WHERE u.id = v_ator AND u.ativo AND u.papel::text = ANY(p_papeis)
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Operação não autorizada.';
    END IF;

    RETURN v_ator;
END;
$perfil$;

REVOKE ALL PRIVILEGES ON FUNCTION pavollos_admin.exigir_perfil(text[])
    FROM PUBLIC, anon, authenticated;

CREATE FUNCTION pavollos_admin.registrar_status(
    p_ator uuid,
    p_anterior text,
    p_novo text,
    p_atendimento uuid DEFAULT NULL,
    p_orcamento uuid DEFAULT NULL,
    p_ordem uuid DEFAULT NULL,
    p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $historico$
BEGIN
    IF pg_catalog.num_nonnulls(p_atendimento, p_orcamento, p_ordem) <> 1 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe uma única entidade para o histórico.';
    END IF;

    INSERT INTO public.historico_status (
        ator_id, atendimento_id, orcamento_id, ordem_servico_id,
        tipo_evento, status_anterior, status_novo, motivo, ocorrido_em
    )
    VALUES (
        p_ator, p_atendimento, p_orcamento, p_ordem, 'status',
        p_anterior, p_novo, p_motivo, pg_catalog.clock_timestamp()
    );
END;
$historico$;

REVOKE ALL PRIVILEGES ON FUNCTION pavollos_admin.registrar_status(uuid, text, text, uuid, uuid, uuid, text)
    FROM PUBLIC, anon, authenticated;

CREATE FUNCTION pavollos_admin.mvp_operacoes(p_acao text, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $operacoes$
DECLARE
    v_ator uuid;
    v_campos text[];
    v_id uuid;
    v_cliente_id uuid;
    v_limite integer := 30;
    v_deslocamento integer := 0;
    v_nome text;
    v_telefone text;
    v_email text;
    v_descricao text;
    v_motivo text;
    v_canal text;
    v_anterior public.status_atendimento;
    v_novo public.status_atendimento;
    v_resultado jsonb;
    v_uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
    v_ator := pavollos_admin.exigir_perfil(
        CASE WHEN p_acao IN ('cancelar_atendimento', 'listar_tecnicos') THEN ARRAY['proprietario']
             ELSE ARRAY['proprietario', 'auxiliar']
        END
    );

    v_campos := CASE p_acao
        WHEN 'listar_tecnicos' THEN ARRAY['limite', 'deslocamento']
        WHEN 'listar_clientes' THEN ARRAY['limite', 'deslocamento']
        WHEN 'criar_cliente' THEN ARRAY['nome', 'telefone', 'email']
        WHEN 'obter_cliente' THEN ARRAY['id']
        WHEN 'atualizar_cliente' THEN ARRAY['id', 'nome', 'telefone', 'email']
        WHEN 'listar_atendimentos' THEN ARRAY['limite', 'deslocamento', 'cliente_id']
        WHEN 'criar_atendimento' THEN ARRAY['cliente_id', 'canal_entrada', 'descricao']
        WHEN 'obter_atendimento' THEN ARRAY['id']
        WHEN 'encerrar_atendimento' THEN ARRAY['id', 'motivo']
        WHEN 'cancelar_atendimento' THEN ARRAY['id', 'motivo']
        WHEN 'historico_atendimento' THEN ARRAY['id', 'limite', 'deslocamento']
    END;

    IF v_campos IS NULL OR pg_catalog.jsonb_typeof(p_dados) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Operação ou dados inválidos.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_catalog.jsonb_object_keys(p_dados) AS campo(chave)
        WHERE NOT (campo.chave = ANY(v_campos))
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Há campos não permitidos na operação.';
    END IF;

    IF p_dados ? 'id' THEN
        IF pg_catalog.jsonb_typeof(p_dados -> 'id') IS DISTINCT FROM 'string'
          OR (p_dados ->> 'id') !~* v_uuid_pattern THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O identificador deve ser um UUID.';
        END IF;
        v_id := (p_dados ->> 'id')::uuid;
    END IF;

    IF p_dados ? 'cliente_id' THEN
        IF pg_catalog.jsonb_typeof(p_dados -> 'cliente_id') IS DISTINCT FROM 'string'
          OR (p_dados ->> 'cliente_id') !~* v_uuid_pattern THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O identificador do cliente deve ser um UUID.';
        END IF;
        v_cliente_id := (p_dados ->> 'cliente_id')::uuid;
    END IF;

    IF p_acao IN (
        'obter_cliente', 'atualizar_cliente', 'obter_atendimento',
        'encerrar_atendimento', 'cancelar_atendimento', 'historico_atendimento'
    ) AND v_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O identificador é obrigatório.';
    END IF;

    IF p_dados ? 'limite' THEN
        IF pg_catalog.jsonb_typeof(p_dados -> 'limite') IS DISTINCT FROM 'number'
          OR (p_dados ->> 'limite') !~ '^[0-9]{1,3}$' THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O limite deve ser um inteiro entre 1 e 100.';
        END IF;
        v_limite := (p_dados ->> 'limite')::integer;
        IF v_limite NOT BETWEEN 1 AND 100 THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O limite deve ser um inteiro entre 1 e 100.';
        END IF;
    END IF;

    IF p_dados ? 'deslocamento' THEN
        IF pg_catalog.jsonb_typeof(p_dados -> 'deslocamento') IS DISTINCT FROM 'number'
          OR (p_dados ->> 'deslocamento') !~ '^[0-9]{1,5}$' THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O deslocamento deve ser um inteiro entre 0 e 10000.';
        END IF;
        v_deslocamento := (p_dados ->> 'deslocamento')::integer;
        IF v_deslocamento > 10000 THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O deslocamento deve ser um inteiro entre 0 e 10000.';
        END IF;
    END IF;

    IF p_acao = 'listar_tecnicos' THEN
        SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.nome, item.id), '[]'::jsonb)
        INTO v_resultado
        FROM (
            SELECT u.id, u.nome
            FROM public.usuarios AS u
            WHERE u.ativo AND u.papel = 'tecnico'
            ORDER BY u.nome, u.id
            LIMIT v_limite OFFSET v_deslocamento
        ) AS item;
        RETURN v_resultado;
    END IF;

    IF p_acao = 'listar_clientes' THEN
        SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.criado_em DESC, item.id), '[]'::jsonb)
        INTO v_resultado
        FROM (
            SELECT c.id, c.nome, c.telefone, c.email, c.criado_em, c.atualizado_em
            FROM public.clientes AS c
            ORDER BY c.criado_em DESC, c.id
            LIMIT v_limite OFFSET v_deslocamento
        ) AS item;
        RETURN v_resultado;
    END IF;

    IF p_acao IN ('criar_cliente', 'atualizar_cliente') THEN
        IF p_acao = 'atualizar_cliente' AND NOT (p_dados ?| ARRAY['nome', 'telefone', 'email']) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe pelo menos um campo para atualizar.';
        END IF;

        IF p_acao = 'criar_cliente' OR p_dados ? 'nome' THEN
            v_nome := pg_catalog.btrim(p_dados ->> 'nome');
            IF pg_catalog.jsonb_typeof(p_dados -> 'nome') IS DISTINCT FROM 'string'
              OR v_nome !~ '[^[:space:]]' OR pg_catalog.length(v_nome) > 120 THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe um nome com até 120 caracteres.';
            END IF;
        END IF;

        IF p_dados ? 'telefone' THEN
            IF pg_catalog.jsonb_typeof(p_dados -> 'telefone') NOT IN ('null', 'string') THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O telefone deve ser texto ou nulo.';
            END IF;
            v_telefone := NULLIF(pg_catalog.btrim(p_dados ->> 'telefone'), '');
            IF v_telefone IS NOT NULL AND (
                pg_catalog.length(v_telefone) > 40
                OR v_telefone !~ '^[+().0-9[:space:]-]+$'
                OR pg_catalog.length(pg_catalog.regexp_replace(v_telefone, '[^0-9]', '', 'g')) NOT BETWEEN 7 AND 15
            ) THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe um telefone válido.';
            END IF;
        END IF;

        IF p_dados ? 'email' THEN
            IF pg_catalog.jsonb_typeof(p_dados -> 'email') NOT IN ('null', 'string') THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O e-mail deve ser texto ou nulo.';
            END IF;
            v_email := NULLIF(pg_catalog.btrim(p_dados ->> 'email'), '');
            IF v_email IS NOT NULL AND (
                pg_catalog.length(v_email) > 254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
            ) THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe um e-mail válido.';
            END IF;
        END IF;

        IF p_acao = 'criar_cliente' THEN
            INSERT INTO public.clientes (nome, telefone, email)
            VALUES (v_nome, v_telefone, v_email)
            RETURNING id INTO v_id;
        ELSE
            UPDATE public.clientes AS c
            SET nome = CASE WHEN p_dados ? 'nome' THEN v_nome ELSE c.nome END,
                telefone = CASE WHEN p_dados ? 'telefone' THEN v_telefone ELSE c.telefone END,
                email = CASE WHEN p_dados ? 'email' THEN v_email ELSE c.email END,
                atualizado_em = pg_catalog.clock_timestamp()
            WHERE c.id = v_id;
        END IF;
    END IF;

    IF p_acao IN ('criar_cliente', 'obter_cliente', 'atualizar_cliente') THEN
        SELECT pg_catalog.jsonb_build_object(
            'id', c.id, 'nome', c.nome, 'telefone', c.telefone, 'email', c.email,
            'criado_em', c.criado_em, 'atualizado_em', c.atualizado_em
        ) INTO v_resultado
        FROM public.clientes AS c WHERE c.id = v_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cliente não encontrado.';
        END IF;
        RETURN v_resultado;
    END IF;

    IF p_acao = 'listar_atendimentos' THEN
        SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item) ORDER BY item.criado_em DESC, item.id), '[]'::jsonb)
        INTO v_resultado
        FROM (
            SELECT a.id, a.cliente_id, a.criado_por, a.canal_entrada, a.descricao, a.status,
                a.motivo_cancelamento, a.cancelado_em, a.cancelado_por, a.criado_em, a.atualizado_em
            FROM public.atendimentos AS a
            WHERE v_cliente_id IS NULL OR a.cliente_id = v_cliente_id
            ORDER BY a.criado_em DESC, a.id
            LIMIT v_limite OFFSET v_deslocamento
        ) AS item;
        RETURN v_resultado;
    END IF;

    IF p_acao = 'criar_atendimento' THEN
        v_canal := p_dados ->> 'canal_entrada';
        v_descricao := pg_catalog.btrim(p_dados ->> 'descricao');
        IF v_cliente_id IS NULL OR v_canal IS NULL OR v_canal NOT IN ('presencial', 'whatsapp')
          OR pg_catalog.jsonb_typeof(p_dados -> 'descricao') IS DISTINCT FROM 'string'
          OR v_descricao !~ '[^[:space:]]' OR pg_catalog.length(v_descricao) > 4000 THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe cliente, canal e descrição com até 4000 caracteres.';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.clientes AS c WHERE c.id = v_cliente_id) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cliente não encontrado.';
        END IF;

        INSERT INTO public.atendimentos (cliente_id, criado_por, canal_entrada, descricao, status)
        VALUES (v_cliente_id, v_ator, v_canal::public.canal_atendimento, v_descricao, 'aberto')
        RETURNING id INTO v_id;
        PERFORM pavollos_admin.registrar_status(v_ator, NULL, 'aberto', p_atendimento => v_id);
    END IF;

    IF p_acao IN ('encerrar_atendimento', 'cancelar_atendimento') THEN
        IF p_dados ? 'motivo' AND pg_catalog.jsonb_typeof(p_dados -> 'motivo') IS DISTINCT FROM 'string' THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O motivo deve ser texto.';
        END IF;
        v_motivo := NULLIF(pg_catalog.btrim(p_dados ->> 'motivo'), '');
        IF v_motivo IS NOT NULL AND (v_motivo !~ '[^[:space:]]' OR pg_catalog.length(v_motivo) > 2000) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe um motivo válido com até 2000 caracteres.';
        END IF;

        SELECT a.status INTO v_anterior FROM public.atendimentos AS a WHERE a.id = v_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Atendimento não encontrado.';
        END IF;
        IF v_anterior <> 'aberto' THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Apenas atendimentos abertos podem ser encerrados ou cancelados.';
        END IF;
        IF EXISTS (
            SELECT 1 FROM public.cotacoes AS c
            JOIN public.orcamentos AS o ON o.cotacao_id = c.id
            WHERE c.atendimento_id = v_id AND o.status = 'enviado'
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Há orçamento enviado com decisão pendente.';
        END IF;
        IF EXISTS (
            SELECT 1 FROM public.cotacoes AS c
            JOIN public.orcamentos AS o ON o.cotacao_id = c.id
            JOIN public.itens_orcamento AS i ON i.orcamento_id = o.id
            JOIN public.ordens_servico AS os ON os.item_orcamento_id = i.id
            WHERE c.atendimento_id = v_id AND os.status NOT IN ('concluida', 'cancelada')
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Há ordem de serviço em andamento.';
        END IF;
        IF v_motivo IS NULL AND (
            p_acao = 'cancelar_atendimento'
            OR EXISTS (
                SELECT 1 FROM public.cotacoes AS c
                JOIN public.orcamentos AS o ON o.cotacao_id = c.id
                JOIN public.itens_orcamento AS i ON i.orcamento_id = o.id
                WHERE c.atendimento_id = v_id AND o.status = 'aprovado'
                  AND NOT EXISTS (SELECT 1 FROM public.ordens_servico AS os WHERE os.item_orcamento_id = i.id)
            )
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe o motivo do cancelamento ou do encerramento sem executar itens aprovados.';
        END IF;

        v_novo := CASE WHEN p_acao = 'cancelar_atendimento' THEN 'cancelado'
                       ELSE 'encerrado'
                  END::public.status_atendimento;
        UPDATE public.atendimentos AS a
        SET status = v_novo,
            motivo_cancelamento = CASE WHEN v_novo = 'cancelado' THEN v_motivo END,
            cancelado_em = CASE WHEN v_novo = 'cancelado' THEN pg_catalog.clock_timestamp() END,
            cancelado_por = CASE WHEN v_novo = 'cancelado' THEN v_ator END,
            atualizado_em = pg_catalog.clock_timestamp()
        WHERE a.id = v_id;

        PERFORM pavollos_admin.registrar_status(
            v_ator, v_anterior::text, v_novo::text, p_atendimento => v_id, p_motivo => v_motivo
        );
    END IF;

    IF p_acao IN ('criar_atendimento', 'obter_atendimento', 'encerrar_atendimento', 'cancelar_atendimento') THEN
        SELECT pg_catalog.jsonb_build_object(
            'id', a.id, 'cliente_id', a.cliente_id, 'criado_por', a.criado_por,
            'canal_entrada', a.canal_entrada, 'descricao', a.descricao, 'status', a.status,
            'motivo_cancelamento', a.motivo_cancelamento, 'cancelado_em', a.cancelado_em,
            'cancelado_por', a.cancelado_por, 'criado_em', a.criado_em, 'atualizado_em', a.atualizado_em
        ) INTO v_resultado
        FROM public.atendimentos AS a WHERE a.id = v_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Atendimento não encontrado.';
        END IF;
        RETURN v_resultado;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.atendimentos AS a WHERE a.id = v_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Atendimento não encontrado.';
    END IF;

    -- O histórico agrega eventos do atendimento e das suas versões e ordens.
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(evento) ORDER BY evento.ocorrido_em DESC, evento.id), '[]'::jsonb)
    INTO v_resultado
    FROM (
        WITH orcamentos_do_atendimento AS (
            SELECT o.id FROM public.orcamentos AS o
            JOIN public.cotacoes AS c ON c.id = o.cotacao_id
            WHERE c.atendimento_id = v_id
        ),
        ordens_do_atendimento AS (
            SELECT os.id FROM public.ordens_servico AS os
            JOIN public.itens_orcamento AS i ON i.id = os.item_orcamento_id
            JOIN orcamentos_do_atendimento AS o ON o.id = i.orcamento_id
        )
        SELECT h.id, h.atendimento_id, h.orcamento_id, h.ordem_servico_id, h.ator_id,
            h.ocorrido_em, h.tipo_evento, h.status_anterior, h.status_novo,
            h.tecnico_anterior_id, h.tecnico_novo_id, h.motivo
        FROM public.historico_status AS h
        WHERE h.atendimento_id = v_id
          OR h.orcamento_id IN (SELECT o.id FROM orcamentos_do_atendimento AS o)
          OR h.ordem_servico_id IN (SELECT os.id FROM ordens_do_atendimento AS os)
        ORDER BY h.ocorrido_em DESC, h.id
        LIMIT v_limite OFFSET v_deslocamento
    ) AS evento;
    RETURN v_resultado;
END;
$operacoes$;

CREATE FUNCTION public.mvp_operacoes(p_acao text, p_dados jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $rpc$
    SELECT pavollos_admin.mvp_operacoes(p_acao, p_dados);
$rpc$;

REVOKE ALL PRIVILEGES ON FUNCTION pavollos_admin.mvp_operacoes(text, jsonb)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.mvp_operacoes(text, jsonb)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pavollos_admin.mvp_operacoes(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_operacoes(text, jsonb) TO authenticated;

DO $privilegios$
BEGIN
    IF pg_catalog.has_function_privilege('anon', 'public.mvp_operacoes(text,jsonb)', 'EXECUTE')
       OR pg_catalog.has_function_privilege('anon', 'pavollos_admin.mvp_operacoes(text,jsonb)', 'EXECUTE')
       OR pg_catalog.has_function_privilege('authenticated', 'pavollos_admin.exigir_perfil(text[])', 'EXECUTE')
       OR pg_catalog.has_function_privilege(
            'authenticated', 'pavollos_admin.registrar_status(uuid,text,text,uuid,uuid,uuid,text)', 'EXECUTE'
       ) THEN
        RAISE EXCEPTION 'Privilégios de execução herdados incompatíveis com a API de operações.';
    END IF;
END;
$privilegios$;

COMMIT;


-- 004_cotacoes_orcamentos.sql (SHA-256 do arquivo de origem: 4345bf428256c67c30771d7b359d6dc018457ede14bec7fc0d9f5e6adf647e3d)
BEGIN;

SET LOCAL search_path = '';

-- A migração 003 fornece os guardas de perfil e de histórico.
DO $preflight$
DECLARE
    v_nome text;
    v_tabela regclass;
BEGIN
    IF pg_catalog.to_regprocedure('pavollos_admin.exigir_perfil(text[])') IS NULL
      OR pg_catalog.to_regprocedure('pavollos_admin.registrar_status(uuid,text,text,uuid,uuid,uuid,text)') IS NULL THEN
        RAISE EXCEPTION 'A migração de clientes e atendimentos precisa ser aplicada primeiro.';
    END IF;

    FOREACH v_nome IN ARRAY ARRAY[
        'public.atendimentos', 'public.cotacoes', 'public.orcamentos', 'public.itens_orcamento'
    ] LOOP
        v_tabela := pg_catalog.to_regclass(v_nome);
        IF v_tabela IS NULL OR NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_class AS c
            WHERE c.oid = v_tabela AND c.relkind = 'r' AND c.relrowsecurity
              AND c.relowner = (SELECT r.oid FROM pg_catalog.pg_roles AS r WHERE r.rolname = CURRENT_USER)
        ) OR pg_catalog.row_security_active(v_tabela) THEN
            RAISE EXCEPTION 'Revise a estrutura, a RLS e a propriedade de %.', v_nome;
        END IF;

        IF pg_catalog.has_any_column_privilege('anon', v_tabela, 'SELECT,INSERT,UPDATE,REFERENCES')
          OR pg_catalog.has_any_column_privilege('authenticated', v_tabela, 'SELECT,INSERT,UPDATE,REFERENCES')
          OR pg_catalog.has_table_privilege('anon', v_tabela, 'DELETE,TRUNCATE,TRIGGER')
          OR pg_catalog.has_table_privilege('authenticated', v_tabela, 'DELETE,TRUNCATE,TRIGGER') THEN
            RAISE EXCEPTION 'Revise os privilégios diretos de aplicação sobre %.', v_nome;
        END IF;
    END LOOP;

    PERFORM a.id, a.status FROM public.atendimentos AS a WHERE false;
    PERFORM c.id, c.atendimento_id, c.tipo, c.criado_em, c.atualizado_em
    FROM public.cotacoes AS c WHERE false;
    PERFORM o.id, o.cotacao_id, o.versao, o.status, o.validade_ate, o.enviado_em,
        o.aprovado_em, o.canal_aceite, o.evidencia_aceite, o.aceite_registrado_por,
        o.criado_em, o.atualizado_em
    FROM public.orcamentos AS o WHERE false;
    PERFORM i.id, i.orcamento_id, i.posicao, i.escopo, i.valor, i.criado_em, i.atualizado_em
    FROM public.itens_orcamento AS i WHERE false;
END;
$preflight$;

CREATE FUNCTION pavollos_admin.mvp_orcamentos(p_acao text, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $orcamentos$
DECLARE
    v_ator uuid;
    v_atendimento_id uuid;
    v_cotacao_id uuid;
    v_orcamento_id uuid;
    v_substituido_id uuid;
    v_status_atendimento text;
    v_status_anterior text;
    v_novo_status text;
    v_versao integer;
    v_tipo text;
    v_canal text;
    v_evidencia text;
    v_motivo text;
    v_validade timestamptz;
    v_enviado_em timestamptz;
    v_agora timestamptz;
    v_itens jsonb := '[]'::jsonb;
    v_item jsonb;
    v_escopo text;
    v_valor numeric;
    v_posicao integer;
    v_limite integer;
    v_deslocamento integer;
    v_leitura boolean;
    v_resultado jsonb;
BEGIN
    v_ator := pavollos_admin.exigir_perfil(ARRAY['proprietario', 'auxiliar']);

    IF COALESCE(pg_catalog.jsonb_typeof(p_dados), '') <> 'object'
      OR p_acao IS NULL OR p_acao NOT IN (
        'listar_cotacoes', 'criar_cotacao', 'listar_orcamentos', 'criar_orcamento',
        'obter_orcamento', 'adicionar_item', 'enviar_orcamento', 'aprovar_orcamento',
        'recusar_orcamento', 'expirar_orcamento'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Operação de orçamento inválida.';
    END IF;

    v_leitura := p_acao IN ('listar_cotacoes', 'listar_orcamentos', 'obter_orcamento');
    IF p_acao IN ('listar_cotacoes', 'listar_orcamentos') THEN
        v_limite := COALESCE((p_dados->>'limite')::integer, 50);
        v_deslocamento := COALESCE((p_dados->>'deslocamento')::integer, 0);
        IF v_limite NOT BETWEEN 1 AND 100 OR v_deslocamento < 0 THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Paginação inválida.';
        END IF;
    END IF;

    IF p_acao IN ('listar_cotacoes', 'criar_cotacao') THEN
        v_atendimento_id := (p_dados->>'atendimento_id')::uuid;
        IF v_atendimento_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Atendimento obrigatório.';
        END IF;
    ELSIF p_acao IN ('listar_orcamentos', 'criar_orcamento') THEN
        v_cotacao_id := (p_dados->>'cotacao_id')::uuid;
        IF v_cotacao_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cotação obrigatória.';
        END IF;

        SELECT c.atendimento_id INTO v_atendimento_id
        FROM public.cotacoes AS c WHERE c.id = v_cotacao_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cotação não encontrada.';
        END IF;
    ELSE
        v_orcamento_id := (p_dados->>'id')::uuid;
        IF v_orcamento_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Orçamento obrigatório.';
        END IF;

        SELECT o.cotacao_id, c.atendimento_id INTO v_cotacao_id, v_atendimento_id
        FROM public.orcamentos AS o
        JOIN public.cotacoes AS c ON c.id = o.cotacao_id
        WHERE o.id = v_orcamento_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Orçamento não encontrado.';
        END IF;
    END IF;

    -- As mutações de cotações, versões e ordens da mesma solicitação usam o mesmo bloqueio pai.
    IF v_leitura THEN
        SELECT a.status::text INTO v_status_atendimento
        FROM public.atendimentos AS a WHERE a.id = v_atendimento_id;
    ELSE
        SELECT a.status::text INTO v_status_atendimento
        FROM public.atendimentos AS a WHERE a.id = v_atendimento_id
        FOR UPDATE;
    END IF;
    IF v_status_atendimento IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Atendimento não encontrado.';
    END IF;
    IF NOT v_leitura AND v_status_atendimento <> 'aberto' THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'O atendimento não está aberto.';
    END IF;

    IF v_cotacao_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.cotacoes AS c
        WHERE c.id = v_cotacao_id AND c.atendimento_id = v_atendimento_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cotação não encontrada.';
    END IF;
    IF v_orcamento_id IS NOT NULL THEN
        SELECT o.status::text, o.validade_ate, o.enviado_em, o.versao
          INTO v_status_anterior, v_validade, v_enviado_em, v_versao
        FROM public.orcamentos AS o WHERE o.id = v_orcamento_id AND o.cotacao_id = v_cotacao_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Orçamento não encontrado.';
        END IF;
    END IF;

    IF p_acao = 'listar_cotacoes' THEN
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) ORDER BY c.criado_em DESC, c.id)
          INTO v_resultado
        FROM (
            SELECT c.id, c.atendimento_id, c.tipo, c.criado_em, c.atualizado_em
            FROM public.cotacoes AS c WHERE c.atendimento_id = v_atendimento_id
            ORDER BY c.criado_em DESC, c.id LIMIT v_limite OFFSET v_deslocamento
        ) AS c;
        RETURN COALESCE(v_resultado, '[]'::jsonb);
    ELSIF p_acao = 'listar_orcamentos' THEN
        SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(o) ORDER BY o.versao DESC, o.id)
          INTO v_resultado
        FROM (
            SELECT o.id, o.cotacao_id, o.versao, o.status, o.validade_ate, o.enviado_em,
                o.aprovado_em, o.canal_aceite, o.evidencia_aceite, o.aceite_registrado_por,
                o.criado_em, o.atualizado_em,
                (SELECT COALESCE(pg_catalog.sum(i.valor), 0::numeric)
                 FROM public.itens_orcamento AS i WHERE i.orcamento_id = o.id) AS total
            FROM public.orcamentos AS o WHERE o.cotacao_id = v_cotacao_id
            ORDER BY o.versao DESC, o.id LIMIT v_limite OFFSET v_deslocamento
        ) AS o;
        RETURN COALESCE(v_resultado, '[]'::jsonb);
    ELSIF p_acao = 'criar_cotacao' THEN
        v_tipo := p_dados->>'tipo';
        IF v_tipo IS NULL OR v_tipo NOT IN ('inicial', 'complementar') THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tipo de cotação inválido.';
        END IF;
        IF v_tipo = 'inicial' AND EXISTS (
            SELECT 1 FROM public.cotacoes AS c
            WHERE c.atendimento_id = v_atendimento_id AND c.tipo = 'inicial'
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'O atendimento já possui cotação inicial.';
        END IF;

        INSERT INTO public.cotacoes AS c (atendimento_id, tipo)
        VALUES (v_atendimento_id, v_tipo::public.tipo_cotacao)
        RETURNING pg_catalog.jsonb_build_object(
            'id', c.id, 'atendimento_id', c.atendimento_id, 'tipo', c.tipo,
            'criado_em', c.criado_em, 'atualizado_em', c.atualizado_em
        ) INTO v_resultado;
        RETURN v_resultado;
    END IF;

    IF p_acao = 'criar_orcamento' THEN
        IF EXISTS (
            SELECT 1 FROM public.orcamentos AS o
            WHERE o.cotacao_id = v_cotacao_id AND o.status = 'aprovado'
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Use uma cotação complementar para novo escopo.';
        END IF;
        IF p_dados->>'validade_ate' IS NOT NULL THEN
            IF pg_catalog.jsonb_typeof(p_dados->'validade_ate') <> 'string' THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Validade inválida.';
            END IF;
            v_validade := (p_dados->>'validade_ate')::timestamptz;
            IF NOT pg_catalog.isfinite(v_validade) THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Validade inválida.';
            END IF;
        END IF;
        v_itens := COALESCE(NULLIF(p_dados->'itens', 'null'::jsonb), '[]'::jsonb);

        SELECT COALESCE(pg_catalog.max(o.versao), 0) + 1 INTO v_versao
        FROM public.orcamentos AS o WHERE o.cotacao_id = v_cotacao_id;
        INSERT INTO public.orcamentos (cotacao_id, versao, validade_ate, status)
        VALUES (v_cotacao_id, v_versao, v_validade, 'rascunho')
        RETURNING id INTO v_orcamento_id;
        PERFORM pavollos_admin.registrar_status(v_ator, NULL, 'rascunho', p_orcamento => v_orcamento_id);
    ELSIF p_acao = 'adicionar_item' THEN
        IF v_status_anterior <> 'rascunho' OR v_enviado_em IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM public.orcamentos AS o
            WHERE o.cotacao_id = v_cotacao_id AND (o.versao > v_versao OR o.status = 'aprovado')
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Apenas a última versão em rascunho pode receber itens.';
        END IF;
        v_itens := pg_catalog.jsonb_build_array(p_dados);
    END IF;

    IF p_acao IN ('criar_orcamento', 'adicionar_item') THEN
        IF pg_catalog.jsonb_typeof(v_itens) <> 'array' THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Itens devem ser informados como lista.';
        END IF;
        SELECT COALESCE(pg_catalog.max(i.posicao), 0) INTO v_posicao
        FROM public.itens_orcamento AS i WHERE i.orcamento_id = v_orcamento_id;
        IF v_posicao + pg_catalog.jsonb_array_length(v_itens) > 100 THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O orçamento aceita até 100 itens.';
        END IF;

        FOR v_item IN SELECT j.value FROM pg_catalog.jsonb_array_elements(v_itens) AS j LOOP
            IF pg_catalog.jsonb_typeof(v_item) <> 'object'
              OR COALESCE(pg_catalog.jsonb_typeof(v_item->'escopo'), '') <> 'string'
              OR COALESCE(pg_catalog.jsonb_typeof(v_item->'valor'), '') <> 'number' THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe escopo e valor numérico de cada item.';
            END IF;
            v_escopo := pg_catalog.btrim(v_item->>'escopo');
            v_valor := (v_item->>'valor')::numeric;
            IF v_escopo !~ '[^[:space:]]' OR pg_catalog.char_length(v_escopo) > 4000
              OR v_valor < 0 OR v_valor > 9999999999.99 OR v_valor <> pg_catalog.round(v_valor, 2) THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Escopo ou valor do item inválido.';
            END IF;
            v_posicao := v_posicao + 1;

            INSERT INTO public.itens_orcamento AS i (orcamento_id, posicao, escopo, valor)
            VALUES (v_orcamento_id, v_posicao, v_escopo, v_valor)
            RETURNING pg_catalog.jsonb_build_object(
                'id', i.id, 'orcamento_id', i.orcamento_id, 'posicao', i.posicao,
                'escopo', i.escopo, 'valor', i.valor, 'criado_em', i.criado_em,
                'atualizado_em', i.atualizado_em
            ) INTO v_resultado;
        END LOOP;
        IF p_acao = 'adicionar_item' THEN
            UPDATE public.orcamentos AS o SET atualizado_em = pg_catalog.clock_timestamp()
            WHERE o.id = v_orcamento_id;
            RETURN v_resultado;
        END IF;
    END IF;

    -- Use o instante depois do bloqueio. O prazo pode vencer durante uma espera concorrente.
    IF p_acao = 'enviar_orcamento' THEN
        v_agora := pg_catalog.clock_timestamp();
        IF v_status_anterior <> 'rascunho' OR v_enviado_em IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM public.orcamentos AS o
            WHERE o.cotacao_id = v_cotacao_id AND (o.versao > v_versao OR o.status = 'aprovado')
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A versão não pode ser enviada.';
        END IF;
        IF v_validade IS NOT NULL AND v_validade < v_agora THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A validade deve abranger o instante do envio.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM public.itens_orcamento AS i WHERE i.orcamento_id = v_orcamento_id) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Inclua ao menos um item antes de enviar.';
        END IF;

        UPDATE public.orcamentos AS o SET status = 'substituido', atualizado_em = v_agora
        WHERE o.cotacao_id = v_cotacao_id AND o.status = 'enviado'
        RETURNING o.id INTO v_substituido_id;
        IF FOUND THEN
            PERFORM pavollos_admin.registrar_status(
                v_ator, 'enviado', 'substituido', p_orcamento => v_substituido_id,
                p_motivo => 'Nova versão enviada na mesma cotação.'
            );
        END IF;

        UPDATE public.orcamentos AS o SET status = 'enviado', enviado_em = v_agora, atualizado_em = v_agora
        WHERE o.id = v_orcamento_id;
        PERFORM pavollos_admin.registrar_status(v_ator, 'rascunho', 'enviado', p_orcamento => v_orcamento_id);
    ELSIF p_acao IN ('aprovar_orcamento', 'recusar_orcamento', 'expirar_orcamento') THEN
        v_agora := pg_catalog.clock_timestamp();
        IF v_status_anterior <> 'enviado' OR v_enviado_em IS NULL OR v_enviado_em > v_agora THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A decisão exige orçamento enviado e pendente.';
        END IF;

        IF p_acao = 'expirar_orcamento' THEN
            IF v_validade IS NULL OR v_validade >= v_agora THEN
                RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'O orçamento ainda não venceu.';
            END IF;
            v_novo_status := 'expirado';
            v_motivo := 'A validade do orçamento terminou.';
        ELSE
            IF v_validade IS NOT NULL AND v_validade < v_agora THEN
                RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A validade do orçamento terminou.';
            END IF;
            v_canal := p_dados->>'canal_aceite';
            v_evidencia := pg_catalog.btrim(p_dados->>'evidencia_aceite');
            IF v_canal IS NULL OR v_canal NOT IN ('presencial', 'whatsapp')
              OR COALESCE(pg_catalog.jsonb_typeof(p_dados->'evidencia_aceite'), '') <> 'string'
              OR v_evidencia !~ '[^[:space:]]' OR pg_catalog.char_length(v_evidencia) > 4000 THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Informe o canal e a evidência da decisão.';
            END IF;
            IF p_acao = 'aprovar_orcamento' THEN
                v_novo_status := 'aprovado';
            ELSE
                v_novo_status := 'recusado';
                v_motivo := pg_catalog.format('Recusa via %s: %s', v_canal, v_evidencia);
            END IF;
        END IF;

        IF v_novo_status = 'aprovado' THEN
            UPDATE public.orcamentos AS o
            SET status = 'aprovado', aprovado_em = v_agora, atualizado_em = v_agora,
                canal_aceite = v_canal::public.canal_atendimento,
                evidencia_aceite = v_evidencia, aceite_registrado_por = v_ator
            WHERE o.id = v_orcamento_id;
        ELSE
            UPDATE public.orcamentos AS o
            SET status = v_novo_status::public.status_orcamento, atualizado_em = v_agora
            WHERE o.id = v_orcamento_id;
        END IF;
        PERFORM pavollos_admin.registrar_status(
            v_ator, 'enviado', v_novo_status, p_orcamento => v_orcamento_id, p_motivo => v_motivo
        );
    END IF;

    SELECT pg_catalog.jsonb_build_object(
        'id', o.id, 'cotacao_id', o.cotacao_id, 'versao', o.versao, 'status', o.status,
        'validade_ate', o.validade_ate, 'enviado_em', o.enviado_em, 'aprovado_em', o.aprovado_em,
        'canal_aceite', o.canal_aceite, 'evidencia_aceite', o.evidencia_aceite,
        'aceite_registrado_por', o.aceite_registrado_por, 'criado_em', o.criado_em,
        'atualizado_em', o.atualizado_em, 'itens', resumo.itens, 'total', resumo.total
    ) INTO v_resultado
    FROM public.orcamentos AS o
    CROSS JOIN LATERAL (
        SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', i.id, 'orcamento_id', i.orcamento_id, 'posicao', i.posicao, 'escopo', i.escopo,
            'valor', i.valor, 'criado_em', i.criado_em, 'atualizado_em', i.atualizado_em
        ) ORDER BY i.posicao, i.id), '[]'::jsonb) AS itens,
        COALESCE(pg_catalog.sum(i.valor), 0::numeric) AS total
        FROM public.itens_orcamento AS i WHERE i.orcamento_id = o.id
    ) AS resumo
    WHERE o.id = v_orcamento_id;

    IF v_resultado IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Orçamento não encontrado.';
    END IF;
    RETURN v_resultado;
EXCEPTION
    WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Dados de cotação ou orçamento inválidos.';
END;
$orcamentos$;

CREATE FUNCTION public.mvp_orcamentos(p_acao text, p_dados jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $rpc$
    SELECT pavollos_admin.mvp_orcamentos(p_acao, p_dados);
$rpc$;

REVOKE ALL PRIVILEGES ON FUNCTION pavollos_admin.mvp_orcamentos(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.mvp_orcamentos(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pavollos_admin.mvp_orcamentos(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_orcamentos(text, jsonb) TO authenticated;

COMMIT;


-- 005_ordens_servico.sql (SHA-256 do arquivo de origem: 2c2201666b8aedc69051bcdc84d7a55d955e5b241974e0d85d5c3514ebff4345)
BEGIN;

SET LOCAL search_path = '';

DO $preflight$
BEGIN
    IF pg_catalog.to_regprocedure('pavollos_admin.exigir_perfil(text[])') IS NULL
        OR pg_catalog.to_regprocedure('pavollos_admin.registrar_status(uuid,text,text,uuid,uuid,uuid,text)') IS NULL
    THEN
        RAISE EXCEPTION 'Aplique a migração de clientes e atendimentos antes das ordens de serviço.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_index AS indice
        JOIN pg_catalog.pg_attribute AS atributo
            ON atributo.attrelid = indice.indrelid AND atributo.attnum = indice.indkey[0]
        JOIN pg_catalog.pg_class AS tabela ON tabela.oid = indice.indrelid
        WHERE indice.indrelid = pg_catalog.to_regclass('public.ordens_servico')
          AND tabela.relrowsecurity AND NOT pg_catalog.row_security_active(tabela.oid)
          AND atributo.attname = 'item_orcamento_id' AND atributo.attnotnull
          AND indice.indisunique AND indice.indisvalid AND indice.indimmediate
          AND indice.indnkeyatts = 1 AND indice.indexprs IS NULL AND indice.indpred IS NULL
    ) THEN
        RAISE EXCEPTION 'Confirme RLS e unicidade integral de item_orcamento_id em ordens_servico.';
    END IF;
END;
$preflight$;

-- Usa uma projeção operacional comum. O chamador privado filtra previamente a atribuição.
CREATE FUNCTION pavollos_admin.projetar_ordem(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $projecao$
    SELECT pg_catalog.jsonb_build_object(
        'id', ordem.id,
        'item_orcamento_id', ordem.item_orcamento_id,
        'atendimento_id', atendimento.id,
        'tecnico_id', ordem.tecnico_id,
        'criada_por', ordem.criada_por,
        'status', ordem.status,
        'escopo', item.escopo,
        'local_execucao', ordem.local_execucao,
        'observacao_execucao', ordem.observacao_execucao,
        'motivo_cancelamento', ordem.motivo_cancelamento,
        'cancelado_em', ordem.cancelado_em,
        'cancelado_por', ordem.cancelado_por,
        'criado_em', ordem.criado_em,
        'atualizado_em', ordem.atualizado_em,
        'cliente', pg_catalog.jsonb_build_object(
            'id', cliente.id, 'nome', cliente.nome, 'telefone', cliente.telefone
        )
    )
    FROM public.ordens_servico AS ordem
    JOIN public.itens_orcamento AS item ON item.id = ordem.item_orcamento_id
    JOIN public.orcamentos AS orcamento ON orcamento.id = item.orcamento_id
    JOIN public.cotacoes AS cotacao ON cotacao.id = orcamento.cotacao_id
    JOIN public.atendimentos AS atendimento ON atendimento.id = cotacao.atendimento_id
    JOIN public.clientes AS cliente ON cliente.id = atendimento.cliente_id
    WHERE ordem.id = p_id;
$projecao$;

CREATE FUNCTION pavollos_admin.mvp_ordens(p_acao text, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $ordens$
DECLARE
    v_ator uuid;
    v_papel public.papel_usuario;
    v_ordem public.ordens_servico%ROWTYPE;
    v_id uuid;
    v_tecnico_id uuid;
    v_atendimento_id uuid;
    v_atendimento_status public.status_atendimento;
    v_novo_status public.status_ordem_servico;
    v_texto text;
    v_limite integer;
    v_deslocamento integer;
    v_resultado jsonb;
BEGIN
    CASE p_acao
        WHEN 'criar_ordem' THEN
            v_ator := pavollos_admin.exigir_perfil(ARRAY['proprietario', 'auxiliar']);
        WHEN 'atribuir_ordem', 'cancelar_ordem' THEN
            v_ator := pavollos_admin.exigir_perfil(ARRAY['proprietario']);
        WHEN 'iniciar_ordem', 'concluir_ordem', 'atualizar_ordem' THEN
            v_ator := pavollos_admin.exigir_perfil(ARRAY['tecnico']);
        WHEN 'listar_ordens', 'obter_ordem', 'historico_ordem' THEN
            v_ator := pavollos_admin.exigir_perfil(ARRAY['proprietario', 'auxiliar', 'tecnico']);
        ELSE
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Operação de ordem de serviço inválida.';
    END CASE;

    IF p_dados IS NULL OR pg_catalog.jsonb_typeof(p_dados) <> 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Os dados da ordem devem ser um objeto.';
    END IF;

    SELECT usuario.papel INTO STRICT v_papel FROM public.usuarios AS usuario WHERE usuario.id = v_ator;

    IF p_acao IN ('listar_ordens', 'historico_ordem') THEN
        BEGIN
            v_limite := COALESCE((p_dados->>'limite')::integer, 20);
            v_deslocamento := COALESCE((p_dados->>'deslocamento')::integer, 0);
        EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Paginação inválida.';
        END;
        IF v_limite NOT BETWEEN 1 AND 100 OR v_deslocamento NOT BETWEEN 0 AND 10000 THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Paginação inválida.';
        END IF;
    END IF;

    IF p_acao = 'listar_ordens' THEN
        SELECT COALESCE(pg_catalog.jsonb_agg(
            pavollos_admin.projetar_ordem(pagina.id) ORDER BY pagina.criado_em DESC, pagina.id DESC
        ), '[]'::jsonb)
        INTO v_resultado
        FROM (
            SELECT ordem.id, ordem.criado_em
            FROM public.ordens_servico AS ordem
            WHERE v_papel <> 'tecnico' OR ordem.tecnico_id = v_ator
            ORDER BY ordem.criado_em DESC, ordem.id DESC
            LIMIT v_limite OFFSET v_deslocamento
        ) AS pagina;
        RETURN v_resultado;
    END IF;

    BEGIN
        v_id := CASE p_acao
            WHEN 'criar_ordem' THEN (p_dados->>'item_orcamento_id')::uuid
            ELSE (p_dados->>'id')::uuid
        END;
        IF p_acao = 'atribuir_ordem' THEN
            v_tecnico_id := (p_dados->>'tecnico_id')::uuid;
        END IF;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Identificador inválido.';
    END;
    IF v_id IS NULL OR (p_acao = 'atribuir_ordem' AND v_tecnico_id IS NULL) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Identificador obrigatório.';
    END IF;

    IF p_acao IN ('obter_ordem', 'historico_ordem') THEN
        -- A leitura e a checagem de atribuição usam o mesmo snapshot.
        SELECT CASE p_acao WHEN 'obter_ordem' THEN pavollos_admin.projetar_ordem(ordem.id)
            ELSE (
                SELECT COALESCE(pg_catalog.jsonb_agg(
                    pg_catalog.jsonb_build_object(
                        'id', evento.id, 'ordem_servico_id', evento.ordem_servico_id,
                        'ocorrido_em', evento.ocorrido_em, 'tipo_evento', evento.tipo_evento,
                        'status_anterior', evento.status_anterior, 'status_novo', evento.status_novo,
                        'ator_id', evento.ator_id, 'tecnico_anterior_id', evento.tecnico_anterior_id,
                        'tecnico_novo_id', evento.tecnico_novo_id, 'motivo', evento.motivo
                    ) ORDER BY evento.ocorrido_em, evento.id
                ), '[]'::jsonb)
                FROM (
                    SELECT status.*
                    FROM public.historico_status AS status
                    WHERE status.ordem_servico_id = ordem.id
                    ORDER BY status.ocorrido_em, status.id
                    LIMIT v_limite OFFSET v_deslocamento
                ) AS evento
            )
        END INTO v_resultado
        FROM public.ordens_servico AS ordem
        WHERE ordem.id = v_id AND (v_papel <> 'tecnico' OR ordem.tecnico_id = v_ator);

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Ordem de serviço não encontrada.';
        END IF;
        RETURN v_resultado;
    END IF;

    IF p_acao = 'criar_ordem' THEN
        SELECT cotacao.atendimento_id INTO v_atendimento_id
        FROM public.itens_orcamento AS item
        JOIN public.orcamentos AS orcamento ON orcamento.id = item.orcamento_id
        JOIN public.cotacoes AS cotacao ON cotacao.id = orcamento.cotacao_id
        WHERE item.id = v_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Item do orçamento não encontrado.';
        END IF;
    ELSE
        SELECT cotacao.atendimento_id INTO v_atendimento_id
        FROM public.ordens_servico AS ordem
        JOIN public.itens_orcamento AS item ON item.id = ordem.item_orcamento_id
        JOIN public.orcamentos AS orcamento ON orcamento.id = item.orcamento_id
        JOIN public.cotacoes AS cotacao ON cotacao.id = orcamento.cotacao_id
        WHERE ordem.id = v_id AND (v_papel <> 'tecnico' OR ordem.tecnico_id = v_ator);

        IF NOT FOUND THEN
            IF v_papel = 'tecnico' THEN
                RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ordem indisponível para este técnico.';
            END IF;
            RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Ordem de serviço não encontrada.';
        END IF;
    END IF;

    -- Fechamento, orçamento e OS adquirem primeiro o bloqueio do atendimento.
    SELECT atendimento.status INTO v_atendimento_status
    FROM public.atendimentos AS atendimento WHERE atendimento.id = v_atendimento_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Atendimento não encontrado.';
    END IF;

    IF p_acao = 'criar_ordem' THEN
        SELECT ordem.* INTO v_ordem
        FROM public.ordens_servico AS ordem WHERE ordem.item_orcamento_id = v_id;
        IF FOUND THEN
            RETURN pavollos_admin.projetar_ordem(v_ordem.id);
        END IF;

        IF v_atendimento_status <> 'aberto' OR NOT EXISTS (
            SELECT 1 FROM public.itens_orcamento AS item
            JOIN public.orcamentos AS orcamento ON orcamento.id = item.orcamento_id
            JOIN public.cotacoes AS cotacao ON cotacao.id = orcamento.cotacao_id
            WHERE item.id = v_id AND cotacao.atendimento_id = v_atendimento_id
              AND orcamento.status = 'aprovado'
              AND orcamento.enviado_em IS NOT NULL AND orcamento.aprovado_em >= orcamento.enviado_em
              AND (orcamento.validade_ate IS NULL OR orcamento.aprovado_em <= orcamento.validade_ate)
              AND orcamento.canal_aceite IS NOT NULL AND orcamento.aceite_registrado_por IS NOT NULL
              AND orcamento.evidencia_aceite ~ '[^[:space:]]'
        ) THEN
            RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'O item deve pertencer a um orçamento aprovado e a um atendimento aberto.';
        END IF;

        v_texto := NULLIF(pg_catalog.btrim(p_dados->>'local_execucao'), '');
        IF pg_catalog.jsonb_typeof(p_dados->'local_execucao') NOT IN ('string', 'null')
            OR pg_catalog.length(v_texto) > 500 THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Local de execução inválido.';
        END IF;

        INSERT INTO public.ordens_servico (item_orcamento_id, criada_por, status, local_execucao)
        VALUES (v_id, v_ator, 'aguardando_atribuicao', v_texto)
        ON CONFLICT (item_orcamento_id) DO NOTHING
        RETURNING * INTO v_ordem;
        IF NOT FOUND THEN
            SELECT ordem.* INTO STRICT v_ordem
            FROM public.ordens_servico AS ordem WHERE ordem.item_orcamento_id = v_id;
            RETURN pavollos_admin.projetar_ordem(v_ordem.id);
        END IF;

        PERFORM pavollos_admin.registrar_status(v_ator, NULL, v_ordem.status::text, p_ordem => v_ordem.id);
        RETURN pavollos_admin.projetar_ordem(v_ordem.id);
    END IF;

    -- Revalida a atribuição depois de obter o bloqueio que serializa as mutações.
    SELECT ordem.* INTO v_ordem
    FROM public.ordens_servico AS ordem
    JOIN public.itens_orcamento AS item ON item.id = ordem.item_orcamento_id
    JOIN public.orcamentos AS orcamento ON orcamento.id = item.orcamento_id
    JOIN public.cotacoes AS cotacao ON cotacao.id = orcamento.cotacao_id
    WHERE ordem.id = v_id AND cotacao.atendimento_id = v_atendimento_id
      AND (v_papel <> 'tecnico' OR ordem.tecnico_id = v_ator)
    FOR UPDATE OF ordem;

    IF NOT FOUND THEN
        IF v_papel = 'tecnico' THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Ordem indisponível para este técnico.';
        END IF;
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Ordem de serviço não encontrada.';
    END IF;
    IF v_atendimento_status <> 'aberto' THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'O atendimento não está aberto.';
    END IF;

    v_novo_status := v_ordem.status;
    CASE p_acao
        WHEN 'atribuir_ordem' THEN
            IF v_ordem.status NOT IN ('aguardando_atribuicao', 'atribuida', 'em_execucao') THEN
                RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A ordem não pode ser atribuída neste estado.';
            END IF;
            PERFORM 1 FROM public.usuarios AS usuario
            WHERE usuario.id = v_tecnico_id AND usuario.ativo AND usuario.papel = 'tecnico'
            FOR SHARE;
            IF NOT FOUND THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Selecione um técnico ativo.';
            END IF;
            IF v_ordem.tecnico_id IS DISTINCT FROM v_tecnico_id THEN
                IF v_ordem.status = 'aguardando_atribuicao' THEN v_novo_status := 'atribuida'; END IF;
                UPDATE public.ordens_servico SET tecnico_id = v_tecnico_id, status = v_novo_status,
                    atualizado_em = pg_catalog.clock_timestamp() WHERE id = v_ordem.id;
                INSERT INTO public.historico_status (
                    ordem_servico_id, ator_id, tipo_evento, tecnico_anterior_id, tecnico_novo_id, ocorrido_em
                ) VALUES (v_ordem.id, v_ator, 'atribuicao', v_ordem.tecnico_id, v_tecnico_id, pg_catalog.clock_timestamp());
            END IF;

        WHEN 'iniciar_ordem', 'concluir_ordem' THEN
            IF p_acao = 'iniciar_ordem' AND v_ordem.status = 'atribuida' THEN
                v_novo_status := 'em_execucao';
            ELSIF p_acao = 'concluir_ordem' AND v_ordem.status = 'em_execucao' THEN
                v_novo_status := 'concluida';
            ELSE
                RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Transição de execução não permitida.';
            END IF;
            UPDATE public.ordens_servico SET status = v_novo_status, atualizado_em = pg_catalog.clock_timestamp()
            WHERE id = v_ordem.id;

        WHEN 'atualizar_ordem' THEN
            IF v_ordem.status NOT IN ('atribuida', 'em_execucao') THEN
                RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A execução já está encerrada.';
            END IF;
            v_texto := p_dados->>'observacao_execucao';
            IF pg_catalog.jsonb_typeof(p_dados->'observacao_execucao') <> 'string'
                OR v_texto IS NULL OR v_texto !~ '[^[:space:]]' OR pg_catalog.length(v_texto) > 2000 THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Observação de execução inválida.';
            END IF;
            UPDATE public.ordens_servico SET observacao_execucao = pg_catalog.btrim(v_texto),
                atualizado_em = pg_catalog.clock_timestamp() WHERE id = v_ordem.id;

        WHEN 'cancelar_ordem' THEN
            IF v_ordem.status NOT IN ('aguardando_atribuicao', 'atribuida', 'em_execucao') THEN
                RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'A ordem não pode ser cancelada neste estado.';
            END IF;
            v_texto := p_dados->>'motivo';
            IF pg_catalog.jsonb_typeof(p_dados->'motivo') <> 'string'
                OR v_texto IS NULL OR v_texto !~ '[^[:space:]]' OR pg_catalog.length(v_texto) > 1000 THEN
                RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Motivo de cancelamento inválido.';
            END IF;
            v_texto := pg_catalog.btrim(v_texto);
            v_novo_status := 'cancelada';
            UPDATE public.ordens_servico SET status = v_novo_status, motivo_cancelamento = v_texto,
                cancelado_por = v_ator, cancelado_em = pg_catalog.clock_timestamp(), atualizado_em = pg_catalog.clock_timestamp()
            WHERE id = v_ordem.id;
    END CASE;

    IF v_novo_status IS DISTINCT FROM v_ordem.status THEN
        PERFORM pavollos_admin.registrar_status(
            v_ator, v_ordem.status::text, v_novo_status::text, p_ordem => v_ordem.id,
            p_motivo => CASE WHEN p_acao = 'cancelar_ordem' THEN v_texto END
        );
    END IF;
    RETURN pavollos_admin.projetar_ordem(v_ordem.id);
END;
$ordens$;

CREATE FUNCTION public.mvp_ordens(p_acao text, p_dados jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $rpc$
    SELECT pavollos_admin.mvp_ordens(p_acao, p_dados);
$rpc$;

REVOKE ALL PRIVILEGES ON FUNCTION pavollos_admin.projetar_ordem(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION pavollos_admin.mvp_ordens(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.mvp_ordens(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION pavollos_admin.mvp_ordens(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_ordens(text, jsonb) TO authenticated;

COMMIT;
