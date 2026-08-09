# Contexto de Negócio e Fundamentação Matemática — HVAC Thermal Load

## 1. Fundamentação Normativa (ABNT NBR 16401-1 e NBR 15220)
O cálculo da carga térmica residencial e comercial visa determinar o ganho de calor total (em Watts ou BTU/h) para dimensionamento correto de equipamentos de climatização.

---

## 2. Equações do Motor de Cálculo

### 2.1 Condução através da Envoltória (Paredes e Telhado)
$$Q_{cond} = U \cdot A \cdot CLTD \cdot 3.41214 \quad [\text{BTU/h}]$$
- $U$: Transmitância térmica do elemento $[\text{W}/(\text{m}^2 \cdot \text{K})]$
- $A$: Área útil $[\text{m}^2]$
- $CLTD$: Diferença de Temperatura Equivalente por Orientação $[\text{K}]$

### 2.2 Radiação Solar por Superfícies Vidadas
$$Q_{rad} = A \cdot SHGF \cdot SC \cdot 3.41214 \quad [\text{BTU/h}]$$
- $SHGF$: Fator de Ganho de Calor Solar Máximo $[\text{W}/\text{m}^2]$
- $SC$: Coeficiente de Sombreamento Interno (Cortinas/Persianas)

### 2.3 Carga Sensível da Infiltração/Renovação de Ar
$$Q_{inf} = \left(\frac{V \cdot N_{trocas}}{3600}\right) \cdot \rho \cdot C_p \cdot \Delta T \cdot 3.41214 \quad [\text{BTU/h}]$$
- $V$: Volume do ambiente ($m^3$)
- $\rho$: Densidade do ar ($1.225 \text{ kg/m}^3$)
- $C_p$: Calor específico do ar ($1006 \text{ J/kg}\cdot\text{K}$)

---

## 3. Zonas Bioclimáticas Brasileiras ($\Delta T$ de Projeto)

| Zona Bioclimática | Exemplo de Cidade | $\Delta T$ (°C) |
| :---: | :---: | :---: |
| Zona 1 | Curitiba | 8 |
| Zona 2 | Rio de Janeiro | 10 |
| Zona 3 | São Paulo | 9 |
| Zona 4 | Brasília | 10 |
| Zona 5 | Cuiabá | 12 |
| Zona 6 | Salvador | 9 |
| Zona 7 | Teresina | 12 |
| Zona 8 | Manaus | 11 |
