# PávollosKeys — Contrato de integração do front-end

A interface React/Vite usa o prefixo `/api`. O servidor Next.js assume autenticação por cookie e a validação de acesso combina a sessão do Supabase Auth, o perfil ativo e as permissões no PostgreSQL.

## Desenvolvimento na mesma origem

1. Siga o [guia de inicialização](README.md) para iniciar o back-end na porta `3001`.
2. Na configuração local do Vite, use `VITE_API_BASE_URL=/api` e reinicie o servidor. Configure o proxy de desenvolvimento para encaminhar `/api` ao Next.js. Este é um exemplo para a integrante que mantém a configuração do front-end. Em produção, o proxy do domínio faz o mesmo encaminhamento. [Configuração de proxy do Vite](https://vite.dev/config/server-options#server-proxy)

```typescript
server: {
  proxy: {
    "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
  },
},
```

3. Em `backend/.env.local`, configure `PAVOLLOS_APP_ORIGIN` com a origem exata aberta no navegador, como `http://localhost:5173`. Se o Vite usar outra porta ou host, ajuste a origem. O servidor compara o cabeçalho `Origin` nas requisições com corpo e bloqueia mutações vindas de outra origem.
4. Use URLs relativas e `credentials: "same-origin"` nas requisições com sessão. Esse também é o padrão de `fetch` e o cliente atual do painel já o utiliza. O navegador guarda e encaminha os cookies `HttpOnly` e `SameSite=Lax`. Em produção, use HTTPS para os cookies `Secure`. [Credenciais no fetch](https://fetch.spec.whatwg.org/#credentials) · [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

O fluxo de entrada envia e-mail e senha ao back-end. O JavaScript recebe apenas o perfil e o navegador armazena a sessão automaticamente. Envie o corpo de login por HTTPS fora do desenvolvimento local e mantenha as credenciais fora de logs e variáveis `VITE_*`.

```typescript
const response = await fetch("/api/auth/login", {
  method: "POST",
  credentials: "same-origin",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
})
```

## Convenções do contrato

- Todos os caminhos abaixo incluem `/api`. Um segmento como `:id` recebe o UUID do registro correspondente.
- Envie um objeto JSON com `Content-Type: application/json` em `POST` e `PATCH`. Nas ações sem campos, envie `{}`. O limite de corpo é de 64 KiB.
- Nas listas e históricos paginados, `limite` aceita inteiros de 1 a 100 e `deslocamento` de 0 a 10.000. As listas retornam arrays diretos e usam `[]` quando vazias. Defina explicitamente `limite` para manter o tamanho da página.
- Datas de entrada usam ISO 8601 com fuso, por exemplo `2026-11-27T17:00:00-03:00`. Campos monetários recebem números JSON não negativos, com até duas casas decimais. Exiba o `total` calculado no banco.
- `Comercial` significa `proprietario` ou `auxiliar`. `Equipe` significa os três papéis com perfil ativo. A API determina o papel pela identidade autenticada e pelo perfil atual.
- Respostas de erro usam `{ error, message }`. Decida o fluxo pelo status e por `error`. Exiba `message` como texto.

| HTTP | Tratamento no front-end |
| --- | --- |
| `400` | Confira os campos e os formatos. |
| `401` | Solicite login ou informe credenciais inválidas. |
| `403` | Verifique perfil ativo, permissão da operação ou origem, conforme `error`. |
| `404` | Informe que o recurso está indisponível para o usuário ou que a rota é desconhecida. |
| `409` | Recarregue o registro e mostre que a operação conflita com o estado atual. |
| `413` e `415` | Ajuste o tamanho ou o tipo do corpo JSON. |
| `429` | Oriente a aguardar antes de tentar login novamente. |
| `500` e `503` | Informe indisponibilidade e permita nova tentativa controlada. |

## Sessão, perfil e painel

| Método e caminho | Papel | Entrada | Sucesso |
| --- | --- | --- | --- |
| `GET /api/health` | Público | — | `200 { status: "ok" }` |
| `POST /api/auth/login` | Conta Auth com perfil ativo | `{ email, password }` | `200 { perfil }`, com cookie |
| `POST /api/auth/logout` | Sessão atual | `{}` | `204`, sem corpo |
| `GET /api/auth/me` | Conta autenticada | — | `200 { user: { id, email } }`, com e-mail ou `null` |
| `GET /api/perfil` | Equipe | — | `200 Perfil` |
| `POST /api/usuarios/vincular` | Proprietário | `{ usuario_id, nome, papel }` | `201 { id }` do perfil |
| `GET /api/usuarios/tecnicos` | Proprietário | Paginação | `200 [{ id, nome }]` de técnicos ativos |
| `GET /api/painel/contexto` | Equipe | — | `200 { estabelecimento, atalhos }` |

`Perfil` contém `id`, `nome`, `papel` e `ativo: true`. `/auth/me` confirma a identidade Auth. Use `/perfil` para carregar o acesso de negócio. O vínculo aceita `auxiliar` ou `tecnico` para um UUID Auth já convidado e confirmado pelo procedimento administrativo. Veja [implantação dos perfis](../supabase/README.md).

O painel devolve o nome configurado em `PAVOLLOS_ESTABELECIMENTO`, com `PávollosKeys` como padrão. `atalhos` contém IDs do catálogo atual. Comercial recebe `clientes`, `solicitacoes`, `orcamentos`, `servicos` e `historico`. Técnico recebe `servicos` e `historico`. Os atalhos são navegação. Cada operação da API verifica as permissões no servidor e no banco.

Com `VITE_API_BASE_URL` vazia, o painel usa a demonstração. Com `/api`, o front-end apresenta o login, carrega o perfil e usa os atalhos do servidor. As telas integradas e as diferenças entre os dois modos estão no [guia do front-end](../frontend/README.md).

## Clientes e atendimentos

Rotas comerciais, exceto a ação de cancelar atendimento, que exige proprietário.

| Método e caminho | Entrada | Sucesso |
| --- | --- | --- |
| `GET /api/clientes` | Paginação | `200 Cliente[]` |
| `POST /api/clientes` | `{ nome, telefone?, email? }` | `201 Cliente` |
| `GET /api/clientes/:id` | — | `200 Cliente` |
| `PATCH /api/clientes/:id` | Ao menos um de `nome`, `telefone`, `email` | `200 Cliente` |
| `GET /api/atendimentos` | Paginação e `cliente_id` opcional | `200 Atendimento[]` |
| `POST /api/atendimentos` | `{ cliente_id, canal_entrada, descricao }` | `201 Atendimento` |
| `GET /api/atendimentos/:id` | — | `200 Atendimento` |
| `GET /api/atendimentos/:id/historico` | Paginação | `200 Evento[]` |
| `POST /api/atendimentos/:id/encerrar` | `{ motivo? }` | `200 Atendimento` |
| `POST /api/atendimentos/:id/cancelar` | `{ motivo }` | `200 Atendimento` |

`Cliente` tem `id`, `nome`, `telefone`, `email`, `criado_em` e `atualizado_em`. Use `null` para remover telefone ou e-mail.

`Atendimento` tem `id`, `cliente_id`, `criado_por`, `canal_entrada`, `descricao`, `status`, `motivo_cancelamento`, `cancelado_em`, `cancelado_por`, `criado_em` e `atualizado_em`. `canal_entrada` aceita `presencial` ou `whatsapp`. O histórico reúne eventos do atendimento, seus orçamentos e ordens correspondentes. O encerramento exige resolver ordens em aberto e orçamentos enviados. Se houver itens aprovados sem ordem, informe o motivo para encerrar.

## Cotações e orçamentos

Todas as rotas deste grupo exigem papel comercial.

| Método e caminho | Entrada | Sucesso |
| --- | --- | --- |
| `GET /api/atendimentos/:atendimento_id/cotacoes` | Paginação | `200 Cotacao[]` |
| `POST /api/atendimentos/:atendimento_id/cotacoes` | `{ tipo: "inicial" ou "complementar" }` | `201 Cotacao` |
| `GET /api/cotacoes/:cotacao_id/orcamentos` | Paginação | `200 OrcamentoResumo[]` |
| `POST /api/cotacoes/:cotacao_id/orcamentos` | `{ validade_ate?, itens?: [{ escopo, valor }] }` | `201 Orcamento` |
| `GET /api/orcamentos/:id` | — | `200 Orcamento` |
| `POST /api/orcamentos/:id/itens` | `{ escopo, valor }` | `201 Item` |
| `POST /api/orcamentos/:id/enviar` | `{}` | `200 Orcamento` |
| `POST /api/orcamentos/:id/aprovar` | `{ canal_aceite, evidencia_aceite }` | `200 Orcamento` |
| `POST /api/orcamentos/:id/recusar` | `{ canal_aceite, evidencia_aceite }` | `200 Orcamento` |
| `POST /api/orcamentos/:id/expirar` | `{}` | `200 Orcamento` |

- `Cotacao` tem `id`, `atendimento_id`, `tipo`, `criado_em` e `atualizado_em`.
- `OrcamentoResumo` tem `id`, `cotacao_id`, `versao`, `status`, `validade_ate`, `enviado_em`, `aprovado_em`, `canal_aceite`, `evidencia_aceite`, `aceite_registrado_por`, `criado_em`, `atualizado_em` e `total`.
- `Orcamento` inclui também `itens: Item[]`. `Item` tem `id`, `orcamento_id`, `posicao`, `escopo`, `valor`, `criado_em` e `atualizado_em`.

Crie uma versão em rascunho, adicione pelo menos um item e registre o envio. Essa ação muda o estado para `enviado`. O contato com o cliente ocorre pelo canal operacional escolhido pela equipe. Após o retorno do cliente, registre aprovação ou recusa com `canal_aceite` (`presencial` ou `whatsapp`) e evidência. A recusa mantém sua evidência no histórico. Alterações de valores e escopo exigem nova versão depois do envio. Uma ordem depende do aceite explícito registrado dentro da validade do orçamento.

## Ordens de serviço

| Método e caminho | Papel | Entrada | Sucesso |
| --- | --- | --- | --- |
| `GET /api/ordens-servico` | Equipe | Paginação | `200 Ordem[]` |
| `POST /api/ordens-servico` | Comercial | `{ item_orcamento_id, local_execucao? }` | `200 Ordem` |
| `GET /api/ordens-servico/:id` | Equipe | — | `200 Ordem` |
| `PATCH /api/ordens-servico/:id` | Técnico atribuído | `{ observacao_execucao }` | `200 Ordem` |
| `POST /api/ordens-servico/:id/atribuir` | Proprietário | `{ tecnico_id }` | `200 Ordem` |
| `POST /api/ordens-servico/:id/iniciar` | Técnico atribuído | `{}` | `200 Ordem` |
| `POST /api/ordens-servico/:id/concluir` | Técnico atribuído | `{}` | `200 Ordem` |
| `POST /api/ordens-servico/:id/cancelar` | Proprietário | `{ motivo }` | `200 Ordem` |
| `GET /api/ordens-servico/:id/historico` | Equipe | Paginação | `200 Evento[]` |

`Ordem` contém `id`, `item_orcamento_id`, `atendimento_id`, `tecnico_id`, `criada_por`, `status`, `escopo`, `local_execucao`, `observacao_execucao`, `motivo_cancelamento`, `cancelado_em`, `cancelado_por`, `criado_em`, `atualizado_em` e `cliente: { id, nome, telefone }`. A projeção operacional mantém o preço e a evidência de aceite na consulta comercial do orçamento.

O fluxo da ordem é `aguardando_atribuicao` → `atribuida` → `em_execucao` → `concluida`. O proprietário pode cancelar antes da conclusão e informar o motivo. É seguro repetir a criação para o mesmo item. A API devolve a ordem existente, inclusive cancelada. Técnico vê apenas as ordens atribuídas a ele. Reatribuir remove o acesso do técnico anterior.

`Evento` inclui `id`, `ator_id`, `ocorrido_em`, `tipo_evento` (`status` ou `atribuicao`), `status_anterior`, `status_novo`, `tecnico_anterior_id`, `tecnico_novo_id` e `motivo`. O histórico da ordem inclui `ordem_servico_id`. O histórico consolidado também pode trazer `atendimento_id` e `orcamento_id`. Referências e campos de estado podem ser nulos conforme o tipo de evento.
