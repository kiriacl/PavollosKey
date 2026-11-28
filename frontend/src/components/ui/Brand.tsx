import { productName, wordmark } from '../../brand'

export function Brand() {
  return (
    <a className="brand" href="#inicio" aria-label={`${productName}, página inicial`}>
      <img src={import.meta.env.BASE_URL + 'favicon.svg'} width="38" height="38" alt="" />
      <span>
        {wordmark.name}<span className="brand-accent">{wordmark.accent}</span>
      </span>
    </a>
  )
}
