import { useQuery } from "react-query"
import BigNumber from "bignumber.js"
import {
  AccAddress,
  Coin,
  Coins,
  Rewards,
  ValAddress,
  Validator,
} from "@terra-money/feather.js"
import { has } from "utils/num"
import { sortCoins } from "utils/coin"
import { queryKey, RefetchOptions } from "../query"
import { useAddress, useChainID } from "../wallet"
import { useInterchainLCDClient } from "./lcdClient"
import { CalcValue } from "./coingecko"
import { RewardsListing } from "data/types/rewards-form"
import { useInterchainAddressesWithFeature } from "auth/hooks/useAddress"
import { ChainFeature } from "types/chains"

export const useRewards = (chainID?: string) => {
  const addresses = useInterchainAddressesWithFeature(ChainFeature.STAKING)
  const lcd = useInterchainLCDClient()

  return useQuery(
    [queryKey.distribution.rewards, addresses, chainID],
    async () => {
      if (!addresses || !Object.keys(addresses).length) {
        return { total: new Coins(), rewards: {} }
      }

      if (chainID) {
        const address = addresses[chainID]
        if (!address) return { total: new Coins(), rewards: {} }

        try {
          return await lcd.distribution.rewards(address)
        } catch (error) {
          console.warn(`Failed to load rewards for ${chainID}`, error)
          return { total: new Coins(), rewards: {} }
        }
      }

      const entries = Object.entries(addresses)

      const results = await Promise.all(
        entries.map(async ([entryChainID, address]) => {
          try {
            const result = await lcd.distribution.rewards(address as string)
            return { chainID: entryChainID, result }
          } catch (error) {
            console.warn(`Failed to load rewards for ${entryChainID}`, error)
            return {
              chainID: entryChainID,
              result: { total: new Coins(), rewards: {} },
            }
          }
        }),
      )

      let total: Coin.Data[] = []
      let rewards = {}

      results.forEach(({ result }) => {
        total = [...total, ...result.total.toData()]
        rewards = { ...rewards, ...result.rewards }
      })

      return { total: Coins.fromData(total), rewards }
    },
    { ...RefetchOptions.DEFAULT },
  )
}

export const useCommunityPool = (chain?: string) => {
  const lcd = useInterchainLCDClient()
  const currentChainID = useChainID()
  const activeChain = chain ?? currentChainID

  return useQuery(
    [queryKey.distribution.communityPool, activeChain],
    async () => {
      if (!activeChain) return new Coins()

      try {
        return await lcd.distribution.communityPool(activeChain)
      } catch (error) {
        console.warn(`Failed to load community pool for ${activeChain}`, error)
        return new Coins()
      }
    },
    {
      ...RefetchOptions.INFINITY,
      enabled: !!activeChain,
    },
  )
}

/* commission */
// TODO: make interchain
export const useValidatorCommission = () => {
  const lcd = useInterchainLCDClient()
  const address = useAddress()

  return useQuery(
    [queryKey.distribution.validatorCommission, address],
    async () => {
      if (!address) return new Coins()

      const validatorAddress = ValAddress.fromAccAddress(
        address,
        AccAddress.getPrefix(address),
      )

      try {
        return await lcd.distribution.validatorCommission(validatorAddress)
      } catch (error) {
        console.warn(
          `Failed to load validator commission for ${address}`,
          error,
        )
        return new Coins()
      }
    },
    {
      ...RefetchOptions.DEFAULT,
      enabled: !!address,
    },
  )
}

// TODO: make interchain
export const useWithdrawAddress = () => {
  const lcd = useInterchainLCDClient()
  const address = useAddress()

  return useQuery(
    [queryKey.distribution.withdrawAddress, address],
    async () => {
      if (!address) return

      try {
        return await lcd.distribution.withdrawAddress(address)
      } catch (error) {
        console.warn(`Failed to load withdraw address for ${address}`, error)
        return
      }
    },
    {
      ...RefetchOptions.DEFAULT,
      enabled: !!address,
    },
  )
}

/* hooks */
export const getConnectedMoniker = (
  address?: string,
  validators?: Validator[],
) => {
  if (!(address && validators)) return

  const validatorAddress = ValAddress.fromAccAddress(
    address,
    AccAddress.getPrefix(address),
  )

  const validator = validators.find(
    ({ operator_address }) => operator_address === validatorAddress,
  )

  if (!validator) return

  return validator.description.moniker
}

/* helpers */
export const calcRewardsValues = (
  rewards: Rewards,
  currency: Denom,
  calcValue: CalcValue,
): RewardsListing => {
  const calc = (coins: Coins) => {
    const list = sortCoins(coins, currency).filter(({ amount }) => has(amount))
    const sum = BigNumber.sum(
      ...list.map((item) => calcValue(item) ?? 0),
    ).toString()

    return { sum, list }
  }

  const total = calc(rewards.total)

  const byValidator = Object.entries(rewards.rewards ?? {})
    .map(([address, coins]) => ({ ...calc(coins), address }))
    .filter(({ list }) => has(list.length))
    .sort(({ sum: a }, { sum: b }) => Number(b) - Number(a))

  return { total, byValidator }
}
