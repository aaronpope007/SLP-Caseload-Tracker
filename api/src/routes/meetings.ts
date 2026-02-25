import { Router } from 'express';
import { db } from '../db';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { createMeetingSchema, updateMeetingSchema } from '../schemas';
import { parseJsonField, stringifyJsonField } from '../utils/jsonHelpers';

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

