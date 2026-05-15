import { Router } from 'express';
import type { z } from 'zod';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';
import {
  createSessionSchema,
  updateSessionSchema,
  generateSessionNotesBodySchema,
  patchSessionMaLoggedBodySchema,
} from '../schemas';
import { mergeIcdFromDomains, getIcdCodesFromDomain } from '../utils/goalDomainIcd10';
import {
  generateSessionNotesWithGemini,
  genericSessionNote,
  buildSoapNoteGenerationSession,
  type SessionNotePromptSession,
  type AddressedGoalWithIcd,
} from '../utils/geminiSessionNotes';
import { generateSessionNotesWithAnthropic } from '../utils/anthropicSessionNotes';
import { logger } from '../utils/logger';

// Database row types
interface SessionRow {
  id: string;
  studentId: string;
  date: string;
  endTime: string | null;
  goalsTargeted: string; // JSON string
  goalsAddressed: string | null;
  activitiesUsed: string; // JSON string
  performanceData: string; // JSON string
  notes: string;
  isDirectServices: number;
  indirectServicesNotes: string | null;
  groupSessionId: string | null;
  missedSession: number;
  selectedSubjectiveStatements: string | null; // JSON string
  customSubjective: string | null;
  plan: string | null;
  scheduledSessionId: string | null;
  tsisGroup: number | null;
  cptCode: string | null;
  icd10Codes: string | null;
  aiGeneratedNote: string | null;
  maLogged: number | null;
}

// Performance data type for proper parsing
interface PerformanceDataItem {
  goalId: string;
  accuracy?: number;
  correctTrials?: number;
  incorrectTrials?: number;
  notes?: string;
  cuingLevels?: string[];
}

function primaryGoalIdFromSessionRow(row: SessionRow): string | null {
  const perf = parseJsonField<PerformanceDataItem[]>(row.performanceData, []);
  const gid = perf[0]?.goalId;
  const t = typeof gid === 'string' ? gid.trim() : String(gid ?? '').trim();
  return t || null;
}

interface AugmentedSessionRow extends SessionRow {
  studentIcd10Codes: string | null;
  studentIcd10Descriptions: string | null;
}

function batchGoalMetaForStudent(
  studentId: string,
  goalIds: string[]
): Map<string, { description: string; domain: string | null }> {
  const map = new Map<string, { description: string; domain: string | null }>();
  const ids = [...new Set(goalIds.map((x) => x.trim()).filter(Boolean))];
  if (ids.length === 0) return map;
  const ph = ids.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id, description, domain FROM goals WHERE studentId = ? AND id IN (${ph})`)
    .all(studentId, ...ids) as Array<{ id: string; description: string; domain: string | null }>;
  for (const r of rows) {
    map.set(r.id, { description: (r.description || '').trim(), domain: r.domain?.trim() || null });
  }
  return map;
}

function collectOrderedGoalIds(row: SessionRow): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of parseJsonField<string[]>(row.goalsAddressed, [])) {
    const gid = typeof id === 'string' ? id.trim() : String(id).trim();
    if (gid && !seen.has(gid)) {
      seen.add(gid);
      out.push(gid);
    }
  }
  for (const p of parseJsonField<PerformanceDataItem[]>(row.performanceData, [])) {
    const gid = typeof p.goalId === 'string' ? p.goalId.trim() : String(p.goalId ?? '').trim();
    if (gid && !seen.has(gid)) {
      seen.add(gid);
      out.push(gid);
    }
  }
  return out;
}

function performanceSummaryForMa(
  row: SessionRow,
  studentId: string,
  goalMeta: Map<string, { description: string; domain: string | null }>
): Array<{
  goalId: string;
  goalDescription: string;
  accuracy: number;
  correctTrials: number;
  totalTrials: number;
  cuingLevels: string[];
  notes: string;
}> {
  const perfRaw = parseJsonField<PerformanceDataItem[]>(row.performanceData, []);
  return perfRaw
    .map((p) => {
      const gid = typeof p?.goalId === 'string' ? p.goalId.trim() : String(p?.goalId ?? '').trim();
      if (!gid) return null;
      const correct = Math.max(0, Math.round(Number(p.correctTrials) || 0));
      const incorrect = Math.max(0, Math.round(Number(p.incorrectTrials) || 0));
      const totalTrials = correct + incorrect;
      const accuracy = Math.round(Number(p.accuracy) || 0);
      const cuingLevels = Array.isArray(p.cuingLevels)
        ? p.cuingLevels.map((c) => String(c).trim()).filter(Boolean)
        : [];
      const notes = typeof p.notes === 'string' ? p.notes : '';
      const meta = goalMeta.get(gid);
      const goalDescription = meta?.description || gid;
      return {
        goalId: gid,
        goalDescription,
        accuracy,
        correctTrials: correct,
        totalTrials,
        cuingLevels,
        notes,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);
}

function buildAddressedGoalsWithIcd(
  row: SessionRow,
  studentId: string,
  goalMeta: Map<string, { description: string; domain: string | null }>,
  studentIcd10Codes: string[],
  studentIcd10Descriptions: string[]
): AddressedGoalWithIcd[] {
  const ordered = collectOrderedGoalIds(row);
  const out: AddressedGoalWithIcd[] = [];
  for (const goalId of ordered) {
    const meta = goalMeta.get(goalId);
    const goalDescription = meta?.description || goalId;
    const domain = meta?.domain ?? null;
    let icd10Codes: string[] = [];
    let icd10Descriptions: string[] = [];
    if (domain) {
      const m = getIcdCodesFromDomain(domain);
      icd10Codes = m.codes;
      icd10Descriptions = m.descriptions;
    }
    if (icd10Codes.length === 0 && studentIcd10Codes.length > 0) {
      icd10Codes = [...studentIcd10Codes];
      icd10Descriptions = [...studentIcd10Descriptions];
    }
    out.push({ goalId, goalDescription, domain, icd10Codes, icd10Descriptions });
  }
  return out;
}

function goalDescriptionDomainFor(
  goalId: string | null,
  studentId: string
): { description: string; domain: string } | null {
  if (!goalId) return null;
  const g = db
    .prepare('SELECT description, domain FROM goals WHERE id = ? AND studentId = ?')
    .get(goalId, studentId) as { description: string; domain: string | null } | undefined;
  if (!g) return null;
  return { description: (g.description || '').trim(), domain: (g.domain || '').trim() };
}

function priorSessionAccuracyForGoal(
  studentId: string,
  currentSessionId: string,
  beforeDateIso: string,
  goalId: string | null
): number | null {
  if (!goalId) return null;
  const rows = db
    .prepare(
      `SELECT performanceData FROM sessions
       WHERE studentId = ?
         AND id != ?
         AND datetime(date) < datetime(?)
         AND (missedSession = 0 OR missedSession IS NULL)
       ORDER BY date DESC`
    )
    .all(studentId, currentSessionId, beforeDateIso) as Array<{ performanceData: string }>;
  for (const pr of rows) {
    const perf = parseJsonField<PerformanceDataItem[]>(pr.performanceData, []);
    const match = perf.find(
      (x) => (typeof x.goalId === 'string' ? x.goalId.trim() : String(x.goalId ?? '').trim()) === goalId
    );
    if (match && match.accuracy != null) {
      return Math.round(Number(match.accuracy) || 0);
    }
  }
  return null;
}

function resolveGoalDescriptionForLog(
  studentId: string,
  token: string,
  goalMetaByStudentAndId: Map<string, { description: string; domain: string | null }>,
  goalsMap: Map<string, string>
): string {
  const tr = typeof token === 'string' ? token.trim() : String(token).trim();
  if (!tr) return tr;
  if (tr.length <= 220) {
    const meta = goalMetaByStudentAndId.get(`${studentId}|${tr}`);
    if (meta?.description?.trim()) return meta.description.trim();
  }
  const byId = goalsMap.get(tr);
  if (byId?.trim()) return byId.trim();
  return tr;
}

function toSessionResponse(s: SessionRow) {
  return {
    id: s.id,
    studentId: s.studentId,
    date: s.date,
    endTime: s.endTime || undefined,
    goalsTargeted: parseJsonField<string[]>(s.goalsTargeted, []),
    goalsAddressed: parseJsonField<string[]>(s.goalsAddressed, []),
    activitiesUsed: parseJsonField<string[]>(s.activitiesUsed, []),
    performanceData: parseJsonField<PerformanceDataItem[]>(s.performanceData, []),
    notes: s.notes,
    isDirectServices: s.isDirectServices === 1,
    indirectServicesNotes: s.indirectServicesNotes || undefined,
    groupSessionId: s.groupSessionId || undefined,
    missedSession: s.missedSession === 1,
    selectedSubjectiveStatements: parseJsonField<string[]>(s.selectedSubjectiveStatements, undefined),
    customSubjective: s.customSubjective || undefined,
    plan: s.plan || undefined,
    scheduledSessionId: s.scheduledSessionId || undefined,
    tsisGroup: s.tsisGroup === 1,
    cptCode: s.cptCode || undefined,
    icd10Codes: parseJsonField<string[]>(s.icd10Codes, []),
    aiGeneratedNote: s.aiGeneratedNote?.trim() || undefined,
    maLogged: (s.maLogged ?? 0) === 1,
  };
}

export const sessionsRouter = Router();

/**
 * @openapi
 * /api/sessions:
 *   get:
 *     tags: [Sessions]
 *     summary: Get all sessions
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: school
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of sessions
 */
sessionsRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, school, limit } = req.query;

  let query = 'SELECT * FROM sessions';
  const params: (string | number)[] = [];

  if (studentId && typeof studentId === 'string') {
    query += ' WHERE studentId = ? AND (missedSession = 0 OR missedSession IS NULL) ORDER BY date DESC';
    params.push(studentId);
  } else if (school && typeof school === 'string') {
    query = `
      SELECT s.* FROM sessions s
      INNER JOIN students st ON s.studentId = st.id
      WHERE st.school = ?
        AND (s.missedSession = 0 OR s.missedSession IS NULL)
      ORDER BY s.date DESC
    `;
    params.push(school);
  } else {
    query += ' WHERE (missedSession = 0 OR missedSession IS NULL) ORDER BY date DESC';
  }

  if (limit !== undefined) {
    const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : NaN;
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      const clamped = Math.min(parsedLimit, 1000);
      query += ' LIMIT ?';
      params.push(clamped);
    }
  }

  const sessions = db.prepare(query).all(...params) as SessionRow[];
  res.json(sessions.map(toSessionResponse));
}));

sessionsRouter.get('/log', asyncHandler(async (req, res) => {
  const { startDate, endDate, studentIds, school } = req.query;
  if (!school || typeof school !== 'string' || !school.trim()) {
    return res.status(400).json({ error: 'school is required' });
  }
  if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
    return res.status(400).json({ error: 'startDate and endDate are required (ISO string)' });
  }
  if (!studentIds || typeof studentIds !== 'string' || !studentIds.trim()) {
    return res.status(400).json({ error: 'studentIds is required (comma-separated ids or "all")' });
  }

  const schoolName = school.trim();
  const studentIdsRaw = studentIds.trim();

  // Resolve student IDs (either explicit list or "all" active students in school)
  let ids: string[] | null = null;
  if (studentIdsRaw.toLowerCase() !== 'all') {
    const parsed = studentIdsRaw
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    if (parsed.length === 0) {
      return res.status(400).json({ error: 'At least one student id is required' });
    }
    ids = parsed;
  } else {
    const all = db
      .prepare(
        `
        SELECT id FROM students
        WHERE school = ?
          AND status = 'active'
          AND (archived IS NULL OR archived = 0)
        `
      )
      .all(schoolName) as Array<{ id: string }>;
    ids = all.map((r) => r.id);
  }

  if (!ids || ids.length === 0) {
    return res.json([]);
  }

  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `
      SELECT
        s.*,
        st.name as studentName,
        st.domain as studentDomain,
        st.icd10Codes as studentIcd10Codes,
        st.icd10Descriptions as studentIcd10Descriptions,
        st.cptCodeIndividual as studentCptCodeIndividual,
        st.cptCodeGroup as studentCptCodeGroup
      FROM sessions s
      INNER JOIN students st ON st.id = s.studentId
      WHERE st.school = ?
        AND st.id IN (${placeholders})
        AND date(s.date) >= date(?)
        AND date(s.date) <= date(?)
        AND (s.missedSession = 0 OR s.missedSession IS NULL)
      ORDER BY s.date ASC, st.name ASC
    `
    )
    .all(schoolName, ...ids, startDate, endDate) as Array<
    SessionRow & {
      studentName: string;
      studentDomain: string | null;
      studentIcd10Codes: string | null;
      studentIcd10Descriptions: string | null;
      studentCptCodeIndividual: string | null;
      studentCptCodeGroup: string | null;
    }
  >;

  const uniqueGroupSessionIds = [
    ...new Set(
      rows
        .map((r) => r.groupSessionId)
        .filter((g): g is string => typeof g === 'string' && g.trim() !== '')
    ),
  ];

  const groupCounts = new Map<string, number>();
  if (uniqueGroupSessionIds.length > 0) {
    const gPh = uniqueGroupSessionIds.map(() => '?').join(',');
    const countRows = db
      .prepare(
        `SELECT groupSessionId AS gid, COUNT(*) AS cnt FROM sessions WHERE groupSessionId IN (${gPh}) AND (missedSession = 0 OR missedSession IS NULL) GROUP BY groupSessionId`
      )
      .all(...uniqueGroupSessionIds) as Array<{ gid: string; cnt: number }>;
    for (const { gid, cnt } of countRows) {
      groupCounts.set(gid, Number(cnt) || 0);
    }
  }

  const goalIds = new Set<string>();
  for (const row of rows) {
    const ga = parseJsonField<string[]>(row.goalsAddressed, []);
    const gt = parseJsonField<string[]>(row.goalsTargeted, []);
    const use = ga.length > 0 ? ga : gt;
    use.forEach((gid) => {
      const s = typeof gid === 'string' ? gid.trim() : String(gid);
      if (s) goalIds.add(s);
    });
    const perfRaw = parseJsonField<PerformanceDataItem[]>(row.performanceData, []);
    for (const p of perfRaw) {
      const gid = typeof p?.goalId === 'string' ? p.goalId.trim() : String(p?.goalId ?? '').trim();
      if (gid) goalIds.add(gid);
    }
  }

  const goalsMap = new Map<string, string>();
  const goalMetaByStudentAndId = new Map<string, { description: string; domain: string | null }>();
  if (goalIds.size > 0) {
    const gPlaceholders = [...goalIds].map(() => '?').join(',');
    const goals = db
      .prepare(`SELECT id, studentId, description, domain FROM goals WHERE id IN (${gPlaceholders})`)
      .all(...goalIds) as Array<{
      id: string;
      studentId: string;
      description: string;
      domain: string | null;
    }>;
    for (const g of goals) {
      goalsMap.set(g.id, g.description);
      goalMetaByStudentAndId.set(`${g.studentId}|${g.id}`, {
        description: g.description,
        domain: g.domain,
      });
    }
  }

  const out = rows.map((row) => {
    const goalsAddressedIds = parseJsonField<string[]>(row.goalsAddressed, []);
    const perfRaw = parseJsonField<PerformanceDataItem[]>(row.performanceData, []);

    const performanceSummary = perfRaw
      .map((p) => {
        const gid = typeof p?.goalId === 'string' ? p.goalId.trim() : String(p?.goalId ?? '').trim();
        if (!gid) return null;
        const correct = Math.max(0, Math.round(Number(p.correctTrials) || 0));
        const incorrect = Math.max(0, Math.round(Number(p.incorrectTrials) || 0));
        const totalTrials = correct + incorrect;
        const accuracy = Math.round(Number(p.accuracy) || 0);
        const cuingLevels = Array.isArray(p.cuingLevels)
          ? p.cuingLevels.map((c) => String(c).trim()).filter(Boolean)
          : [];
        const notes = typeof p.notes === 'string' ? p.notes : '';
        const goalDescription = resolveGoalDescriptionForLog(
          row.studentId,
          gid,
          goalMetaByStudentAndId,
          goalsMap
        );
        return {
          goalId: gid,
          goalDescription,
          accuracy,
          correctTrials: correct,
          incorrectTrials: incorrect,
          totalTrials,
          cuingLevels,
          notes,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    let goalsAddressedText = goalsAddressedIds
      .map((x) => (typeof x === 'string' ? x.trim() : String(x).trim()))
      .filter((x) => x.length > 0)
      .map((tr) => resolveGoalDescriptionForLog(row.studentId, tr, goalMetaByStudentAndId, goalsMap));

    if (goalsAddressedText.length === 0 && performanceSummary.length > 0) {
      goalsAddressedText = performanceSummary.map((p) => p.goalDescription);
    }

    const addressedForIcd = goalsAddressedIds
      .map((x) => (typeof x === 'string' ? x.trim() : String(x).trim()))
      .filter((x) => x.length > 0);
    const perfGoalIdsForIcd = performanceSummary.map((p) => p.goalId).filter(Boolean);
    const tokensForIcd = addressedForIcd.length > 0 ? addressedForIcd : perfGoalIdsForIcd;

    // True group size comes from DB-wide counts (see groupCounts), not rows in this response.
    const sharedCount = row.groupSessionId ? groupCounts.get(row.groupSessionId) ?? 0 : 0;
    const inferredGroup = sharedCount > 1;
    // Linked multi-student session: treat as group even when tsisGroup is 0.
    const isGroup = inferredGroup || row.tsisGroup === 1;
    const groupSize = row.groupSessionId ? groupCounts.get(row.groupSessionId) || 1 : 1;
    const isGroupOrMulti = isGroup || groupSize > 1;
    const cptIndividual = row.studentCptCodeIndividual || '92507';
    const cptGroup = row.studentCptCodeGroup || '92508';
    const cptResolved = isGroupOrMulti ? cptGroup : cptIndividual;

    let icd10Codes: string[];
    let icd10Descriptions: string[];
    if (tokensForIcd.length === 0) {
      icd10Codes = parseJsonField<string[]>(row.studentIcd10Codes, []);
      icd10Descriptions = parseJsonField<string[]>(row.studentIcd10Descriptions, []);
    } else {
      const domains: string[] = [];
      for (const tr of tokensForIcd) {
        const goalKey = `${row.studentId}|${tr}`;
        const meta = tr.length <= 220 ? goalMetaByStudentAndId.get(goalKey) : undefined;
        const domain = meta?.domain?.trim();
        if (domain) domains.push(domain);
      }
      if (domains.length === 0) {
        icd10Codes = parseJsonField<string[]>(row.studentIcd10Codes, []);
        icd10Descriptions = parseJsonField<string[]>(row.studentIcd10Descriptions, []);
      } else {
        const merged = mergeIcdFromDomains(domains);
        if (merged.codes.length === 0) {
          icd10Codes = parseJsonField<string[]>(row.studentIcd10Codes, []);
          icd10Descriptions = parseJsonField<string[]>(row.studentIcd10Descriptions, []);
        } else {
          icd10Codes = merged.codes;
          icd10Descriptions = merged.descriptions;
        }
      }
    }

    return {
      id: row.id,
      date: row.date,
      startTime: row.date,
      endTime: row.endTime || null,
      studentId: row.studentId,
      studentName: row.studentName,
      isGroup,
      groupSize: isGroupOrMulti ? groupSize : undefined,
      notes: row.notes || undefined,
      goalsAddressedText,
      performanceSummary,
      resolvedCptCode: cptResolved,
      icd10Codes,
      icd10Descriptions,
      domain: row.studentDomain || undefined,
      codesMapped: icd10Codes.length > 0,
      aiGeneratedNote: row.aiGeneratedNote?.trim() || undefined,
      maLogged: (row.maLogged ?? 0) === 1,
    };
  });

  res.json(out);
}));

sessionsRouter.post(
  '/generate-notes',
  validateBody(generateSessionNotesBodySchema),
  asyncHandler(async (req, res) => {
    const {
      apiKey: bodyApiKey,
      anthropicApiKey: bodyAnthropicKey,
      preferAnthropic,
      studentId,
      studentName,
      grade,
      sessions: bodySessions,
      providerName,
      providerCredentials,
      providerNpi,
    } = req.body as z.infer<typeof generateSessionNotesBodySchema>;
    const geminiApiKey = (bodyApiKey?.trim() || process.env.GEMINI_API_KEY?.trim()) ?? '';
    const anthropicApiKey = (bodyAnthropicKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim()) ?? '';
    if (!geminiApiKey && !anthropicApiKey) {
      return res.status(503).json({
        error:
          'No AI API key configured. Add a Gemini key and/or Anthropic key in Settings, or set GEMINI_API_KEY and/or ANTHROPIC_API_KEY in api/.env or the repo-root .env (see api/.env.example).',
      });
    }

    const student = db.prepare('SELECT id, dob FROM students WHERE id = ?').get(studentId) as
      | { id: string; dob: string | null }
      | undefined;
    if (!student) {
      return res.status(400).json({ error: 'Student not found' });
    }

    const notesSessions: typeof bodySessions = [];
    for (const s of bodySessions) {
      const row = db
        .prepare('SELECT id, missedSession FROM sessions WHERE id = ? AND studentId = ?')
        .get(s.id, studentId) as { id: string; missedSession: number | null } | undefined;
      if (!row) {
        return res.status(400).json({ error: `Session ${s.id} not found for this student` });
      }
      if (row.missedSession === 1) {
        logger.warn({ sessionId: s.id }, 'Skipping note generation for missed session');
        continue;
      }
      notesSessions.push(s);
    }
    if (notesSessions.length === 0) {
      return res.status(400).json({
        error: 'No sessions to generate notes for (missed sessions are excluded).',
      });
    }

    const studentDob = (student.dob || '').trim();
    const provider = {
      providerName: (providerName || '').trim(),
      credentials: (providerCredentials || '').trim(),
      npiNumber: (providerNpi || '').replace(/\D/g, '').slice(0, 10),
    };

    const augmentedRows = new Map<string, AugmentedSessionRow>();
    for (const s of notesSessions) {
      const r = db
        .prepare(
          `SELECT s.*, st.icd10Codes AS studentIcd10Codes, st.icd10Descriptions AS studentIcd10Descriptions
           FROM sessions s
           INNER JOIN students st ON st.id = s.studentId
           WHERE s.id = ? AND s.studentId = ?
             AND (s.missedSession = 0 OR s.missedSession IS NULL)`
        )
        .get(s.id, studentId) as AugmentedSessionRow | undefined;
      if (r) augmentedRows.set(s.id, r);
    }

    const allGoalIds: string[] = [];
    for (const s of notesSessions) {
      const r = augmentedRows.get(s.id);
      if (r) allGoalIds.push(...collectOrderedGoalIds(r));
    }
    const goalMetaMap = batchGoalMetaForStudent(studentId, allGoalIds);

    const enriched = notesSessions.map((s) => {
      const row = augmentedRows.get(s.id);
      const studentCodes = row ? parseJsonField<string[]>(row.studentIcd10Codes, []) : [];
      const studentDescs = row ? parseJsonField<string[]>(row.studentIcd10Descriptions, []) : [];

      const perfFromDb = row ? performanceSummaryForMa(row, studentId, goalMetaMap) : [];
      const performanceSummary = perfFromDb.length > 0 ? perfFromDb : s.performanceSummary;

      const addressedGoalsWithIcd = row
        ? buildAddressedGoalsWithIcd(row, studentId, goalMetaMap, studentCodes, studentDescs)
        : [];

      const primaryGid = row ? primaryGoalIdFromSessionRow(row) : null;
      const priorGid = addressedGoalsWithIcd[0]?.goalId ?? primaryGid;
      const goalMeta =
        goalDescriptionDomainFor(priorGid, studentId) ?? goalDescriptionDomainFor(primaryGid, studentId);
      const sessionDateForPrior = (row?.date || s.date) as string;
      const prior = row ? priorSessionAccuracyForGoal(studentId, s.id, sessionDateForPrior, priorGid) : null;

      const base: SessionNotePromptSession = {
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime || '',
        isGroup: s.isGroup,
        cptCode: s.cptCode,
        icd10Codes: s.icd10Codes,
        icd10Descriptions: s.icd10Descriptions,
        performanceSummary,
        goalsAddressedText: s.goalsAddressedText,
        sessionNotes: s.sessionNotes,
        domain: s.domain,
        addressedGoalsWithIcd,
        billingSessionContext: s.billingSessionContext,
        communicationModalityBilling: s.communicationModalityBilling,
        clinicalActivitiesBilling: s.clinicalActivitiesBilling,
      };
      return buildSoapNoteGenerationSession(studentName, grade, studentDob, base, goalMeta, prior);
    });

    let parsedNotes: Array<{ sessionId: string; note: string }>;
    let generatedBy: 'gemini' | 'anthropic';

    try {
      if (preferAnthropic) {
        if (!anthropicApiKey) {
          return res.status(400).json({
            error:
              'Claude-only mode requires an Anthropic API key. Add it in Settings or set ANTHROPIC_API_KEY on the server.',
          });
        }
        parsedNotes = await generateSessionNotesWithAnthropic(anthropicApiKey, enriched, provider);
        generatedBy = 'anthropic';
      } else if (geminiApiKey) {
        try {
          parsedNotes = await generateSessionNotesWithGemini(geminiApiKey, enriched, provider);
          generatedBy = 'gemini';
        } catch (geminiErr) {
          logger.warn({ err: geminiErr }, 'Gemini SOAP note generation failed; attempting Anthropic fallback');
          if (!anthropicApiKey) {
            const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
            if (msg === 'Failed to parse AI response') {
              return res.status(502).json({ error: 'Failed to parse AI response' });
            }
            return res.status(502).json({ error: msg || 'AI generation failed' });
          }
          parsedNotes = await generateSessionNotesWithAnthropic(anthropicApiKey, enriched, provider);
          generatedBy = 'anthropic';
        }
      } else {
        parsedNotes = await generateSessionNotesWithAnthropic(anthropicApiKey, enriched, provider);
        generatedBy = 'anthropic';
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'Failed to parse AI response') {
        return res.status(502).json({ error: 'Failed to parse AI response' });
      }
      return res.status(502).json({ error: msg || 'AI generation failed' });
    }

    const byId = new Map(parsedNotes.map((n) => [n.sessionId, n.note]));
    const notesOut: Array<{ sessionId: string; note: string }> = [];

    const updateStmt = db.prepare('UPDATE sessions SET aiGeneratedNote = ? WHERE id = ? AND studentId = ?');

    const tx = db.transaction(() => {
      for (const s of notesSessions) {
        let note = byId.get(s.id)?.trim();
        if (!note) {
          note = genericSessionNote(s.domain, {
            icd10Code: s.icd10Codes?.[0],
            cptCode: s.cptCode,
          });
        }
        updateStmt.run(note, s.id, studentId);
        notesOut.push({ sessionId: s.id, note });
      }
    });
    tx();

    res.json({ notes: notesOut, generatedBy });
  })
);

sessionsRouter.patch(
  '/:id/ma-logged',
  validateBody(patchSessionMaLoggedBodySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { maLogged } = req.body as z.infer<typeof patchSessionMaLoggedBodySchema>;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const result = db.prepare('UPDATE sessions SET maLogged = ? WHERE id = ?').run(maLogged ? 1 : 0, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({ success: true });
  })
);

/**
 * @openapi
 * /api/sessions/{id}:
 *   get:
 *     tags: [Sessions]
 *     summary: Get session by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session details
 *       404:
 *         description: Session not found
 */
sessionsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(toSessionResponse(session));
}));

/**
 * @openapi
 * /api/sessions:
 *   post:
 *     tags: [Sessions]
 *     summary: Create a new session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Session'
 *     responses:
 *       201:
 *         description: Session created
 *       400:
 *         description: Validation error
 */
sessionsRouter.post('/', validateBody(createSessionSchema), asyncHandler(async (req, res) => {
  const session = req.body;
  
  // Verify student exists
  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(session.studentId);
  if (!student) {
    return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
  }
  
  // Generate ID if not provided
  const sessionId = session.id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  db.prepare(`
    INSERT INTO sessions (id, studentId, date, endTime, goalsTargeted, goalsAddressed, activitiesUsed, 
                         performanceData, notes, isDirectServices, indirectServicesNotes, 
                         groupSessionId, missedSession, selectedSubjectiveStatements, customSubjective, plan,
                         scheduledSessionId, tsisGroup, cptCode, icd10Codes, aiGeneratedNote, maLogged)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    session.studentId,
    session.date,
    session.endTime || null,
    stringifyJsonField(session.goalsTargeted || []),
    stringifyJsonField(session.goalsAddressed ?? []),
    stringifyJsonField(session.activitiesUsed || []),
    stringifyJsonField(session.performanceData || []),
    session.notes || '',
    session.isDirectServices !== false ? 1 : 0,
    session.indirectServicesNotes || null,
    session.groupSessionId || null,
    session.missedSession ? 1 : 0,
    stringifyJsonField(session.selectedSubjectiveStatements),
    session.customSubjective || null,
    session.plan || null,
    session.scheduledSessionId || null,
    session.tsisGroup ? 1 : 0,
    session.cptCode || null,
    stringifyJsonField(session.icd10Codes || []),
    session.aiGeneratedNote?.trim() || null,
    session.maLogged ? 1 : 0
  );
  
  res.status(201).json({ id: sessionId, message: 'Session created' });
}));

/**
 * @openapi
 * /api/sessions/bulk:
 *   post:
 *     tags: [Sessions]
 *     summary: Create or update multiple sessions in a single transaction
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessions:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Session'
 *     responses:
 *       200:
 *         description: Bulk operation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 created:
 *                   type: number
 *                 updated:
 *                   type: number
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 */
sessionsRouter.post('/bulk', asyncHandler(async (req, res) => {
  const { sessions } = req.body;
  
  if (!Array.isArray(sessions)) {
    return res.status(400).json({ error: 'sessions must be an array' });
  }
  
  let created = 0;
  let updated = 0;
  const errors: Array<{ id?: string; error: string }> = [];
  
  // Use a transaction for atomicity
  const transaction = db.transaction(() => {
    for (const session of sessions) {
      try {
        // Verify student exists
        const student = db.prepare('SELECT id FROM students WHERE id = ?').get(session.studentId);
        if (!student) {
          errors.push({ id: session.id, error: `Student ${session.studentId} not found` });
          continue;
        }
        
        const existingById = db.prepare('SELECT * FROM sessions WHERE id = ?').get(session.id) as SessionRow | undefined;

        if (existingById) {
          const aiBulk =
            'aiGeneratedNote' in session && session.aiGeneratedNote !== undefined
              ? typeof session.aiGeneratedNote === 'string' && session.aiGeneratedNote.trim()
                ? session.aiGeneratedNote.trim()
                : null
              : (existingById.aiGeneratedNote ?? null);
          const maBulk =
            'maLogged' in session && session.maLogged !== undefined
              ? session.maLogged
                ? 1
                : 0
              : (existingById.maLogged ?? 0);
          // Update existing session
          db.prepare(`
            UPDATE sessions 
            SET studentId = ?, date = ?, endTime = ?, goalsTargeted = ?, goalsAddressed = ?, activitiesUsed = ?, 
                performanceData = ?, notes = ?, isDirectServices = ?, indirectServicesNotes = ?, 
                groupSessionId = ?, missedSession = ?, selectedSubjectiveStatements = ?, 
                customSubjective = ?, plan = ?, scheduledSessionId = ?, tsisGroup = ?, cptCode = ?, icd10Codes = ?, aiGeneratedNote = ?,
                maLogged = ?
            WHERE id = ?
          `).run(
            session.studentId,
            session.date,
            session.endTime || null,
            stringifyJsonField(session.goalsTargeted || []),
            stringifyJsonField(session.goalsAddressed ?? []),
            stringifyJsonField(session.activitiesUsed || []),
            stringifyJsonField(session.performanceData || []),
            session.notes || '',
            session.isDirectServices !== false ? 1 : 0,
            session.indirectServicesNotes || null,
            session.groupSessionId || null,
            session.missedSession ? 1 : 0,
            stringifyJsonField(session.selectedSubjectiveStatements),
            session.customSubjective || null,
            session.plan || null,
            session.scheduledSessionId || null,
            session.tsisGroup ? 1 : 0,
            session.cptCode || null,
            stringifyJsonField(session.icd10Codes || []),
            aiBulk,
            maBulk,
            session.id
          );
          updated++;
        } else {
          // Create new session
          const sessionId = session.id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          db.prepare(`
            INSERT INTO sessions (id, studentId, date, endTime, goalsTargeted, goalsAddressed, activitiesUsed, 
                                 performanceData, notes, isDirectServices, indirectServicesNotes, 
                                 groupSessionId, missedSession, selectedSubjectiveStatements, customSubjective, plan,
                                 scheduledSessionId, tsisGroup, cptCode, icd10Codes, aiGeneratedNote, maLogged)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            sessionId,
            session.studentId,
            session.date,
            session.endTime || null,
            stringifyJsonField(session.goalsTargeted || []),
            stringifyJsonField(session.goalsAddressed ?? []),
            stringifyJsonField(session.activitiesUsed || []),
            stringifyJsonField(session.performanceData || []),
            session.notes || '',
            session.isDirectServices !== false ? 1 : 0,
            session.indirectServicesNotes || null,
            session.groupSessionId || null,
            session.missedSession ? 1 : 0,
            stringifyJsonField(session.selectedSubjectiveStatements),
            session.customSubjective || null,
            session.plan || null,
            session.scheduledSessionId || null,
            session.tsisGroup ? 1 : 0,
            session.cptCode || null,
            stringifyJsonField(session.icd10Codes || []),
            session.aiGeneratedNote?.trim() || null,
            session.maLogged ? 1 : 0
          );
          created++;
        }
      } catch (error) {
        errors.push({ 
          id: session.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });
  
  transaction();
  
  res.json({ created, updated, errors });
}));

/**
 * @openapi
 * /api/sessions/{id}:
 *   put:
 *     tags: [Sessions]
 *     summary: Update a session
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Session'
 *     responses:
 *       200:
 *         description: Session updated
 *       404:
 *         description: Session not found
 */
sessionsRouter.put('/:id', validateBody(updateSessionSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // If studentId is being updated, verify the new student exists
  if (updates.studentId && updates.studentId !== existing.studentId) {
    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(updates.studentId);
    if (!student) {
      return res.status(400).json({ error: 'Student not found', details: [{ field: 'studentId', message: 'Student does not exist' }] });
    }
  }
  
  // Filter out undefined values from updates to prevent overwriting existing values with undefined
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([_, value]) => value !== undefined)
  );
  
  const session = { ...existing, ...cleanUpdates };
  
  // Handle boolean/number coercion for isDirectServices and missedSession
  const isDirectServices = typeof session.isDirectServices === 'boolean' 
    ? session.isDirectServices 
    : session.isDirectServices === 1;
  const missedSession = typeof session.missedSession === 'boolean'
    ? session.missedSession
    : session.missedSession === 1;

  const goalsTargetedArr = Array.isArray(session.goalsTargeted)
    ? session.goalsTargeted
    : parseJsonField<string[]>(session.goalsTargeted as unknown as string, []);
  const goalsAddressedArr = Array.isArray(session.goalsAddressed)
    ? session.goalsAddressed
    : parseJsonField<string[]>(session.goalsAddressed as unknown as string, []);
  const activitiesUsedArr = Array.isArray(session.activitiesUsed)
    ? session.activitiesUsed
    : parseJsonField<string[]>(session.activitiesUsed as unknown as string, []);
  const performanceDataArr = Array.isArray(session.performanceData)
    ? session.performanceData
    : parseJsonField<PerformanceDataItem[]>(session.performanceData as unknown as string, []);
  const icd10Arr = Array.isArray(session.icd10Codes)
    ? session.icd10Codes
    : parseJsonField<string[]>(session.icd10Codes as unknown as string, []);
  const tsisGroup =
    typeof session.tsisGroup === 'boolean' ? session.tsisGroup : session.tsisGroup === 1;

  const aiGeneratedNoteOut = Object.prototype.hasOwnProperty.call(cleanUpdates, 'aiGeneratedNote')
    ? typeof session.aiGeneratedNote === 'string' && session.aiGeneratedNote.trim()
      ? session.aiGeneratedNote.trim()
      : null
    : (existing.aiGeneratedNote ?? null);

  const maLoggedOut = Object.prototype.hasOwnProperty.call(cleanUpdates, 'maLogged')
    ? Boolean(session.maLogged)
    : (existing.maLogged ?? 0) === 1;

  db.prepare(`
    UPDATE sessions 
    SET studentId = ?, date = ?, endTime = ?, goalsTargeted = ?, goalsAddressed = ?, activitiesUsed = ?, 
        performanceData = ?, notes = ?, isDirectServices = ?, indirectServicesNotes = ?, 
        groupSessionId = ?, missedSession = ?, selectedSubjectiveStatements = ?, customSubjective = ?, plan = ?,
        scheduledSessionId = ?, tsisGroup = ?, cptCode = ?, icd10Codes = ?, aiGeneratedNote = ?, maLogged = ?
    WHERE id = ?
  `).run(
    session.studentId,
    session.date,
    session.endTime || null,
    stringifyJsonField(goalsTargetedArr),
    stringifyJsonField(goalsAddressedArr),
    stringifyJsonField(activitiesUsedArr),
    stringifyJsonField(performanceDataArr),
    session.notes || '',
    isDirectServices ? 1 : 0,
    session.indirectServicesNotes || null,
    session.groupSessionId || null,
    missedSession ? 1 : 0,
    stringifyJsonField(session.selectedSubjectiveStatements),
    session.customSubjective || null,
    session.plan || null,
    session.scheduledSessionId || null,
    tsisGroup ? 1 : 0,
    session.cptCode || null,
    stringifyJsonField(icd10Arr),
    aiGeneratedNoteOut,
    maLoggedOut ? 1 : 0,
    id
  );
  
  res.json({ message: 'Session updated' });
}));

/**
 * @openapi
 * /api/sessions/{id}:
 *   delete:
 *     tags: [Sessions]
 *     summary: Delete a session
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deleted
 *       404:
 *         description: Session not found
 */
sessionsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ message: 'Session deleted' });
}));
