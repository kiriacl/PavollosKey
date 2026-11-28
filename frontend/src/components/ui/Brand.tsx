import { productName, wordmark } from '../../brand'
import mark from '../../assets/pk-mark.svg'

export function BrandMark() {
  return <img src={mark} width="38" height="38" alt="" />
}

export function Brand() {
  return (
    <a className="brand" href="#inicio" aria-label={`${productName}, página inicial`}>
      <BrandMark />
      <span>
        {wordmark.name}<span className="brand-accent">{wordmark.accent}</span>
      </span>
    </a>
  )
}
