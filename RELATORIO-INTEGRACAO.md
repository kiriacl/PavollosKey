# Relatório de integração — Pávolloskeys

## Git e atualização recebida

A cópia local estava em `feature/clientes`, no commit `4a38ad7`, com alterações rastreadas, arquivos novos e nenhuma alteração no índice. O front-end local já incluía as telas de Clientes e Solicitações, mudanças na marca e na landing page e os manifestos de dependências na raiz.

O remoto apresentou três branches. `origin/feature/dashboard` estava em `4a38ad7`. `origin/Back-end` trouxe `d3988ad`, de Santana-prog, em 26/11/2026. O PR #1 incluiu esse commit em `origin/main` no merge `4e9712c`. O commit do back-end acrescentou 32 arquivos em `backend/` e `supabase/`. A branch local `integracao/frontend-backend` partiu de `feature/clientes` e recebeu `origin/main` pelo merge local `703c9fc`, sem conflitos. As alterações locais seguiram no diretório de trabalho da branch de integração. Nenhum push foi feito e a branch local `main` permanece no ponto anterior.

## Estrutura, arquitetura e regras

| Área | Implementação |
| --- | --- |
| `frontend/src/` | React 19, TypeScript e Vite. Componentes, hooks, rotas por fragmento, serviços HTTP, amostras e páginas. A cena usa Three.js, React Three Fiber e Drei. |
| `backend/src/app/api/` | Next.js 16 com App Router. Rotas de saúde, login, logout, identidade Auth e despacho das operações de negócio. |
| `backend/src/lib/` | Validação de dados e origem, autorização por perfil, tratamento HTTP e cliente Supabase SSR por requisição. |
| `backend/tests/` | Validação, PostgreSQL em memória com PGlite e HTTP contra o Next.js. |
| `supabase/` | Migrações SQL incrementais, pacote de implantação, fixture histórica, teste pgTAP e auditoria somente leitura. |

O navegador fala com o Next.js na mesma origem. O Next.js usa a URL e a chave publicável do Supabase no servidor, propaga a sessão em cookies HttpOnly e valida o usuário e o perfil ativo. Uma função PostgreSQL valida novamente a permissão. O proprietário e o auxiliar operam o fluxo comercial. O proprietário vincula colaboradores, atribui técnicos e pode cancelar atendimentos e ordens nos estados permitidos. Técnicos consultam apenas suas ordens atribuídas e operam a execução dessas ordens.

O atendimento referencia o cliente, a cotação referencia o atendimento, e cada orçamento pertence a uma cotação e pode conter vários itens. Uma ordem depende de um item de orçamento com aceite explícito. A mesma criação de ordem para um item retorna o registro existente. Transições exigem estados válidos e gravam eventos de auditoria na mesma transação. O registro de envio de orçamento e a evidência do cliente pertencem ao fluxo comercial.

| Migração | Objetos e regras revisados |
| --- | --- |
| `002_usuarios_permissoes.sql` | `usuarios`, auditoria privada, perfis ativos e vínculo de contas Auth confirmadas. |
| `003_clientes_atendimentos.sql` | `clientes`, `atendimentos`, listagem de técnicos, ações de encerramento e cancelamento, acesso aos eventos em `historico_status`. |
| `004_cotacoes_orcamentos.sql` | `cotacoes`, `orcamentos`, `itens_orcamento`, versionamento, totais, validade, envio e aceite. |
| `005_ordens_servico.sql` | `ordens_servico`, projeção operacional, atribuição, execução, cancelamento e histórico. |

A base original é pré-requisito das migrações e está representada localmente pela fixture `001_schema_historico.sql`. No código versionado, a RLS protege as tabelas de negócio, a política de `usuarios` limita a leitura ao próprio perfil ativo e a aplicação executa operações por RPC autorizada. O teste local verificou acesso por papel e bloqueio de escrita direta. O guia de implantação registra a 002 como já aplicada no destino. Falta obter confirmação atual da 002 a 005, do DDL inicial e das políticas efetivas do ambiente remoto. A auditoria versionada permite essa conferência em modo somente leitura.

## Integrações entregues e lacunas

| Área | Entrega | Pendente |
| --- | --- | --- |
| Autenticação | Login, recuperação de sessão, logout, navegação por papel e tratamento de sessão expirada. | Homologação com contas Auth reais. |
| Dashboard | Contexto do painel, indicadores e gráficos derivados de atendimentos, clientes e ordens. Dados limitados à visibilidade do perfil. | Indicadores de visitas e agregação gerencial dedicada no servidor. |
| Clientes | Listagem, filtro, detalhe, cadastro e edição de nome, telefone e e-mail, com atendimentos vinculados no detalhe. | WhatsApp separado, endereço e observações no contrato real. |
| Solicitações | Grupo ligado a `/api/atendimentos`. Criação, detalhe, filtros, histórico, encerramento e cancelamento autorizado. | Edição de dados, outros canais e campos independentes de tipo, endereço, observações e data informada. |
| Orçamentos | Cotações, rascunhos, versões, itens, total, envio, decisão, expiração e ordem por item aprovado. | Envio automático e comunicação com WhatsApp/n8n. |
| Serviços | Ordens, consulta, atribuição e reatribuição, anotações, execução, conclusão e cancelamento por papel. | Homologação com a equipe em ambiente remoto. |
| Histórico | Eventos por atendimento e ordem, incluindo estados, atribuição, data e motivo. | Consulta global ou exportação, caso entrem no escopo. |
| Configurações | Estabelecimento, perfil ativo e vínculo de colaborador pelo proprietário. | Alteração de dados do estabelecimento, preferências e gestão administrativa de contas Auth. |
| Visitas | Tela de escopo e indicador de indisponibilidade no Dashboard. | Agenda, taxas e fluxo de visita aguardam API. |
| Estoque | Tela de escopo. | Materiais, saldos e movimentações aguardam API. |

A integração aponta para `/api` e deixa a demonstração disponível com a variável vazia. Os campos exclusivos da demonstração continuam nos formulários da amostra. O modo real usa os campos e estados do contrato, calcula a data civil a partir da criação em São Paulo e apresenta os estados de carregamento, sucesso, erro e listas vazias. A landing page, a cena 3D, a navegação, os gráficos e os componentes existentes foram reutilizados.

## Arquivos da integração

| Grupo | Arquivos |
| --- | --- |
| Ambiente | `.gitignore`, `frontend/.env.example` e `frontend/vite.config.ts`. Arquivos `.env.local` separados e ignorados. |
| HTTP e dados | `frontend/src/services/{http,auth,clients,requests,dashboard,operations}.ts`, `types/dashboard.ts` e `utils/dates.ts`. |
| Sessão e painel | `frontend/src/App.tsx`, `components/layout/{PanelSession,PanelLayout}.tsx`, `hooks/{useProfile,useDashboard}.ts` e `components/dashboard/{DashboardIndicators,DashboardCharts,RecentRequests}.tsx`. |
| Clientes e Solicitações | `components/clients/{ClientForm,ClientDetails,ClientTable}.tsx`, `components/clients/clientFormat.ts`, `pages/Clientes/clients.css`, `components/requests/{RequestForm,RequestDetails,RequestDialog,RequestTable,RequestFilters,RecordHistory}.tsx`, `components/requests/requestStatusLabels.ts` e `hooks/{useRequests,useRequestWrite}.ts`, sob `frontend/src/`. |
| Módulos e componentes | `frontend/src/pages/Painel/{PanelPages,BudgetsPage,OrdersPage,HistoryPage,SettingsPage}.tsx`, `pages/Painel/operations.css` e `components/ui/{OperationForm,ReadResult}.tsx`. |
| Documentação | `README.md`, `frontend/README.md`, `backend/README.md`, `backend/INTEGRACAO.md` e este relatório. |

Os arquivos do back-end e do Supabase vieram do merge remoto. A integração alterou apenas documentação dentro de `backend/` e usou as migrações versionadas no ambiente de teste em memória.

## Verificações e problemas

- Build e lint passaram nos dois projetos. O Next.js apontou a presença de múltiplos lockfiles ao inferir a raiz. O Vite avisou sobre o tamanho do módulo da chave 3D, que carrega sob demanda. O front-end oferece lint e build como scripts de verificação.
- `npm test` no back-end passou 11 testes de entrada, autorização, persistência e transições no PGlite. `npm run test:http` passou com Next.js real, migrações reais no PostgreSQL em memória e uma camada de teste em loopback para Auth e Data API.
- No Edge, o Vite encaminhou `/api` ao Next.js. O roteiro conferiu login, cookies HttpOnly, recarga de sessão, cadastro e edição de cliente, atendimento, Dashboard, cotação, orçamento, aceite, geração e atribuição de ordem, vínculo de colaborador, restrição do técnico, execução, histórico, encerramento e logout. Uma consulta SQL confirmou o telefone atualizado, o atendimento encerrado, a ordem concluída e a observação gravada no PGlite.
- O roteiro abriu a landing page e verificou o recurso da chave, a lista de Clientes a 390 px sem rolagem horizontal e a indicação de indisponibilidade de estoque. Em modo demonstração, conferiu os gráficos do Dashboard e os campos adicionais no formulário de Solicitações.
- As credenciais remotas, o histórico de migrações e contas de homologação estavam indisponíveis. A persistência em Supabase remoto, as políticas implantadas e o pgTAP em um Supabase local completo continuam pendentes. As verificações não gravaram dados nem executaram SQL no projeto remoto.

## Estimativa e próximos passos

**70% do escopo funcional solicitado.** Considerando o mesmo peso para dez áreas, autenticação, orçamentos, serviços e histórico têm integração funcional local completa para o contrato atual. Dashboard, clientes, solicitações e configurações têm boa parte do fluxo disponível e equivalem a três áreas completas para a estimativa. Visitas e estoque aguardam contrato. O percentual mede cobertura funcional local. A entrega em produção também depende de homologação.

1. Solicitar a URL do projeto de homologação, sua chave **publicável** `sb_publishable_…`, a origem pública esperada e contas de teste confirmadas com perfil ativo de proprietário, auxiliar e técnico. Receber credenciais de teste por um canal seguro.
2. Solicitar o DDL inicial ou uma exportação somente leitura, o histórico de aplicação das migrações 002 a 005 e a saída da auditoria `supabase/tests/remote_schema_audit.sql`. Confirmar os registros de teste autorizados e o procedimento de descarte com o responsável.
3. Validar autenticação, RLS e persistência no ambiente de homologação. Percorrer o fluxo até a conclusão e conferir os registros após nova sessão pelo roteiro do back-end.
4. Definir contratos para visitas e estoque e priorizar campos extras, preferências e indicadores gerenciais. Confirmar à parte o escopo de WhatsApp/n8n e pagamentos.
5. Configurar a implantação HTTPS na mesma origem e revisar o diff antes de publicar a branch ou integrar na principal.
