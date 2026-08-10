import { describe, it, expect } from 'vitest';
import {
  parseDXF,
  parseSVG,
  parseIFC,
  calculateShoelaceArea,
  calculateSignedShoelaceArea,
  calculatePerimeter,
  calculateCentroid,
  mapNormalToOrientation,
  extractWallSegments,
  extractPolygonsFromEntities,
  extractWindowsFromEntities,
  convertCadToHVACEnvironments,
  sanitizePoints,
  detectNorthAngleFromDXF,
  detectNorthAngleFromSVG,
  CADPoint,
  CADEntity,
  CADImportConfig
} from '../services/cadImporterService';

describe('CAD Importer Service (DXF/SVG/IFC Parser & HVAC Conversion)', () => {

  describe('1. Shoelace Formula & Polygon Geometry Math', () => {
    it('calculates exact area of a 10m x 6m rectangle using Shoelace Formula', () => {
      const rectangle: CADPoint[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 6 },
        { x: 0, y: 6 }
      ];

      const area = calculateShoelaceArea(rectangle);
      const signedArea = calculateSignedShoelaceArea(rectangle);
      const perimeter = calculatePerimeter(rectangle);
      const centroid = calculateCentroid(rectangle);

      expect(area).toBe(60);
      expect(signedArea).toBe(60); // Counter-clockwise
      expect(perimeter).toBe(32);
      expect(centroid.x).toBeCloseTo(5);
      expect(centroid.y).toBeCloseTo(3);
    });

    it('calculates area of a triangle correctly', () => {
      const triangle: CADPoint[] = [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 0, y: 6 }
      ];

      const area = calculateShoelaceArea(triangle);
      expect(area).toBe(24);
    });

    it('sanitizes duplicate consecutive points and closing points properly', () => {
      const dirtyPts: CADPoint[] = [
        { x: 0, y: 0 },
        { x: 0, y: 0 }, // Duplicate
        { x: 10, y: 0 },
        { x: 10, y: 6 },
        { x: 0, y: 6 },
        { x: 0, y: 0 }  // Duplicate closing point
      ];

      const clean = sanitizePoints(dirtyPts);
      expect(clean).toHaveLength(4);
      expect(calculateShoelaceArea(dirtyPts)).toBe(60);
      expect(calculatePerimeter(dirtyPts)).toBe(32);
    });
  });

  describe('2. Outward Normal Vectors & Wall Orientation', () => {
    it('maps cardinal normal vectors to norte, sul, leste, oeste', () => {
      expect(mapNormalToOrientation({ x: 0, y: 1 }, 0)).toBe('norte');
      expect(mapNormalToOrientation({ x: 0, y: -1 }, 0)).toBe('sul');
      expect(mapNormalToOrientation({ x: 1, y: 0 }, 0)).toBe('leste');
      expect(mapNormalToOrientation({ x: -1, y: 0 }, 0)).toBe('oeste');
    });

    it('extracts wall segments with outward normals for CCW rectangle', () => {
      const pts: CADPoint[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 8 },
        { x: 0, y: 8 }
      ];

      const segments = extractWallSegments(pts, 0);
      expect(segments).toHaveLength(4);

      // (0,0) -> (10,0) is bottom wall => outward normal points down (-Y) => 'sul'
      expect(segments[0].orientation).toBe('sul');
      expect(segments[0].length).toBe(10);

      // (10,0) -> (10,8) is right wall => outward normal points right (+X) => 'leste'
      expect(segments[1].orientation).toBe('leste');
      expect(segments[1].length).toBe(8);

      // (10,8) -> (0,8) is top wall => outward normal points up (+Y) => 'norte'
      expect(segments[2].orientation).toBe('norte');
      expect(segments[2].length).toBe(10);

      // (0,8) -> (0,0) is left wall => outward normal points left (-X) => 'oeste'
      expect(segments[3].orientation).toBe('oeste');
      expect(segments[3].length).toBe(8);
    });

    it('handles North Angle Offset rotations correctly', () => {
      // Rotate North by 90 degrees (+X becomes North)
      expect(mapNormalToOrientation({ x: 1, y: 0 }, 90)).toBe('norte');
      expect(mapNormalToOrientation({ x: 0, y: 1 }, 90)).toBe('oeste');
    });
  });

  describe('3. DXF Parsing & North Vector', () => {
    it('parses DXF text with layers, polyline entities, and $NORTHDIR', () => {
      const sampleDxf = `0
SECTION
2
HEADER
9
$NORTHDIR
50
90.0
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
0
LAYER
2
PAREDES
70
0
62
7
0
LAYER
2
JANELAS
70
0
62
4
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
PAREDES
70
1
90
4
10
0.0
20
0.0
10
8.0
20
0.0
10
8.0
20
5.0
10
0.0
20
5.0
0
LINE
8
JANELAS
10
0.0
20
2.0
11
0.0
21
4.0
0
ENDSEC
0
EOF
`;

      const parseResult = parseDXF(sampleDxf, 1.0);
      expect(parseResult.fileType).toBe('dxf');
      expect(parseResult.detectedNorthAngle).toBe(90);
      expect(parseResult.layers.length).toBeGreaterThanOrEqual(2);
      expect(parseResult.entities).toHaveLength(2);

      const polyEnt = parseResult.entities.find((e) => e.layer === 'PAREDES');
      expect(polyEnt).toBeDefined();
      expect(polyEnt?.points).toHaveLength(4);

      const polygons = extractPolygonsFromEntities(parseResult.entities, ['PAREDES']);
      expect(polygons).toHaveLength(1);
      expect(polygons[0].area).toBe(40);
    });
  });

  describe('4. SVG Parsing', () => {
    it('parses SVG text with rect, polygon, and line elements', () => {
      const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
        <line id="north" x1="0" y1="10" x2="0" y2="0" />
        <polygon points="0,0 12,0 12,8 0,8" id="PAREDES" />
        <rect x="0" y="2" width="0.2" height="3" id="JANELAS" />
      </svg>`;

      const parseResult = parseSVG(sampleSvg, 1.0);
      expect(parseResult.fileType).toBe('svg');
      expect(parseResult.detectedNorthAngle).toBe(0);
      expect(parseResult.entities).toHaveLength(3);

      const polygons = extractPolygonsFromEntities(parseResult.entities, ['PAREDES']);
      expect(polygons).toHaveLength(1);
      expect(polygons[0].area).toBe(96);
    });
  });

  describe('5. IFC STEP File Parsing', () => {
    it('parses IFC STEP file into spaces, walls, and detected North direction', () => {
      const sampleIfc = `ISO-10303-21;
HEADER;
ENDSEC;
DATA;
#10= IFCCARTESIANPOINT((0.0,0.0,0.0));
#11= IFCCARTESIANPOINT((10.0,0.0,0.0));
#12= IFCCARTESIANPOINT((10.0,8.0,0.0));
#13= IFCCARTESIANPOINT((0.0,8.0,0.0));
#20= IFCPOLYLOOP((#10,#11,#12,#13));
#30= IFCSPACE('2O26',#1,'Auditório Principal',$,$,#20,$,'Espaço Comercial',.ELEMENT.,$);
#40= IFCDIRECTION((1.0,0.0,0.0));
ENDSEC;
END-ISO-10303-21;`;

      const parseResult = parseIFC(sampleIfc, 1.0);
      expect(parseResult.fileType).toBe('ifc');
      expect(parseResult.detectedNorthAngle).toBe(90); // (1.0, 0.0) direction vector => 90 degrees
      expect(parseResult.layers.some((l) => l.name === 'IfcSpace')).toBe(true);

      const polygons = extractPolygonsFromEntities(parseResult.entities, ['IfcSpace']);
      expect(polygons).toHaveLength(1);
      expect(polygons[0].name).toBe('Auditório Principal');
      expect(polygons[0].area).toBe(80);
      expect(polygons[0].perimeter).toBe(36);
    });
  });

  describe('6. Full CAD to HVACEnvironment Conversion', () => {
    it('converts polygons and mapped windows into valid HVACEnvironment objects', () => {
      const roomPolygon = {
        id: 'poly-1',
        layer: 'PAREDES',
        name: 'Sala de Reunião CAD',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 8 },
          { x: 0, y: 8 }
        ],
        area: 80,
        perimeter: 36,
        centroid: { x: 5, y: 4 }
      };

      const westWindow = {
        id: 'win-1',
        layer: 'JANELAS',
        points: [{ x: 0, y: 2 }, { x: 0, y: 5 }],
        center: { x: 0, y: 3.5 },
        area: 3.6,
        orientation: 'norte' as const
      };

      const config: CADImportConfig = {
        wallLayerNames: ['PAREDES'],
        windowLayerNames: ['JANELAS'],
        defaultHeight: 3.0,
        northAngleOffsetDegrees: 0,
        scaleFactor: 1.0,
        defaultActivity: 'comercial_baixo',
        defaultZonaId: 3
      };

      const environments = convertCadToHVACEnvironments([roomPolygon], [westWindow], config);

      expect(environments).toHaveLength(1);
      const env = environments[0];

      expect(env.name).toBe('Sala de Reunião CAD');
      expect(env.area).toBe(80);
      expect(env.height).toBe(3.0);
      expect(env.occupants).toBe(10); // 80 / 8 = 10
      expect(env.lightingWatts).toBe(1200); // 80 * 15 = 1200
      expect(env.walls.length).toBeGreaterThan(0);

      // Window should be mapped to West wall
      const westWin = env.windows.find((w) => w.orientation === 'oeste');
      expect(westWin).toBeDefined();
      expect(westWin?.area).toBe(3.6);
    });
  });
});

