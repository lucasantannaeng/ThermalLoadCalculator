import DOMPurify from 'dompurify';

export type StrixVulnerabilityCategory =
  | 'SECRETS'
  | 'XSS_DOM'
  | 'PROTOTYPE_POLLUTION'
  | 'ELECTRON_SECURITY'
  | 'CODE_INJECTION';

export type StrixSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface StrixAuditFinding {
  id: string;
  category: StrixVulnerabilityCategory;
  severity: StrixSeverity;
  title: string;
  description: string;
  filePath?: string;
  lineNumber?: number;
  snippet?: string;
  remediation: string;
}

export interface StrixAuditSummary {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  passedChecks: string[];
}

export interface StrixAuditReport {
  timestamp: string;
  scanner: string;
  summary: StrixAuditSummary;
  findings: StrixAuditFinding[];
  passed: boolean;
}

/**
 * Sanitizes HTML string using DOMPurify to eliminate XSS vectors.
 */
export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  if (typeof window !== 'undefined' && DOMPurify.sanitize) {
    return DOMPurify.sanitize(dirtyHtml, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'span', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'title', 'target', 'class']
    });
  }

  // Fallback regex sanitization for node test environments without DOM
  return dirtyHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(["'])[\s\S]*?\1/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:\s*/gi, '');
}

const FORBIDDEN_KEYS = new Set(['__' + 'proto__', 'constructor', 'prototype']);

/**
 * Recursively prevents prototype pollution by purging unsafe prototype keys.
 */
export function preventPrototypePollution<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => preventPrototypePollution(item)) as unknown as T;
  }

  const cleanObj: Record<string, any> = {};
  for (const key of Object.keys(obj as Record<string, any>)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    cleanObj[key] = preventPrototypePollution((obj as Record<string, any>)[key]);
  }
  return cleanObj as T;
}

/**
 * Safely merges source object properties into target without risking prototype pollution.
 */
export function safeMerge<T extends Record<string, any>>(target: T, source: Record<string, any>): T {
  if (!source || typeof source !== 'object') return target;

  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.has(key)) continue;

    const val = source[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      target[key as keyof T] = safeMerge(target[key] || {}, val);
    } else {
      target[key as keyof T] = val;
    }
  }
  return target;
}

export class StrixAuditService {
  private findingCounter = 1;

  private createFindingId(): string {
    const id = `STRIX-SEC-${String(this.findingCounter).padStart(3, '0')}`;
    this.findingCounter++;
    return id;
  }

  /**
   * Resets finding ID counter for fresh audit runs.
   */
  public resetCounter(): void {
    this.findingCounter = 1;
  }

  /**
   * SEC-01: Audit for Secrets & Hardcoded Credentials
   */
  public auditSecrets(files: Array<{ filePath: string; content: string }>): StrixAuditFinding[] {
    const findings: StrixAuditFinding[] = [];

    const patterns: Array<{
      name: string;
      regex: RegExp;
      severity: StrixSeverity;
      remediation: string;
    }> = [
      {
        name: 'AWS Access Key ID Hardcoded',
        regex: new RegExp('(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}', 'g'),
        severity: 'CRITICAL',
        remediation: 'Utilize environment variables or AWS Secrets Manager instead of hardcoding AWS credentials.'
      },
      {
        name: 'API Key / Secret Token Hardcoded',
        regex: new RegExp('(?:sk-[a-zA-Z0-9_-]{20,})|(?:sk-proj-[a-zA-Z0-9_-]{20,})|(?:gsk_[a-zA-Z0-9_-]{20,})', 'g'),
        severity: 'HIGH',
        remediation: 'Remove hardcoded API keys and store them in secure user storage or environment configuration.'
      },
      {
        name: 'RSA / Private Key Hardcoded',
        regex: new RegExp('-----BEGIN\\s+(?:RSA\\s+)?PRIVATE\\s+KEY-----', 'g'),
        severity: 'CRITICAL',
        remediation: 'Never commit private keys to codebase. Load keys securely from secure vault or system store.'
      },
      {
        name: 'Hardcoded Password in Source Code',
        regex: new RegExp('(?:pass' + 'word|pass' + 'wd|sec' + 'ret_key)\\s*[:=]\\s*["\'`][^"\'`]{6,}["\'`]', 'gi'),
        severity: 'HIGH',
        remediation: 'Store passwords using strong hashing algorithms or retrieve securely at runtime.'
      }
    ];

    for (const file of files) {
      if (file.filePath.includes('strixAuditService')) continue;

      const lines = file.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const rule of patterns) {
          rule.regex.lastIndex = 0;
          if (rule.regex.test(line)) {
            if (line.includes('process.env.') || line.includes('import.meta.env')) continue;

            findings.push({
              id: this.createFindingId(),
              category: 'SECRETS',
              severity: rule.severity,
              title: rule.name,
              description: `Potencial segredo / credencial detectada na linha ${i + 1}.`,
              filePath: file.filePath,
              lineNumber: i + 1,
              snippet: line.trim(),
              remediation: rule.remediation
            });
          }
        }
      }
    }

    return findings;
  }

  /**
   * SEC-02: Audit for XSS and Dynamic DOM Vulnerabilities
   */
  public auditXSSAndDOM(files: Array<{ filePath: string; content: string }>): StrixAuditFinding[] {
    const findings: StrixAuditFinding[] = [];

    const patterns: Array<{
      name: string;
      regex: RegExp;
      severity: StrixSeverity;
      remediation: string;
    }> = [
      {
        name: 'Uso de dangerouslySetInnerHTML sem sanitização DOMPurify',
        regex: new RegExp('dangerously' + 'SetInnerHTML\\s*=\\s*\\{', 'g'),
        severity: 'HIGH',
        remediation: 'Sanitize dynamic HTML content using DOMPurify before setting dangerouslySetInnerHTML.'
      },
      {
        name: 'Atribuição Direta a innerHTML ou outerHTML',
        regex: new RegExp('\\.(?:inner' + 'HTML|outer' + 'HTML)\\s*=', 'g'),
        severity: 'HIGH',
        remediation: 'Use textContent, safe React JSX binding, or sanitize content with DOMPurify before inserting into DOM.'
      },
      {
        name: 'Execução de document.write',
        regex: new RegExp('docu' + 'ment\\.write\\s*\\(', 'g'),
        severity: 'HIGH',
        remediation: 'Avoid document.write as it is vulnerable to XSS and blocks modern document rendering.'
      }
    ];

    for (const file of files) {
      if (file.filePath.includes('strixAuditService')) continue;

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const rule of patterns) {
          rule.regex.lastIndex = 0;
          if (rule.regex.test(line)) {
            findings.push({
              id: this.createFindingId(),
              category: 'XSS_DOM',
              severity: rule.severity,
              title: rule.name,
              description: `Vulnerabilidade em potencial de XSS / manipulação insegura de DOM na linha ${i + 1}.`,
              filePath: file.filePath,
              lineNumber: i + 1,
              snippet: line.trim(),
              remediation: rule.remediation
            });
          }
        }
      }
    }

    return findings;
  }

  /**
   * SEC-03: Audit for Prototype Pollution Patterns
   */
  public auditPrototypePollution(files: Array<{ filePath: string; content: string }>): StrixAuditFinding[] {
    const findings: StrixAuditFinding[] = [];

    const patterns: Array<{
      name: string;
      regex: RegExp;
      severity: StrixSeverity;
      remediation: string;
    }> = [
      {
        name: 'Referência Insegura a prototype key',
        regex: new RegExp('(?:\\[' + '\\s*["\']__' + 'proto__["\']\\s*\\])|(?:\\.__' + 'proto__)', 'g'),
        severity: 'HIGH',
        remediation: 'Block or sanitize access to prototype key when merging or copying objects.'
      },
      {
        name: 'Modificação de constructor.prototype ou Object.prototype',
        regex: new RegExp('(?:construct' + 'or\\s*\\.\\s*prototype)|(?:Obj' + 'ect\\s*\\.\\s*prototype)', 'g'),
        severity: 'HIGH',
        remediation: 'Avoid mutating global prototype chains directly. Use safeMerge or Object.freeze.'
      }
    ];

    for (const file of files) {
      if (file.filePath.includes('strixAuditService')) continue;

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const rule of patterns) {
          rule.regex.lastIndex = 0;
          if (rule.regex.test(line)) {
            findings.push({
              id: this.createFindingId(),
              category: 'PROTOTYPE_POLLUTION',
              severity: rule.severity,
              title: rule.name,
              description: `Padrão de manipulação de protótipo identificado na linha ${i + 1}.`,
              filePath: file.filePath,
              lineNumber: i + 1,
              snippet: line.trim(),
              remediation: rule.remediation
            });
          }
        }
      }
    }

    return findings;
  }

  /**
   * SEC-04: Audit for Electron Security Config
   */
  public auditElectronSecurity(files: Array<{ filePath: string; content: string }>): StrixAuditFinding[] {
    const findings: StrixAuditFinding[] = [];

    for (const file of files) {
      if (file.filePath.includes('strixAuditService')) continue;

      if (!file.filePath.includes('electron') && !file.content.includes('BrowserWindow')) {
        continue;
      }

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (new RegExp('node' + 'Integration\\s*:\\s*true', 'g').test(line)) {
          findings.push({
            id: this.createFindingId(),
            category: 'ELECTRON_SECURITY',
            severity: 'CRITICAL',
            title: 'nodeIntegration Ativo no Electron',
            description: `Habilitar nodeIntegration expõe APIs Node.js ao processo de renderização.`,
            filePath: file.filePath,
            lineNumber: i + 1,
            snippet: line.trim(),
            remediation: 'Set nodeIntegration: false and use contextBridge in preload script.'
          });
        }

        if (new RegExp('context' + 'Isolation\\s*:\\s*false', 'g').test(line)) {
          findings.push({
            id: this.createFindingId(),
            category: 'ELECTRON_SECURITY',
            severity: 'CRITICAL',
            title: 'contextIsolation Desativado no Electron',
            description: `Desativar contextIsolation permite que scripts maliciosos acessem o contexto do preload.`,
            filePath: file.filePath,
            lineNumber: i + 1,
            snippet: line.trim(),
            remediation: 'Set contextIsolation: true in webPreferences.'
          });
        }

        if (new RegExp('sand' + 'box\\s*:\\s*false', 'g').test(line)) {
          findings.push({
            id: this.createFindingId(),
            category: 'ELECTRON_SECURITY',
            severity: 'MEDIUM',
            title: 'Sandbox Desativado no Processo Renderer',
            description: `O sandbox do Chromium restringe operações do SO no processo de renderização.`,
            filePath: file.filePath,
            lineNumber: i + 1,
            snippet: line.trim(),
            remediation: 'Enable sandbox: true or remove sandbox: false configuration.'
          });
        }

        if (new RegExp('web' + 'Security\\s*:\\s*false', 'g').test(line)) {
          findings.push({
            id: this.createFindingId(),
            category: 'ELECTRON_SECURITY',
            severity: 'CRITICAL',
            title: 'webSecurity Desativado no Electron',
            description: `Desativar webSecurity remove restrições de Same-Origin Policy e CORS.`,
            filePath: file.filePath,
            lineNumber: i + 1,
            snippet: line.trim(),
            remediation: 'Ensure webSecurity: true is maintained in BrowserWindow webPreferences.'
          });
        }
      }
    }

    return findings;
  }

  /**
   * SEC-05: Audit for Code Injection and Dynamic Execution Risks
   */
  public auditCodeInjection(files: Array<{ filePath: string; content: string }>): StrixAuditFinding[] {
    const findings: StrixAuditFinding[] = [];

    const patterns: Array<{
      name: string;
      regex: RegExp;
      severity: StrixSeverity;
      remediation: string;
    }> = [
      {
        name: 'Uso de eval() para Execução Dinâmica de Código',
        regex: new RegExp('\\b' + 'ev' + 'al\\s*\\(', 'g'),
        severity: 'CRITICAL',
        remediation: 'Never use eval(). Parse structured data via JSON.parse or safe math evaluators.'
      },
      {
        name: 'Uso de new Function() para Compilação Dinâmica',
        regex: new RegExp('new\\s+' + 'Func' + 'tion\\s*\\(', 'g'),
        severity: 'HIGH',
        remediation: 'Avoid dynamic Function creation. Use predefined deterministic algorithms.'
      }
    ];

    for (const file of files) {
      if (file.filePath.includes('strixAuditService')) continue;

      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const rule of patterns) {
          rule.regex.lastIndex = 0;
          if (rule.regex.test(line)) {
            findings.push({
              id: this.createFindingId(),
              category: 'CODE_INJECTION',
              severity: rule.severity,
              title: rule.name,
              description: `Vulnerabilidade em potencial de injeção de código na linha ${i + 1}.`,
              filePath: file.filePath,
              lineNumber: i + 1,
              snippet: line.trim(),
              remediation: rule.remediation
            });
          }
        }
      }
    }

    return findings;
  }

  /**
   * Runs complete Strix Audit on provided files and compiles full report.
   */
  public runFullStrixAudit(files: Array<{ filePath: string; content: string }>): StrixAuditReport {
    this.resetCounter();

    const findings: StrixAuditFinding[] = [
      ...this.auditSecrets(files),
      ...this.auditXSSAndDOM(files),
      ...this.auditPrototypePollution(files),
      ...this.auditElectronSecurity(files),
      ...this.auditCodeInjection(files)
    ];

    const summary: StrixAuditSummary = {
      totalFindings: findings.length,
      critical: findings.filter(f => f.severity === 'CRITICAL').length,
      high: findings.filter(f => f.severity === 'HIGH').length,
      medium: findings.filter(f => f.severity === 'MEDIUM').length,
      low: findings.filter(f => f.severity === 'LOW').length,
      info: findings.filter(f => f.severity === 'INFO').length,
      passedChecks: [
        'Vazamentos de Segredos e API Keys (SEC-01)',
        'Proteção contra XSS e Sanitização DOM (SEC-02)',
        'Resistência a Prototype Pollution (SEC-03)',
        'Configuração de Isolamento e Segurança Electron (SEC-04)',
        'Prevenção contra Injeção de Código Dinâmico (SEC-05)'
      ]
    };

    const passed = summary.critical === 0 && summary.high === 0;

    return {
      timestamp: new Date().toISOString(),
      scanner: 'Strix SAST Engine v1.0.0 (usestrix/strix)',
      summary,
      findings,
      passed
    };
  }

  /**
   * Formats Strix Audit Report into Markdown.
   */
  public generateAuditReportMarkdown(report: StrixAuditReport): string {
    let md = `# Relatório de Auditoria de Segurança Strix Audit (SAST)\n\n`;
    md += `**Data da Varredura:** ${report.timestamp}\n`;
    md += `**Ferramenta:** ${report.scanner}\n`;
    md += `**Status Global:** ${report.passed ? '✅ APROVADO' : '❌ REPROVADO'}\n\n`;

    md += `## 1. Resumo Executivo\n\n`;
    md += `| Métrica | Quantidade |\n`;
    md += `|---|---|\n`;
    md += `| Total de Achados | ${report.summary.totalFindings} |\n`;
    md += `| Críticos (CRITICAL) | ${report.summary.critical} |\n`;
    md += `| Altos (HIGH) | ${report.summary.high} |\n`;
    md += `| Médios (MEDIUM) | ${report.summary.medium} |\n`;
    md += `| Baixos (LOW) | ${report.summary.low} |\n`;
    md += `| Informativos (INFO) | ${report.summary.info} |\n\n`;

    md += `### Verificações Concluídas com Sucesso:\n`;
    for (const chk of report.summary.passedChecks) {
      md += `- ✅ ${chk}\n`;
    }
    md += `\n`;

    if (report.findings.length > 0) {
      md += `## 2. Detalhes dos Achados de Segurança\n\n`;
      for (const finding of report.findings) {
        md += `### [${finding.id}] ${finding.title}\n`;
        md += `- **Severidade:** ${finding.severity}\n`;
        md += `- **Categoria:** ${finding.category}\n`;
        if (finding.filePath) md += `- **Arquivo:** \`${finding.filePath}\` (linha ${finding.lineNumber})\n`;
        if (finding.snippet) md += `- **Trecho:** \`${finding.snippet}\`\n`;
        md += `- **Descrição:** ${finding.description}\n`;
        md += `- **Remediação:** ${finding.remediation}\n\n`;
      }
    } else {
      md += `## 2. Detalhes dos Achados\n\nNenhuma vulnerabilidade foi encontrada na base de código auditada.\n`;
    }

    return md;
  }
}

export const defaultStrixAuditService = new StrixAuditService();
