import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function createSampleTransportPdf(options: {
  origin?: string;
  destination?: string;
  differential?: string;
  client?: string;
}): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHandwritten = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const { width, height } = page.getSize();
  const origin = options.origin || 'QUEIMADOS';
  const destination = options.destination || 'EXTREMA';
  const differential = options.differential || 'CPL';
  const client = options.client || 'MERCADO LIVRE';

  // Header Box
  page.drawRectangle({
    x: 40,
    y: height - 100,
    width: width - 80,
    height: 60,
    color: rgb(0.05, 0.1, 0.18),
    borderWidth: 1,
    borderColor: rgb(0.8, 0.1, 0.1)
  });

  page.drawText('MONFREDINI TRANSPORTES', {
    x: 55,
    y: height - 65,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  page.drawText('FORMULÁRIO DE COTAÇÃO DE FRETES & ROTAS', {
    x: 55,
    y: height - 85,
    size: 10,
    font: fontRegular,
    color: rgb(0.9, 0.2, 0.2)
  });

  // Client, Origin, Destination, Differential Box
  page.drawRectangle({
    x: 40,
    y: height - 200,
    width: width - 80,
    height: 85,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 1
  });

  // Labels
  page.drawText('CLIENTE:', { x: 55, y: height - 135, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('CIDADE ORIGEM:', { x: 55, y: height - 165, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('CIDADE DESTINO:', { x: 260, y: height - 165, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('DIFERENCIAL:', { x: 440, y: height - 165, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });

  // "Handwritten" values (in blue-black ink simulation)
  const inkColor = rgb(0.08, 0.15, 0.55);
  page.drawText(client, { x: 130, y: height - 135, size: 12, font: fontHandwritten, color: inkColor });
  page.drawText(origin, { x: 155, y: height - 165, size: 12, font: fontHandwritten, color: inkColor });
  page.drawText(destination, { x: 360, y: height - 165, size: 12, font: fontHandwritten, color: inkColor });
  page.drawText(differential, { x: 440, y: height - 180, size: 13, font: fontHandwritten, color: rgb(0.8, 0.1, 0.1) });

  // Table Header
  const tableTop = height - 230;
  page.drawRectangle({
    x: 40,
    y: tableTop - 25,
    width: width - 80,
    height: 25,
    color: rgb(0.7, 0.05, 0.08)
  });

  page.drawText('PERFIL DE VEÍCULO', { x: 55, y: tableTop - 18, size: 10, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('VALOR TOTAL (R$)', { x: 380, y: tableTop - 18, size: 10, font: fontBold, color: rgb(1, 1, 1) });

  // Vehicles list
  const vehicles = [
    { type: 'BITREM', val: differential === 'CPL' ? '5.200,00' : '-' },
    { type: 'BITREM 3º', val: '-' },
    { type: 'CARRETA CASA', val: differential === 'CPL' ? '3.500,00' : '1.000,00' },
    { type: 'TRUCK CASA', val: differential === 'CPL' ? '3.000,00' : '800,00' },
    { type: 'CARRETA AGREGADO', val: differential === 'CPL' ? '2.800,00' : '700,00' },
    { type: 'CARRETA 3º', val: differential === 'CPL' ? '3.200,00' : '800,00' },
    { type: 'TRUCK 3º', val: differential === 'CPL' ? '2.400,00' : '700,00' },
    { type: 'TOCO 3º', val: differential === 'CPL' ? '2.100,00' : '600,00' },
    { type: 'MÉDIO (3/4 - 3º)', val: differential === 'CPL' ? '1.900,00' : '500,00' },
    { type: 'VUC 3º', val: differential === 'CPL' ? '1.700,00' : '400,00' }
  ];

  let y = tableTop - 50;
  vehicles.forEach((v, idx) => {
    // Alternating background
    if (idx % 2 === 1) {
      page.drawRectangle({
        x: 40,
        y: y - 5,
        width: width - 80,
        height: 24,
        color: rgb(0.95, 0.95, 0.95)
      });
    }

    // Vehicle Type (printed form font)
    page.drawText(v.type, {
      x: 55,
      y: y + 2,
      size: 9,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    });

    // Handwritten line underline
    page.drawLine({
      start: { x: 360, y: y },
      end: { x: 530, y: y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7)
    });

    // Handwritten Value
    if (v.val !== '-') {
      page.drawText(`R$ ${v.val}`, {
        x: 380,
        y: y + 3,
        size: 11,
        font: fontHandwritten,
        color: inkColor
      });
    } else {
      page.drawText('-', {
        x: 430,
        y: y + 3,
        size: 11,
        font: fontHandwritten,
        color: inkColor
      });
    }

    y -= 26;
  });

  // Footer notes & signatures
  page.drawText('Observações / Manuscrito do Operador:', {
    x: 45,
    y: 120,
    size: 8,
    font: fontBold,
    color: rgb(0.4, 0.4, 0.4)
  });
  page.drawText('Valores cotados com pedágio e seguro inclusos. Válido para a rota informada.', {
    x: 45,
    y: 105,
    size: 8,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4)
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
