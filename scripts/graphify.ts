import * as fs from 'fs';
import * as path from 'path';

function generateGraph() {
    const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
    const outputPath = path.join(__dirname, '../../graphify.md');

    if (!fs.existsSync(schemaPath)) {
        console.error(`Prisma schema not found at ${schemaPath}`);
        return;
    }

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    const lines = schemaContent.split('\n');

    const models: string[] = [];
    const relations: { from: string; to: string; label: string; isOneToMany: boolean }[] = [];
    let currentModel: string | null = null;

    // First pass: collect all model names
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('model ')) {
            const parts = line.split(/\s+/);
            const modelName = parts[1];
            models.push(modelName);
        }
    }

    // Second pass: parse fields and relationships
    for (let line of lines) {
        line = line.trim();
        if (line.startsWith('model ')) {
            const parts = line.split(/\s+/);
            currentModel = parts[1];
            continue;
        }

        if (line.startsWith('}')) {
            currentModel = null;
            continue;
        }

        if (currentModel && line.length > 0 && !line.startsWith('//') && !line.startsWith('@@')) {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
                const fieldName = parts[0];
                let fieldType = parts[1];

                // Remove modifiers like ?, []
                const isArray = fieldType.endsWith('[]');
                const cleanType = fieldType.replace('?', '').replace('[]', '');

                if (models.includes(cleanType) && cleanType !== currentModel) {
                    // Check if this relation is already recorded from the other side
                    const exists = relations.some(
                        r => (r.from === currentModel && r.to === cleanType) || 
                             (r.from === cleanType && r.to === currentModel)
                    );

                    if (!exists) {
                        relations.push({
                            from: currentModel,
                            to: cleanType,
                            label: fieldName,
                            isOneToMany: isArray
                        });
                    }
                }
            }
        }
    }

    // Generate Mermaid Markdown
    let mermaid = '```mermaid\nerDiagram\n';
    
    // Add models
    for (const model of models) {
        mermaid += `    ${model} {\n    }\n`;
    }

    mermaid += '\n';

    // Add relationships
    for (const rel of relations) {
        // e.g. User ||--o{ InventoryMovement : "inventoryMovements"
        const relationSymbol = rel.isOneToMany ? '||--o{' : '||--||';
        mermaid += `    ${rel.from} ${relationSymbol} ${rel.to} : "${rel.label}"\n`;
    }

    mermaid += '```\n';

    const outputContent = `# Project Entity-Relationship Diagram\n\nGenerated automatically from \`schema.prisma\`.\n\n${mermaid}`;

    fs.writeFileSync(outputPath, outputContent, 'utf-8');
    console.log(`Graph successfully written to ${outputPath}`);
}

generateGraph();
