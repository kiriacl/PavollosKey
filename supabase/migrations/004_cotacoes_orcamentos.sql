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
