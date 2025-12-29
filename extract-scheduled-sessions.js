/**
 * Browser Console Script to Extract Scheduled Sessions from localStorage
 * 
 * Copy and paste this entire script into your browser's developer console
 * while on the SLP Caseload Tracker page to extract scheduled sessions
 */

(function() {
  // Check common localStorage key names for scheduled sessions
  const possibleKeys = [
    'slp_scheduled_sessions',
    'slp_scheduledSessions',
    'slp_scheduled-sessions',
  ];

  let scheduledSessions = null;
  let foundKey = null;

  // Try to find scheduled sessions in localStorage
  for (const key of possibleKeys) {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        scheduledSessions = JSON.parse(data);
        foundKey = key;
        break;
      }
    } catch (e) {
      // Continue to next key
    }
  }

  // If not found, list all localStorage keys that contain "schedule" or "session"
  if (!scheduledSessions) {
    console.log('🔍 Searching for scheduled sessions in localStorage...\n');
    const allKeys = Object.keys(localStorage);
    const relevantKeys = allKeys.filter(key => 
      key.toLowerCase().includes('schedule') || 
      (key.toLowerCase().includes('session') && !key.toLowerCase().includes('slp_sessions'))
    );
    
    if (relevantKeys.length > 0) {
      console.log('📋 Found potentially relevant keys:');
      relevantKeys.forEach(key => {
        try {
          const data = localStorage.getItem(key);
          const parsed = JSON.parse(data);
          console.log(`  - ${key}: ${Array.isArray(parsed) ? parsed.length + ' items' : 'object'}`);
        } catch (e) {
          console.log(`  - ${key}: (could not parse)`);
        }
      });
      console.log('\n💡 Try checking these keys manually in the Application/Storage tab.\n');
    } else {
      console.log('❌ No scheduled sessions found in localStorage.');
      console.log('💡 If you migrated to SQLite, the data may have already been cleared from localStorage.');
    }
    return;
  }

  console.log(`✅ Found scheduled sessions in key: "${foundKey}"`);
  console.log(`📊 Count: ${Array.isArray(scheduledSessions) ? scheduledSessions.length : 'N/A'}\n`);

  // Display the data
  console.log('📋 Scheduled Sessions Data:\n');
  console.log(JSON.stringify(scheduledSessions, null, 2));

  // Create downloadable file
  const blob = new Blob([JSON.stringify(scheduledSessions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scheduled-sessions-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('\n💾 File downloaded! Save this data and use it with the migration script.');
})();

