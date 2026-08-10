import { HVACEnvironment, Orientation, ActivityType } from './hvac';

/**
 * Ponto 2D em coordenadas de plano CAD (X, Y).
 */
export interface CADPoint {
  x: number;
  y: number;
}

/**
 * Entidade gráfica genérica de CAD / DXF / SVG / IFC.
 */
export interface CADEntity {
  id: string;
  type: 'LINE' | 'POLYLINE' | 'LWPOLYLINE' | 'CIRCLE' | 'ARC' | 'RECT' | 'POLYGON' | 'PATH' | 'IFCSPACE' | 'IFCWALL' | 'IFCWINDOW';
  layer: string;
  points: CADPoint[];
  closed?: boolean;
  name?: string;
}

/**
 * Informações de cada Camada (Layer) do arquivo CAD.
 */
export interface CADLayerInfo {
  name: string;
  color: string;
  entityCount: number;
}

/**
 * Resultado do processamento/parsing de arquivos DXF, SVG ou IFC.
 */
export interface CADParseResult {
  layers: CADLayerInfo[];
  entities: CADEntity[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  detectedNorthAngle?: number; // Ângulo do Norte detectado automaticamente (graus, 0 = +Y, 90 = +X)
  fileType: 'dxf' | 'svg' | 'ifc';
}

/**
 * Polígono de ambiente extraído (calculado via Shoelace Formula).
 */
export interface CADPolygon {
  id: string;
  layer: string;
  name?: string;
  points: CADPoint[];
  area: number; // m² (Shoelace formula)
  perimeter: number; // m
  centroid: CADPoint;
}

/**
 * Segmento de parede com cálculo de vetor normal externo e orientação solar.
 */
export interface CADWallSegment {
  p1: CADPoint;
  p2: CADPoint;
  length: number;
  orientation: Orientation;
  outwardNormal: CADPoint;
}

/**
 * Item de janela mapeado com centro, área e orientação cardinal.
 */
export interface CADWindowItem {
  id: string;
  layer: string;
  points: CADPoint[];
  center: CADPoint;
  area: number;
  orientation: Orientation;
}

/**
 * Configuração dos parâmetros de importação CAD para HVAC.
 */
export interface CADImportConfig {
  wallLayerNames: string[];
  windowLayerNames: string[];
  defaultHeight: number;
  northAngleOffsetDegrees: number; // 0 = +Y is North, 90 = +X is North
  scaleFactor: number; // e.g. 1.0 (m), 0.001 (mm), 0.01 (cm)
  defaultActivity: ActivityType;
  defaultZonaId: number;
}

/**
 * Representa as dimensões 3D calculadas ou inferidas para modelagem e exportação CAD.
 */
export interface ParsedGeometry {
  length: number; // Dimensão no eixo X (metros)
  width: number;  // Dimensão no eixo Z (metros)
  height: number; // Pé-direito no eixo Y (metros)
  area: number;   // Área (m²)
  volume: number; // Volume (m³)
}

/**
 * Resultado do parser Text-to-CAD contendo ambiente HVAC e geometria sintetizada.
 */
export interface TextToCadResult {
  environment: HVACEnvironment;
  geometry: ParsedGeometry;
  rawPrompt: string;
  warnings: string[];
  source?: 'llm' | 'offline';
  providerName?: string;
}

/**
 * Presets de Câmera 3D para o visualizador Three.js.
 */
export type CameraPreset = 'iso' | 'top' | 'front';

/**
 * Propriedades do componente HvacCadViewer.
 */
export interface HvacCadViewerProps {
  environment: HVACEnvironment;
  onEnvironmentUpdate?: (updatedEnv: HVACEnvironment) => void;
}

/**
 * Opções para exportação de arquivos CAD (DXF / OBJ).
 */
export interface CADExportOptions {
  filename?: string;
  customGeom?: ParsedGeometry;
}

