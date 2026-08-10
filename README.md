# ❄️ Thermal Load Calculator — HVAC Thermal Pro (v3.6.0 Parametric CAD, Dynamic Databases & Interactive Vector Editor Edition)

[![Version](https://img.shields.io/badge/Version-v3.6.0%20Parametric%20CAD-blue.svg)](https://github.com/hvac-thermal-pro)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg?logo=react)](https://reactjs.org/)
[![Electron](https://img.shields.io/badge/Electron-43.3-blue.svg?logo=electron)](https://www.electronjs.org/)
[![Vitest](https://img.shields.io/badge/Vitest-Passed-brightgreen.svg?logo=vitest)](https://vitest.dev/)
[![ABNT NBR 16401](https://img.shields.io/badge/ABNT-NBR%2016401-orange.svg)]()
[![ABNT NBR 15220](https://img.shields.io/badge/ABNT-NBR%2015220-orange.svg)]()

**Thermal Load Calculator (HVAC Thermal Pro — v3.6.0 Parametric CAD, Dynamic Databases & Interactive Vector Editor Edition)** é a solução corporativa definitiva de engenharia térmica para dimensionamento computacional, simulação contínua de carga térmica em sistemas HVAC e manipulação vetorial paramétrica segundo as normas **ABNT NBR 16401**, **ABNT NBR 15220**, **ASHRAE RTS/CTF** e **ISO 52016-1**.

---

## 🚀 Destaques da Versão v3.6.0 Parametric CAD, Dynamic Databases & Interactive Vector Editor Edition

- ✏️ **Editor Vetorial Interativo 2D & Desenho Paramétrico**: Canvas interativo HTML5 2D com ferramentas de desenho de ambientes, paredes e janelas, sistema de snapping em nó/grade, snapping em paredes com projeção ortogonal, ajuste dinâmico de dimensões e sincronização bi-direcional bidirecional com a lista de ambientes de cálculo.
- 📐 **Ingestão Vetorial CAD (DXF / SVG) & Visualização 3D (Three.js)**: Processador nativo para leitura de arquivos vetoriais AutoCAD ASCII (.dxf) e SVG com reconstrução 2D/3D de polígonos, cálculo de áreas por Fórmula de Shoelace, detecção de azimute do Norte geográfico e visualizador interativo Three.js.
- 🤖 **Integração Multi-AI Enterprise**: Assistência inteligente com integração a múltiplos provedores AI (OpenAI, Anthropic, Gemini, DeepSeek, Local Ollama) para diagnóstico térmico e parametrização dinâmica de sistemas HVAC.
- ⚡ **Motores Multi-Norma em Tempo Real**: Alternância instantânea entre **ABNT NBR 16401-1**, **ASHRAE RTS** (Radiant Time Series) e **ISO 52016-1** (Balanço Térmico Dinâmico Horário).
- 📈 **Simulação Física Contínua de 24 Horas**: Gráfico interativo (Recharts) com perfil dinâmico de ganho de calor (00:00h às 23:00h) e identificação automática do horário de pico térmico.
- 🌍 **Catálogo Bioclimático Completo (ABNT NBR 15220)**: Cobertura das 8 Zonas Bioclimáticas Brasileiras com $\Delta T$ calibrado e parâmetros psicrométricos regionais.
- 🧱 **Gestão de Transmitância Térmica ($U$) & Equipamentos**: Biblioteca editável de materiais de construção, envoltórias e esquadrias com persistência local e gestão de cargas internas.
- 📑 **Laudo Técnico PDF & ART CREA/CONFEA**: Emissão automatizada de relatório técnico com memorial de cálculo, detalhamento componente por componente, gráficos vetoriais e campo para ART do Engenheiro Mecânico.
- 🖥️ **Build Desktop Standalone Electron**: Executável otimizado para Windows (`ThermalLoadCalculator-v3.6.0.exe` e `ThermalLoadCalculator-Setup-v3.6.0.exe`).

---

## 🧪 Comandos de Desenvolvimento e Build

```bash
# Instalação de dependências
npm install

# Testes unitários (Vitest)
npm run test

# Verificação estática de tipos e bundle Vite
npm run build

# Execução em ambiente de desenvolvimento Electron
npm run electron:dev

# Compilação do executável desktop v3.6.0
npm run electron:build
```

---

## 📦 Distribuição e Executáveis Desktop

Os executáveis standalone portáteis gerados pela compilação Electron encontram-se no diretório de release:
- `release/ThermalLoadCalculator-v3.6.0.exe` e `release/ThermalLoadCalculator-Setup-v3.6.0.exe` *(Versão 3.6.0 Atual)*
- `release/ThermalLoadCalculator-v3.5.0.exe` e `release/ThermalLoadCalculator-Setup-v3.5.0.exe` *(Build Preservada v3.5.0)*

---

*Desenvolvido pela Equipe de Engenharia HVAC Thermal Pro — v3.6.0 Parametric CAD, Dynamic Databases & Interactive Vector Editor Edition.*
