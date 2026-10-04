import { model } from './validation.js';
/** @typedef {{id:string, date:string, weather:Object, market:Object}} World */
export const createWorld = input => model({ weather: { temperature: 22, rainfall: 0, humidity: 0.65 }, market: {} }, input);
