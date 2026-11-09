import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { FichaArma } from '@/ui/detalhe/FichaArma';

/** Rota da ficha da arma. O corpo vive em `FichaArma`, reutilizado no painel
 *  master-detail (tablet / iPhone Duo aberto). Aqui é só o wrapper da rota. */
export default function RotaFichaArma() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FichaArma id={id} />;
}
