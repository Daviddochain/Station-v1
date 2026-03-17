import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { LinkButton } from "components/general"
import { Col, Page, Row, Tabs } from "components/layout"
import Staked from "./Staked"
import Validators from "./Validators"
import StakedDonut from "./StakedDonut"
import { useStakeChartData } from "data/queries/staking"
import QuickStake from "./QuickStake"
import { TooltipIcon } from "components/display"
import QuickStakeTooltip from "./QuickStakeTooltip"
import { Fetching } from "components/feedback"
import styles from "./StakedDonut.module.scss"
import ChainFilter from "components/layout/ChainFilter"
import DelegationsPromote from "app/containers/DelegationsPromote"
import { ChainFeature } from "types/chains"

const Stake = () => {
  const { t } = useTranslation()
  const { data: chartData, ...state } = useStakeChartData()

  const tabs = useMemo(
    () => [
      {
        key: "quick",
        tab: t("Quick Stake"),
        children: <QuickStake />,
        extra: (
          <TooltipIcon content={<QuickStakeTooltip />} placement="bottom" />
        ),
      },
      {
        key: "manual",
        tab: t("Manual Stake"),
        children: <Validators />,
      },
    ],
    [t],
  )

  return (
    <Page
      title={t("Stake")}
      extra={
        <LinkButton to="/rewards" color="primary" size="small">
          {t("Withdraw all rewards")}
        </LinkButton>
      }
    >
      <Col>
        {chartData.length ? (
          <ChainFilter
            title={t("Staked funds")}
            feature={ChainFeature.STAKING}
            all
          >
            {(chain) => (
              <Row>
                <Col span={2}>
                  <div className={styles.forFetchingBar}>
                    <Fetching {...state}>
                      <StakedDonut chain={chain} />
                    </Fetching>
                  </div>
                </Col>
                <Staked chain={chain || "all"} />
              </Row>
            )}
          </ChainFilter>
        ) : (
          <DelegationsPromote horizontal />
        )}

        <Tabs tabs={tabs} type="page" />
      </Col>
    </Page>
  )
}

export default Stake
