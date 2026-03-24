import { useMemo } from "react"
import { useNetworks } from "app/InitNetworks"
import { useSelectedDisplayChain } from "utils/localStorage"
import SettingsSelector from "components/layout/SettingsSelector"

const CHAIN_ORDER = ["columbus-5", "phoenix-1", "dungeon-1"]

const CHAIN_LABELS: Record<string, string> = {
  "columbus-5": "LUNC",
  "phoenix-1": "LUNA",
  "dungeon-1": "Dungeon",
}

const NetworkSetting = () => {
  const { networks } = useNetworks()
  const { selectedDisplayChain, changeSelectedDisplayChain } =
    useSelectedDisplayChain()

  const allNetworks = useMemo(
    () => ({
      ...(networks?.mainnet ?? {}),
      ...(networks?.classic ?? {}),
      ...(networks?.testnet ?? {}),
      ...(networks?.localterra ?? {}),
    }),
    [networks],
  )

  const networkOptions = useMemo(() => {
    return CHAIN_ORDER.map((chainID) => allNetworks[chainID])
      .filter(Boolean)
      .map((network) => ({
        value: network.chainID,
        label: CHAIN_LABELS[network.chainID] || network.name,
      }))
  }, [allNetworks])

  const value =
    selectedDisplayChain &&
    networkOptions.some((item) => item.value === selectedDisplayChain)
      ? selectedDisplayChain
      : (networkOptions[0]?.value ?? "")

  if (!networkOptions.length) return null

  return (
    <SettingsSelector
      options={networkOptions}
      value={value}
      onChange={changeSelectedDisplayChain}
    />
  )
}

export default NetworkSetting
