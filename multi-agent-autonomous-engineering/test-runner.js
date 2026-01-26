const { spawn } = require('child_process');

// Simple test runner to verify property tests work
const runTest = () => {
  const jest = spawn('npx', ['jest', 'tests/core/intent-router.property.test.ts', '--verbose', '--no-coverage'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  jest.on('close', (code) => {
    console.log(`Test process exited with code ${code}`);
    process.exit(code);
  });

  jest.on('error', (error) => {
    console.error('Failed to start test process:', error);
    process.exit(1);
  });
};

runTest();