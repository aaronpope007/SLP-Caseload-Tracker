import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import {
  createMeetingSchema,
  generateMeetingMaNoteBodySchema,
  patchMeetingMaLoggedBodySchema,
  patchMeetingMaNoteBodySchema,
  updateMeetingSchema,
} from '../schemas';
import type { z } from 'zod';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';
import { buildEvalMaNotePrompt, generateEvalMaNote } from '../utils/evalMaNote';

const LEGACY_ASSESSMENT_CATEGORY = 'Assessment';

/** Title tokens → CPT for eval billing (session log). */
export function resolveCptFromTitle(title: string): { cptCode: string; billable: boolean; needsReview: boolean } {
  const t = title.toLowerCase();
  const hasGfta = /gfta|klpa/.test(t);
  const hasLanguage = /celf|ppvt|owls|language/.test(t);

  if (hasGfta && hasLanguage) return { cptCode: '92523', billable: true, needsReview: false };
  if (hasLanguage) return { cptCode: '92523', billable: true, needsReview: false };
  if (hasGfta) return { cptCode: '92522', billable: true, needsReview: false };
  return { cptCode: '', billable: true, needsReview: true };
}

function resolveEvalBilling(
  category: string | null | undefined,
  title: string
): { cptCode: string; billable: boolean; needsReview: boolean } {
  if (category === 'SLP Screener') {
    return { cptCode: '', billable: false, needsReview: false };
  }
  return resolveCptFromTitle(title);
}

function meetingDateOnly(isoOrDate: string): string {
  const s = (isoOrDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

// Database row types
interface MeetingRow {
  id: string;
  title: string;
  description: string | null;
  date: string;
  endTime: string | null;
  school: string;
  studentId: string | null;
  studentIds: string | null;
  category: string | null;
  activitySubtype: string | null;
  maLogged: number | null;
  maLoggedAt: string | null;
  maNote: string | null;
  dateCreated: string;
  dateUpdated: string;
}

function rowToMeeting(row: MeetingRow) {
  const studentIds = parseJsonField<string[]>(row.studentIds, []);
  const safeStudentIds = Array.isArray(studentIds) ? studentIds : (row.studentId ? [row.studentId] : []);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    date: row.date,
    endTime: row.endTime ?? undefined,
    school: row.school,
    studentIds: safeStudentIds,
    studentId: safeStudentIds[0] ?? undefined,
    category: row.category ?? undefined,
    activitySubtype: row.activitySubtype ?? undefined,
    dateCreated: row.dateCreated,
    dateUpdated: row.dateUpdated,
  };
}

export const meetingsRouter = Router();

function getMeetingStudentIdsFromRow(row: MeetingRow): string[] {
  const parsed = parseJsonField<string[]>(row.studentIds, []);
  const fromJson = Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.trim()) : [];
  if (fromJson.length > 0) return fromJson;
  if (row.studentId) return [row.studentId];
  return [];
}

// Evaluation / assessment billing log (must be registered before GET /:id)
meetingsRouter.get('/eval-log', asyncHandler(async (req, res) => {
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

  const idSet = new Set(ids);
  const rows = db
    .prepare(
      `
      SELECT *
      FROM meetings
      WHERE school = ?
        AND date(date) >= date(?)
        AND date(date) <= date(?)
        AND (
          category IN ('Initial Assessment', '3 Year Reassessment', 'SLP Screener')
          OR (category = ? AND activitySubtype = 'assessment')
        )
      ORDER BY date ASC
    `
    )
    .all(schoolName, startDate, endDate, LEGACY_ASSESSMENT_CATEGORY) as MeetingRow[];

  type Out = {
    id: string;
    date: string;
    startTime: string | null;
    endTime: string | null;
    title: string;
    type: string;
    studentId: string;
    studentName: string;
    cptCode: string;
    billable: boolean;
    needsReview: boolean;
    maLogged: boolean;
    maLoggedAt: string | null;
    maNote: string | null;
  };

  const out: Out[] = [];
  const studentNameCache = new Map<string, string>();

  const loadName = (studentId: string): string => {
    if (studentNameCache.has(studentId)) return studentNameCache.get(studentId)!;
    const st = db
      .prepare('SELECT name FROM students WHERE id = ? AND school = ?')
      .get(studentId, schoolName) as { name: string } | undefined;
    const name = st?.name || 'Unknown student';
    studentNameCache.set(studentId, name);
    return name;
  };

  for (const row of rows) {
    const mStudentIds = getMeetingStudentIdsFromRow(row);
    const linked = [...new Set(mStudentIds.filter((sid) => idSet.has(sid)))];
    if (linked.length === 0) continue;

    const cat = row.category || '';
    const dateOnly = meetingDateOnly(row.date);
    const startTimeVal = row.date?.trim() ? row.date : null;

    for (const studentId of linked) {
      const billing = resolveEvalBilling(cat, row.title);
      out.push({
        id: row.id,
        date: dateOnly,
        startTime: startTimeVal,
        endTime: row.endTime?.trim() ? row.endTime : null,
        title: row.title,
        type: cat,
        studentId,
        studentName: loadName(studentId),
        cptCode: billing.cptCode,
        billable: billing.billable,
        needsReview: billing.needsReview,
        maLogged: (row.maLogged ?? 0) === 1,
        maLoggedAt: row.maLoggedAt?.trim() ? row.maLoggedAt : null,
        maNote: row.maNote?.trim() ? row.maNote : null,
      });
    }
  }

  out.sort((a, b) => {
    const da = a.date.localeCompare(b.date);
    if (da !== 0) return da;
    const ns = a.studentName.localeCompare(b.studentName, undefined, { sensitivity: 'base' });
    if (ns !== 0) return ns;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });

  res.json(out);
}));

meetingsRouter.patch(
  '/:id/ma-logged',
  validateBody(patchMeetingMaLoggedBodySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { maLogged } = req.body as z.infer<typeof patchMeetingMaLoggedBodySchema>;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid meeting ID' });
    }
    const result = maLogged
      ? db.prepare(`UPDATE meetings SET maLogged = 1, maLoggedAt = datetime('now') WHERE id = ?`).run(id)
      : db.prepare(`UPDATE meetings SET maLogged = 0, maLoggedAt = NULL WHERE id = ?`).run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    const row = db
      .prepare('SELECT id, maLogged, maLoggedAt FROM meetings WHERE id = ?')
      .get(id) as { id: string; maLogged: number | null; maLoggedAt: string | null } | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json({
      id: row.id,
      maLogged: (row.maLogged ?? 0) === 1,
      maLoggedAt: row.maLoggedAt?.trim() ? row.maLoggedAt : null,
    });
  })
);

meetingsRouter.patch(
  '/:id/ma-note',
  validateBody(patchMeetingMaNoteBodySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { maNote } = req.body as z.infer<typeof patchMeetingMaNoteBodySchema>;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid meeting ID' });
    }
    const trimmed = maNote.trim();
    const result = db.prepare('UPDATE meetings SET maNote = ? WHERE id = ?').run(trimmed || null, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json({ id, maNote: trimmed || null });
  })
);

meetingsRouter.post(
  '/:id/generate-ma-note',
  validateBody(generateMeetingMaNoteBodySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = req.body as z.infer<typeof generateMeetingMaNoteBodySchema>;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid meeting ID' });
    }

    const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const linkedStudentIds = getMeetingStudentIdsFromRow(row);
    const primaryStudentId = linkedStudentIds[0];
    if (!primaryStudentId) {
      return res.status(400).json({ error: 'Meeting has no linked student' });
    }

    const student = db
      .prepare('SELECT name FROM students WHERE id = ?')
      .get(primaryStudentId) as { name: string } | undefined;
    const studentName = student?.name?.trim() || 'Student';

    const billing = resolveEvalBilling(row.category, row.title);
    const prompt = buildEvalMaNotePrompt({
      studentName,
      date: meetingDateOnly(row.date),
      title: row.title,
      cptCode: billing.cptCode,
      category: row.category || 'Evaluation',
      additionalContext: body.additionalContext,
    });

    const geminiKey = (body.geminiKey?.trim() || process.env.GEMINI_API_KEY?.trim()) ?? '';
    const anthropicKey = (body.anthropicKey?.trim() || process.env.ANTHROPIC_API_KEY?.trim()) ?? '';

    if (!geminiKey && !anthropicKey) {
      return res.status(503).json({
        error:
          'No AI API key configured. Add a Gemini key and/or Anthropic key in Settings, or set GEMINI_API_KEY and/or ANTHROPIC_API_KEY in api/.env or the repo-root .env (see api/.env.example).',
      });
    }

    let generatedNote: string;
    try {
      generatedNote = await generateEvalMaNote(prompt, geminiKey, anthropicKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(502).json({ error: msg || 'AI generation failed' });
    }

    const trimmed = generatedNote.trim();
    const updateResult = db.prepare('UPDATE meetings SET maNote = ? WHERE id = ?').run(trimmed, id);
    if (updateResult.changes === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ id, maNote: trimmed });
  })
);

// Get all meetings (filterable by studentId, school, category, date range)
meetingsRouter.get('/', asyncHandler(async (req, res) => {
  const { studentId, school, category, startDate, endDate } = req.query;
  
  let query = 'SELECT * FROM meetings';
  const params: string[] = [];
  const conditions: string[] = [];

  // Don't filter by studentId in SQL so we can support studentIds array (filter in JS)
  if (school && typeof school === 'string') {
    conditions.push('school = ?');
    params.push(school);
  }

  if (category && typeof category === 'string') {
    conditions.push('category = ?');
    params.push(category);
  }

  // Filter by date part so yyyy-MM-dd includes all meetings on that day (date column is ISO datetime)
  if (startDate && typeof startDate === 'string') {
    conditions.push("date(date) >= date(?)");
    params.push(startDate);
  }

  if (endDate && typeof endDate === 'string') {
    conditions.push("date(date) <= date(?)");
    params.push(endDate);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY date ASC';

  const rows = db.prepare(query).all(...params) as MeetingRow[];
  let meetings = rows.map(rowToMeeting);

  if (studentId && typeof studentId === 'string') {
    meetings = meetings.filter(m => m.studentIds?.includes(studentId) || m.studentId === studentId);
  }

  res.json(meetings);
}));

// Get meeting by ID
meetingsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid meeting ID' });
  }
  
  const row = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined;
  
  if (!row) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  res.json(rowToMeeting(row));
}));

// Create meeting - with validation
meetingsRouter.post('/', validateBody(createMeetingSchema), asyncHandler(async (req, res) => {
  const meeting = req.body;
  const studentIds = Array.isArray(meeting.studentIds) && meeting.studentIds.length > 0
    ? meeting.studentIds
    : (meeting.studentId ? [meeting.studentId] : []);
  const studentId = studentIds[0] || null;

  // Generate ID if not provided
  const meetingId = meeting.id || `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO meetings (
      id, title, description, date, endTime, school, studentId, studentIds,
      category, activitySubtype, dateCreated, dateUpdated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    meetingId,
    meeting.title,
    meeting.description || null,
    meeting.date,
    meeting.endTime || null,
    meeting.school,
    studentId,
    stringifyJsonField(studentIds),
    meeting.category || null,
    meeting.activitySubtype || null,
    now,
    now
  );

  res.status(201).json({ id: meetingId, message: 'Meeting created' });
}));

// Update meeting - with validation
meetingsRouter.put('/:id', validateBody(updateMeetingSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid meeting ID' });
  }

  const existing = db.prepare('SELECT * FROM meetings WHERE id = ?').get(id) as MeetingRow | undefined;
  if (!existing) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  const existingStudentIds = parseJsonField<string[]>(existing.studentIds, []);
  const safeExisting = Array.isArray(existingStudentIds) ? existingStudentIds : (existing.studentId ? [existing.studentId] : []);
  const studentIds = updates.studentIds !== undefined
    ? (Array.isArray(updates.studentIds) ? updates.studentIds : safeExisting)
    : (updates.studentId !== undefined ? (updates.studentId ? [updates.studentId] : []) : safeExisting);
  const studentId = studentIds[0] || null;

  const meeting = {
    ...existing,
    ...updates,
    dateUpdated: new Date().toISOString(),
    studentId,
    studentIds: stringifyJsonField(studentIds),
  };

  db.prepare(`
    UPDATE meetings 
    SET title = ?, description = ?, date = ?, endTime = ?, school = ?,
        studentId = ?, studentIds = ?, category = ?, activitySubtype = ?, dateUpdated = ?
    WHERE id = ?
  `).run(
    meeting.title,
    meeting.description || null,
    meeting.date,
    meeting.endTime || null,
    meeting.school,
    meeting.studentId,
    meeting.studentIds,
    meeting.category || null,
    meeting.activitySubtype || null,
    meeting.dateUpdated,
    id
  );

  res.json({ message: 'Meeting updated' });
}));

// Delete meeting
meetingsRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid meeting ID' });
  }
  
  const result = db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Meeting not found' });
  }
  
  res.json({ message: 'Meeting deleted' });
}));

