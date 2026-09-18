"use client";

import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FundingHistoryPoint } from "@/lib/ledger";
import { CHAIN_TOKEN_SYMBOL } from "@/lib/chain";

export function FundingHistoryChart({ data }: { data: FundingHistoryPoint[] }) {
  const { t } = useTranslation();

  if (data.length <= 1) {
    return <p className="text-sm text-white/50">{t("charts.noData")}</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="received" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="disbursed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis
            dataKey="block"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
            tickFormatter={(block: number) => `#${block}`}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
            width={70}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)" }}
            labelFormatter={(label) => `Block #${label}`}
            formatter={(value) => [`${Number(value).toLocaleString()} ${CHAIN_TOKEN_SYMBOL}`, ""]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="received"
            name={t("dashboard.totalReceived")}
            stroke="#6366f1"
            fill="url(#received)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="disbursed"
            name={t("dashboard.totalDisbursed")}
            stroke="#10b981"
            fill="url(#disbursed)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
