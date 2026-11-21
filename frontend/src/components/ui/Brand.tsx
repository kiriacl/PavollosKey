export function Brand() {
  return (
    <a className="brand" href="#inicio" aria-label="PávollosKeys, página inicial">
      <img src={import.meta.env.BASE_URL + 'favicon.svg'} width="38" height="38" alt="" />
      <span>
        Pávollos<span className="brand-accent">Keys</span>
      </span>
    </a>
  )
}
