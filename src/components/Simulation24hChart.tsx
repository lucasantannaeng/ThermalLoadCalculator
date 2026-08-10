import React, { useMemo, useCallback } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { Activity, Clock, Zap, TrendingUp, BarChart3, ShieldCheck } from 'lucide-react';
import { HourlyLoadBreakdown } from '../types/hvac';

interface Simulation24hChartProps {
  data: HourlyLoadBreakdown[];
}

const formatYAxis = (val: number) => {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
  return `${val}`;
};

const CustomTooltip = React.memo(({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const totalHourly = payload.reduce((acc: number, entry: any) => acc + (Number(entry.value) || 0), 0);

    return (
      <div className="bg-slate-950/95 border border-cyan-500/40 p-3.5 rounded-xl shadow-2xl backdrop-blur-xl text-xs space-y-2 min-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-mono text-cyan-400 font-bold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {String(label).padStart(2, '0')}:00h
          </span>
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 bg-cyan-950 text-cyan-300 rounded border border-cyan-800/50">
            Ciclo 24h
          </span>
        </div>

        <div className="space-y-1 py-1">
          {payload.map((entry: any, index: number) => {
            const val = Number(entry.value) || 0;
            const pct = totalHourly > 0 ? ((val / totalHourly) * 100).toFixed(1) : '0';
            return (
              <div key={`item-${index}`} className="flex justify-between items-center text-[11px]">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
                  {entry.name}
                </span>
                <span className="font-mono text-slate-200 font-medium">
                  {val.toLocaleString('pt-BR')} <span className="text-slate-500 text-[9px]">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs font-bold">
          <span className="text-slate-400">Carga Acumulada:</span>
          <span className="font-mono text-cyan-400 text-sm">
            {totalHourly.toLocaleString('pt-BR')} <span className="text-[10px] text-cyan-600">BTU/h</span>
          </span>
        </div>
      </div>
    );
  }
  return null;
});

CustomTooltip.displayName = 'CustomTooltip';

export const Simulation24hChart: React.FC<Simulation24hChartProps> = React.memo(({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-80 bg-slate-900/60 border border-slate-800/80 rounded-2xl flex items-center justify-center p-6 text-slate-400 font-mono text-xs">
        <Activity className="w-4 h-4 mr-2 text-cyan-500 animate-pulse" />
        Nenhum dado de simulação 24h disponível.
      </div>
    );
  }

  // Calculate Peak Metrics for Telemetry Bar
  const metrics = useMemo(() => {
    let maxLoad = 0;
    let peakHour = 0;
    let minLoad = Infinity;

    data.forEach(item => {
      if (item.total > maxLoad) {
        maxLoad = item.total;
        peakHour = item.hour;
      }
      if (item.total < minLoad) {
        minLoad = item.total;
      }
    });

    return {
      maxLoad,
      peakHour,
      minLoad: minLoad === Infinity ? 0 : minLoad
    };
  }, [data]);

  return (
    <div className="w-full bg-slate-900/70 p-5 rounded-2xl border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-4 font-sans">
      {/* Header & Dynamic Telemetry Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-widest">
              Perfil Térmico Dinâmico 24h
            </h3>
            <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-slate-950 text-cyan-400 border border-cyan-800/80 rounded flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" /> STRIX AUDIT BADGE
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Simulação contínua de ganho térmico acumulado (BTU/h) por componente ao longo do dia
          </p>
        </div>

        {/* Dynamic Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
          <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Pico Sol:</span>
            <span className="text-cyan-300 font-bold">{String(metrics.peakHour).padStart(2, '0')}:00h</span>
          </div>
          <div className="bg-slate-950/80 border border-cyan-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-[0_0_12px_rgba(6,182,212,0.1)]">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Carga Máxima:</span>
            <span className="text-amber-300 font-bold">{metrics.maxLoad.toLocaleString('pt-BR')} BTU/h</span>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Base Noturna:</span>
            <span className="text-emerald-300 font-bold">{metrics.minLoad.toLocaleString('pt-BR')} BTU/h</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradParedes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.7}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="gradJanelas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.7}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="gradTelhado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.7}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="gradEquipamentos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.7}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="gradPessoas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.7}/>
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="gradInfiltracao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.7}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="gradIluminacao" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.7}/>
                <stop offset="95%" stopColor="#eab308" stopOpacity={0.05}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.7} />
            <XAxis 
              dataKey="hour" 
              stroke="#475569" 
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(h) => `${String(h).padStart(2, '0')}h`}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis 
              stroke="#475569" 
              tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              tickFormatter={formatYAxis}
              unit=" BTU/h"
              width={70}
              axisLine={{ stroke: '#334155' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: 16, fontSize: 11, fontFamily: 'Inter' }}
              iconType="circle"
              iconSize={8}
            />

            <Area 
              type="monotone" 
              dataKey="paredes" 
              stackId="1" 
              stroke="#f59e0b" 
              strokeWidth={1.5}
              fill="url(#gradParedes)" 
              name="Paredes" 
            />
            <Area 
              type="monotone" 
              dataKey="janelas" 
              stackId="1" 
              stroke="#3b82f6" 
              strokeWidth={1.5}
              fill="url(#gradJanelas)" 
              name="Janelas" 
            />
            <Area 
              type="monotone" 
              dataKey="telhado" 
              stackId="1" 
              stroke="#10b981" 
              strokeWidth={1.5}
              fill="url(#gradTelhado)" 
              name="Telhado" 
            />
            <Area 
              type="monotone" 
              dataKey="equipamentos" 
              stackId="1" 
              stroke="#8b5cf6" 
              strokeWidth={1.5}
              fill="url(#gradEquipamentos)" 
              name="Equipamentos" 
            />
            <Area 
              type="monotone" 
              dataKey="pessoas" 
              stackId="1" 
              stroke="#f43f5e" 
              strokeWidth={1.5}
              fill="url(#gradPessoas)" 
              name="Pessoas" 
            />
            <Area 
              type="monotone" 
              dataKey="infiltracao" 
              stackId="1" 
              stroke="#06b6d4" 
              strokeWidth={1.5}
              fill="url(#gradInfiltracao)" 
              name="Infiltração" 
            />
            <Area 
              type="monotone" 
              dataKey="iluminacao" 
              stackId="1" 
              stroke="#eab308" 
              strokeWidth={1.5}
              fill="url(#gradIluminacao)" 
              name="Iluminação" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

Simulation24hChart.displayName = 'Simulation24hChart';

