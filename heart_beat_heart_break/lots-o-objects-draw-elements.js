
function createApp(gl, settings) {
  const g_sortByModel       = false;
  const g_eyeSpeed          = 0.5;
  const g_eyeHeight         = 2;
  const g_eyeRadius         = 9;
  let g_numObjects          = 0;

  const m4 = twgl.m4;
  const v3 = twgl.v3;

  // Create Geometry.
  const bufferInfos = [
    //twgl.primitives.createSphereBufferInfo(gl, 0.4, 6, 6),
    twgl.primitives.createCubeBufferInfo(gl, 0.04),
    //twgl.primitives.createTruncatedConeBufferInfo(
      //gl, 0.4, 0.0, 0.8, 12, 1, true, true),
  ];

  // Load textures
  const texture = twgl.createTexture(gl, {src: 'happy-face.png'});

  const vs = `
  uniform mat4 worldViewProjection;
  uniform vec3 lightWorldPos;
  uniform mat4 world;
  uniform mat4 viewInverse;
  uniform mat4 worldInverseTranspose;
  attribute vec4 position;
  attribute vec3 normal;
  attribute vec2 texcoord;
  varying vec4 v_position;
  varying vec2 v_texcoord;
  varying vec3 v_normal;
  varying vec3 v_surfaceToLight;
  varying vec3 v_surfaceToView;
  void main() {
    v_texcoord = texcoord;
    v_position = (worldViewProjection * position);
    v_normal = (worldInverseTranspose * vec4(normal, 0)).xyz;
    v_surfaceToLight = lightWorldPos - (world * position).xyz;
    v_surfaceToView = (viewInverse[3] - (world * position)).xyz;
    gl_Position = v_position;
  }
  `;
  const fs = `
  precision mediump float;
  uniform vec4 colorMult;
  varying vec4 v_position;
  varying vec2 v_texcoord;
  varying vec3 v_normal;
  varying vec3 v_surfaceToLight;
  varying vec3 v_surfaceToView;

  uniform sampler2D diffuseSampler;
  uniform vec4 specular;
  uniform sampler2D bumpSampler;
  uniform float shininess;
  uniform float specularFactor;

  vec4 lit(float l ,float h, float m) {
    return vec4(1.0,
                max(l, 0.0),
                (l > 0.0) ? pow(max(0.0, h), m) : 0.0,
                1.0);
  }
  void main() {
    vec4 diffuse = colorMult;
    vec3 normal = normalize(v_normal);
    vec3 surfaceToLight = normalize(v_surfaceToLight);
    vec3 surfaceToView = normalize(v_surfaceToView);
    vec3 halfVector = normalize(surfaceToLight + surfaceToView);
    vec4 litR = lit(dot(normal, surfaceToLight),
                      dot(normal, halfVector), shininess);
    gl_FragColor = vec4((
    vec4(1,1,1,1) * (diffuse * litR.y
                          + specular * litR.z * specularFactor)).rgb,
        diffuse.a);
  }
  `;

  const programInfo = twgl.createProgramInfo(gl, [vs, fs]);

  // Used to make sure the test is always the same
  let randomSeed_ = 0;
  let RANDOM_RANGE_ = Math.pow(2, 32);
  function pseudoRandom() {
    return (randomSeed_ =
            (134775813 * randomSeed_ + 1) %
            RANDOM_RANGE_) / RANDOM_RANGE_;
  }

  function r(min, max) {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return Math.random() * (max - min) + min;
  }

  const instances = [];

  function addInstance() {
    let blue_channel = r(0.8);
    instances.push({
      x: 0,
      y: 0,
      z: 0,
      index: instances.length,
      //colorMult: new Float32Array([1.0, 1.0, 1.0, 0.8]),
      colorMult: new Float32Array([0.8, r(1) * blue_channel, blue_channel, 0.8]),
      modelIndex: instances.length % bufferInfos.length,
      xRadius: pseudoRandom(),
      yRadius: pseudoRandom(),
      zRadius: pseudoRandom() * 5,
      xClockSpeed: (pseudoRandom() + 0.5),
      yClockSpeed: (pseudoRandom() + 0.5),
      zClockSpeed: (pseudoRandom() + 0.5),
      xClock: pseudoRandom() * Math.PI * 2,
      yClock: pseudoRandom() * Math.PI * 2,
      zClock: pseudoRandom() * Math.PI * 2
    });

    // pre-sort by model.
    if (g_sortByModel) {
      instances.sort(function(a, b) {
        if (a.modelIndex < b.modelIndex) return -1;
        if (a.modelIndex > b.modelIndex) return  1;
        return 0;
      });
    }
  }

  // pre-allocate a bunch of arrays
  const projection = new Float32Array(16);
  const view = new Float32Array(16);
  const world = new Float32Array(16);
  const worldInverse = new Float32Array(16);
  const worldInverseTranspose = new Float32Array(16);
  const viewProjection = new Float32Array(16);
  const worldViewProjection = new Float32Array(16);
  const viewInverse = new Float32Array(16);
  const viewProjectionInverse = new Float32Array(16);
  const eyePosition = new Float32Array(3);
  const target = new Float32Array(3);
  const up = new Float32Array([0,1,0]);
  const lightWorldPos = new Float32Array(3);
  const v3t0 = new Float32Array(3);
  const v3t1 = new Float32Array(3);
  const v3t2 = new Float32Array(3);
  const v3t3 = new Float32Array(3);
  const m4t0 = new Float32Array(16);
  const m4t1 = new Float32Array(16);
  const m4t2 = new Float32Array(16);
  const m4t3 = new Float32Array(16);
  const zero4 = new Float32Array(4);
  const one4 = new Float32Array([1,1,1,1]);

  // uniforms.
  const sharedUniforms = {
    viewInverse: viewInverse,
    lightWorldPos: lightWorldPos,
    specular: one4,
    shininess: 50,
    specularFactor: 0.2,
  };
  const uniqueUniforms = {
    colorMult: new Float32Array([0,0,0,1]),
    world: world,
    worldViewProjection: worldViewProjection,
    worldInverse: worldInverse,
    worldInverseTranspose: worldInverseTranspose
  };

  var mouseDown = false;
  var lastMouseX = null;
  var lastMouseY = null;
  var theta = 0;
  var phi = 0;

  this.handleMouseDown = function (event) {
      mouseDown = true;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
  }

  this.handleMouseUp = function (event) {
      mouseDown = false;
  }

  this.handleMouseMove = function (event) {
        if (!mouseDown) {
            return;
        }
        var newX = event.clientX;
        var newY = event.clientY;

        var deltaX = newX - lastMouseX
       
        phi -= deltaX;
        if (phi < -180)
           		phi = 180 - (-180 - phi);

        var deltaY = newY - lastMouseY;
        theta += deltaY;
        
        //<!----------method 1: prevent to reach poles---->
        if (theta < - 89)
            theta = -89;
        if (theta > 89)
            theta = 89;
        //<!----------method 2: add another constraint---->
        //var pole_condition = 1;
        //vec3 prev_up; <!--global-->
        //up = (0, 0, 1);
        //right = dir ^ up

        lastMouseX = newX
        lastMouseY = newY;
    }
    canvas.onmousedown = this.handleMouseDown;
    canvas.onmousemove = this.handleMouseMove;
    canvas.onmouseup = this.handleMouseUp;

  function degToRad(degrees) {
    return degrees * Math.PI / 180;
  }

  let clock = 0.0;
  function update(elapsedTime, _numObjects) {
    clock += elapsedTime;

    while (instances.length < _numObjects) {
      addInstance();
    }
    g_numObjects = _numObjects;

    twgl.resizeCanvasToDisplaySize(gl.canvas);

    if (settings.update) {
      // Make the camera rotate around the scene.

      eyePosition[0] = g_eyeRadius* Math.cos(degToRad(theta)) * Math.sin(degToRad(phi));
      eyePosition[1] = g_eyeHeight + g_eyeRadius* Math.sin(degToRad(theta));
      eyePosition[2] = g_eyeRadius * Math.cos(degToRad(theta)) * Math.cos(degToRad(phi));
      //eyePosition[0] = Math.sin(1/*clock*/ * g_eyeSpeed) * g_eyeRadius;
      //eyePosition[2] = Math.cos(1/*clock*/ * g_eyeSpeed) * g_eyeRadius;

      // --Update Instance Positions---------------------------------------
      const advance = elapsedTime / 2;
      for (let ii = 0; ii < g_numObjects; ++ii) {
        var instance = instances[ii];
        var normalized_index = instance.index % 365 / 365.0;
        var param_t = normalized_index * 2.0 * Math.PI;
        var sin_t = Math.sin(param_t);
        instance.xClock += advance * instance.xClockSpeed;
        instance.yClock += advance * instance.yClockSpeed;
        instance.zClock += advance * instance.zClockSpeed;
        //instance.x = Math.sin(instance.xClock) * instance.xRadius;
        //instance.y = Math.sin(instance.yClock) * instance.yRadius;
        //instance.z = Math.cos(instance.zClock) * instance.zRadius;

        var sin_clock = Math.sin(clock * 3);
        if (sin_clock < 0.90)
        {
          sin_clock = 1.0;
        }
        else
        {
          sin_clock *= 1.2;
        }

        instance.x = (16 * sin_t * sin_t * sin_t * 0.2 * (instance.index % 5 * 0.05 + 0.8)) * sin_clock;
        instance.y = ((13 * Math.cos(param_t) - 5 * Math.cos(param_t * 2) - 2 * Math.cos(param_t * 3) - Math.cos(param_t * 4)) * 0.2 * (instance.index % 5 * 0.05 + 0.8)) * sin_clock;
        instance.z = ((instance.index % 2 == 0) ? -1 : 1) * (4 - instance.index % 5) * 0.2;

        var translate_x = instance.xRadius * Math.cos(instance.yClock) * Math.sin(instance.xClock);
        var translate_y = instance.xRadius * Math.sin(instance.yClock);
        var translate_z = instance.xRadius * Math.cos(instance.yClock) * Math.cos(instance.xClock);
//
        if (translate_x * instance.x + translate_y * instance.y + translate_z* instance.z > 0)
        {
          instance.x += translate_x;
          instance.y += translate_y;
          instance.z += translate_z;
        }
      }
    }
  }

  function render() {
    renderBegin();
    renderScene();
    renderEnd();
  }

  function renderBegin() {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // clear the screen.
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.clearColor(0,0,0,0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    if (settings.blend) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    // Compute a projection and view matrices.
    m4.perspective(
        60 * Math.PI / 180,
        canvas.clientWidth / canvas.clientHeight,
        1,
        5000,
        projection);
    m4.lookAt(
        eyePosition,
        target,
        up,
        viewInverse);
    m4.multiply(projection, view, viewProjection);
    m4.inverse(viewInverse, view);
    m4.inverse(viewProjection, viewProjectionInverse);

    // Put the light near the camera
    m4.getAxis(viewInverse, 0, v3t0); // x
    m4.getAxis(viewInverse, 1, v3t1); // y
    m4.getAxis(viewInverse, 2, v3t2); // z
    v3.mulScalar(v3t0, 10, v3t0);
    v3.mulScalar(v3t1, 10, v3t1);
    v3.mulScalar(v3t2, 10, v3t2);
    v3.add(eyePosition, v3t0, lightWorldPos);
    v3.add(lightWorldPos, v3t1, lightWorldPos);
    v3.add(lightWorldPos, v3t2, lightWorldPos);
  }

  function renderScene() {
    // -- Render Instances ---------------------------------------
    gl.useProgram(programInfo.program);
    twgl.setUniforms(programInfo, sharedUniforms);
    let lastModel = null;
    for (let ii = 0; ii < g_numObjects; ++ii) {
      const instance = instances[ii];
      const model = bufferInfos[instance.modelIndex];
      if (model != lastModel) {
        lastModel = model;
        twgl.setBuffersAndAttributes(gl, programInfo, model);
      }
      m4.translation([instance.x, instance.y, instance.z], world);
      m4.multiply(viewProjection, world, worldViewProjection);
      m4.inverse(world, worldInverse);
      m4.transpose(worldInverse, worldInverseTranspose);
      uniqueUniforms.colorMult = instance.colorMult;
      twgl.setUniforms(programInfo, uniqueUniforms);
      twgl.drawBufferInfo(gl, model);
    }
  }

  function renderEnd() {
    // nothing to do.
  }

  return {
    update: update,
    render: render
  };
}

