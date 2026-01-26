/**
 * Spark-based Splat Renderer Adapter
 *
 * This adapter wraps @sparkjsdev/spark to provide a similar API
 * to the old @mkkellogg/gaussian-splats-3d library.
 *
 * Key differences from the old library:
 * - Spark uses SplatMesh as a THREE.Object3D that gets added to a scene
 * - SparkRenderer handles the actual rendering and must be added to the scene
 * - We set up our own THREE.js scene, camera, renderer, and controls
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SplatMesh, SparkRenderer } from '@sparkjsdev/spark';

/**
 * Spark Renderer Settings
 * These control how splats are rendered and can affect perceived depth/size.
 */
export interface RendererSettings {
    /** Focal length adjustment. 1.0 = default, 2.0 = match PlayCanvas renderer. Default: 1.0 */
    focalAdjustment?: number;
    /** Maximum standard deviation for splat size. Default: √8 ≈ 2.83 */
    maxStdDev?: number;
    /** Blur amount for anti-aliasing. Typical: 0.3. Default: 0 */
    blurAmount?: number;
    /** Splat falloff curve. 0 = flat, 1 = normal gaussian kernel. Default: 1 */
    falloff?: number;
}

export const DEFAULT_RENDERER_SETTINGS: RendererSettings = {
    focalAdjustment: 1.0,
    maxStdDev: Math.sqrt(8),  // ≈ 2.83, Spark default
    blurAmount: 0,
    falloff: 1.0,
};

export interface ViewerOptions {
    /** Container element to render into */
    rootElement: HTMLElement;
    /** Camera up vector [x, y, z] */
    cameraUp?: [number, number, number];
    /** Initial camera position [x, y, z] */
    initialCameraPosition?: [number, number, number];
    /** Initial camera look-at target [x, y, z] */
    initialCameraLookAt?: [number, number, number];
    /** Enable built-in orbit controls */
    useBuiltInControls?: boolean;
    /** Enable antialiasing (default: false for performance) */
    antialiased?: boolean;
    /** Spark renderer settings */
    rendererSettings?: RendererSettings;
}

export interface SceneOptions {
    /** Scene format - not used in Spark but kept for API compatibility */
    format?: number;
    /** Rotation quaternion [x, y, z, w] */
    rotation?: [number, number, number, number];
    /** Show loading UI (not used in Spark) */
    showLoadingUI?: boolean;
}

/**
 * Splat Viewer that wraps Spark's SplatMesh and SparkRenderer
 * to provide a similar API to the old GaussianSplats3D.Viewer
 */
export class SplatViewer {
    private container: HTMLElement;
    private scene: THREE.Scene;
    private renderer: THREE.WebGLRenderer;
    private sparkRenderer: SparkRenderer;
    private _camera: THREE.PerspectiveCamera;
    private _controls: OrbitControls | null = null;
    private _splatMesh: SplatMesh | null = null;
    private animationFrameId: number | null = null;
    private isRunning = false;
    private disposed = false;

    constructor(options: ViewerOptions) {
        this.container = options.rootElement;

        // Create scene
        this.scene = new THREE.Scene();

        // Create camera
        const aspect = this.container.clientWidth / this.container.clientHeight || 1;
        this._camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);

        // Set camera up vector
        if (options.cameraUp) {
            this._camera.up.set(...options.cameraUp);
        }

        // Set initial camera position
        if (options.initialCameraPosition) {
            this._camera.position.set(...options.initialCameraPosition);
        } else {
            this._camera.position.set(0, 0, 5);
        }

        // Create WebGL renderer (antialias: false is recommended for Spark)
        this.renderer = new THREE.WebGLRenderer({
            antialias: options.antialiased ?? false,
            alpha: true,
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Merge renderer settings with defaults
        const settings = { ...DEFAULT_RENDERER_SETTINGS, ...options.rendererSettings };

        // Create SparkRenderer with settings
        this.sparkRenderer = new SparkRenderer({
            renderer: this.renderer,
            focalAdjustment: settings.focalAdjustment,
            maxStdDev: settings.maxStdDev,
            blurAmount: settings.blurAmount,
            falloff: settings.falloff,
        });
        this.scene.add(this.sparkRenderer);

        if (import.meta.env.DEV) {
            console.log('[SplatViewer] SparkRenderer settings:', settings);
        }

        // Set initial look-at target
        if (options.initialCameraLookAt) {
            this._camera.lookAt(...options.initialCameraLookAt);
        }

        // Create orbit controls if requested
        if (options.useBuiltInControls) {
            this._controls = new OrbitControls(this._camera, this.renderer.domElement);
            this._controls.enableDamping = true;
            this._controls.dampingFactor = 0.05;

            // Set initial target if look-at was provided
            if (options.initialCameraLookAt) {
                this._controls.target.set(...options.initialCameraLookAt);
            }
        }

        // Handle window resize
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);

        if (import.meta.env.DEV) console.log('[SplatViewer] Viewer created successfully');
    }

    /**
     * The THREE.js PerspectiveCamera
     */
    get camera(): THREE.PerspectiveCamera {
        return this._camera;
    }

    /**
     * The OrbitControls instance (if enabled)
     */
    get controls(): OrbitControls | null {
        return this._controls;
    }

    /**
     * The current SplatMesh
     */
    get splatMesh(): SplatMesh | null {
        return this._splatMesh;
    }

    /**
     * Add a splat scene from a URL
     * @param url URL to the splat file (.ply, .splat, etc.)
     * @param options Scene options including rotation
     * @returns Promise that resolves when the scene is loaded
     */
    async addSplatScene(url: string, options?: SceneOptions): Promise<void> {
        if (this.disposed) {
            throw new Error('Viewer has been disposed');
        }

        if (import.meta.env.DEV) {
            console.log('[SplatViewer] Adding splat scene:', url);
            console.log('[SplatViewer] Scene options:', options);
        }

        // Remove existing splat mesh if any
        if (this._splatMesh) {
            this.scene.remove(this._splatMesh);
            this._splatMesh.dispose();
            this._splatMesh = null;
        }

        // Create new SplatMesh
        this._splatMesh = new SplatMesh({
            url,
            onLoad: (mesh) => {
                if (import.meta.env.DEV) console.log('[SplatViewer] SplatMesh loaded');

                // Apply rotation if specified
                if (options?.rotation) {
                    const [x, y, z, w] = options.rotation;
                    mesh.quaternion.set(x, y, z, w);
                    if (import.meta.env.DEV) console.log('[SplatViewer] Applied rotation quaternion:', options.rotation);
                }
            },
        });

        // Add to scene
        this.scene.add(this._splatMesh);

        // Wait for initialization
        await this._splatMesh.initialized;
        if (import.meta.env.DEV) console.log('[SplatViewer] Scene loaded successfully');
    }

    /**
     * Start the render loop
     */
    start(): void {
        if (this.isRunning || this.disposed) {
            return;
        }

        if (import.meta.env.DEV) console.log('[SplatViewer] Starting render loop');
        this.isRunning = true;
        this.animate();
    }

    /**
     * Stop the render loop
     */
    stop(): void {
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (import.meta.env.DEV) console.log('[SplatViewer] Stopped render loop');
    }

    /**
     * Dispose of all resources
     */
    dispose(): void {
        if (this.disposed) {
            return;
        }

        if (import.meta.env.DEV) console.log('[SplatViewer] Disposing viewer');
        this.disposed = true;
        this.stop();

        // Remove resize listener
        window.removeEventListener('resize', this.handleResize);

        // Dispose controls
        if (this._controls) {
            this._controls.dispose();
            this._controls = null;
        }

        // Dispose splat mesh
        if (this._splatMesh) {
            this.scene.remove(this._splatMesh);
            this._splatMesh.dispose();
            this._splatMesh = null;
        }

        // Remove spark renderer from scene
        this.scene.remove(this.sparkRenderer);

        // Dispose WebGL renderer
        this.renderer.dispose();

        // Remove canvas from container
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }

        if (import.meta.env.DEV) console.log('[SplatViewer] Viewer disposed');
    }

    /**
     * Get the number of splats in the current scene
     */
    getSplatCount(): number {
        if (this._splatMesh?.packedSplats) {
            return this._splatMesh.packedSplats.numSplats;
        }
        return 0;
    }

    /**
     * Update renderer settings at runtime
     * Note: Some settings may require re-rendering to take effect
     */
    updateRendererSettings(settings: Partial<RendererSettings>): void {
        if (this.disposed) return;

        // SparkRenderer exposes these as properties
        const spark = this.sparkRenderer as unknown as {
            focalAdjustment?: number;
            maxStdDev?: number;
            blurAmount?: number;
            falloff?: number;
        };

        if (settings.focalAdjustment !== undefined && 'focalAdjustment' in spark) {
            spark.focalAdjustment = settings.focalAdjustment;
        }
        if (settings.maxStdDev !== undefined && 'maxStdDev' in spark) {
            spark.maxStdDev = settings.maxStdDev;
        }
        if (settings.blurAmount !== undefined && 'blurAmount' in spark) {
            spark.blurAmount = settings.blurAmount;
        }
        if (settings.falloff !== undefined && 'falloff' in spark) {
            spark.falloff = settings.falloff;
        }

        if (import.meta.env.DEV) {
            console.log('[SplatViewer] Updated renderer settings:', settings);
        }
    }

    private animate = (): void => {
        if (!this.isRunning || this.disposed) {
            return;
        }

        this.animationFrameId = requestAnimationFrame(this.animate);

        // Update controls if enabled
        if (this._controls) {
            this._controls.update();
        }

        // Render
        this.renderer.render(this.scene, this._camera);
    };

    private handleResize(): void {
        if (this.disposed) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        if (width === 0 || height === 0) return;

        this._camera.aspect = width / height;
        this._camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}

// Export for backwards compatibility
export { SplatViewer as Viewer };

// Re-export scene format constants for API compatibility
export const SceneFormat = {
    Splat: 0,
    KSplat: 1,
    Ply: 2,
    Spz: 3,
} as const;
