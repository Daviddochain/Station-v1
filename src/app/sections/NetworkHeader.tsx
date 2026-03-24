import { useMemo } from "react"
import styles from "./NetworkHeader.module.scss"
import { useNetworks } from "app/InitNetworks"
import { useSelectedDisplayChain } from "utils/localStorage"

const CHAIN_LABELS: Record<string, string> = {
  "columbus-5": "LUNC",
  "phoenix-1": "LUNA",
  "dungeon-1": "Dungeon",
}

const NetworkHeader = () => {
  const { networks } = useNetworks()
  const { selectedDisplayChain } = useSelectedDisplayChain()

  const allNetworks = useMemo(
    () => ({
      ...(networks?.classic ?? {}),
      ...(networks?.mainnet ?? {}),
      ...(networks?.testnet ?? {}),
      ...(networks?.localterra ?? {}),
    }),
    [networks],
  )

  const selectedNetwork = selectedDisplayChain
    ? allNetworks[selectedDisplayChain]
    : allNetworks["columbus-5"]

  const label =
    (selectedDisplayChain && CHAIN_LABELS[selectedDisplayChain]) ||
    selectedNetwork?.name ||
    "LUNC"

  return <div className={styles.badge}>{label}</div>
}

export default NetworkHeader
