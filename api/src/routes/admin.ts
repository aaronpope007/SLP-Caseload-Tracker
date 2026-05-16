import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { stringifyJsonField } from '../utils/jsonHelpers';
import { splitStudentName } from '../utils/studentName';
import { inferGoalDomainFromDescription } from '../utils/inferGoalDomainFromDescription';

export const adminRouter = Router();

// TODO(cleanup): POST /import-codes still expects legacy parallel string[] icd10Codes +
// icd10Descriptions. import-codes-payload.json uses SpedForms object shape; update this route
// to parse object[] and write via serializeIcd10ForDb (see students PUT) before re-running bulk import.

type ImportEntry = {
  firstName?: string;
  lastName?: string;
  domain?: string;
  icd10Codes?: string[];
  icd10Descriptions?: string[];
  cptCodeIndividual?: string;
  cptCodeGroup?: string;
};

adminRouter.post('/import-codes', asyncHandler(async (req, res) => {
  const headerToken = req.headers['x-admin-token'];
  const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  if (token !== process.env.ADMIN_IMPORT_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { students } = req.body as { students?: ImportEntry[] };
  if (!Array.isArray(students)) {
    return res.status(400).json({ error: 'Request body must include a students array' });
  }

  const results = {
    updated: [] as string[],
    notFound: [] as string[],
    errors: [] as { student: string; error: string }[],
  };

  const rows = db.prepare('SELECT id, name FROM students').all() as Array<{ id: string; name: string }>;
  const byKey = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of rows) {
    const { firstName, lastName } = splitStudentName(row.name);
    const key = `${firstName.toLowerCase()}\0${lastName.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(row);
  }

  const updateStmt = db.prepare(`
    UPDATE students SET
      domain = ?,
      icd10Codes = ?,
      icd10Descriptions = ?,
      cptCodeIndividual = ?,
      cptCodeGroup = ?,
      codesMappedAt = ?,
      codesMappedByAI = ?
    WHERE id = ?
  `);

  for (const entry of students) {
    const label = `${String(entry?.lastName ?? '').trim()}, ${String(entry?.firstName ?? '').trim()}`;
    try {
      const firstName = String(entry?.firstName ?? '').trim();
      const lastName = String(entry?.lastName ?? '').trim();
      if (!firstName || !lastName) {
        results.errors.push({ student: label || '(missing name)', error: 'firstName and lastName are required' });
        continue;
      }

      const key = `${firstName.toLowerCase()}\0${lastName.toLowerCase()}`;
      const matches = byKey.get(key);
      const student = matches?.[0];

      if (!student) {
        results.notFound.push(`${lastName}, ${firstName}`);
        continue;
      }

      const icd10Codes = Array.isArray(entry.icd10Codes) ? entry.icd10Codes : [];
      const icd10Descriptions = Array.isArray(entry.icd10Descriptions) ? entry.icd10Descriptions : [];
      const cptInd = entry.cptCodeIndividual?.trim() || '92507';
      const cptGrp = entry.cptCodeGroup?.trim() || '92508';
      const domain = entry.domain?.trim() ?? '';

      updateStmt.run(
        domain || null,
        stringifyJsonField(icd10Codes) ?? '[]',
        stringifyJsonField(icd10Descriptions) ?? '[]',
        cptInd,
        cptGrp,
        new Date().toISOString(),
        0,
        student.id
      );

      results.updated.push(`${lastName}, ${firstName}`);
    } catch (err) {
      results.errors.push({
        student: label,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  res.json(results);
}));

/**
 * One-time: infer goal.domain from description for rows with missing domain (x-admin-token).
 */
adminRouter.post('/infer-goal-domains', asyncHandler(async (req, res) => {
  const headerToken = req.headers['x-admin-token'];
  const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
  if (token !== process.env.ADMIN_IMPORT_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const rows = db
    .prepare(
      `SELECT id, description, domain FROM goals WHERE domain IS NULL OR TRIM(COALESCE(domain, '')) = ''`
    )
    .all() as Array<{ id: string; description: string; domain: string | null }>;

  const updateStmt = db.prepare('UPDATE goals SET domain = ? WHERE id = ?');
  const byDomain: Record<string, number> = {};
  let updated = 0;
  let skippedNoInference = 0;

  for (const row of rows) {
    const inferred = inferGoalDomainFromDescription(row.description);
    if (!inferred) {
      skippedNoInference++;
      continue;
    }
    updateStmt.run(inferred, row.id);
    updated++;
    byDomain[inferred] = (byDomain[inferred] || 0) + 1;
  }

  res.json({
    message: 'Goal domain inference complete',
    candidates: rows.length,
    updated,
    skippedNoInference,
    byDomain,
  });
}));
