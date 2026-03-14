import TxVolume from "../charts/TxVolume"
import Wallets from "../charts/Wallets"

type Props = {
  chainID: string
}

const Charts = ({ chainID }: Props) => {
  const supportsLegacyTerraCharts = chainID === "columbus-5"

  if (!supportsLegacyTerraCharts) return null

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(320px, 520px) minmax(320px, 520px)",
        gap: 20,
        justifyContent: "start",
        alignItems: "start",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <TxVolume chainID={chainID} />
      </div>

      <div style={{ width: "100%", maxWidth: 520 }}>
        <Wallets chainID={chainID} />
      </div>
    </div>
  )
}

export default Charts
