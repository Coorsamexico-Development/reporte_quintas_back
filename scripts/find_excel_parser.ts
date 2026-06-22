import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

async function main() {
    const transcriptPath = 'C:\\Users\\rober\\.gemini\\antigravity\\brain\\8f18ff77-4c53-438d-828b-f4915fdca726\\.system_generated\\logs\\transcript.jsonl';
    
    if (!fs.existsSync(transcriptPath)) {
        console.error('No se encontró el archivo de transcripción.');
        return;
    }

    const fileStream = fs.createReadStream(transcriptPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    console.log('Buscando referencias a archivos Excel en la transcripción...');

    for await (const line of rl) {
        if (line.includes('.xlsx') || line.includes('xlsx') || line.includes('python') || line.includes('Excel') || line.includes('xlsx-to-json') || line.includes('parse')) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.tool_calls) {
                    for (const tc of parsed.tool_calls) {
                        if (tc.name === 'run_command' || tc.name === 'write_to_file') {
                            console.log(`\n--- HERRAMIENTA: ${tc.name} ---`);
                            console.log(JSON.stringify(tc.arguments, null, 2));
                        }
                    }
                }
                if (parsed.content && (parsed.content.includes('xlsx') || parsed.content.includes('excel') || parsed.content.includes('python'))) {
                    console.log(`\n--- CONTENIDO (truncado): ---`);
                    console.log(parsed.content.substring(0, 500));
                }
            } catch (err) {
                // Ignorar errores de parseo
            }
        }
    }
}

main().catch(console.error);
