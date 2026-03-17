import { useTranslation } from "react-i18next"
import { useLocation, useParams } from "react-router-dom"
import {
  getAvailableStakeActions,
  useDelegations,
  useValidators,
} from "data/queries/staking"
import { combineState } from "data/query"
import { useBalances } from "data/queries/bank"
import { Auto, Page, Tabs, Card, Flex } from "components/layout"
import ValidatorCompact from "pages/stake/ValidatorCompact"
import StakeForm, { StakeAction } from "./StakeForm"
import { useNetwork } from "data/wallet"
import styles from "./StakeTx.module.scss"
import {
  getAvailableAllianceStakeActions,
  useAllianceDelegations,
} from "data/queries/alliance"
import StakingDetailsCompact from "pages/stake/StakingDetailsCompact"
import { getChainIDFromAddress } from "utils/bech32"
import { LoadingCircular } from "components/feedback"
import { ValAddress } from "@terra-money/feather.js"

const StakeTx = () => {
  const { t } = useTranslation()
  const { address, denom: paramDenom } = useParams()
  const location = useLocation()
  const networks = useNetwork()

  if (!address) throw new Error("Validator is not defined")

  const destination = address as ValAddress
  const chainID = getChainIDFromAddress(destination, networks) ?? ""
  const network = chainID ? networks?.[chainID] : undefined
  const denom = paramDenom?.replaceAll("=", "/") || network?.baseAsset || ""
  const isAlliance = !!network && denom !== network.baseAsset

  const initialTab = Object.values(StakeAction).includes(
    location.state as StakeAction,
  )
    ? (location.state as StakeAction)
    : StakeAction.DELEGATE

  const { data: balances, ...balancesState } = useBalances()
  const { data: validators, ...validatorsState } = useValidators(chainID)
  const { data: delegations, ...delegationsState } = useDelegations(
    chainID,
    isAlliance,
  )
  const { data: allianceDelegations, ...allianceDelegationsState } =
    useAllianceDelegations(chainID, !isAlliance)

  const state = combineState(
    balancesState,
    validatorsState,
    delegationsState,
    allianceDelegationsState,
  )

  if (!chainID || !network) {
    return (
      <Page {...state} title={t("Delegate")} backButtonPath="/stake">
        <Flex>
          <LoadingCircular />
        </Flex>
      </Page>
    )
  }

  const getDisabled = (tab: StakeAction) => {
    if (isAlliance) {
      if (!allianceDelegations) return true

      const availableActions = getAvailableAllianceStakeActions(
        destination,
        allianceDelegations,
      )

      return !availableActions[tab]
    }

    if (!delegations) return true

    const availableActions = getAvailableStakeActions(destination, delegations)
    return !availableActions[tab]
  }

  const renderTab = (tab: StakeAction) => {
    if (!(balances && validators)) {
      return (
        <Flex>
          <LoadingCircular />
        </Flex>
      )
    }

    if (isAlliance) {
      if (!allianceDelegations) return null

      return (
        <StakeForm
          tab={tab}
          destination={destination}
          balances={balances}
          validators={validators}
          chainID={chainID}
          denom={denom}
          details={{
            isAlliance: true,
            delegations: allianceDelegations,
          }}
        />
      )
    }

    if (!delegations) return null

    return (
      <StakeForm
        tab={tab}
        destination={destination}
        balances={balances}
        validators={validators}
        chainID={chainID}
        denom={denom}
        details={{
          isAlliance: false,
          delegations,
        }}
      />
    )
  }

  return (
    <Page {...state} title={t("Delegate")} backButtonPath="/stake">
      <Auto
        columns={[
          <Tabs
            tabs={Object.values(StakeAction).map((tab) => {
              return {
                key: tab,
                tab: t(tab),
                children: (
                  <Card muted className={styles.card}>
                    {renderTab(tab)}
                  </Card>
                ),
                disabled: getDisabled(tab),
              }
            })}
            defaultActiveKey={initialTab}
            type="page"
          />,
          <div className={styles.details__container}>
            <ValidatorCompact vertical />
            <StakingDetailsCompact denom={denom} chainID={chainID} />
          </div>,
        ]}
      />
    </Page>
  )
}

export default StakeTx
