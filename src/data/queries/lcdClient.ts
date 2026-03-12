import { useMemo } from "react"
import { LCDClient as InterchainLCDClient } from "@terra-money/feather.js"
import { LCDClient } from "@terra-money/terra.js"
import { useChainID, useNetwork } from "data/wallet"

export const useInterchainLCDClient = () => {
  const network = useNetwork()

  const lcdClient = useMemo(() => {
    return new InterchainLCDClient(network)
  }, [network])

  return lcdClient
}

export const useLCDClient = () => {
  const network = useNetwork()
  const chainID = useChainID()

  const lcdClient = useMemo(() => {
    const selected =
      (chainID && network?.[chainID]) ||
      Object.values(network ?? {}).find((item) => {
        return (
          !!item &&
          typeof item === "object" &&
          "lcd" in item &&
          typeof item.lcd === "string" &&
          !!item.lcd
        )
      })

    if (!selected || typeof selected.lcd !== "string") {
      throw new Error("No valid LCD network configuration found")
    }

    return new LCDClient({
      ...selected,
      URL: selected.lcd,
    })
  }, [network, chainID])

  return lcdClient
}
