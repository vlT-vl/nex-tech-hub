import vltcube from '../../res/vltcube.svg'

const VltLogo = ({ size = '1.42rem', staticExpanded = false }) => (
  <div
    className={`vlt-logo${staticExpanded ? ' vlt-logo--static' : ''}`}
    style={{ '--cube-w': size }}
  >
    <img className="vlt-cube" src={vltcube} alt="vlT" />
    <span className="vlt-text">vlT</span>
  </div>
)

export default VltLogo
