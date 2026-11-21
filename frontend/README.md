# PávollosKeys

Front-end acadêmico baseado no Chaveiro Fácil. Esta entrega cobre a fundação e a interface inicial, correspondentes às Etapas 1 e 2. A landing page apresenta o projeto. O botão **Acessar sistema** abre uma prévia do painel, com atalhos fictícios e oito áreas navegáveis. Cada área descreve as funcionalidades propostas para desenvolvimento futuro.

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

No Chrome foram verificados os oito módulos, links diretos, histórico do navegador, menus móveis, navegação por teclado, pausa da animação e alternativas para redução de movimento, pouca memória e perda de WebGL. A auditoria automatizada com axe não apontou violações nas quatro vistas examinadas da apresentação e do painel. Respostas HTTP simuladas validaram carregamento, falha, nova tentativa, formato inválido, lista vazia e sucesso.

## Como o front-end funciona

**Navegação.** `src/App.tsx` lê o fragmento do endereço e usa a tabela em `src/routes/routes.ts` para escolher a tela. Links como `/#/painel/clientes` funcionam ao recarregar a página e com os controles de histórico do navegador. O menu, os atalhos e a página de cada módulo usam a mesma definição de título, ícone e escopo. O acesso direto ao painel é provisório, até a definição da autenticação.

**Interface.** A landing page tem navegação por seção, apresentação da chave e links para os módulos. O painel reutiliza a barra de navegação em um menu modal nas telas menores. Há link para pular ao conteúdo, indicação da página atual, foco no título ao navegar e fechamento do menu com Escape. Os componentes visuais e as páginas são funções React.

**Cena 3D.** Os contornos da lâmina e da cabeça da chave são extrudados com Three.js. React Three Fiber exibe as peças. Drei fornece a flutuação e as luzes do estúdio. A cena responde ao ponteiro e permite pausar e retomar a animação. O código 3D fica em um arquivo carregado sob demanda quando a figura entra na área visível. A renderização contínua pausa fora da tela e em abas ocultas.

**Alternativa estática.** Uma imagem WebP do mesmo modelo ocupa o espaço da cena durante o carregamento, com redução de movimento, economia de dados, até dois processadores lógicos, até 2 GB de memória informada ou WebGL 2 indisponível. Uma falha no módulo 3D ou a perda do contexto gráfico também ativa a imagem. A pequena classe `SceneBoundary` implementa a barreira de erro do React que isola a cena.

**Dados.** A visão geral chama `usePanelContext`. O hook cuida do carregamento, cancelamento e nova tentativa. O serviço `getPanelContext` escolhe a fonte, valida a resposta HTTP e devolve um `PanelContext` tipado. O componente apresenta o resultado, inclusive o caso de uma lista vazia. O estabelecimento “Chaveiro Horizonte” e seus atalhos são exemplos fictícios. As outras páginas apresentam o escopo proposto de cada módulo.

## Contrato HTTP provisório

Por padrão, `VITE_API_BASE_URL` fica vazia e o painel lê `src/mocks/panel.ts`. Para experimentar um servidor de teste, copie `.env.example` para `.env.local` dentro de `frontend`, informe a base e reinicie o Vite. A variável é pública. Um exemplo de valor é `/api`, quando o servidor atende na mesma origem.

| Operação proposta | Caminho relativo à base | Resposta esperada |
| --- | --- | --- |
| Carregar o contexto de apresentação do painel | `GET /painel/contexto` | Um nome de estabelecimento e uma lista ordenada de IDs de atalhos. |

```json
{
  "estabelecimento": "Chaveiro Horizonte",
  "atalhos": ["clientes", "solicitacoes", "visitas", "orcamentos", "servicos", "estoque"]
}
```

`atalhos` aceita também `historico` e `configuracoes`. Uma lista vazia mostra uma orientação para usar o menu. IDs repetidos aparecem uma vez. Falha de rede, erro HTTP ou resposta incompatível exibem a ação **Tentar novamente**. Os atalhos representam apenas navegação. A autorização das operações cabe ao back-end.

### Decisões a validar com o back-end

- Confirmar o endpoint de contexto, os nomes e tipos dos campos e o formato das respostas de erro. As rotas de domínio, a paginação, os filtros e os estados de solicitações e serviços também estão em aberto.
- Definir o fluxo de entrada, a sessão, as permissões e a política de acesso entre origens.
- Acordar como a API fornecerá valores monetários, taxas de deslocamento, aprovações e totais definitivos. A interface deverá exibir os valores fornecidos pelo back-end.
- Definir os dados de visitas, movimentações de estoque, estabelecimento e preferências. O atendimento automatizado via WhatsApp e n8n deverá conversar com o back-end.

## Arquivos desta entrega

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

## Próxima tarefa do Trello

**Etapa 3 — Dashboard com indicadores fictícios.** Alinhar com a equipe o significado de cada indicador e o formato dos dados. Depois, criar o mock de resumo e exibir solicitações, pendências, serviços em andamento e concluídos, visitas agendadas e o resumo financeiro. O cartão estará pronto quando as métricas estiverem identificadas como fictícias e os estados de carregamento, erro e ausência de dados estiverem verificados.
