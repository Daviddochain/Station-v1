import { useCallback, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useFieldArray, useForm } from "react-hook-form"
import AddIcon from "@mui/icons-material/Add"
import RemoveIcon from "@mui/icons-material/Remove"
import { AccAddress, Coins, MsgSubmitProposal } from "@terra-money/feather.js"
import {
  TextProposal,
  CommunityPoolSpendProposal,
} from "@terra-money/feather.js"
import { ParameterChangeProposal, ParamChange } from "@terra-money/feather.js"
import { ExecuteContractProposal } from "@terra-money/feather.js/dist/core/wasm/proposals"
import { isDenomTerraNative } from "@terra-money/terra-utils"
import { readAmount, toAmount } from "@terra-money/terra-utils"
import { SAMPLE_ADDRESS } from "config/constants"
import { getAmount } from "utils/coin"
import { has } from "utils/num"
import { parseJSON } from "utils/data"
import { combineState, queryKey } from "data/query"
import { useBankBalance } from "data/queries/bank"
import { ExternalLink } from "components/general"
import { Card, Grid } from "components/layout"
import { Form, FormGroup, FormItem } from "components/form"
import { FormHelp, FormWarning } from "components/form"
import { Input, TextArea, Select } from "components/form"
import { TooltipIcon } from "components/display"
import { getCoins, getPlaceholder, toInput } from "../utils"
import validate from "../validate"
import Tx from "../Tx"
import { useCommunityPool } from "data/queries/distribution"
import { useDepositParams } from "data/queries/gov"
import { useInterchainAddresses } from "auth/hooks/useAddress"
import { useNetwork } from "data/wallet"
import { useNativeDenoms } from "data/token"

enum ProposalType {
  TEXT = "Text proposal",
  SPEND = "Community pool spend",
  PARAMS = "Parameter change",
  EXECUTE = "Execute contract",
}

interface DefaultValues {
  title: string
  description: string
  chain?: string
  input?: number
}

interface TextProposalValues extends DefaultValues {
  type: ProposalType.TEXT
}

interface CommunityPoolSpendProposalValues extends DefaultValues {
  type: ProposalType.SPEND
  spend: { input?: number; denom: CoinDenom; recipient: AccAddress }
}

interface ParameterChangeProposalValues extends DefaultValues {
  type: ProposalType.PARAMS
  changes: ParamChange[]
}

interface ExecuteContractProposalValues extends DefaultValues {
  type: ProposalType.EXECUTE
  runAs: AccAddress
  contractAddress: AccAddress
  msg: string
  coins: { input?: number; denom: CoinDenom }[]
}

type TxValues =
  | TextProposalValues
  | CommunityPoolSpendProposalValues
  | ParameterChangeProposalValues
  | ExecuteContractProposalValues

const DEFAULT_PAREMETER_CHANGE = {
  subspace: "",
  key: "",
  value: "",
} as ParamChange

const SubmitProposalForm = ({ chain }: { chain: string }) => {
  const { t } = useTranslation()
  const addresses = useInterchainAddresses()
  const networks = useNetwork()
  const readNativeDenom = useNativeDenoms()

  const bankBalance = useBankBalance()
  const token = networks[chain]?.baseAsset ?? ""
  const decimals = readNativeDenom(token, chain).decimals ?? 6
  const balance =
    bankBalance.find((b) => b.chain === chain && b.denom === token)?.amount ??
    "0"

  const defaultCoinItem = { denom: token }

  const { data: communityPool, ...communityPoolState } = useCommunityPool(chain)
  const { data: depositParams, ...depositParamsState } = useDepositParams(chain)
  const state = combineState(communityPoolState, depositParamsState)

  const minDeposit = depositParams
    ? getAmount(depositParams.min_deposit, token)
    : 0

  const form = useForm<TxValues>({
    mode: "onChange",
    defaultValues: {
      input: toInput(minDeposit, decimals),
      coins: [defaultCoinItem],
    } as any,
  })

  const { register, trigger, control, watch, setValue, handleSubmit } = form
  const { errors } = form.formState
  const { input, ...values } = watch() as TxValues
  const amount = toAmount(input, { decimals })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "changes" as never,
  })
  const coinsFieldArray = useFieldArray({ control, name: "coins" as never })

  useEffect(() => {
    setValue("input", toInput(minDeposit, decimals))
  }, [minDeposit, setValue, decimals])

  const shouldAppendChange =
    values.type === ProposalType.PARAMS && !values.changes.length

  useEffect(() => {
    if (shouldAppendChange) append(DEFAULT_PAREMETER_CHANGE as never)
  }, [append, shouldAppendChange])

  const createTx = useCallback(
    ({ input, title, description, ...values }: TxValues) => {
      if (!addresses || !token) return
      const amount = toAmount(input, { decimals })
      const deposit = has(amount) ? new Coins({ [token]: amount }) : []

      const getContent = () => {
        if (values.type === ProposalType.SPEND) {
          const { input, denom, recipient } = values.spend
          const coins = new Coins({ [denom]: toAmount(input, { decimals }) })
          return new CommunityPoolSpendProposal(
            title,
            description,
            recipient,
            coins,
          )
        }

        if (values.type === ProposalType.PARAMS) {
          const { changes } = values
          return new ParameterChangeProposal(title, description, changes)
        }

        if (values.type === ProposalType.EXECUTE) {
          const { runAs, contractAddress, msg } = values
          const execute_msg = parseJSON(msg)
          const coins = getCoins(values.coins)
          return new ExecuteContractProposal(
            title,
            description,
            runAs,
            contractAddress,
            execute_msg,
            coins,
          )
        }

        return new TextProposal(title, description)
      }

      const msgs = [
        new MsgSubmitProposal(getContent(), deposit, addresses[chain]),
      ]
      return { msgs, chainID: chain ?? "" }
    },
    [addresses, chain, token, decimals],
  )

  const estimationTxValues = useMemo(
    (): TxValues => ({
      type: ProposalType.TEXT,
      title: ESTIMATE.TITLE,
      description: ESTIMATE.DESCRIPTION,
      input: toInput(balance, decimals),
    }),
    [balance, decimals],
  )

  const onChangeMax = useCallback(
    async (input: number) => {
      setValue("input", input)
      await trigger("input")
    },
    [setValue, trigger],
  )

  const tx = {
    baseDenom: token,
    token,
    amount,
    balance,
    decimals,
    estimationTxValues,
    createTx,
    onChangeMax,
    queryKeys: [queryKey.gov.proposals],
    chain: chain ?? "",
    gasAdjustment: 1.5,
  }

  const render = () => {
    if (values.type === ProposalType.SPEND) {
      const max =
        values.spend && getAmount(communityPool ?? [], values.spend.denom)
      const placeholder = readAmount(max, { integer: true })

      return (
        <>
          <FormItem
            label={t("Recipient")}
            error={
              "spend" in errors ? errors.spend?.recipient?.message : undefined
            }
          >
            <Input
              {...register("spend.recipient" as const, {
                validate: validate.address(),
              })}
              placeholder={SAMPLE_ADDRESS}
            />
          </FormItem>

          <FormItem
            label={t("Amount")}
            error={"spend" in errors ? errors.spend?.input?.message : undefined}
          >
            <Input
              {...register("spend.input" as const, {
                valueAsNumber: true,
                validate: validate.input(toInput(max, decimals), decimals),
              })}
              inputMode="decimal"
              type="number"
              placeholder={placeholder}
              selectBefore={
                <Select {...register("spend.denom" as const)} before>
                  {[token].map((denom) => (
                    <option value={denom} key={denom}>
                      {readNativeDenom(denom, chain).symbol}
                    </option>
                  ))}
                </Select>
              }
            />
          </FormItem>
        </>
      )
    }

    if (values.type === ProposalType.PARAMS) {
      const length = fields.length
      return (
        <FormItem label={t("Changes")}>
          {fields.map(({ id }, index) => (
            <FormGroup
              button={
                length - 1 === index
                  ? {
                      onClick: () => append(DEFAULT_PAREMETER_CHANGE as never),
                      children: <AddIcon style={{ fontSize: 18 }} />,
                    }
                  : {
                      onClick: () => remove(index),
                      children: <RemoveIcon style={{ fontSize: 18 }} />,
                    }
              }
              key={id}
            >
              <FormItem label="subspace">
                <Input
                  {...register(`changes.${index}.subspace` as const, {
                    required: "`subspace` is required",
                  })}
                  placeholder="staking"
                />
              </FormItem>

              <FormItem label="key">
                <Input
                  {...register(`changes.${index}.key` as const, {
                    required: "`key` is required",
                  })}
                  placeholder="MaxValidators"
                />
              </FormItem>

              <FormItem label="value">
                <Input
                  {...register(`changes.${index}.value` as const, {
                    required: "`value` is required",
                  })}
                  placeholder="100"
                />
              </FormItem>
            </FormGroup>
          ))}
        </FormItem>
      )
    }

    if (values.type === ProposalType.EXECUTE) {
      const { fields, append, remove } = coinsFieldArray
      const length = fields.length

      return (
        <>
          <FormItem
            label={t("Run as")}
            error={"runAs" in errors ? errors.runAs?.message : undefined}
          >
            <Input
              {...register("runAs" as const, { validate: validate.address() })}
              placeholder={SAMPLE_ADDRESS}
            />
          </FormItem>

          <FormItem
            label={t("Contract address")}
            error={
              "contractAddress" in errors
                ? errors.contractAddress?.message
                : undefined
            }
          >
            <Input
              {...register("contractAddress" as const, {
                validate: validate.address(),
              })}
              placeholder={SAMPLE_ADDRESS}
            />
          </FormItem>

          <FormItem
            label="Msg"
            error={"msg" in errors ? errors.msg?.message : undefined}
          >
            <TextArea
              {...register("msg" as const, { validate: validate.msg() })}
              placeholder="{}"
            />
          </FormItem>

          <FormItem label={t("Amount")}>
            {fields.map(({ id }, index) => (
              <FormGroup
                button={
                  length - 1 === index
                    ? {
                        onClick: () => append(defaultCoinItem as never),
                        children: <AddIcon style={{ fontSize: 18 }} />,
                      }
                    : {
                        onClick: () => remove(index),
                        children: <RemoveIcon style={{ fontSize: 18 }} />,
                      }
                }
                key={id}
              >
                <Input
                  {...register(`coins.${index}.input` as const, {
                    valueAsNumber: true,
                  })}
                  inputMode="decimal"
                  type="number"
                  placeholder={getPlaceholder()}
                  selectBefore={
                    <Select
                      {...register(`coins.${index}.denom` as const)}
                      before
                    >
                      {bankBalance
                        .filter(
                          ({ denom, chain: balanceChain }) =>
                            balanceChain === chain && isDenomTerraNative(denom),
                        )
                        .map(({ denom }) => (
                          <option value={denom} key={denom}>
                            {readNativeDenom(denom, chain).symbol}
                          </option>
                        ))}
                    </Select>
                  }
                />
              </FormGroup>
            ))}
          </FormItem>
        </>
      )
    }

    return null
  }

  return (
    <Card {...state} inputCard>
      <Tx {...tx}>
        {({ max, fee, submit }) => (
          <Form onSubmit={handleSubmit(submit.fn)}>
            <Grid gap={4}>
              {chain === "phoenix-1" && (
                <FormHelp>
                  Upload proposal only after forum discussion on{" "}
                  <ExternalLink href="https://commonwealth.im/terra">
                    commonwealth.im/terra
                  </ExternalLink>
                </FormHelp>
              )}
              <FormWarning>
                {t(
                  "Proposal deposits will not be refunded if the proposal is vetoed, fails to meet quorum, or does not meet the minimum deposit",
                )}
              </FormWarning>
              {values.type === ProposalType.TEXT && (
                <FormWarning>
                  {t("Parameters cannot be changed by text proposals")}
                </FormWarning>
              )}
            </Grid>

            <FormItem label={t("Proposal type")} error={errors.type?.message}>
              <Select {...register("type" as const)}>
                {Object.values(ProposalType ?? {}).map((type) => (
                  <option value={type} key={type}>
                    {t(type)}
                  </option>
                ))}
              </Select>
            </FormItem>

            <FormItem label={t("Title")} error={errors.title?.message}>
              <Input
                {...register("title" as const, {
                  required: "Title is required",
                })}
                placeholder={t("Burn community pool")}
                autoFocus
              />
            </FormItem>

            <FormItem
              label={t("Description")}
              error={errors.description?.message}
            >
              <TextArea
                {...register("description" as const, {
                  required: "Description is required",
                })}
                placeholder={t(
                  `We're proposing to spend 100,000 ${
                    readNativeDenom(token, chain).symbol
                  } from the Community Pool to fund the creation of public goods for the ${
                    networks[chain]?.name
                  } ecosystem`,
                )}
              />
            </FormItem>

            <FormItem
              label={
                <TooltipIcon
                  content={`To help push the proposal to the voting period, consider depositing more ${
                    readNativeDenom(token, chain).symbol
                  } to reach the minimum ${
                    Number(minDeposit) /
                    10 ** (readNativeDenom(token, chain).decimals ?? 6)
                  } ${readNativeDenom(token, chain).symbol} (optional).`}
                >
                  {t("Initial deposit")} ({t("optional")})
                </TooltipIcon>
              }
              extra={max.render()}
              error={errors.input?.message}
            >
              <Input
                {...register("input" as const, {
                  valueAsNumber: true,
                  validate: validate.input(
                    toInput(max.amount, decimals),
                    decimals,
                    "Initial deposit",
                    true,
                  ),
                })}
                type="number"
                token={token}
                onFocus={max.reset}
                inputMode="decimal"
              />
            </FormItem>

            {render()}
            {fee.render()}
            {submit.button}
          </Form>
        )}
      </Tx>
    </Card>
  )
}

export default SubmitProposalForm

const ESTIMATE = {
  TITLE: "Lorem ipsum",
  DESCRIPTION:
    "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
}
