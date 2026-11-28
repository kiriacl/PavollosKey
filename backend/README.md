# PávollosKeys — Back-end

API Next.js 16 com App Router, TypeScript, Supabase Auth e PostgreSQL. O front-end React/Vite vive em `frontend/` e consome a API por HTTP.

## Estrutura

- `src/app/api/` contém saúde, autenticação e as rotas de negócio.
- `src/lib/api/` concentra validação, sessão, autorização e despacho dos contratos REST.
- `src/lib/supabase/server.ts` cria um cliente SSR por requisição e propaga cookies e cabeçalhos de cache.
- `tests/` reúne testes de validação, HTTP e PostgreSQL.
- `../supabase/migrations/` contém as mudanças incrementais. O esquema histórico reconstruído para testes fica em `../supabase/tests/fixtures/`.

## Autenticação e dados

O login usa a conta Supabase Auth existente e a API entrega a sessão em cookies HttpOnly com SameSite=Lax e Secure em produção. A identidade é validada pelo Supabase. Cada rota de negócio confere o perfil ativo no PostgreSQL e as RPCs voltam a verificar o papel e a atribuição. A aplicação usa a chave publicável.

Proprietário e auxiliar operam clientes, atendimentos e orçamentos. O proprietário vincula colaboradores confirmados, atribui técnicos e realiza cancelamentos administrativos. O técnico opera suas ordens e consulta o histórico correspondente. As tabelas de negócio permanecem fechadas para escrita direta dos perfis da aplicação. As transições e os eventos de histórico são gravados na mesma transação.

## Ambiente e execução

Use Node.js 24 ou 26 com npm. A partir da raiz do repositório:

```powershell
cd backend
npm ci
npm run dev -- --port 3001
```

Configure `SUPABASE_URL` com a URL base e `SUPABASE_PUBLISHABLE_KEY` com a chave publicável em `backend/.env.local`, a partir de `.env.example`. O Git ignora valores locais. `PAVOLLOS_ESTABELECIMENTO` é opcional. Em implantação de mesma origem atrás de proxy, configure `PAVOLLOS_APP_ORIGIN` com a origem pública para validar mutações de navegador.

`GET http://localhost:3001/api/health` retorna `{"status":"ok"}` sem consultar o Supabase. Para o contrato completo, consulte [INTEGRACAO.md](INTEGRACAO.md).

## Banco e migrações

Siga [o procedimento do Supabase](../supabase/README.md) depois da revisão. Compare o esquema e as políticas remotas com a versão histórica, teste em ambiente descartável e confira o histórico de aplicação. Aplique as mudanças incrementais 002 a 005 em ordem, uma única vez, mediante autorização. O arquivo histórico de teste serve para o banco local em memória. O primeiro proprietário é cadastrado pelo procedimento administrativo separado.

## Validação

```powershell
npm run lint
npm run build
npm test
npm run test:http
```

`npm test` executa as validações de entrada e aplica as migrações a um PostgreSQL em memória (PGlite), com dados sintéticos e a base histórica reconstruída. `npm run test:http` usa o build e sobe Next.js e executa o fluxo HTTP completo sobre PostgreSQL em memória, com Auth e transporte da Data API simulados em loopback. Nenhum dos dois precisa contatar o projeto Supabase. A suíte pgTAP em `supabase/tests/database` é executada separadamente em um Supabase local descartável com o esquema revisado.

## Integração com a interface

Sirva Vite e Next.js pela mesma origem e encaminhe `/api/*` ao Next.js preservando cookies e o caminho completo. Configure `VITE_API_BASE_URL=/api` no ambiente do Vite e reinicie seu servidor. O serviço atual do painel já consome `GET /api/painel/contexto`. As telas dos demais módulos precisam ser ligadas aos contratos pela equipe de front-end.

## Roteiro de demonstração

1. Antes da apresentação, o administrador confirma as migrações e disponibiliza contas de demonstração autorizadas, vinculadas aos perfis e com senha configurada pelo Supabase Auth.
2. Inicie o back-end e consulte `/api/health`. Entre em `/api/auth/login`, preserve a sessão HTTP e confira o perfil e o contexto do painel.
3. Como proprietário ou auxiliar, cadastre um cliente de demonstração e abra um atendimento `presencial` ou `whatsapp`. Crie uma cotação inicial, uma versão de orçamento e inclua um item.
4. Envie o orçamento. Uma tentativa de gerar ordem antes do aceite retorna `409`. Registre a aprovação explícita com canal e evidência de demonstração e gere a ordem. Repetir a geração devolve a mesma ordem.
5. Como proprietário, liste os técnicos ativos e atribua a ordem. Com a sessão do técnico atribuído, inicie o serviço, registre observação e conclua. Consulte o histórico da ordem e, com perfil comercial, o do atendimento.
6. No fim, encerre o atendimento se as ordens e os orçamentos pendentes já estiverem resolvidos. Encerre as sessões de demonstração.

Em PowerShell, `Invoke-RestMethod -SessionVariable sessao` guarda o cookie no login. Nas operações posteriores, passe `-WebSession $sessao`. Use uma variável separada para o técnico. Forneça o JSON com `-ContentType 'application/json'` e digite a senha com `Read-Host -AsSecureString`, sem registrá-la no histórico.

## Limitações atuais

O banco remoto, o login real e a integração completa da interface requerem validação em ambiente autorizado. O envio registra a transição de estado. Mensagens de WhatsApp e cadastros no Supabase Auth são operados separadamente. O histórico é retornado pelas APIs de atendimento e ordem. Estoque, visitas e indicadores gerenciais ficam fora desse fluxo.
