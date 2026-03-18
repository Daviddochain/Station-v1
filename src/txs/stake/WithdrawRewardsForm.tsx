import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import BigNumber from "bignumber.js"
import { MsgExecuteContract } from "@terra-money/feather.js"
import { Rewards } from "@terra-money/feather.js"
import { MsgWithdrawDelegatorReward } from "@terra-money/feather.js"
import { queryKey } from "data/query"
import { useCurrency } from "data/settings/Currency"
import { useMemoizedCalcValue } from "data/queries/coingecko"
import { calcRewardsValues } from "data/queries/distribution"
import { WithTokenItem, useNativeDenoms } from "data/token"
import { FinderLink, ValidatorLink } from "components/general"
import { Form, FormArrow, FormItem, Checkbox } from "components/form"
import { Card, Flex, Grid } from "components/layout"
import { TokenCard, TokenCardGrid } from "components/token"
import { Empty } from "components/feedback"
import styles from "./WithdrawRewardsForm.module.scss"
import Tx from "txs/Tx"
import { useInterchainAddresses } from "auth/hooks/useAddress"
import { Read } from "components/token"
import { useAllianceHub } from "data/queries/alliance-protocol"
import { AHAllRewards } from "data/types/alliance-protocol"
import { parseRewards } from "data/parsers/alliance-protocol"

interface Props {
  rewards: Rewards
  ahRewards: AHAllRewards
  chain: string
}

const WithdrawRewardsForm = ({ rewards, chain, ahRewards }: Props) => {
  const { t } = useTranslation()
  const readNativeDenom = useNativeDenoms()
  const currency = useCurrency()
  const allianceHub = useAllianceHub()
  const allianceHubAddress = allianceHub.useHubAddress()
  const addresses = useInterchainAddresses()
  const address = addresses?.[chain] as string | undefined
  const calcValue = useMemoizedCalcValue()

  const listing = useMemo(() => {
    const { byValidator: stByVal, total: stTotalByVal } = calcRewardsValues(
      rewards,
      currency.id,
      (coin) => Number(coin.amount),
    )

    if (chain !== "pisco-1" && chain !== "phoenix-1") {
      return {
        byValidator: stByVal,
        total: stTotalByVal,
      }
    }

    const { byValidator: stByAllyVal, total: stTotalByAlly } = parseRewards(
      ahRewards,
      allianceHubAddress,
    )

    return {
      byValidator: stByVal.concat(stByAllyVal),
      total: {
        list: stTotalByVal.list.concat(stTotalByAlly.list),
        sum: new BigNumber(stTotalByVal.sum ?? 0)
          .plus(new BigNumber(stTotalByAlly.sum ?? 0))
          .toString(),
      },
    }
  }, [rewards, ahRewards, currency.id, allianceHubAddress, chain])

  const overwritteSelectionsAs = useCallback(
    (value = false): Record<number, boolean> => {
      return listing.byValidator.reduce(
        (acc, _, index) => {
          acc[index] = value
          return acc
        },
        {} as Record<number, boolean>,
      )
    },
    [listing.byValidator],
  )

  const [state, setState] = useState<Record<number, boolean>>(
    overwritteSelectionsAs(true),
  )

  useEffect(() => {
    if (chain) {
      setState(overwritteSelectionsAs(true))
    }
  }, [chain, overwritteSelectionsAs])

  const selected = useMemo(
    () => Object.keys(state).filter((index) => state[Number(index)]),
    [state],
  )

  const selectedTotal = useMemo(
    () =>
      selected.reduce<Record<Denom, Amount>>((prev, index) => {
        const item = listing.byValidator[Number(index)]
        if (!item) return prev

        return item.list.reduce(
          (acc, { amount, denom }) => ({
            ...acc,
            [denom]: new BigNumber(acc[denom] ?? 0)
              .plus(amount)
              .integerValue(BigNumber.ROUND_FLOOR)
              .toString(),
          }),
          prev,
        )
      }, {}),
    [selected, listing.byValidator],
  )

  const { handleSubmit, reset } = useForm({ mode: "onChange" })

  const createTx = useCallback(() => {
    if (!address) return

    const msgs: Array<MsgWithdrawDelegatorReward | MsgExecuteContract> = []

    for (const selection of selected) {
      const reward = listing.byValidator[Number(selection)]
      if (!reward) continue

      const msg =
        reward.stakedAsset !== undefined
          ? new MsgExecuteContract(address, reward.address, {
              claim_rewards: { native: reward.stakedAsset },
            })
          : new MsgWithdrawDelegatorReward(address, reward.address)

      msgs.push(msg)
    }

    return { msgs, chainID: chain }
  }, [address, selected, chain, listing.byValidator])

  const estimationTxValues = useMemo(() => ({}), [])

  const tx = {
    baseDenom: "uluna",
    estimationTxValues,
    createTx,
    queryKeys: [queryKey.distribution.rewards],
    chain,
    onSuccess: () => reset(),
  }

  if (!listing.byValidator?.length) {
    return <Empty>{t("No rewards on selected chain")}</Empty>
  }

  return (
    <Tx {...tx}>
      {({ fee, submit }) => (
        <Form onSubmit={handleSubmit(() => submit.fn({}))}>
          <Grid gap={12}>
            <Flex className={styles.actions} start>
              {Object.values(state ?? {}).some((value) => !value) ? (
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => setState(overwritteSelectionsAs(true))}
                >
                  {t("Select All")}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => setState(overwritteSelectionsAs(false))}
                >
                  {t("Deselect All")}
                </button>
              )}
            </Flex>

            <Card size="small" className={styles.card}>
              <dl className={styles.title}>
                <dt>{t("Validators")}</dt>
                <dd>{t("Rewards")}</dd>
              </dl>

              <section className={styles.validators}>
                {listing.byValidator.map((item, index) => {
                  const checked = state[index]
                  const firstReward = item.list?.[0]
                  const denom = firstReward?.denom ?? ""
                  const amount = firstReward?.amount ?? "0"
                  const { symbol } = readNativeDenom(
                    item.stakedAsset ?? "",
                    chain,
                  )

                  return (
                    <Checkbox
                      className={styles.checkbox}
                      checked={checked}
                      onChange={() => setState({ ...state, [index]: !checked })}
                      key={index}
                    >
                      <dl className={styles.item}>
                        <dt>
                          {item.address === allianceHubAddress ? (
                            <FinderLink
                              value={item.address}
                              style={{ fontSize: "12px" }}
                            >
                              Alliance Hub ({symbol})
                            </FinderLink>
                          ) : (
                            <ValidatorLink address={item.address} />
                          )}
                        </dt>
                        <dd>
                          <Read amount={amount} denom={denom} />
                        </dd>
                      </dl>
                    </Checkbox>
                  )
                })}
              </section>
            </Card>

            {selected.length ? <FormArrow /> : undefined}

            <FormItem>
              <TokenCardGrid maxHeight>
                {Object.entries(selectedTotal ?? {}).map(([denom, amount]) => (
                  <WithTokenItem token={denom} key={denom}>
                    {(item) => (
                      <TokenCard
                        {...item}
                        name=""
                        value={calcValue({ amount, denom })}
                        amount={amount}
                      />
                    )}
                  </WithTokenItem>
                ))}
              </TokenCardGrid>
            </FormItem>
          </Grid>

          {fee.render()}
          {submit.button}
        </Form>
      )}
    </Tx>
  )
}

export default WithdrawRewardsForm
