// src/components/display/Tooltip.tsx

import { ReactNode, useMemo } from "react"
import { useLocation } from "react-router-dom"
import Tippy, { TippyProps } from "@tippyjs/react"
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined"
import { InlineFlex } from "../layout"

export const Popover = ({
  theme = "popover",
  appendTo,
  ...props
}: TippyProps) => {
  // Keep this hook (fine), but DO NOT use pathname as a key (causes remount churn)
  useLocation()

  // ✅ Make appendTo stable so Tippy doesn't see deps change shape between renders
  const stableAppendTo = useMemo<TippyProps["appendTo"]>(() => {
    return appendTo ?? (() => document.body)
  }, [appendTo])

  return (
    <Tippy
      theme={theme}
      arrow={theme !== "none"}
      trigger="click"
      animation={false}
      maxWidth={360}
      interactive
      appendTo={stableAppendTo}
      {...props}
    />
  )
}

const Tooltip = ({ appendTo, ...props }: TippyProps) => {
  const stableAppendTo = useMemo<TippyProps["appendTo"]>(() => {
    return appendTo ?? (() => document.body)
  }, [appendTo])

  return <Tippy {...props} appendTo={stableAppendTo} animation={false} />
}

export default Tooltip

/* derive */
interface Props extends Omit<TippyProps, "children"> {
  children?: ReactNode
}

export const TooltipIcon = (props: Props) => {
  return (
    <InlineFlex gap={4} start>
      {props.children}
      <Tooltip {...props}>
        <HelpOutlineOutlinedIcon fontSize="inherit" className="muted" />
      </Tooltip>
    </InlineFlex>
  )
}
