const fs = require('fs');
try {
  fs.unlinkSync('.git/index.lock');
  console.log('Removed lock file');
} catch (e) {
  console.log('Lock file did not exist or could not be removed');
}
