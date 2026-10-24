import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, UPLOADS_DIR } from './server/db.ts';
import { processDocumentWithOCR, parseCurrencyInput } from './server/ocr.ts';
import { generateRoutesExcel } from './server/excel.ts';
import { createSampleTransportPdf } from './server/samplePdf.ts';
import type { RouteRecord, UploadedDocument } from './server/types.ts';
// @ts-ignore
import archiver from 'archiver';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const processingFileHashes = new Set<string>();
const processingDocumentIds = new Set<string>();

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Serve uploaded storage files if requested
app.use('/storage/uploads', express.static(UPLOADS_DIR));

// ----------------- API ROUTES ----------------- //

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cities
app.get('/api/cities', (req, res) => {
  try {
    const cities = db.getCities();
    res.json(cities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cities', (req, res) => {
  try {
    const { name, state, codes, active } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome da cidade é obrigatório' });
    const codeList = Array.isArray(codes) ? codes : [codes].filter(Boolean);
    const city = db.addCity({ name, state: state || 'BR', codes: codeList, active });
    res.status(201).json(city);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cities/:id', (req, res) => {
  try {
    const updated = db.updateCity(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Cidade não encontrada' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cities/:id', (req, res) => {
  try {
    const success = db.deleteCity(req.params.id);
    if (!success) return res.status(404).json({ error: 'Cidade não encontrada' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Routes
app.get('/api/routes', (req, res) => {
  try {
    const { originCity, destinationCity, differential, reviewStatus, documentId, search } = req.query;
    const routes = db.getRoutes({
      originCity: originCity as string,
      destinationCity: destinationCity as string,
      differential: differential as string,
      reviewStatus: reviewStatus as string,
      documentId: documentId as string,
      search: search as string
    });
    res.json(routes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/routes', (req, res) => {
  try {
    const body = req.body;
    const { formatted, numeric } = parseCurrencyInput(body.totalValue);
    const origCity = (body.originCity || '').toUpperCase().trim();
    const origCode = (body.originCode || '').toUpperCase().trim();
    const destCity = (body.destinationCity || '').toUpperCase().trim();
    const destCode = (body.destinationCode || '').toUpperCase().trim();

    // Auto-register cities in database if not registered yet
    if (origCity && !db.getCityByName(origCity)) {
      db.addCity({ name: origCity, state: 'BR', codes: origCode ? [origCode] : ['COD-01'], active: true });
    }
    if (destCity && !db.getCityByName(destCity)) {
      db.addCity({ name: destCity, state: 'BR', codes: destCode ? [destCode] : ['COD-01'], active: true });
    }

    const newRecord: RouteRecord = {
      id: `rec-${crypto.randomBytes(8).toString('hex')}`,
      documentId: body.documentId || 'manual',
      documentPageId: body.documentPageId || 'manual',
      documentName: body.documentName || 'Registro Manual',
      pageNumber: Number(body.pageNumber) || 1,
      client: body.client || 'Mercado Livre',
      originCity: origCity,
      originState: body.originState,
      originCode: origCode,
      destinationCity: destCity,
      destinationCode: destCode,
      vehicleType: body.vehicleType,
      totalValue: formatted,
      numericValue: numeric,
      differential: body.differential || 'NORMAL',
      ocrConfidence: Number.isFinite(Number(body.ocrConfidence)) ? Number(body.ocrConfidence) : 100,
      reviewStatus: body.forcePendingReview === true
        ? 'AGUARDANDO CONFERÊNCIA'
        : body.reviewStatus || 'REVISADO',
      notes: body.notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.addRouteRecords([newRecord]);
    res.status(201).json(newRecord);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/routes/:id', (req, res) => {
  try {
    const updates = { ...req.body };
    const existingRoute = db.getRoutes().find(route => route.id === req.params.id);
    if (updates.totalValue !== undefined) {
      const { formatted, numeric } = parseCurrencyInput(updates.totalValue);
      updates.totalValue = formatted;
      updates.numericValue = numeric;
    }
    for (const field of ['freightWeightValue', 'tollValue'] as const) {
      if (updates[field] !== undefined) {
        updates[field] = updates[field] === null ? null : parseCurrencyInput(updates[field]).numeric;
      }
    }
    if (updates.receivableValue !== undefined) {
      const { numeric } = parseCurrencyInput(updates.receivableValue);
      updates.receivableValue = numeric;
      const isBreakdown = updates.hasFreightBreakdown ?? existingRoute?.hasFreightBreakdown;
      const vehicleType = String(updates.vehicleType ?? existingRoute?.vehicleType ?? '');
      const isThirdProfile = /3\s*(?:º|°|o)|TERCEIRO/i.test(vehicleType);
      const originState = String(updates.originState ?? existingRoute?.originState ?? '').toUpperCase();
      const paymentPercent = updates.driverPaymentPercent ?? existingRoute?.driverPaymentPercent ?? (originState === 'SP' ? 10 : originState ? 20 : undefined);
      if (isBreakdown && !isThirdProfile && numeric != null && paymentPercent !== undefined) {
        const receivableCents = Math.round(numeric * 100);
        const paymentCents = Math.floor((receivableCents * (100 - paymentPercent) + 50) / 100);
        const payment = paymentCents / 100;
        const { formatted, numeric: paymentNumeric } = parseCurrencyInput(payment);
        updates.receivableValue = receivableCents / 100;
        updates.driverPaymentValue = paymentNumeric;
        updates.driverPaymentPercent = paymentPercent;
        updates.totalValue = formatted;
        updates.numericValue = paymentNumeric;
      }
    }
    const updated = db.updateRouteRecord(req.params.id, updates);
    if (!updated) return res.status(404).json({ error: 'Registro de rota não encontrado' });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/routes/:id', (req, res) => {
  try {
    const success = db.deleteRouteRecord(req.params.id);
    if (!success) return res.status(404).json({ error: 'Registro não encontrado' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/routes/batch-delete', (req, res) => {
  try {
    const requestedIds: string[] = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    const ids = [...new Set(requestedIds)];
    if (ids.length === 0) return res.status(400).json({ error: 'Selecione ao menos um registro para excluir.' });
    const deletedIds = ids.filter((id: string) => db.deleteRouteRecord(id));
    res.json({ success: true, deletedCount: deletedIds.length, deletedIds });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/routes/batch-approve', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs devem ser uma lista não vazia' });
    }
    const count = db.batchUpdateStatus(ids, 'REVISADO');
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Documents
app.get('/api/documents', (req, res) => {
  try {
    const docs = db.getDocuments();
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:id', (req, res) => {
  try {
    const doc = db.getDocumentById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });
    const records = db.getRoutes({ documentId: doc.id });
    res.json({ ...doc, records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload PDFs (Single or Multiple)
app.post('/api/documents/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const results: any[] = [];

    for (const file of files) {
      // 1. Calculate file hash for idempotency
      const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

      // 2. Check if already imported
      const existingDoc = db.getDocumentByHash(fileHash);
      const existingRoutes = existingDoc ? db.getRoutes({ documentId: existingDoc.id }) : [];
      const isProcessingNow = processingFileHashes.has(fileHash) || Boolean(existingDoc && processingDocumentIds.has(existingDoc.id));
      if (existingDoc && !req.query.force && existingRoutes.length > 0) {
        results.push({
          filename: file.originalname,
          status: 'DUPLICATE',
          message: 'Este arquivo já possui rotas salvas. Nenhuma cópia foi criada.',
          documentId: existingDoc.id,
          recordsExtracted: existingRoutes.length
        });
        continue;
      }
      if (existingDoc && isProcessingNow) {
        results.push({
          filename: file.originalname,
          status: 'PROCESSING',
          message: 'Este arquivo já está sendo processado nesta sessão.',
          documentId: existingDoc.id
        });
        continue;
      }

      // 3. Save physical file
      const retryExistingDocument = Boolean(existingDoc && existingRoutes.length === 0);
      const docId = retryExistingDocument
        ? existingDoc!.id
        : `doc-${crypto.randomBytes(6).toString('hex')}`;
      const safeFilename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storagePath = path.join(UPLOADS_DIR, safeFilename);
      fs.writeFileSync(storagePath, file.buffer);

      // 4. Create document record
      const docRecord: UploadedDocument = {
        id: docId,
        filename: file.originalname,
        fileHash,
        fileSize: file.size,
        storagePath: `storage/uploads/${safeFilename}`,
        pageCount: 1, // basic estimate, updated after processing
        processingStatus: 'PROCESSING',
        autoConfirmed: db.getSettings().autoConfirmOcr,
        totalRecordsExtracted: 0,
        uploadedAt: new Date().toISOString(),
        processingStartedAt: new Date().toISOString()
      };
      if (retryExistingDocument) db.updateDocument(docId, docRecord);
      else db.addDocument(docRecord);

      processingFileHashes.add(fileHash);
      processingDocumentIds.add(docId);
      try {
        // 5. Run OCR with local PaddleOCR-VL
        const extractedRoutes = await processDocumentWithOCR(
          file.buffer,
          file.mimetype || 'application/pdf',
          file.originalname,
          docId
        );

        // Update document as completed
        db.updateDocument(docId, {
          processingStatus: 'COMPLETED',
          totalRecordsExtracted: extractedRoutes.length,
          processedAt: new Date().toISOString()
        });

        results.push({
          documentId: docId,
          filename: file.originalname,
          status: 'SUCCESS',
          originCity: extractedRoutes[0]?.originCity,
          recordsExtracted: extractedRoutes.length
        });
      } catch (procErr: any) {
        console.error(`Error processing file ${file.originalname}:`, procErr);
        db.updateDocument(docId, {
          processingStatus: 'ERROR',
          errorMessage: procErr.message || 'Erro no processamento OCR',
          processedAt: new Date().toISOString()
        });
        results.push({
          documentId: docId,
          filename: file.originalname,
          status: 'ERROR',
          error: procErr.message
        });
      } finally {
        processingFileHashes.delete(fileHash);
        processingDocumentIds.delete(docId);
      }
    }

    res.json({ results });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reprocess document
app.post('/api/documents/:id/reprocess', async (req, res) => {
  let processingDoc: UploadedDocument | undefined;
  let acquiredProcessingLock = false;
  try {
    const doc = db.getDocumentById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Documento não encontrado' });
    processingDoc = doc;
    if (processingDocumentIds.has(doc.id)) {
      return res.status(409).json({ error: 'Este documento já está sendo processado. Aguarde a conclusão.' });
    }
    processingDocumentIds.add(doc.id);
    acquiredProcessingLock = true;

    const fullPath = path.resolve(__dirname, doc.storagePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Arquivo original não encontrado no servidor' });
    }

    const fileBuffer = fs.readFileSync(fullPath);
    db.updateDocument(doc.id, { processingStatus: 'PROCESSING', processingStartedAt: new Date().toISOString(), errorMessage: undefined });

    const routes = await processDocumentWithOCR(
      fileBuffer,
      'application/pdf',
      doc.filename,
      doc.id
    );

    // OCR has already saved the newly extracted records. Replace the previous
    // extraction only after success so retries cannot duplicate this document's routes.
    db.removeDocumentRoutesExcept(doc.id, routes.map(route => route.id));

    db.updateDocument(doc.id, {
      processingStatus: 'COMPLETED',
      totalRecordsExtracted: routes.length,
      processedAt: new Date().toISOString()
    });

    res.json({ success: true, count: routes.length });
  } catch (err: any) {
    if (processingDoc) {
      db.updateDocument(processingDoc.id, {
        processingStatus: 'ERROR',
        errorMessage: err.message || 'Erro no reprocessamento OCR',
        processedAt: new Date().toISOString()
      });
    }
    console.error(`Error reprocessing document ${req.params.id}:`, err);
    res.status(500).json({ error: err.message });
  } finally {
    if (acquiredProcessingLock) processingDocumentIds.delete(req.params.id);
  }
});

// Generate and import sample transport slip PDF with 1-click
app.post('/api/documents/generate-sample', async (req, res) => {
  try {
    const { origin, destination, differential } = req.body;
    const sampleBuffer = await createSampleTransportPdf({
      origin: origin || 'QUEIMADOS',
      destination: destination || 'EXTREMA',
      differential: differential || 'CPL'
    });

    const filename = `COTAÇÃO_MANUSCRITA_${(origin || 'QUEIMADOS')}_${(destination || 'EXTREMA')}_${Date.now()}.pdf`;
    const docId = `doc-sample-${crypto.randomBytes(4).toString('hex')}`;
    const fileHash = crypto.createHash('sha256').update(sampleBuffer).digest('hex');
    const safeFilename = `${Date.now()}-${filename}`;
    const storagePath = path.join(UPLOADS_DIR, safeFilename);

    fs.writeFileSync(storagePath, sampleBuffer);

    const docRecord: UploadedDocument = {
      id: docId,
      filename,
      fileHash,
      fileSize: sampleBuffer.length,
      storagePath: `storage/uploads/${safeFilename}`,
      pageCount: 1,
      processingStatus: 'PROCESSING',
      autoConfirmed: false,
      totalRecordsExtracted: 0,
      uploadedAt: new Date().toISOString()
    };
    db.addDocument(docRecord);

    const routes = await processDocumentWithOCR(
      sampleBuffer,
      'application/pdf',
      filename,
      docId
    );

    db.updateDocument(docId, {
      processingStatus: 'COMPLETED',
      totalRecordsExtracted: routes.length,
      processedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      documentId: docId,
      filename,
      recordsCount: routes.length
    });
  } catch (err: any) {
    console.error('Error creating sample PDF:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export Excel
app.post('/api/export-excel', async (req, res) => {
  try {
    const { city, differential, onlyReviewed } = req.body;
    const excelBuffer = await generateRoutesExcel({
      city,
      differential,
      onlyReviewed
    });

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `Tabela_Rotas_Monfredini_${city || 'Todas'}_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (err: any) {
    console.error('Excel generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download Entire Project as ZIP
app.get('/api/download-project', (req, res) => {
  try {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const filename = 'monfredini-transportes-web.zip';

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    archive.pipe(res);

    archive.glob('**/*', {
      cwd: __dirname,
      nodir: true,
      ignore: [
        'node_modules/**',
        'dist/**',
        '.git/**',
        '.aistudio/**',
        '*.tmp*',
        '*.log',
        '**/*.zip',
        'public/assets/aistudio/image_*.png'
      ],
      dot: true
    });

    archive.finalize();
  } catch (err: any) {
    console.error('Error packaging project zip:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reset / Clear All Data
app.post('/api/reset-data', (req, res) => {
  try {
    const { keepCities = true } = req.body || {};
    const result = db.clearAllData({ keepCities });
    res.json({
      success: true,
      message: 'Todas as informações de rotas e documentos foram zeradas com sucesso!',
      ...result
    });
  } catch (err: any) {
    console.error('Error resetting database:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download Raw JSON Database Backup to User Machine
app.get('/api/backup', (req, res) => {
  try {
    const dbFilePath = path.resolve(__dirname, 'data/database.json');
    if (!fs.existsSync(dbFilePath)) {
      return res.status(404).json({ error: 'Arquivo de banco de dados não encontrado.' });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="monfredini-dados-backup-${timestamp}.json"`);
    fs.createReadStream(dbFilePath).pipe(res);
  } catch (err: any) {
    console.error('Error streaming backup:', err);
    res.status(500).json({ error: err.message });
  }
});

// Restore Database from JSON uploaded from User Machine
app.post('/api/restore', (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || (!backupData.cities && !backupData.routeRecords)) {
      return res.status(400).json({
        error: 'Arquivo de backup inválido. O arquivo JSON deve conter as propriedades "cities" ou "routeRecords".'
      });
    }
    const stats = db.restoreData(backupData);
    res.json({
      success: true,
      message: 'Dados restaurados com sucesso a partir do arquivo do seu computador!',
      stats
    });
  } catch (err: any) {
    console.error('Error restoring backup:', err);
    res.status(500).json({ error: err.message });
  }
});

// Settings
app.get('/api/settings', (req, res) => {
  res.json(db.getSettings());
});

app.put('/api/settings', (req, res) => {
  try {
    if (req.body?.ocrEngine !== undefined && !['paddle', 'rapidocr'].includes(req.body.ocrEngine)) {
      res.status(400).json({ error: 'Mecanismo OCR inválido.' });
      return;
    }
    const updated = db.updateSettings(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------- VITE INTEGRATION ----------------- //
async function startServer() {
  // A process restart clears in-memory OCR locks. Recover documents left as PROCESSING
  // by a closed browser, interrupted request, or server shutdown so they can be retried.
  for (const doc of db.getDocuments()) {
    if (doc.processingStatus === 'PROCESSING' && db.getRoutes({ documentId: doc.id }).length === 0) {
      db.updateDocument(doc.id, {
        processingStatus: 'ERROR',
        errorMessage: 'O processamento foi interrompido antes de salvar rotas. Tente reprocessar este PDF.',
        processedAt: new Date().toISOString()
      });
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Monfredini Transportes Server running on port ${PORT}`);
  });
}

startServer();
