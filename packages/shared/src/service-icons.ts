import type {UiIconName} from './icons';
import type {IconName} from './categories';
const cleaning:Record<string,UiIconName>={'Limpieza por horas':'clock','Limpieza profunda':'broom','Limpieza post obra':'tool','Limpieza de oficinas':'office','Planchado':'iron','Limpieza de vidrios':'window','Muebles y colchones':'sofa','Alfombras y cortinas':'rug','Limpieza por mudanza':'box'};
export function serviceIcon(label:string,fallback:IconName):UiIconName{
 if(label==='Otro')return 'chat';
 if(cleaning[label])return cleaning[label];
 const rules:[RegExp,UiIconName][]=[[/reparaci|mantenimiento|revisi/i,'tool'],[/instalaci|montaje/i,'tool'],[/limpieza|lavado|baño/i,'broom'],[/carga|químic|fugas|riego/i,'drop'],[/traslado|mudanza|retiro/i,'box'],[/lámpara|iluminación|led/i,'bulb'],[/vidrio|ventana/i,'window'],[/muebles|colchones/i,'sofa'],[/poda|corte|barber/i,'scissors'],[/oficina/i,'office'],[/pintura|lacado|empaste/i,'brush'],[/clases|tareas/i,'book']];
 return rules.find(([pattern])=>pattern.test(label))?.[1]??fallback;
}
