import { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Upload as UploadIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { logError, logDebug } from '../utils/logger';
import { formatPhoneForDisplay } from '../utils/formatters';
import { useSchool } from '../context/SchoolContext';
import type { Teacher, CaseManager } from '../types';

interface ExtractedPerson {
  name: string;
  email?: string;
  phoneNumber?: string;
  grade?: string;
  role?: string;
  type: 'teacher' | 'case-manager' | 'staff';
}

interface ParsedDocument {
  schoolName?: string;
  people: ExtractedPerson[];
}

interface ImportTeachersDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (teachers: Teacher[], caseManagers: CaseManager[]) => Promise<void>;
}

export const ImportTeachersDialog = ({ open, onClose, onImport }: ImportTeachersDialogProps) => {
  const { availableSchools, selectedSchool } = useSchool();
  const [file, setFile] = useState<File | null>(null);
  const [selectedSchoolName, setSelectedSchoolName] = useState(selectedSchool || '');
  const [parsedData, setParsedData] = useState<ParsedDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedPeople, setEditedPeople] = useState<ExtractedPerson[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!validTypes.includes(selectedFile.type)) {
        setError('Invalid file type. Please select a PDF or Word document.');
        return;
      }
      setFile(selectedFile);
      setError('');
      setParsedData(null);
      setEditedPeople([]);
      setSelectedPeople(new Set());
    }
  };

  const handleParse = async () => {
    logDebug('handleParse called', { file: file?.name, school: selectedSchoolName });
    
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!selectedSchoolName) {
      setError('Please select a school');
      return;
    }

    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setError('Please set your Gemini API key in Settings');
      return;
    }

    logDebug('All checks passed, starting parse...');
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('apiKey', apiKey);
      formData.append('schoolName', selectedSchoolName);

      // Use API_URL from environment or default
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const url = `${API_URL}/document-parser/parse`;
      
      logDebug('Uploading document', { url, fileName: file.name, fileType: file.type, fileSize: file.size });
      
      // Create an AbortController for timeout
      // Use longer timeout for large files (5 minutes = 300000ms)
      // Image-based PDFs can take a while with Gemini
      const timeoutDuration = file.size > 1000000 ? 300000 : 120000; // 5 min for large files, 2 min for smaller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        logDebug(`Timeout triggered after ${timeoutDuration / 1000} seconds - aborting request`);
        controller.abort();
      }, timeoutDuration);
      
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          // Don't set Content-Type header - let browser set it with boundary for FormData
        });
        clearTimeout(timeoutId);
      } catch (fetchError) {
        clearTimeout(timeoutId);
        logError('Fetch error caught', fetchError);
        
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutDuration / 1000} seconds. Large image-based PDFs can take several minutes to process. The server may still be processing - check the server logs.`);
          }
          if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
            logError('Network error detected - checking server connection...');
            // Try to ping the health endpoint to see if server is reachable
            try {
              const healthCheck = await fetch(`${API_URL.replace('/api', '')}/health`);
              logDebug('Health check result', { status: healthCheck.status });
              if (healthCheck.ok) {
                throw new Error('Server is running but document parser endpoint is not reachable. Check server logs.');
              }
            } catch (healthError) {
              logError('Health check also failed', healthError);
            }
            throw new Error('Cannot connect to server. Make sure the API server is running on http://localhost:3001');
          }
          throw fetchError;
        }
        throw new Error('Network error occurred');
      }

      logDebug('Response received', { status: response.status });

      if (!response.ok) {
        let errorMessage = 'Failed to parse document';
        try {
          const errorData = await response.json();
          logError('Error response from document parser', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          logError('Failed to parse error response', parseError);
          const text = await response.text();
          logError('Error response text', text);
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data: ParsedDocument = await response.json();
      logDebug('Parsed data received', { peopleCount: data.people?.length });
      
      // Initialize all people as selected
      const allSelected = new Set(data.people.map((_, index) => index));
      setSelectedPeople(allSelected);
      setParsedData(data);
      setEditedPeople([...data.people]);
    } catch (err) {
      logError('Error in handleParse', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse document';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleSaveEdit = (index: number, updated: ExtractedPerson) => {
    const newEdited = [...editedPeople];
    newEdited[index] = updated;
    setEditedPeople(newEdited);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleToggleSelect = (index: number) => {
    const newSelected = new Set(selectedPeople);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedPeople(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPeople.size === editedPeople.length) {
      setSelectedPeople(new Set());
    } else {
      setSelectedPeople(new Set(editedPeople.map((_, index) => index)));
    }
  };

  const handleImport = async () => {
    if (!parsedData || editedPeople.length === 0) return;

    const peopleToImport = editedPeople.filter((_, index) => selectedPeople.has(index));
    
    if (peopleToImport.length === 0) {
      setError('Please select at least one person to import');
      return;
    }

    try {
      const teachers: Teacher[] = [];
      const caseManagers: CaseManager[] = [];

      for (const person of peopleToImport) {
        const baseData = {
          name: person.name.trim(),
          school: selectedSchoolName,
          phoneNumber: person.phoneNumber?.replace(/\D/g, '') || undefined,
          emailAddress: person.email?.trim() || undefined,
          dateCreated: new Date().toISOString(),
        };

        if (person.type === 'case-manager' || person.type === 'staff') {
          caseManagers.push({
            id: `case-manager-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...baseData,
            role: person.role || person.type === 'case-manager' ? 'Case Manager' : 'Staff',
          });
        } else {
          teachers.push({
            id: `teacher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...baseData,
            grade: person.grade || '',
          });
        }
      }

      await onImport(teachers, caseManagers);
      handleClose();
    } catch (err) {
      logError('Failed to import teachers', err);
      setError('Failed to import teachers. Please try again.');
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setError('');
    setLoading(false);
    setEditingIndex(null);
    setEditedPeople([]);
    setSelectedPeople(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Import Teachers & Staff from Document</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
          {!parsedData ? (
            <>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Upload a PDF or Word document containing teacher names, emails, and phone numbers.
                  The AI will automatically extract the information.
                </Typography>
              </Box>

              <TextField
                select
                label="School"
                fullWidth
                value={selectedSchoolName}
                onChange={(e) => setSelectedSchoolName(e.target.value)}
                SelectProps={{
                  native: true,
                }}
                required
              >
                <option value="">Select a school</option>
                {availableSchools.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </TextField>

              <Box>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadIcon />}
                  fullWidth
                  sx={{ py: 2 }}
                >
                  {file ? file.name : 'Select PDF or Word Document'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                </Button>
              </Box>

              {file && (
                <Button
                  variant="contained"
                  onClick={handleParse}
                  disabled={loading || !selectedSchoolName}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  {loading ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Parsing Document...
                    </>
                  ) : (
                    'Parse Document'
                  )}
                </Button>
              )}
            </>
          ) : (
            <>
              {parsedData.schoolName && (
                <Alert severity="info">
                  Detected school name: <strong>{parsedData.schoolName}</strong>
                </Alert>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Found {editedPeople.length} {editedPeople.length === 1 ? 'person' : 'people'}
                </Typography>
                <Button size="small" onClick={handleSelectAll}>
                  {selectedPeople.size === editedPeople.length ? 'Deselect All' : 'Select All'}
                </Button>
              </Box>

              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" width={50}>
                        <Checkbox
                          checked={selectedPeople.size === editedPeople.length && editedPeople.length > 0}
                          indeterminate={selectedPeople.size > 0 && selectedPeople.size < editedPeople.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Grade/Role</TableCell>
                      <TableCell width={80}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {editedPeople.map((person, index) => {
                      const isEditing = editingIndex === index;
                      const isSelected = selectedPeople.has(index);

                      if (isEditing) {
                        return (
                          <TableRow key={index}>
                            <TableCell padding="checkbox">
                              <Checkbox checked={isSelected} onChange={() => handleToggleSelect(index)} />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={person.name}
                                onChange={(e) => {
                                  const updated = { ...person, name: e.target.value };
                                  setEditedPeople(editedPeople.map((p, i) => (i === index ? updated : p)));
                                }}
                                fullWidth
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                select
                                value={person.type}
                                onChange={(e) => {
                                  const updated = { ...person, type: e.target.value as 'teacher' | 'case-manager' | 'staff' };
                                  setEditedPeople(editedPeople.map((p, i) => (i === index ? updated : p)));
                                }}
                                SelectProps={{ native: true }}
                              >
                                <option value="teacher">Teacher</option>
                                <option value="case-manager">Case Manager</option>
                                <option value="staff">Staff</option>
                              </TextField>
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                type="email"
                                value={person.email || ''}
                                onChange={(e) => {
                                  const updated = { ...person, email: e.target.value || undefined };
                                  setEditedPeople(editedPeople.map((p, i) => (i === index ? updated : p)));
                                }}
                                fullWidth
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={person.phoneNumber || ''}
                                onChange={(e) => {
                                  const updated = { ...person, phoneNumber: e.target.value || undefined };
                                  setEditedPeople(editedPeople.map((p, i) => (i === index ? updated : p)));
                                }}
                                fullWidth
                              />
                            </TableCell>
                            <TableCell>
                              <TextField
                                size="small"
                                value={person.grade || person.role || ''}
                                onChange={(e) => {
                                  const updated = {
                                    ...person,
                                    grade: person.type === 'teacher' ? e.target.value : undefined,
                                    role: person.type !== 'teacher' ? e.target.value : undefined,
                                  };
                                  setEditedPeople(editedPeople.map((p, i) => (i === index ? updated : p)));
                                }}
                                fullWidth
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleSaveEdit(index, editedPeople[index])}
                              >
                                <CheckIcon />
                              </IconButton>
                              <IconButton size="small" onClick={handleCancelEdit}>
                                <CloseIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return (
                        <TableRow key={index} selected={isSelected}>
                          <TableCell padding="checkbox">
                            <Checkbox checked={isSelected} onChange={() => handleToggleSelect(index)} />
                          </TableCell>
                          <TableCell>{person.name}</TableCell>
                          <TableCell>
                            <Chip
                              label={person.type === 'teacher' ? 'Teacher' : person.type === 'case-manager' ? 'Case Manager' : 'Staff'}
                              size="small"
                              color={person.type === 'teacher' ? 'primary' : person.type === 'case-manager' ? 'secondary' : 'default'}
                            />
                          </TableCell>
                          <TableCell>{person.email || '-'}</TableCell>
                          <TableCell>{formatPhoneForDisplay(person.phoneNumber) || '-'}</TableCell>
                          <TableCell>{person.grade || person.role || '-'}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => handleEdit(index)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {parsedData && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={selectedPeople.size === 0}
          >
            Import {selectedPeople.size} {selectedPeople.size === 1 ? 'Person' : 'People'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

