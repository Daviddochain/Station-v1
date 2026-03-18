import { atom, useRecoilState, useRecoilValue } from "recoil"
import { useNetworks } from "app/InitNetworks"
import { getStoredNetwork, storeNetwork } from "../scripts/network"
import { useWallet, WalletStatus } from "@terra-money/wallet-kit"
import { walletState } from "../state/walletState"
import is from "../scripts/is"
import { useCustomLCDs } from "utils/localStorage"
import { ChainFeature } from "types/chains"
import { NetworkName, ChainID, InterchainNetwork } from "types/network"

const networkState = atom<NetworkName>({
  key: "network",
  default: getStoredNetwork(),
})

export const useNetworkState = () => {
  const [storedNetwork, setNetwork] = useRecoilState(networkState)

  const changeNetwork = (network: NetworkName) => {
    if (network !== storedNetwork) {
      setNetwork(network)
      storeNetwork(network)
    }
  }

  return [storedNetwork, changeNetwork] as const
}

/* helpers */
export const useNetworkOptions = () => {
  return [
    { value: "mainnet", label: "Mainnets" },
    { value: "testnet", label: "Testnets" },
    { value: "classic", label: "Terra Classic" },
    { value: "localterra", label: "LocalTerra" },
  ]
}

export const useNetworkWithFeature = (feature?: ChainFeature) => {
  const networks = useNetwork()
  if (!feature) return networks

  return Object.fromEntries(
    Object.entries(networks).filter(
      ([_, n]) =>
        !Array.isArray(n.disabledModules) ||
        !n.disabledModules.includes(feature),
    ),
  )
}

export const useNetwork = (): Record<ChainID, InterchainNetwork> => {
  const { networks, filterEnabledNetworks } = useNetworks()
  const [network, setNetwork] = useNetworkState()
  const wallet = useRecoilValue(walletState)
  const connectedWallet = useWallet()
  const { customLCDs } = useCustomLCDs()
  const useOverrideAssets = Boolean(process.env.REACT_APP_STATION_ASSETS)

  const walletWords = (wallet?.words ?? {}) as Record<
    string,
    string | undefined
  >

  function withCustomLCDs(
    networks: Record<ChainID, InterchainNetwork>,
  ): Record<ChainID, InterchainNetwork> {
    return Object.fromEntries(
      Object.entries(networks ?? {}).map(([key, val]) => [
        key,
        { ...val, lcd: customLCDs[val?.chainID] || val.lcd },
      ]),
    )
  }

  function getSelectedNetworks(): Record<ChainID, InterchainNetwork> {
    return withCustomLCDs(
      (networks[network as NetworkName] as Record<
        ChainID,
        InterchainNetwork
      >) ?? {},
    )
  }

  if (useOverrideAssets) {
    return getSelectedNetworks()
  }

  // check connected wallet
  if (connectedWallet.status === WalletStatus.CONNECTED) {
    const connectedChains = Object.keys(
      (connectedWallet.network ?? {}) as Record<string, unknown>,
    )

    if (network !== "mainnet" && connectedChains.includes("phoenix-1")) {
      setNetwork("mainnet")
    } else if (network !== "testnet" && connectedChains.includes("pisco-1")) {
      setNetwork("testnet")
    } else if (
      network !== "classic" &&
      connectedChains.includes("columbus-5")
    ) {
      setNetwork("classic")
    } else if (
      network !== "localterra" &&
      connectedChains.includes("localterra")
    ) {
      setNetwork("localterra")
    }

    return filterEnabledNetworks(getSelectedNetworks())
  }

  // multisig wallet are supported only on terra
  if (is.multisig(wallet)) {
    const terra = Object.values(getSelectedNetworks() ?? {}).find(
      ({ prefix }) => prefix === "terra",
    )

    if (!terra) return {}

    return filterEnabledNetworks({ [terra.chainID]: terra })
  }

  if (wallet) {
    const enabledChains = Object.values(getSelectedNetworks() ?? {}).filter(
      ({ coinType }) => !!walletWords[String(coinType)],
    )

    return filterEnabledNetworks(
      enabledChains.reduce(
        (acc, chain) => {
          acc[chain.chainID] = chain
          return acc
        },
        {} as Record<ChainID, InterchainNetwork>,
      ),
    )
  }

  return filterEnabledNetworks(getSelectedNetworks())
}

export const useNetworkName = () => {
  const network = useRecoilValue(networkState)
  return network
}

export const useChainID = () => {
  const network = useRecoilValue(networkState)
  const connectedWallet = useWallet()

  if (connectedWallet.status === WalletStatus.CONNECTED) {
    const connectedChains = Object.keys(
      (connectedWallet.network ?? {}) as Record<string, unknown>,
    )

    if (network === "mainnet") {
      if (connectedChains.length > 0) return connectedChains[0] as ChainID
      return "phoenix-1"
    }

    if (network === "testnet") {
      if (connectedChains.length > 0) return connectedChains[0] as ChainID
      return "pisco-1"
    }

    if (network === "classic") {
      if (connectedChains.includes("columbus-5")) return "columbus-5"
      if (connectedChains.length > 0) return connectedChains[0] as ChainID
      return "columbus-5"
    }

    if (network === "localterra") {
      if (connectedChains.includes("localterra")) return "localterra"
      if (connectedChains.length > 0) return connectedChains[0] as ChainID
      return "localterra"
    }

    // ✅ NEW: support any custom chains like Dungeon automatically
    if (connectedChains.length > 0) {
      return connectedChains[0] as ChainID
    }
  }

  switch (network) {
    case "mainnet":
      return "phoenix-1"
    case "testnet":
      return "pisco-1"
    case "classic":
      return "columbus-5"
    case "localterra":
      return "localterra"
    default:
      return ""
  }
}
