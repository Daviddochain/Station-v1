import { useMemo } from "react"
import styles from "./NetworkHeader.module.scss"
import { useNetworks } from "app/InitNetworks"
import { useSelectedDisplayChain } from "utils/localStorage"

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

  const label = selectedNetwork?.name ?? "Classic"

  return <div className={styles.badge}>{label}</div>
}

export default NetworkHeader
