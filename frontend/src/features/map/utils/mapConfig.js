import almacenamientoIcon             from '../../../assets/icons/almacenamiento.png';
import carboelectricaIcon             from '../../../assets/icons/carboelectrica.png';
import cicloCombinadoIcon             from '../../../assets/icons/ciclo_combinado.png';
import combustionInternaIcon          from '../../../assets/icons/combustion_interna.png';
import eolicaIcon                     from '../../../assets/icons/eolica.png';
import fotovoltaicaIcon               from '../../../assets/icons/fotovoltaica.png';
import geotermoelectricaIcon          from '../../../assets/icons/geotermoelectrica.png';
import hidroelectricaIcon             from '../../../assets/icons/hidroelectrica.png';
import nucleoelectricaIcon            from '../../../assets/icons/nucleoelectrica.png';
import termoelectricaConvencionalIcon from '../../../assets/icons/termoelectrica_convencional.png';
import turbogasIcon                   from '../../../assets/icons/turbogas.png';

export const typeIcons = {
  almacenamiento:              almacenamientoIcon,
  carboelectrica:              carboelectricaIcon,
  ciclo_combinado:             cicloCombinadoIcon,
  combustion_interna:          combustionInternaIcon,
  eolica:                      eolicaIcon,
  fotovoltaica:                fotovoltaicaIcon,
  geotermoelectrica:           geotermoelectricaIcon,
  hidroelectrica:              hidroelectricaIcon,
  nucleoelectrica:             nucleoelectricaIcon,
  termoelectrica_convencional: termoelectricaConvencionalIcon,
  turbogas:                    turbogasIcon,
};

export const getPinColor = (type) => {
  switch (type) {
    case 'almacenamiento':              return '#00CED1';
    case 'carboelectrica':              return '#000000';
    case 'ciclo_combinado':             return '#FF8C00';
    case 'combustion_interna':          return '#808080';
    case 'eolica':                      return '#32CD32';
    case 'fotovoltaica':                return '#FFD700';
    case 'geotermoelectrica':           return '#8B4513';
    case 'hidroelectrica':              return '#1E90FF';
    case 'nucleoelectrica':             return '#9400D3';
    case 'termoelectrica_convencional': return '#FF0000';
    case 'turbogas':                    return '#FF1493';
    default:                            return '#272829';
  }
};

export const getReadableType = (type) =>
  type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
