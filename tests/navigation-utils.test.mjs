import assert from 'node:assert/strict';

import {
  haversineDistanceMeters,
  findNearestLandmark,
  estimateWalkTimeMinutes,
  distanceToPolylineMeters,
  isOffRoute,
  cardinalDirectionFromBearing,
  classifyTurn
} from '../js/navigation-utils.js';

const sampleLandmarks = [
  {
    landmarkId: 'library',
    name: 'Library Entrance',
    coordinates: [0.94488, 51.87695],
    floor: 0
  },
  {
    landmarkId: 'silberrad',
    name: 'Silberrad Entrance',
    coordinates: [0.94602, 51.87688],
    floor: 0
  }
];

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run('haversineDistanceMeters returns ~0 for same coordinate', () => {
  const d = haversineDistanceMeters([0.94488, 51.87695], [0.94488, 51.87695]);
  assert.ok(d < 0.1);
});

run('findNearestLandmark matches nearest landmark under threshold', () => {
  const result = findNearestLandmark([0.94489, 51.87695], sampleLandmarks, { maxDistanceMeters: 40, floor: 0 });
  assert.equal(result?.landmark?.landmarkId, 'library');
  assert.ok(result?.distanceMeters <= 40);
});

run('estimateWalkTimeMinutes uses walking pace', () => {
  assert.equal(estimateWalkTimeMinutes(84), 1);
  assert.equal(estimateWalkTimeMinutes(260), 3);
});

run('distanceToPolylineMeters gives low distance for nearby point', () => {
  const route = [[0.94480, 51.87680], [0.94520, 51.87680], [0.94560, 51.87680]];
  const d = distanceToPolylineMeters([0.94510, 51.87682], route);
  assert.ok(d < 10);
});

run('isOffRoute returns true beyond threshold', () => {
  const route = [[0.94480, 51.87680], [0.94520, 51.87680], [0.94560, 51.87680]];
  assert.equal(isOffRoute([0.94510, 51.87720], route, 15), true);
  assert.equal(isOffRoute([0.94510, 51.87682], route, 15), false);
});

run('cardinalDirectionFromBearing returns expected label', () => {
  assert.equal(cardinalDirectionFromBearing(0), 'north');
  assert.equal(cardinalDirectionFromBearing(95), 'east');
  assert.equal(cardinalDirectionFromBearing(185), 'south');
  assert.equal(cardinalDirectionFromBearing(265), 'west');
});

run('classifyTurn labels turn intensity', () => {
  assert.equal(classifyTurn(0), 'straight');
  assert.equal(classifyTurn(25), 'slight-right');
  assert.equal(classifyTurn(80), 'right');
  assert.equal(classifyTurn(160), 'u-turn');
  assert.equal(classifyTurn(-35), 'slight-left');
  assert.equal(classifyTurn(-95), 'left');
});

console.log('All navigation util tests passed.');

