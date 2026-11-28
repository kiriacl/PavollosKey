# Pávolloskeys — Front-end

A interface usa React, TypeScript e Vite. A landing page conta a jornada de um atendimento e abre o painel em `/#/painel`. O painel integrado usa a API Next.js e oferece um modo de demonstração com dados fictícios.

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

**Interface.** A landing page tem navegação por capítulo, uma jornada acessível por controles manuais e uma prévia do produto com abas. O painel reutiliza a barra de navegação em um menu modal nas telas menores. Há link para pular ao conteúdo, indicação da página atual, foco no título ao navegar e fechamento do menu com Escape.

**Movimento.** A página revela as demandas e as reúne em uma fila com animações CSS vinculadas à rolagem quando o navegador oferece suporte. Em telas amplas e altas, o painel de jornada acompanha a etapa sob o centro da janela. A rolagem continua nativa e os botões também permitem escolher uma etapa. Em telas estreitas ou baixas, a jornada usa navegação compacta. Com movimento reduzido, os mesmos registros são apresentados estaticamente.

**Dados.** A visão geral usa `useDashboard` para os dados administrativos e `usePanelContext` para os atalhos. O módulo de Clientes usa `useClients` para a lista, a pesquisa e a paginação. As consultas reutilizam o carregamento, o cancelamento e a nova tentativa de `useAsyncData`. Os serviços escolhem a amostra ou a API REST conforme a configuração de ambiente. O estabelecimento “Chaveiro Horizonte” e os registros da amostra são fictícios.

### Redesign conceitual da landing

**Auditoria.** Na captura da versão anterior, a chave predominava na primeira dobra e a prévia do produto só aparecia depois dos blocos de funcionalidades. A grade deixava pouco contexto sobre como as demandas se relacionavam. A versão atual traz a interface para o hero e reapresenta os mesmos quatro chamados dispersos como registros organizados na fila da oficina.

**Direção editorial.** Papel claro, grafite esverdeado e um acento de alta visibilidade distinguem a landing. A tipografia Space Grotesk e Inter e o tema existente foram reutilizados. O símbolo PK foi redesenhado em vetor e passou a compartilhar o mesmo recurso de marca com o favicon. A composição alterna um quadro de atividade, uma fila alinhada, uma ficha que acompanha a rolagem e capturas das telas reais. Referências de apresentação de produto e progressão visual. [Linear](https://linear.app/) · [Stripe](https://stripe.com/) · [Apple](https://www.apple.com/macbook-air/) · [Framer](https://www.framer.com/)

**Jornada e dados.** A abertura residencial de Mariana passa por oito etapas. Mensagens e ligações são ilustrativas, e o registro é feito pela equipe. Os indicadores e gráficos da prévia são calculados sobre as amostras existentes. As abas de orçamento, ordem e histórico exibem registros fictícios e identificam a necessidade da API para operá-los. Visitas e Estoque aparecem como planejados. As seis abas têm seleção por teclado, com setas, Home e End. [Padrão de abas do W3C](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)

| Área | Arquivos principais |
| --- | --- |
| Roteiro e navegação pública | `src/pages/Landing/LandingPage.tsx`, `src/pages/Landing/story.ts`, `src/pages/Landing/landing.css` e `src/routes/routes.ts`. |
| Jornada e prévia | `src/pages/Landing/ServiceJourney.tsx` e `src/pages/Landing/PanelPreview.tsx`. |
| Marca e capturas | `src/assets/pk-mark.svg`, `src/components/ui/Brand.tsx`, `src/components/ui/Icon.tsx`, `index.html` e `public/demo-{desktop,mobile}.webp`. |
| Limpeza do 3D | Manifesto e lockfile da raiz, `vite.config.ts`, componentes da cena, tipagem JSX, detecção de WebGL e poster. A versão com a chave está preservada no commit `5724f47`. |

**Verificação.** Build, lint, os 11 testes de validação e PostgreSQL e a suíte HTTP passaram. No Edge, a landing foi verificada em 360, 390, 768, 1024, 1440 e 1920 px. A checagem cobriu rolagem nativa, avanço manual e automático na jornada, teclado, menu móvel, temas, movimento reduzido, imagens e links para o painel. O axe não apontou violações nas três vistas avaliadas. Com o build servido na mesma origem que a API local de teste, foram conferidos login, cookie HttpOnly, restrição de técnico e logout. O pacote 3D opcional, de cerca de 266 kB com gzip na versão anterior, saiu do build. As duas capturas WebP somam aproximadamente 101 kB e carregam sob demanda.

### Etapas anteriores

- Etapas 1 e 2. Landing page, cena 3D e navegação dos módulos. Os testes anteriores no Chrome cobriram navegação por teclado, menu móvel, pausa, movimento reduzido e perda de WebGL.
- Etapa 3. Dashboard com gráficos, lista e paginação. Os testes da demonstração cobriram busca, filtros e estados de carregamento, erro e lista vazia.
- Etapa 4. Cadastro e consulta de clientes, edição em diálogo e validação de campos. Na demonstração, endereço, WhatsApp e observações fazem parte do formulário.
- Etapa 5. Cadastro, consulta e edição de solicitações de demonstração, com origens e status da amostra, página de seis registros e links diretos no Dashboard. A correção da landing page permitiu a quebra do título em larguras menores.
