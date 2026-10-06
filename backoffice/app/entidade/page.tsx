'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessao } from '@/lib/sessao';

export default function InicioEntidade() {
  const { entidade, carregando } = useSessao();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    router.replace(entidade ? '/entidade/noticias' : '/entidade/login');
  }, [entidade, carregando, router]);

  return <div className="centro-tela">Carregando…</div>;
}
