import { useTranslation } from "react-i18next"
import { useQueries, useQuery } from "react-query"
import { last } from "ramda"
import { sentenceCase } from "sentence-case"
import { AccAddress, Proposal, Vote } from "@terra-money/feather.js"
import { Color } from "types/components"
import { queryKey, RefetchOptions } from "../query"
import { useInterchainLCDClient } from "./lcdClient"
import { useNetworkWithFeature } from "data/wallet"
import axios from "axios"
import { ChainFeature } from "types/chains"

export const useVotingParams = (chain: string) => {
  const lcd = useInterchainLCDClient()
  return useQuery(
    [queryKey.gov.votingParams, chain],
    () => lcd.gov.votingParameters(chain),
    { ...RefetchOptions.INFINITY },
  )
}

export const useDepositParams = (chain: string) => {
  const lcd = useInterchainLCDClient()
  return useQuery(
    [queryKey.gov.depositParams, chain],
    () => lcd.gov.depositParameters(chain),
    { ...RefetchOptions.INFINITY },
  )
}

export const useTallyParams = (chain: string) => {
  const lcd = useInterchainLCDClient()

  return useQuery(
    [queryKey.gov.tallyParams, chain],
    () => lcd.gov.tallyParameters(chain),
    {
      ...RefetchOptions.INFINITY,
    },
  )
}

export enum ProposalStatus {
  PROPOSAL_STATUS_UNSPECIFIED = "PROPOSAL_STATUS_UNSPECIFIED",
  PROPOSAL_STATUS_DEPOSIT_PERIOD = "PROPOSAL_STATUS_DEPOSIT_PERIOD",
  PROPOSAL_STATUS_VOTING_PERIOD = "PROPOSAL_STATUS_VOTING_PERIOD",
  PROPOSAL_STATUS_PASSED = "PROPOSAL_STATUS_PASSED",
  PROPOSAL_STATUS_REJECTED = "PROPOSAL_STATUS_REJECTED",
  PROPOSAL_STATUS_FAILED = "PROPOSAL_STATUS_FAILED",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export interface ProposalResult {
  proposal_id: string
  content: {
    "@type": string
    title: string
    description: string
  } & Record<string, any>
  status: ProposalStatus

  final_tally_result: {
    yes: string
    abstain: string
    no: string
    no_with_veto: string
  }
  submit_time: string
  deposit_end_time: string
  total_deposit: [
    {
      denom: string
      amount: string
    },
  ]
  voting_start_time: string
  voting_end_time: string
}

interface LegacyGovMessage {
  "@type": "/cosmos.gov.v1.MsgExecLegacyContent"
  content: {
    "@type": string
    title: string
    description: string
  } & Record<string, any>
  authority: "mars10d07y265gmmuvt4z0w9aw880jnsr700j8l2urg"
}

type GovMessage = {
  "@type": string
  authority: "mars10d07y265gmmuvt4z0w9aw880jnsr700j8l2urg"
} & Record<string, any>

export interface ProposalResult46 {
  id: string
  messages: GovMessage[] | LegacyGovMessage[]
  status: ProposalStatus
  final_tally_result: {
    yes_count: string
    abstain_count: string
    no_count: string
    no_with_veto_count: string
  }
  submit_time: string
  deposit_end_time: string
  total_deposit: [
    {
      denom: string
      amount: string
    },
  ]
  voting_start_time: string
  voting_end_time: string
  metadata: string
  title: string
  summary: string
  proposer: string
}

/* ----------------------------------------------------------
   Terra Classic LCD fallback (only used when a Classic LCD 500s)
   ---------------------------------------------------------- */

const CLASSIC_LCD_FALLBACKS = [
  "https://www.lunaclassicstation.com/lcd",
  "https://terra-classic-lcd.publicnode.com",
  "https://lcd-terraclassic.tfl.foundation",
]

async function getWithFallback(urlPath: string, params?: any) {
  for (const baseURL of CLASSIC_LCD_FALLBACKS) {
    try {
      const res = await axios.get(urlPath, { baseURL, params, timeout: 10000 })
      return res?.data ?? null
    } catch (e) {
      // try next
    }
  }
  return null
}

/* ----------------------------------------------------------
   Helpers: safe paginated proposal fetch (prevents 999 -> 500)
   ---------------------------------------------------------- */

const GOV_PAGE_LIMIT = 100
const GOV_MAX_PAGES = 50

const isClassicChain = (chainID: string, lcd: string) =>
  chainID.startsWith("columbus") || lcd.includes("terraclassic")

async function fetchAllProposalsV1(
  baseURL: string,
  proposal_status: number,
): Promise<ProposalResult46[]> {
  const all: ProposalResult46[] = []
  let nextKey: string | null = null

  for (let i = 0; i < GOV_MAX_PAGES; i++) {
    try {
      const res = await axios.get("/cosmos/gov/v1/proposals", {
        baseURL,
        timeout: 12000,
        params: {
          "pagination.limit": GOV_PAGE_LIMIT,
          ...(nextKey ? { "pagination.key": nextKey } : {}),
          proposal_status,
        },
      })

      const data = res?.data
      const proposals = data?.proposals
      if (Array.isArray(proposals)) all.push(...proposals)

      nextKey = data?.pagination?.next_key ?? null
      if (!nextKey) break
    } catch {
      // If LCD errors mid-way, return what we have (or empty)
      return all
    }
  }

  return all
}

async function fetchAllProposalsV1beta1(
  baseURL: string,
  proposal_status: number,
): Promise<ProposalResult[]> {
  const all: ProposalResult[] = []
  let nextKey: string | null = null

  for (let i = 0; i < GOV_MAX_PAGES; i++) {
    try {
      const res = await axios.get("/cosmos/gov/v1beta1/proposals", {
        baseURL,
        timeout: 12000,
        params: {
          "pagination.limit": GOV_PAGE_LIMIT,
          ...(nextKey ? { "pagination.key": nextKey } : {}),
          proposal_status,
        },
      })

      const data = res?.data
      const proposals = data?.proposals
      if (Array.isArray(proposals)) all.push(...proposals)

      nextKey = data?.pagination?.next_key ?? null
      if (!nextKey) break
    } catch {
      return all
    }
  }

  return all
}

/* proposals */
export const useProposals = (status: ProposalStatus) => {
  const networks = useNetworkWithFeature(ChainFeature.GOV)

  return useQueries(
    Object.values(networks ?? {}).map(({ lcd, version, chainID }) => {
      return {
        queryKey: [queryKey.gov.proposals, lcd, status],
        queryFn: async () => {
          const proposalStatusNum = Proposal.Status[status]

          // v0.46+ OR Terra2
          if (
            Number(version) >= 0.46 ||
            chainID === "phoenix-1" ||
            chainID === "pisco-1"
          ) {
            // 1) try primary lcd (paginated, safe)
            let proposals46: ProposalResult46[] = []
            try {
              proposals46 = await fetchAllProposalsV1(lcd, proposalStatusNum)
            } catch {
              proposals46 = []
            }

            // 2) Terra Classic fallback (only if classic + primary returned nothing)
            if (proposals46.length === 0 && isClassicChain(chainID, lcd)) {
              const fallbackData = await getWithFallback(
                "/cosmos/gov/v1/proposals",
                {
                  "pagination.limit": GOV_PAGE_LIMIT,
                  proposal_status: proposalStatusNum,
                },
              )

              const fallbackProposals = fallbackData?.proposals
              if (Array.isArray(fallbackProposals)) {
                proposals46 = fallbackProposals as ProposalResult46[]
              }
            }

            const propsParsed = proposals46.map((prop) => {
              return {
                ...prop,
                proposal_id: prop.id,
                content: prop.messages.length
                  ? prop.messages[0]["@type"] ===
                    "/cosmos.gov.v1.MsgExecLegacyContent"
                    ? (prop.messages[0] as any).content
                    : {
                        ...(prop.messages[0] as any),
                        title: prop.title,
                        description: prop.summary,
                      }
                  : {
                      "@type": "/cosmos.gov.v1.TextProposal",
                      title: prop.title,
                      description: prop.summary,
                    },
                final_tally_result: {
                  yes: prop.final_tally_result.yes_count,
                  abstain: prop.final_tally_result.abstain_count,
                  no: prop.final_tally_result.no_count,
                  no_with_veto: prop.final_tally_result.no_with_veto_count,
                },
              }
            }) as ProposalResult[]

            return propsParsed.map((prop) => ({ prop, chain: chainID }))
          }

          // legacy v1beta1
          let proposalsLegacy: ProposalResult[] = []
          try {
            proposalsLegacy = await fetchAllProposalsV1beta1(
              lcd,
              proposalStatusNum,
            )
          } catch {
            proposalsLegacy = []
          }

          // Terra Classic fallback if legacy + classic chain
          if (proposalsLegacy.length === 0 && isClassicChain(chainID, lcd)) {
            const fallbackData = await getWithFallback(
              "/cosmos/gov/v1beta1/proposals",
              {
                "pagination.limit": GOV_PAGE_LIMIT,
                proposal_status: proposalStatusNum,
              },
            )

            const fallbackProposals = fallbackData?.proposals
            if (Array.isArray(fallbackProposals)) {
              proposalsLegacy = fallbackProposals as ProposalResult[]
            }
          }

          return proposalsLegacy.map((prop) => ({ prop, chain: chainID }))
        },

        // Keep your defaults but stop retry-spam on flaky LCDs
        ...RefetchOptions.DEFAULT,
        retry: false,
        refetchOnWindowFocus: false,
      }
    }),
  )
}

export const useGetProposalStatusItem = () => {
  const { t } = useTranslation()

  return (status: ProposalStatus) =>
    ({
      [ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD]: {
        label: t("Voting"),
        color: "info" as Color,
      },
      [ProposalStatus.PROPOSAL_STATUS_DEPOSIT_PERIOD]: {
        label: t("Deposit"),
        color: "info" as Color,
      },
      [ProposalStatus.PROPOSAL_STATUS_PASSED]: {
        label: t("Passed"),
        color: "success" as Color,
      },
      [ProposalStatus.PROPOSAL_STATUS_REJECTED]: {
        label: t("Rejected"),
        color: "danger" as Color,
      },
      [ProposalStatus.PROPOSAL_STATUS_FAILED]: {
        label: t("Error during execution"),
        color: "danger" as Color,
      },
      [ProposalStatus.PROPOSAL_STATUS_UNSPECIFIED]: {
        label: "",
        color: "danger" as Color,
      },
      [ProposalStatus.UNRECOGNIZED]: {
        label: "",
        color: "danger" as Color,
      },
    })[status]
}

export const useProposalStatusItem = (status: ProposalStatus) => {
  const getProposalStatusItem = useGetProposalStatusItem()
  return getProposalStatusItem(status)
}

/* proposal */
export const useProposal = (id: string, chain: string) => {
  const networks = useNetworkWithFeature(ChainFeature.GOV)
  return useQuery(
    [queryKey.gov.proposal, id, networks[chain]],
    async () => {
      try {
        if (
          Number(networks[chain].version) >= 0.46 ||
          chain === "phoenix-1" ||
          chain === "pisco-1"
        ) {
          const res = await axios.get<{ proposal: ProposalResult46 }>(
            `/cosmos/gov/v1/proposals/${id}`,
            { baseURL: networks[chain].lcd, timeout: 12000 },
          )

          const proposal = res?.data?.proposal
          if (!proposal) throw new Error("Missing proposal")

          return {
            ...proposal,
            proposal_id: proposal.id,
            content: proposal.messages.length
              ? proposal.messages[0]["@type"] ===
                "/cosmos.gov.v1.MsgExecLegacyContent"
                ? (proposal.messages[0] as any).content
                : {
                    ...(proposal.messages[0] as any),
                    title: proposal.title,
                    description: proposal.summary,
                  }
              : {
                  "@type": "/cosmos.gov.v1.TextProposal",
                  title: proposal.title,
                  description: proposal.summary,
                },
            final_tally_result: {
              yes: proposal.final_tally_result.yes_count,
              abstain: proposal.final_tally_result.abstain_count,
              no: proposal.final_tally_result.no_count,
              no_with_veto: proposal.final_tally_result.no_with_veto_count,
            },
          } as ProposalResult
        } else {
          const res = await axios.get(`/cosmos/gov/v1beta1/proposals/${id}`, {
            baseURL: networks[chain].lcd,
            timeout: 12000,
          })

          const proposal = res?.data?.proposal
          if (!proposal) throw new Error("Missing proposal")
          return proposal as ProposalResult
        }
      } catch {
        // Keep app stable
        throw new Error("Failed to fetch proposal")
      }
    },
    {
      ...RefetchOptions.INFINITY,
      enabled: !!networks[chain],
      retry: false,
      refetchOnWindowFocus: false,
    },
  )
}

export interface ProposalDeposit {
  proposal_id: string
  depositor: AccAddress
  amount: [
    {
      denom: string
      amount: string
    },
  ]
}

/* proposal: deposits */
export const useDeposits = (id: string, chain: string) => {
  const networks = useNetworkWithFeature(ChainFeature.GOV)
  return useQuery(
    [queryKey.gov.deposits, id, chain],
    async () => {
      try {
        const res = await axios.get(
          `/cosmos/gov/v1beta1/proposals/${id}/deposits`,
          {
            baseURL: networks[chain].lcd,
            timeout: 12000,
          },
        )

        const deposits = res?.data?.deposits
        return (Array.isArray(deposits) ? deposits : []) as ProposalDeposit[]
      } catch {
        return [] as ProposalDeposit[]
      }
    },
    { ...RefetchOptions.DEFAULT, retry: false, refetchOnWindowFocus: false },
  )
}

export const useTally = (id: string, chain: string) => {
  const lcd = useInterchainLCDClient()
  return useQuery(
    [queryKey.gov.tally, id, chain],
    () => lcd.gov.tally(Number(id), chain),
    {
      ...RefetchOptions.DEFAULT,
    },
  )
}

/* proposal: votes */
export const useGetVoteOptionItem = () => {
  const { t } = useTranslation()

  const getItem = (status: Vote.Option) =>
    ({
      [Vote.Option.VOTE_OPTION_YES]: {
        label: t("Yes"),
        color: "success" as Color,
      },
      [Vote.Option.VOTE_OPTION_NO]: {
        label: t("No"),
        color: "danger" as Color,
      },
      [Vote.Option.VOTE_OPTION_NO_WITH_VETO]: {
        label: t("No with veto"),
        color: "warning" as Color,
      },
      [Vote.Option.VOTE_OPTION_ABSTAIN]: {
        label: t("Abstain"),
        color: "info" as Color,
      },
      [Vote.Option.VOTE_OPTION_UNSPECIFIED]: {
        label: "",
        color: "danger" as Color,
      },
      [Vote.Option.UNRECOGNIZED]: {
        label: "",
        color: "danger" as Color,
      },
    })[status]

  return (param: Vote.Option | string) => {
    const option = typeof param === "string" ? Vote.Option[param as any] : param
    return getItem(option as Vote.Option)
  }
}

/* helpers */
export const useParseProposalType = (content?: ProposalResult["content"]) => {
  const type = content?.["@type"]
  return type ? sentenceCase(last(type.split(".")) ?? "") : "Unknown proposal"
}
