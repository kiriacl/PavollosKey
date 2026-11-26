# Implantação do back-end — migrações 003 a 005

O [pacote SQL](003_005_pacote_implantacao.sql) reúne os arquivos revisados na ordem **003 → 004 → 005**. A 002 já está aplicada no projeto de destino. A 003 usa o schema privado criado pela 002 e cria os auxiliares de perfil e histórico. A 004 usa esses auxiliares para cotações e orçamentos. A 005 usa os mesmos auxiliares e os itens aprovados pelo fluxo da 004.

## Checklist no Supabase

1. Confirme o projeto, a disponibilidade de backup e o mesmo papel administrativo usado na 002. Execute [a auditoria somente leitura](../tests/remote_schema_audit.sql). A 002 deve aparecer como `PRESENTE_CONFERIR_HISTORICO`, as três seguintes como `AUSENTE` e as verificações principais como `OK`. Confira que `pavollos_admin` está fora dos schemas expostos na Data API.
2. Para cada etapa, copie **um bloco completo** do pacote, de `BEGIN;` a `COMMIT;`, e execute-o sozinho no SQL Editor. A ordem é clientes e atendimentos, cotações e orçamentos, ordens de serviço. Aplique cada bloco uma vez.
3. Reexecute a auditoria após cada bloco. A versão executada deve aparecer como `PRESENTE_CONFERIR_HISTORICO` e seus objetos como `COINCIDE`. As verificações principais devem permanecer `OK`, com RLS habilitada e sem acesso direto às tabelas de negócio para `anon` e `authenticated`. Se houver erro, `PARCIAL` ou `DIVERGENTE`, interrompa a sequência e confira o estado antes de tentar novamente. Os blocos já confirmados permanecem aplicados.
4. Se `public.rls_auto_enable()` aparecer como `REVISAR`, confira o vínculo e as tags do gatilho. O exemplo do Supabase atua em comandos de criação de tabela. Estas três etapas criam funções e ajustam privilégios. Revise qualquer gatilho personalizado que atue nesses comandos. [Gatilhos de evento do Supabase](https://supabase.com/docs/guides/database/postgres/event-triggers#example-trigger-function---auto-enable-row-level-security)
5. Registre os arquivos aplicados e os resultados da auditoria. O SQL Editor não registra automaticamente as migrações no histórico do CLI. Reconcilie o histórico antes de usar `supabase db push`. [Histórico de migrações](https://supabase.com/docs/guides/deployment/database-migrations)

## Teste real de login e fluxo principal

Use contas Auth de demonstração já vinculadas a um proprietário e um técnico ativos. Use uma sessão de cookies separada por conta. Se precisar preparar perfis, siga o [procedimento administrativo da 002](../README.md). Use registros de demonstração autorizados. Envie JSON com `Content-Type: application/json` em `POST` e `PATCH` e preserve os cookies da sessão. Informe senhas apenas no cliente de teste e mantenha senhas, cookies e tokens fora de logs.

| Etapa | Requisições e resultado esperado |
| --- | --- |
| Servidor e login | Suba o back-end com o [guia de ambiente](../../backend/README.md). `GET /api/health` responde `200`. `GET /api/auth/me` sem sessão retorna `401`. `POST /api/auth/login` com `{email, password}` retorna `200` e estabelece a sessão. Com ela, `GET /api/auth/me` e `GET /api/perfil` retornam `200` com a identidade e o papel esperados. Uma conta sem perfil ou inativa recebe `403` no login. |
| Cliente e atendimento | Como proprietário ou auxiliar, use `POST /api/clientes` com `{nome}` e `POST /api/atendimentos` com `{cliente_id, canal_entrada, descricao}`. Use `presencial` ou `whatsapp` e confira `201` nas duas chamadas. |
| Orçamento e aceite | Crie uma cotação com `POST /api/atendimentos/:id/cotacoes`, `{tipo: "inicial"}`. Crie um orçamento com `POST /api/cotacoes/:id/orcamentos`, `{itens: [{escopo, valor}]}`. Envie com `POST /api/orcamentos/:id/enviar`, `{}`. `POST /api/ordens-servico` com `{item_orcamento_id}` retorna `409` antes do aceite. Registre o aceite de demonstração com `POST /api/orcamentos/:id/aprovar`, `{canal_aceite, evidencia_aceite}`. |
| Ordem e atribuição | Repita `POST /api/ordens-servico` após o aceite e espere `200`. Envie o mesmo item novamente e confira o mesmo ID de ordem. Como proprietário, consulte `GET /api/usuarios/tecnicos` e atribua com `POST /api/ordens-servico/:id/atribuir`, `{tecnico_id}`. |
| Execução e histórico | Com o técnico atribuído, use `POST /api/ordens-servico/:id/iniciar`, `PATCH /api/ordens-servico/:id` com `{observacao_execucao}` e `POST /api/ordens-servico/:id/concluir`. Confira os eventos em `GET /api/ordens-servico/:id/historico`. Se houver um segundo técnico ativo, confira `404` na leitura da ordem e `403` ao tentar iniciá-la com a sessão dele. |
| Encerramento | Como proprietário ou auxiliar, use `POST /api/atendimentos/:id/encerrar` e confira o histórico em `GET /api/atendimentos/:id/historico`. Finalize as sessões com `POST /api/auth/logout` e confirme `204` e, em seguida, `401` em `GET /api/auth/me`. |

Use `{}` nas ações sem campos. O [contrato completo da API](../../backend/INTEGRACAO.md) detalha os campos e códigos de resposta.
