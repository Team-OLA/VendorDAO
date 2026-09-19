"use client";

import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoryFundingSlice } from "@/lib/ledger";
import { CHAIN_TOKEN_SYMBOL } from "@/lib/chain";

const COLORS = [
  "#6366f1",
  "#FFC709",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
  "#a3a3a3",
];

export function CategoryBreakdownChart({ data }: { data: CategoryFundingSlice[] }) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return <p className="text-sm text-gray-500">{t("charts.noData")}</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#6b7280", fontSize: 12 }}
            tickFormatter={(v: number) => v.toLocaleString()}
          />
          <YAxis
            type="category"
            dataKey="category"
            tickFormatter={(c: string) => t(`vendorCategory.${c}`)}
            tick={{ fill: "#374151", fontSize: 12 }}
            width={120}
          />
          <Tooltip
            contentStyle={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.1)", color: "#111827" }}
            labelFormatter={(label) => t(`vendorCategory.${label}`)}
            formatter={(value) => [`${Number(value).toLocaleString()} ${CHAIN_TOKEN_SYMBOL}`, ""]}
          />
          <Bar dataKey="totalFunded" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
