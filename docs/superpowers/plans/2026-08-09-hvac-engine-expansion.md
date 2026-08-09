# HVAC Thermal Load Calculator Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the Thermal Load Calculator into an industrial multi-standard application with persistent local material management, ASHRAE RTS/CTF, ISO 52016-1, and ABNT NBR 16401 calculation engines, 24-hour physical simulations (solar radiation, wind pressure infiltration, load diversity), Recharts 24h charts, jsPDF laudo generation, and a Vitest suite.

**Architecture:** A decoupled service layer (Physics, Engines, Material Service, PDF Generator) consuming pure TypeScript types and interfaces, powered by Vite middleware for local JSON persistence, connected to a sleek React industrial dashboard.

**Tech Stack:** React 18, TypeScript 5, Vite 6, Vitest 4, jsPDF, jspdf-autotable, Recharts, Lucide-React, Tailwind CSS.

## Global Constraints

- **Execution**: 100% local, no git push or external uploads without permission.
- **Dependencies**: Authorized `npm install jspdf jspdf-autotable recharts`.
- **Testing**: Vitest for all unit and integration tests (`npx vitest run`).
- **Persistence**: Local `src/data/materials.json` synced via Vite `/api/materials` dev server middleware.

---

### Task 1: Install Authorized NPM Dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: User permission for `jspdf`, `jspdf-autotable`, `recharts`.
- Produces: Installed NPM packages available for import.

- [ ] **Step 1: Run NPM Install command**

```bash
npm install jspdf jspdf-autotable recharts
```

- [ ] **Step 2: Verify installation in package.json and node_modules**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add jspdf, jspdf-autotable and recharts"
```

---

### Task 2: Vite Dev Server Middleware for Materials Persistence

**Files:**
- Modify: `vite.config.ts`
- Create: `src/data/materials.json`
- Test: `src/test/viteMiddleware.test.ts`

**Interfaces:**
- Consumes: Node `fs` module inside Vite dev server.
- Produces: `/api/materials` GET & POST endpoints reading/writing `src/data/materials.json`.

- [ ] **Step 1: Create initial `src/data/materials.json`**

```json
{
  "paredes": [
    { "id": "alvenaria_leve", "name": "Alvenaria Tijolo Baiano (6 furos - 10cm)", "uFactor": 2.9, "description": "Tijolo cerâmico furado sem isolamento adicional" },
    { "id": "alvenaria_pesada", "name": "Alvenaria Tijolo Maciço / Bloco Concreto (20cm)", "uFactor": 1.7, "description": "Alvenaria de alta capacidade térmica" },
    { "id": "drywall_isolado", "name": "Drywall com Lã de Rocha / Lã de Vidro (50mm)", "uFactor": 0.7, "description": "Gesso acartonado com excelente isolamento acústico e térmico" }
  ],
  "telhados": [
    { "id": "laje_simples", "name": "Laje de Concreto Simples (Sem Forro)", "uFactor": 3.5, "description": "Concreto armado sem isolamento adicional" },
    { "id": "laje_isolada", "name": "Laje de Concreto com EPS / PIR Isolante", "uFactor": 0.8, "description": "Laje com camada de EPS de 50mm" },
    { "id": "telha_fibro", "name": "Telha de Fibrocimento Simples", "uFactor": 7.0, "description": "Alta transmitância térmica direta" },
    { "id": "telha_ceram_forro", "name": "Telha Cerâmica com Forro de Gesso / Madeira", "uFactor": 2.5, "description": "Cobertura residencial tradicional" },
    { "id": "telhado_verde", "name": "Telhado Verde Extensivo (Vegetado)", "uFactor": 1.5, "description": "Camada de substrato vegetal com amortecimento de picos solares" }
  ],
  "vidros": [
    { "id": "simples", "name": "Vidro Simples Transparente (4mm a 6mm)", "uFactor": 5.7, "description": "Janelas e portas convencionais" },
    { "id": "duplo", "name": "Vidro Duplo Insulado com Câmara de Ar (6+12+6mm)", "uFactor": 2.8, "description": "Vidro insulado com câmara de argônio/ar seco" }
  ]
}
```

- [ ] **Step 2: Update `vite.config.ts` to add configureServer middleware**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-materials-api',
      configureServer(server) {
        server.middlewares.use('/api/materials', (req, res, next) => {
          const filePath = path.resolve(__dirname, 'src/data/materials.json');
          if (req.method === 'GET') {
            if (fs.existsSync(filePath)) {
              const data = fs.readFileSync(filePath, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(data);
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'File not found' }));
            }
          } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                fs.writeFileSync(filePath, body, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to write file' }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ]
});
```

- [ ] **Step 3: Run `npx tsc --noEmit` to verify syntax**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/data/materials.json vite.config.ts
git commit -m "feat: add vite dev server middleware for local materials.json persistence"
```

---

### Task 3: Expand `src/types/hvac.ts` for Multi-Standard & 24h Physics

**Files:**
- Modify: `src/types/hvac.ts`

**Interfaces:**
- Consumes: HVAC domain types.
- Produces: `StandardMode`, `HourlySolarData`, `HourlyLoadBreakdown`, `MaterialCatalog`, `HVACResult24h`.

- [ ] **Step 1: Add expanded interfaces to `src/types/hvac.ts`**

```ts
export type StandardMode = 'ABNT' | 'ASHRAE_RTS' | 'ISO_52016';

export interface MaterialOption {
  id: string;
  name: string;
  uFactor: number;
  description: string;
}

export interface MaterialCatalog {
  paredes: MaterialOption[];
  telhados: MaterialOption[];
  vidros: MaterialOption[];
}

export interface HourlySolarData {
  hour: number; // 0 to 23
  radiationDirect: number; // W/m²
  radiationDiffuse: number; // W/m²
  solarAltitude: number; // degrees
}

export interface HourlyLoadBreakdown {
  hour: number;
  infiltracao: number; // BTU/h
  pessoas: number; // BTU/h
  iluminacao: number; // BTU/h
  equipamentos: number; // BTU/h
  telhado: number; // BTU/h
  paredes: number; // BTU/h
  janelas: number; // BTU/h
  total: number; // BTU/h
}

export interface HVACResult24h extends HVACResult {
  standardMode: StandardMode;
  hourlyProfile: HourlyLoadBreakdown[];
  peakHour: number;
  peakTotalBTU: number;
}
```

- [ ] **Step 2: Run `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/types/hvac.ts
git commit -m "feat: expand hvac types for multi-standard engine and 24h simulation"
```

---

### Task 4: Material Service with Local FS & Fallback (`src/services/materialService.ts`)

**Files:**
- Create: `src/services/materialService.ts`
- Create: `src/test/materialService.test.ts`

**Interfaces:**
- Consumes: `/api/materials` and `MaterialCatalog`.
- Produces: `getMaterials()`, `saveMaterials()`, `addMaterial()`, `removeMaterial()`.

- [ ] **Step 1: Write failing test `src/test/materialService.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MaterialService } from '../services/materialService';
import { MaterialCatalog } from '../types/hvac';

describe('MaterialService - Persistência Local', () => {
  let service: MaterialService;

  beforeEach(() => {
    service = new MaterialService();
  });

  it('deve carregar os materiais padrão', async () => {
    const catalog = await service.getCatalog();
    expect(catalog.paredes.length).toBeGreaterThan(0);
    expect(catalog.telhados.length).toBeGreaterThan(0);
    expect(catalog.vidros.length).toBeGreaterThan(0);
  });

  it('deve adicionar um novo material de parede com sucesso', async () => {
    const initialCatalog = await service.getCatalog();
    const countBefore = initialCatalog.paredes.length;
    
    await service.addMaterial('paredes', {
      id: 'parede_isopor_custom',
      name: 'Painel EPS 100mm',
      uFactor: 0.35,
      description: 'Isolamento extremo de EPS'
    });

    const updatedCatalog = await service.getCatalog();
    expect(updatedCatalog.paredes.length).toBe(countBefore + 1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/test/materialService.test.ts`
Expected: FAIL ("MaterialService not found")

- [ ] **Step 3: Implement `src/services/materialService.ts`**

```ts
import { MaterialCatalog, MaterialOption } from '../types/hvac';
import initialMaterials from '../data/materials.json';

export class MaterialService {
  private catalog: MaterialCatalog;

  constructor() {
    this.catalog = JSON.parse(JSON.stringify(initialMaterials));
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const saved = localStorage.getItem('hvac_materials_catalog');
    if (saved) {
      try {
        this.catalog = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse local materials catalog', e);
      }
    }
  }

  public async getCatalog(): Promise<MaterialCatalog> {
    try {
      const res = await fetch('/api/materials');
      if (res.ok) {
        const data = await res.json();
        this.catalog = data;
        localStorage.setItem('hvac_materials_catalog', JSON.stringify(data));
      }
    } catch (err) {
      // Fallback to local memory / localStorage
    }
    return this.catalog;
  }

  public async saveCatalog(newCatalog: MaterialCatalog): Promise<boolean> {
    this.catalog = newCatalog;
    localStorage.setItem('hvac_materials_catalog', JSON.stringify(newCatalog));
    try {
      const res = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCatalog)
      });
      return res.ok;
    } catch (err) {
      return true; // Saved locally
    }
  }

  public async addMaterial(category: keyof MaterialCatalog, option: MaterialOption): Promise<MaterialCatalog> {
    const current = await this.getCatalog();
    current[category] = [...current[category].filter(m => m.id !== option.id), option];
    await this.saveCatalog(current);
    return current;
  }

  public async removeMaterial(category: keyof MaterialCatalog, id: string): Promise<MaterialCatalog> {
    const current = await this.getCatalog();
    current[category] = current[category].filter(m => m.id !== id);
    await this.saveCatalog(current);
    return current;
  }
}

export const defaultMaterialService = new MaterialService();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/materialService.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/materialService.ts src/test/materialService.test.ts
git commit -m "feat: implement MaterialService with local disk sync and fallback"
```

---

### Task 5: Physics Engines (Solar Radiation, Wind Infiltration, Load Diversity)

**Files:**
- Create: `src/calculation/physics/solarRadiation.ts`
- Create: `src/calculation/physics/windInfiltration.ts`
- Create: `src/calculation/physics/loadDiversity.ts`
- Create: `src/test/physics.test.ts`

**Interfaces:**
- Consumes: Orientation, Hour (0-23), Wind speed (m/s).
- Produces: `getHourlySolarRadiation()`, `getWindInfiltrationMultiplier()`, `getHourlyDiversityFactor()`.

- [ ] **Step 1: Write failing test `src/test/physics.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getHourlySolarRadiation } from '../calculation/physics/solarRadiation';
import { getWindInfiltrationMultiplier } from '../calculation/physics/windInfiltration';
import { getHourlyDiversityFactor } from '../calculation/physics/loadDiversity';

describe('HVAC Physics Engines 24h', () => {
  it('deve calcular radiação solar máxima próximo ao meio-dia para orientação Oeste', () => {
    const rad12 = getHourlySolarRadiation(12, 'oeste');
    const rad02 = getHourlySolarRadiation(2, 'oeste');
    expect(rad12).toBeGreaterThan(rad02);
  });

  it('deve aumentar infiltração de ar com maior velocidade do vento', () => {
    const multVentoBaixo = getWindInfiltrationMultiplier(2);
    const multVentoAlto = getWindInfiltrationMultiplier(10);
    expect(multVentoAlto).toBeGreaterThan(multVentoBaixo);
  });

  it('deve aplicar curva de diversidade comercial com pico à tarde', () => {
    const factorManha = getHourlyDiversityFactor(3, 'comercial_baixo');
    const factorTarde = getHourlyDiversityFactor(14, 'comercial_baixo');
    expect(factorTarde).toBeGreaterThan(factorManha);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/test/physics.test.ts`
Expected: FAIL ("modules not found")

- [ ] **Step 3: Implement physics modules**

`src/calculation/physics/solarRadiation.ts`:
```ts
import { Orientation } from '../../types/hvac';

export const getHourlySolarRadiation = (hour: number, orientation: Orientation): number => {
  if (hour < 6 || hour > 18) return 0; // Período noturno
  const peakHourMap: Record<Orientation, number> = {
    leste: 9,
    sul: 12,
    norte: 12,
    oeste: 15
  };
  const peak = peakHourMap[orientation] || 12;
  const maxRadMap: Record<Orientation, number> = {
    leste: 350,
    norte: 180,
    sul: 120,
    oeste: 380
  };
  const maxRad = maxRadMap[orientation] || 250;
  const deltaHour = Math.abs(hour - peak);
  return Math.max(0, Math.round(maxRad * Math.cos((deltaHour * Math.PI) / 8)));
};
```

`src/calculation/physics/windInfiltration.ts`:
```ts
export const getWindInfiltrationMultiplier = (windSpeedMS: number = 3.5): number => {
  // Pressão eólica P = 0.612 * V²
  const baseSpeed = 2.0;
  const ratio = Math.max(0.5, windSpeedMS / baseSpeed);
  return Number((1 + 0.15 * Math.pow(ratio, 1.2)).toFixed(2));
};
```

`src/calculation/physics/loadDiversity.ts`:
```ts
import { ActivityType } from '../../types/hvac';

export const getHourlyDiversityFactor = (hour: number, activity: ActivityType): number => {
  if (activity === 'residencial') {
    if (hour >= 22 || hour <= 6) return 1.0;
    if (hour >= 7 && hour <= 17) return 0.4;
    return 0.85; // Noite residencial
  }
  // Comercial
  if (hour < 7 || hour > 20) return 0.1;
  if (hour >= 9 && hour <= 17) return 1.0;
  return 0.5;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/physics.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/calculation/physics/ src/test/physics.test.ts
git commit -m "feat: implement 24h solar radiation, wind pressure infiltration, and load diversity physics"
```

---

### Task 6: Calculation Engines (ASHRAE RTS/CTF, ISO 52016-1, ABNT & Factory)

**Files:**
- Create: `src/calculation/engines/abntEngine.ts`
- Create: `src/calculation/engines/ashraeRtsEngine.ts`
- Create: `src/calculation/engines/isoEngine.ts`
- Create: `src/calculation/engines/hvacEngineFactory.ts`
- Create: `src/test/hvacEngines.test.ts`

**Interfaces:**
- Consumes: `HVACEnvironment`, `StandardMode`.
- Produces: `calculateHVAC24h(env, standardMode): HVACResult24h`.

- [ ] **Step 1: Write failing test `src/test/hvacEngines.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { calculateHVAC24h } from '../calculation/engines/hvacEngineFactory';
import { HVACEnvironment } from '../types/hvac';

const sampleEnv: HVACEnvironment = {
  id: 'env-test',
  name: 'Sala Teste Engines',
  area: 40,
  height: 3.0,
  occupants: 5,
  activity: 'comercial_baixo',
  zonaId: 3,
  lightingWatts: 300,
  hasRoof: true,
  roofType: 'laje_isolada',
  roofArea: 40,
  walls: [{ id: 1, area: 20, orientation: 'oeste', type: 'alvenaria_pesada' }],
  windows: [{ id: 1, area: 5, orientation: 'oeste', glassType: 'simples', protection: 0.6 }],
  equipment: [{ id: 1, name: 'PC', watts: 200, qty: 3 }]
};

describe('HVAC Engines Multinorma 24h', () => {
  it('deve calcular a curva 24h via ABNT NBR 16401', () => {
    const res = calculateHVAC24h(sampleEnv, 'ABNT');
    expect(res.hourlyProfile.length).toBe(24);
    expect(res.peakTotalBTU).toBeGreaterThan(10000);
  });

  it('deve calcular a curva 24h via ASHRAE RTS', () => {
    const res = calculateHVAC24h(sampleEnv, 'ASHRAE_RTS');
    expect(res.hourlyProfile.length).toBe(24);
    expect(res.standardMode).toBe('ASHRAE_RTS');
  });

  it('deve calcular a curva 24h via ISO 52016-1', () => {
    const res = calculateHVAC24h(sampleEnv, 'ISO_52016');
    expect(res.hourlyProfile.length).toBe(24);
    expect(res.standardMode).toBe('ISO_52016');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/test/hvacEngines.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement calculation engines**

`src/calculation/engines/abntEngine.ts`:
Refactor existing `calculateEnvironmentThermalLoad` into hourly 24h breakdown array.

`src/calculation/engines/ashraeRtsEngine.ts`:
Implement Radiant Time Series (RTS) damping and Conduction Transfer Functions (CTF) lag:
Apply 0.70 radiant delay factor over a 3-hour sliding window for internal heat gain and solar radiation through glass.

`src/calculation/engines/isoEngine.ts`:
Implement ISO 52016-1 hourly thermal balance:
Calculates transmission heat transfer coefficient $H_{tr} = U \cdot A$, ventilation heat loss coefficient $H_{ve}$, and solar gain coefficient $\Phi_{sol}$.

`src/calculation/engines/hvacEngineFactory.ts`:
```ts
import { HVACEnvironment, HVACResult24h, StandardMode } from '../../types/hvac';
import { calculateABNT24h } from './abntEngine';
import { calculateASHRAERTS24h } from './ashraeRtsEngine';
import { calculateISO24h } from './isoEngine';

export const calculateHVAC24h = (env: HVACEnvironment, mode: StandardMode = 'ABNT'): HVACResult24h => {
  switch (mode) {
    case 'ASHRAE_RTS':
      return calculateASHRAERTS24h(env);
    case 'ISO_52016':
      return calculateISO24h(env);
    case 'ABNT':
    default:
      return calculateABNT24h(env);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/hvacEngines.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/calculation/engines/ src/test/hvacEngines.test.ts
git commit -m "feat: implement ASHRAE RTS/CTF, ISO 52016-1, and ABNT engines in factory"
```

---

### Task 7: PDF Report Generator Service (`src/services/pdfReportGenerator.ts`)

**Files:**
- Create: `src/services/pdfReportGenerator.ts`
- Create: `src/test/pdfReportGenerator.test.ts`

**Interfaces:**
- Consumes: `ProjectInfo`, `HVACResult24h[]`.
- Produces: `generateHVACPDFReport(projectInfo, results): void`.

- [ ] **Step 1: Write failing test `src/test/pdfReportGenerator.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { generateHVACPDFReport } from '../services/pdfReportGenerator';
import { ProjectInfo, HVACResult24h } from '../types/hvac';

describe('pdfReportGenerator - Gerador de Laudos', () => {
  it('deve exportar a função de geração de laudo sem erros', () => {
    expect(typeof generateHVACPDFReport).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/test/pdfReportGenerator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/services/pdfReportGenerator.ts`**

```ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProjectInfo, HVACResult24h } from '../types/hvac';

export const generateHVACPDFReport = (project: ProjectInfo, results: HVACResult24h[]) => {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LAUDO TÉCNICO DE CARGA TÉRMICA HVAC', 14, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ABNT NBR 16401 / ASHRAE RTS / ISO 52016-1', 14, 25);

  // Info
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text(`Projeto: ${project.name}`, 14, 40);
  doc.text(`Cliente: ${project.client}`, 14, 46);
  doc.text(`Data: ${project.date}`, 150, 40);

  // Table
  const tableData = results.map(r => [
    r.name,
    r.standardMode,
    `${r.total.toLocaleString('pt-BR')} BTU/h`,
    `Pico às ${r.peakHour}h`,
    r.sugerida
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['Ambiente', 'Norma', 'Carga Pico (BTU/h)', 'Horário Pico', 'Equipamento Sugerido']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [8, 145, 178] } // cyan-600
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Página ${i} de ${pageCount} - Eng. Responsável CREA / Memory Report`, 14, 285);
  }

  doc.save(`Laudo_HVAC_${project.name.replace(/\s+/g, '_')}.pdf`);
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/pdfReportGenerator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/pdfReportGenerator.ts src/test/pdfReportGenerator.test.ts
git commit -m "feat: implement jsPDF report generator with autoTable for technical HVAC laudos"
```

---

### Task 8: UI Components (24h Chart, Material Manager Modal)

**Files:**
- Create: `src/components/Simulation24hChart.tsx`
- Create: `src/components/MaterialManagerModal.tsx`

**Interfaces:**
- Consumes: `HourlyLoadBreakdown[]`, `MaterialCatalog`.
- Produces: Recharts 24h AreaChart component and Material CRUD modal.

- [ ] **Step 1: Implement `src/components/Simulation24hChart.tsx`**

```tsx
import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { HourlyLoadBreakdown } from '../types/hvac';

interface Props {
  data: HourlyLoadBreakdown[];
}

export const Simulation24hChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="w-full h-80 bg-slate-900/80 p-4 rounded-2xl border border-slate-700 shadow-xl">
      <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
        📊 Perfil Térmico 24 Horas (Acumulado em BTU/h)
      </h3>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="hour" stroke="#94a3b8" tickFormatter={h => `${h}h`} />
          <YAxis stroke="#94a3b8" tickFormatter={val => `${(val / 1000).toFixed(0)}k`} />
          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
          <Legend />
          <Area type="monotone" dataKey="paredes" stackId="1" stroke="#f59e0b" fill="#f59e0b" name="Paredes" />
          <Area type="monotone" dataKey="janelas" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Janelas" />
          <Area type="monotone" dataKey="telhado" stackId="1" stroke="#10b981" fill="#10b981" name="Telhado" />
          <Area type="monotone" dataKey="equipamentos" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" name="Equipamentos" />
          <Area type="monotone" dataKey="pessoas" stackId="1" stroke="#ec4899" fill="#ec4899" name="Pessoas" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
```

- [ ] **Step 2: Implement `src/components/MaterialManagerModal.tsx`**

Modal overlay enabling inline addition, editing, and removal of materials with persistent write to `src/data/materials.json`.

- [ ] **Step 3: Run `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/Simulation24hChart.tsx src/components/MaterialManagerModal.tsx
git commit -m "feat: add 24h Recharts visualizer and Material Manager modal"
```

---

### Task 9: Refactor Main Calculator Dashboard UI (`ThermalLoadCalculator.tsx`)

**Files:**
- Modify: `src/components/ThermalLoadCalculator.tsx`

**Interfaces:**
- Consumes: `hvacEngineFactory`, `materialService`, `pdfReportGenerator`, `Simulation24hChart`.
- Produces: Integrated industrial dashboard UI.

- [ ] **Step 1: Connect Engine Selector (ABNT / ASHRAE RTS / ISO 52016), 24h Chart and PDF Export button**

Update `ThermalLoadCalculator.tsx` to include state for `standardMode`, render `Simulation24hChart`, provide "Gerar Laudo PDF" button invoking `generateHVACPDFReport`, and open `MaterialManagerModal`.

- [ ] **Step 2: Run `npx tsc --noEmit` and `npm run build`**

Run: `npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ThermalLoadCalculator.tsx
git commit -m "feat: integrate multi-standard selector, 24h chart, and PDF generator into main dashboard"
```

---

### Task 10: Complete Vitest Test Suite Execution & Final Verification

**Files:**
- Test: `src/test/`

**Interfaces:**
- Consumes: All modules in project.
- Produces: 100% passing test suite.

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: PASS all tests.

- [ ] **Step 2: Run production build check**

Run: `npm run build`
Expected: PASS with 0 errors.

- [ ] **Step 3: Final Commit**

```bash
git add .
git commit -m "chore: complete multi-standard HVAC engine expansion and verification"
```
