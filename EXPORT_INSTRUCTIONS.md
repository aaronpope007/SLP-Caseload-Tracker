# How to Export Data from Browser

## Method 1: Automatic Download (Easiest)

1. **Open your SLP Caseload Tracker** in your browser
2. **Open Developer Tools**:
   - Press `F12`, or
   - Right-click → "Inspect", or  
   - `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
3. **Click the "Console" tab**
4. **Copy and paste this entire code block** into the console:

```javascript
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
```

5. **Press Enter**
6. **Check your Downloads folder** - a file named `slp-caseload-backup-YYYY-MM-DD.json` should have downloaded automatically!

---

## Method 2: Manual Copy-Paste

If the automatic download doesn't work, you can copy the data manually:

1. **Open Developer Tools** (F12)
2. **Go to Console tab**
3. **Run this simpler version**:

```javascript
const exportData = () => {
  const data = {
    students: JSON.parse(localStorage.getItem('slp_students') || '[]'),
    goals: JSON.parse(localStorage.getItem('slp_goals') || '[]'),
    sessions: JSON.parse(localStorage.getItem('slp_sessions') || '[]'),
    activities: JSON.parse(localStorage.getItem('slp_activities') || '[]'),
    evaluations: JSON.parse(localStorage.getItem('slp_evaluations') || '[]'),
    schools: JSON.parse(localStorage.getItem('slp_schools') || '[]'),
    lunches: JSON.parse(localStorage.getItem('slp_lunches') || '[]'),
    exportDate: new Date().toISOString(),
  };
  console.log(JSON.stringify(data, null, 2));
  return data;
};
exportData();
```

4. **Copy the JSON output** from the console (it will be a large block of text)
5. **Create a new file** called `backup.json` in your `api` folder
6. **Paste the copied JSON** into that file
7. **Save the file**

---

## Method 3: Using Application Tab (Visual)

1. **Open Developer Tools** (F12)
2. **Click the "Application" tab** (Chrome) or "Storage" tab (Firefox)
3. **In the left sidebar**, expand "Local Storage"
4. **Click on your site's URL** (e.g., `http://localhost:5173`)
5. **You'll see all your keys**:
   - `slp_students`
   - `slp_goals`
   - `slp_sessions`
   - etc.
6. **For each key**, right-click → "Copy value"
7. **Manually combine them** into a JSON object like:
```json
{
  "students": [paste students value here],
  "goals": [paste goals value here],
  ...
}
```

---

## What to Do Next

Once you have your `backup.json` file:

1. **Move it to the `api` folder** (or note the full path)
2. **Run the migration**:
   ```bash
   cd api
   npm run migrate -- backup.json
   ```

That's it! Your data will be safely imported into SQLite.

