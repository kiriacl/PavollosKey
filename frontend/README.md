# PávollosKeys

Front-end acadêmico baseado no Chaveiro Fácil. O botão **Acessar sistema**, na landing page, abre o Dashboard administrativo da Etapa 3. A visão geral reúne indicadores, gráficos, solicitações recentes e atalhos para os oito módulos da interface inicial.

## Executar no PowerShell

Com as dependências já instaladas, execute o comando abaixo na raiz `PavollosKey` e abra o endereço local exibido pelo Vite. O ambiente usado para verificação tem Node.js 24 e npm 11.

```powershell
npm.cmd --prefix frontend run dev
```

Em uma cópia nova, instale primeiro as duas árvores de dependências existentes no projeto.

```powershell
npm.cmd ci
npm.cmd --prefix frontend ci
```

A raiz contém Tailwind e as bibliotecas 3D. A pasta `frontend` contém a aplicação React, o TypeScript, o Vite e o ESLint. O Vite resolve uma única cópia do React para a interface e para a cena. A fonte DM Sans, sua licença e os recursos visuais são distribuídos com o projeto.

| Comando executado na raiz | Resultado |
| --- | --- |
| `npm.cmd --prefix frontend run dev` | Inicia o ambiente de desenvolvimento. Abra `/` para a apresentação ou `/#/painel` para o painel. |
| `npm.cmd --prefix frontend run lint` | Verifica o código com as regras existentes do ESLint. |
| `npm.cmd --prefix frontend run build` | Verifica os tipos e gera a versão de produção em `frontend/dist`. |
| `npm.cmd --prefix frontend run preview` | Serve o último build localmente. |

O manifesto atual oferece esses quatro scripts. O build e o lint passaram. O Vite sinaliza o tamanho do arquivo opcional da cena 3D, cerca de 266 kB com gzip. A interface inicial e a alternativa estática carregam separadamente.

Nas Etapas 1 e 2, a verificação no Chrome cobriu os oito módulos, links diretos, histórico do navegador, menus móveis, navegação por teclado, pausa da animação e alternativas para redução de movimento, pouca memória e perda de WebGL. A auditoria automatizada com axe não apontou violações nas quatro vistas examinadas da apresentação e do painel.

Na Etapa 3, a verificação no Chrome cobriu indicadores, gráficos, filtros, pesquisa, paginação e navegação por teclado em larguras de 280 a 1440 px. Foram revisados a landing page, a pausa e a retomada da animação, a imagem com movimento reduzido e os oito módulos. Respostas HTTP simuladas cobriram carregamento, falha, nova tentativa, data inválida, lista vazia e sucesso. O axe não apontou violações nas vistas testadas do Dashboard em computador e celular e nos estados de erro e lista vazia.

## Como o front-end funciona

**Navegação.** `src/App.tsx` lê o fragmento do endereço e usa a tabela em `src/routes/routes.ts` para escolher a tela. Links como `/#/painel/clientes` funcionam ao recarregar a página e com os controles de histórico do navegador. O menu, os atalhos e a página de cada módulo usam a mesma definição de título, ícone e escopo. O acesso direto ao painel é provisório, até a definição da autenticação.

**Interface.** A landing page tem navegação por seção, apresentação da chave e links para os módulos. O painel reutiliza a barra de navegação em um menu modal nas telas menores. Há link para pular ao conteúdo, indicação da página atual, foco no título ao navegar e fechamento do menu com Escape. Os componentes visuais e as páginas são funções React.

**Cena 3D.** Os contornos da lâmina e da cabeça da chave são extrudados com Three.js. React Three Fiber exibe as peças. Drei fornece a flutuação e as luzes do estúdio. A cena responde ao ponteiro e permite pausar e retomar a animação. O código 3D fica em um arquivo carregado sob demanda quando a figura entra na área visível. A renderização contínua pausa fora da tela e em abas ocultas.

**Alternativa estática.** Uma imagem WebP do mesmo modelo ocupa o espaço da cena durante o carregamento, com redução de movimento, economia de dados, até dois processadores lógicos, até 2 GB de memória informada ou WebGL 2 indisponível. Uma falha no módulo 3D ou a perda do contexto gráfico também ativa a imagem. A pequena classe `SceneBoundary` implementa a barreira de erro do React que isola a cena.

**Dados.** A visão geral usa `useDashboard` para os dados administrativos e `usePanelContext` para os atalhos. Os dois hooks reutilizam o carregamento, o cancelamento e a nova tentativa de `useAsyncData`. Os serviços escolhem entre os mocks e a API REST e validam as respostas HTTP. Cada consulta tem seu próprio estado. O estabelecimento “Chaveiro Horizonte” e os registros da amostra são fictícios. As outras páginas apresentam o escopo proposto de cada módulo.

## Dashboard administrativo da Etapa 3

- Os cinco indicadores contam o total de solicitações, as solicitações pendentes, os serviços em andamento, as visitas agendadas e os serviços concluídos. A amostra exibe, respectivamente, **15, 4, 4, 3 e 5**.
- O gráfico por status agrupa todas as solicitações recebidas pela interface. A evolução apresenta seis meses consecutivos e termina no mês da solicitação mais recente. Meses sem solicitações aparecem com zero. Na amostra, o intervalo vai de junho a novembro de 2026.
- A lista mostra cliente, tipo de serviço, data, origem e status. Exibe as solicitações da mais recente para a mais antiga, em páginas de seis itens. A pesquisa por nome aceita nomes digitados sem acentos e combina com o filtro por status. Os filtros afetam a lista.
- O painel identifica a amostra com **Dados de demonstração**. Há feedback para carregamento, falha com nova tentativa, ausência de registros e busca sem correspondências. A lista adapta as colunas para fichas em telas estreitas, com os mesmos campos.

### Estrutura dos mocks

`src/mocks/dashboard.ts` exporta `demoDashboard`, tipado em `src/types/dashboard.ts`. As coleções representam entidades independentes nesta prévia. Seus IDs são únicos dentro de cada coleção e os estados abaixo descrevem o contrato provisório.

| Coleção | Campos | Estados provisórios |
| --- | --- | --- |
| `solicitacoes` | `id`, `cliente`, `tipoServico`, `dataSolicitacao`, `origem`, `status` | `pendente`, `em_atendimento`, `resolvida`, `cancelada` |
| `servicos` | `id`, `status` | `aguardando`, `em_andamento`, `concluido` |
| `visitas` | `id`, `status` | `agendada`, `realizada`, `cancelada` |

As datas das solicitações são datas civis em `AAAA-MM-DD`. `cliente`, `tipoServico` e `origem` são textos de exibição. Os serviços em andamento e concluídos são contados na coleção `servicos`. As visitas agendadas são contadas na coleção `visitas`, pelo status `agendada`. Cada coleção aceita uma lista vazia.

## Contrato HTTP provisório

Por padrão, `VITE_API_BASE_URL` fica vazia e o painel lê `src/mocks/panel.ts` e `src/mocks/dashboard.ts`. Para experimentar um servidor de teste, copie `.env.example` para `.env.local` dentro de `frontend`, informe a base e reinicie o Vite. A variável é pública. Um exemplo de valor é `/api`, quando o servidor atende na mesma origem.

| Operação proposta | Caminho relativo à base | Resposta esperada |
| --- | --- | --- |
| Carregar o contexto de apresentação do painel | `GET /painel/contexto` | Um nome de estabelecimento e uma lista ordenada de IDs de atalhos. |
| Carregar os dados administrativos | `GET /painel/dashboard` | Um objeto com as listas `solicitacoes`, `servicos` e `visitas`, no formato da tabela acima. |

```json
{
  "estabelecimento": "Chaveiro Horizonte",
  "atalhos": ["clientes", "solicitacoes", "visitas", "orcamentos", "servicos", "estoque"]
}
```

`atalhos` aceita também `historico` e `configuracoes`. Uma lista vazia mostra uma orientação para usar o menu. IDs repetidos aparecem uma vez. Falha de rede, erro HTTP ou resposta incompatível exibem a ação **Tentar novamente**. Os atalhos representam apenas navegação. A autorização das operações cabe ao back-end.

### Decisões a validar com o back-end

- Confirmar os endpoints de contexto e do Dashboard, os campos, o formato das respostas de erro e os estados de solicitações, serviços e visitas.
- Acordar como calcular os indicadores quando a API usar paginação, quais registros entram nas contagens e qual fuso e período usar na evolução. A prévia calcula os totais a partir das coleções recebidas.
- Definir a rota e o contrato de consulta de uma solicitação individual para habilitar a ação de detalhes na lista.
- Definir o fluxo de entrada, a sessão, as permissões e a política de acesso entre origens.
- Acordar como a API fornecerá valores monetários, taxas de deslocamento, aprovações e totais definitivos. A interface deverá exibir os valores fornecidos pelo back-end.
- Definir os dados de visitas, movimentações de estoque, estabelecimento e preferências. O atendimento automatizado via WhatsApp e n8n deverá conversar com o back-end.

## Arquivos da Etapa 3

| Situação | Arquivos | Finalidade |
| --- | --- | --- |
| Modificados e criados | `src/pages/Painel/PanelPages.tsx`, `src/pages/Painel/dashboard.css`, `src/components/layout/PanelLayout.tsx`, `src/App.css` | Composição da visão geral, layout responsivo e identificação da amostra. |
| Criados | `src/components/dashboard/DashboardIndicators.tsx`, `DashboardCharts.tsx`, `RecentRequests.tsx`, `requestStatusLabels.ts`, na mesma pasta | Indicadores, gráficos, lista, controles de pesquisa e rótulos de status. |
| Criados e modificados | `src/components/ui/DataState.tsx`, `src/components/ui/Icon.tsx` | Feedback reutilizável e ícones do Dashboard. |
| Criados e modificados | `src/hooks/useDashboard.ts`, `src/hooks/useRecentRequests.ts`, `src/hooks/useAsyncData.ts`, `src/hooks/usePanelContext.ts` | Consulta, cálculo dos indicadores e gráficos, pesquisa, filtro, paginação e estado assíncrono compartilhado. |
| Criados e modificados | `src/types/dashboard.ts`, `src/mocks/dashboard.ts`, `src/services/dashboard.ts`, `src/services/http.ts` | Contrato provisório, dados de demonstração, validação e acesso HTTP. |

## Arquivos das Etapas 1 e 2

Caminhos relativos a `frontend/`.

| Situação | Arquivos | Finalidade |
| --- | --- | --- |
| Modificados | `index.html`, `public/favicon.svg`, `src/App.tsx`, `src/index.css`, `src/App.css` | Idioma, identidade, navegação, tema e layouts responsivos. |
| Modificados | `vite.config.ts`, `README.md` | Resolução das dependências compartilhadas e guia desta versão. |
| Criados | `.env.example`, `src/services/http.ts`, `src/services/panel.ts` | Seleção da fonte, rota provisória, cliente HTTP e leitura do contexto. |
| Criados | `src/types/panel.ts`, `src/types/three-jsx.d.ts`, `src/mocks/panel.ts`, `src/routes/routes.ts` | Tipos de dados e JSX, amostra fictícia e catálogo de navegação. |
| Criados | `src/hooks/usePanelContext.ts`, `src/hooks/useSceneAvailability.ts` | Estado das consultas e condições para ativar a cena. |
| Criados | `src/components/layout/LandingHeader.tsx`, `src/components/layout/MobileMenu.tsx`, `src/components/layout/PanelLayout.tsx` | Cabeçalho, menu para telas pequenas e estrutura compartilhada do painel. |
| Criados | `src/components/ui/Brand.tsx`, `src/components/ui/Icon.tsx`, `src/components/ui/AreaCard.tsx`, `src/components/ui/StatusLabel.tsx` | Marca, ícones, cartões de áreas e indicadores usados nas páginas. |
| Criados | `src/components/3d/keyShapes.ts`, `src/components/3d/KeyScene.tsx`, `src/components/3d/KeyShowcase.tsx`, `public/key-preview.webp` | Geometrias da chave, iluminação, animação e imagem alternativa. |
| Criados | `src/pages/Landing/LandingPage.tsx`, `src/pages/Painel/PanelPages.tsx` | Apresentação, visão geral e página reutilizada para os módulos propostos. |
| Criados | `public/fonts/dm-sans-latin.woff2`, `public/fonts/OFL.txt` | Fonte local e licença de distribuição. |
