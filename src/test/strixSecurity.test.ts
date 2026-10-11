import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  StrixAuditService,
  sanitizeHtml,
  safeMerge,
  preventPrototypePollution
} from '../services/strixAuditService';

describe('Strix Security SAST Audit Suite', () => {
  const auditService = new StrixAuditService();

  describe('1. Secrets & Credentials Detection (SEC-01)', () => {
    it('detects hardcoded AWS keys, API keys, private keys, and passwords', () => {
      const mockFiles = [
        {
          filePath: 'src/config/aws.ts',
          content: 'const awsKey = "AKIAIOSFODNN7EXAMPLE";'
        },
        {
          filePath: 'src/services/api.ts',
          content: 'const secret = "sk-proj-1234567890abcdef1234567890abcdef";'
        },
        {
          filePath: 'src/keys/rsa.ts',
          content: 'const key = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...";'
        },
        {
          filePath: 'src/auth/login.ts',
          content: 'const password = "SuperSecretPassword123!";'
        }
      ];

      const findings = auditService.auditSecrets(mockFiles);
      expect(findings.length).toBeGreaterThanOrEqual(4);
      expect(findings.some(f => f.title.includes('AWS'))).toBe(true);
      expect(findings.some(f => f.title.includes('API'))).toBe(true);
      expect(findings.some(f => f.title.includes('Private Key'))).toBe(true);
      expect(findings.some(f => f.title.includes('Password'))).toBe(true);
    });

    it('does not flag clean code or environment variable access', () => {
      const mockFiles = [
        {
          filePath: 'src/config/env.ts',
          content: 'const apiKey = process.env.VITE_API_KEY || "";'
        }
      ];

      const findings = auditService.auditSecrets(mockFiles);
      expect(findings.length).toBe(0);
    });
  });

  describe('2. XSS & DOM Sanitization Audit (SEC-02)', () => {
    it('detects dangerous HTML assignments like innerHTML and dangerouslySetInnerHTML', () => {
      const mockFiles = [
        {
          filePath: 'src/components/Unsafe.tsx',
          content: '<div dangerouslySetInnerHTML={{ __html: userInput }} />'
        },
        {
          filePath: 'src/utils/dom.ts',
          content: 'element.innerHTML = "<p>" + userComment + "</p>";'
        },
        {
          filePath: 'src/utils/legacy.ts',
          content: 'document.write(userInput);'
        }
      ];

      const findings = auditService.auditXSSAndDOM(mockFiles);
      expect(findings.length).toBeGreaterThanOrEqual(3);
      expect(findings.every(f => f.category === 'XSS_DOM')).toBe(true);
    });

    it('sanitizes malicious payload strings using DOMPurify sanitizeHtml utility', () => {
      const maliciousScript = '<img src=x onerror=alert("XSS")><script>alert(1)</script><a href="javascript:alert(2)">click</a>';
      const clean = sanitizeHtml(maliciousScript);

      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('onerror=');
      expect(clean).not.toContain('javascript:');
    });
  });

  describe('3. Prototype Pollution Audit & Guard (SEC-03)', () => {
    it('detects unsafe __proto__ and constructor.prototype references in code', () => {
      const mockFiles = [
        {
          filePath: 'src/utils/merge.ts',
          content: 'target["__proto__"] = source["__proto__"];'
        },
        {
          filePath: 'src/utils/assign.ts',
          content: 'Object.prototype.polluted = true;'
        }
      ];

      const findings = auditService.auditPrototypePollution(mockFiles);
      expect(findings.length).toBeGreaterThanOrEqual(2);
      expect(findings.every(f => f.category === 'PROTOTYPE_POLLUTION')).toBe(true);
    });

    it('prevents prototype pollution when merging untrusted objects using safeMerge', () => {
      const untrustedJSON = '{"__proto__": {"admin": true}, "name": "test"}';
      const parsed = JSON.parse(untrustedJSON);
      
      const target: Record<string, any> = {};
      const merged = safeMerge(target, parsed);

      expect(merged.name).toBe('test');
      expect(({} as any).admin).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(merged, '__proto__')).toBe(false);
    });

    it('sanitizes input objects with preventPrototypePollution guard', () => {
      const pollutedObj = JSON.parse('{"constructor": {"prototype": {"hacked": true}}, "valid": 100}');
      const cleaned = preventPrototypePollution(pollutedObj);

      expect(cleaned.valid).toBe(100);
      expect(({} as any).hacked).toBeUndefined();
    });
  });

  describe('4. Electron Security Audit (SEC-04)', () => {
    it('detects insecure Electron settings such as nodeIntegration: true or contextIsolation: false', () => {
      const mockFiles = [
        {
          filePath: 'electron/main_insecure.js',
          content: `
            new BrowserWindow({
              webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                sandbox: false
              }
            });
          `
        }
      ];

      const findings = auditService.auditElectronSecurity(mockFiles);
      expect(findings.length).toBeGreaterThanOrEqual(2);
      expect(findings.some(f => f.title.includes('nodeIntegration'))).toBe(true);
      expect(findings.some(f => f.title.includes('contextIsolation'))).toBe(true);
    });

    it('passes secure Electron settings (nodeIntegration: false, contextIsolation: true, sandbox: true)', () => {
      const mockFiles = [
        {
          filePath: 'electron/main_secure.js',
          content: `
            new BrowserWindow({
              webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true
              }
            });
          `
        }
      ];

      const findings = auditService.auditElectronSecurity(mockFiles);
      const criticalOrHigh = findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');
      expect(criticalOrHigh.length).toBe(0);
    });
  });

  describe('5. Code Injection Audit (SEC-05)', () => {
    it('detects eval and new Function calls', () => {
      const mockFiles = [
        {
          filePath: 'src/utils/evaluator.ts',
          content: 'const res = eval(userFormula);'
        },
        {
          filePath: 'src/utils/dynamic.ts',
          content: 'const fn = new Function("a", "b", userCode);'
        }
      ];

      const findings = auditService.auditCodeInjection(mockFiles);
      expect(findings.length).toBeGreaterThanOrEqual(2);
      expect(findings.every(f => f.category === 'CODE_INJECTION')).toBe(true);
    });
  });

  describe('6. Real Codebase Strix Security Audit', () => {
    it('audits actual project files and passes zero CRITICAL / HIGH security findings', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const filesToAudit = [
        'electron/main.js',
        'electron/main.cjs',
        'electron/preload.js',
        'electron/preload.cjs',
        'src/services/strixAuditService.ts',
        'src/services/aiProviderService.ts',
        'src/services/cadExporterService.ts',
        'src/services/cadImporterService.ts',
        'src/services/forgeCadService.ts',
        'src/services/materialService.ts',
        'src/services/parametricCadSyncService.ts',
        'src/services/pdfReportGenerator.ts',
        'src/services/textToCadService.ts',
        'src/services/vectorEditorService.ts',
        'src/components/ThermalLoadCalculator.tsx',
        'src/components/AiKeyManagerModal.tsx',
        'src/components/CadImportModal.tsx',
        'src/components/HvacCadViewer.tsx',
        'src/components/HvacVectorCanvasEditor.tsx',
        'src/components/MaterialManagerModal.tsx',
        'src/components/Simulation24hChart.tsx',
        'src/calculation/engines/abntEngine.ts',
        'src/calculation/engines/ashraeRtsEngine.ts',
        'src/calculation/engines/hvacEngineFactory.ts',
        'src/calculation/engines/isoEngine.ts',
        'src/calculation/physics/loadDiversity.ts',
        'src/calculation/physics/solarRadiation.ts',
        'src/calculation/physics/windInfiltration.ts',
        'index.html'
      ];

      const loadedFiles: Array<{ filePath: string; content: string }> = [];

      for (const relPath of filesToAudit) {
        const absPath = path.join(projectRoot, relPath);
        if (fs.existsSync(absPath)) {
          loadedFiles.push({
            filePath: relPath,
            content: fs.readFileSync(absPath, 'utf-8')
          });
        }
      }

      expect(loadedFiles.length).toBeGreaterThanOrEqual(10);

      const report = auditService.runFullStrixAudit(loadedFiles);
      expect(report.passed).toBe(true);
      expect(report.summary.critical).toBe(0);
      expect(report.summary.high).toBe(0);
    });

    it('generates a clean Strix Audit Report Markdown for project files', () => {
      const projectRoot = path.resolve(__dirname, '../../');
      const filesToAudit = [
        'electron/main.js',
        'electron/main.cjs',
        'src/services/strixAuditService.ts',
        'src/services/aiProviderService.ts',
        'src/services/materialService.ts'
      ];

      const loadedFiles = filesToAudit
        .map(rel => {
          const abs = path.join(projectRoot, rel);
          return fs.existsSync(abs) ? { filePath: rel, content: fs.readFileSync(abs, 'utf-8') } : null;
        })
        .filter((f): f is { filePath: string; content: string } => f !== null);

      const report = auditService.runFullStrixAudit(loadedFiles);
      const markdown = auditService.generateAuditReportMarkdown(report);

      expect(markdown).toContain('Relatório de Auditoria de Segurança Strix Audit');
      expect(markdown).toContain('✅ APROVADO');
    });
  });
});
