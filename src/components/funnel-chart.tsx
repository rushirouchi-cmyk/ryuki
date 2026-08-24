'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface FunnelDatum {
  stage: string;
  count: number;
}

const COLORS = [
  '#93b1ff',
  '#6088ff',
  '#3b63f6',
  '#2545e3',
  '#1e35c4',
  '#1e2f9e',
  '#1e2d7c',
  '#16215c',
  '#111a47',
  '#0b1132',
];

export function FunnelChart({ data }: { data: FunnelDatum[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24, top: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis
            type="category"
            dataKey="stage"
            width={110}
            tick={{ fontSize: 11, fill: '#334155' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [Number(value ?? 0).toLocaleString('ja-JP'), '人']}
            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]}>
            {data.map((entry, index) => (
              <Cell key={entry.stage} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
