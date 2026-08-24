'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface ComparisonDatum {
  label: string;
  value: number;
}

export function ComparisonChart({
  data,
  valueLabel,
  color = '#2545e3',
}: {
  data: ComparisonDatum[];
  valueLabel: string;
  color?: string;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#334155' }}
            interval={0}
            angle={-15}
            textAnchor="end"
            height={50}
          />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip
            formatter={(value) => [Math.round(Number(value ?? 0)).toLocaleString('ja-JP'), valueLabel]}
            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
