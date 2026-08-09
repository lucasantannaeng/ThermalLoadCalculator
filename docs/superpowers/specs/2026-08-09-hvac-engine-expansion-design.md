# Design Specification: Thermal Load Calculator - Refatoração e Expansão Industrial

**Data**: 09 de Agosto de 2026  
**Autor**: Antigravity Full-Stack & DevSecOps Engineer  
**Status**: Proposto / Em Validação  

---

## 1. Visão Geral e Objetivos

O projeto **Thermal Load Calculator** será refatorado e expandido para se tornar uma solução industrial multinorma para cálculo de carga térmica HVAC. A nova arquitetura contemplará:

1. **Persistência em Disco Físico**: Integração do `MaterialService` com persistência em arquivo JSON local (`src/data/materials.json`) via middleware Vite Dev Server.
2. **Motores de Cálculo Multinorma**:
   - **ASHRAE RTS & CTF**: Radiant Time Series (fatores de atenuação radiante) e Conduction Transfer Functions (transiente 24h).
   - **ISO 52016-1 / ISO 13790**: Balanço térmico dinâmico de condução, radiação e trocas de ar.
   - **ABNT NBR 16401 & NBR 15220**: Método simplificado normativo nacional.
3. **Simulação Temporal & Física Avançada (24 Horas)**:
   - **Radiação Solar Horária**: Declinacão, ângulo de incidência e radiação direta/difusa em 8 orientações solares (N, S, L, O, NE, SE, NW, SW).
   - **Infiltração Variável pelo Vento**: Pressão eólica e vazão volumétrica dependente da velocidade do vento (m/s).
   - **Fatores de Diversidade de Carga**: Perfis horários de ocupação, iluminação e equipamentos.
4. **Interface Industrial Sleek (React + Tailwind)**:
   - Visual corporativo denso, seletor de normas ativas, tabelas dinâmicas, gráficos de simulação 24h interativos (Recharts) e modal de gestão de materiais.
5. **Emissão de Laudos em PDF (`jsPDF` + `jspdf-autotable`)**:
   - Geração de laudos técnicos em PDF contendo memórias de cálculo, curva 24h, detalhamento de materiais, breakdown de carga por componente e selo normativo.
6. **Suíte de Testes Automatizados (Vitest)**:
   - Cobertura completa de testes para motores ASHRAE, ISO, ABNT, `MaterialService` e modelos de radiação/vento.

---

## 2. Arquitetura do Sistema e Estrutura de Arquivos

```
D:\Projetos\TermalLoadCalculator\
├── vite.config.ts                   # Configurado com middleware fs para API local (/api/materials)
├── src/
│   ├── types/
│   │   └── hvac.ts                  # Interfaces unificadas multinorma, materiais, simulação 24h e PDF
│   ├── data/
│   │   ├── materials.json           # Banco de materiais persistido em disco
│   │   └── hvacPresets.ts           # Presets de zonas bioclimáticas brasileiras
│   ├── calculation/
│   │   ├── engines/
│   │   │   ├── ashraeRtsEngine.ts   # Motor ASHRAE RTS & CTF
│   │   │   ├── isoEngine.ts         # Motor ISO 52016-1 / 13790
│   │   │   ├── abntEngine.ts        # Motor ABNT NBR 16401 / 15220
│   │   │   └── hvacEngineFactory.ts # Orquestrador multinorma
│   │   └── physics/
│   │       ├── solarRadiation.ts    # Modelo de radiação solar horária
│   │       ├── windInfiltration.ts  # Infiltração dinâmica por pressão de vento
│   │       └── loadDiversity.ts     # Curvas horárias de simultaneidade e diversidade
│   ├── services/
│   │   ├── materialService.ts       # CRUD de materiais com sincronização fs/local
│   │   └── pdfReportGenerator.ts    # Gerador de relatórios técnicos PDF
│   ├── components/
│   │   ├── ThermalLoadCalculator.tsx# UI Principal desacoplada
│   │   ├── Simulation24hChart.tsx   # Gráfico 24h Recharts
│   │   ├── MaterialManagerModal.tsx # Modal CRUD de materiais
│   │   └── PDFPreviewModal.tsx      # Modal de emissão de laudo
│   └── test/
│       ├── ashraeRtsEngine.test.ts  # Testes ASHRAE RTS/CTF
│       ├── isoEngine.test.ts        # Testes ISO 52016-1
│       ├── materialService.test.ts  # Testes de persistência
│       ├── physics.test.ts          # Testes de radiação e vento 24h
│       └── hvacIntegration.test.ts  # Testes integrados multinorma
```

---

## 3. Especificação dos Motores de Cálculo

### 3.1 ASHRAE RTS (Radiant Time Series) & CTF
- **Condução nas Paredes/Telhados**:
  $$q_{\theta} = \sum_{j=0}^{n} Y_{j} \cdot (T_{sol-air, \theta-j} - T_{room})$$
  onde $Y_j$ são os coeficientes CTF e $T_{sol-air}$ é a temperatura equivalente ar-sol considerando absortividade solar.
- **Divisão Radiante/Convectiva**: Separação das parcelas radiantes (ex: 60% pessoas, 70% iluminação) submetidas aos fatores de atenuação radiante horários (Radiant Time Factors - RTF).

### 3.2 ISO 52016-1 / ISO 13790
- **Balanço Térmico Horário de Superfície**:
  $$H_{tr} \cdot (T_{ext} - T_{int}) + H_{ve} \cdot (T_{ext} - T_{int}) + \Phi_{sol} + \Phi_{int} = \Phi_{HC,nd}$$
  Cálculo das perdas/ganhos por transmissão, ventilação, ganhos solares diretos/difusos e ganhos internos.

### 3.3 ABNT NBR 16401 & 15220
- Método CLTD/SHGF com deltas de temperatura por zona bioclimática e transmitâncias U normativas.

---

## 4. Persistência de Materiais (`MaterialService`)

- O `vite.config.ts` será atualizado com um middleware que escuta `/api/materials` (GET e POST).
- O `POST /api/materials` grava os materiais atualizados diretamente no arquivo `D:\Projetos\TermalLoadCalculator\src\data\materials.json`.
- O `materialService.ts` faz `fetch('/api/materials')` no início e atualiza via `POST`, mantendo o `LocalStorage` como backup offline resiliente.

---

## 5. Suíte de Testes Automatizados (Vitest)

- Testes de motores de cálculo validando convergência de resultados ASHRAE RTS, ISO e ABNT.
- Testes dos modelos de física (variação solar de 0h a 23h, pressão eólica de 0 a 15 m/s, curvas de simultaneidade).
- Testes unitários do `MaterialService` garantindo inclusão, edição e remoção sem corromper o banco JSON.

---

## 6. Plano de Instalação de Pacotes

Conforme autorização concedida:
- `npm install jspdf jspdf-autotable`
- `npm install recharts`
