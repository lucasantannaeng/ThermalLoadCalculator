import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProjectInfo, HVACResult24h } from '../types/hvac';

export const generateHVACPDFReport = (project: ProjectInfo, results: HVACResult24h[]): void => {
  const doc = new jsPDF();

  // Color Palette Constants (Industrial Slate / Cyan Accent)
  const PRIMARY_COLOR: [number, number, number] = [15, 23, 42];    // Slate 900
  const SECONDARY_COLOR: [number, number, number] = [30, 41, 59];  // Slate 800
  const ACCENT_COLOR: [number, number, number] = [8, 145, 178];    // Cyan 600
  const TEXT_DARK: [number, number, number] = [30, 41, 59];       // Slate 800
  const TEXT_MUTED: [number, number, number] = [100, 116, 139];   // Slate 500
  const BG_LIGHT: [number, number, number] = [248, 250, 252];     // Slate 50

  // 1. Corporate Header Banner (Dark Industrial Slate + Cyan Line)
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, 210, 36, 'F');

  // Decorative Accent Bar
  doc.setFillColor(...ACCENT_COLOR);
  doc.rect(0, 34, 210, 2, 'F');

  // Header Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LAUDO TÉCNICO DE CARGA TÉRMICA HVAC PRO', 14, 18);

  doc.setTextColor(56, 189, 248); // Cyan 400
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('MEMÓRIA DE CÁLCULO MULTINORMA • ABNT NBR 16401 / ASHRAE RTS / ISO 52016-1', 14, 26);

  // Corporate Badge Right
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ENGENHARIA HVAC', 196, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('RELATÓRIO DE CÁLCULO 24H', 196, 25, { align: 'right' });

  // 2. Project Metadata Block
  let currentY = 42;

  const totalProjectBTU = results.reduce((acc, r) => acc + (r.total || 0), 0);
  const totalTR = (totalProjectBTU / 12000).toFixed(2);
  const totalKW = results.reduce((acc, r) => acc + (r.potenciaEstimadaKW || 0), 0).toFixed(2);

  doc.setFillColor(...BG_LIGHT);
  doc.roundedRect(14, currentY, 182, 34, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, 182, 34, 2, 2, 'D');

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text('DADOS GERAIS DO PROJETO', 18, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Projeto: ${project.name || 'Sem nome'}`, 18, currentY + 15);
  doc.text(`Cliente: ${project.client || 'Não informado'}`, 18, currentY + 22);
  doc.text(`Data de Emissão: ${project.date || new Date().toLocaleDateString('pt-BR')}`, 18, currentY + 29);

  doc.text(`Ambientes Analisados: ${results.length}`, 115, currentY + 15);
  doc.text(`Carga Total: ${totalProjectBTU.toLocaleString('pt-BR')} BTU/h (${totalTR} TR)`, 115, currentY + 22);
  doc.text(`Potência Elétrica Estimada: ${totalKW} kW`, 115, currentY + 29);

  currentY += 40;

  // Total Thermal Load Banner
  doc.setFillColor(...PRIMARY_COLOR);
  doc.roundedRect(14, currentY, 182, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `CARGA TÉRMICA TOTAL CONSOLIDADA: ${totalProjectBTU.toLocaleString('pt-BR')} BTU/h  |  ${totalTR} TR  |  ${totalKW} kW/h`,
    18,
    currentY + 8
  );

  currentY += 18;

  // 3. Executive Summary Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text('1. RESUMO EXECUTIVO DE CARGA PICO POR AMBIENTE', 14, currentY);

  currentY += 4;

  const tableData = results.map(r => [
    r.name,
    r.standardMode || 'ABNT',
    `${r.total.toLocaleString('pt-BR')} BTU/h`,
    `${(r.total / 12000).toFixed(2)} TR`,
    `Pico às ${r.peakHour}:00h`,
    r.sugerida
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Ambiente', 'Norma', 'Carga Pico (BTU/h)', 'Carga (TR)', 'Horário Pico', 'Equipamento Sugerido']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: ACCENT_COLOR,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: TEXT_DARK
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249]
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // 4. Individual Environment Detail & 24h Profile Section
  if (currentY > 220) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_DARK);
  doc.text('2. MEMÓRIA DE CÁLCULO E PERFIL TÉRMICO HORÁRIO (24H)', 14, currentY);

  currentY += 6;

  results.forEach((r, idx) => {
    if (currentY > 190) {
      doc.addPage();
      currentY = 20;
    }

    // Environment Title Box
    doc.setFillColor(...SECONDARY_COLOR);
    doc.roundedRect(14, currentY, 182, 8, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Ambiente ${idx + 1}: ${r.name}  [Norma: ${r.standardMode}]`, 18, currentY + 5.5);
    currentY += 12;

    const b = r.breakdown;
    const breakdownRows = [
      ['Infiltração de Ar / Ventilação', `${b.infiltracao.toLocaleString('pt-BR')} BTU/h`, `${(b.infiltracao / 3412.14).toFixed(2)} kW`, `${((b.infiltracao / (r.total || 1)) * 100).toFixed(1)}%`],
      ['Carga de Pessoas (Sensível + Latente)', `${b.pessoas.toLocaleString('pt-BR')} BTU/h`, `${(b.pessoas / 3412.14).toFixed(2)} kW`, `${((b.pessoas / (r.total || 1)) * 100).toFixed(1)}%`],
      ['Iluminação Artificial', `${b.iluminacao.toLocaleString('pt-BR')} BTU/h`, `${(b.iluminacao / 3412.14).toFixed(2)} kW`, `${((b.iluminacao / (r.total || 1)) * 100).toFixed(1)}%`],
      ['Equipamentos Elétricos', `${b.equipamentos.toLocaleString('pt-BR')} BTU/h`, `${(b.equipamentos / 3412.14).toFixed(2)} kW`, `${((b.equipamentos / (r.total || 1)) * 100).toFixed(1)}%`],
      ['Condução por Telhado / Cobertura', `${b.telhado.toLocaleString('pt-BR')} BTU/h`, `${(b.telhado / 3412.14).toFixed(2)} kW`, `${((b.telhado / (r.total || 1)) * 100).toFixed(1)}%`],
      ['Condução por Paredes Exteriores', `${b.paredes.toLocaleString('pt-BR')} BTU/h`, `${(b.paredes / 3412.14).toFixed(2)} kW`, `${((b.paredes / (r.total || 1)) * 100).toFixed(1)}%`],
      ['Radiação + Condução por Janelas', `${b.janelas.toLocaleString('pt-BR')} BTU/h`, `${(b.janelas / 3412.14).toFixed(2)} kW`, `${((b.janelas / (r.total || 1)) * 100).toFixed(1)}%`],
      ['CARGA TOTAL DE PICO DO AMBIENTE', `${r.total.toLocaleString('pt-BR')} BTU/h`, `${r.potenciaEstimadaKW.toFixed(2)} kW`, '100.0%']
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Componente Térmico', 'Carga Térmica (BTU/h)', 'Potência (kW)', 'Fração (%)']],
      body: breakdownRows,
      theme: 'grid',
      headStyles: {
        fillColor: [226, 232, 240],
        textColor: TEXT_DARK,
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: TEXT_DARK
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;

    // Render 24-Hour Thermal Load Profile Vector Graphic Chart
    if (r.hourlyProfile && r.hourlyProfile.length > 0) {
      if (currentY > 210) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ACCENT_COLOR);
      doc.text('Perfil Térmico de Carga em 24 Horas (BTU/h por Horário):', 14, currentY);

      currentY += 4;

      const chartX = 14;
      const chartY = currentY;
      const chartWidth = 182;
      const chartHeight = 32;

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(chartX, chartY, chartWidth, chartHeight, 1.5, 1.5, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(chartX, chartY, chartWidth, chartHeight, 1.5, 1.5, 'D');

      const maxHourlyTotal = Math.max(...r.hourlyProfile.map(h => h.total || 0), 1);
      const barWidth = (chartWidth - 20) / 24;

      r.hourlyProfile.forEach((hp, hIdx) => {
        const barHeight = Math.max(2, ((hp.total || 0) / maxHourlyTotal) * (chartHeight - 12));
        const bx = chartX + 10 + hIdx * barWidth;
        const by = chartY + chartHeight - 6 - barHeight;

        if (hp.hour === r.peakHour) {
          doc.setFillColor(...ACCENT_COLOR);
        } else {
          doc.setFillColor(148, 163, 184);
        }

        doc.rect(bx, by, barWidth - 1.5, barHeight, 'F');

        if (hp.hour % 4 === 0 || hp.hour === r.peakHour) {
          doc.setFontSize(5.5);
          doc.setFont('helvetica', hp.hour === r.peakHour ? 'bold' : 'normal');
          doc.setTextColor(hp.hour === r.peakHour ? 8 : 100, hp.hour === r.peakHour ? 145 : 116, hp.hour === r.peakHour ? 178 : 139);
          doc.text(`${hp.hour}h`, bx + barWidth / 2 - 1, chartY + chartHeight - 1);
        }
      });

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXT_DARK);
      doc.text(`Pico Máximo: ${r.peakTotalBTU.toLocaleString('pt-BR')} BTU/h às ${r.peakHour}:00h`, chartX + chartWidth - 68, chartY + 5);

      currentY += chartHeight + 10;
    }
  });

  // 5. CREA/CONFEA Technical Disclaimer & ART Signature Block
  if (currentY > 215) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(254, 242, 242); // Light Warning Red Background
  doc.roundedRect(14, currentY, 182, 45, 2, 2, 'F');
  doc.setDrawColor(248, 113, 113);
  doc.roundedRect(14, currentY, 182, 45, 2, 2, 'D');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(153, 27, 27);
  doc.text('PARECER E AVISO DE RESPONSABILIDADE TÉCNICA (CREA / CONFEA)', 18, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(127, 29, 29);
  const disclaimerText = doc.splitTextToSize(
    'Este laudo técnico reflete a memória de cálculo de simulação térmica em conformidade rigorosa com as normas ABNT NBR 16401-1, ABNT NBR 15220, ASHRAE RTS/CTF e ISO 52016-1. O dimensionamento final de equipamentos de expansão direta/indireta, rede de dutos, difusores, taxas de renovação de ar e filtragem deve ser aprovado e homologado por Engenheiro Mecânico habilitado com a devida emissão da Anotação de Responsabilidade Técnica (ART) junto ao CREA/CONFEA.',
    174
  );
  doc.text(disclaimerText, 18, currentY + 13);

  // Signature lines
  const sigY = currentY + 34;
  doc.setDrawColor(185, 28, 28);
  doc.line(18, sigY, 100, sigY);
  doc.line(110, sigY, 188, sigY);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(153, 27, 27);
  doc.text('Engenheiro Mecânico Responsável / N° CREA', 18, sigY + 4);
  doc.text('Anotação de Responsabilidade Técnica (ART N°)', 110, sigY + 4);

  // 6. Page Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.line(14, 282, 196, 282);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Página ${i} de ${totalPages} • Laudo Técnico de Carga Térmica HVAC`, 14, 287);
    doc.text('Validação Técnica CREA / CONFEA', 196, 287, { align: 'right' });
  }

  // 7. Save PDF File
  const safeProjectName = (project.name || 'Projeto_HVAC').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Laudo_HVAC_${safeProjectName}.pdf`);
};

