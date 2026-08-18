# ❄️ ThermalLoadCalculator — HVAC Thermal Pro Enterprise Edition

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-43.3-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%203D-black?logo=three.js&logoColor=white)](https://threejs.org/)
[![Vitest](https://img.shields.io/badge/Vitest-136%20Passed-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![ABNT NBR 16401](https://img.shields.io/badge/ABNT-NBR%2016401-orange.svg)]()
[![ASHRAE RTS](https://img.shields.io/badge/ASHRAE-RTS%2FCTF-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Enterprise Desktop & Web Application for HVAC Thermal Load Calculations, 24-Hour Continuous Dynamic Simulation, 3D WebGL Building Visualization (Three.js), 2D Vector CAD Editor, and ABNT NBR 16401 / ASHRAE / ISO 52016 Compliance.**

---

## 🌟 Overview

**ThermalLoadCalculator (HVAC Thermal Pro)** is a mechanical engineering calculation suite designed for HVAC engineers, thermal analysts, and building designers. It performs precision thermal load sizing, psychrometric envelope analysis, 24-hour peak curve forecasting, and 2D/3D building geometry integration.

---

## 🚀 Key Features

* ⚡ **Multi-Standard Thermal Engines**:
  * **ABNT NBR 16401-1:** Standard Brazilian method with calibrated thermal transfer coefficients ($U$) and psychrometrics.
  * **ASHRAE RTS (Radiant Time Series):** Conduction Time Factors (CTF) and dynamic radiative heat delay.
  * **ISO 52016-1:** Hourly dynamic thermal balance calculation.
* 🧊 **Interactive 3D WebGL Viewport (`HvacCadViewer.tsx`)**:
  * Powered by **Three.js** with camera presets (Isometric, Top/2D Floorplan, Front View).
  * Realistic architectural shading, transparent wall toggle, and strict GPU VRAM lifecycle management (`dispose()` on geometry, material, and textures).
* ✏️ **2D Parametric Vector CAD Editor (`HvacVectorCanvasEditor.tsx`)**:
  * Interactive HTML5 Canvas with grid snapping, orthogonal projection, door/window placement, and Shoelace polygon area calculation.
  * Native AutoCAD DXF (ASCII) and Wavefront OBJ 3D export.
* 📈 **Continuous 24-Hour Simulation (`Simulation24hChart.tsx`)**:
  * Hourly solar irradiation and thermal gain progression (00:00 to 23:00) with automatic peak load identification.
* 🌍 **Complete Bioclimatic Zone Catalog (ABNT NBR 15220)**:
  * Integrated database for all 8 Brazilian Bioclimatic Zones with design $\Delta T$, solar radiation indices, and relative humidity matrices.
* 📑 **Engineering PDF Report Generator**:
  * Generates professional, multi-page technical audit reports detailing cooling capacity (BTU/h & TR), equipment sizing, internal loads, and CREA/CONFEA ART registration fields.
* 🖥️ **Standalone Desktop Electron App**:
  * Hardened Electron runtime with context isolation, process sandboxing, and offline operation.

---

## 🏗️ Architecture

```
TermalLoadCalculator/
├── src/
│   ├── components/
│   │   ├── ThermalLoadCalculator.tsx      # Master calculator interface
│   │   ├── HvacCadViewer.tsx              # Three.js 3D viewport with VRAM cleanup
│   │   ├── HvacVectorCanvasEditor.tsx     # 2D parametric vector CAD editor
│   │   ├── Simulation24hChart.tsx         # 24h thermal simulation charts (Recharts)
│   │   └── HvacCadDxfImporter.tsx         # AutoCAD DXF parser
│   ├── utils/
│   │   ├── hvacCalculations.ts            # Mathematical core (NBR 16401 / ASHRAE)
│   │   └── pdfExport.ts                   # jsPDF technical report builder
│   ├── services/
│   │   ├── cadExporterService.ts          # DXF & OBJ 3D exporter
│   │   └── strixAuditService.ts           # SAST security validation service
│   ├── types/                             # Strict TypeScript interfaces
│   └── test/                              # 136 Vitest unit and integration tests
├── electron/
│   ├── main.cjs                           # Hardened Electron main process
│   └── preload.cjs                        # Isolated secure preload bridge
├── package.json
└── vite.config.ts
```

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18, TypeScript 5.8, Tailwind CSS |
| **Desktop Runtime** | Electron 43 (Context Isolated & Sandboxed) |
| **3D Rendering** | Three.js (WebGL), OrbitControls |
| **Data Visualization** | Recharts |
| **Document Processing** | jsPDF, jspdf-autotable |
| **Testing** | Vitest (136 unit & regression tests) |

---

## ⚡ Getting Started

### 1. Prerequisites
* Node.js `>= 18.0.0`
* npm or pnpm

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/lucasantannaeng/ThermalLoadCalculator.git
cd ThermalLoadCalculator

# Install dependencies
npm install

# Setup environment configuration
cp .env.example .env
```

### 3. Development Commands

```bash
# Start Web development server
npm run dev

# Start Electron Desktop development mode
npm run electron:dev
```

---

## 🧪 Testing & Desktop Build

```bash
# Run the 136 automated test suite
npm test

# Build production web bundle
npm run build

# Package standalone Windows executable (.exe)
npm run electron:build
```

---

## 📄 License

Licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
Authored by **Luca Rodrigues Gomes de Sant'Anna**.
