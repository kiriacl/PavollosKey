# PávollosKeys — Perfis e permissões

A migração [002_usuarios_permissoes.sql](migrations/002_usuarios_permissoes.sql) acrescenta o controle de acesso a `public.usuarios`. O Supabase Auth verifica a identidade. O PostgreSQL decide o acesso pelo UUID, pelo papel e pelo estado ativo do perfil.

## Antes da implantação

1. Recupere o DDL inicial ou obtenha uma exportação somente leitura do esquema implantado, com autorização. O arquivo original não está disponível neste checkout e o esquema remoto ficou fora da inspeção. Compare a PK e a FK de `public.usuarios.id`, os tipos das colunas, o enum de papéis, a RLS, as políticas, os gatilhos e os privilégios efetivos com a migração incremental.
2. Confirme que `pavollos_admin` estará fora dos esquemas expostos pela Data API. Revise a função executada com privilégios elevados e confirme que o papel de implantação é o dono de `public.usuarios` e pode criar os objetos da migração e ler os campos de convite em `auth.users`. A migração aborta se houver políticas ou gatilhos de aplicação já ativos em `public.usuarios` ou privilégios efetivos conflitantes.
3. Reproduza o esquema verificado em um Supabase local descartável. Após revisão, aplique a migração incremental nesse ambiente e execute `supabase test db supabase/tests/database/usuarios_permissoes.test.sql`. O [teste de autorização](tests/database/usuarios_permissoes.test.sql) usa identidades sintéticas e reverte os dados ao final. [Testes de banco no Supabase](https://supabase.com/docs/guides/database/testing)
4. Após validar em um projeto de homologação, confira projeto de destino, histórico de migrações e backup antes de aplicar a versão aprovada ao banco remoto. As tabelas já existentes devem ser tratadas como a base da migração incremental.

## Primeiro proprietário

Este procedimento é executado por um administrador autorizado do projeto Supabase, depois da implantação aprovada da migração.

1. No Dashboard, em **Authentication → Users**, envie o convite para a pessoa aprovada. Aguarde a confirmação e confira a identidade e o UUID exato da conta. [Convites no Supabase Auth](https://supabase.com/docs/guides/auth/users#inviting-users)
2. Abra uma transação administrativa e bloqueie `public.usuarios` em modo `SHARE ROW EXCLUSIVE` antes de verificar se existe qualquer perfil com papel `proprietario`, inclusive inativo. Confirme na mesma transação que o UUID corresponde à conta Auth confirmada e que ainda não tem perfil em `public.usuarios`. Se uma condição falhar, reverta a transação. [Bloqueios do PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html)
3. Insira o perfil com o UUID conferido, o nome da pessoa, `papel = 'proprietario'` e `ativo = true`. Na mesma transação, registre `bootstrap_proprietario` em `pavollos_admin.usuarios_auditoria`, com `ator_id` nulo, `alvo_id` igual ao UUID do perfil, `papel = 'proprietario'` e `operador_admin` identificando o administrador responsável. Confirme a transação somente depois de gravar os dois registros.

A recuperação de titularidade, inclusive quando já houver um proprietário inativo, requer um procedimento administrativo próprio.

## Vincular colaboradores

O proprietário aprova o colaborador e seu papel. Um administrador do projeto envia o convite pelo Dashboard. Após a confirmação da conta, o proprietário ativo chama `public.vincular_colaborador(p_usuario_id, p_nome, p_papel)` usando o UUID conferido e o papel `auxiliar` ou `tecnico`. A função verifica no banco quem fez a chamada e se a conta de destino foi convidada e confirmada. Um perfil já existente é preservado. O vínculo e a auditoria são gravados na mesma transação.

Mantenha os convites administrativos e o bootstrap no Dashboard. A aplicação usa a chave publicável e a sessão do colaborador para acessar a Data API. A política de leitura permite consultar apenas o próprio perfil ativo, nas colunas `id`, `nome`, `papel` e `ativo`. A autorização de rotas de negócio deve considerar o perfil ativo atual do colaborador. [Grants e RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security#grants-and-policies)

## Migrações do fluxo comercial

| Arquivo | Escopo |
|---|---|
| `003_clientes_atendimentos.sql` | Clientes, atendimentos, técnicos disponíveis e histórico comercial. |
| `004_cotacoes_orcamentos.sql` | Cotações, versões, itens, entrega, decisão e expiração do orçamento. |
| `005_ordens_servico.sql` | Emissão idempotente, atribuição, execução, cancelamento e histórico da OS. |

Aplique 002–005 em ordem, uma única vez, com o mesmo papel administrativo autorizado. Confirme o DDL implantado das oito tabelas, os enums, a unicidade de item por OS, as FKs e as políticas antes da execução em homologação. Quando a base já estiver no projeto remoto, reconcilie seu histórico antes de considerar qualquer aplicação pelo CLI. O SQL incremental pode ser revisado e executado por um operador autorizado no SQL Editor, um arquivo por vez. Preserve a base existente e verifique cada etapa antes de seguir.

`tests/fixtures/001_schema_historico.sql` é uma reconstrução para o PostgreSQL em memória. Ele contém uma camada Auth de teste e fica fora de `migrations/`. A checagem com essa base cobre o contrato histórico. A aceitação do esquema implantado requer conferência e teste no ambiente autorizado.
