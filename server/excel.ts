import ExcelJS from 'exceljs';
import type { RouteRecord } from './types.ts';
import { db } from './db.ts';

interface ExportExcelOptions {
  city?: string;
  differential?: string;
  onlyReviewed?: boolean;
}

export async function generateRoutesExcel(options: ExportExcelOptions = {}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Monfredini Transportes';
  workbook.lastModifiedBy = 'Monfredini Transportes OCR System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Fetch routes based on options
  let records = db.getRoutes();
  if (options.city && options.city !== 'ALL') {
    records = records.filter(r => r.originCity.toUpperCase() === options.city!.toUpperCase());
  }
  if (options.differential && options.differential !== 'ALL') {
    records = records.filter(r => r.differential === options.differential);
  }
  if (options.onlyReviewed) {
    records = records.filter(r => r.reviewStatus === 'REVISADO');
  }

  // 1. CREATE "CAPA" SHEET
  const capaSheet = workbook.addWorksheet('INÍCIO', {
    properties: { tabColor: { argb: 'FFB91C1C' } },
    views: [{ showGridLines: true }]
  });

  // Capa styling
  capaSheet.columns = [
    { width: 5 },
    { width: 25 },
    { width: 25 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 10 }
  ];

  // Title Banner
  capaSheet.mergeCells('B2:F2');
  const titleCell = capaSheet.getCell('B2');
  titleCell.value = 'MONFREDINI TRANSPORTES';
  titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B192C' }
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  capaSheet.getRow(2).height = 36;

  // Subtitle Banner
  capaSheet.mergeCells('B3:F3');
  const subtitleCell = capaSheet.getCell('B3');
  subtitleCell.value = 'TABELA DE ROTAS — MERCADO LIVRE';
  subtitleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  subtitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFB91C1C' }
  };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  capaSheet.getRow(3).height = 28;

  // Description
  capaSheet.mergeCells('B4:F4');
  const descCell = capaSheet.getCell('B4');
  descCell.value = 'COTAÇÕES E VALORES DE TRANSPORTE | GESTÃO CENTRALIZADA';
  descCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  descCell.alignment = { horizontal: 'center', vertical: 'middle' };
  capaSheet.getRow(4).height = 22;

  // Stats boxes
  const stats = db.getStats();
  capaSheet.getCell('B6').value = 'CIDADES CADASTRADAS';
  capaSheet.getCell('B7').value = stats.totalCities;
  capaSheet.getCell('D6').value = 'ROTAS ATIVAS';
  capaSheet.getCell('D7').value = stats.totalRoutes;
  capaSheet.getCell('F6').value = 'PERFIS DE VEÍCULOS';
  capaSheet.getCell('F7').value = stats.vehicleProfilesCount;

  ['B', 'D', 'F'].forEach(col => {
    const lbl = capaSheet.getCell(`${col}6`);
    lbl.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF64748B' } };
    lbl.alignment = { horizontal: 'center', vertical: 'middle' };

    const val = capaSheet.getCell(`${col}7`);
    val.font = { name: 'Arial', size: 20, bold: true, color: { argb: 'FFB91C1C' } };
    val.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Table of cities summary
  capaSheet.mergeCells('B9:F9');
  const cityHeader = capaSheet.getCell('B9');
  cityHeader.value = 'ACESSO RÁPIDO ÀS CIDADES (ABAS DA PLANILHA)';
  cityHeader.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cityHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };
  cityHeader.alignment = { horizontal: 'center', vertical: 'middle' };

  let capaRow = 11;
  const cities = db.getCities().filter(c => c.active);
  for (let i = 0; i < cities.length; i += 2) {
    const c1 = cities[i];
    const c2 = cities[i + 1];

    capaSheet.getCell(`B${capaRow}`).value = `▶ ${c1.name} (${c1.state})`;
    capaSheet.getCell(`B${capaRow}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };

    if (c2) {
      capaSheet.getCell(`E${capaRow}`).value = `▶ ${c2.name} (${c2.state})`;
      capaSheet.getCell(`E${capaRow}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    }
    capaRow++;
  }

  // 2. GROUP RECORDS BY ORIGIN CITY TO CREATE SEPARATE SHEETS
  // Identify all origin cities present
  const originCities = Array.from(new Set(records.map(r => r.originCity)));
  if (originCities.length === 0) {
    originCities.push('QUEIMADOS');
  }

  for (const originCity of originCities) {
    const cityRecords = records.filter(r => r.originCity === originCity);
    const sheetName = originCity.substring(0, 30); // Excel sheet max 31 chars
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }]
    });

    // Column widths matching reference
    sheet.columns = [
      { key: 'client', width: 20 },
      { key: 'originCity', width: 22 },
      { key: 'originCode', width: 26 },
      { key: 'destinationCity', width: 24 },
      { key: 'destinationCode', width: 26 },
      { key: 'vehicleType', width: 22 },
      { key: 'value', width: 18 },
      { key: 'differential', width: 16 }
    ];

    let currentRow = 1;

    // Top Dark Navigation Bar: "⌂ VOLTAR À CAPA"
    sheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const topBar = sheet.getCell(`A${currentRow}`);
    topBar.value = '⌂ VOLTAR À CAPA';
    topBar.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    topBar.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B192C' }
    };
    topBar.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    sheet.getRow(currentRow).height = 24;
    currentRow++;

    // Group city records by route (destinationCity + destinationCode + differential)
    const routeGroups = new Map<string, RouteRecord[]>();
    for (const rec of cityRecords) {
      const key = `${rec.destinationCity}__${rec.destinationCode}__${rec.differential}`;
      if (!routeGroups.has(key)) {
        routeGroups.set(key, []);
      }
      routeGroups.get(key)!.push(rec);
    }

    // Render each route section
    for (const [, group] of routeGroups) {
      if (group.length === 0) continue;
      const first = group[0];

      const profileGroup = (vehicleType: string) => {
        if (/\bCASA\b/i.test(vehicleType)) return 0;
        if (/3\s*(?:º|°|o)|TERCEIRO/i.test(vehicleType)) return 2;
        return 1;
      };
      group.sort((a, b) => profileGroup(a.vehicleType) - profileGroup(b.vehicleType));

      // Route Banner: e.g. "QUEIMADOS → SÃO JOÃO DE MERITI | CÓDIGO DESTINO: BRRJ02"
      // or "QUEIMADOS → EXTREMA (CPL) | CÓDIGO DESTINO: BRMG01"
      const diffSuffix = first.differential && first.differential !== 'NORMAL' && first.differential !== '-'
        ? ` (${first.differential})`
        : '';
      const bannerText = `${first.originCity} → ${first.destinationCity}${diffSuffix} | CÓDIGO DESTINO: ${first.destinationCode}`;

      sheet.mergeCells(`A${currentRow}:H${currentRow}`);
      const bannerCell = sheet.getCell(`A${currentRow}`);
      bannerCell.value = bannerText;
      bannerCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      bannerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFB91C1C' } // Vibrant crimson red
      };
      bannerCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      sheet.getRow(currentRow).height = 28;
      currentRow++;

      // Header row: CLIENTE | CIDADE ORIGEM | SIGLA ORIGEM | CIDADE DESTINO | SIGLA DESTINO | TIPO | VALOR | DIFERENCIAL
      const headers = [
        'CLIENTE',
        'CIDADE ORIGEM',
        'SIGLA ORIGEM',
        'CIDADE DESTINO',
        'SIGLA DESTINO',
        'TIPO',
        'VALOR',
        'DIFERENCIAL'
      ];
      const headerRow = sheet.getRow(currentRow);
      headerRow.height = 22;

      headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0C1E30' } // Dark blue / black table header
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF334155' } },
          bottom: { style: 'thin', color: { argb: 'FF334155' } },
          left: { style: 'thin', color: { argb: 'FF334155' } },
          right: { style: 'thin', color: { argb: 'FF334155' } }
        };
      });
      currentRow++;

      // Vehicle rows with alternating colors
      group.forEach((rec, idx) => {
        const row = sheet.getRow(currentRow);
        row.height = 20;
        const isEven = idx % 2 === 1;
        const bgArgb = isEven ? 'FFF8F9FA' : 'FFFFFFFF';

        const rowValues = [
          rec.client,
          rec.originCity,
          rec.originCode,
          rec.destinationCity,
          rec.destinationCode,
          rec.vehicleType,
          rec.totalValue,
          rec.differential === 'NORMAL' ? 'Normal' : rec.differential
        ];

        rowValues.forEach((val, colIdx) => {
          const cell = row.getCell(colIdx + 1);
          cell.value = val;
          cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgArgb }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };

          // Alignment rules
          if (colIdx === 0) {
            cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
          } else if (colIdx === 6) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' }; // VALOR
          } else {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });

        currentRow++;
      });

      // Space between routes
      sheet.getRow(currentRow).height = 14;
      currentRow++;
    }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
