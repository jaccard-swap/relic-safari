import './Loading.css'

export function Loading() {
  return (
    <div className="loading-container">
      <div className="loading-logo">
        <img src="/image.jpg" alt="Relic Safari" />
        <div className="loading-glow" />
      </div>
      <div className="loading-text">
        <span>Unearthing relics</span>
        <span className="loading-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>
    </div>
  )
}
