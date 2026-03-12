import { useConnectedWallet } from "@terra-money/wallet-kit"
import { addressFromWords } from "utils/bech32"
import useAuth from "./useAuth"
import { useChainID, useNetwork, useNetworkWithFeature } from "./useNetwork"
import { ChainFeature } from "types/chains"
import { useRecoilValue } from "recoil"
import { walletState } from "../state/walletState"

type WalletWordsMap = Record<string, string | undefined>

/* current chain address: auth | wallet-provider */
const useAddress = () => {
  const connected = useConnectedWallet()
  const { wallet } = useAuth()
  const chainID = useChainID()
  const networks = useNetwork()
  const currentNetwork = networks?.[chainID]
  const words = (wallet?.words ?? {}) as WalletWordsMap

  if (connected?.addresses?.[chainID]) {
    return connected.addresses[chainID]
  }

  if (!currentNetwork) return undefined

  const coinTypeKey = String(currentNetwork.coinType)
  const seed = words[coinTypeKey]

  if (!seed) return undefined

  return addressFromWords(seed, currentNetwork.prefix)
}

export const useIsWalletConnected = () => {
  const connected = useConnectedWallet()
  return !!connected
}

export const useAllInterchainAddresses = () => {
  const connected = useConnectedWallet()
  const networks = useNetwork()
  const wallet = useRecoilValue(walletState)
  const words = (wallet?.words ?? {}) as WalletWordsMap

  const derivedAddresses = Object.values(networks ?? {}).reduce(
    (acc, { prefix, coinType, chainID }) => {
      const seed = words[String(coinType)]
      if (!seed) return acc

      acc[chainID] = addressFromWords(seed, prefix)
      return acc
    },
    {} as Record<string, string>,
  )

  if (connected?.addresses) {
    return {
      ...derivedAddresses,
      ...connected.addresses,
    }
  }

  return derivedAddresses
}

export const useInterchainAddresses = () => {
  const connected = useConnectedWallet()
  const networks = useNetwork()
  const wallet = useRecoilValue(walletState)
  const words = (wallet?.words ?? {}) as WalletWordsMap

  const derivedAddresses = Object.values(networks ?? {}).reduce(
    (acc, { prefix, coinType, chainID }) => {
      const seed = words[String(coinType)]
      if (!seed) return acc

      acc[chainID] = addressFromWords(seed, prefix)
      return acc
    },
    {} as Record<string, string>,
  )

  if (connected?.addresses) {
    return {
      ...derivedAddresses,
      ...connected.addresses,
    }
  }

  return derivedAddresses
}

export const useInterchainAddressesWithFeature = (feature?: ChainFeature) => {
  const addresses = useInterchainAddresses()
  const networks = useNetworkWithFeature(feature)

  return Object.fromEntries(
    Object.entries(addresses).filter(([key]) => !!networks[key]),
  )
}

export default useAddress
