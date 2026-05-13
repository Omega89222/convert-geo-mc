import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Box,
  Copy,
  Download,
  FileJson,
  Grid,
  Image,
  RotateCcw,
  createIcons,
} from 'lucide';

const FACE_NAMES = ['north', 'south', 'east', 'west', 'up', 'down'];
const FACE_TO_DIRECTION = {
  north: 'north',
  south: 'south',
  east: 'east',
  west: 'west',
  up: 'up',
  down: 'down',
};
const DEFAULT_TEXTURE_SIZE = { width: 64, height: 64 };

const sampleModel = {
  credit: 'Sample model for preview',
  texture_size: [64, 64],
  textures: {
    0: 'minecraft:block/oak_planks',
  },
  elements: [
    {
      name: 'body',
      from: [3, 0, 4],
      to: [13, 11, 12],
      faces: {
        north: { uv: [0, 0, 10, 11], texture: '#0' },
        south: { uv: [10, 0, 20, 11], texture: '#0' },
        east: { uv: [20, 0, 28, 11], texture: '#0' },
        west: { uv: [28, 0, 36, 11], texture: '#0' },
        up: { uv: [36, 0, 46, 8], texture: '#0' },
        down: { uv: [46, 0, 56, 8], texture: '#0' },
      },
    },
    {
      name: 'head',
      from: [4, 11, 3],
      to: [12, 19, 11],
      rotation: { origin: [8, 11, 8], axis: 'y', angle: 22.5 },
      faces: {
        north: { uv: [0, 16, 8, 24], texture: '#0' },
        south: { uv: [8, 16, 16, 24], texture: '#0' },
        east: { uv: [16, 16, 24, 24], texture: '#0' },
        west: { uv: [24, 16, 32, 24], texture: '#0' },
        up: { uv: [32, 16, 40, 24], texture: '#0' },
        down: { uv: [40, 16, 48, 24], texture: '#0' },
      },
    },
    {
      name: 'arm_left',
      from: [0, 2, 5],
      to: [3, 10, 11],
      faces: {
        north: { uv: [0, 32, 3, 40], texture: '#0' },
        south: { uv: [3, 32, 6, 40], texture: '#0' },
        east: { uv: [6, 32, 12, 40], texture: '#0' },
        west: { uv: [12, 32, 18, 40], texture: '#0' },
        up: { uv: [18, 32, 21, 38], texture: '#0' },
        down: { uv: [21, 32, 24, 38], texture: '#0' },
      },
    },
    {
      name: 'arm_right',
      from: [13, 2, 5],
      to: [16, 10, 11],
      faces: {
        north: { uv: [24, 32, 27, 40], texture: '#0' },
        south: { uv: [27, 32, 30, 40], texture: '#0' },
        east: { uv: [30, 32, 36, 40], texture: '#0' },
        west: { uv: [36, 32, 42, 40], texture: '#0' },
        up: { uv: [42, 32, 45, 38], texture: '#0' },
        down: { uv: [45, 32, 48, 38], texture: '#0' },
      },
    },
  ],
};

const els = {
  identifier: document.querySelector('#identifier'),
  modelInput: document.querySelector('#modelInput'),
  textureInput: document.querySelector('#textureInput'),
  modelDrop: document.querySelector('#modelDrop'),
  textureDrop: document.querySelector('#textureDrop'),
  modelFileName: document.querySelector('#modelFileName'),
  textureFileName: document.querySelector('#textureFileName'),
  sourceFormat: document.querySelector('#sourceFormat'),
  cubeCount: document.querySelector('#cubeCount'),
  boneCount: document.querySelector('#boneCount'),
  textureSize: document.querySelector('#textureSize'),
  warningList: document.querySelector('#warningList'),
  outputJson: document.querySelector('#outputJson'),
  exportStatus: document.querySelector('#exportStatus'),
  copyOutput: document.querySelector('#copyOutput'),
  downloadOutput: document.querySelector('#downloadOutput'),
  resetCamera: document.querySelector('#resetCamera'),
  gridToggle: document.querySelector('#gridToggle'),
  preview: document.querySelector('#preview'),
  previewTitle: document.querySelector('#previewTitle'),
};

const state = {
  sourceJson: structuredClone(sampleModel),
  sourceName: 'modele_exemple.json',
  texture: null,
  textureUrl: null,
  hasCustomTexture: false,
  textureSize: { ...DEFAULT_TEXTURE_SIZE },
  effectiveTextureSize: { ...DEFAULT_TEXTURE_SIZE },
  converted: null,
  conversion: null,
  gridVisible: true,
};

let scene;
let camera;
let renderer;
let controls;
let modelGroup;
let gridHelper;
let animationFrame;

createIcons({
  icons: {
    Box,
    Copy,
    Download,
    FileJson,
    Grid,
    Image,
    RotateCcw,
  },
});

initScene();
bindEvents();
applyDefaultTexture();
els.gridToggle.classList.toggle('is-active', state.gridVisible);
convertAndRender();

function bindEvents() {
  els.identifier.addEventListener('input', convertAndRender);
  els.modelInput.addEventListener('change', () => {
    const [file] = els.modelInput.files;
    if (file) readModelFile(file);
  });
  els.textureInput.addEventListener('change', () => {
    const [file] = els.textureInput.files;
    if (file) readTextureFile(file);
  });
  els.copyOutput.addEventListener('click', copyOutput);
  els.downloadOutput.addEventListener('click', downloadOutput);
  els.resetCamera.addEventListener('click', resetCamera);
  els.gridToggle.addEventListener('click', toggleGrid);
  window.addEventListener('resize', resizeRenderer);

  setupDropZone(els.modelDrop, (file) => readModelFile(file));
  setupDropZone(els.textureDrop, (file) => readTextureFile(file));
}

function setupDropZone(element, onFile) {
  element.addEventListener('dragover', (event) => {
    event.preventDefault();
    element.classList.add('is-dragging');
  });
  element.addEventListener('dragleave', () => element.classList.remove('is-dragging'));
  element.addEventListener('drop', (event) => {
    event.preventDefault();
    element.classList.remove('is-dragging');
    const [file] = event.dataTransfer.files;
    if (file) onFile(file);
  });
}

async function readModelFile(file) {
  try {
    const text = await file.text();
    state.sourceJson = JSON.parse(text);
    state.sourceName = file.name;
    els.modelFileName.textContent = file.name;
    syncIdentifierFromModel(state.sourceJson, file.name);
    convertAndRender();
  } catch (error) {
    showError(`Modèle illisible: ${error.message}`);
  }
}

async function readTextureFile(file) {
  const url = URL.createObjectURL(file);
  const image = new window.Image();
  image.decoding = 'async';
  image.onload = () => {
    if (state.textureUrl) URL.revokeObjectURL(state.textureUrl);
    state.textureUrl = url;
    state.textureSize = {
      width: image.naturalWidth || DEFAULT_TEXTURE_SIZE.width,
      height: image.naturalHeight || DEFAULT_TEXTURE_SIZE.height,
    };
    const texture = new THREE.Texture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  state.texture = texture;
  state.hasCustomTexture = true;
  els.textureFileName.textContent = file.name;
  convertAndRender();
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    showError('Texture illisible.');
  };
  image.src = url;
}

function applyDefaultTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = DEFAULT_TEXTURE_SIZE.width;
  canvas.height = DEFAULT_TEXTURE_SIZE.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2f7d59';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#c6542b';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#202528';
  ctx.fillRect(32, 0, 32, 32);
  ctx.fillStyle = '#e4b33c';
  ctx.fillRect(0, 32, 32, 32);
  ctx.fillStyle = '#f6f7f8';
  ctx.fillRect(32, 32, 32, 32);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 8) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  state.texture = texture;
}

function syncIdentifierFromModel(model, fileName) {
  const existing = getFirstGeometry(model)?.description?.identifier;
  if (existing) {
    els.identifier.value = sanitizeIdentifier(existing);
    return;
  }
  const baseName = fileName.replace(/\.(geo\.)?json$|\.bbmodel$/i, '');
  els.identifier.value = sanitizeIdentifier(`geometry.${baseName}`);
}

function convertAndRender() {
  try {
    const identifier = sanitizeIdentifier(els.identifier.value);
    els.identifier.value = identifier;
    const conversion = convertModel(state.sourceJson, {
      identifier,
      textureWidth: state.hasCustomTexture ? state.textureSize.width : undefined,
      textureHeight: state.hasCustomTexture ? state.textureSize.height : undefined,
      sourceName: state.sourceName,
    });
    state.conversion = conversion;
    state.converted = conversion.output;
    state.effectiveTextureSize = getOutputTextureSize(conversion.output);
    renderOutput(conversion);
    renderModel(conversion.output);
    updateStats(conversion);
  } catch (error) {
    showError(error.message);
  }
}

function convertModel(input, options) {
  if (!input || typeof input !== 'object') {
    throw new Error('Le JSON doit contenir un objet.');
  }

  if (Array.isArray(input['minecraft:geometry'])) {
    return normalizeBedrockGeometry(input, options);
  }

  if (Array.isArray(input.elements)) {
    return convertElementModel(input, options);
  }

  if (Array.isArray(input.bones)) {
    const wrapped = {
      format_version: '1.12.0',
      'minecraft:geometry': [
        {
          description: {
            identifier: options.identifier,
            texture_width: options.textureWidth,
            texture_height: options.textureHeight,
          },
          bones: input.bones,
        },
      ],
    };
    return normalizeBedrockGeometry(wrapped, {
      ...options,
      sourceFormat: 'Bones JSON',
    });
  }

  throw new Error('Format non reconnu: utilisez un modèle Java JSON, .bbmodel ou .geo.json.');
}

function normalizeBedrockGeometry(input, options) {
  const warnings = [];
  const geometries = input['minecraft:geometry'];
  if (!geometries.length) {
    throw new Error('Le fichier geo ne contient aucune géométrie.');
  }
  if (geometries.length > 1) {
    warnings.push('Plusieurs géométries détectées; l’aperçu utilise la première.');
  }

  const normalizedGeometries = geometries.map((geometry, index) => {
    const description = {
      ...(geometry.description || {}),
      identifier:
        index === 0
          ? options.identifier
          : sanitizeIdentifier(geometry.description?.identifier || `${options.identifier}_${index + 1}`),
      texture_width: Number(geometry.description?.texture_width) || options.textureWidth,
      texture_height: Number(geometry.description?.texture_height) || options.textureHeight,
    };

    const bones = Array.isArray(geometry.bones)
      ? geometry.bones.map((bone, boneIndex) => normalizeBone(bone, `bone_${boneIndex + 1}`))
      : [];
    if (!bones.length) warnings.push('Aucun bone détecté dans la géométrie.');

    return cleanObject({
      ...geometry,
      description,
      bones,
    });
  });

  const output = {
    format_version: '1.12.0',
    'minecraft:geometry': normalizedGeometries,
  };

  return {
    output,
    sourceFormat: options.sourceFormat || 'Bedrock/GeckoLib geo',
    warnings,
    stats: computeStats(output),
  };
}

function normalizeBone(bone, fallbackName) {
  return cleanObject({
    name: sanitizeBoneName(bone.name || fallbackName),
    parent: bone.parent ? sanitizeBoneName(bone.parent) : undefined,
    pivot: normalizeVector(bone.pivot, 3),
    rotation: normalizeVector(bone.rotation, 3),
    mirror: typeof bone.mirror === 'boolean' ? bone.mirror : undefined,
    cubes: Array.isArray(bone.cubes) ? bone.cubes.map(normalizeCube) : undefined,
    locators: bone.locators,
  });
}

function normalizeCube(cube) {
  return cleanObject({
    origin: normalizeVector(cube.origin, 3),
    size: normalizeVector(cube.size, 3),
    pivot: normalizeVector(cube.pivot, 3),
    rotation: normalizeVector(cube.rotation, 3),
    mirror: typeof cube.mirror === 'boolean' ? cube.mirror : undefined,
    uv: normalizeUv(cube.uv),
  });
}

function normalizeUv(uv) {
  if (Array.isArray(uv)) return normalizeVector(uv, 2);
  if (!uv || typeof uv !== 'object') return undefined;
  return FACE_NAMES.reduce((result, faceName) => {
    const face = uv[faceName];
    if (!face) return result;
    result[faceName] = cleanObject({
      uv: normalizeVector(face.uv, 2),
      uv_size: normalizeVector(face.uv_size, 2),
      material_instance: face.material_instance,
    });
    return result;
  }, {});
}

function convertElementModel(input, options) {
  const warnings = [];
  const textureSize = getTextureSizeFromModel(input, options);
  const elements = input.elements.filter((element) => isCubeElement(element));
  const ignoredElements = input.elements.length - elements.length;
  if (ignoredElements > 0) {
    warnings.push(`${ignoredElements} élément(s) non cubiques ignoré(s).`);
  }
  if (!elements.length) {
    throw new Error('Aucun cube convertible trouvé.');
  }
  if (input.parent && !input.elements?.length) {
    warnings.push('Les modèles Java basés uniquement sur parent doivent être fusionnés avant conversion.');
  }

  const context = {
    warnings,
    elementsByUuid: new Map(elements.map((element, index) => [element.uuid || `element_${index}`, element])),
    usedElements: new Set(),
  };
  let bones = [];

  if (Array.isArray(input.outliner) && input.outliner.length) {
    bones = buildBonesFromOutliner(input.outliner, context);
    const leftovers = elements.filter((element, index) => {
      const id = element.uuid || `element_${index}`;
      return !context.usedElements.has(id);
    });
    if (leftovers.length) {
      bones.unshift({
        name: 'root',
        pivot: [0, 0, 0],
        cubes: leftovers.map((element) => convertElementToCube(element, context)),
      });
    }
  } else {
    bones = [
      {
        name: 'root',
        pivot: [0, 0, 0],
        cubes: elements.map((element) => convertElementToCube(element, context)),
      },
    ];
  }

  const output = {
    format_version: '1.12.0',
    'minecraft:geometry': [
      {
        description: {
          identifier: options.identifier,
          texture_width: textureSize.width,
          texture_height: textureSize.height,
          visible_bounds_width: 3,
          visible_bounds_height: 3,
          visible_bounds_offset: [0, 1, 0],
        },
        bones: bones.filter((bone) => bone.cubes?.length || bone.parent || bone.rotation || bone.pivot),
      },
    ],
  };

  return {
    output: cleanObject(output),
    sourceFormat: detectElementFormat(input),
    warnings,
    stats: computeStats(output),
  };
}

function buildBonesFromOutliner(outliner, context) {
  const bones = [];
  const usedNames = new Set();

  const walk = (node, parentName) => {
    if (typeof node === 'string') {
      const element = context.elementsByUuid.get(node);
      if (!element) return null;
      context.usedElements.add(node);
      return convertElementToCube(element, context);
    }

    if (!node || typeof node !== 'object') return null;

    const boneName = uniqueName(sanitizeBoneName(node.name || 'bone'), usedNames);
    const bone = cleanObject({
      name: boneName,
      parent: parentName || undefined,
      pivot: convertJavaPointToBedrock(node.origin || [8, 0, 8]),
      rotation: normalizeVector(node.rotation, 3),
      cubes: [],
    });

    for (const child of node.children || []) {
      const converted = walk(child, boneName);
      if (converted && converted.origin && converted.size) {
        bone.cubes.push(converted);
      }
    }

    bones.push(bone);
    return null;
  };

  for (const entry of outliner) {
    const converted = walk(entry, null);
    if (converted) {
      const root = bones.find((bone) => bone.name === 'root');
      if (root) root.cubes.push(converted);
      else bones.unshift({ name: 'root', pivot: [0, 0, 0], cubes: [converted] });
    }
  }

  return bones;
}

function convertElementToCube(element, context) {
  const from = normalizeVector(element.from, 3, [0, 0, 0]);
  const to = normalizeVector(element.to, 3, [16, 16, 16]);
  const size = [
    Math.abs(to[0] - from[0]),
    Math.abs(to[1] - from[1]),
    Math.abs(to[2] - from[2]),
  ];
  const origin = convertJavaPointToBedrock([
    Math.min(from[0], to[0]),
    Math.min(from[1], to[1]),
    Math.min(from[2], to[2]),
  ]);
  const rotation = getElementRotation(element);
  const pivotSource = element.origin || element.rotation?.origin;
  const cube = {
    origin,
    size: roundVector(size),
    uv: convertFacesToBedrockUv(element.faces, context),
  };

  if (rotation.some((value) => value !== 0)) {
    cube.pivot = convertJavaPointToBedrock(pivotSource || [8, 8, 8]);
    cube.rotation = rotation;
  }

  if (element.rotation?.rescale) {
    context.warnings.push('La propriété Java rotation.rescale est ignorée par l’export Bedrock.');
  }

  return cleanObject(cube);
}

function convertFacesToBedrockUv(faces, context) {
  if (!faces || typeof faces !== 'object') return [0, 0];
  const converted = {};
  let hasFace = false;

  for (const [javaFace, bedrockFace] of Object.entries(FACE_TO_DIRECTION)) {
    const face = faces[javaFace];
    if (!face || !Array.isArray(face.uv)) continue;
    const [u1, v1, u2, v2] = face.uv.map((value) => Number(value) || 0);
    converted[bedrockFace] = {
      uv: roundVector([u1, v1]),
      uv_size: roundVector([u2 - u1, v2 - v1]),
    };
    if (face.rotation) {
      context.warnings.push(`Rotation UV ignorée sur la face ${javaFace}.`);
    }
    hasFace = true;
  }

  return hasFace ? converted : [0, 0];
}

function getElementRotation(element) {
  if (Array.isArray(element.rotation)) return roundVector(normalizeVector(element.rotation, 3));
  const rotation = element.rotation;
  if (!rotation || typeof rotation !== 'object') return [0, 0, 0];
  const result = [0, 0, 0];
  const axisIndex = { x: 0, y: 1, z: 2 }[String(rotation.axis || '').toLowerCase()];
  if (axisIndex !== undefined) {
    result[axisIndex] = Number(rotation.angle) || 0;
  }
  return roundVector(result);
}

function detectElementFormat(input) {
  if (input.meta || input.outliner) return 'Blockbench .bbmodel';
  return 'Java block/item JSON';
}

function getTextureSizeFromModel(input, options) {
  if (options.textureWidth && options.textureHeight) {
    return { width: options.textureWidth, height: options.textureHeight };
  }
  if (Array.isArray(input.texture_size)) {
    return {
      width: Number(input.texture_size[0]) || DEFAULT_TEXTURE_SIZE.width,
      height: Number(input.texture_size[1]) || DEFAULT_TEXTURE_SIZE.height,
    };
  }
  if (input.resolution) {
    return {
      width: Number(input.resolution.width) || DEFAULT_TEXTURE_SIZE.width,
      height: Number(input.resolution.height) || DEFAULT_TEXTURE_SIZE.height,
    };
  }
  return { ...DEFAULT_TEXTURE_SIZE };
}

function isCubeElement(element) {
  return Boolean(
    element &&
      (!element.type || element.type === 'cube') &&
      Array.isArray(element.from) &&
      Array.isArray(element.to),
  );
}

function getFirstGeometry(model) {
  return model?.['minecraft:geometry']?.[0];
}

function getOutputTextureSize(output) {
  const description = getFirstGeometry(output)?.description || {};
  return {
    width: Number(description.texture_width) || DEFAULT_TEXTURE_SIZE.width,
    height: Number(description.texture_height) || DEFAULT_TEXTURE_SIZE.height,
  };
}

function convertJavaPointToBedrock(point) {
  const vector = normalizeVector(point, 3, [0, 0, 0]);
  return roundVector([vector[0] - 8, vector[1], vector[2] - 8]);
}

function sanitizeIdentifier(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^geometry\./, '')
    .replace(/[^a-z0-9_.]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+|\.+$/g, '');
  return `geometry.${normalized || 'converted_model'}`;
}

function sanitizeBoneName(value) {
  return String(value || 'bone')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '') || 'bone';
}

function uniqueName(name, usedNames) {
  let candidate = name;
  let index = 2;
  while (usedNames.has(candidate)) {
    candidate = `${name}_${index}`;
    index += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function normalizeVector(value, length, fallback = undefined) {
  if (!Array.isArray(value)) return fallback;
  const result = Array.from({ length }, (_, index) => Number(value[index]) || 0);
  return roundVector(result);
}

function roundVector(vector) {
  return vector.map((value) => roundNumber(value));
}

function roundNumber(value) {
  return Number.parseFloat((Number(value) || 0).toFixed(4));
}

function cleanObject(value) {
  if (Array.isArray(value)) return value.map(cleanObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, cleanObject(entryValue)]),
  );
}

function computeStats(output) {
  const geometries = output['minecraft:geometry'] || [];
  const bones = geometries.flatMap((geometry) => geometry.bones || []);
  const cubes = bones.flatMap((bone) => bone.cubes || []);
  return {
    geometryCount: geometries.length,
    boneCount: bones.length,
    cubeCount: cubes.length,
  };
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9edef);

  camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
  camera.position.set(30, 26, 34);

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  els.preview.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 8, 0);

  const ambient = new THREE.HemisphereLight(0xffffff, 0x556064, 2.8);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(26, 38, 24);
  scene.add(key);

  gridHelper = new THREE.GridHelper(40, 40, 0x93a09d, 0xc6cecb);
  gridHelper.position.y = -0.02;
  scene.add(gridHelper);

  modelGroup = new THREE.Group();
  scene.add(modelGroup);

  resizeRenderer();
  animate();
}

function renderModel(output) {
  clearGroup(modelGroup);
  const geometry = getFirstGeometry(output);
  if (!geometry) return;

  const materialFactory = createMaterialFactory();
  const bones = geometry.bones || [];
  const boneMap = new Map(bones.map((bone) => [bone.name, bone]));
  const rootBones = bones.filter((bone) => !bone.parent || !boneMap.has(bone.parent));

  for (const bone of rootBones) {
    modelGroup.add(createBoneObject(bone, boneMap, materialFactory, [0, 0, 0]));
  }

  frameModel();
}

function createBoneObject(bone, boneMap, materialFactory, parentPivot) {
  const pivot = normalizeVector(bone.pivot, 3, [0, 0, 0]);
  const group = new THREE.Group();
  group.name = bone.name;
  group.position.set(pivot[0] - parentPivot[0], pivot[1] - parentPivot[1], pivot[2] - parentPivot[2]);
  applyRotation(group, bone.rotation);

  for (const cube of bone.cubes || []) {
    group.add(createCubeObject(cube, materialFactory, pivot));
  }

  const childBones = Array.from(boneMap.values()).filter((candidate) => candidate.parent === bone.name);
  for (const childBone of childBones) {
    group.add(createBoneObject(childBone, boneMap, materialFactory, pivot));
  }

  return group;
}

function createCubeObject(cube, materialFactory, bonePivot) {
  const origin = normalizeVector(cube.origin, 3, [0, 0, 0]);
  const size = normalizeVector(cube.size, 3, [1, 1, 1]);
  const pivot = normalizeVector(cube.pivot, 3, bonePivot);
  const geometry = createCubeGeometry(origin, size, cube.uv);
  const mesh = new THREE.Mesh(geometry, materialFactory(cube));
  mesh.position.set(-pivot[0], -pivot[1], -pivot[2]);

  if (cube.rotation?.some((value) => value !== 0)) {
    const rotated = new THREE.Group();
    rotated.position.set(pivot[0] - bonePivot[0], pivot[1] - bonePivot[1], pivot[2] - bonePivot[2]);
    applyRotation(rotated, cube.rotation);
    rotated.add(mesh);
    return rotated;
  }

  const group = new THREE.Group();
  group.position.set(pivot[0] - bonePivot[0], pivot[1] - bonePivot[1], pivot[2] - bonePivot[2]);
  group.add(mesh);
  return group;
}

function createMaterialFactory() {
  const material = new THREE.MeshStandardMaterial({
    map: state.texture,
    roughness: 0.84,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const fallback = new THREE.MeshStandardMaterial({
    color: 0x9aa5a6,
    roughness: 0.85,
    metalness: 0,
  });
  return () => (state.texture ? material : fallback);
}

function createCubeGeometry(origin, size, uvDefinition) {
  const [x, y, z] = origin;
  const [w, h, d] = size;
  const min = { x, y, z };
  const max = { x: x + w, y: y + h, z: z + d };
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  const faces = [
    {
      name: 'north',
      normal: [0, 0, -1],
      corners: [
        [min.x, min.y, min.z],
        [max.x, min.y, min.z],
        [max.x, max.y, min.z],
        [min.x, max.y, min.z],
      ],
      size: [w, h],
    },
    {
      name: 'south',
      normal: [0, 0, 1],
      corners: [
        [max.x, min.y, max.z],
        [min.x, min.y, max.z],
        [min.x, max.y, max.z],
        [max.x, max.y, max.z],
      ],
      size: [w, h],
    },
    {
      name: 'east',
      normal: [1, 0, 0],
      corners: [
        [max.x, min.y, min.z],
        [max.x, min.y, max.z],
        [max.x, max.y, max.z],
        [max.x, max.y, min.z],
      ],
      size: [d, h],
    },
    {
      name: 'west',
      normal: [-1, 0, 0],
      corners: [
        [min.x, min.y, max.z],
        [min.x, min.y, min.z],
        [min.x, max.y, min.z],
        [min.x, max.y, max.z],
      ],
      size: [d, h],
    },
    {
      name: 'up',
      normal: [0, 1, 0],
      corners: [
        [min.x, max.y, min.z],
        [max.x, max.y, min.z],
        [max.x, max.y, max.z],
        [min.x, max.y, max.z],
      ],
      size: [w, d],
    },
    {
      name: 'down',
      normal: [0, -1, 0],
      corners: [
        [min.x, min.y, max.z],
        [max.x, min.y, max.z],
        [max.x, min.y, min.z],
        [min.x, min.y, min.z],
      ],
      size: [w, d],
    },
  ];

  faces.forEach((face) => {
    const baseIndex = positions.length / 3;
    const faceUv = getFaceUv(uvDefinition, face.name, face.size);
    face.corners.forEach((corner, cornerIndex) => {
      positions.push(corner[0], corner[1], corner[2]);
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
      uvs.push(faceUv[cornerIndex][0], faceUv[cornerIndex][1]);
    });
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function getFaceUv(uvDefinition, faceName, faceSize) {
  const textureWidth = state.effectiveTextureSize.width || DEFAULT_TEXTURE_SIZE.width;
  const textureHeight = state.effectiveTextureSize.height || DEFAULT_TEXTURE_SIZE.height;
  let rect;

  if (uvDefinition && !Array.isArray(uvDefinition) && uvDefinition[faceName]) {
    const face = uvDefinition[faceName];
    const [u, v] = normalizeVector(face.uv, 2, [0, 0]);
    const [uvWidth, uvHeight] = normalizeVector(face.uv_size, 2, faceSize);
    rect = { u, v, width: uvWidth, height: uvHeight };
  } else if (Array.isArray(uvDefinition)) {
    const [u, v] = normalizeVector(uvDefinition, 2, [0, 0]);
    rect = getBoxUvRect(faceName, u, v, faceSize);
  } else {
    rect = { u: 0, v: 0, width: faceSize[0], height: faceSize[1] };
  }

  const u0 = rect.u / textureWidth;
  const u1 = (rect.u + rect.width) / textureWidth;
  const v0 = 1 - rect.v / textureHeight;
  const v1 = 1 - (rect.v + rect.height) / textureHeight;
  return [
    [u0, v1],
    [u1, v1],
    [u1, v0],
    [u0, v0],
  ];
}

function getBoxUvRect(faceName, u, v, faceSize) {
  const [width, height] = faceSize;
  const rects = {
    north: { u, v, width, height },
    south: { u: u + width, v, width, height },
    east: { u: u + width * 2, v, width, height },
    west: { u: u + width * 3, v, width, height },
    up: { u, v: v + height, width, height: width },
    down: { u: u + width, v: v + height, width, height: width },
  };
  return rects[faceName] || { u, v, width, height };
}

function applyRotation(object, rotation) {
  const [x = 0, y = 0, z = 0] = normalizeVector(rotation, 3, [0, 0, 0]);
  object.rotation.set(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z), 'XYZ');
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    child.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
    });
  }
}

function frameModel() {
  const box = new THREE.Box3().setFromObject(modelGroup);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 8);
  controls.target.copy(center);
  camera.position.set(center.x + radius * 1.6, center.y + radius * 1.2, center.z + radius * 1.8);
  camera.near = Math.max(0.01, radius / 100);
  camera.far = radius * 20;
  camera.updateProjectionMatrix();
  controls.update();
}

function resetCamera() {
  frameModel();
}

function toggleGrid() {
  state.gridVisible = !state.gridVisible;
  gridHelper.visible = state.gridVisible;
  els.gridToggle.classList.toggle('is-active', state.gridVisible);
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = els.preview;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / Math.max(clientHeight, 1);
  camera.updateProjectionMatrix();
}

function animate() {
  animationFrame = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function renderOutput(conversion) {
  els.outputJson.value = JSON.stringify(conversion.output, null, 2);
  els.exportStatus.textContent = `${conversion.stats.cubeCount} cube(s) converti(s)`;
}

function updateStats(conversion) {
  els.sourceFormat.textContent = conversion.sourceFormat;
  els.cubeCount.textContent = String(conversion.stats.cubeCount);
  els.boneCount.textContent = String(conversion.stats.boneCount);
  els.textureSize.textContent = `${state.effectiveTextureSize.width} x ${state.effectiveTextureSize.height}`;
  els.previewTitle.textContent = conversion.output['minecraft:geometry'][0]?.description?.identifier || 'Aperçu 3D';

  els.warningList.innerHTML = '';
  const uniqueWarnings = [...new Set(conversion.warnings)].slice(0, 6);
  uniqueWarnings.forEach((warning) => {
    const item = document.createElement('div');
    item.className = 'warning-item';
    item.textContent = warning;
    els.warningList.appendChild(item);
  });
}

function showError(message) {
  els.exportStatus.textContent = 'Erreur';
  els.warningList.innerHTML = '';
  const item = document.createElement('div');
  item.className = 'warning-item';
  item.textContent = message;
  els.warningList.appendChild(item);
}

async function copyOutput() {
  await navigator.clipboard.writeText(els.outputJson.value);
  const previous = els.copyOutput.innerHTML;
  els.copyOutput.textContent = 'Copié';
  window.setTimeout(() => {
    els.copyOutput.innerHTML = previous;
    createIcons({ icons: { Copy } });
  }, 1200);
}

function downloadOutput() {
  const identifier = state.converted?.['minecraft:geometry']?.[0]?.description?.identifier || 'geometry.converted_model';
  const filename = `${identifier.replace(/^geometry\./, '').replace(/[^a-z0-9_.-]/gi, '_')}.geo.json`;
  const blob = new Blob([els.outputJson.value], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(animationFrame);
  if (state.textureUrl) URL.revokeObjectURL(state.textureUrl);
});
