// Script to kill any process using port 3001
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function killPort(port) {
  try {
    // Windows command to find process using the port
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    
    if (!stdout) {
      console.log(`Port ${port} is free`);
      return;
    }
    
    // Extract PID from netstat output
    const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
    const pids = new Set();
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(pid)) {
        pids.add(pid);
      }
    }
    
    if (pids.size === 0) {
      console.log(`Port ${port} is free`);
      return;
    }
    
    // Kill each process
    for (const pid of pids) {
      try {
        console.log(`Killing process ${pid} on port ${port}...`);
        await execAsync(`taskkill /F /PID ${pid}`);
        console.log(`✅ Killed process ${pid}`);
      } catch (error) {
        console.warn(`Could not kill process ${pid}: ${error.message}`);
      }
    }
    
    // Wait a moment for the port to be released
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify the port is actually free
    try {
      const { stdout: checkStdout } = await execAsync(`netstat -ano | findstr :${port} | findstr LISTENING`);
      if (checkStdout) {
        console.warn(`⚠️  Port ${port} may still be in use. Waiting longer...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (e) {
      // No processes found, port is free
    }
    
    console.log(`✅ Port ${port} should now be free`);
  } catch (error) {
    // If netstat fails, port might be free
    if (error.message.includes('findstr')) {
      console.log(`Port ${port} appears to be free`);
    } else {
      console.warn(`Error checking port ${port}: ${error.message}`);
    }
  }
}

// Always run - this script is meant to be called directly
const port = process.argv[2] ? parseInt(process.argv[2]) : 3001;
killPort(port).catch(err => {
  console.error('Error killing port:', err);
  process.exit(1);
});

export { killPort };

