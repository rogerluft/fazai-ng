import fetch from 'node-fetch';

const PORTS = [11434, 37552, 37559];
const ENDPOINT = '/api/tags'; // Endpoint leve para teste

async function checkPort(port: number) {
  const url = `http://127.0.0.1:${port}${ENDPOINT}`;
  console.log(`Testing ${url}...`);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (res.ok) {
      console.log(`✅ Porta ${port} ESTÁ RESPONDENDO!`);
      const data = await res.json();
      console.log(`   Modelos detectados: ${(data.models || []).length}`);
      return true;
    } else {
      console.log(`❌ Porta ${port} retornou status ${res.status}`);
    }
  } catch (e) {
    console.log(`❌ Porta ${port} inacessível: ${e.message}`);
  }
  return false;
}

async function main() {
  console.log("🔍 Sondando portas do Ollama...");
  for (const port of PORTS) {
    await checkPort(port);
  }
}

main();
