"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AX = { fontSize: 11, fill: "#93877c" };
const TT = { contentStyle: { background: "#faf8f3", border: "1px solid #e2d8c7", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 16px rgb(41 35 31 / .08)" }, labelStyle: { color: "#4b3a2e", fontWeight: 600 } };
const yr = (d: string) => d.slice(0, 4);

export function Spark({ data, k, color = "#c6613f", h = 64 }: { data: Record<string, number | string>[]; k: string; color?: string; h?: number }) {
  return (
    <div style={{ height: h }} aria-hidden>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs><linearGradient id={`g${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={0.18} /><stop offset="1" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type="monotone" dataKey={k} stroke={color} strokeWidth={1.6} fill={`url(#g${k})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Equity({ data, a = "s", b = "b", aLabel = "Strategy", bLabel = "Buy & hold", h = 300 }: { data: Record<string, number | string>[]; a?: string; b?: string; aLabel?: string; bLabel?: string; h?: number }) {
  return (
    <div style={{ height: h }} role="img" aria-label={`Growth of $1: ${aLabel} vs ${bLabel}, log scale`}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#e2d8c7" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="d" tickFormatter={yr} tick={AX} tickLine={false} axisLine={{ stroke: "#ddd2bf" }} minTickGap={40} />
          <YAxis scale="log" domain={["auto", "auto"]} allowDataOverflow tick={AX} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v >= 10 ? v.toFixed(0) : v.toFixed(1))} />
          <Tooltip {...TT} formatter={((v: number, n: string) => [`$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`, n === a ? aLabel : bLabel]) as never} />
          <Line type="monotone" dataKey={b} stroke="#b9ab98" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey={a} stroke="#c6613f" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Drawdown({ data, h = 120 }: { data: Record<string, number | string>[]; h?: number }) {
  return (
    <div style={{ height: h }} role="img" aria-label="Strategy drawdown from peak">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
          <XAxis dataKey="d" tickFormatter={yr} tick={AX} tickLine={false} axisLine={false} minTickGap={40} />
          <YAxis tick={AX} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip {...TT} formatter={((v: number) => [`${v}%`, "Drawdown"]) as never} />
          <Area type="monotone" dataKey="dd" stroke="#b0453a" strokeWidth={1.2} fill="#b0453a" fillOpacity={0.12} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Bars({ data, k, label, h = 220, fmt = (v: number) => `${v}%`, ref0 = true, highlight }: { data: Record<string, number | string>[]; k: string; label: string; h?: number; fmt?: (v: number) => string; ref0?: boolean; highlight?: string }) {
  return (
    <div style={{ height: h }} role="img" aria-label={label}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#e2d8c7" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="name" tick={AX} tickLine={false} axisLine={{ stroke: "#ddd2bf" }} interval={0} />
          <YAxis tick={AX} tickLine={false} axisLine={false} width={52} tickFormatter={fmt} />
          {ref0 && <ReferenceLine y={0} stroke="#93877c" />}
          <Tooltip {...TT} cursor={{ fill: "#ebe3d5", opacity: 0.5 }} formatter={((v: number) => [fmt(v), label]) as never} />
          <Bar dataKey={k} radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false}>
            {data.map((d, i) => <Cell key={i} fill={(d[k] as number) < 0 ? "#b0453a" : d.name === highlight ? "#c6613f" : "#d9c3ac"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SensChart({ data, bh, label }: { data: { p: number | string; train_sharpe: number; test_sharpe: number }[]; bh: number; label: string }) {
  return (
    <div style={{ height: 200 }} role="img" aria-label={label}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#e2d8c7" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="p" tick={AX} tickLine={false} axisLine={{ stroke: "#ddd2bf" }} />
          <YAxis tick={AX} tickLine={false} axisLine={false} width={40} domain={[(m: number) => Math.min(0, m - 0.1), (m: number) => m + 0.1]} tickFormatter={(v: number) => v.toFixed(1)} />
          <ReferenceLine y={bh} stroke="#93877c" strokeDasharray="4 3" label={{ value: "buy & hold (test)", position: "insideTopRight", fontSize: 10, fill: "#93877c" }} />
          <Tooltip {...TT} formatter={((v: number, n: string) => [v.toFixed(2), n === "train_sharpe" ? "Train Sharpe" : "Test Sharpe"]) as never} />
          <Line dataKey="train_sharpe" stroke="#b9ab98" strokeWidth={1.5} dot={{ r: 2.5 }} isAnimationActive={false} />
          <Line dataKey="test_sharpe" stroke="#c6613f" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
