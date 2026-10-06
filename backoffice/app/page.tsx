'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessao } from '@/lib/sessao';

export default function Inicio() {
  const { admin, entidade, carregando } = useSessao();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    if (admin) router.replace('/entidades');
    else if (entidade) router.replace('/entidade/noticias');
    else router.replace('/login');
  }, [admin, entidade, carregando, router]);

  return <div className="centro-tela">Carregando…</div>;
}
