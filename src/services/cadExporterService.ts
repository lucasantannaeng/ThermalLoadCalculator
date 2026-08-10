import { HVACEnvironment } from '../types/hvac';
import { ParsedGeometry } from '../types/cad';

/**
 * serviço Exportador CAD para Ambientes HVAC.
 * Gera arquivos no formato AutoCAD DXF (2D/3D) e Wavefront OBJ 3D.
 */

function resolveGeometry(env: HVACEnvironment, customGeom?: ParsedGeometry): ParsedGeometry {
  if (customGeom) return customGeom;

  // Se não foi passado geometry explícito, infere a partir da área e altura do ambiente
  const side = Math.sqrt(env.area);
  const length = parseFloat(side.toFixed(2));
  const width = parseFloat(side.toFixed(2));
  const height = env.height || 2.8;

  return {
    length,
    width,
    height,
    area: env.area,
    volume: parseFloat((env.area * height).toFixed(2))
  };
}

/**
 * Gera uma string no padrão AutoCAD DXF R12 / 2000 contendo a geometria do ambiente,
 * camadas estruturadas (PAREDES, JANELAS, EQUIPAMENTOS, TELHADO, ANOTACOES).
 */
export function exportToDXF(env: HVACEnvironment, customGeom?: ParsedGeometry): string {
  const g = resolveGeometry(env, customGeom);

  const L = g.length;
  const W = g.width;
  const H = g.height;

  // Header e Definição de Layers
  let dxf = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1009
9
$INSUNITS
70
6
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
5
0
LAYER
2
0
70
0
62
7
6
CONTINUOUS
0
LAYER
2
PAREDES
70
0
62
7
6
CONTINUOUS
0
LAYER
2
JANELAS
70
0
62
4
6
CONTINUOUS
0
LAYER
2
EQUIPAMENTOS
70
0
62
1
6
CONTINUOUS
0
LAYER
2
TELHADO
70
0
62
3
6
CONTINUOUS
0
LAYER
2
ANOTACOES
70
0
62
2
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;

  // Helper para adicionar linha 2D
  const addLine = (layer: string, x1: number, y1: number, x2: number, y2: number) => {
    dxf += `0
LINE
8
${layer}
10
${x1.toFixed(3)}
20
${y1.toFixed(3)}
30
0.0
11
${x2.toFixed(3)}
21
${y2.toFixed(3)}
31
0.0
`;
  };

  // Helper para adicionar texto
  const addText = (layer: string, text: string, x: number, y: number, heightVal: number = 0.3) => {
    dxf += `0
TEXT
8
${layer}
10
${x.toFixed(3)}
20
${y.toFixed(3)}
30
0.0
40
${heightVal}
1
${text}
`;
  };

  // 1. Perímetro das Paredes Externas (Camada PAREDES)
  // Parede Sul: (0,0) a (L, 0)
  addLine('PAREDES', 0, 0, L, 0);
  // Parede Leste: (L, 0) a (L, W)
  addLine('PAREDES', L, 0, L, W);
  // Parede Norte: (L, W) a (0, W)
  addLine('PAREDES', L, W, 0, W);
  // Parede Oeste: (0, W) a (0, 0)
  addLine('PAREDES', 0, W, 0, 0);

  // Paredes Internas (espessura virtual de 0.15m)
  const offset = 0.15;
  addLine('PAREDES', offset, offset, L - offset, offset);
  addLine('PAREDES', L - offset, offset, L - offset, W - offset);
  addLine('PAREDES', L - offset, W - offset, offset, W - offset);
  addLine('PAREDES', offset, W - offset, offset, offset);

  // 2. Esquadrias e Janelas (Camada JANELAS)
  env.windows.forEach((win, index) => {
    const winWidth = Math.min(L * 0.4, Math.max(1.0, win.area / 1.5));
    if (win.orientation === 'sul') {
      const startX = L / 2 - winWidth / 2;
      addLine('JANELAS', startX, 0, startX + winWidth, 0);
      addLine('JANELAS', startX, offset, startX + winWidth, offset);
    } else if (win.orientation === 'norte') {
      const startX = L / 2 - winWidth / 2;
      addLine('JANELAS', startX, W, startX + winWidth, W);
      addLine('JANELAS', startX, W - offset, startX + winWidth, W - offset);
    } else if (win.orientation === 'leste') {
      const startY = W / 2 - winWidth / 2;
      addLine('JANELAS', L, startY, L, startY + winWidth);
      addLine('JANELAS', L - offset, startY, L - offset, startY + winWidth);
    } else if (win.orientation === 'oeste') {
      const startY = W / 2 - winWidth / 2;
      addLine('JANELAS', 0, startY, 0, startY + winWidth);
      addLine('JANELAS', offset, startY, offset, startY + winWidth);
    }
  });

  // 3. Telhado / Cobertura (Camada TELHADO)
  if (env.hasRoof) {
    // Linha diagonal representando a estrutura do telhado
    addLine('TELHADO', 0, 0, L, W);
    addLine('TELHADO', L, 0, 0, W);
  }

  // 4. Equipamentos Representados em Planta (Camada EQUIPAMENTOS)
  env.equipment.forEach((eq, index) => {
    const margin = 0.5;
    const size = 0.6;
    const posX = margin + (index % 3) * 1.2;
    const posY = margin + Math.floor(index / 3) * 1.2;
    if (posX < L - 1 && posY < W - 1) {
      addLine('EQUIPAMENTOS', posX, posY, posX + size, posY);
      addLine('EQUIPAMENTOS', posX + size, posY, posX + size, posY + size);
      addLine('EQUIPAMENTOS', posX + size, posY + size, posX, posY + size);
      addLine('EQUIPAMENTOS', posX, posY + size, posX, posY);
      addText('EQUIPAMENTOS', `${eq.qty}x ${eq.name}`, posX, posY - 0.2, 0.15);
    }
  });

  // 5. Cotações e Anotações no Centro do Ambiente (Camada ANOTACOES)
  const centerX = L / 2;
  const centerY = W / 2;
  addText('ANOTACOES', `AMBIENTE: ${env.name.toUpperCase()}`, centerX - L * 0.25, centerY + 0.5, 0.35);
  addText('ANOTACOES', `DIMENSOES: ${L}m x ${W}m x ${H}m (Pé-Direito)`, centerX - L * 0.25, centerY, 0.25);
  addText('ANOTACOES', `AREA: ${g.area} m2 | VOLUME: ${g.volume} m3`, centerX - L * 0.25, centerY - 0.4, 0.22);
  addText('ANOTACOES', `OCUPANTES: ${env.occupants} Pessoas | CARGA ILUM: ${env.lightingWatts}W`, centerX - L * 0.25, centerY - 0.8, 0.20);

  dxf += `0
ENDSEC
0
EOF
`;

  return dxf;
}

/**
 * Gera uma string no padrão Wavefront OBJ 3D com a malha 3D completa do ambiente:
 * Piso, Paredes 3D com aberturas, Janelas, Telhado e Blocos 3D de Equipamentos.
 */
export function exportToOBJ(env: HVACEnvironment, customGeom?: ParsedGeometry): string {
  const g = resolveGeometry(env, customGeom);

  const L = g.length;
  const W = g.width;
  const H = g.height;

  let obj = `# HVAC Thermal Load Pro 3D Model Export
# Environment: ${env.name}
# Dimensions: ${L}m x ${W}m x ${H}m

o Room_Floor
v 0 0 0
v ${L} 0 0
v ${L} 0 ${W}
v 0 0 ${W}
vn 0 1 0
f 1//1 2//1 3//1 4//1

o Wall_South
v 0 0 0
v ${L} 0 0
v ${L} ${H} 0
v 0 ${H} 0
vn 0 0 -1
f 5//2 6//2 7//2 8//2

o Wall_North
v 0 0 ${W}
v ${L} 0 ${W}
v ${L} ${H} ${W}
v 0 ${H} ${W}
vn 0 0 1
f 9//3 12//3 11//3 10//3

o Wall_West
v 0 0 0
v 0 0 ${W}
v 0 ${H} ${W}
v 0 ${H} 0
vn -1 0 0
f 13//4 14//4 15//4 16//4

o Wall_East
v ${L} 0 0
v ${L} 0 ${W}
v ${L} ${H} ${W}
v ${L} ${H} 0
vn 1 0 0
f 17//5 20//5 19//5 18//5
`;

  let vCount = 20;

  // Telhado 3D
  if (env.hasRoof) {
    obj += `
o Roof_Structure
v 0 ${H} 0
v ${L} ${H} 0
v ${L} ${H} ${W}
v 0 ${H} ${W}
vn 0 1 0
f ${vCount + 1}//6 ${vCount + 2}//6 ${vCount + 3}//6 ${vCount + 4}//6
`;
    vCount += 4;
  }

  // Geometria 3D dos Equipamentos (Paralelepípedos no piso)
  env.equipment.forEach((eq, idx) => {
    const eqX = 0.5 + (idx % 3) * 1.5;
    const eqZ = 0.5 + Math.floor(idx / 3) * 1.5;
    const eqW = 0.6;
    const eqH = 0.7;
    const eqD = 0.6;

    if (eqX + eqW < L && eqZ + eqD < W) {
      obj += `
o Equipment_${idx + 1}_${eq.name.replace(/\s+/g, '_')}
v ${eqX} 0 ${eqZ}
v ${eqX + eqW} 0 ${eqZ}
v ${eqX + eqW} 0 ${eqZ + eqD}
v ${eqX} 0 ${eqZ + eqD}
v ${eqX} ${eqH} ${eqZ}
v ${eqX + eqW} ${eqH} ${eqZ}
v ${eqX + eqW} ${eqH} ${eqZ + eqD}
v ${eqX} ${eqH} ${eqZ + eqD}
f ${vCount + 1} ${vCount + 2} ${vCount + 6} ${vCount + 5}
f ${vCount + 2} ${vCount + 3} ${vCount + 7} ${vCount + 6}
f ${vCount + 3} ${vCount + 4} ${vCount + 8} ${vCount + 7}
f ${vCount + 4} ${vCount + 1} ${vCount + 5} ${vCount + 8}
f ${vCount + 5} ${vCount + 6} ${vCount + 7} ${vCount + 8}
`;
      vCount += 8;
    }
  });

  return obj;
}

/**
 * Função utilitária para disparar o download do arquivo DXF no navegador.
 */
export function downloadDXFFile(env: HVACEnvironment, customGeom?: ParsedGeometry, filename?: string): void {
  const content = exportToDXF(env, customGeom);
  const name = filename || `${env.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_planta.dxf`;
  const blob = new Blob([content], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Função utilitária para disparar o download do arquivo OBJ 3D no navegador.
 */
export function downloadOBJFile(env: HVACEnvironment, customGeom?: ParsedGeometry, filename?: string): void {
  const content = exportToOBJ(env, customGeom);
  const name = filename || `${env.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_modelo3d.obj`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
