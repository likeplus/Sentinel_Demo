import { varieties } from './varieties.js';
import { stages, stageAt } from './stages.js';
import { operations, applyOperation } from './operations.js';
import { risks } from './risks.js';
import { forecastRevenue } from './economics.js';
import { advanceCrop } from './crop.js';
/**
 * @typedef {Object} CropPack
 * @property {string} id
 * @property {Object<string,Object>} varieties Configured training parameters.
 * @property {Object<string,Object>} operations Supported operation IDs.
 * @property {Function} stageAt (crop, variety, UTC date) => stage ID.
 * @property {Function} advanceCrop (crop, variety, world, UTC date, RandomEngine) => crop.
 * @property {Function} applyOperation (crop, completed operation) => crop.
 * @property {Function} forecastRevenue (variety, public stress estimate) => revenue.
 * Inject a registry keyed by cropPackId; the core engine has no blueberry import.
 */
export const blueberryPack = { id: 'blueberry', varieties, stages, operations, risks, stageAt, advanceCrop, applyOperation, forecastRevenue };
export default blueberryPack;
