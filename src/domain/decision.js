import { model } from './validation.js';
export const DECISION_ACTIONS = ['decide_now', 'gather_information', 'delegate', 'delay', 'no_action', 'custom'];
/** @typedef {{id:string, title:string, category:string, openedAt:string, deadline:string|null, productionUnitIds:string[], impactAreas:string[], availableObservationIds:string[], participantIds:string[], viewpoints:Object[], consensusLevel:number, disagreementTopics:string[], investigationOptions:Object[], actionOptions:Object[], selectedAction:Object|null, playerReasonTags:string[], playerReasonText:string, delegatedTo:string|null, managerAttentionCost:number, opportunityCosts:Object[], status:string, resultingOperationIds:string[], outcomeIds:string[], retrospectiveAttribution:Object|null}} DecisionCase */
export const createDecisionCase = input => model({ category: 'management', deadline: null, productionUnitIds: [],
  impactAreas: [], availableObservationIds: [], participantIds: [], viewpoints: [], consensusLevel: 0,
  disagreementTopics: [], investigationOptions: [], actionOptions: DECISION_ACTIONS.map(type => ({ type })),
  selectedAction: null, playerReasonTags: [], playerReasonText: '', delegatedTo: null,
  managerAttentionCost: 0, opportunityCosts: [], status: 'open', resultingOperationIds: [], outcomeIds: [],
  retrospectiveAttribution: null }, input, ['id', 'title', 'openedAt']);
