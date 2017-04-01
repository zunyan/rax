const global = window;

if (!global.THREE) {
  global.THREE = require('three');
}

if (!global.THREE.VREffect) {
  global.THREE.VREffect = require('./VREffect');
}

if (!global.THREE.VRControls) {
  global.THREE.VRControls = require('./VRControls');
}

if (!global.RayInput) {
  global.RayInput = require('./ray-input');
}

require('./webvr-polyfill');
