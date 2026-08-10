# Relatório de Lançamento e Build Desktop Standalone — HVAC Thermal Load Pro (v3.5.0 Parametric CAD & Interactive Vector Editor Edition)

> **Data de Lançamento:** 09/08/2026  
> **Versão Oficial:** v3.5.0  
> **Título da Edição:** Parametric CAD & Interactive Vector Editor Edition  
> **Responsável:** Subagente Release Manager  
> **Status de Qualidade:** APPROVED & ZERO-DEFECT COMPLIANT (108/108 Testes Passados)  

---

## 1. Sumário Executivo

Este relatório documenta o processo de versionamento, atualização documental, verificação de regressão e compilação do executável desktop da versão **v3.5.0 (Parametric CAD & Interactive Vector Editor Edition)** do aplicativo **HVAC Thermal Load Pro**.

Todas as metas especificadas foram concluídas com êxito:
1. **Versionamento em `package.json`**: Atualizado para `"version": "3.5.0"`.
2. **Atualização da Documentação**: Os arquivos `README.md`, `MANUAL_USUARIO.md` e `contexto.md` foram inteiramente atualizados refletindo as inovações da versão v3.5.0.
3. **Build Desktop Electron (`npm run electron:build`)**: O executável portável `ThermalLoadCalculator-v3.5.0.exe` e o instalador NSIS `ThermalLoadCalculator-Setup-v3.5.0.exe` foram compilados com sucesso.
4. **Preservação de Artifacts Anteriores**: Todos os arquivos e executáveis legados da versão v3.0 em `release/` foram preservados sem deleção.

---

## 2. Inventário de Arquivos em `release/`

| Nome do Executável / Arquivo | Versão | Tamanho (Bytes) | Descrição do Artifact |
| :--- | :---: | :---: | :--- |
| **`ThermalLoadCalculator-v3.5.0.exe`** | **v3.5.0** | **113.322.187** | **Executável Desktop Portável (Standalone Windows x64)** |
| **`ThermalLoadCalculator-Setup-v3.5.0.exe`** | **v3.5.0** | **113.552.047** | **Instalador NSIS com Assistente de Instalação (Windows x64)** |
| `ThermalLoadCalculator-v3.0.0.exe` | v3.0.0 | 113.313.802 | Executável Desktop Portável Legado (Preservado) |
| `ThermalLoadCalculator-Setup-v3.0.0.exe` | v3.0.0 | 113.543.649 | Instalador NSIS Legado (Preservado) |
| `ThermalLoadCalculator 1.0.0.exe` | v1.0.0 | 113.309.503 | Executável Desktop Portável Legado (Preservado) |
| `ThermalLoadCalculator Setup 1.0.0.exe` | v1.0.0 | 113.539.442 | Instalador NSIS Legado (Preservado) |

---

## 3. Resumo dos Destaques Técnicos da Versão v3.5.0

- ✏️ **Editor Vetorial Interativo 2D (`HvacVectorCanvasEditor`)**: Canvas HTML5 2D com ferramentas avançadas para adição gráfica de recintos, segmentos de parede e esquadrias.
- 🎯 **Algoritmo de Snapping Inteligente**: Suporte a snapping em grade métrica, vértices existentes e snapping em parede hospedeira com distância ortogonal e projeção vetorial.
- 🔄 **Sincronização Bi-Direcional Paramétrica em Tempo Real (`ParametricCadSyncService`)**: Sincronização automática entre o Canvas 2D, a Visualização 3D (Three.js) e a Simulação Térmica 24h.
- 📐 **Ingestão Vetorial CAD (DXF / SVG) & Shoelace Area Engine**: Leitura nativa de arquivos AutoCAD ASCII e SVG com reconstrução poligonal 2D/3D e cálculo de azimute do Norte solar.
- 🤖 **Assistente Multi-AI Enterprise**: Suporte a múltiplos provedores LLM (OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Local Ollama) para recomendação técnica de climatização.
- ⚡ **Motores Térmicos Multi-Norma em Tempo Real**: Alternância em um clique entre **ABNT NBR 16401-1**, **ASHRAE RTS** e **ISO 52016-1**.
- 📑 **Laudo Técnico PDF & Anotação de Responsabilidade Técnica (ART)**: Emissão automatizada de laudo PDF com resumo executivo, gráficos 24h vetoriais e seção oficial CREA/CONFEA.

---

## 4. Resultado dos Testes de Regressão e Verificação (Vitest & Build)

### 4.1 Testes Unitários (Vitest Execution Output)
```
 ✓ src/test/strixSecurity.test.ts (12 tests)
 ✓ src/test/materialService.test.ts (8 tests)
 ✓ src/test/hvac.test.ts (2 tests)
 ✓ src/test/vectorEditor.test.ts (18 tests)
 ✓ src/test/hvacEngines.test.ts (7 tests)
 ✓ src/test/parametricSync.test.ts (7 tests)
 ✓ src/test/pdfReportGenerator.test.ts (6 tests)
 ✓ src/test/cadImporter.test.ts (10 tests)
 ✓ src/test/aiProvider.test.ts (12 tests)
 ✓ src/test/forgeCad.test.ts (11 tests)
 ✓ src/test/physics.test.ts (11 tests)
 ✓ src/test/cadIntegration.test.ts (4 tests)

 Test Files  12 passed (12)
      Tests  108 passed (108)
```

### 4.2 Compilação Web (Vite Bundle) & Build Electron
- **Vite Bundle Production Output**: `dist/index.html` e chunks JS minificados sem erros de bundling.
- **Electron Builder Output**: `ThermalLoadCalculator-v3.5.0.exe` e `ThermalLoadCalculator-Setup-v3.5.0.exe` gerados com exit code `0`.

---

## 5. Homologação Final

A versão **v3.5.0 (Parametric CAD & Interactive Vector Editor Edition)** do **HVAC Thermal Load Pro** está totalmente validada, documentada e disponibilizada no diretório `release/`.

*Relatório gerado automaticamente pelo Subagente Release Manager.*
