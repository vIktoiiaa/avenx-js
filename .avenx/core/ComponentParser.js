const fs = require('fs');
const path = require('path');

/**
 * ComponentParser handles the parsing of Avenx Template (.axt) and Avenx Design (.axd) files.
 * It extracts component state, methods, and templates, and coordinates with the StyleProcessor
 * to handle scoped styles and CSS variables.
 */
class ComponentParser {
    /**
     * Creates an instance of ComponentParser.
     * @param {StyleProcessor} styleProcessor - An instance of StyleProcessor to handle styles.
     */
    constructor(styleProcessor) {
        /** @type {StyleProcessor} */
        this.styleProcessor = styleProcessor;
    }

    /**
     * Parses a .component.js file and its corresponding .component.css file into a JavaScript class string.
     * @param {string} filePath - The absolute path to the .component.js file.
     * @returns {string} The generated JavaScript class for the component.
     */
    parse(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const fileName = path.basename(filePath, '.component.js');
        const name = fileName.charAt(0).toUpperCase() + fileName.slice(1);
        const desPath = filePath.replace('.component.js', '.component.css');
        let desBlocks = {};

        if (fs.existsSync(desPath)) {
            this.extractStylesAndVars(fs.readFileSync(desPath, 'utf-8'), desBlocks);
        }

        const state = this.extractState(content);
        const methods = this.extractMethods(content);
        let template = this.extractTemplate(content, desBlocks, name);

        const methodStrings = Object.entries(methods)
            .map(([k, v]) => `${k}: function() { ${v} }`).join(',\n        ');

        return `
class ${name} extends AvenxComponent {
    constructor(bridges) {
        super(${JSON.stringify(state)}, bridges, \`${template}\`, { ${methodStrings} });
    }
}`;
    }

    /**
     * Extracts global CSS variables and component-specific style blocks from .axd content.
     * @param {string} desContent - The content of the .axd file.
     * @param {Object} desBlocks - An object to store the extracted style blocks.
     * @private
     */
    extractStylesAndVars(desContent, desBlocks) {
        const globalMatch = desContent.match(/<@global>([\s\S]*?)<\/ @global>/i);
        if (globalMatch) {
            const defRegex = /@def\s+(\w+)\s+([^;]+);/g;
            let defMatch;
            while ((defMatch = defRegex.exec(globalMatch[1])) !== null) {
                this.styleProcessor.addVariable(defMatch[1], defMatch[2].trim());
            }
        }

        const cssBlockMatch = desContent.match(/<@css>([\s\S]*?)<\/ @css>/i);
        if (cssBlockMatch) {
            const inner = cssBlockMatch[1];
            let depth = 0, currentName = "", currentBody = "", inBlock = false;
            for (let i = 0; i < inner.length; i++) {
                const char = inner[i];
                if (char === '{' && depth === 0) {
                    currentName = inner.substring(0, i).trim().split('}').pop().trim();
                    inBlock = true; depth++;
                } else if (char === '{') {
                    depth++; currentBody += char;
                } else if (char === '}') {
                    depth--;
                    if (depth === 0) {
                        if (currentName) desBlocks[currentName] = currentBody.trim();
                        currentBody = ""; currentName = ""; inBlock = false;
                    } else { currentBody += char; }
                } else if (inBlock) { currentBody += char; }
            }
        }
    }

    /**
     * Extracts the initial state from the component's <state /> tag.
     * @param {string} content - The content of the .axt file.
     * @returns {Object} The extracted state object.
     * @private
     */
    extractState(content) {
        const state = {};
        const match = content.match(/<state\s+(.*?)\s*\/>/);
        if (match) {
            match[1].match(/(\w+)="([^"]*)"/g)?.forEach(pair => {
                const [k, v] = pair.split('=');
                const val = v.replace(/"/g, '');
                state[k] = isNaN(val) ? val : Number(val);
            });
        }
        return state;
    }

    /**
     * Extracts actions (methods) from the component's <action /> tags.
     * @param {string} content - The content of the .axt file.
     * @returns {Object<string, string>} A map of method names to their stringified bodies.
     * @private
     */
    extractMethods(content) {
        const methods = {};
        const actionRegex = /<action\s+name="(\w+)">([\s\S]*?)<\/action>/g;
        let m;
        while ((m = actionRegex.exec(content)) !== null) {
            methods[m[1]] = m[2].trim().replace(/\s+/g, ' ');
        }
        return methods;
    }

    /**
     * Extracts the HTML template, removes meta tags, and processes internal styles.
     * @param {string} content - The content of the .axt file.
     * @param {Object} desBlocks - The previously extracted design blocks.
     * @param {string} name - The name of the component for style hashing.
     * @returns {string} The cleaned and processed HTML template.
     * @private
     */
    extractTemplate(content, desBlocks, name) {
        let template = content
            .replace(/<state.*? \/>/g, '')
            .replace(/<action.*?>[\s\S]*?<\/action>/g, '')
            .trim();
        template = this.styleProcessor.process(template, desBlocks, name);
        return template.split('\n').filter(line => line.trim() !== '').join('\n');
    }
}

module.exports = ComponentParser;
