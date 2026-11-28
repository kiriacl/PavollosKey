import type { IconName } from '../../components/ui/Icon'

export const incoming = [
  { time: '08:12', title: 'Abertura residencial', person: 'Mariana Costa', source: 'WhatsApp', note: 'Fiquei do lado de fora. Você consegue vir hoje?', status: 'Recebido', icon: 'requests' },
  { time: '08:19', title: 'Cópia de chave', person: 'Rafael Almeida', source: 'Ligação', note: 'Precisando de uma chave reserva para o carro.', status: 'A confirmar', icon: 'phone' },
  { time: '08:34', title: 'Troca de fechadura', person: 'Camila Nogueira', source: 'Orçamento', note: 'A proposta saiu ontem. Falta confirmar o aceite.', status: 'Aguardando aceite', icon: 'quote' },
  { time: '08:47', title: 'Instalação de fechadura', person: 'João Mendes', source: 'Ordem de serviço', note: 'Equipe atribuída. A execução ainda não começou.', status: 'Atribuída', icon: 'tools' },
] satisfies ReadonlyArray<{ time: string; title: string; person: string; source: string; note: string; status: string; icon: IconName }>

interface StoryStep {
  title: string
  text: string
  screen: string
  status: string
  icon: IconName
  fields: ReadonlyArray<readonly [label: string, value: string]>
}

export const journey: readonly StoryStep[] = [
  {
    title: 'Receber a solicitação',
    text: 'Mariana ficou do lado de fora de casa e pediu ajuda pelo WhatsApp. Você registra o chamado.',
    screen: 'Solicitação registrada', status: 'Aberto', icon: 'requests',
    fields: [['Serviço solicitado', 'Abertura residencial'], ['Origem informada', 'WhatsApp'], ['Descrição', 'Cliente ficou do lado de fora e precisa de atendimento hoje.']],
  },
  {
    title: 'Identificar a cliente',
    text: 'Consulte o cadastro ou registre o contato. Os próximos passos ficam vinculados à mesma pessoa.',
    screen: 'Cadastro da cliente', status: 'Vinculada ao atendimento', icon: 'users',
    fields: [['Nome', 'Mariana Costa'], ['E-mail', 'mariana@example.com'], ['Atendimento', 'Abertura residencial']],
  },
  {
    title: 'Montar o orçamento',
    text: 'Inclua o serviço na cotação e confira o total antes de informar o valor à cliente.',
    screen: 'Orçamento · versão 1', status: 'Rascunho', icon: 'quote',
    fields: [['Item', 'Abertura de fechadura residencial'], ['Valor do item', 'R$ 120,00'], ['Total', 'R$ 120,00']],
  },
  {
    title: 'Registrar a aprovação',
    text: 'Depois de receber o aceite da cliente, registre a decisão e o canal em que ela respondeu.',
    screen: 'Decisão da cliente', status: 'Aprovado', icon: 'check',
    fields: [['Valor aprovado', 'R$ 120,00'], ['Canal de aceite', 'WhatsApp'], ['Evidência', 'Mariana confirmou o valor e autorizou a abertura.']],
  },
  {
    title: 'Gerar a ordem de serviço',
    text: 'Transforme o item aprovado em uma ordem com escopo e local da execução.',
    screen: 'Ordem de serviço', status: 'Aguardando atribuição', icon: 'tools',
    fields: [['Escopo', 'Abertura de fechadura residencial'], ['Local da execução', 'Residência da cliente'], ['Origem', 'Item aprovado no orçamento']],
  },
  {
    title: 'Atribuir e executar',
    text: 'Atribua a ordem. O técnico responsável inicia o serviço e registra o que encontrou.',
    screen: 'Execução da ordem', status: 'Em execução', icon: 'tools',
    fields: [['Técnico atribuído', 'André Ribeiro'], ['Cliente', 'Mariana Costa'], ['Observação', 'Fechadura inspecionada. Abertura em andamento.']],
  },
  {
    title: 'Concluir o serviço',
    text: 'Registre a conclusão da ordem e encerre o atendimento após resolver as pendências.',
    screen: 'Entrega do atendimento', status: 'Encerrado', icon: 'check',
    fields: [['Ordem de serviço', 'Concluída'], ['Resultado', 'Porta aberta e fechadura em funcionamento'], ['Atendimento', 'Encerrado após a entrega']],
  },
  {
    title: 'Consultar o histórico',
    text: 'Recupere o contexto do atendimento e veja os eventos registrados durante o serviço.',
    screen: 'Histórico do atendimento', status: 'Registro consultável', icon: 'history',
    fields: [['08:12', 'Solicitação registrada'], ['08:43', 'Aceite registrado'], ['10:04', 'Ordem concluída e atendimento encerrado']],
  },
]
