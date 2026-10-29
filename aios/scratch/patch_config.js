const fs = require('fs');
const file = 'apps/api-python/src/config.py';
let c = fs.readFileSync(file, 'utf8');
const targetCRLF = '@lru_cache\r\ndef get_settings():\r\n    return Settings()';
const targetLF = '@lru_cache\ndef get_settings():\n    return Settings()';

const replCRLF = '@lru_cache\r\ndef get_settings():\r\n    s = Settings()\r\n    if s.DATABASE_URL and not os.environ.get("DATABASE_URL"):\r\n        os.environ["DATABASE_URL"] = s.DATABASE_URL\r\n    return s';
const replLF = '@lru_cache\ndef get_settings():\n    s = Settings()\n    if s.DATABASE_URL and not os.environ.get("DATABASE_URL"):\n        os.environ["DATABASE_URL"] = s.DATABASE_URL\n    return s';

if (c.includes(targetCRLF)) {
  fs.writeFileSync(file, c.replace(targetCRLF, replCRLF), 'utf8');
  console.log('REPLACED_CRLF_OK');
} else if (c.includes(targetLF)) {
  fs.writeFileSync(file, c.replace(targetLF, replLF), 'utf8');
  console.log('REPLACED_LF_OK');
} else {
  console.log('TARGET_NOT_FOUND');
}

