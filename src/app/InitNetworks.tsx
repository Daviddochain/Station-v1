import { PropsWithChildren, useEffect, useState } from "react"
import axios from "axios"
import { STATION_ASSETS } from "config/constants"
import createContext from "utils/createContext"
import { useCustomLCDs } from "utils/localStorage"
import { useValidNetworks } from "data/queries/tendermint"
import { WithFetching } from "components/feedback"
import { combineState } from "data/query"
import { InterchainNetworks } from "types/network"

type TokenFilter = <T>(network: Record<string, T>) => Record<string, T>

export const [useNetworks, NetworksProvider] = createContext<{
  networks: InterchainNetworks
  filterEnabledNetworks: TokenFilter
  filterDisabledNetworks: TokenFilter
  networksLoading: boolean
}>("useNetworks")

const emptyNetworks: InterchainNetworks = {
  mainnet: {},
  testnet: {},
  classic: {},
  localterra: {},
}

const InitNetworks = ({ children }: PropsWithChildren<{}>) => {
  const [networks, setNetworks] = useState<InterchainNetworks>()
  const { customLCDs } = useCustomLCDs()

  useEffect(() => {
    const fetchChains = async () => {
      try {
        const response = await axios.get<InterchainNetworks>("/chains.json", {
          baseURL: STATION_ASSETS,
        })

        const chains = response?.data

        if (!chains) {
          console.error("chains.json returned no data", {
            baseURL: STATION_ASSETS,
          })
          setNetworks(emptyNetworks)
          return
        }

        // Ensure all network groups exist
        chains.mainnet = chains.mainnet || {}
        chains.testnet = chains.testnet || {}
        chains.classic = chains.classic || {}
        chains.localterra = chains.localterra || {}

        // REMOVE this restriction (breaks adding new chains like Dungeon)
        // if (chains?.mainnet?.["noble-1"]) {
        //   delete chains.mainnet["noble-1"]
        // }

        setNetworks(chains)
      } catch (error) {
        console.error("Failed to fetch chains.json", {
          error,
          baseURL: STATION_ASSETS,
          url: "/chains.json",
        })
        setNetworks(emptyNetworks)
      }
    }

    fetchChains()
  }, [customLCDs])

  const testBase = networks
    ? Object.values({
        ...(networks.mainnet || {}),
        ...(networks.testnet || {}),
        ...(networks.classic || {}),
        ...(networks.localterra || {}),
      }).map((chain) => {
        const lcd = customLCDs[chain?.chainID] ?? chain.lcd
        return { ...chain, lcd }
      })
    : []

  const validationResult = useValidNetworks(testBase) ?? []

  const validNetworks = validationResult.reduce((acc, item) => {
    const data = item?.data
    return data ? [...acc, data] : acc
  }, [] as string[])

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
                ),
              ),
            filterDisabledNetworks: (networks) =>
              Object.fromEntries(
                Object.entries(networks ?? {}).filter(
                  ([chainID]) => !validNetworks.includes(chainID),
                ),
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
