import { PropsWithChildren } from "react"
import {
  CoinBalance,
  useInitialBankBalance,
  useInitialTokenBalance,
  BankBalanceProvider,
} from "data/queries/bank"
import { useNetworkName } from "data/wallet"
import { combineState } from "data/query"
import { WithFetching } from "components/feedback"
import { useCustomTokensNative } from "data/settings/CustomTokens"
import { useWhitelist } from "data/queries/chains"

const InitBankBalance = ({ children }: PropsWithChildren<{}>) => {
  const balances = useInitialBankBalance() ?? []
  const tokenBalancesQuery = useInitialTokenBalance() ?? []
  const native = useCustomTokensNative()
  const { whitelist } = useWhitelist()
  const networkName = useNetworkName()

  const state = combineState(
    ...balances.filter(Boolean),
    ...tokenBalancesQuery.filter(Boolean),
  )

  const bankBalance = balances.reduce((acc, item) => {
    const data = item?.data
    return data ? [...acc, ...data] : acc
  }, [] as CoinBalance[])

  const tokenBalance = tokenBalancesQuery.reduce((acc, item) => {
    const data = item?.data
    return data ? [...acc, data] : acc
  }, [] as CoinBalance[])

  const networkWhitelist =
    (networkName && whitelist?.[networkName] ? whitelist[networkName] : {}) ??
    {}

  native.list.forEach(({ id }) => {
    const [chain, ...denomData] = id.split(":")
    const denom = denomData.join(":")

    const exists = bankBalance.find(
      (balance) => balance.denom === denom && balance.chain === chain,
    )

    if (exists) return

    const token = networkWhitelist?.[id]
    if (!token?.chains?.length) return

    bankBalance.push({
      denom,
      amount: "0",
      chain,
    })
  })

  return (
    <BankBalanceProvider value={[...bankBalance, ...tokenBalance]}>
      <WithFetching {...state}>
        {(progress) => (
          <>
            {progress}
            {children}
          </>
        )}
      </WithFetching>
    </BankBalanceProvider>
  )
}

export default InitBankBalance
