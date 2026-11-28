# Pávolloskeys — Front-end

A interface usa React, TypeScript e Vite. A landing page apresenta a chave 3D e abre o painel em `/#/painel`. O painel integrado usa a API Next.js e mantém um modo de demonstração para trabalhar na interface sem credenciais.

## Executar localmente

Use Node.js 24 e rode os comandos a partir da raiz, no PowerShell.

```powershell
npm.cmd ci
npm.cmd --prefix frontend ci
npm.cmd --prefix backend ci
if (!(Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
if (!(Test-Path backend/.env.local)) { Copy-Item backend/.env.example backend/.env.local }
```

Em `backend/.env.local`, configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `PAVOLLOS_APP_ORIGIN=http://localhost:5173`. O nome do estabelecimento é opcional e vem de `PAVOLLOS_ESTABELECIMENTO`. Preencha os arquivos locais apenas se ainda estiverem vazios ou precisarem de ajustes.

Em dois terminais, a partir da raiz:

```powershell
npm.cmd --prefix backend run dev -- --hostname 127.0.0.1 --port 3001
npm.cmd --prefix frontend run dev
```

Abra `http://localhost:5173`. `http://localhost:5173/api/health` verifica o encaminhamento do Vite até o Next.js. Para entrar, use uma conta de teste confirmada no Supabase Auth com perfil ativo. O navegador envia os cookies da sessão para `/api`. Variáveis `VITE_*` são públicas e a única usada aqui é `VITE_API_BASE_URL=/api`.

Para a demonstração em memória, deixe `VITE_API_BASE_URL` vazia ou remova o arquivo local do front-end e reinicie o Vite. A demonstração permite explorar a interface, os gráficos e os formulários de Clientes e Solicitações. Recarregar a página restaura os dados da amostra.

Em produção, sirva `frontend/dist` com HTTPS e encaminhe `/api/*` ao Next.js no mesmo domínio. Preserve o caminho, o cabeçalho `Origin` e os cookies. Use a origem HTTPS do site em `PAVOLLOS_APP_ORIGIN`. `vite preview` serve o build local para checagem visual.

| Comando na raiz | Resultado |
| --- | --- |
| `npm.cmd --prefix frontend run lint` | Executa a análise ESLint. |
| `npm.cmd --prefix frontend run build` | Verifica TypeScript e gera `frontend/dist`. |
| `npm.cmd --prefix frontend run preview` | Serve o último build para inspeção. |

## Telas conectadas à API

| Tela | Comportamento |
| --- | --- |
| Acesso | Login, recuperação do perfil ao recarregar, expiração de sessão e logout. |
| Dashboard | Atalhos da API. Indicadores, gráficos e lista calculados com atendimentos, clientes e ordens retornados pela API. Técnico acompanha suas ordens. Visitas aparecem sem dados da API. |
| Clientes | Lista, pesquisa, cadastro, consulta, edição e lista de atendimentos por cliente. A API grava nome, telefone e e-mail. |
| Solicitações | Lista, filtros, cadastro e consulta de atendimentos, histórico e encerramento ou cancelamento conforme o perfil. A criação registra cliente, canal e descrição. |
| Orçamentos | Cotação inicial ou complementar, versões, itens, total do banco, envio, aprovação, recusa, expiração e geração de ordem por item aprovado. O envio registra a mudança de estado. |
| Serviços | Consulta de ordens e histórico. Proprietário atribui, reatribui e cancela. Técnico atribuído inicia, anota e conclui. |
| Histórico | Eventos por atendimento e por ordem, conforme o perfil. |
| Configurações | Estabelecimento e perfil da sessão. Proprietário vincula usuários Auth já convidados e confirmados. |
| Visitas e estoque | Telas de escopo com a indicação de que os recursos aguardam API. |

A camada `src/services/` adapta o JSON da API ao formato da interface. Os campos adicionais de Clientes e Solicitações e a edição livre de solicitações pertencem ao modo de demonstração. No modo API, a data de solicitação vem do instante de criação, exibido no fuso de São Paulo. As listas buscam páginas de até 100 registros para manter pesquisa, filtros e indicadores locais. O Dashboard considera os registros visíveis ao perfil autenticado.

A autorização é aplicada pelo servidor e pelas funções PostgreSQL. As telas usam o perfil para apresentar as ações disponíveis. Consulte os métodos, campos e códigos HTTP no [contrato da API](../backend/INTEGRACAO.md) e as decisões e limitações no [relatório de integração](../RELATORIO-INTEGRACAO.md).

## Interface e histórico de desenvolvimento

**Navegação.** `src/App.tsx` lê o fragmento do endereço e usa a tabela em `src/routes/routes.ts` para escolher a tela. Links como `/#/painel/clientes` funcionam ao recarregar a página e com os controles de histórico do navegador. O menu, os atalhos e a página de cada módulo usam a mesma definição de título, ícone e escopo. No modo API, o painel verifica a sessão antes de carregar os módulos.

**Interface.** A landing page tem navegação por seção, apresentação da chave e links para os módulos. O painel reutiliza a barra de navegação em um menu modal nas telas menores. Há link para pular ao conteúdo, indicação da página atual, foco no título ao navegar e fechamento do menu com Escape. Os componentes visuais e as páginas são funções React.

**Cena 3D.** Os contornos da lâmina e da cabeça da chave são extrudados com Three.js. React Three Fiber exibe as peças. Drei fornece a flutuação e as luzes do estúdio. A cena responde ao ponteiro e permite pausar e retomar a animação. O código 3D fica em um arquivo carregado sob demanda quando a figura entra na área visível. A renderização contínua pausa fora da tela e em abas ocultas.

**Alternativa estática.** Uma imagem WebP do mesmo modelo ocupa o espaço da cena durante o carregamento, com redução de movimento, economia de dados, até dois processadores lógicos, até 2 GB de memória informada ou WebGL 2 indisponível. Uma falha no módulo 3D ou a perda do contexto gráfico também ativa a imagem. A pequena classe `SceneBoundary` implementa a barreira de erro do React que isola a cena.

**Dados.** A visão geral usa `useDashboard` para os dados administrativos e `usePanelContext` para os atalhos. O módulo de Clientes usa `useClients` para a lista, a pesquisa e a paginação. As consultas reutilizam o carregamento, o cancelamento e a nova tentativa de `useAsyncData`. Os serviços escolhem a amostra ou a API REST conforme a configuração de ambiente. O estabelecimento “Chaveiro Horizonte” e os registros da amostra são fictícios.

### Redesign premium — fases 1 a 3

A auditoria no Edge cobriu a landing page, o Dashboard, os oito módulos e a tela de sessão. A apresentação anterior dava o mesmo peso aos três cartões e descrevia como previstos alguns recursos já integrados. No painel, cores de bordas, campos e feedback se repetiam em folhas de estilo diferentes. Dashboard e módulos que dependem da API ainda precisam de um trabalho próprio de composição e navegação.

- **Identidade.** Grafite e branco gelo dão base à interface. O azul orienta as ações, e a chave ocupa uma bancada de inspeção escura com retícula discreta. Space Grotesk organiza os títulos e Inter organiza os textos e controles. As duas fontes variáveis são servidas localmente. [Space Grotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk) · [Inter](https://github.com/google/fonts/tree/main/ofl/inter)
- **Design System.** `src/design-system.css` define superfícies, texto, bordas, foco, ação, espaçamento, raios, elevação e cores semânticas. O tema inicial segue o sistema e a escolha é salva no navegador. `ThemeToggle` está na landing, na sessão e no painel. A base foi aplicada a botões, campos, tabelas, diálogo de registro, menu lateral móvel, indicadores de status e mensagens. `DataState` oferece skeleton, nova tentativa e estado vazio.
- **Landing page.** O hero assimétrico abre a narrativa do atendimento à entrega. A grade dá destaque a Clientes e Solicitações, distingue os módulos disponíveis via API e identifica Visitas e Estoque como planejados. A prévia usa os dados de demonstração já existentes e três abas operáveis por teclado. Os títulos, links, estados e controles preservam foco visível e respeitam a preferência de movimento reduzido. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- **Chave 3D.** A iluminação usa reflexos mais definidos e um metal com rugosidade ajustada. A rotação responde de forma amortecida ao cursor e mantém pausa, retomada, carregamento sob demanda e a imagem WebP quando a renderização está indisponível.

| Área | Arquivos principais |
| --- | --- |
| Tokens, tipografia e temas | `src/design-system.css`, `src/index.css`, `src/theme.ts`, `src/main.tsx`, `src/components/ui/ThemeToggle.tsx`, `public/fonts/` e `index.html`. |
| Apresentação pública | `src/pages/Landing/{LandingPage,PanelPreview}.tsx`, `src/pages/Landing/landing.css`, `src/components/layout/LandingHeader.tsx` e `src/routes/routes.ts`. |
| Cena | `src/components/3d/{KeyShowcase,KeyScene}.tsx`. |
| Aplicação dos padrões | `src/App.css`, layouts de painel, sessão e menu móvel, `src/components/ui/{DataState,Icon}.tsx`, `src/components/ui/modal.css`, estilos e feedback de Clientes, Solicitações e Painel. |

**Verificação.** Build e lint do front-end passaram. Os 11 testes de validação e PostgreSQL e a suíte HTTP passaram. O build integrado foi exercitado no Edge com dados sintéticos, sessão em cookie, cadastro confirmado por consulta SQL e restrição de técnico validada pela API. A landing e as nove telas do painel foram verificadas de 360 a 1920 px. O axe não apontou violações nas quatro vistas verificadas. O teste WebGL cobriu pausa, retomada, perda de contexto e movimento reduzido. O build ainda sinaliza o tamanho do arquivo 3D, de aproximadamente 266 kB com gzip, carregado sob demanda.

As próximas fases abrangem a estrutura do painel e a navegação, o Dashboard operacional, o redesenho dos módulos, a experiência de login e as validações finais. A homologação do Supabase depende das informações do ambiente remoto.

### Etapas anteriores

- Etapas 1 e 2. Landing page, cena 3D e navegação dos módulos. Os testes anteriores no Chrome cobriram navegação por teclado, menu móvel, pausa, movimento reduzido e perda de WebGL.
- Etapa 3. Dashboard com gráficos, lista e paginação. Os testes da demonstração cobriram busca, filtros e estados de carregamento, erro e lista vazia.
- Etapa 4. Cadastro e consulta de clientes, edição em diálogo e validação de campos. Na demonstração, endereço, WhatsApp e observações fazem parte do formulário.
- Etapa 5. Cadastro, consulta e edição de solicitações de demonstração, com origens e status da amostra, página de seis registros e links diretos no Dashboard. A correção da landing page permitiu a quebra do título em larguras menores.
