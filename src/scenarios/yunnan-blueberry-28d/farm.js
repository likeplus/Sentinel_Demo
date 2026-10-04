import { createFarm } from '../../domain/index.js';
import { productionUnits } from './productionUnits.js';
import { people } from './people.js';
import { resources } from './resources.js';
export const farm = createFarm({id:'yunnan-farm',name:'Yunnan Blueberry Training Farm',location:{province:'Yunnan',country:'China'},
  clusterIds:['CL-1','CL-2','CL-3'],productionUnitIds:productionUnits.map(u=>u.id),personIds:people.map(p=>p.id),resourceIds:resources.map(r=>r.id)});
