# Manual do Usuário — Calculadora e Simulação de Carga Térmica HVAC Pro (Multi-Norma 24h)

> **Versão do Sistema:** 1.0.0 Pro Industrial  
> **Normas de Referência:** ABNT NBR 16401-1 / NBR 15220 • ASHRAE RTS / CTF • ISO 52016-1  
> **Documento:** Guia Técnico e Manual de Operação do Usuário  

---

## 1. Visão Geral e Apresentação do Sistema

O **HVAC Thermal Load Pro** é uma solução computacional avançada desenvolvida para engenheiros mecânicos, projetistas de climatização e consultores de eficiência energética. O sistema realiza o dimensionamento preciso da **Carga Térmica de Refrigeração** (expressa em **BTU/h**, **TR — Toneladas de Refrigeração** e **kW**) para edifícios residenciais, comerciais e industriais.

Diferente de calculadoras simplificadas de "regra de bolso" (como 600 BTU/m²), o **HVAC Thermal Load Pro** executa uma **simulação física contínua de 24 horas**, considerando a variação do ângulo de incidência solar, a inércia térmica da envoltória (massa das paredes e coberturas), a taxa e variação eólica para infiltração de ar, o perfil de ocupação e a dissipação de equipamentos elétricos.

```
       +-----------------------------------------------------------------------+
       |                         HVAC THERMAL LOAD PRO                         |
       |                     Engine Simulação Física 24h                       |
       +-----------------------------------------------------------------------+
           |                               |                               |
           v                               v                               v
    +--------------+               +---------------+               +---------------+
    |  ABNT NBR    |               |  ASHRAE RTS / |               |  ISO 52016-1  |
    | 16401 / 15220|               |      CTF      |               |  Dynamic Bal  |
    +--------------+               +---------------+               +---------------+
           |                               |                               |
           +-------------------------------+-------------------------------+
                                           |
                                           v
                        +-------------------------------------+
                        | - Gráfico Interativo Recharts 24h   |
                        | - Gestão de Materiais U (Local API) |
                        | - Laudo Técnico PDF com ART CREA    |
                        +-------------------------------------+
```

### Principais Funcionalidades:
- **Motores Multi-Norma em Tempo Real:** Alterne dinamicamente entre **ABNT NBR 16401**, **ASHRAE RTS** e **ISO 52016-1**.
- **Simulação Térmica 24 Horas:** Visualização gráfica acumulada dos ganhos de calor hora a hora (00:00h às 23:00h) com identificação automática do horário de pico.
- **Zonas Bioclimáticas Brasileiras (NBR 15220):** Mapeamento completo das 8 Zonas Bioclimáticas com $\Delta T$ ajustado para diversas capitais brasileiras.
- **Gestão de Materiais e Transmitância Térmica ($U$):** Modificação e cadastro personalizado de materiais de paredes, coberturas e vidros com persistência em disco local (`materials.json`).
- **Geração de Laudo Técnico Profissional (PDF):** Relatório técnico detalhado com resumo executivo, tabela de componentes, gráfico de 24h e campo para visto/assinatura de ART perante o CREA/CONFEA.

---

## 2. Fundamentação Normativa e Motores de Cálculo

O sistema conta com três motores independentes de cálculo para atender a diferentes requisitos normativos e níveis de detalhamento técnico:

### 2.1 ABNT NBR 16401-1 / NBR 15220 (Norma Brasileira)
- Baseia-se no método de **CLTD** (*Cooling Load Temperature Difference*) e **SHGF** (*Solar Heat Gain Factor*).
- Aplica a diferença de temperatura equivalente ajustada pela cor da superfície da parede/telhado e insolação local.
- Integra o zoneamento bioclimático da **NBR 15220**, considerando as condições psicrométricas de projeto do Brasil.

### 2.2 ASHRAE RTS / CTF (Radiant Time Series & Conduction Transfer Functions)
- Método rigoroso desenvolvido pela *American Society of Heating, Refrigerating and Air-Conditioning Engineers*.
- Decompõe a carga em frações **Convectivas** (instantâneas) e **Radiantes** (retardadas no tempo devido ao armazenamento de calor na estrutura).
- Aplica coeficientes de transferência de condução (*CTF*) com janela deslizante de inércia térmica, suavizando o pico de calor solar e radiante.

### 2.3 ISO 52016-1 (Energy Performance of Buildings — Hourly Method)
- Norma internacional para cálculo dinâmico de desempenho térmico horário.
- Avalia o balanço contínuo entre:
  - Coeficiente de transferência por transmissão ($H_{tr} = U \cdot A$).
  - Coeficiente de transferência por ventilação/infiltração ($H_{ve}$).
  - Ganhos internos e solares efetivos ($\Phi_{sol}$).

---

## 3. Arquitetura da Aplicação e Interface

A interface do usuário foi projetada no conceito **Industrial Dark Mode**, oferecendo alta legibilidade em ambientes de engenharia e campo:

```
+-----------------------------------------------------------------------------------+
|  HVAC THERMAL LOAD PRO   [ENGINE: ABNT 16401]     (Simulação 24h | Materiais U)   |
+-----------------------------------------------------------------------------------+
| Pico Total: 84.500 BTU/h | 24,8 kW/h est. | Engine: ABNT 16401 | [Laudo PDF]      |
+-----------------------------------------------------------------------------------+
| 1. Geometria & Ocupação   | 2. Envoltória & Cobertura | 3. Aberturas & Elétricos  |
| - Área: 35 m²             | - Telhado: Laje Isolada   | - Iluminação: 250 W       |
| - Ocupantes: 8 Pessoas    | - Parede Oeste: 15 m²     | - Janela Oeste: 4 m²      |
+-----------------------------------------------------------------------------------+
|                   Simulação 24h - Perfil Térmico (Recharts)                       |
|   [========================= Area Chart acumulado 00h-23h =====================]  |
+-----------------------------------------------------------------------------------+
```

---

## 4. Guia Passo a Passo de Operação

### 4.1 Passo 1: Cadastro das Informações do Projeto
1. Na barra superior do formulário, preencha o **Identificador do Projeto** (ex: *Edifício Corporativo - Sala de Reunião*).
2. Preencha o nome do **Cliente / Proprietário** (ex: *Empresa Cliente LTDA*).
3. A **Data de Emissão** é preenchida automaticamente com a data atual.

### 4.2 Passo 2: Seleção da Norma de Cálculo (Engine Selector)
No canto superior direito do cabeçalho, selecione a norma desejada:
- Botão **ABNT 16401**: Aplica as tabelas e equações da norma brasileira.
- Botão **ASHRAE RTS**: Ativa a amortização radiante por inércia estrutural.
- Botão **ISO 52016**: Ativa o balanço térmico dinâmico internacional.

> **Dica de Engenharia:** Compare os resultados entre normas com um único clique. O motor de cálculo recalcula instantaneamente toda a curva de 24 horas.

### 4.3 Passo 3: Configuração dos Ambientes

Para cada ambiente do projeto, configure os três blocos principais:

#### A. Geometria & Ocupação
- **Área ($m^2$):** Área útil do piso do ambiente.
- **Pé-Direito ($m$):** Altura livre do ambiente (utilizado para cálculo do volume de ar e taxa de infiltração).
- **Ocupantes (Pessoas):** Número máximo estimado de pessoas presentes no horário de pico.
- **Atividade Operacional:** Escolha entre:
  - *Residencial / Repouso* (115 W/pessoa)
  - *Escritório / Administrativo* (130 W/pessoa)
  - *Loja / Shopping / Comércio* (150 W/pessoa)
  - *Cozinha / Espaço Gourmet* (130 W/pessoa)
- **Zona Bioclimática (NBR 15220):** Selecione a cidade/região correspondente (ex: *Zona 3 - São Paulo, ΔT=9°C*).

#### B. Envoltória & Cobertura
- **Exposição ao Telhado:** Marque esta opção caso o ambiente possua cobertura direta exposta ao sol.
- **Tipo de Cobertura:** Selecione o elemento construtivo (ex: *Laje de Concreto com EPS/PIR*, *Telha Cerâmica com Forro*, *Telhado Verde*).
- **Paredes Externas:** Adicione as paredes em contato com o ambiente externo clicando em `+ Parede`. Informe:
  - Área da parede ($m^2$).
  - Orientação Solar (Norte, Sul, Leste, Oeste).
  - Tipo Construtivo (*Alvenaria Leve*, *Alvenaria Pesada*, *Drywall Isolado*).

#### C. Aberturas & Cargas Elétricas
- **Carga de Iluminação (Watts):** Potência total das lâmpadas e luminárias instaladas.
- **Janelas / Esquadrias:** Clique em `+ Janela` para adicionar esquadrias expostas ao sol. Informe área ($m^2$), orientação e proteção solar (*Sem proteção*, *Cortina interna*, *Persiana*).
- **Equipamentos Elétricos:** Clique em `+ Equipamento` para adicionar computadores, servidores, projetores, televisores ou motores elétricos.

---

### 4.4 Passo 4: Análise do Gráfico de Simulação 24h

O gráfico dinâmico (desenvolvido com Recharts) apresenta a curva de ganho térmico ao longo das 24 horas do dia:
- **Pico de Calor:** Identifique a hora exata do dia em que a carga atinge o valor máximo (ex: às 15:00h devido à radiação solar Oeste).
- **Composição da Carga:** As áreas coloridas empilhadas mostram a contribuição relativa de paredes, janelas, telhado, pessoas e equipamentos.

---

### 4.5 Passo 5: Gestão de Materiais e Transmitância Térmica ($U$)

Clique no botão **Materiais U** na barra superior ou na caixa de ferramentas para abrir o **Gerenciador de Materiais**:
1. Visualize os coeficientes de transmitância térmica $U$ $[W/(m^2 \cdot K)]$ cadastrados para paredes, telhados e vidros.
2. **Adicionar Novo Material:** Preencha o formulário inferior com o nome, categoria, valor $U$ e descrição.
3. Clique em **Salvar Material**. O dado será enviado ao servidor local (`/api/materials`) e salvo em `src/data/materials.json`, garantindo persistência permanente.

---

### 4.6 Passo 6: Geração do Laudo Técnico PDF

 Clique no botão **Laudo Técnico PDF** para gerar automaticamente um relatório em PDF profissional.

#### Conteúdo do Laudo PDF:
1. **Cabeçalho Corporativo Slate/Cyan:** Título oficial, subtítulo normativo e logomarca de engenharia.
2. **Quadro de Dados Gerais do Projeto:** Nome do projeto, cliente, data, quantidade de ambientes, carga total em BTU/h, TR e potência elétrica kW.
3. **Resumo Executivo (Tabela 1):** Tabela sintética de todos os ambientes com a indicação da norma aplicada, carga pico (BTU/h e TR), horário do pico e equipamento comercial recomendado (Split Inverter, RoofTop, Chiller).
4. **Memória de Cálculo Detalhada (Tabela 2):** Discriminação componente por componente (Infiltração, Pessoas, Iluminação, Equipamentos, Telhado, Paredes, Janelas) com carga em BTU/h, equivalente em kW e percentual de participação na carga pico.
5. **Perfil Térmico Gráfico 24 Horas:** Gráfico vetorial nativo impresso diretamente na página do PDF com 24 barras verticais e destaque em cyan para a hora de pico.
6. **Parecer e Aviso Legal de Responsabilidade Técnica (CREA / CONFEA):** Caixa de destaque normativo com campos para assinatura e número de registro do Engenheiro Mecânico Responsável e número da **ART** (*Anotação de Responsabilidade Técnica*).

---

## 5. Fundamentação Matemática e Equações

### 5.1 Condução através de Paredes e Coberturas
$$Q_{cond} = U \cdot A \cdot CLTD \cdot 3.41214 \quad [\text{BTU/h}]$$

Onde:
- $U$: Transmitância térmica global $[W/(m^2 \cdot K)]$
- $A$: Área de exposição $[m^2]$
- $CLTD$: Diferença de Temperatura Equivalente por Orientação e Inércia $[K]$
- $3.41214$: Fator de conversão de Watts para BTU/h

### 5.2 Radiação Solar por Esquadrias / Vidros
$$Q_{rad} = A \cdot SHGF \cdot SC \cdot 3.41214 \quad [\text{BTU/h}]$$

Onde:
- $SHGF$: Maximum Solar Heat Gain Factor $[W/m^2]$ (função da orientação e hora)
- $SC$: Shading Coefficient (Coeficiente de Sombreamento Interno)

### 5.3 Carga Sensível da Infiltração e Renovação de Ar
$$Q_{inf} = \left( \frac{V \cdot N_{trocas}}{3600} \right) \cdot \rho \cdot C_p \cdot \Delta T \cdot 3.41214 \quad [\text{BTU/h}]$$

Onde:
- $V$: Volume do ambiente ($V = \text{Área} \times \text{Pé-direito}$) $[m^3]$
- $N_{trocas}$: Taxa de trocas de ar por hora (função da pressão do vento)
- $\rho$: Densidade do ar ($1.225 \text{ kg/m}^3$)
- $C_p$: Calor específico do ar ($1006 \text{ J/kg}\cdot\text{K}$)
- $\Delta T$: Diferença de temperatura externa e interna $[K]$

### 5.4 Conversões de Unidades Técnicas
$$1 \text{ TR (Tonelada de Refrigeração)} = 12.000 \text{ BTU/h} = 3.024 \text{ kcal/h} \approx 3,517 \text{ kW}_{\text{térmicos}}$$

---

## 6. Tabela Bioclimática Brasileira NBR 15220

| Zona Bioclimática | Cidade de Referência Exemplo | $\Delta T$ de Projeto (°C) | Característica Climática Predominante |
| :---: | :---: | :---: | :---: |
| **Zona 1** | Curitiba / RS-PR Subtemperado | **8 °C** | Clima frio, baixas temperaturas no inverno |
| **Zona 2** | Rio de Janeiro / Litoral Sul | **10 °C** | Subtropical úmido, alta radiação solar |
| **Zona 3** | São Paulo / Campinas | **9 °C** | Subtropical de altitude |
| **Zona 4** | Brasília / Goiânia | **10 °C** | Tropical de altitude, clima seco no inverno |
| **Zona 5** | Cuiabá / Pantanal | **12 °C** | Tropical continental, altas temperaturas |
| **Zona 6** | Salvador / Litoral Nordeste | **9 °C** | Tropical úmido litorâneo |
| **Zona 7** | Teresina / Sertão Nordestino | **12 °C** | Semiarido / Tropical quente e seco |
| **Zona 8** | Manaus / Amazônia | **11 °C** | Equatorial úmido, alta umidade e temperatura |

---

## 7. Aviso Legal de Responsabilidade Técnica (CREA / CONFEA)

> [!IMPORTANT]
> **AVISO DE RESPONSABILIDADE TÉCNICA E NORMATIVA:**  
> O **HVAC Thermal Load Pro** é uma ferramenta de auxílio ao cálculo computacional e simulação térmica. Os resultados gerados dependem da exatidão das informações de entrada inseridas pelo operador (áreas, materiais, orientação solar, ocupantes e equipamentos).  
> 
> O dimensionamento definitivo de sistemas de expansão direta/indireta, vazões de ar, redes de dutos, difusores, taxas de filtragem e sistemas de exaustão **deve obrigatoriamente ser revisado, validado e homologado por Engenheiro Mecânico devidamente registrado no CREA/CONFEA**, com a emissão da respectiva **Anotação de Responsabilidade Técnica (ART)** nos termos da Lei Federal n° 6.496/1977.

---

*Manual elaborado pela equipe de Engenharia de Software HVAC Thermal Load Pro. Todos os direitos reservados.*
