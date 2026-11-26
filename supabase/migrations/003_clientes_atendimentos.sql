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
