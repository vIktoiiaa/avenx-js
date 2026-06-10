/**
 * AvenxApp is the main orchestrator for an Avenx application.
 * It manages the registration of component classes, the creation and management of shared reactive states (bridges),
 * and the mounting of component instances to the DOM.
 */
export class AvenxApp {
    /** 
     * A list of all currently active (mounted) component instances.
     * @type {AvenxComponent[]} 
     * @private
     */
    #activeComponents = [];
    
    /** 
     * The default target DOM element for mounting the application.
     * @type {HTMLElement|null} 
     * @private
     */
    #target = null;

    /**
     * Creates an instance of AvenxApp.
     * @param {Object} config - The application configuration.
     * @param {string} config.target - The CSS selector for the main application container.
     */
    constructor(config) {
        this.#target = document.querySelector(config.target);
        /**
         * A map of registered component names to their respective class constructors.
         * @type {Map<string, Function>}
         */
        this.components = new Map();
        /**
         * A map of shared reactive state objects (bridges).
         * @type {Object<string, Proxy>}
         */
        this.bridges = {};
    }

    /**
     * Registers a component class under a specific name, making it available for mounting.
     * @param {string} name - The unique name for the component.
     * @param {Function} compClass - The component class constructor.
     */
    register(name, compClass) { 
        this.components.set(name, compClass); 
    }
    
    /**
     * Registers a shared reactive state object or class (bridge). 
     * Changes to a bridge's state will automatically trigger a re-render for all active components.
     * @param {string} name - The unique name for the bridge.
     * @param {Object|Function} bridgeData - The initial state data or a Bridge class.
     */
    registerBridge(name, bridgeData) {
        const self = this;
        let instance = bridgeData;

        // Check if bridgeData is a class (constructor) and instantiate it
        if (typeof bridgeData === 'function') {
            try {
                instance = new bridgeData();
            } catch (e) {
                // Not a constructor or failed to instantiate, fallback to object behavior
            }
        }

        const reactiveState = new Proxy(instance, {
            set(target, key, value) {
                target[key] = value;
                self.updateAll();
                return true;
            },
            get(target, key, receiver) {
                const value = Reflect.get(target, key, receiver);
                // Bind methods to the proxy (receiver) so 'this' refers to the reactive state
                if (typeof value === 'function') {
                    return value.bind(receiver);
                }
                return value;
            }
        });
        this.bridges[name] = reactiveState;
    }

    /**
     * Triggers an update (re-render) for every active (mounted) component instance in the application.
     */
    updateAll() {
        this.#activeComponents.forEach(comp => comp.update());
    }

    /**
     * Mounts a registered component to a specific target element.
     * Creates a new instance of the component class and provides it with access to all registered bridges.
     * @param {string} name - The name of the registered component to mount.
     * @param {string|null} [targetSelector=null] - The CSS selector for the target mount point. 
     * If null, the application's default target is used.
     */
    mount(name, targetSelector = null) {
        const Comp = this.components.get(name);
        const target = targetSelector ? document.querySelector(targetSelector) : this.#target;
        if (Comp && target) {
            const compInstance = new Comp(this.bridges);
            compInstance.mount(target);
            this.#activeComponents.push(compInstance);
        }
    }
}
