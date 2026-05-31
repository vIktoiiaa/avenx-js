const fs = require('fs');
const path = require('path');
const StyleProcessor = require('./core/StyleProcessor');
const ComponentParser = require('./core/ComponentParser');

/**
 * AvenxCompiler is the main orchestrator for the Avenx-JS build process.
 * it coordinates the parsing of components, processing of styles, and the
 * final bundling of the application into a single executable JavaScript file
 * and a corresponding CSS file.
 */
class AvenxCompiler {
    /**
     * Creates an instance of AvenxCompiler and initializes its sub-processors.
     */
    constructor() {
        /** @type {string} */
        this.rootDir = path.join(__dirname, '..');
        /** @type {string} */
        this.srcDir = path.join(this.rootDir, 'src');
        /** @type {string} */
        this.distDir = path.join(this.rootDir, 'dist');
        /** @type {string} */
        this.runtimeDir = path.join(__dirname, 'runtime');
        
        /** @type {StyleProcessor} */
        this.styleProcessor = new StyleProcessor();
        /** @type {ComponentParser} */
        this.componentParser = new ComponentParser(this.styleProcessor);
        
        this.init();
    }

    /**
     * Initializes the compiler environment, ensuring required directories exist.
     * @private
     */
    init() {
        if (!fs.existsSync(this.distDir)) fs.mkdirSync(this.distDir);
    }

    /**
     * Executes the full build process: 
     * 1. Collects the runtime.
     * 2. Processes bridges.
     * 3. Compiles all components.
     * 4. Integrates the main entry point.
     * 5. Writes the final bundle files to the distribution directory.
     */
    build() {
        console.log("--- Avenx-JS Compiler (Refactored) ---");
        
        let bundleJs = this.getRuntime();
        const bridgeData = this.processBridges();
        bundleJs += this.processComponents();
        bundleJs += this.processMain(bridgeData.registrations);

        fs.writeFileSync(path.join(this.distDir, 'bundle.js'), bundleJs);
        fs.writeFileSync(path.join(this.distDir, 'bundle.css'), this.styleProcessor.getGlobalStyles());
        
        console.log("-----------------------");
        console.log('Build erfolgreich: dist/bundle.js & dist/bundle.css');
    }

    /**
     * Reads the core runtime files and prepares them for the bundle.
     * Removes export statements for browser compatibility within the single bundle.
     * @returns {string} The combined runtime JavaScript string.
     * @private
     */
    getRuntime() {
        const comp = fs.readFileSync(path.join(this.runtimeDir, 'AvenxComponent.js'), 'utf-8').replace(/export /g, '');
        const app = fs.readFileSync(path.join(this.runtimeDir, 'AvenxApp.js'), 'utf-8').replace(/export /g, '');
        return comp + "\n" + app;
    }

    /**
     * Scans the global directory and generates registration code for each bridge found.
     * @returns {Object} An object containing the generated bridge registration strings.
     * @private
     */
    processBridges() {
        const globalDir = path.join(this.srcDir, 'global');
        let registrations = "";
        if (fs.existsSync(globalDir)) {
            fs.readdirSync(globalDir).forEach(file => {
                if (file.endsWith('.bridge.js')) {
                    const name = path.basename(file, '.bridge.js');
                    // Capitalize bridge name for registration if needed, or keep as is?
                    // Previous was CounterBridge.js -> CounterBridge.
                    // Now counter.bridge.js -> counter.
                    // Let's capitalize first letter for consistency with component naming?
                    // Actually, the example shows CounterBridge.count in Display.axt.
                    // So maybe CounterBridge?
                    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1) + "Bridge";
                    
                    console.log(`[Bridge] ${capitalizedName}`);
                    const content = fs.readFileSync(path.join(globalDir, file), 'utf-8');
                    const match = content.match(/export\s+default\s+([\s\S]*)/);
                    if (match) {
                        const objStr = match[1].trim().replace(/;$/, '');
                        registrations += `app.registerBridge('${capitalizedName}', ${objStr});\n`;
                    }
                }
            });
        }
        return { registrations };
    }

    /**
     * Scans the components directory recursively and compiles every .component.js file into a JavaScript class.
     * @returns {string} The combined JavaScript code for all components.
     * @private
     */
    processComponents() {
        let componentsJs = "";
        const compDir = path.join(this.srcDir, 'components');
        
        const scan = (dir) => {
            if (!fs.existsSync(dir)) return;
            fs.readdirSync(dir).forEach(file => {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    scan(fullPath);
                } else if (file.endsWith('.component.js')) {
                    console.log(`[Compiling] ${file}`);
                    componentsJs += this.componentParser.parse(fullPath);
                }
            });
        };

        scan(compDir);
        return componentsJs;
    }

    /**
     * Processes the main application entry point (main.app.js file).
     * Integrates bridge registrations and wraps the code in an IIFE.
     * @param {string} bridgeRegistrations - The bridge registration code to inject.
     * @returns {string} The processed main entry point code.
     * @private
     */
    processMain(bridgeRegistrations) {
        const mainFile = path.join(this.srcDir, 'main.app.js');
        if (fs.existsSync(mainFile)) {
            let main = fs.readFileSync(mainFile, 'utf-8').replace(/import.*?;/g, ''); 
            if (bridgeRegistrations) {
                main = main.replace(/(const\s+app\s+=\s+new\s+AvenxApp\(.*?\);)/, `$1\n${bridgeRegistrations}`);
            }
            return `\n(function(){\n${main}\n})();`;
        }
        return "";
    }
}

// Instantiate the compiler and start the build
new AvenxCompiler().build();
