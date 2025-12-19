/**
 * Browser Console Script to Export localStorage Data
 * 
 * Copy and paste this entire script into your browser's developer console
 * while on the SLP Caseload Tracker page, then copy the output and save to backup.json
 */

(function() {
  const STORAGE_KEYS = {
    STUDENTS: 'slp_students',
    GOALS: 'slp_goals',
    SESSIONS: 'slp_sessions',
    ACTIVITIES: 'slp_activities',
    EVALUATIONS: 'slp_evaluations',
    SCHOOLS: 'slp_schools',
    LUNCHES: 'slp_lunches',
  };

  function getData(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`Error parsing ${key}:`, e);
      return [];
    }
  }

  const exportData = {
    students: getData(STORAGE_KEYS.STUDENTS),
    goals: getData(STORAGE_KEYS.GOALS),
    sessions: getData(STORAGE_KEYS.SESSIONS),
    activities: getData(STORAGE_KEYS.ACTIVITIES),
    evaluations: getData(STORAGE_KEYS.EVALUATIONS),
    schools: getData(STORAGE_KEYS.SCHOOLS),
    lunches: getData(STORAGE_KEYS.LUNCHES),
    exportDate: new Date().toISOString(),
  };

  // Count items
  console.log('📊 Data Summary:');
  console.log(`  Students: ${exportData.students.length}`);
  console.log(`  Goals: ${exportData.goals.length}`);
  console.log(`  Sessions: ${exportData.sessions.length}`);
  console.log(`  Activities: ${exportData.activities.length}`);
  console.log(`  Evaluations: ${exportData.evaluations.length}`);
  console.log(`  Schools: ${exportData.schools.length}`);
  console.log(`  Lunches: ${exportData.lunches.length}`);
  console.log('\n📋 JSON Export (copy this and save to backup.json):\n');
  console.log(JSON.stringify(exportData, null, 2));
  
  // Also create a downloadable file
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `slp-caseload-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log('\n✅ Download started! Check your downloads folder.');
  
  return exportData;
})();

