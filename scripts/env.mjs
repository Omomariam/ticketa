import fs from 'node:fs';
export function loadEnv() {
  const env={...process.env};
  if(fs.existsSync('.env'))for(const line of fs.readFileSync('.env','utf8').split(/\r?\n/)){
    const match=line.match(/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*?)\s*$/);
    if(match)env[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');
  }
  return env;
}
