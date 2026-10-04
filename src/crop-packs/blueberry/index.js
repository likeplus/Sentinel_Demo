import { varieties } from './varieties.js';
import { stages, stageAt } from './stages.js';
import { operations, applyOperation } from './operations.js';
import { risks } from './risks.js';
import { forecastRevenue } from './economics.js';
import { advanceCrop } from './crop.js';
/** CropPack contract: id, varieties, stageAt, advanceCrop, applyOperation, forecastRevenue.
 * Inject a registry keyed by cropPackId; the core engine has no blueberry import.
 */
export const blueberryPack = { id: 'blueberry', varieties, stages, operations, risks, stageAt, advanceCrop, applyOperation, forecastRevenue };
export default blueberryPack;
