# Contexto de Negócio e Fundamentação Matemática — HVAC Thermal Load (v3.6.0 Parametric CAD, Dynamic Databases & Interactive Vector Editor Edition)

## 1. Visão Geral e Arquitetura da Versão v3.6.0
O **HVAC Thermal Load Pro (v3.6.0 Parametric CAD, Dynamic Databases & Interactive Vector Editor Edition)** é um sistema avançado de engenharia térmica para simulação e dimensionamento de carga térmica de climatização. Ele integra motores multi-norma (**ABNT NBR 16401-1**, **ABNT NBR 15220**, **ASHRAE RTS/CTF** e **ISO 52016-1**), editor vetorial interativo 2D com snap paramétrico (`HvacVectorCanvasEditor`), ingestão vetorial de plantas CAD (DXF / SVG), visualização 3D Three.js e assistente dinâmico Multi-AI Enterprise.

---

## 2. Fundamentação Matemática dos Motores de Cálculo

### 2.1 Condução através da Envoltória (Paredes e Telhado)
$$Q_{cond} = U \cdot A \cdot CLTD \cdot 3.41214 \quad [\text{BTU/h}]$$
- $U$: Transmitância térmica global do elemento $[\text{W}/(\text{m}^2 \cdot \text{K})]$
- $A$: Área útil de exposição $[\text{m}^2]$
- $CLTD$: Diferença de Temperatura Equivalente ajustada por cor, inércia térmica e insolação $[\text{K}]$

### 2.2 Radiação Solar por Superfícies Envidraçadas
$$Q_{rad} = A \cdot SHGF \cdot SC \cdot 3.41214 \quad [\text{BTU/h}]$$
- $SHGF$: Fator de Ganho de Calor Solar Máximo $[\text{W}/\text{m}^2]$
- $SC$: Coeficiente de Sombreamento Interno (Cortinas/Persianas)

### 2.3 Carga Sensível da Infiltração e Renovação de Ar
$$Q_{inf} = \left(\frac{V \cdot N_{trocas}}{3600}\right) \cdot \rho \cdot C_p \cdot \Delta T \cdot 3.41214 \quad [\text{BTU/h}]$$
- $V$: Volume do ambiente ($V = \text{Área} \times \text{Pé-direito}$) $[\text{m}^3]$
- $\rho$: Densidade do ar ($1.225 \text{ kg/m}^3$)
- $C_p$: Calor específico do ar ($1006 \text{ J/kg}\cdot\text{K}$)
- $\Delta T$: Diferença de temperatura de projeto externa/interna $[\text{K}]$

---

## 3. Algoritmos Vetoriais CAD & Editor Interativo 2D

### 3.1 Reconstrução Poligonal e Área Útil (Fórmula de Shoelace)
$$A = \frac{1}{2} \left| \sum_{i=1}^{n} (x_i y_{i+1} - x_{i+1} y_i) \right|$$
Calcula a área bidimensional exata dos limites dos recintos desenhados na camada `AMBIENTES` ou no canvas 2D.

### 3.2 Orientação Azimutal das Paredes (Vetor Norte)
$$\theta_{\text{normal}} = \arctan2(\Delta y, \Delta x) - \theta_{\text{Norte}}$$
Reorienta os vetores normais das superfícies externas registradas na camada `PAREDES` para as 8 direções solares cardeais e colaterais (N, NE, E, SE, S, SO, O, NO).

### 3.3 Algoritmo de Snapping em Parede & Projeção Ortogonal
$$\vec{p}_{\text{proj}} = \vec{A} + t \cdot (\vec{B} - \vec{A}), \quad t = \text{clamp}\left(\frac{(\vec{P} - \vec{A}) \cdot (\vec{B} - \vec{A})}{\|\vec{B} - \vec{A}\|^2}, 0, 1\right)$$
Determina a posição ortogonal exata de janelas e esquadrias sobre paredes no editor vetorial 2D.

---

## 4. Zonas Bioclimáticas Brasileiras (ABNT NBR 15220)

| Zona Bioclimática | Cidade de Referência | $\Delta T$ (°C) | Umidade Relativa Média |
| :---: | :---: | :---: | :---: |
| Zona 1 | Curitiba | 8 °C | 80% |
| Zona 2 | Rio de Janeiro | 10 °C | 75% |
| Zona 3 | São Paulo | 9 °C | 78% |
| Zona 4 | Brasília | 10 °C | 65% |
| Zona 5 | Cuiabá | 12 °C | 60% |
| Zona 6 | Salvador | 9 °C | 79% |
| Zona 7 | Teresina | 12 °C | 55% |
| Zona 8 | Manaus | 11 °C | 85% |

---

## 5. Distribuição e Executável Standalone
A aplicação é empacotada via Electron e Electron-Builder mantendo compatibilidade e preservando builds legadas:
- `release/ThermalLoadCalculator-v3.6.0.exe` e `release/ThermalLoadCalculator-Setup-v3.6.0.exe` *(Versão v3.6.0 Atual)*
- `release/ThermalLoadCalculator-v3.5.0.exe` e `release/ThermalLoadCalculator-Setup-v3.5.0.exe` *(Versão v3.5.0 Preservada)*


