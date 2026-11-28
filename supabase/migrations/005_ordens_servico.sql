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
