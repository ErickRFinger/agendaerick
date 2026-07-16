-- Script SQL para configurar o novo banco de dados no Supabase.
-- Execute este script no editor SQL (SQL Editor) do seu painel do Supabase.

-- 1. Criar a tabela de sincronização
CREATE TABLE IF NOT EXISTS public.focofacil_sync (
    code text PRIMARY KEY,
    state jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.focofacil_sync ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas se existirem (para evitar erros ao rodar novamente)
DROP POLICY IF EXISTS "Permitir leitura pública" ON public.focofacil_sync;
DROP POLICY IF EXISTS "Permitir inserção e atualização pública" ON public.focofacil_sync;

-- 4. Criar política de acesso público para leitura
CREATE POLICY "Permitir leitura pública" ON public.focofacil_sync
    FOR SELECT USING (true);

-- 5. Criar política de acesso público para tudo (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Permitir inserção e atualização pública" ON public.focofacil_sync
    FOR ALL USING (true) WITH CHECK (true);
