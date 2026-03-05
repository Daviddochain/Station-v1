// src/app/InitNetworks.tsx

import { PropsWithChildren, useEffect, useState } from "react"
import axios from "axios"
import { STATION_ASSETS } from "config/constants"
import createContext from "utils/createContext"
import { useCustomLCDs } from "utils/localStorage"
import { useValidNetworks } from "data/queries/tendermint"
import { WithFetching } from "components/feedback"
import { combineState } from "data/query"
import { InterchainNetworks } from "types/network"

// Simple LCD proxy helper
// IMPORTANT: disabled by default because /lcd/* does not exist on localhost:3000
const withLcdProxy = (chainID: string, rawLcd?: string) => {
  if (!rawLcd) return rawLcd

  // If already relative, leave it
  if (rawLcd.startsWith("/")) return rawLcd

  // ✅ Default: do NOT proxy (prevents /lcd/... 404 spam)
  // Enable only if you actually have a working proxy endpoint.
  const useProxy =
    process.env.REACT_APP_USE_LCD_PROXY === "true" ||
    process.env.REACT_APP_USE_LCD_PROXY === "1"

  if (!useProxy) return rawLcd

  // If you later add a real proxy endpoint, enable it via env var
  return `/lcd/${chainID}?url=${encodeURIComponent(rawLcd)}`
}

type TokenFilter = <T>(network: Record<string, T>) => Record<string, T>

export const [useNetworks, NetworksProvider] = createContext<{
  networks: InterchainNetworks
  filterEnabledNetworks: TokenFilter
  filterDisabledNetworks: TokenFilter
  networksLoading: boolean
}>("useNetworks")

const InitNetworks = ({ children }: PropsWithChildren<{}>) => {
  const [networks, setNetworks] = useState<InterchainNetworks>()
  const { customLCDs } = useCustomLCDs()

  useEffect(() => {
    const fetchChains = async () => {
      const { data: chains } = await axios.get<InterchainNetworks>(
        "/chains.json",
        {
          baseURL: STATION_ASSETS,
        },
      )

      if (chains?.mainnet?.["noble-1"]) {
        delete chains.mainnet["noble-1"]
      }

      setNetworks(chains)
    }

    fetchChains()
  }, [])

  const testBase = networks
    ? Object.values({
        ...(networks.mainnet ?? {}),
        ...(networks.testnet ?? {}),
        ...(networks.classic ?? {}),
        ...(networks.localterra ?? {}),
      }).map((chain) => {
        const rawLcd = customLCDs?.[chain?.chainID] ?? chain.lcd
        const lcd = withLcdProxy(chain.chainID, rawLcd)
        return { ...chain, lcd }
      })
    : []

  const validationResult = useValidNetworks(testBase)

  const validNetworks = validationResult.reduce(
    (acc, { data }) => (data ? [...acc, data] : acc),
    [] as string[],
  )

  const validationState = combineState(...validationResult)

  if (!networks) return null

  return (
    <WithFetching {...validationState} height={2}>
      {(progress) => (
        <NetworksProvider
          value={{
            networks,
            networksLoading: validationState.isLoading,
            filterEnabledNetworks: (networks) =>
              Object.fromEntries(
                Object.entries(networks ?? {}).filter(
                  ([chainID]) =>
                    chainID === "localterra" || validNetworks.includes(chainID),
                ) ?? {},
              ),
            filterDisabledNetworks: (networks) =>
              Object.fromEntries(
                Object.entries(networks ?? {}).filter(
                  ([chainID]) => !validNetworks.includes(chainID),
                ) ?? {},
              ),
          }}
        >
          {progress}
          {children}
        </NetworksProvider>
      )}
    </WithFetching>
  )
}

export default InitNetworks
