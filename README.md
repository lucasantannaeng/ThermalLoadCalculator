# ❄️ Thermal Load Calculator — HVAC Thermal Pro (Industrial v2.5)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg?logo=react)](https://reactjs.org/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1%20Passed-brightgreen.svg?logo=vitest)](https://vitest.dev/)
[![Build](https://img.shields.io/badge/Vite_Build-Passing-brightgreen.svg?logo=vite)](https://vitejs.dev/)
[![ABNT NBR 16401](https://img.shields.io/badge/ABNT-NBR%2016401-orange.svg)]()
[![ABNT NBR 15220](https://img.shields.io/badge/ABNT-NBR%2015220-orange.svg)]()
[![DevSecOps](https://img.shields.io/badge/DevSecOps-Audited%20%26%20Sanitized-brightgreen.svg)]()

**Thermal Load Calculator (HVAC Thermal Pro)** é uma aplicação corporativa de engenharia térmica desenvolvida para o dimensionamento preciso de sistemas de climatização segundo as normas **ABNT NBR 16401** e **ABNT NBR 15220**.

---

## 🚀 Novas Funcionalidades da Versão Industrial (v2.5)

- 🎨 **Interface Industrial Cyan-Dark**: Interface corporativa com abas de navegação, modais dinâmicos para inclusão de equipamentos e duplicador instantâneo de ambientes.
- 🌍 **Catálogo Amplo de Zonas Bioclimáticas (Zonas 1 a 8 - ABNT 15220)**: Cobertura completa de todas as regiões do Brasil com capitais e cidades de referência (São Paulo, Rio de Janeiro, Curitiba, Brasília, Cuiabá, Salvador, Teresina, Manaus, etc.), $\Delta T$ específico e umidade relativa média.
- 🧱 **Biblioteca de Materiais ABNT**: Consulta detalhada dos fatores $U$ de transmitância térmica para alvenarias de tijolos furados/maciços, blocos de concreto, drywall com isolamento, lajes simples/isoladas com EPS, telhas termoacústicas sandwich e vidros duplos insulados.
- ⚡ **Gestão & CRUD de Equipamentos Elétricos**: Cadastro customizado de fontes internas de calor (computadores, servidores rack, televisores LED, cafeteiras, projetores e iluminação).
- 📑 **Laudo Técnico com Memória de Cálculo**: Emissão de relatório formatado para impressão e exportação com estimativa de capacidade comercial em BTU/h e consumo elétrico em kW/h.

---

## 🧪 Testes Automatizados e Compilação

```bash
# Executar testes unitários (Vitest)
.\node_modules\.bin\vitest.cmd run

# Verificação estática de tipos (TypeScript)
.\node_modules\.bin\tsc.cmd --noEmit

# Compilar build de produção (Vite)
.\node_modules\.bin\vite.cmd build
```

**Resultado:** 🟢 **2/2 Testes Passaram** | **0 Erros de Compilação**.
