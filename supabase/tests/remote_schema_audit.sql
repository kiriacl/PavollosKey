-- PávollosKeys | auditoria de compatibilidade das migrações 002 a 005
-- Execute esta única consulta no SQL Editor com o papel previsto para a implantação.
-- Somente catálogos. Definições potencialmente sensíveis aparecem como impressões digitais.
-- A referência é a reconstrução histórica local. Diferenças de versão ou de search_path
-- podem mudar impressões digitais. COINCIDE indica concordância com a referência local.
-- AUSENTE, PARCIAL e DIVERGENTE descrevem objetos, sem inferir histórico de execução.
-- Confira o histórico de migrações e os esquemas expostos pela Data API separadamente.
-- Códigos de restrição: p=PK, f=FK, u=unicidade, c=checagem, n=obrigatória.
-- Códigos de FK: a=sem ação, r=restrição, c=cascata, n=nulo, d=padrão.
-- Códigos de RLS: r=leitura, a=inclusão, w=edição, d=exclusão, *=todos.
WITH
alvos(esquema, tabela) AS (
    VALUES ('public','usuarios'), ('public','clientes'), ('public','atendimentos'),
           ('public','cotacoes'), ('public','orcamentos'), ('public','itens_orcamento'),
           ('public','ordens_servico'), ('public','historico_status'),
           ('auth','users'), ('pavollos_admin','usuarios_auditoria')
),
tipos_esperados(nome) AS (
    VALUES ('papel_usuario'), ('canal_atendimento'), ('tipo_cotacao'),
           ('status_atendimento'), ('status_orcamento'), ('status_ordem_servico'),
           ('tipo_evento_historico')
),
nomes_tipos AS (
    SELECT t.oid, t.typname, n.nspname, t.typcategory,
           CASE WHEN n.nspname = 'pg_catalog' THEN pg_catalog.format_type(t.oid, NULL)
                WHEN t.typcategory = 'A' AND t.typelem <> 0
                THEN pg_catalog.format_type(t.oid, NULL)
                ELSE n.nspname || '.' || t.typname END AS nome
    FROM pg_catalog.pg_type AS t
    JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
),
tabelas AS (
    SELECT a.esquema, a.tabela, a.esquema || '.' || a.tabela AS objeto,
           c.oid, c.relkind, c.relowner, c.relrowsecurity, c.relforcerowsecurity, c.relacl,
           pg_catalog.pg_get_userbyid(c.relowner) AS dono
    FROM alvos AS a
    JOIN pg_catalog.pg_namespace AS n ON n.nspname = a.esquema
    JOIN pg_catalog.pg_class AS c ON c.relnamespace = n.oid AND c.relname = a.tabela
),
colunas AS (
    SELECT t.objeto, t.oid, a.attnum, a.attname AS nome, a.attacl,
           jsonb_build_object(
              'tipo', CASE WHEN nt.nspname = 'pg_catalog' THEN pg_catalog.format_type(a.atttypid, a.atttypmod)
                           ELSE nt.nome END,
              'obrigatoria', a.attnotnull, 'identidade', nullif(a.attidentity, ''),
              'gerada', nullif(a.attgenerated, ''),
              'padrao_md5', CASE WHEN t.esquema <> 'auth' THEN
                  md5(pg_catalog.pg_get_expr(d.adbin, d.adrelid, false)) END
           ) AS detalhe
    FROM tabelas AS t
    JOIN pg_catalog.pg_attribute AS a ON a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped
    JOIN nomes_tipos AS nt ON nt.oid = a.atttypid
    LEFT JOIN pg_catalog.pg_attrdef AS d ON d.adrelid = t.oid AND d.adnum = a.attnum
    WHERE t.esquema <> 'auth' OR a.attname IN ('id','invited_at','email_confirmed_at','deleted_at')
),
restricoes AS (
    SELECT t.objeto, t.oid, c.conname AS nome, c.contype,
           jsonb_build_object(
              'tipo', c.contype,
              'colunas', ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY AS k(num,pos)
                    JOIN pg_catalog.pg_attribute AS a ON a.attrelid = c.conrelid AND a.attnum = k.num ORDER BY k.pos),
              'referencia', nr.nspname || '.' || cr.relname,
              'colunas_referidas', ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY AS k(num,pos)
                    JOIN pg_catalog.pg_attribute AS a ON a.attrelid = c.confrelid AND a.attnum = k.num ORDER BY k.pos),
              'acao_na_exclusao', nullif(c.confdeltype, ' '), 'acao_na_atualizacao', nullif(c.confupdtype, ' '),
              'correspondencia_fk', nullif(c.confmatchtype, ' '),
              'validada', c.convalidated, 'adiavel', c.condeferrable, 'adiada', c.condeferred,
              'vigente', coalesce((to_jsonb(c)->>'conenforced')::boolean, true),
              'expressao_md5', md5(pg_catalog.pg_get_expr(c.conbin, c.conrelid, false))
           ) AS detalhe
    FROM tabelas AS t
    JOIN pg_catalog.pg_constraint AS c ON c.conrelid = t.oid
    LEFT JOIN pg_catalog.pg_class AS cr ON cr.oid = c.confrelid
    LEFT JOIN pg_catalog.pg_namespace AS nr ON nr.oid = cr.relnamespace
    WHERE t.esquema <> 'auth' OR (c.contype = 'p' AND cardinality(c.conkey) = 1)
),
indices AS (
    SELECT t.objeto, t.oid, ci.relname AS nome,
           jsonb_build_object(
              'metodo', am.amname,
              'colunas', ARRAY(SELECT coalesce(a.attname::text, '<expressao>')
                  FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(num,pos)
                  LEFT JOIN pg_catalog.pg_attribute AS a ON a.attrelid = t.oid AND a.attnum = k.num ORDER BY k.pos),
              'numero_chaves', i.indnkeyatts, 'unico', i.indisunique, 'primario', i.indisprimary,
              'valido', i.indisvalid, 'pronto', i.indisready, 'ativo', i.indislive, 'imediato', i.indimmediate,
              'nulos_nao_distintos', i.indnullsnotdistinct, 'ordenacao_bits', i.indoption::smallint[],
              'classes', ARRAY(SELECT n.nspname || '.' || op.opcname
                  FROM unnest(i.indclass::oid[]) WITH ORDINALITY AS k(num,pos)
                  JOIN pg_catalog.pg_opclass AS op ON op.oid = k.num
                  JOIN pg_catalog.pg_namespace AS n ON n.oid = op.opcnamespace ORDER BY k.pos),
              'predicado_md5', md5(pg_catalog.pg_get_expr(i.indpred, t.oid, false)),
              'expressao_md5', md5(pg_catalog.pg_get_expr(i.indexprs, t.oid, false))
           ) AS detalhe
    FROM tabelas AS t
    JOIN pg_catalog.pg_index AS i ON i.indrelid = t.oid
    JOIN pg_catalog.pg_class AS ci ON ci.oid = i.indexrelid
    JOIN pg_catalog.pg_am AS am ON am.oid = ci.relam
    WHERE t.esquema <> 'auth'
),
enums AS (
    SELECT n.nspname || '.' || t.typname AS objeto,
           jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) AS valores
    FROM pg_catalog.pg_type AS t
    JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace AND n.nspname = 'public'
    JOIN tipos_esperados AS x ON x.nome = t.typname
    JOIN pg_catalog.pg_enum AS e ON e.enumtypid = t.oid
    GROUP BY n.nspname, t.typname
),
assinaturas_tabelas AS (
    SELECT t.objeto,
           md5(coalesce((SELECT jsonb_agg(jsonb_build_object('nome', c.nome, 'metadados', c.detalhe)
                    ORDER BY c.attnum)::text FROM colunas AS c WHERE c.oid = t.oid), '[]')) AS colunas_md5,
           md5(coalesce((SELECT jsonb_agg(r.detalhe ORDER BY r.detalhe::text)::text
                    FROM restricoes AS r WHERE r.oid = t.oid AND r.contype <> 'n'), '[]')) AS restricoes_md5,
           md5(coalesce((SELECT jsonb_agg(i.detalhe ORDER BY i.detalhe::text)::text
                    FROM indices AS i WHERE i.oid = t.oid), '[]')) AS indices_md5
    FROM tabelas AS t WHERE t.esquema <> 'auth'
),
politicas AS (
    SELECT t.objeto, t.oid, p.polname AS nome,
           jsonb_build_object(
              'comando_codigo', p.polcmd, 'permissiva', p.polpermissive,
              'papeis', ARRAY(SELECT CASE WHEN r.papel = 0 THEN 'PUBLIC'::name
                   ELSE pg_catalog.pg_get_userbyid(r.papel) END FROM unnest(p.polroles) AS r(papel) ORDER BY 1),
              'filtro_md5', md5(pg_catalog.pg_get_expr(p.polqual, p.polrelid, false)),
              'verificacao_md5', md5(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid, false))
           ) AS detalhe
    FROM tabelas AS t JOIN pg_catalog.pg_policy AS p ON p.polrelid = t.oid
),
gatilhos AS (
    SELECT t.objeto, t.oid, g.tgname AS nome, g.tgisinternal, g.tgenabled,
           jsonb_build_object(
              'habilitacao_codigo', g.tgenabled, 'interno', g.tgisinternal, 'evento_bits', g.tgtype,
              'rotina', nf.nspname || '.' || p.proname,
              'definicao_md5', md5(pg_catalog.pg_get_triggerdef(g.oid, false))
           ) AS detalhe
    FROM tabelas AS t
    JOIN pg_catalog.pg_trigger AS g ON g.tgrelid = t.oid
    JOIN pg_catalog.pg_proc AS p ON p.oid = g.tgfoid
    JOIN pg_catalog.pg_namespace AS nf ON nf.oid = p.pronamespace
),
rotinas AS (
    SELECT p.oid, p.proowner AS dono_oid, p.proacl, p.pronamespace, p.proname,
           n.nspname AS esquema, n.nspname || '.' || p.proname AS simbolo,
           n.nspname || '.' || p.proname || '(' || coalesce(args.tipos, '') || ')' AS objeto,
           jsonb_build_object(
              'categoria', p.prokind, 'linguagem', l.lanname, 'retorno', nt.nome,
              'retorna_conjunto', p.proretset, 'argumentos_com_padrao', p.pronargdefaults,
              'argumentos_nomeados', p.proargnames,
              'definidor', p.prosecdef, 'volatilidade_codigo', p.provolatile,
              'estrita', p.proisstrict, 'paralelismo_codigo', p.proparallel, 'sem_vazamento', p.proleakproof,
              'search_path_isolado', EXISTS (SELECT 1 FROM unnest(p.proconfig) AS cfg(valor)
                      WHERE cfg.valor IN ('search_path=""', 'search_path=')),
              'ajustes_md5', md5(array_to_string(p.proconfig, chr(10))),
              'corpo_md5', md5(replace(p.prosrc, chr(13), '')),
              'padroes_argumentos_md5', md5(pg_catalog.pg_get_expr(p.proargdefaults, 0, false))
           ) AS detalhe
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    JOIN pg_catalog.pg_language AS l ON l.oid = p.prolang
    JOIN nomes_tipos AS nt ON nt.oid = p.prorettype
    CROSS JOIN LATERAL (
        SELECT string_agg(a.nome, ',' ORDER BY k.pos) AS tipos
        FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS k(id,pos)
        JOIN nomes_tipos AS a ON a.oid = k.id
    ) AS args
    WHERE n.nspname IN ('public','pavollos_admin') OR (n.nspname = 'auth' AND p.proname = 'uid')
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_trigger AS g
                  JOIN tabelas AS t ON t.oid = g.tgrelid WHERE g.tgfoid = p.oid)
),
objetos_catalogo AS (
    SELECT 'esquema' AS classe, n.nspname::text AS objeto, NULL::text AS assinatura
    FROM pg_catalog.pg_namespace AS n WHERE n.nspname = 'pavollos_admin'
    UNION ALL
    SELECT 'tabela', t.objeto, md5(jsonb_build_array(t.relkind, t.relrowsecurity, t.relforcerowsecurity,
           s.colunas_md5, s.restricoes_md5, s.indices_md5)::text)
    FROM tabelas AS t JOIN assinaturas_tabelas AS s USING (objeto)
    UNION ALL
    SELECT 'politica', p.objeto || '.' || p.nome, md5(p.detalhe::text) FROM politicas AS p
    UNION ALL
    SELECT 'rotina', r.objeto, md5(r.detalhe::text) FROM rotinas AS r
),
base_referencia(objeto, colunas_md5, restricoes_md5, indices_md5) AS (
    VALUES
    ('public.atendimentos', '46c5213f90c97df3e923e173b0d02134', '79f09725bf8429578e0fbe633a275992', '66d6ac8184e531898f28f4b94565c351'),
    ('public.clientes', '314f6fb52edf0a13f247498c67196e6b', '87d2cb7e18ae48fba0a7635e1ccb045e', 'c4c6eb91bf6f29972abf48993442c8f1'),
    ('public.cotacoes', '12d4b2792f1a8c475a70d29610de5ce2', 'd1c56c951cdbbd4df1a7a57bf18dbe15', '1ee79f8c62c8f8d052261b16a4d21d5f'),
    ('public.historico_status', '9761624bb0e7ab4858233bfb5a48403d', 'ce8a93a28597312bde6c651ca47f910e', '3b77f615703b3fbc80edf616bbf3bbc8'),
    ('public.itens_orcamento', '974ddb16b47614d64ab838ac4c90f071', 'ff6861b707c474e8e4b9f06b07cabbec', 'e9cc13db8a99d2d349f7778058c749d9'),
    ('public.orcamentos', '53cfa2c6f7b1744f3ba4140d12d6d914', 'addae75fd9d65e5d5fb80ada8342aee2', 'd68c63e32e16f81d9bdd459838f0c4ca'),
    ('public.ordens_servico', '7530d1b8f70a0d80e7f01080ff61974a', '6f9e32469c0b2aabb8831e03b365e916', '8dee22d69cb271735bfbbfaa7800d9ab'),
    ('public.usuarios', '5202d716f49da18e484c25db5ed2cd5c', 'c1ada4d7e07aecd574ce967569df664b', 'c4c6eb91bf6f29972abf48993442c8f1')
),
enums_referencia(objeto, valores_texto) AS (
    VALUES
    ('public.canal_atendimento', '["presencial","whatsapp"]'),
    ('public.papel_usuario', '["proprietario","auxiliar","tecnico"]'),
    ('public.status_atendimento', '["aberto","encerrado","cancelado"]'),
    ('public.status_orcamento', '["rascunho","enviado","aprovado","recusado","expirado","substituido","cancelado"]'),
    ('public.status_ordem_servico', '["aguardando_atribuicao","atribuida","em_execucao","concluida","cancelada"]'),
    ('public.tipo_cotacao', '["inicial","complementar"]'),
    ('public.tipo_evento_historico', '["status","atribuicao"]')
),
objetos_referencia(versao, classe, objeto, assinatura) AS (
    VALUES
    ('002', 'esquema', 'pavollos_admin', NULL),
    ('002', 'politica', 'public.usuarios.usuarios_ler_proprio_ativo', '86acaebc5ab4d04ba23e550168ee0337'),
    ('002', 'rotina', 'pavollos_admin.vincular_colaborador(uuid,text,public.papel_usuario)', '5c9386201486efa0f4174e402d758a05'),
    ('002', 'rotina', 'public.vincular_colaborador(uuid,text,public.papel_usuario)', '55a2bc751f9b1ba5cf17a1e2d3ad271e'),
    ('002', 'tabela', 'pavollos_admin.usuarios_auditoria', 'b7e7006b5e57dd0240b9f726a393475e'),
    ('003', 'rotina', 'pavollos_admin.exigir_perfil(text[])', '5509649dcedef2af8bb451b5b2063bc5'),
    ('003', 'rotina', 'pavollos_admin.mvp_operacoes(text,jsonb)', 'fdb3dcdd4f0fb44b8b6097c33227cd01'),
    ('003', 'rotina', 'pavollos_admin.registrar_status(uuid,text,text,uuid,uuid,uuid,text)', '13cab1fa914523af7e50342c6ae6dfcd'),
    ('003', 'rotina', 'public.mvp_operacoes(text,jsonb)', '966efac3663f81fb78d0fdac6f52f8bb'),
    ('004', 'rotina', 'pavollos_admin.mvp_orcamentos(text,jsonb)', '8a90fec980b8873370637c8991600d6b'),
    ('004', 'rotina', 'public.mvp_orcamentos(text,jsonb)', '8c5b50228ae98d1466cb35908fc4887c'),
    ('005', 'rotina', 'pavollos_admin.mvp_ordens(text,jsonb)', '82acd8dee169970243eeed80e4dd10d3'),
    ('005', 'rotina', 'pavollos_admin.projetar_ordem(uuid)', 'aa7f221eb86917477fb55aff145e2192'),
    ('005', 'rotina', 'public.mvp_ordens(text,jsonb)', 'd7ea0fc99206779b26de047a237c3141')
),
papeis_app AS (
    SELECT x.nome, p.oid, p.rolsuper, p.rolbypassrls
    FROM (VALUES ('anon'), ('authenticated')) AS x(nome)
    LEFT JOIN pg_catalog.pg_roles AS p ON p.rolname = x.nome
),
alvos_acl(classe, objeto, oid, dono_oid, acl, tipo_acl, attnum) AS (
    SELECT 'esquema', n.nspname::text, n.oid, n.nspowner, n.nspacl, 'n'::"char", NULL::smallint
    FROM pg_catalog.pg_namespace AS n WHERE n.nspname IN ('public','auth','pavollos_admin')
    UNION ALL
    SELECT 'tabela', t.objeto, t.oid, t.relowner, t.relacl, 'r'::"char", NULL::smallint
    FROM tabelas AS t WHERE t.esquema <> 'auth' AND t.relkind IN ('r','p','v','m','f')
    UNION ALL
    SELECT 'coluna', c.objeto || '.' || c.nome, c.oid, t.relowner, c.attacl, 'c'::"char", c.attnum
    FROM colunas AS c JOIN tabelas AS t ON t.oid = c.oid
    WHERE t.esquema <> 'auth' AND t.relkind IN ('r','p','v','m','f')
    UNION ALL
    SELECT 'rotina', r.objeto, r.oid, r.dono_oid, r.proacl, 'f'::"char", NULL::smallint
    FROM rotinas AS r
),
acl_catalogo AS (
    SELECT o.classe, o.objeto, o.oid, o.attnum, a.grantee AS destinatario_oid,
           CASE WHEN a.grantee = 0 THEN 'PUBLIC'::name ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS destinatario,
           pg_catalog.pg_get_userbyid(a.grantor) AS concedente,
           a.privilege_type AS privilegio, a.is_grantable AS delegavel,
           CASE WHEN o.acl IS NULL THEN 'padrao' ELSE 'registrada' END AS origem
    FROM alvos_acl AS o
    CROSS JOIN LATERAL pg_catalog.aclexplode(coalesce(o.acl, pg_catalog.acldefault(o.tipo_acl, o.dono_oid))) AS a
),
acl_efetiva AS (
    SELECT o.classe, o.objeto, o.oid, o.attnum, p.nome AS papel, v.privilegio,
           p.rolsuper OR pg_catalog.pg_has_role(p.oid, o.dono_oid, 'USAGE')
             OR EXISTS (
                 SELECT 1 FROM acl_catalogo AS a
                 WHERE a.oid = o.oid AND a.privilegio = v.privilegio AND a.delegavel
                   AND (a.classe = o.classe AND a.attnum IS NOT DISTINCT FROM o.attnum
                        OR o.classe = 'coluna' AND a.classe = 'tabela')
                   AND CASE WHEN a.destinatario_oid = 0 THEN true
                            ELSE pg_catalog.pg_has_role(p.oid, a.destinatario_oid, 'USAGE') END
             ) AS delegavel
    FROM alvos_acl AS o
    CROSS JOIN papeis_app AS p
    CROSS JOIN LATERAL (
        SELECT DISTINCT a.privilege_type AS privilegio
        FROM pg_catalog.aclexplode(pg_catalog.acldefault(
             CASE WHEN o.classe = 'coluna' THEN 'r'::"char" ELSE o.tipo_acl END, o.dono_oid)) AS a
        WHERE o.classe <> 'coluna' OR a.privilege_type IN ('SELECT','REFERENCES')
              OR left(a.privilege_type, 3) IN ('INS','UPD')
    ) AS v
    WHERE p.oid IS NOT NULL AND CASE o.classe
        WHEN 'esquema' THEN pg_catalog.has_schema_privilege(p.oid, o.oid, v.privilegio)
        WHEN 'tabela' THEN pg_catalog.has_table_privilege(p.oid, o.oid, v.privilegio)
        WHEN 'coluna' THEN pg_catalog.has_column_privilege(p.oid, o.oid, o.attnum, v.privilegio)
        WHEN 'rotina' THEN pg_catalog.has_function_privilege(p.oid, o.oid, v.privilegio)
    END
),
privilegios AS (
    SELECT o.classe, o.objeto, o.oid, o.attnum, pg_catalog.pg_get_userbyid(o.dono_oid) AS dono,
           coalesce((SELECT jsonb_agg(to_jsonb(a) - ARRAY['classe','objeto','oid','attnum','destinatario_oid']
                     ORDER BY a.destinatario, a.privilegio, a.concedente)
                     FROM acl_catalogo AS a WHERE a.classe = o.classe AND a.objeto = o.objeto), '[]') AS acl,
           coalesce((SELECT jsonb_agg(to_jsonb(a) - ARRAY['classe','objeto','oid','attnum']
                     ORDER BY a.papel, a.privilegio)
                     FROM acl_efetiva AS a WHERE a.classe = o.classe AND a.objeto = o.objeto), '[]') AS efetivos
    FROM alvos_acl AS o
),
estado_objetos AS (
    SELECT r.versao, r.classe, r.objeto, r.assinatura AS esperada, c.assinatura AS observada,
           CASE WHEN c.objeto IS NULL THEN 'AUSENTE'
                WHEN r.assinatura IS DISTINCT FROM c.assinatura THEN 'DIVERGENTE'
                ELSE 'COINCIDE' END AS estado
    FROM objetos_referencia AS r
    LEFT JOIN objetos_catalogo AS c ON c.classe = r.classe AND c.objeto = r.objeto
),
sobrecargas AS (
    SELECT DISTINCT x.versao, r.objeto
    FROM rotinas AS r JOIN objetos_referencia AS x
      ON x.classe = 'rotina' AND split_part(x.objeto, '(', 1) = r.simbolo
    WHERE NOT EXISTS (SELECT 1 FROM objetos_referencia AS y WHERE y.classe = 'rotina' AND y.objeto = r.objeto)
),
estado_migracoes AS (
    SELECT e.versao, count(*) AS esperados, count(*) FILTER (WHERE e.estado <> 'AUSENTE') AS presentes,
           count(*) FILTER (WHERE e.estado = 'DIVERGENTE') AS divergentes,
           (SELECT count(*) FROM sobrecargas AS s WHERE s.versao = e.versao) AS sobrecargas
    FROM estado_objetos AS e GROUP BY e.versao
),
post_002 AS (
    SELECT EXISTS (SELECT 1 FROM estado_objetos WHERE versao = '002' AND classe = 'politica' AND estado = 'COINCIDE') AS perfil
),
rpc_app(objeto) AS (
    VALUES ('public.vincular_colaborador(uuid,text,public.papel_usuario)'),
           ('pavollos_admin.vincular_colaborador(uuid,text,public.papel_usuario)'),
           ('public.mvp_operacoes(text,jsonb)'), ('pavollos_admin.mvp_operacoes(text,jsonb)'),
           ('public.mvp_orcamentos(text,jsonb)'), ('pavollos_admin.mvp_orcamentos(text,jsonb)'),
           ('public.mvp_ordens(text,jsonb)'), ('pavollos_admin.mvp_ordens(text,jsonb)')
),
excessos_acl AS (
    SELECT a.classe, a.objeto, a.papel, a.privilegio, a.delegavel
    FROM acl_efetiva AS a CROSS JOIN post_002 AS x
    WHERE (a.classe IN ('tabela','coluna') OR (a.classe = 'esquema' AND a.objeto = 'pavollos_admin')
           OR (a.classe = 'rotina' AND EXISTS (SELECT 1 FROM objetos_referencia AS r
                          WHERE r.classe = 'rotina' AND r.objeto = a.objeto)))
      AND NOT (
        a.papel = 'authenticated' AND NOT a.delegavel AND (
          (x.perfil AND a.classe = 'coluna' AND a.privilegio = 'SELECT'
           AND a.objeto IN ('public.usuarios.id','public.usuarios.nome','public.usuarios.papel','public.usuarios.ativo'))
          OR (x.perfil AND a.classe = 'esquema' AND a.objeto = 'pavollos_admin' AND a.privilegio = 'USAGE')
          OR (a.classe = 'rotina' AND a.privilegio = 'EXECUTE'
              AND EXISTS (SELECT 1 FROM rpc_app AS r WHERE r.objeto = a.objeto))
        )
      )
),
faltas_acl AS (
    SELECT 'rotina' AS classe, r.objeto, 'EXECUTE' AS privilegio
    FROM rpc_app AS r JOIN rotinas AS f USING (objeto)
    WHERE NOT EXISTS (SELECT 1 FROM acl_efetiva AS a
        WHERE a.classe = 'rotina' AND a.objeto = r.objeto AND a.papel = 'authenticated' AND a.privilegio = 'EXECUTE')
    UNION ALL
    SELECT 'coluna', n.objeto, 'SELECT'
    FROM post_002 AS x CROSS JOIN (VALUES ('public.usuarios.id'), ('public.usuarios.nome'),
         ('public.usuarios.papel'), ('public.usuarios.ativo')) AS n(objeto)
    WHERE x.perfil AND NOT EXISTS (SELECT 1 FROM acl_efetiva AS a
        WHERE a.classe = 'coluna' AND a.objeto = n.objeto AND a.papel = 'authenticated' AND a.privilegio = 'SELECT')
    UNION ALL
    SELECT 'esquema', 'pavollos_admin', 'USAGE' FROM post_002 AS x
    WHERE x.perfil AND NOT EXISTS (SELECT 1 FROM acl_efetiva AS a
        WHERE a.classe = 'esquema' AND a.objeto = 'pavollos_admin' AND a.papel = 'authenticated' AND a.privilegio = 'USAGE')
),
verificacoes(nome, passou, detalhe) AS (
    SELECT 'Tabelas publicas e papel executor',
           (SELECT count(*) = 8 AND coalesce(bool_and(t.relkind = 'r' AND t.relrowsecurity
                    AND t.dono = CURRENT_USER AND NOT pg_catalog.row_security_active(t.oid)), false)
            FROM tabelas AS t WHERE t.esquema = 'public'),
           jsonb_build_object('executor', CURRENT_USER, 'esperado', 'oito tabelas ordinarias com RLS e mesmo dono executor')
    UNION ALL
    SELECT 'Papeis da aplicacao',
           (SELECT coalesce(bool_and(p.oid IS NOT NULL AND NOT p.rolsuper AND NOT p.rolbypassrls
                     AND NOT pg_catalog.pg_has_role(p.oid, CURRENT_USER, 'MEMBER')), false) FROM papeis_app AS p),
           (SELECT jsonb_agg(jsonb_build_object('papel', p.nome, 'presente', p.oid IS NOT NULL,
                    'superusuario', p.rolsuper, 'contorna_rls', p.rolbypassrls)) FROM papeis_app AS p)
    UNION ALL
    SELECT 'Dependencias do Supabase Auth',
           (SELECT count(*) = 4 AND coalesce(bool_and(
                   c.detalhe->>'tipo' = CASE WHEN c.nome = 'id' THEN 'uuid' ELSE 'timestamp with time zone' END
                   AND pg_catalog.has_column_privilege(CURRENT_USER, c.oid, c.attnum, 'SELECT')), false)
             FROM colunas AS c WHERE c.objeto = 'auth.users')
           AND EXISTS (SELECT 1 FROM tabelas AS t WHERE t.objeto = 'auth.users' AND t.relkind = 'r'
                       AND NOT pg_catalog.row_security_active(t.oid))
           AND EXISTS (SELECT 1 FROM restricoes AS a WHERE a.objeto = 'auth.users' AND a.contype = 'p'
                       AND a.detalhe->'colunas' = '["id"]'::jsonb AND (a.detalhe->>'validada')::boolean)
           AND EXISTS (SELECT 1 FROM rotinas AS f CROSS JOIN papeis_app AS p
                       JOIN alvos_acl AS a ON a.objeto = 'auth' AND a.classe = 'esquema'
                       WHERE f.objeto = 'auth.uid()' AND f.detalhe->>'retorno' = 'uuid' AND p.nome = 'authenticated'
                         AND pg_catalog.has_schema_privilege(CURRENT_USER, a.oid, 'USAGE')
                         AND pg_catalog.has_function_privilege(p.oid, f.oid, 'EXECUTE')),
           jsonb_build_object('esperado', 'UUID e campos de convite de auth.users, PK e auth.uid() acessiveis ao papel devido')
    UNION ALL
    SELECT 'Unicidade de ordem por item',
           EXISTS (SELECT 1 FROM tabelas AS t JOIN pg_catalog.pg_index AS i ON i.indrelid = t.oid
                   JOIN pg_catalog.pg_attribute AS a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
                   WHERE t.objeto = 'public.ordens_servico' AND a.attname = 'item_orcamento_id' AND a.attnotnull
                     AND i.indisunique AND i.indisvalid AND i.indimmediate
                     AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts = 1),
           jsonb_build_object('esperado', 'indice unico valido, imediato, integral e de uma chave sobre item_orcamento_id')
    UNION ALL
    SELECT 'Politicas e gatilhos das tabelas alvo',
           NOT EXISTS (SELECT 1 FROM politicas AS p WHERE p.objeto <> 'auth.users' AND NOT (
                p.objeto = 'public.usuarios' AND p.nome = 'usuarios_ler_proprio_ativo'
                AND EXISTS (SELECT 1 FROM estado_objetos AS e WHERE e.classe = 'politica'
                            AND e.objeto = p.objeto || '.' || p.nome AND e.estado = 'COINCIDE')))
           AND NOT EXISTS (SELECT 1 FROM gatilhos AS g WHERE g.objeto <> 'auth.users' AND NOT g.tgisinternal AND g.tgenabled <> 'D'),
           jsonb_build_object('esperado', 'nenhuma politica extra e nenhum gatilho nao interno habilitado no escopo da aplicacao')
    UNION ALL
    SELECT 'Acesso efetivo esperado',
           NOT EXISTS (SELECT 1 FROM excessos_acl) AND NOT EXISTS (SELECT 1 FROM faltas_acl),
           jsonb_build_object('excessos', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.objeto,e.papel,e.privilegio) FROM excessos_acl AS e), '[]'),
                              'faltas', coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.objeto) FROM faltas_acl AS f), '[]'))
    UNION ALL
    SELECT 'Propriedade dos objetos das migrações',
           NOT EXISTS (SELECT 1 FROM rotinas AS f
               JOIN objetos_referencia AS r ON r.classe = 'rotina' AND r.objeto = f.objeto
               CROSS JOIN tabelas AS u
               WHERE u.objeto = 'public.usuarios' AND f.dono_oid <> u.relowner)
           AND NOT EXISTS (SELECT 1 FROM alvos_acl AS a CROSS JOIN tabelas AS u
               WHERE a.objeto IN ('pavollos_admin','pavollos_admin.usuarios_auditoria')
                 AND u.objeto = 'public.usuarios' AND a.dono_oid <> u.relowner),
           jsonb_build_object('esperado', 'esquema, auditoria e rotinas das fases presentes com o mesmo dono de public.usuarios')
    UNION ALL
    SELECT 'Ordem das migrações',
           NOT EXISTS (SELECT 1 FROM estado_migracoes AS a JOIN estado_migracoes AS b ON a.versao < b.versao
                      WHERE b.presentes > 0 AND (a.presentes <> a.esperados OR a.divergentes > 0 OR a.sobrecargas > 0)),
           jsonb_build_object('esperado', 'conferir fases anteriores antes de fases posteriores presentes')
),
relatorio(secao, objeto, estado, detalhes) AS (
    SELECT '00_ambiente', 'sessao', 'INVENTARIO',
           jsonb_build_object('banco', current_database(), 'executor', CURRENT_USER,
               'versao_postgresql', current_setting('server_version'),
               'relacao_historico_supabase_existe', pg_catalog.to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
               'referencia', 'reconstrucao historica local e migrações 002 a 005',
               'revisao_externa', 'Conferir registro das versoes e manter pavollos_admin fora dos esquemas expostos pela Data API')
    UNION ALL
    SELECT '01_migracoes', m.versao,
           CASE WHEN m.sobrecargas > 0 OR m.divergentes > 0 THEN 'DIVERGENTE'
                WHEN m.presentes = 0 THEN 'AUSENTE'
                WHEN m.presentes <> m.esperados THEN 'PARCIAL'
                ELSE 'PRESENTE_CONFERIR_HISTORICO' END, to_jsonb(m) - 'versao'
    FROM estado_migracoes AS m
    UNION ALL
    SELECT '02_verificacoes', v.nome, CASE WHEN v.passou THEN 'OK' ELSE 'REVISAR' END, v.detalhe
    FROM verificacoes AS v
    UNION ALL
    SELECT '03_base_historica', r.objeto,
           CASE WHEN t.objeto IS NULL THEN 'AUSENTE'
                WHEN (s.colunas_md5, s.restricoes_md5, s.indices_md5)
                     IS NOT DISTINCT FROM (r.colunas_md5, r.restricoes_md5, r.indices_md5) THEN 'COINCIDE'
                ELSE 'REVISAR' END,
           jsonb_build_object('colunas_coincidem', s.colunas_md5 = r.colunas_md5,
               'restricoes_coincidem', s.restricoes_md5 = r.restricoes_md5, 'indices_coincidem', s.indices_md5 = r.indices_md5,
               'referencia', to_jsonb(r) - 'objeto', 'observado', to_jsonb(s) - 'objeto')
    FROM base_referencia AS r LEFT JOIN tabelas AS t USING (objeto) LEFT JOIN assinaturas_tabelas AS s USING (objeto)
    UNION ALL
    SELECT '03_base_historica', r.objeto,
           CASE WHEN e.objeto IS NULL THEN 'AUSENTE' WHEN e.valores = r.valores_texto::jsonb THEN 'COINCIDE' ELSE 'REVISAR' END,
           jsonb_build_object('esperado', r.valores_texto::jsonb, 'observado', e.valores)
    FROM enums_referencia AS r LEFT JOIN enums AS e USING (objeto)
    UNION ALL
    SELECT '04_objetos_migracoes', e.versao || ' ' || e.objeto, e.estado,
           jsonb_build_object('classe', e.classe, 'esperada_md5', e.esperada, 'observada_md5', e.observada)
    FROM estado_objetos AS e
    UNION ALL
    SELECT '04_objetos_migracoes', s.versao || ' ' || s.objeto, 'SOBRECARGA', jsonb_build_object('classe', 'rotina')
    FROM sobrecargas AS s
    UNION ALL
    SELECT '05_tabelas', t.objeto, 'INVENTARIO',
           jsonb_build_object('tipo_codigo', t.relkind, 'dono', t.dono, 'rls', t.relrowsecurity,
               'rls_forcada', t.relforcerowsecurity, 'rls_para_executor', pg_catalog.row_security_active(t.oid),
               'colunas', coalesce((SELECT jsonb_agg(c.detalhe || jsonb_build_object('nome', c.nome) ORDER BY c.attnum)
                                   FROM colunas AS c WHERE c.oid = t.oid), '[]'),
               'restricoes', coalesce((SELECT jsonb_agg(r.detalhe || jsonb_build_object('nome', r.nome) ORDER BY r.nome)
                                   FROM restricoes AS r WHERE r.oid = t.oid), '[]'),
               'indices', coalesce((SELECT jsonb_agg(i.detalhe || jsonb_build_object('nome', i.nome) ORDER BY i.nome)
                                   FROM indices AS i WHERE i.oid = t.oid), '[]'),
               'gatilhos', coalesce((SELECT jsonb_agg(g.detalhe || jsonb_build_object('nome', g.nome) ORDER BY g.nome)
                                   FROM gatilhos AS g WHERE g.oid = t.oid), '[]'),
               'politicas', coalesce((SELECT jsonb_agg(p.detalhe || jsonb_build_object('nome', p.nome) ORDER BY p.nome)
                                   FROM politicas AS p WHERE p.oid = t.oid), '[]'))
    FROM tabelas AS t
    UNION ALL
    SELECT '06_rotinas', r.objeto,
           CASE WHEN r.esquema = 'public' AND (r.detalhe->>'definidor')::boolean
                     AND EXISTS (SELECT 1 FROM acl_efetiva AS a WHERE a.classe = 'rotina' AND a.oid = r.oid)
                THEN 'REVISAR' ELSE 'INVENTARIO' END,
           r.detalhe || jsonb_build_object('dono', p.dono, 'acl', p.acl, 'efetivos_app', p.efetivos)
    FROM rotinas AS r JOIN privilegios AS p ON p.classe = 'rotina' AND p.oid = r.oid
    UNION ALL
    SELECT '07_privilegios', p.objeto, 'INVENTARIO',
           jsonb_build_object('classe', p.classe, 'dono', p.dono, 'acl', p.acl, 'efetivos_app', p.efetivos,
                'por_coluna', CASE WHEN p.classe = 'tabela' THEN coalesce(
                      (SELECT jsonb_agg(jsonb_build_object('objeto', c.objeto, 'acl', c.acl, 'efetivos_app', c.efetivos)
                                ORDER BY c.attnum)
                       FROM privilegios AS c WHERE c.classe = 'coluna' AND c.oid = p.oid
                         AND (c.acl <> '[]'::jsonb OR c.efetivos <> '[]'::jsonb)), '[]') END)
    FROM privilegios AS p WHERE p.classe IN ('tabela','esquema')
)
SELECT secao, objeto, estado, detalhes
FROM relatorio
ORDER BY secao, objeto;
