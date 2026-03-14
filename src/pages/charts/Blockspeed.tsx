import { interval } from "date-fns/interval"
import { useEffect, useState } from "react"

interface BlockSpeedProps {
  chainID: string
}

interface BlockSpeedData {
  chainID: string
  current_block_time: number
  average_24h: number
  target_block_time: number
  status: string
}

const cardStyle: React.CSSProperties = {
  background: "var(--card-bg, #171b26)",
  border: "1px solid var(--card-border, rgba(255,255,255,0.08))",
  borderRadius: "12px",
  padding: "16px",
  minHeight: "140px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
}

const titleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  opacity: 0.8,
  marginBottom: "10px",
}

const bigValueStyle: React.CSSProperties = {
  fontSize: "30px",
  fontWeight: 700,
  lineHeight: 1.1,
}

const subTextStyle: React.CSSProperties = {
  fontSize: "13px",
  opacity: 0.75,
  marginTop: "6px",
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  fontSize: "13px",
  marginTop: "8px",
}

const statusStyle = (status?: string): React.CSSProperties => {
  let color = "#9aa4b2"

  if (status === "Healthy") color = "#22c55e"
  if (status === "Slightly Slow") color = "#f59e0b"
  if (status === "Degraded") color = "#ef4444"

  return {
    fontWeight: 700,
    color,
  }
}

const BlockSpeed = ({ chainID }: BlockSpeedProps) => {
  const [data, setData] = useState<BlockSpeedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    const fetchBlockSpeed = async () => {
      try {
        setLoading(true)
        setError("")

        const response = await fetch(
          `http://localhost:3001/api/blockspeed?chainID=${chainID}`,
        )

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const json: BlockSpeedData = await response.json()

        if (mounted) {
          setData(json)
        }
      } catch (err) {
        console.error("Block speed fetch error:", err)
        if (mounted) {
          setError("Failed to load")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchBlockSpeed()

    return () => {
      mounted = false
    }
  }, [chainID])

  return (
    <div style={cardStyle}>
      <div>
        <div style={titleStyle}>Block Speed</div>

        {loading ? (
          <div style={subTextStyle}>Loading...</div>
        ) : error ? (
          <div style={subTextStyle}>{error}</div>
        ) : (
          <>
            <div style={bigValueStyle}>
              {data?.current_block_time?.toFixed(2) ?? "--"}s
            </div>
            <div style={subTextStyle}>Current block time</div>
          </>
        )}
      </div>

      {!loading && !error && (
        <div>
          <div style={rowStyle}>
            <span>24h Average</span>
            <span>{data?.average_24h?.toFixed(2) ?? "--"}s</span>
          </div>

          <div style={rowStyle}>
            <span>Target</span>
            <span>{data?.target_block_time?.toFixed(2) ?? "--"}s</span>
          </div>

          <div style={rowStyle}>
            <span>Status</span>
            <span style={statusStyle(data?.status)}>
              {data?.status ?? "--"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default BlockSpeed
