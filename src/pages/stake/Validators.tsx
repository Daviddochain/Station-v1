/* FIXME(terra.js): Import from terra.js */
import { BondStatus } from "@terra-money/terra.proto/cosmos/staking/v1beta1/staking"
import { Delegation } from "@terra-money/feather.js"
import { bondStatusFromJSON } from "@terra-money/terra.proto/cosmos/staking/v1beta1/staking"
import WithSearchInput from "pages/custom/WithSearchInput"
import styles from "./Validators.module.scss"
import ValidatorsList from "./ValidatorsList"
import { Flex, Grid, InlineFlex, Page, Table } from "components/layout"
import { useTranslation } from "react-i18next"
import TokenSelector, {
  TokenInterface,
} from "components/form/Selectors/TokenSelector/TokenSelector"
import { useState } from "react"
import {
  AllianceDelegation,
  AllianceDetails,
  useAllAlliances,
  useInterchainAllianceDelegations,
} from "data/queries/alliance"
import {
  useAllStakingParams,
  useInterchainDelegations,
  getChainUnbondTime,
} from "data/queries/staking"
import { combineState } from "data/query"
import { TokenType, useNativeDenoms } from "data/token"
import { Tooltip, TooltipIcon } from "components/display"
import { ChainFeature } from "types/chains"
import { useNetworks } from "app/InitNetworks"

type StakingNetwork = {
  chainID?: string
  baseAsset?: string
  name?: string
  icon?: string
  disabledModules?: string[]
}

type ValidatorOption = {
  denom: string
  rewards: number
  chainID: string
  unbonding: number
  isAlliance: boolean
  delegatedTo: string[]
}

const Validators = () => {
  const { t } = useTranslation()
  const readNativeDenom = useNativeDenoms()
  const { networks: allNetworks } = useNetworks()

  const flatNetworks = {
    ...(allNetworks?.mainnet || {}),
    ...(allNetworks?.classic || {}),
    ...(allNetworks?.testnet || {}),
    ...(allNetworks?.localterra || {}),
  } as Record<string, StakingNetwork>

  const stakingNetworks = Object.fromEntries(
    Object.entries(flatNetworks).filter(([networkKey, network]) => {
      const actualChainID =
        typeof network?.chainID === "string" && network.chainID.length > 0
          ? network.chainID
          : networkKey

      const stakingEnabled =
        !Array.isArray(network?.disabledModules) ||
        !network.disabledModules.includes(ChainFeature.STAKING)

      return (
        stakingEnabled &&
        (actualChainID === "phoenix-1" || actualChainID === "columbus-5")
      )
    }),
  ) as Record<string, StakingNetwork>

  const [token, setToken] = useState<string | undefined>()

  const alliancesData = useAllAlliances() ?? []
  const stakingParamsData = useAllStakingParams() ?? []
  const delegationsData = useInterchainDelegations() ?? []
  const allianceDelegationsData = useInterchainAllianceDelegations() ?? []

  const alliances = alliancesData.reduce((acc, item) => {
    if (!item || !item.data) return acc
    return [...acc, ...item.data]
  }, [] as AllianceDetails[])

  const unbondingtime = stakingParamsData.reduce(
    (acc, item) => {
      const data = item?.data
      if (!data || !("unbonding_time" in data)) return acc

      return {
        ...acc,
        [String(data.chainID)]: data.unbonding_time ?? 0,
      }
    },
    {} as Record<string, number>,
  )

  const delegations: Delegation[] = delegationsData.reduce((acc, item) => {
    const data = item?.data
    if (!data) return acc

    return [...(data.delegation ?? []), ...acc]
  }, [] as Delegation[])

  const allianceDelegations = allianceDelegationsData.reduce(
    (acc, item) => {
      const data = item?.data
      if (!data) return acc

      return [data, ...acc]
    },
    [] as { delegations: AllianceDelegation[]; chainID: string }[],
  )

  const state = combineState(
    ...alliancesData.filter(Boolean),
    ...stakingParamsData.filter(Boolean),
    ...delegationsData.filter(Boolean),
    ...allianceDelegationsData.filter(Boolean),
  )

  const options: ValidatorOption[] = [
    ...Object.entries(stakingNetworks).map(([networkKey, network]) => {
      const chainID =
        typeof network?.chainID === "string" && network.chainID.length > 0
          ? network.chainID
          : networkKey

      const baseAsset = String(network?.baseAsset ?? "")

      return {
        denom: baseAsset,
        rewards: 1,
        chainID,
        unbonding: getChainUnbondTime(unbondingtime[chainID]),
        isAlliance: false,
        delegatedTo: delegations.reduce(
          (acc, { balance, validator_address }) =>
            balance?.denom === baseAsset && Number(balance?.amount) > 0
              ? [...acc, validator_address]
              : acc,
          [] as string[],
        ),
      }
    }),
    ...alliances.map(({ denom, reward_weight, chainID }) => ({
      denom: denom ?? "",
      rewards: Number(reward_weight),
      chainID: String(chainID),
      unbonding: getChainUnbondTime(unbondingtime[String(chainID)]),
      isAlliance: true,
      delegatedTo: allianceDelegations.reduce(
        (acc, { chainID: delChainID, delegations }) =>
          delChainID === String(chainID) &&
          delegations.some(
            ({ balance }) =>
              balance?.denom === denom && Number(balance?.amount) > 0,
          )
            ? [
                ...acc,
                ...delegations.reduce(
                  (innerAcc, { delegation: { validator_address } }) => [
                    ...innerAcc,
                    validator_address,
                  ],
                  [] as string[],
                ),
              ]
            : acc,
        [] as string[],
      ),
    })),
  ]

  const tokenList = options.reduce(
    (acc, { denom, chainID }) => {
      const native = readNativeDenom(denom)
      if (!native || native.type === TokenType.IBC) return acc

      const key = `${chainID}:${native.lsd ?? native.token}`

      const networkEntry = Object.entries(stakingNetworks).find(
        ([networkKey, network]) => {
          const actualChainID =
            typeof network?.chainID === "string" && network.chainID.length > 0
              ? network.chainID
              : networkKey

          return actualChainID === chainID
        },
      )

      const network = networkEntry?.[1]

      const isTerraMainnet = chainID === "phoenix-1"
      const isTerraClassic = chainID === "columbus-5"

      const labelSymbol = isTerraMainnet
        ? "LUNA"
        : isTerraClassic
          ? "LUNC"
          : native.symbol

      const labelName = isTerraMainnet
        ? "Terra"
        : isTerraClassic
          ? "Terra Classic"
          : native.name

      return {
        ...acc,
        [key]: {
          ...native,
          token: key,
          symbol: labelSymbol,
          name: labelName,
          icon: native.icon,
          chainID,
          chainName: network?.name,
        } as TokenInterface,
      }
    },
    {} as Record<string, TokenInterface>,
  )

  return (
    <Page sub {...state}>
      <header className={styles.select__asset}>
        <p>{t("Select staking asset")}:</p>
        <TokenSelector
          value={token}
          tokenLists={tokenList}
          onChange={setToken}
        />
      </header>

      <WithSearchInput
        gap={0}
        placeholder={t("Search for validator...")}
        padding
      >
        {(keyword: string) => (
          <main className={styles.table__container}>
            <Table
              dataSource={options.filter(({ denom, chainID }) => {
                if (!token) return true

                const native = readNativeDenom(denom)
                const optionKey = `${chainID}:${native.lsd ?? native.token}`

                return optionKey === token
              })}
              extra={({ chainID, denom, delegatedTo }: ValidatorOption) => (
                <ValidatorsList
                  keyword={keyword}
                  chainID={chainID}
                  denom={denom}
                  delegatedTo={delegatedTo}
                />
              )}
              columns={[
                {
                  title: t("Staking asset"),
                  dataIndex: ["asset", "chainID"],
                  render: (_: unknown, option: ValidatorOption) => {
                    const { denom, chainID, isAlliance } = option
                    const tokenInfo = readNativeDenom(denom)

                    const networkEntry = Object.entries(stakingNetworks).find(
                      ([networkKey, network]) => {
                        const actualChainID =
                          typeof network?.chainID === "string" &&
                          network.chainID.length > 0
                            ? network.chainID
                            : networkKey

                        return actualChainID === chainID
                      },
                    )

                    const network = networkEntry?.[1]

                    return (
                      <Flex start gap={8}>
                        <Grid gap={2}>
                          <Flex gap={4} start>
                            <div className={styles.token__icon__container}>
                              {tokenInfo && (
                                <img
                                  src={tokenInfo.icon}
                                  alt={tokenInfo.symbol}
                                  className={styles.token__icon}
                                />
                              )}
                              {network && (
                                <img
                                  src={network.icon}
                                  alt={network.name}
                                  className={styles.chain__icon}
                                />
                              )}
                            </div>

                            {chainID === "phoenix-1"
                              ? "LUNA"
                              : chainID === "columbus-5"
                                ? "LUNC"
                                : tokenInfo?.symbol}

                            {isAlliance && (
                              <InlineFlex gap={4} start>
                                <Tooltip
                                  content={
                                    <article>
                                      <h1>Alliance</h1>
                                      <p>
                                        {t(
                                          "Assets of one chain can be staked on another, creating a mutually-beneficial economic partnership through interchain staking",
                                        )}
                                      </p>
                                    </article>
                                  }
                                >
                                  <span className={styles.alliance__logo}>
                                    🤝
                                  </span>
                                </Tooltip>
                              </InlineFlex>
                            )}
                          </Flex>
                        </Grid>
                      </Flex>
                    )
                  },
                },
                {
                  title: t("Chain"),
                  dataIndex: "chainID",
                  defaultSortOrder: "desc",
                  sorter: (
                    { chainID: a }: ValidatorOption,
                    { chainID: b }: ValidatorOption,
                  ) => a.localeCompare(b),
                  render: (chainID: string) => {
                    const networkEntry = Object.entries(stakingNetworks).find(
                      ([networkKey, network]) => {
                        const actualChainID =
                          typeof network?.chainID === "string" &&
                          network.chainID.length > 0
                            ? network.chainID
                            : networkKey

                        return actualChainID === chainID
                      },
                    )

                    return networkEntry?.[1]?.name || chainID
                  },
                },
                {
                  title: (
                    <span>
                      {t("Unbonding period")}{" "}
                      <TooltipIcon
                        content={
                          <article>
                            <p>
                              When a delegator decides to undelegate their
                              asset.
                            </p>
                            <p>No rewards accrue during this period.</p>
                            <p>This action cannot be stopped once executed.</p>
                          </article>
                        }
                      />
                    </span>
                  ),
                  dataIndex: "unbonding",
                  defaultSortOrder: "desc",
                  sorter: (
                    { unbonding: a = 0 }: { unbonding?: number },
                    { unbonding: b = 0 }: { unbonding?: number },
                  ) => a - b,
                  render: (value = 0) => t("{{value}} days", { value }),
                  align: "right",
                },
              ]}
            />
          </main>
        )}
      </WithSearchInput>
    </Page>
  )
}

export default Validators

export const getIsBonded = (status: BondStatus) =>
  bondStatusFromJSON(BondStatus[status]) === BondStatus.BOND_STATUS_BONDED

export const getIsUnbonded = (status: BondStatus) =>
  bondStatusFromJSON(BondStatus[status]) === BondStatus.BOND_STATUS_UNBONDED
