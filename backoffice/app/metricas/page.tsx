'use client';

import { Protegido } from '../componentes/Protegido';
import { SecaoJornadas } from '../componentes/SecaoJornadas';

// As Jornadas agora vivem numa aba do Dashboard; esta rota segue funcionando.
export default function MetricasPage() {
  return (
    <Protegido>
      <SecaoJornadas />
    </Protegido>
  );
}
