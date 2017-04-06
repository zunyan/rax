/* global THREE */

class Demo {

  static get CAMERA_SETTINGS() {
    return {
      viewAngle: 45,
      near: 0.1,
      far: 10000
    };
  }

  constructor() {
    this._width;
    this._height;
    this._renderer;
    this._camera;
    this._aspect;
    this._settings;
    this._box;
    this._container = document.querySelector('#container');

    this.clearContainer();
    this.createRenderer();

    this._onResize = this._onResize.bind(this);
    this._update = this._update.bind(this);
    this._onResize();

    this.createCamera();
    this.createScene();
    this.createMeshes();

    this._addEventListeners();
    requestAnimationFrame(this._update);
  }

  _update() {
    const ROTATION_VALUE = 4;
    const time = window.performance.now() * 0.0001;

    this._box.rotation.x = Math.sin(time) * ROTATION_VALUE;
    this._box.rotation.y = Math.cos(time) * ROTATION_VALUE;

    this._render();
  }

  _render() {
    this._renderer.render(this._scene, this._camera);
    requestAnimationFrame(this._update);
  }

  _onResize() {
    this._width = window.innerWidth;
    this._height = window.innerHeight;
    this._aspect = this._width / this._height;

    this._renderer.setSize(this._width, this._height);

    if (!this._camera) {
      return;
    }

    this._camera.aspect = this._aspect;
    this._camera.updateProjectionMatrix();
  }

  _addEventListeners() {
    window.addEventListener('resize', this._onResize);
  }

  clearContainer() {
    this._container.innerHTML = '';
  }

  createRenderer() {
    this._renderer = new THREE.WebGLRenderer();
    this._container.appendChild(this._renderer.domElement);
  }

  createCamera() {
    this._settings = Demo.CAMERA_SETTINGS;
    this._camera = new THREE.PerspectiveCamera(
        this._settings.viewAngle,
        this._aspect,
        this._settings.near,
        this._settings.far
    );
  }

  createScene() {
    this._scene = new THREE.Scene();
  }

  createMeshes() {
    const WIDTH = 1;
    const HEIGHT = 1;
    const DEPTH = 1;

    // Box.
    const boxGeometry = new THREE.BoxGeometry(WIDTH, HEIGHT, DEPTH);
    const boxMaterial = new THREE.MeshNormalMaterial();

    this._box = new THREE.Mesh(boxGeometry, boxMaterial);
    this._box.position.z = -5;

    // Room.
    const roomGeometry = new THREE.BoxGeometry(10, 2, 10, 10, 2, 10);
    const roomMaterial = new THREE.MeshBasicMaterial({
      wireframe: true,
      opacity: 0.3,
      transparent: true,
      side: THREE.BackSide
    });
    const room = new THREE.Mesh(roomGeometry, roomMaterial);

    room.position.z = -5;

    this._scene.add(this._box);
    this._scene.add(room);
  }
}

class DemoVR extends Demo {
  constructor () {
    super();

    this._onResize = this._onResize.bind(this);

    this._disabled = false;
    if (typeof VRFrameData === 'undefined') {
      this._disabled = true;
      this._showWebVRNotSupportedError();
      return;
    }

    this._isShowingPressButtonModal = false;
    this._firstVRFrame = false;
    this._button = undefined;
    this._vr = {
      display: null,
      frameData: new VRFrameData()
    };

    this._addVREventListeners();
    this._getDisplays().then(_ => {
      // Get any available inputs.
      this._getInput();
      this._addInputEventListeners();

      // Default the box to 'deselected'.
      this._onDeselected(this._box);
    });
  }

  _addVREventListeners () {
    window.addEventListener('vrdisplayactivate', _ => {
      this._activateVR();
    });

    window.addEventListener('vrdisplaydeactivate', _ => {
      this._deactivateVR();
    });
  }

  _getDisplays () {
    return navigator.getVRDisplays().then(displays => {
      // Filter down to devices that can present.
      displays = displays.filter(display => display.capabilities.canPresent);

      // If there are no devices available, quit out.
      if (displays.length === 0) {
        console.warn('No devices available able to present.');
        return;
      }

      // Store the first display we find. A more production-ready version should
      // allow the user to choose from their available displays.
      this._vr.display = displays[0];
      this._vr.display.depthNear = DemoVR.CAMERA_SETTINGS.near;
      this._vr.display.depthFar = DemoVR.CAMERA_SETTINGS.far;

      this._createPresentationButton();
    });
  }

  _getInput () {
    this._rayInput = new RayInput(this._camera, this._renderer.domElement);
    this._onResize();
  }

  _addInputEventListeners () {
    // Track the box for ray inputs.
    this._rayInput.add(this._box);

    // Set up a bunch of event listeners.
    this._rayInput.on('rayover', this._onSelected);
    this._rayInput.on('rayout', this._onDeselected);
    this._rayInput.on('raydown', this._onSelected);
    this._rayInput.on('rayup', this._onDeselected);
  }

  _onSelected (optMesh) {
    if (!optMesh) {
      return;
    }

    optMesh.material.transparent = true;
    optMesh.material.opacity = 1;
  }

  _onDeselected (optMesh) {
    if (!optMesh) {
      return;
    }

    optMesh.material.transparent = true;
    optMesh.material.opacity = 0.5;
  }

  _onResize () {
    super._onResize();

    if (!this._rayInput) {
      return;
    }

    this._rayInput.setSize(this._renderer.getSize());
  }

  _showNoPresentError () {
    console.error(`Unable to present with this device ${this._vr.display}`);
  }

  _showWebVRNotSupportedError () {
    console.error('WebVR not supported');
  }

  _createPresentationButton () {
    this._button = document.createElement('button');
    this._button.classList.add('vr-toggle');
    this._button.textContent = 'Enable VR';
    this._button.addEventListener('click', _ => {
      this._toggleVR();
    }, false);

    document.body.appendChild(this._button);
  }

  _showPressButtonModal () {
    // Get the message texture, but disable mipmapping so it doesn't look blurry
    const map = new THREE.TextureLoader().load('./images/press-button.jpg');
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;

    // Create the sprite and place it into the scene.
    const material = new THREE.SpriteMaterial({
      map, color: 0xFFFFFF
    });
    this._modal = new THREE.Sprite(material);
    this._modal.position.z = -4;
    this._modal.scale.x = 2;
    this._modal.scale.y = 2;

    this._scene.add(this._modal);

    // Finally set a flag so we can pick this up in the _render function.
    this._isShowingPressButtonModal = true;
  }

  _hidePressButtonModal () {
    this._scene.remove(this._modal);
    this._modal = null;
    this._isShowingPressButtonModal = false;
    this._scene.add(this._rayInput.getMesh());
  }

  _deactivateVR () {
    if (!this._vr.display) {
      return;
    }

    if (!this._vr.display.isPresenting) {
      return;
    }

    this._vr.display.exitPresent();
    this._onResize();
    this._hidePressButtonModal();
    return;
  }

  _activateVR () {
    if (!this._vr.display) {
      return;
    }

    this._firstVRFrame = true;
    this._vr.display.requestPresent([{
      source: this._renderer.domElement
    }])
    .then(_ => {
      this._showPressButtonModal();
    })
    .catch(e => {
      console.error(`Unable to init VR: ${e}`);
    });
  }

  _toggleVR () {
    if (this._vr.display.isPresenting) {
      return this._deactivateVR();
    }

    return this._activateVR();
  }

  _render () {
    if (this._rayInput) {
      if (this._isShowingPressButtonModal &&
        this._rayInput.controller.wasGamepadPressed) {
        this._hidePressButtonModal();
      }

      this._rayInput.update();
    }

    if (this._disabled || !(this._vr.display && this._vr.display.isPresenting)) {
      // Ensure that we switch everything back to auto for non-VR mode.
      this._renderer.autoClear = true;
      this._scene.matrixAutoUpdate = true;

      return super._render();
    }

    // When this is called the first time, it will be using the standard
    // window.requestAnimationFrame API, which will throw a warning when we call
    // display.submitFrame. So for the first frame that this is called we will
    // exit early and request a new frame from the VR device instead.
    if (this._firstVRFrame) {
      this._firstVRFrame = false;
      return this._vr.display.requestAnimationFrame(this._update);
    }

    const EYE_WIDTH = this._width * 0.5;
    const EYE_HEIGHT = this._height;

    // Get all the latest data from the VR headset and dump it into frameData.
    this._vr.display.getFrameData(this._vr.frameData);

    // Disable autoupdating because these values will be coming from the
    // frameData data directly.
    this._scene.matrixAutoUpdate = false;

    // Make sure not to clear the renderer automatically, because we will need
    // to render it ourselves twice, once for each eye.
    this._renderer.autoClear = false;

    // Clear the canvas manually.
    this._renderer.clear();

    // Left eye.
    this._renderEye(
      this._vr.frameData.leftViewMatrix,
      this._vr.frameData.leftProjectionMatrix,
      {
        x: 0,
        y: 0,
        w: EYE_WIDTH,
        h: EYE_HEIGHT
      });

    // Ensure that left eye calcs aren't going to interfere with right eye ones.
    this._renderer.clearDepth();

    // Right eye.
    this._renderEye(
      this._vr.frameData.rightViewMatrix,
      this._vr.frameData.rightProjectionMatrix, {
        x: EYE_WIDTH,
        y: 0,
        w: EYE_WIDTH,
        h: EYE_HEIGHT
      });

    // Use the VR display's in-built rAF (which can be a diff refresh rate to
    // the default browser one).
    this._vr.display.requestAnimationFrame(this._update);

    // Call submitFrame to ensure that the device renders the latest image from
    // the WebGL context.
    this._vr.display.submitFrame();
  }

  _renderEye (viewMatrix, projectionMatrix, viewport) {
    // Set the left or right eye half.
    this._renderer.setViewport(viewport.x, viewport.y, viewport.w, viewport.h);

    // Update the scene and camera matrices.
    this._camera.projectionMatrix.fromArray(projectionMatrix);
    this._scene.matrix.fromArray(viewMatrix);

    // Tell the scene to update (otherwise it will ignore the change of matrix).
    this._scene.updateMatrixWorld(true);
    this._renderer.render(this._scene, this._camera);
  }
}

new DemoVR();
