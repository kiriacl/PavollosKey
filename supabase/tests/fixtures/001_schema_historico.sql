-- Fixture descartável para os testes com PostgreSQL em PGlite.
-- Reconstrução do DDL histórico revisado. Os objetos de Auth abaixo simulam somente o contrato SQL utilizado.
-- Use exclusivamente em uma instância vazia de teste. Este arquivo não é migração de produção.

BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;

CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    email text,
    aud text,
    role text,
    invited_at timestamptz,
    email_confirmed_at timestamptz,
    deleted_at timestamptz
);

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $uid$
    SELECT COALESCE(
        NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), ''),
        NULLIF(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid;
$uid$;

REVOKE ALL PRIVILEGES ON TABLE auth.users FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION auth.uid() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

CREATE TYPE public.papel_usuario AS ENUM ('proprietario', 'auxiliar', 'tecnico');
CREATE TYPE public.canal_atendimento AS ENUM ('presencial', 'whatsapp');
CREATE TYPE public.tipo_cotacao AS ENUM ('inicial', 'complementar');
CREATE TYPE public.status_atendimento AS ENUM ('aberto', 'encerrado', 'cancelado');
CREATE TYPE public.status_orcamento AS ENUM (
    'rascunho', 'enviado', 'aprovado', 'recusado', 'expirado', 'substituido', 'cancelado'
);
CREATE TYPE public.status_ordem_servico AS ENUM (
    'aguardando_atribuicao', 'atribuida', 'em_execucao', 'concluida', 'cancelada'
);
CREATE TYPE public.tipo_evento_historico AS ENUM ('status', 'atribuicao');

CREATE TABLE public.usuarios (
    id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE RESTRICT,
    nome text NOT NULL CHECK (nome ~ '[^[:space:]]'),
    papel public.papel_usuario NOT NULL,
    ativo boolean NOT NULL DEFAULT true,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clientes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL CHECK (nome ~ '[^[:space:]]'),
    telefone text,
    email text,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.atendimentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid NOT NULL REFERENCES public.clientes (id) ON DELETE RESTRICT,
    criado_por uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE RESTRICT,
    canal_entrada public.canal_atendimento NOT NULL,
    descricao text NOT NULL CHECK (descricao ~ '[^[:space:]]'),
    status public.status_atendimento NOT NULL DEFAULT 'aberto',
    motivo_cancelamento text,
    cancelado_em timestamptz,
    cancelado_por uuid REFERENCES public.usuarios (id) ON DELETE RESTRICT,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT atendimentos_cancelamento_check CHECK (
        CASE WHEN status = 'cancelado' THEN
            motivo_cancelamento IS NOT NULL
            AND motivo_cancelamento ~ '[^[:space:]]'
            AND cancelado_em IS NOT NULL
            AND cancelado_por IS NOT NULL
        ELSE
            num_nonnulls(motivo_cancelamento, cancelado_em, cancelado_por) = 0
        END
    )
);

CREATE TABLE public.cotacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id uuid NOT NULL REFERENCES public.atendimentos (id) ON DELETE RESTRICT,
    tipo public.tipo_cotacao NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orcamentos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cotacao_id uuid NOT NULL REFERENCES public.cotacoes (id) ON DELETE RESTRICT,
    versao integer NOT NULL CHECK (versao > 0),
    status public.status_orcamento NOT NULL DEFAULT 'rascunho',
    validade_ate timestamptz,
    enviado_em timestamptz,
    aprovado_em timestamptz,
    canal_aceite public.canal_atendimento,
    evidencia_aceite text,
    aceite_registrado_por uuid REFERENCES public.usuarios (id) ON DELETE RESTRICT,
    motivo_cancelamento text,
    cancelado_em timestamptz,
    cancelado_por uuid REFERENCES public.usuarios (id) ON DELETE RESTRICT,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT orcamentos_cotacao_versao_key UNIQUE (cotacao_id, versao),
    CONSTRAINT orcamentos_envio_check CHECK (
        CASE status
            WHEN 'rascunho' THEN enviado_em IS NULL
            WHEN 'cancelado' THEN true
            ELSE enviado_em IS NOT NULL
        END
    ),
    CONSTRAINT orcamentos_validade_envio_check CHECK (
        validade_ate IS NULL OR enviado_em IS NULL OR validade_ate >= enviado_em
    ),
    CONSTRAINT orcamentos_aceite_check CHECK (
        CASE WHEN status = 'aprovado' THEN
            enviado_em IS NOT NULL
            AND aprovado_em IS NOT NULL
            AND aprovado_em >= enviado_em
            AND (validade_ate IS NULL OR aprovado_em <= validade_ate)
            AND canal_aceite IS NOT NULL
            AND evidencia_aceite IS NOT NULL
            AND evidencia_aceite ~ '[^[:space:]]'
            AND aceite_registrado_por IS NOT NULL
        ELSE
            num_nonnulls(aprovado_em, canal_aceite, evidencia_aceite, aceite_registrado_por) = 0
        END
    ),
    CONSTRAINT orcamentos_cancelamento_check CHECK (
        CASE WHEN status = 'cancelado' THEN
            motivo_cancelamento IS NOT NULL
            AND motivo_cancelamento ~ '[^[:space:]]'
            AND cancelado_em IS NOT NULL
            AND cancelado_por IS NOT NULL
        ELSE
            num_nonnulls(motivo_cancelamento, cancelado_em, cancelado_por) = 0
        END
    )
);

CREATE TABLE public.itens_orcamento (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    orcamento_id uuid NOT NULL REFERENCES public.orcamentos (id) ON DELETE RESTRICT,
    posicao integer NOT NULL CHECK (posicao > 0),
    escopo text NOT NULL CHECK (escopo ~ '[^[:space:]]'),
    valor numeric(12, 2) NOT NULL CHECK (valor >= 0 AND valor <> 'NaN'::numeric),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT itens_orcamento_versao_posicao_key UNIQUE (orcamento_id, posicao)
);

CREATE TABLE public.ordens_servico (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_orcamento_id uuid NOT NULL REFERENCES public.itens_orcamento (id) ON DELETE RESTRICT,
    tecnico_id uuid REFERENCES public.usuarios (id) ON DELETE RESTRICT,
    criada_por uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE RESTRICT,
    status public.status_ordem_servico NOT NULL DEFAULT 'aguardando_atribuicao',
    local_execucao text,
    observacao_execucao text,
    motivo_cancelamento text,
    cancelado_em timestamptz,
    cancelado_por uuid REFERENCES public.usuarios (id) ON DELETE RESTRICT,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ordens_servico_item_orcamento_key UNIQUE (item_orcamento_id),
    CONSTRAINT ordens_servico_atribuicao_check CHECK (
        CASE status
            WHEN 'aguardando_atribuicao' THEN tecnico_id IS NULL
            WHEN 'cancelada' THEN true
            ELSE tecnico_id IS NOT NULL
        END
    ),
    CONSTRAINT ordens_servico_cancelamento_check CHECK (
        CASE WHEN status = 'cancelada' THEN
            motivo_cancelamento IS NOT NULL
            AND motivo_cancelamento ~ '[^[:space:]]'
            AND cancelado_em IS NOT NULL
            AND cancelado_por IS NOT NULL
        ELSE
            num_nonnulls(motivo_cancelamento, cancelado_em, cancelado_por) = 0
        END
    )
);

CREATE TABLE public.historico_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    atendimento_id uuid REFERENCES public.atendimentos (id) ON DELETE RESTRICT,
    orcamento_id uuid REFERENCES public.orcamentos (id) ON DELETE RESTRICT,
    ordem_servico_id uuid REFERENCES public.ordens_servico (id) ON DELETE RESTRICT,
    ator_id uuid NOT NULL REFERENCES public.usuarios (id) ON DELETE RESTRICT,
    ocorrido_em timestamptz NOT NULL DEFAULT now(),
    tipo_evento public.tipo_evento_historico NOT NULL,
    status_anterior text,
    status_novo text,
    tecnico_anterior_id uuid REFERENCES public.usuarios (id) ON DELETE RESTRICT,
    tecnico_novo_id uuid REFERENCES public.usuarios (id) ON DELETE RESTRICT,
    motivo text,

    CONSTRAINT historico_status_entidade_check CHECK (
        num_nonnulls(atendimento_id, orcamento_id, ordem_servico_id) = 1
    ),
    CONSTRAINT historico_status_evento_check CHECK (
        CASE tipo_evento
            WHEN 'status' THEN
                status_novo IS NOT NULL
                AND status_novo ~ '[^[:space:]]'
                AND (status_anterior IS NULL OR status_anterior ~ '[^[:space:]]')
                AND status_anterior IS DISTINCT FROM status_novo
                AND num_nonnulls(tecnico_anterior_id, tecnico_novo_id) = 0
            WHEN 'atribuicao' THEN
                ordem_servico_id IS NOT NULL
                AND tecnico_anterior_id IS DISTINCT FROM tecnico_novo_id
                AND num_nonnulls(status_anterior, status_novo) = 0
            ELSE false
        END
    )
);

CREATE UNIQUE INDEX cotacoes_uma_inicial_por_atendimento_idx
    ON public.cotacoes (atendimento_id) WHERE tipo = 'inicial';
CREATE UNIQUE INDEX orcamentos_uma_versao_enviada_ou_aprovada_idx
    ON public.orcamentos (cotacao_id) WHERE status IN ('enviado', 'aprovado');

CREATE INDEX atendimentos_status_criado_em_idx ON public.atendimentos (status, criado_em DESC);
CREATE INDEX atendimentos_cliente_idx ON public.atendimentos (cliente_id);
CREATE INDEX atendimentos_criador_idx ON public.atendimentos (criado_por);
CREATE INDEX atendimentos_cancelador_idx ON public.atendimentos (cancelado_por)
    WHERE cancelado_por IS NOT NULL;
CREATE INDEX cotacoes_atendimento_idx ON public.cotacoes (atendimento_id);
CREATE INDEX orcamentos_registrador_aceite_idx ON public.orcamentos (aceite_registrado_por)
    WHERE aceite_registrado_por IS NOT NULL;
CREATE INDEX orcamentos_cancelador_idx ON public.orcamentos (cancelado_por)
    WHERE cancelado_por IS NOT NULL;
CREATE INDEX ordens_servico_tecnico_status_idx ON public.ordens_servico (tecnico_id, status)
    WHERE tecnico_id IS NOT NULL;
CREATE INDEX ordens_servico_criada_por_idx ON public.ordens_servico (criada_por);
CREATE INDEX ordens_servico_cancelador_idx ON public.ordens_servico (cancelado_por)
    WHERE cancelado_por IS NOT NULL;
CREATE INDEX historico_status_atendimento_data_idx
    ON public.historico_status (atendimento_id, ocorrido_em DESC) WHERE atendimento_id IS NOT NULL;
CREATE INDEX historico_status_orcamento_data_idx
    ON public.historico_status (orcamento_id, ocorrido_em DESC) WHERE orcamento_id IS NOT NULL;
CREATE INDEX historico_status_ordem_data_idx
    ON public.historico_status (ordem_servico_id, ocorrido_em DESC) WHERE ordem_servico_id IS NOT NULL;
CREATE INDEX historico_status_ator_idx ON public.historico_status (ator_id);
CREATE INDEX historico_status_tecnico_anterior_idx ON public.historico_status (tecnico_anterior_id)
    WHERE tecnico_anterior_id IS NOT NULL;
CREATE INDEX historico_status_tecnico_novo_idx ON public.historico_status (tecnico_novo_id)
    WHERE tecnico_novo_id IS NOT NULL;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_status ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
    public.usuarios, public.clientes, public.atendimentos, public.cotacoes,
    public.orcamentos, public.itens_orcamento, public.ordens_servico, public.historico_status
FROM PUBLIC, anon, authenticated;

COMMIT;
