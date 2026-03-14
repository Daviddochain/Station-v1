import { useTranslation } from "react-i18next"
import classNames from "classnames/bind"
import { Col, Page } from "components/layout"

import CommunityPool from "../charts/CommunityPool"
import Blockheight from "../charts/Blockheight"
import BlockSpeed from "../charts/Blockspeed"
import OraclePool from "../charts/OraclePool"
import Stakingamount from "../charts/Stakingamount"
import Charts from "./Charts"
import ValidatorCount from "../charts/Numberofvals"

import styles from "./Dashboard.module.scss"
import { useSelectedDisplayChain } from "utils/localStorage"

const cx = classNames.bind(styles)

const Dashboard = () => {
  const { t } = useTranslation()
  const { selectedDisplayChain } = useSelectedDisplayChain()

  const chainID = selectedDisplayChain || "columbus-5"

  return (
    <Page title={t("Dashboard")}>
      <Col>
        {/* DASHBOARD CARDS GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 20,
            marginBottom: 24,
          }}
        >
          <Blockheight />
          <BlockSpeed chainID={chainID} />
          <CommunityPool chainID={chainID} />
          <OraclePool />
          <Stakingamount />
          <ValidatorCount />
        </div>

        {/* CHART SECTION */}
        <Charts chainID={chainID} />
      </Col>
    </Page>
  )
}

export default Dashboard
