import { createResource } from '../../domain/index.js';
export const resources = [
  createResource({id:'water',name:'可用水库配额',type:'water',quantity:3600,unit:'m3',compatibleOperations:['irrigation']}),
  createResource({id:'crew-a',name:'现场班组 A',type:'crew',capacityPerDay:1,operatingCost:400,skills:['inspection','irrigation'],compatibleOperations:['inspection','irrigation','maintenance'],reliability:0.95,currentLocation:'CL-1'}),
  createResource({id:'irrigation-rig',name:'滴灌设备',type:'machine',capacityPerDay:1,operatingCost:120,compatibleOperations:['irrigation'],reliability:0.9,currentLocation:'CL-1'}),
  createResource({id:'maintenance-person',name:'维修负责人',type:'person',capacityPerDay:1,operatingCost:300,compatibleOperations:['maintenance','inspection']}),
];
