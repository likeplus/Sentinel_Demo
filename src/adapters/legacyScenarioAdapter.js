import { createScenario } from '../domain/scenario.js';
/** Preserve scripted events as compatibility metadata; do not reinterpret them as stochastic rules. */
export function legacyScenarioToScenario(legacy, { startDate, endDate, farmConfigId, seed = 1 }) {
  return createScenario({id:`legacy:${legacy.id}`,name:legacy.name,startDate,endDate,farmConfigId,seed,
    cropPackIds:[legacy.crop],legacyScenarioId:legacy.id,legacyScriptedEvents:legacy.events,
    eventRules:[],difficulty:'demo',observationMode:'scripted'});
}
