"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendPoint {
  date: string;
  scans: number;
  leads: number;
  qualified: number;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink-500">
        対象期間のデータがありません
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#eef0f4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#667089" }}
            tickFormatter={(value: string) => value.slice(5)}
            tickLine={false}
            axisLine={{ stroke: "#dde1e9" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#667089" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #dde1e9", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="scans"
            name="QR読取"
            stroke="#3a63f0"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="leads"
            name="リード"
            stroke="#0f8a53"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="qualified"
            name="有効候補者"
            stroke="#b45309"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
