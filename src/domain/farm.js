import { model } from './validation.js';
/** @typedef {{id:string, name:string, location:Object, clusterIds:string[], productionUnitIds:string[], personIds:string[], resourceIds:string[]}} Farm */
export const createFarm = input => model({ location: {}, clusterIds: [], productionUnitIds: [], personIds: [], resourceIds: [] }, input, ['id', 'name']);
